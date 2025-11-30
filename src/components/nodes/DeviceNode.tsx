import { memo, useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import WaterIcon from '@mui/icons-material/Water';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import BoltIcon from '@mui/icons-material/Bolt';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import InventoryIcon from '@mui/icons-material/Inventory';

interface DeviceNodeProps {
  id: string;
  data: {
    label: string;
    deviceType?: string;
    config?: Record<string, any>;
  };
  isConnectable: boolean;
}

const deviceIcons: Record<string, React.ReactElement> = {
  tank: <WaterIcon />,
  pump: <SettingsIcon />,
  valve: <TuneIcon />,
  electrolyzer: <BoltIcon />,
  heat_exchanger: <LocalFireDepartmentIcon />,
};

function DeviceNode({ id, data, isConnectable }: DeviceNodeProps) {
  const icon = data.deviceType ? deviceIcons[data.deviceType] : <InventoryIcon />;
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

      <div style={{ marginBottom: '8px', color: '#2563eb' }}>{icon}</div>
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
            color: '#1e3a8a',
            background: 'white',
            border: '1px solid #2563eb',
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
            color: '#1e3a8a',
            cursor: 'text',
          }}
          onDoubleClick={handleDoubleClick}
          title="Double-click to edit"
        >
          {data.label}
        </div>
      )}
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
