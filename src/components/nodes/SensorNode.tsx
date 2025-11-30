import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import WaterIcon from '@mui/icons-material/Water';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import SpeedIcon from '@mui/icons-material/Speed';
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
  level: <WaterIcon />,
  temperature: <DeviceThermostatIcon />,
  pressure: <SpeedIcon />,
};

function SensorNode({ id, data, isConnectable }: SensorNodeProps) {
  const icon = data.sensorType ? sensorIcons[data.sensorType] : <SensorsIcon />;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
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
        position={Position.Top}
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

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#059669' }}
      />
    </div>
  );
}

export default memo(SensorNode);
