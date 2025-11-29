import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface ActuatorNodeProps {
  data: {
    label: string;
    actuatorType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const actuatorIcons: Record<string, string> = {
  start: '▶️',
  stop: '⏹️',
  open: '🔓',
  close: '🔒',
  set_value: '⚙️',
};

function ActuatorNode({ data, isConnectable }: ActuatorNodeProps) {
  const icon = data.actuatorType ? actuatorIcons[data.actuatorType] : '🎯';

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
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: '#dc2626' }}
      />

      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#7f1d1d' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px' }}>
        Actuator
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: '#dc2626' }}
      />
    </div>
  );
}

export default memo(ActuatorNode);
