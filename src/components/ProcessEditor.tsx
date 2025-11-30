import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import type { Connection, Node, Edge, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import PropaneTankIcon from '@mui/icons-material/PropaneTank';
import ShutterSpeedIcon from '@mui/icons-material/ShutterSpeed';
import CountertopsIcon from '@mui/icons-material/Countertops';
import WaterIcon from '@mui/icons-material/Water';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import SpeedIcon from '@mui/icons-material/Speed';
import MergeIcon from '@mui/icons-material/Merge';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import TimerIcon from '@mui/icons-material/Timer';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';

import DeviceNode from './nodes/DeviceNode';
import SensorNode from './nodes/SensorNode';
import LogicNode from './nodes/LogicNode';
import ActuatorNode from './nodes/ActuatorNode';
import { DSLConverter } from '../utils/dslConverter';
import { WorkflowValidator } from '../utils/validator';
import type { ValidationError } from '../types/dsl';

export default function ProcessEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [rulesJson, setRulesJson] = useState('');
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Performance Optimization: Memoize nodeTypes to prevent recreation on every render
  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      device: DeviceNode,
      sensor: SensorNode,
      logic: LogicNode,
      actuator: ActuatorNode,
    }),
    []
  );

  // Performance Optimization: Debounce validation to avoid excessive re-validation
  const validationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update Rules whenever graph changes (only when not editing)
  // Performance Optimization: Debounced validation (300ms delay)
  useEffect(() => {
    if (nodes.length > 0 && !isEditingRules) {
      // Clear previous timeout
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }

      // Set new timeout for debounced validation
      validationTimeoutRef.current = setTimeout(() => {
        const rules = DSLConverter.graphToRules(nodes, edges);
        setRulesJson(JSON.stringify(rules, null, 2));

        // Validate
        const validation = WorkflowValidator.validate(nodes, edges);
        setValidationErrors(validation.errors);
      }, 300);
    }

    // Cleanup timeout on unmount
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
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
        setSnackbar({
          open: true,
          message: 'Invalid connection: ' + validation.errors[0].message,
          severity: 'error',
        });
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

  // Performance Optimization: Memoize clearCanvas callback
  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  // Performance Optimization: Memoize loadExample callback
  const loadExample = useCallback(() => {
    // Load "High Level Auto-Stop Pump" example
    const exampleNodes: Node[] = [
      {
        id: 'tank_a',
        type: 'device',
        position: { x: 100, y: 0 },
        data: { label: 'Tank A', deviceType: 'tank' },
      },
      {
        id: 'level_sensor',
        type: 'sensor',
        position: { x: 100, y: 200 },
        data: { label: 'Level Sensor', sensorType: 'level'},
      },
      {
        id: 'greater_than',
        type: 'logic',
        position: { x: 100, y: 400 },
        data: { label: 'Greater than', logicType: 'greater_than', config: { threshold: 80 } },
      },
      {
        id: 'stop_actuator',
        type: 'actuator',
        position: { x: 100, y: 600 },
        data: { label: 'Stop Pump', actuatorType: 'stop' },
      },
      {
        id: 'pump_c',
        type: 'device',
        position: { x: 100, y: 800 },
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
  }, [setNodes, setEdges]);

  // Performance Optimization: Memoize Apply to Graph handler
  const handleApplyToGraph = useCallback(() => {
    try {
      const rules = JSON.parse(rulesJson);
      // Convert rules back to graph
      const { nodes: newNodes, edges: newEdges } = DSLConverter.rulesToGraph(rules);
      setNodes(newNodes);
      setEdges(newEdges);
      setIsEditingRules(false);
      setSnackbar({
        open: true,
        message: `Rules applied! Generated ${newNodes.length} nodes and ${newEdges.length} edges.`,
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error: ' + (error as Error).message,
        severity: 'error',
      });
    }
  }, [rulesJson, setNodes, setEdges]);

  // Performance Optimization: Memoize snackbar close handler
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Node Palette */}
      <div
        style={{
          width: '250px',
          background: '#f8f9fa',
          padding: '0 20px 20px 20px',
          borderRight: '1px solid #ddd',
          overflowY: 'auto',
        }}
      >

        <div style={{ marginBottom: '20px' }}>
          <h4>Devices</h4>
          <NodePaletteItem type="device" subtype="tank" label="Tank" icon={<PropaneTankIcon />} />
          <NodePaletteItem type="device" subtype="pump" label="Pump" icon={<ShutterSpeedIcon />} />
          <NodePaletteItem type="device" subtype="electrolyzer" label="Electrolyzer" icon={<CountertopsIcon />} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Sensors</h4>
          <NodePaletteItem type="sensor" subtype="level" label="Level Sensor" icon={<WaterIcon />} />
          <NodePaletteItem
            type="sensor"
            subtype="temperature"
            label="Temperature"
            icon={<DeviceThermostatIcon />}
          />
          <NodePaletteItem type="sensor" subtype="pressure" label="Pressure" icon={<SpeedIcon />} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Logic</h4>
          <NodePaletteItem type="logic" subtype="and" label="AND" icon={<MergeIcon />} />
          <NodePaletteItem type="logic" subtype="or" label="OR" icon={<CallSplitIcon />} />
          <NodePaletteItem type="logic" subtype="greater_than" label="Greater than" icon={<KeyboardArrowRightIcon />} />
          <NodePaletteItem type="logic" subtype="less_than" label="Less than" icon={<KeyboardArrowLeftIcon />} />
          <NodePaletteItem type="logic" subtype="delay" label="Delay" icon={<TimerIcon />} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Actuators</h4>
          <NodePaletteItem type="actuator" subtype="start" label="Start" icon={<PlayArrowIcon />} />
          <NodePaletteItem type="actuator" subtype="stop" label="Stop" icon={<StopIcon />} />
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
            <h4 style={{ color: '#f87171', marginTop: 0 }}>Validation</h4>
            <Stack sx={{ width: '100%' }} spacing={1}>
              {validationErrors.map((error, idx) => (
                <Alert
                  key={idx}
                  severity={error.type === 'error' ? 'error' : 'warning'}
                  sx={{ fontSize: '12px' }}
                >
                  {error.message}
                </Alert>
              ))}
            </Stack>
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
              {isEditingRules ? 'View Mode' : 'Edit Mode'}
            </button>
            {isEditingRules && (
              <button
                onClick={handleApplyToGraph}
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
                Apply to Graph
              </button>
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

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          icon={snackbar.severity === 'success' ? <CheckIcon fontSize="inherit" /> : <ErrorIcon fontSize="inherit" />}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

interface NodePaletteItemProps {
  type: string;
  subtype: string;
  label: string;
  icon: React.ReactElement;
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
      <span style={{ display: 'flex', alignItems: 'center', color: '#666' }}>{icon}</span>
      <span style={{ fontSize: '13px' }}>{label}</span>
    </div>
  );
}
