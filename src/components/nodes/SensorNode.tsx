import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface SensorNodeProps {
  data: {
    label: string;
    sensorType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const sensorIcons: Record<string, string> = {
  level: '📊',
  temperature: '🌡️',
  pressure: '🔩',
  flow_rate: '💧',
};

function SensorNode({ data, isConnectable }: SensorNodeProps) {
  const icon = data.sensorType ? sensorIcons[data.sensorType] : '📡';

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

      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#064e3b' }}>
        {data.label}
      </div>
      <div style={{ fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
        Sensor
      </div>
      {data.config?.threshold !== undefined && (
        <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px' }}>
          Threshold: {data.config.threshold}
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
