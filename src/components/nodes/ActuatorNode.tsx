import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import ControlPointIcon from '@mui/icons-material/ControlPoint';

interface ActuatorNodeProps {
  id: string;
  data: {
    label: string;
    actuatorType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const actuatorIcons: Record<string, React.ReactElement> = {
  start: <PlayArrowIcon />,
  stop: <StopIcon />,
};

function ActuatorNode({ id, data, isConnectable }: ActuatorNodeProps) {
  const icon = data.actuatorType ? actuatorIcons[data.actuatorType] : <ControlPointIcon />;
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
        border: '3px solid #dc2626',
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        minWidth: '140px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#dc2626' }}
      />

      <div style={{ marginBottom: '8px', color: '#dc2626' }}>{icon}</div>
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
            color: '#7f1d1d',
            background: 'white',
            border: '1px solid #dc2626',
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
            color: '#7f1d1d',
            cursor: 'text',
          }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          {data.label}
        </div>
      )}
      <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px' }}>
        Actuator
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#dc2626' }}
      />
    </div>
  );
}

export default memo(ActuatorNode);
