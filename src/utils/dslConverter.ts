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

    actuatorNodes.forEach((actuator) => {
      // Trace back to find the condition chain from the actuator's input nodes
      // An actuator should have at least one input (logic or sensor node)
      if (actuator.inputs.length === 0) {
        return; // Skip actuators without inputs
      }

      // Build condition from the first input node
      const condition = this.buildCondition(actuator.inputs[0], dslNodes);

      if (condition) {
        const rule: Rule = {
          id: `rule_${actuator.id}`,
          name: `Rule for ${actuator.config.label || actuator.id}`,
          description: `Auto-generated rule from graph`,
          condition,
          action: {
            type: 'actuator',
            actuatorType: actuator.nodeType as ActuatorType,
            targetId: actuator.outputs[0] || '',
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
  private static buildCondition(nodeId: string, dslNodes: DSLNode[]): Condition | null {
    const node = dslNodes.find((n) => n.id === nodeId);
    if (!node) return null;

    // If this is a logic node, build the logical condition
    if (node.type === 'logic') {
      const logicType = node.nodeType as LogicType;

      switch (logicType) {
        case 'and':
        case 'or': {
          const operands = node.inputs
            .map((inputId) => this.buildCondition(inputId, dslNodes))
            .filter((c): c is Condition => c !== null);

          return {
            type: 'logical',
            operator: logicType === 'and' ? 'and' : 'or',
            operands,
          };
        }

        case 'not': {
          const operand = node.inputs[0]
            ? this.buildCondition(node.inputs[0], dslNodes)
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

          return {
            type: 'comparison',
            operator: operatorMap[logicType],
            left: leftNode
              ? {
                  type: 'sensor',
                  sensorId: leftNode.id,
                  property: leftNode.config.property || 'value',
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
            ? this.buildCondition(node.inputs[0], dslNodes)
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
      return {
        type: 'sensor',
        sensorId: node.id,
        sensorType: node.nodeType as SensorType,
        property: node.config.property || 'value',
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
   * This is the inverse of graphToRules - reconstructs the visual graph from DSL rules
   */
  static rulesToGraph(rules: Rule[]): { nodes: Node[]; edges: Edge[] } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, Node>();
    let yPosition = 100;

    console.log('🔄 Converting rules to graph:', rules);

    rules.forEach((rule, ruleIndex) => {
      console.log(`\n📋 Processing rule ${ruleIndex}:`, rule.name);
      const ruleNodes: Node[] = [];
      const ruleEdges: Edge[] = [];

      // Build condition nodes (recursively)
      const { nodes: conditionNodes, edges: conditionEdges, outputNodeId } =
        this.conditionToNodes(rule.condition, 0, yPosition);

      console.log('  ├─ Condition nodes:', conditionNodes.length);
      ruleNodes.push(...conditionNodes);
      ruleEdges.push(...conditionEdges);

      // Build actuator node with unique ID
      const actuatorId = `actuator_${rule.action.actuatorType}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const actuatorNode: Node = {
        id: actuatorId,
        type: 'actuator',
        position: { x: (conditionNodes.length + 1) * 200, y: yPosition },
        data: {
          label: `${rule.action.actuatorType.toUpperCase()}`,
          actuatorType: rule.action.actuatorType,
          config: rule.action.params || {},
        },
      };
      console.log('  ├─ Actuator node:', actuatorId);
      ruleNodes.push(actuatorNode);

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
          position: { x: (conditionNodes.length + 2) * 200, y: yPosition },
          data: {
            label: rule.action.targetId,
            deviceType,
            config: {},
          },
        };
        console.log('  ├─ Device node:', rule.action.targetId, 'type:', deviceType);
        ruleNodes.push(deviceNode);

        // Connect actuator to device
        ruleEdges.push({
          id: `${actuatorId}-${rule.action.targetId}`,
          source: actuatorId,
          target: rule.action.targetId,
        });
      } else {
        console.log('  ├─ ⚠️ No targetId in action!');
      }

      console.log('  └─ Rule nodes total:', ruleNodes.length);

      // Add all nodes and edges, avoiding duplicates
      ruleNodes.forEach((node) => {
        if (!nodeMap.has(node.id)) {
          console.log('    ✅ Adding node:', node.id, node.type);
          nodeMap.set(node.id, node);
          nodes.push(node);
        } else {
          console.log('    ⏭️  Skipping duplicate:', node.id);
        }
      });
      edges.push(...ruleEdges);

      yPosition += 150; // Offset for next rule
    });

    console.log('\n✅ Final nodes:', nodes.length);
    console.log('✅ Final edges:', edges.length);
    console.log('Nodes:', nodes.map(n => `${n.id} (${n.type})`));

    return { nodes, edges };
  }

  /**
   * Helper: Convert a condition to graph nodes recursively
   */
  private static conditionToNodes(
    condition: Condition,
    xOffset: number,
    yPosition: number
  ): { nodes: Node[]; edges: Edge[]; outputNodeId: string } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    switch (condition.type) {
      case 'sensor': {
        const sensorNode: Node = {
          id: condition.sensorId,
          type: 'sensor',
          position: { x: xOffset * 200, y: yPosition },
          data: {
            label: `${condition.sensorType} sensor`,
            sensorType: condition.sensorType,
            config: { property: condition.property },
          },
        };
        nodes.push(sensorNode);
        return { nodes, edges, outputNodeId: condition.sensorId };
      }

      case 'comparison': {
        // Create sensor node from left side
        let sensorId = '';
        if (condition.left.type === 'sensor') {
          const sensorNode: Node = {
            id: condition.left.sensorId,
            type: 'sensor',
            position: { x: xOffset * 200, y: yPosition },
            data: {
              label: `${condition.left.sensorId}`,
              sensorType: 'level', // Default
              config: { property: condition.left.property },
            },
          };
          nodes.push(sensorNode);
          sensorId = condition.left.sensorId;
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
          position: { x: (xOffset + 1) * 200, y: yPosition },
          data: {
            label: condition.operator,
            logicType: operatorMap[condition.operator] || 'greater_than',
            config: {
              threshold: condition.right.type === 'constant' ? condition.right.value : 0,
            },
          },
        };
        nodes.push(logicNode);

        // Connect sensor to logic
        if (sensorId) {
          edges.push({
            id: `${sensorId}-${logicId}`,
            source: sensorId,
            target: logicId,
          });
        }

        return { nodes, edges, outputNodeId: logicId };
      }

      case 'logical': {
        // Create logic node
        const logicId = `logic_${condition.operator}_${Date.now()}`;
        const logicNode: Node = {
          id: logicId,
          type: 'logic',
          position: { x: (xOffset + condition.operands.length) * 200, y: yPosition },
          data: {
            label: condition.operator.toUpperCase(),
            logicType: condition.operator,
            config: {},
          },
        };
        nodes.push(logicNode);

        // Recursively process operands
        condition.operands.forEach((operand, idx) => {
          const { nodes: childNodes, edges: childEdges, outputNodeId } =
            this.conditionToNodes(operand, xOffset + idx, yPosition + (idx * 50));

          nodes.push(...childNodes);
          edges.push(...childEdges);

          // Connect operand output to this logic node
          edges.push({
            id: `${outputNodeId}-${logicId}`,
            source: outputNodeId,
            target: logicId,
          });
        });

        return { nodes, edges, outputNodeId: logicId };
      }

      case 'delay': {
        const { nodes: innerNodes, edges: innerEdges, outputNodeId: innerId } =
          this.conditionToNodes(condition.condition, xOffset, yPosition);

        const delayId = `delay_${Date.now()}`;
        const delayNode: Node = {
          id: delayId,
          type: 'logic',
          position: { x: (xOffset + innerNodes.length) * 200, y: yPosition },
          data: {
            label: `Delay ${condition.delayMs}ms`,
            logicType: 'delay',
            config: { delayMs: condition.delayMs },
          },
        };

        nodes.push(...innerNodes, delayNode);
        edges.push(...innerEdges);
        edges.push({
          id: `${innerId}-${delayId}`,
          source: innerId,
          target: delayId,
        });

        return { nodes, edges, outputNodeId: delayId };
      }

      default:
        return { nodes, edges, outputNodeId: '' };
    }
  }

  /**
   * Generate complete workflow definition
   */
  static graphToWorkflow(
    nodes: Node[],
    edges: Edge[],
    metadata: { name: string; description?: string; author?: string }
  ): WorkflowDefinition {
    const rules = this.graphToRules(nodes, edges);

    return {
      id: `workflow_${Date.now()}`,
      name: metadata.name,
      description: metadata.description,
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
