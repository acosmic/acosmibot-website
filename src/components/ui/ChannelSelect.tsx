import React from 'react';
import { useGuildChannels } from '@/hooks/useGuildChannels';

interface ChannelSelectProps {
  guildId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
}

export const ChannelSelect: React.FC<ChannelSelectProps> = ({
  guildId,
  value,
  onChange,
  label,
  placeholder = 'Select a channel...'
}) => {
  const { data: channels, isLoading } = useGuildChannels(guildId);

  return (
    <div className="form-group mb-3">
      {label && <label className="form-label mb-2 d-block">{label}</label>}
      <select
        className="form-control"
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={isLoading}
      >
        <option value="">{isLoading ? 'Loading channels...' : placeholder}</option>
        {channels?.map((channel) => (
          <option key={channel.id} value={channel.id}>
            #{channel.name}
          </option>
        ))}
      </select>
    </div>
  );
};
