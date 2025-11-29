import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface DeviceNodeProps {
  data: {
    label: string;
    deviceType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const deviceIcons: Record<string, string> = {
  tank: '🛢️',
  pump: '⚙️',
  valve: '🔧',
  electrolyzer: '⚡',
  heat_exchanger: '🔥',
};

function DeviceNode({ data, isConnectable }: DeviceNodeProps) {
  const icon = data.deviceType ? deviceIcons[data.deviceType] : '📦';

  return (
    <div
      style={{
        padding: '12px 24px',
        borderRadius: '10px',
        border: '3px solid #2563eb',
        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        minWidth: '140px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#2563eb' }}
      />

      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e3a8a' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '10px', color: '#3b82f6', marginTop: '4px' }}>
        Device
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#2563eb' }}
      />
    </div>
  );
}

export default memo(DeviceNode);
