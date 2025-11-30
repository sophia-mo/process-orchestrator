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

      // ========== Device -> Sensor Compatibility ==========

      // Rule: Pumps cannot connect to temperature sensors (temperature not relevant for pumps)
      if (
        sourceNode.type === 'device' &&
        sourceNode.data.deviceType === 'pump' &&
        targetNode.type === 'sensor' &&
        targetNode.data.sensorType === 'temperature'
      ) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Pumps cannot connect to temperature sensors. Use pressure or level sensors instead.',
          code: 'INCOMPATIBLE_DEVICE_SENSOR',
        });
      }

      // Rule: Tanks should use level sensors (most common case)
      if (
        sourceNode.type === 'device' &&
        sourceNode.data.deviceType === 'tank' &&
        targetNode.type === 'sensor' &&
        targetNode.data.sensorType === 'pressure'
      ) {
        errors.push({
          type: 'warning',
          edgeId: edge.id,
          message: 'Tanks typically use level sensors. Consider using a level sensor instead of pressure sensor.',
          code: 'UNUSUAL_DEVICE_SENSOR',
        });
      }

      // Rule: Valves typically use pressure or flow sensors
      if (
        sourceNode.type === 'device' &&
        sourceNode.data.deviceType === 'valve' &&
        targetNode.type === 'sensor' &&
        targetNode.data.sensorType === 'level'
      ) {
        errors.push({
          type: 'warning',
          edgeId: edge.id,
          message: 'Valves typically use pressure sensors. Consider using a pressure sensor instead of level sensor.',
          code: 'UNUSUAL_DEVICE_SENSOR',
        });
      }

      // ========== Actuator -> Device Compatibility ==========

      // Rule: Start actuators should connect to active devices (pumps, valves)
      if (
        sourceNode.type === 'actuator' &&
        sourceNode.data.actuatorType === 'start' &&
        targetNode.type === 'device' &&
        targetNode.data.deviceType === 'tank'
      ) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Cannot start a tank. Tanks are passive containers. Use start actuators for pumps or valves.',
          code: 'INVALID_ACTUATOR_DEVICE',
        });
      }

      // Rule: Stop actuators should connect to active devices (pumps, valves)
      if (
        sourceNode.type === 'actuator' &&
        sourceNode.data.actuatorType === 'stop' &&
        targetNode.type === 'device' &&
        targetNode.data.deviceType === 'tank'
      ) {
        errors.push({
          type: 'error',
          edgeId: edge.id,
          message: 'Cannot stop a tank. Tanks are passive containers. Use stop actuators for pumps or valves.',
          code: 'INVALID_ACTUATOR_DEVICE',
        });
      }

      // ========== Safety Logic Requirements ==========

      // Warning: Pumps should have safety logic between sensor and actuator
      if (
        sourceNode.type === 'sensor' &&
        targetNode.type === 'logic'
      ) {
        // Check if this logic eventually controls a pump
        const controlsPump = this.eventuallyControlsDevice(
          targetNode.id,
          'pump',
          nodes,
          edges
        );

        if (controlsPump) {
          const logicType = targetNode.data.logicType;

          // Pumps should have threshold logic (greater_than, less_than)
          if (logicType === 'and' || logicType === 'or') {
            // This is fine - composite logic is acceptable
          } else if (!logicType || logicType === 'delay') {
            errors.push({
              type: 'warning',
              edgeId: edge.id,
              message: 'Pump control should include threshold comparisons for safety (e.g., level > 80%)',
              code: 'MISSING_SAFETY_THRESHOLD',
            });
          }
        }
      }

      // ========== Path Validation ==========

      // Rule: Check for complete control paths (Device -> Sensor -> Logic -> Actuator -> Device)
      if (sourceNode.type === 'device' && targetNode.type === 'sensor') {
        // Check if this sensor eventually leads to an actuator
        const hasCompleteControlPath = this.hasCompleteControlPath(
          targetNode.id,
          nodes,
          edges
        );

        if (!hasCompleteControlPath && edges.length > 3) {
          errors.push({
            type: 'warning',
            edgeId: edge.id,
            message: 'This sensor does not lead to any actuator. Consider completing the control path.',
            code: 'INCOMPLETE_CONTROL_PATH',
          });
        }
      }
    });

    return errors;
  }

  /**
   * Check if a node eventually controls a specific device type
   */
  private static eventuallyControlsDevice(
    nodeId: string,
    deviceType: string,
    nodes: Node[],
    edges: Edge[]
  ): boolean {
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodes.find((n) => n.id === currentId);

      // Check if we reached a device of the target type
      if (
        currentNode?.type === 'device' &&
        currentNode.data.deviceType === deviceType
      ) {
        return true;
      }

      // Continue searching downstream
      const outgoingEdges = edges.filter((e) => e.source === currentId);
      outgoingEdges.forEach((e) => queue.push(e.target));
    }

    return false;
  }

  /**
   * Check if a sensor has a complete path to an actuator through logic
   */
  private static hasCompleteControlPath(
    sensorId: string,
    nodes: Node[],
    edges: Edge[]
  ): boolean {
    const visited = new Set<string>();
    const queue: string[] = [sensorId];
    let hasLogic = false;

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = nodes.find((n) => n.id === currentId);

      if (currentNode?.type === 'logic') {
        hasLogic = true;
      }

      // Check if we reached an actuator
      if (currentNode?.type === 'actuator' && hasLogic) {
        return true;
      }

      // Continue searching downstream
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
