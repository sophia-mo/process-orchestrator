/**
 * DSL and AST Type Definitions
 */

/* Node Types */
export type NodeCategory = 'device' | 'sensor' | 'logic' | 'actuator';
export type DeviceType = 'tank' | 'pump' | 'valve' | 'electrolyzer' | 'heat_exchanger';
export type SensorType = 'level' | 'temperature' | 'pressure' | 'flow_rate';
export type LogicType = 'and' | 'or' | 'not' | 'greater_than' | 'less_than' | 'equal' | 'delay' | 'if';
export type ActuatorType = 'start' | 'stop' | 'open' | 'close' | 'set_value';

/* Graph Node */
export interface GraphNode {
  id: string;
  type: 'device' | 'sensor' | 'logic' | 'actuator';
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphNodeData {
  label: string;
  deviceType?: DeviceType;
  sensorType?: SensorType;
  logicType?: LogicType;
  actuatorType?: ActuatorType;
  config?: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/* DSL */
export interface DSLNode {
  id: string;
  type: 'device' | 'sensor' | 'logic' | 'actuator';
  nodeType: DeviceType | SensorType | LogicType | ActuatorType;
  inputs: string[];             // IDs of input nodes
  outputs: string[];            // IDs of output nodes
  config: Record<string, any>;  // e.g., label: "Level Sensor"
}

export interface Rule {
  id: string;
  name: string;
  condition: Condition;
  action: Action;
  enabled: boolean;
}

export type Condition =
  | ComparisonCondition
  | LogicalCondition
  | SensorCondition
  | DelayCondition;

export interface ComparisonCondition {
  type: 'comparison';
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  left: ValueExpression;
  right: ValueExpression;
}

export interface LogicalCondition {
  type: 'logical';
  operator: 'and' | 'or' | 'not';
  operands: Condition[];
}

export interface SensorCondition {
  type: 'sensor';
  sensorId: string;
  sensorLabel?: string; // Display label for the sensor
  sensorType: SensorType;
  property?: string; // e.g., 'level', 'temperature'
  sourceDeviceId?: string; // Which device this sensor is measuring
  sourceDeviceLabel?: string; // Display label for the source device
}

export interface DelayCondition {
  type: 'delay';
  condition: Condition;
  delayMs: number;
}

export type ValueExpression =
  | {
      type: 'sensor';
      sensorId: string;
      sensorLabel?: string;
      property?: string;
      sourceDeviceId?: string;
      sourceDeviceLabel?: string;
    }
  | { type: 'constant'; value: number | string | boolean }
  | { type: 'device'; deviceId: string; deviceLabel?: string; property: string };

export interface Action {
  type: 'actuator';
  actuatorType: ActuatorType;
  targetId: string; // Device ID to control
  targetLabel?: string; // Display label for the target device
  params?: Record<string, any>;
}

/* Complete Workflow Definition */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  rules: Rule[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    author?: string;
  };
}

/* Validation Result */
export interface ValidationError {
  type: 'error' | 'warning';
  nodeId?: string;
  edgeId?: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean; // True if no errors
  errors: ValidationError[];
}

/* Node Compatibility Rules */
export interface NodeCompatibility {
  sourceType: string;
  targetType: string;
  allowed: boolean;
  reason?: string;
}

export const NODE_COMPATIBILITY_RULES: NodeCompatibility[] = [
  // Sensors can connect to logic nodes
  { sourceType: 'sensor', targetType: 'logic', allowed: true },

  // Logic nodes can connect to other logic nodes
  { sourceType: 'logic', targetType: 'logic', allowed: true },

  // Logic nodes can connect to actuators
  { sourceType: 'logic', targetType: 'actuator', allowed: true },

  // Actuators can connect to devices
  { sourceType: 'actuator', targetType: 'device', allowed: true },

  // Sensors cannot directly connect to actuators (must go through logic)
  {
    sourceType: 'sensor',
    targetType: 'actuator',
    allowed: false,
    reason: 'Sensors must connect through logic nodes before actuators'
  },

  // Devices cannot directly connect to other devices
  {
    sourceType: 'device',
    targetType: 'device',
    allowed: false,
    reason: 'Devices cannot directly connect to each other'
  },

  // Pumps cannot connect to temperature sensors directly
  {
    sourceType: 'pump',
    targetType: 'temperature',
    allowed: false,
    reason: 'Pumps cannot directly connect to temperature sensors'
  }
];
