import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

interface LogicNodeProps {
  id: string;
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

function LogicNode({ id, data, isConnectable }: LogicNodeProps) {
  const logicType = data.logicType || 'and';
  const icon = logicIcons[logicType] || '?';
  const colors = logicColors[logicType] || logicColors.and;
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [value, setValue] = useState(data.config?.threshold?.toString() || data.config?.delayMs?.toString() || '');
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

  const handleValueDoubleClick = () => {
    setIsEditingValue(true);
  };

  const handleValueBlur = () => {
    setIsEditingValue(false);
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      if (logicType === 'delay') {
        updateNodeData(id, { config: { ...data.config, delayMs: numValue } });
      } else if (['greater_than', 'less_than', 'equal'].includes(logicType)) {
        updateNodeData(id, { config: { ...data.config, threshold: numValue } });
      }
    }
  };

  const handleValueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditingValue(false);
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        if (logicType === 'delay') {
          updateNodeData(id, { config: { ...data.config, delayMs: numValue } });
        } else if (['greater_than', 'less_than', 'equal'].includes(logicType)) {
          updateNodeData(id, { config: { ...data.config, threshold: numValue } });
        }
      }
    }
  };

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
            color: colors.text,
            background: 'white',
            border: `1px solid ${colors.border}`,
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
            color: colors.text,
            cursor: 'text',
          }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          {data.label}
        </div>
      )}
      <div style={{ fontSize: '10px', color: colors.border, marginTop: '4px' }}>
        Logic
      </div>

      {/* Editable threshold for comparison operators */}
      {data.config?.threshold !== undefined && (
        <div style={{ fontSize: '11px', color: colors.text, marginTop: '4px' }}>
          {isEditingValue ? (
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleValueBlur}
              onKeyDown={handleValueKeyDown}
              autoFocus
              style={{
                fontSize: '11px',
                color: colors.text,
                background: 'white',
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                padding: '2px 4px',
                textAlign: 'center',
                width: '60px',
              }}
            />
          ) : (
            <span
              onDoubleClick={handleValueDoubleClick}
              style={{ cursor: 'pointer' }}
              title="Double-click to edit value"
            >
              Value: {data.config.threshold}
            </span>
          )}
        </div>
      )}

      {/* Editable delay time */}
      {data.config?.delayMs !== undefined && (
        <div style={{ fontSize: '11px', color: colors.text, marginTop: '4px' }}>
          {isEditingValue ? (
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleValueBlur}
              onKeyDown={handleValueKeyDown}
              autoFocus
              style={{
                fontSize: '11px',
                color: colors.text,
                background: 'white',
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                padding: '2px 4px',
                textAlign: 'center',
                width: '60px',
              }}
            />
          ) : (
            <span
              onDoubleClick={handleValueDoubleClick}
              style={{ cursor: 'pointer' }}
              title="Double-click to edit delay"
            >
              Delay: {data.config.delayMs}ms
            </span>
          )}
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
