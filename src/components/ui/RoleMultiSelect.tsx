import React from 'react';
import { useGuildRoles } from '@/hooks/useGuildRoles';

interface RoleMultiSelectProps {
  guildId: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  /** Hint shown while no roles are selected */
  placeholder?: string;
}

export const RoleMultiSelect: React.FC<RoleMultiSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'No roles selected — choose from the list below'
}) => {
  const { data: roles, isLoading } = useGuildRoles(guildId);

  const toggleRole = (roleId: string) => {
    if (value.includes(roleId)) {
      onChange(value.filter(id => id !== roleId));
    } else {
      onChange([...value, roleId]);
    }
  };

  return (
    <div className="form-group mb-3">
      {label && <label className="form-label mb-2 d-block">{label}</label>}
      {/* Selected-roles summary — deliberately not styled as an input; selection happens in the list below */}
      <div
        style={{
          minHeight: '38px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 2px'
        }}
      >
        {value.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
            {isLoading ? 'Loading roles...' : placeholder}
          </span>
        )}
        {value.map(id => {
          const role = roles?.find(r => r.id === id);
          return (
            <span 
              key={id} 
              className="badge bg-secondary p-2 d-flex align-items-center gap-2" 
              style={{ borderRadius: '8px' }}
            >
              @{role?.name || id}
              <span 
                style={{ cursor: 'pointer', fontWeight: 'bold' }} 
                onClick={() => toggleRole(id)}
              >
                ×
              </span>
            </span>
          );
        })}
      </div>
      {roles && roles.length > 0 && (
        <div 
          className="mt-2 p-2 rounded" 
          style={{ 
            maxHeight: '200px', 
            overflowY: 'auto', 
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)'
          }}
        >
          {roles.map(role => (
            <div 
              key={role.id} 
              className="p-2 d-flex align-items-center gap-2" 
              style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
              onClick={() => toggleRole(role.id)}
            >
              <input 
                type="checkbox" 
                checked={value.includes(role.id)} 
                readOnly 
              />
              <span style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'inherit' }}>
                @{role.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
