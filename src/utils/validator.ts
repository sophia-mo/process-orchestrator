/**
 * Workflow Validator: Static analysis and validation of process logic
 * Prevents users from building invalid or unsafe workflows
 */

import type {
  ValidationResult,
  ValidationError,
} from '../types/dsl';
import { NODE_COMPATIBILITY_RULES } from '../types/dsl';
import type { Node, Edge } from '@xyflow/react';

export class WorkflowValidator {
  /**
   * Validate entire workflow
   */
  static validate(nodes: Node[], edges: Edge[]): ValidationResult {
    const errors: ValidationError[] = [];

    // Run all validation checks
    errors.push(...this.validateNodeConnections(nodes, edges));
    errors.push(...this.validateNodeCompatibility(nodes, edges));
    errors.push(...this.validateCycles(nodes, edges));
    errors.push(...this.validateDisconnectedNodes(nodes, edges));
    errors.push(...this.validateLogicNodeInputs(nodes, edges));

    return {
      valid: errors.filter((e) => e.type === 'error').length === 0,
      errors,
    };
  }

  /**
   * Validate node connections based on compatibility rules
   */
  private static validateNodeConnections(
    nodes: Node[],
    edges: Edge[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Edge connects to non-existent node',
          code: 'INVALID_CONNECTION',
        });
        return;
      }

      // Check type compatibility
      const sourceType = sourceNode.type || '';
      const targetType = targetNode.type || '';

      const rule = NODE_COMPATIBILITY_RULES.find(
        (r) => r.sourceType === sourceType && r.targetType === targetType
      );

      if (rule && !rule.allowed) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: rule.reason || `Cannot connect ${sourceType} to ${targetType}`,
          code: 'INCOMPATIBLE_CONNECTION',
        });
      }
    });

    return errors;
  }

  /**
   * Validate specific node type compatibility
   * Example: Pumps cannot connect directly to temperature sensors
   */
  private static validateNodeCompatibility(
    nodes: Node[],
    edges: Edge[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    edges.forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      if (!sourceNode || !targetNode) return;

      // Specific rule: Sensors cannot directly connect to actuators
      if (sourceNode.type === 'sensor' && targetNode.type === 'actuator') {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message:
            'Sensors must connect through logic nodes before reaching actuators',
          code: 'MISSING_LOGIC_NODE',
        });
      }

      // Specific rule: Devices cannot directly connect to each other
      if (sourceNode.type === 'device' && targetNode.type === 'device') {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message:
            'Devices cannot directly connect to each other. Use sensors and actuators.',
          code: 'INVALID_DEVICE_CONNECTION',
        });
      }

      // Warning: Pumps should have flow control logic
      if (
        sourceNode.data.deviceType === 'pump' &&
        targetNode.type === 'actuator'
      ) {
        const hasLogicInBetween = this.hasIntermediateLogic(
          edge.source,
          edge.target,
          nodes,
          edges
        );

        if (!hasLogicInBetween) {
          errors.push({
            type: 'warning',
            edgeId: edge.id,
            message: 'Pump control should include safety logic (recommended)',
            code: 'MISSING_SAFETY_LOGIC',
          });
        }
      }
    });

    return errors;
  }

  /**
   * Check if there's logic node between source and target
   */
  private static hasIntermediateLogic(
    sourceId: string,
    targetId: string,
    nodes: Node[],
    edges: Edge[]
  ): boolean {
    // Simple BFS to check if any logic node is on the path
    const visited = new Set<string>();
    const queue: string[] = [sourceId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === targetId) continue;
      if (visited.has(currentId)) continue;

      visited.add(currentId);

      const currentNode = nodes.find((n) => n.id === currentId);
      if (currentNode?.type === 'logic') return true;

      // Add connected nodes to queue
      const outgoingEdges = edges.filter((e) => e.source === currentId);
      outgoingEdges.forEach((e) => queue.push(e.target));
    }

    return false;
  }

  /**
   * Detect cycles in the graph (circular dependencies)
   */
  private static validateCycles(nodes: Node[], edges: Edge[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      if (recStack.has(nodeId)) return true;
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recStack.add(nodeId);

      const outgoingEdges = edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (hasCycle(edge.target)) {
          errors.push({
            type: 'error',
            nodeId: nodeId,
            message: 'Circular dependency detected',
            code: 'CIRCULAR_DEPENDENCY',
          });
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    nodes.forEach((node) => {
      if (!visited.has(node.id)) {
        hasCycle(node.id);
      }
    });

    return errors;
  }

  /**
   * Find disconnected nodes (islands)
   */
  private static validateDisconnectedNodes(
    nodes: Node[],
    edges: Edge[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const connectedNodes = new Set<string>();

    edges.forEach((edge) => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    nodes.forEach((node) => {
      if (!connectedNodes.has(node.id)) {
        errors.push({
          type: 'warning',
          nodeId: node.id,
          message: 'Node is not connected to any other nodes',
          code: 'DISCONNECTED_NODE',
        });
      }
    });

    return errors;
  }

  /**
   * Validate logic node inputs
   * Example: AND/OR nodes need at least 2 inputs
   */
  private static validateLogicNodeInputs(
    nodes: Node[],
    edges: Edge[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    nodes.forEach((node) => {
      if (node.type !== 'logic') return;

      const inputCount = edges.filter((e) => e.target === node.id).length;
      const logicType = node.data.logicType;

      switch (logicType) {
        case 'and':
        case 'or':
          if (inputCount < 2) {
            errors.push({
              type: 'error',
              nodeId: node.id,
              message: `${logicType.toUpperCase()} node requires at least 2 inputs`,
              code: 'INSUFFICIENT_INPUTS',
            });
          }
          break;

        case 'not':
          if (inputCount !== 1) {
            errors.push({
              type: 'error',
              nodeId: node.id,
              message: 'NOT node requires exactly 1 input',
              code: 'INVALID_INPUT_COUNT',
            });
          }
          break;

        case 'greater_than':
        case 'less_than':
        case 'equal':
          if (inputCount < 1) {
            errors.push({
              type: 'error',
              nodeId: node.id,
              message: 'Comparison node requires at least 1 input',
              code: 'INSUFFICIENT_INPUTS',
            });
          }
          break;
      }
    });

    return errors;
  }

  /**
   * Validate that workflow has at least one complete path
   */
  static validateCompletePath(nodes: Node[], edges: Edge[]): ValidationError[] {
    const errors: ValidationError[] = [];

    const sensors = nodes.filter((n) => n.type === 'sensor');
    const actuators = nodes.filter((n) => n.type === 'actuator');

    if (sensors.length === 0) {
      errors.push({
        type: 'warning',
        message: 'Workflow has no sensor inputs',
        code: 'NO_SENSORS',
      });
    }

    if (actuators.length === 0) {
      errors.push({
        type: 'warning',
        message: 'Workflow has no actuator outputs',
        code: 'NO_ACTUATORS',
      });
    }

    // Check if any sensor can reach any actuator
    if (sensors.length > 0 && actuators.length > 0) {
      let hasPath = false;

      for (const sensor of sensors) {
        for (const actuator of actuators) {
          if (this.hasPath(sensor.id, actuator.id, edges)) {
            hasPath = true;
            break;
          }
        }
        if (hasPath) break;
      }

      if (!hasPath) {
        errors.push({
          type: 'error',
          message: 'No complete path from sensors to actuators',
          code: 'NO_COMPLETE_PATH',
        });
      }
    }

    return errors;
  }

  /**
   * Check if path exists between two nodes
   */
  private static hasPath(
    sourceId: string,
    targetId: string,
    edges: Edge[]
  ): boolean {
    const visited = new Set<string>();
    const queue: string[] = [sourceId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (currentId === targetId) return true;
      if (visited.has(currentId)) continue;

      visited.add(currentId);

      const outgoingEdges = edges.filter((e) => e.source === currentId);
      outgoingEdges.forEach((e) => queue.push(e.target));
    }

    return false;
  }
}
