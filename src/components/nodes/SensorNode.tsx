import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import CompressIcon from '@mui/icons-material/Compress';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import SensorsIcon from '@mui/icons-material/Sensors';

interface SensorNodeProps {
  id: string;
  data: {
    label: string;
    sensorType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const sensorIcons: Record<string, React.ReactElement> = {
  level: <ShowChartIcon />,
  temperature: <DeviceThermostatIcon />,
  pressure: <CompressIcon />,
  flow_rate: <WaterDropIcon />,
};

function SensorNode({ id, data, isConnectable }: SensorNodeProps) {
  const icon = data.sensorType ? sensorIcons[data.sensorType] : <SensorsIcon />;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [threshold, setThreshold] = useState(data.config?.threshold?.toString() || '');
  const { updateNodeData } = useReactFlow();

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    updateNodeData(id, { label });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      updateNodeData(id, { label });
    }
  };

  const handleThresholdDoubleClick = () => {
    setIsEditingThreshold(true);
  };

  const handleThresholdBlur = () => {
    setIsEditingThreshold(false);
    const numValue = parseFloat(threshold);
    if (!isNaN(numValue)) {
      updateNodeData(id, { config: { ...data.config, threshold: numValue } });
    }
  };

  const handleThresholdKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingThreshold(false);
      const numValue = parseFloat(threshold);
      if (!isNaN(numValue)) {
        updateNodeData(id, { config: { ...data.config, threshold: numValue } });
      }
    }
  };

  return (
    <div
      style={{
        padding: '12px 24px',
        borderRadius: '10px',
        border: '3px solid #059669',
        background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
        minWidth: '140px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: '#059669' }}
      />

      <div style={{ marginBottom: '8px', color: '#059669' }}>{icon}</div>
      {isEditing ? (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#064e3b',
            background: 'white',
            border: '1px solid #059669',
            borderRadius: '4px',
            padding: '4px 8px',
            textAlign: 'center',
            width: '100%',
          }}
        />
      ) : (
        <div
          style={{
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#064e3b',
            cursor: 'text',
          }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          {data.label}
        </div>
      )}
      <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
        Sensor
      </div>
      {data.config?.threshold !== undefined && (
        <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>
          {isEditingThreshold ? (
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onBlur={handleThresholdBlur}
              onKeyDown={handleThresholdKeyDown}
              autoFocus
              style={{
                fontSize: '11px',
                color: '#047857',
                background: 'white',
                border: '1px solid #059669',
                borderRadius: '3px',
                padding: '2px 4px',
                textAlign: 'center',
                width: '60px',
              }}
            />
          ) : (
            <span
              onDoubleClick={handleThresholdDoubleClick}
              style={{ cursor: 'pointer' }}
              title="Double-click to edit threshold"
            >
              Threshold: {data.config.threshold}
            </span>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: '#059669' }}
      />
    </div>
  );
}

export default memo(SensorNode);
