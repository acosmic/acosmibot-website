import React from 'react';
import { useGuildRoles } from '@/hooks/useGuildRoles';

interface RoleSelectProps {
  guildId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
}

export const RoleSelect: React.FC<RoleSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'Select a role...'
}) => {
  const { data: roles, isLoading } = useGuildRoles(guildId);

  return (
    <div className="form-group mb-3">
      {label && <label className="form-label mb-2 d-block">{label}</label>}
      <select
        className="form-control"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Loading roles...' : placeholder}</option>
        {roles?.map((role) => (
          <option key={role.id} value={role.id}>
            @{role.name}
          </option>
        ))}
      </select>
    </div>
  );
};
