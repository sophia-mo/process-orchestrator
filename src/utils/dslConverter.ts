/**
 * DSL Converter: Transforms visual graph topology into DSL
 */

import type {
  DSLNode,
  Rule,
  Condition,
  WorkflowDefinition,
  LogicType,
  SensorType,
  ActuatorType,
  DeviceType,
  GraphNode,
} from '../types/dsl';
import type { Node, Edge } from '@xyflow/react';

export class DSLConverter {
  /**
   * Convert React Flow graph to process node representation
   * Represent as a flat node list with connections
   */
  static graphToNodes(nodes: Node[], edges: Edge[]): DSLNode[] {
    const dslNodes: DSLNode[] = [];

    // Build adjacency map for quick lookup
    const edgeMap = new Map<string, { inputs: string[]; outputs: string[] }>();

    nodes.forEach((node) => {
      edgeMap.set(node.id, { inputs: [], outputs: [] });
    });

    edges.forEach((edge) => {
      const sourceData = edgeMap.get(edge.source);
      const targetData = edgeMap.get(edge.target);

      if (sourceData) sourceData.outputs.push(edge.target);
      if (targetData) targetData.inputs.push(edge.source);
    });

    // Convert each node
    nodes.forEach((node) => {
      const connections = edgeMap.get(node.id) || { inputs: [], outputs: [] };

      const dslNode: DSLNode = {
        id: node.id,
        type: node.type as 'device' | 'sensor' | 'logic' | 'actuator',
        nodeType: (node.data.deviceType ||
          node.data.sensorType ||
          node.data.logicType ||
          node.data.actuatorType) as DeviceType | SensorType | LogicType | ActuatorType,
        inputs: connections.inputs,
        outputs: connections.outputs,
        config: node.data.config || {},
      };

      dslNodes.push(dslNode);
    });

    return dslNodes;
  }

  /**
   * Convert React Flow graph to high-level Rules (DSL)
   */
  static graphToRules(nodes: Node[], edges: Edge[]): Rule[] {
    const rules: Rule[] = [];
    const dslNodes = this.graphToNodes(nodes, edges);

    // Find all actuator nodes (these are rule actions)
    const actuatorNodes = dslNodes.filter((n) => n.type === 'actuator');

    actuatorNodes.forEach((actuator, index) => {
      // Trace back to find the condition chain from the actuator's input nodes
      // An actuator should have at least one input (logic or sensor node)
      if (actuator.inputs.length === 0) {
        return; // Skip actuators without inputs
      }

      // Build condition from the first input node
      const condition = this.buildCondition(actuator.inputs[0], dslNodes, nodes);

      if (condition) {
        // Find target device label from original React Flow nodes
        const targetDeviceNode = actuator.outputs[0]
          ? nodes.find((n) => n.id === actuator.outputs[0])
          : null;

        // Find actuator label from original React Flow nodes
        const actuatorNode = nodes.find((n) => n.id === actuator.id);

        const rule: Rule = {
          id: `rule_${Date.now()}_${index}`,
          name: `Rule for ${(actuatorNode?.data.label as string | undefined) || actuator.id}`,
          condition,
          action: {
            type: 'actuator',
            actuatorType: actuator.nodeType as ActuatorType,
            targetId: actuator.outputs[0] || '',
            targetLabel: (targetDeviceNode?.data.label as string | undefined) || actuator.outputs[0],
            params: actuator.config,
          },
          enabled: true,
        };

        rules.push(rule);
      }
    });

    return rules;
  }

  /**
   * Build a condition tree by tracing back from a node
   */
  private static buildCondition(nodeId: string, dslNodes: DSLNode[], nodes: Node[]): Condition | null {
    const node = dslNodes.find((n) => n.id === nodeId);
    if (!node) return null;

    // If this is a logic node, build the logical condition
    if (node.type === 'logic') {
      const logicType = node.nodeType as LogicType;

      switch (logicType) {
        case 'and':
        case 'or': {
          const operands = node.inputs
            .map((inputId) => this.buildCondition(inputId, dslNodes, nodes))
            .filter((c): c is Condition => c !== null);

          return {
            type: 'logical',
            operator: logicType === 'and' ? 'and' : 'or',
            operands,
          };
        }

        case 'not': {
          const operand = node.inputs[0]
            ? this.buildCondition(node.inputs[0], dslNodes, nodes)
            : null;

          if (operand) {
            return {
              type: 'logical',
              operator: 'not',
              operands: [operand],
            };
          }
          break;
        }

        case 'greater_than':
        case 'less_than':
        case 'equal': {
          const operatorMap = {
            'greater_than': '>',
            'less_than': '<',
            'equal': '==',
          } as const;

          const leftNode = node.inputs[0]
            ? dslNodes.find((n) => n.id === node.inputs[0])
            : null;

          // Find source device for sensor (trace back through sensor's inputs)
          let sourceDeviceId: string | undefined;
          let sourceDeviceLabel: string | undefined;
          if (leftNode && leftNode.type === 'sensor' && leftNode.inputs.length > 0) {
            const sourceDevice = dslNodes.find((n) => n.id === leftNode.inputs[0]);
            if (sourceDevice && sourceDevice.type === 'device') {
              sourceDeviceId = sourceDevice.id;
              // Get label from original React Flow node
              const sourceDeviceReactNode = nodes.find((n) => n.id === sourceDevice.id);
              sourceDeviceLabel = sourceDeviceReactNode?.data.label as string | undefined;
            }
          }

          // Get sensor label from original React Flow node
          const sensorReactNode = leftNode ? nodes.find((n) => n.id === leftNode.id) : null;

          return {
            type: 'comparison',
            operator: operatorMap[logicType],
            left: leftNode
              ? {
                  type: 'sensor',
                  sensorId: leftNode.id,
                  sensorLabel: sensorReactNode?.data.label as string | undefined,
                  property: leftNode.config.property || 'value',
                  sourceDeviceId,
                  sourceDeviceLabel,
                }
              : { type: 'constant', value: 0 },
            right: {
              type: 'constant',
              value: node.config.threshold || node.config.value || 0,
            },
          };
        }

        case 'delay': {
          const innerCondition = node.inputs[0]
            ? this.buildCondition(node.inputs[0], dslNodes, nodes)
            : null;

          if (innerCondition) {
            return {
              type: 'delay',
              condition: innerCondition,
              delayMs: node.config.delayMs || 1000,
            };
          }
          break;
        }
      }
    }

    // If this is a sensor node, return sensor condition
    if (node.type === 'sensor') {
      // Find source device for sensor
      let sourceDeviceId: string | undefined;
      let sourceDeviceLabel: string | undefined;
      if (node.inputs.length > 0) {
        const sourceDevice = dslNodes.find((n) => n.id === node.inputs[0]);
        if (sourceDevice && sourceDevice.type === 'device') {
          sourceDeviceId = sourceDevice.id;
          // Get label from original React Flow node
          const sourceDeviceReactNode = nodes.find((n) => n.id === sourceDevice.id);
          sourceDeviceLabel = sourceDeviceReactNode?.data.label as string | undefined;
        }
      }

      // Get sensor label from original React Flow node
      const sensorReactNode = nodes.find((n) => n.id === node.id);

      return {
        type: 'sensor',
        sensorId: node.id,
        sensorLabel: sensorReactNode?.data.label as string | undefined,
        sensorType: node.nodeType as SensorType,
        property: node.config.property || 'value',
        sourceDeviceId,
        sourceDeviceLabel,
      };
    }

    return null;
  }

  /**
   * Convert DSL nodes back to graph representation (for bidirectional binding)
   */
  static nodesToGraph(dslNodes: DSLNode[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    dslNodes.forEach((dslNode, index) => {
      // Create React Flow node
      const node: Node = {
        id: dslNode.id,
        type: dslNode.type,
        position: { x: index * 200, y: index * 100 }, // Default positioning
        data: {
          label: dslNode.config.label || dslNode.id,
          [`${dslNode.type}Type`]: dslNode.nodeType,
          config: dslNode.config,
        },
      };

      nodes.push(node);

      // Create edges based on outputs
      dslNode.outputs.forEach((targetId, idx) => {
        edges.push({
          id: `${dslNode.id}-${targetId}-${idx}`,
          source: dslNode.id,
          target: targetId,
        });
      });
    });

    return { nodes, edges };
  }

  /**
   * Convert Rules back to graph representation
   */
  static rulesToGraph(rules: Rule[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, Node>();
    const xPosition = 100; // Fixed x-position
    let yPosition = 0;

    rules.forEach((rule) => {
      const ruleNodes: Node[] = [];
      const ruleEdges: Edge[] = [];

      // Build condition nodes (recursively)
      const { nodes: conditionNodes, edges: conditionEdges, outputNodeId, nodeCount } =
        this.conditionToNodes(rule.condition, xPosition, yPosition);

      ruleNodes.push(...conditionNodes);
      ruleEdges.push(...conditionEdges);

      // Update y-position for next node (200px per node)
      yPosition += nodeCount * 200;

      // Build actuator node
      const actuatorId = `actuator_${rule.action.actuatorType}`;
      const actuatorNode: Node = {
        id: actuatorId,
        type: 'actuator',
        position: { x: xPosition, y: yPosition },
        data: {
          label: `${rule.action.actuatorType.toUpperCase()}`,
          actuatorType: rule.action.actuatorType,
          config: rule.action.params || {},
        },
      };
      ruleNodes.push(actuatorNode);
      yPosition += 200;

      // Connect last condition node to actuator
      if (outputNodeId) {
        ruleEdges.push({
          id: `${outputNodeId}-${actuatorId}`,
          source: outputNodeId,
          target: actuatorId,
        });
      }

      // Build device node (target of actuator) - only if targetId exists
      if (rule.action.targetId) {
        // Infer device type from ID
        let deviceType: DeviceType = 'pump';
        if (rule.action.targetId.includes('tank')) deviceType = 'tank';
        else if (rule.action.targetId.includes('valve')) deviceType = 'valve';
        else if (rule.action.targetId.includes('pump')) deviceType = 'pump';

        const deviceNode: Node = {
          id: rule.action.targetId,
          type: 'device',
          position: { x: xPosition, y: yPosition },
          data: {
            label: rule.action.targetLabel || rule.action.targetId,
            deviceType,
            config: {},
          },
        };
        ruleNodes.push(deviceNode);
        yPosition += 200;

        // Connect actuator to device
        ruleEdges.push({
          id: `${actuatorId}-${rule.action.targetId}`,
          source: actuatorId,
          target: rule.action.targetId,
        });
      }

      // Add all nodes and edges, avoiding duplicates
      ruleNodes.forEach((node) => {
        if (!nodeMap.has(node.id)) {
          nodeMap.set(node.id, node);
          nodes.push(node);
        }
      });
      edges.push(...ruleEdges);
    });

    return { nodes, edges };
  }

  /**
   * Helper: Convert a condition to graph nodes recursively
   */
  private static conditionToNodes(
    condition: Condition,
    xPosition: number,
    yPosition: number
  ): { nodes: Node[]; edges: Edge[]; outputNodeId: string; nodeCount: number } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let currentY = yPosition;

    switch (condition.type) {
      case 'sensor': {
        // Create source device if specified
        if (condition.sourceDeviceId) {
          let deviceType: DeviceType = 'tank';
          if (condition.sourceDeviceId.includes('pump')) deviceType = 'pump';
          else if (condition.sourceDeviceId.includes('valve')) deviceType = 'valve';
          else if (condition.sourceDeviceId.includes('tank')) deviceType = 'tank';

          const deviceNode: Node = {
            id: condition.sourceDeviceId,
            type: 'device',
            position: { x: xPosition, y: currentY },
            data: {
              label: condition.sourceDeviceLabel || condition.sourceDeviceId,
              deviceType,
              config: {},
            },
          };
          nodes.push(deviceNode);
          currentY += 200;
        }

        const sensorNode: Node = {
          id: condition.sensorId,
          type: 'sensor',
          position: { x: xPosition, y: currentY },
          data: {
            label: condition.sensorLabel || `${condition.sensorType} sensor`,
            sensorType: condition.sensorType,
            config: { property: condition.property },
          },
        };
        nodes.push(sensorNode);
        currentY += 200;

        // Connect device to sensor if source device exists
        if (condition.sourceDeviceId) {
          edges.push({
            id: `${condition.sourceDeviceId}-${condition.sensorId}`,
            source: condition.sourceDeviceId,
            target: condition.sensorId,
          });
        }

        return { nodes, edges, outputNodeId: condition.sensorId, nodeCount: nodes.length };
      }

      case 'comparison': {
        // Create sensor node from left side
        let sensorId = '';
        if (condition.left.type === 'sensor') {
          // Create source device if specified
          if (condition.left.sourceDeviceId) {
            let deviceType: DeviceType = 'tank';
            if (condition.left.sourceDeviceId.includes('pump')) deviceType = 'pump';
            else if (condition.left.sourceDeviceId.includes('valve')) deviceType = 'valve';
            else if (condition.left.sourceDeviceId.includes('tank')) deviceType = 'tank';

            const deviceNode: Node = {
              id: condition.left.sourceDeviceId,
              type: 'device',
              position: { x: xPosition, y: currentY },
              data: {
                label: condition.left.sourceDeviceLabel || condition.left.sourceDeviceId,
                deviceType,
                config: {},
              },
            };
            nodes.push(deviceNode);
            currentY += 200;
          }

          const sensorNode: Node = {
            id: condition.left.sensorId,
            type: 'sensor',
            position: { x: xPosition, y: currentY },
            data: {
              label: condition.left.sensorLabel || condition.left.sensorId,
              sensorType: 'level', // Default
              config: { property: condition.left.property },
            },
          };
          nodes.push(sensorNode);
          sensorId = condition.left.sensorId;
          currentY += 200;

          // Connect device to sensor if source device exists
          if (condition.left.sourceDeviceId) {
            edges.push({
              id: `${condition.left.sourceDeviceId}-${condition.left.sensorId}`,
              source: condition.left.sourceDeviceId,
              target: condition.left.sensorId,
            });
          }
        }

        // Create logic node for comparison
        const logicId = `logic_${Date.now()}_${Math.random()}`;
        const operatorMap: Record<string, LogicType> = {
          '>': 'greater_than',
          '<': 'less_than',
          '==': 'equal',
        };

        const logicNode: Node = {
          id: logicId,
          type: 'logic',
          position: { x: xPosition, y: currentY },
          data: {
            label: condition.operator,
            logicType: operatorMap[condition.operator] || 'greater_than',
            config: {
              threshold: condition.right.type === 'constant' ? condition.right.value : 0,
            },
          },
        };
        nodes.push(logicNode);
        currentY += 200;

        // Connect sensor to logic
        if (sensorId) {
          edges.push({
            id: `${sensorId}-${logicId}`,
            source: sensorId,
            target: logicId,
          });
        }

        return { nodes, edges, outputNodeId: logicId, nodeCount: nodes.length };
      }

      case 'logical': {
        // Recursively process operands first
        let totalNodeCount = 0;
        const operandOutputs: string[] = [];

        condition.operands.forEach((operand) => {
          const { nodes: childNodes, edges: childEdges, outputNodeId, nodeCount } =
            this.conditionToNodes(operand, xPosition, currentY);

          nodes.push(...childNodes);
          edges.push(...childEdges);
          operandOutputs.push(outputNodeId);

          currentY += nodeCount * 200;
          totalNodeCount += nodeCount;
        });

        // Create logic node after operands
        const logicId = `logic_${condition.operator}_${Date.now()}`;
        const logicNode: Node = {
          id: logicId,
          type: 'logic',
          position: { x: xPosition, y: currentY },
          data: {
            label: condition.operator.toUpperCase(),
            logicType: condition.operator,
            config: {},
          },
        };
        nodes.push(logicNode);
        totalNodeCount++;

        // Connect all operand outputs to this logic node
        operandOutputs.forEach((outputId) => {
          edges.push({
            id: `${outputId}-${logicId}`,
            source: outputId,
            target: logicId,
          });
        });

        return { nodes, edges, outputNodeId: logicId, nodeCount: totalNodeCount };
      }

      case 'delay': {
        const { nodes: innerNodes, edges: innerEdges, outputNodeId: innerId, nodeCount: innerCount } =
          this.conditionToNodes(condition.condition, xPosition, currentY);

        nodes.push(...innerNodes);
        edges.push(...innerEdges);
        currentY += innerCount * 200;

        const delayId = `delay_${Date.now()}`;
        const delayNode: Node = {
          id: delayId,
          type: 'logic',
          position: { x: xPosition, y: currentY },
          data: {
            label: `Delay ${condition.delayMs}ms`,
            logicType: 'delay',
            config: { delayMs: condition.delayMs },
          },
        };
        nodes.push(delayNode);

        edges.push({
          id: `${innerId}-${delayId}`,
          source: innerId,
          target: delayId,
        });

        return { nodes, edges, outputNodeId: delayId, nodeCount: innerCount + 1 };
      }

      default:
        return { nodes, edges, outputNodeId: '', nodeCount: 0 };
    }
  }

  /**
   * Generate complete workflow definition
   */
  static graphToWorkflow(
    nodes: Node[],
    edges: Edge[],
    metadata: { name: string; author?: string }
  ): WorkflowDefinition {
    const rules = this.graphToRules(nodes, edges);

    return {
      id: `workflow_${Date.now()}`,
      name: metadata.name,
      version: '1.0.0',
      rules,
      graph: {
        nodes: nodes.map((n): GraphNode => ({
          id: n.id,
          type: n.type as 'device' | 'sensor' | 'logic' | 'actuator',
          position: n.position,
          data: {
            label: (n.data.label as string) || n.id,
            deviceType: n.data.deviceType as DeviceType | undefined,
            sensorType: n.data.sensorType as SensorType | undefined,
            logicType: n.data.logicType as LogicType | undefined,
            actuatorType: n.data.actuatorType as ActuatorType | undefined,
            config: n.data.config as Record<string, any> | undefined,
          },
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined,
        })),
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: metadata.author,
      },
    };
  }
}
