import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

interface LogicNodeProps {
  data: {
    label: string;
    logicType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const logicIcons: Record<string, string> = {
  and: '∧',
  or: '∨',
  not: '¬',
  greater_than: '>',
  less_than: '<',
  equal: '=',
  delay: '⏱️',
  if: '❓',
};

const logicColors: Record<string, { bg: string; border: string; text: string }> = {
  and: { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  or: { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  not: { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' },
  greater_than: { bg: '#e0e7ff', border: '#6366f1', text: '#312e81' },
  less_than: { bg: '#e0e7ff', border: '#6366f1', text: '#312e81' },
  equal: { bg: '#e0e7ff', border: '#6366f1', text: '#312e81' },
  delay: { bg: '#ddd6fe', border: '#8b5cf6', text: '#4c1d95' },
  if: { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
};

function LogicNode({ data, isConnectable }: LogicNodeProps) {
  const logicType = data.logicType || 'and';
  const icon = logicIcons[logicType] || '?';
  const colors = logicColors[logicType] || logicColors.and;

  return (
    <div
      style={{
        padding: '12px 20px',
        borderRadius: '10px',
        border: `3px solid ${colors.border}`,
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg} 100%)`,
        minWidth: '120px',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        style={{ background: colors.border }}
      />

      <div style={{ fontSize: '28px', marginBottom: '8px', fontWeight: 'bold' }}>
        {icon}
      </div>
      <div style={{ fontSize: '13px', fontWeight: 'bold', color: colors.text }}>
        {data.label}
      </div>
      <div style={{ fontSize: '10px', color: colors.border, marginTop: '4px' }}>
        Logic
      </div>
      {data.config?.threshold !== undefined && (
        <div style={{ fontSize: '11px', color: colors.text, marginTop: '4px' }}>
          Value: {data.config.threshold}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        style={{ background: colors.border }}
      />
    </div>
  );
}

export default memo(LogicNode);
