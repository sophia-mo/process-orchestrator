import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type {
  Connection,
  Node,
  Edge,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import DeviceNode from './nodes/DeviceNode';
import SensorNode from './nodes/SensorNode';
import LogicNode from './nodes/LogicNode';
import ActuatorNode from './nodes/ActuatorNode';
import { DSLConverter } from '../utils/dslConverter';
import { WorkflowValidator } from '../utils/validator';
import type { ValidationError } from '../types/dsl';

const nodeTypes: NodeTypes = {
  device: DeviceNode,
  sensor: SensorNode,
  logic: LogicNode,
  actuator: ActuatorNode,
};

export default function ProcessEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [rulesJson, setRulesJson] = useState('');
  const [isEditingRules, setIsEditingRules] = useState(false);

  // Update Rules whenever graph changes (only when not editing)
  useEffect(() => {
    if (nodes.length > 0 && !isEditingRules) {
      const rules = DSLConverter.graphToRules(nodes, edges);
      setRulesJson(JSON.stringify(rules, null, 2));

      // Validate
      const validation = WorkflowValidator.validate(nodes, edges);
      setValidationErrors(validation.errors);
    }
  }, [nodes, edges, isEditingRules]);

  const onConnect = useCallback(
    (connection: Connection) => {
      // Validate connection before adding
      const tempEdges = [...edges, { ...connection, id: `e${edges.length}` } as Edge];
      const validation = WorkflowValidator.validate(nodes, tempEdges);

      const hasError = validation.errors.some(
        (e) =>
          e.type === 'error' &&
          e.edgeId === `e${edges.length}`
      );

      if (!hasError) {
        setEdges((eds) => addEdge(connection, eds));
      } else {
        alert('Invalid connection: ' + validation.errors[0].message);
      }
    },
    [edges, nodes, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const subtype = event.dataTransfer.getData('application/reactflow-subtype');
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!type) return;

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      };

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label,
          [`${type}Type`]: subtype,
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
  };

  const loadExample = () => {
    // Load "High Level Auto-Stop Pump" example
    const exampleNodes: Node[] = [
      {
        id: 'tank_a',
        type: 'device',
        position: { x: 50, y: 100 },
        data: { label: 'Tank A', deviceType: 'tank' },
      },
      {
        id: 'level_sensor',
        type: 'sensor',
        position: { x: 250, y: 100 },
        data: { label: 'Level > 80%', sensorType: 'level', config: { threshold: 80 } },
      },
      {
        id: 'greater_than',
        type: 'logic',
        position: { x: 450, y: 100 },
        data: { label: '> 80', logicType: 'greater_than', config: { threshold: 80 } },
      },
      {
        id: 'stop_actuator',
        type: 'actuator',
        position: { x: 650, y: 100 },
        data: { label: 'Stop Pump', actuatorType: 'stop' },
      },
      {
        id: 'pump_c',
        type: 'device',
        position: { x: 850, y: 100 },
        data: { label: 'Pump C', deviceType: 'pump' },
      },
    ];

    const exampleEdges: Edge[] = [
      { id: 'e1', source: 'tank_a', target: 'level_sensor' },
      { id: 'e2', source: 'level_sensor', target: 'greater_than' },
      { id: 'e3', source: 'greater_than', target: 'stop_actuator' },
      { id: 'e4', source: 'stop_actuator', target: 'pump_c' },
    ];

    setNodes(exampleNodes);
    setEdges(exampleEdges);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Node Palette */}
      <div
        style={{
          width: '250px',
          background: '#f8f9fa',
          padding: '20px',
          borderRight: '1px solid #ddd',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Node Palette</h3>

        <div style={{ marginBottom: '20px' }}>
          <h4>Devices</h4>
          <NodePaletteItem type="device" subtype="tank" label="Tank" icon="🛢️" />
          <NodePaletteItem type="device" subtype="pump" label="Pump" icon="⚙️" />
          <NodePaletteItem type="device" subtype="valve" label="Valve" icon="🔧" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Sensors</h4>
          <NodePaletteItem type="sensor" subtype="level" label="Level Sensor" icon="📊" />
          <NodePaletteItem
            type="sensor"
            subtype="temperature"
            label="Temperature"
            icon="🌡️"
          />
          <NodePaletteItem type="sensor" subtype="pressure" label="Pressure" icon="🔩" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Logic</h4>
          <NodePaletteItem type="logic" subtype="and" label="AND" icon="∧" />
          <NodePaletteItem type="logic" subtype="or" label="OR" icon="∨" />
          <NodePaletteItem type="logic" subtype="not" label="NOT" icon="¬" />
          <NodePaletteItem type="logic" subtype="greater_than" label=">" icon=">" />
          <NodePaletteItem type="logic" subtype="less_than" label="<" icon="<" />
          <NodePaletteItem type="logic" subtype="delay" label="Delay" icon="⏱️" />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Actuators</h4>
          <NodePaletteItem type="actuator" subtype="start" label="Start" icon="▶️" />
          <NodePaletteItem type="actuator" subtype="stop" label="Stop" icon="⏹️" />
          <NodePaletteItem type="actuator" subtype="open" label="Open" icon="🔓" />
          <NodePaletteItem type="actuator" subtype="close" label="Close" icon="🔒" />
        </div>

        <div style={{ marginTop: '30px' }}>
          <button
            onClick={loadExample}
            style={{
              width: '100%',
              padding: '10px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              marginBottom: '10px',
            }}
          >
            Load Example
          </button>
          <button
            onClick={clearCanvas}
            style={{
              width: '100%',
              padding: '10px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Clear Canvas
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* JSON Panel */}
      <div
        style={{
          width: '400px',
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '20px',
          borderLeft: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <h3 style={{ color: '#fff', marginTop: 0 }}>Rules (DSL)</h3>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#f87171' }}>Validation</h4>
            {validationErrors.map((error, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px',
                  marginBottom: '5px',
                  background: error.type === 'error' ? '#7f1d1d' : '#78350f',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              >
                {error.type === 'error' ? '❌' : '⚠️'} {error.message}
              </div>
            ))}
          </div>
        )}

        {/* Rules */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsEditingRules(!isEditingRules)}
              style={{
                padding: '8px 12px',
                background: isEditingRules ? '#ef4444' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {isEditingRules ? '📖 View Mode' : '✏️ Edit Mode'}
            </button>
            {isEditingRules && (
              <>
                <button
                  onClick={() => {
                    const rules = DSLConverter.graphToRules(nodes, edges);
                    setRulesJson(JSON.stringify(rules, null, 2));
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  🔄 Regenerate from Graph
                </button>
                <button
                  onClick={() => {
                    try {
                      console.log('📥 Parsing rules JSON...');
                      const rules = JSON.parse(rulesJson);
                      console.log('Parsed rules:', rules);

                      // Convert rules back to graph
                      const { nodes: newNodes, edges: newEdges } = DSLConverter.rulesToGraph(rules);
                      console.log('✅ Generated from rules:');
                      console.log('  Nodes:', newNodes.length);
                      console.log('  Edges:', newEdges.length);

                      setNodes(newNodes);
                      setEdges(newEdges);
                      setIsEditingRules(false);
                      alert(`✅ Rules applied! Generated ${newNodes.length} nodes and ${newEdges.length} edges.`);
                    } catch (error) {
                      console.error('❌ Error:', error);
                      alert('❌ Error: ' + (error as Error).message);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ⬅️ Apply to Graph
                </button>
              </>
            )}
          </div>
          <textarea
            value={rulesJson || '// No rules generated yet'}
            onChange={(e) => setRulesJson(e.target.value)}
            readOnly={!isEditingRules}
            style={{
              background: '#0a0a0a',
              color: '#d4d4d4',
              padding: '15px',
              borderRadius: '5px',
              fontSize: '11px',
              overflow: 'auto',
              flex: 1,
              border: isEditingRules ? '2px solid #3b82f6' : '1px solid #333',
              fontFamily: 'monospace',
              resize: 'none',
              cursor: isEditingRules ? 'text' : 'default',
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

interface NodePaletteItemProps {
  type: string;
  subtype: string;
  label: string;
  icon: string;
}

function NodePaletteItem({ type, subtype, label, icon }: NodePaletteItemProps) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow-type', type);
    event.dataTransfer.setData('application/reactflow-subtype', subtype);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        padding: '10px',
        margin: '5px 0',
        background: 'white',
        border: '1px solid #ddd',
        borderRadius: '5px',
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <span style={{ fontSize: '13px' }}>{label}</span>
    </div>
  );
}
