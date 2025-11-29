import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface BaseNodeProps {
  data: {
    label: string;
    icon?: string;
    type?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

function BaseNode({ data, isConnectable }: BaseNodeProps) {
  return (
    <div
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        border: '2px solid #333',
        background: 'white',
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: '#555' }}
      />

      <div style={{ fontSize: '24px', marginBottom: '5px' }}>
        {data.icon || '📦'}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{data.label}</div>
      {data.type && (
        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
          {data.type}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: '#555' }}
      />
    </div>
  );
}

export default memo(BaseNode);
