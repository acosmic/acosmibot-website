import React from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import { CollapsibleSection } from '@/components/ui';
import {
  MemoryChannel,
  excludePrivateChannels,
  privateChannelsStillLearning,
  toggleMemoryChannel,
} from './memoryChannels';

interface AiMemoryChannelsSectionProps {
  channels: MemoryChannel[];
  excluded: string[];
  onChange: (excluded: string[]) => void;
}

const MAX_NAMED_CHANNELS = 3;

const channelList = (channels: MemoryChannel[]) => {
  const names = channels.slice(0, MAX_NAMED_CHANNELS).map(channel => `#${channel.name}`);
  const remaining = channels.length - names.length;
  return remaining > 0 ? `${names.join(', ')} and ${remaining} more` : names.join(', ');
};

export const AiMemoryChannelsSection: React.FC<AiMemoryChannelsSectionProps> = ({
  channels,
  excluded,
  onChange,
}) => {
  const stillLearning = privateChannelsStillLearning(channels, excluded);

  return (
    <>
      {stillLearning.length > 0 && (
        <div className="dashboard-inline-alert ai-memory-channels__suggestion" role="status">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>
              {stillLearning.length === 1
                ? '1 private channel is still learning memories'
                : `${stillLearning.length} private channels are still learning memories`}
            </strong>
            <p>
              Memories learned in {channelList(stillLearning)} can come up in any channel,
              including ones where members can't see the original conversation. We suggest
              turning memory off in private channels.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onChange(excludePrivateChannels(channels, excluded))}
            >
              Stop learning in private channels
            </button>
          </div>
        </div>
      )}

      <CollapsibleSection title="Memory Channels" defaultOpen={false}>
        <p className="text-muted small mb-3">
          The AI learns from conversations in every channel and can recall those memories
          anywhere in this server. Select channels where it should <strong>not</strong> learn
          new memories. Existing memories are kept until a member or manager clears them.
        </p>
        <div className="ai-memory-channels__list">
          {channels.map(channel => (
            <label key={channel.id} className="ai-memory-channels__row">
              <input
                type="checkbox"
                checked={excluded.includes(channel.id)}
                onChange={() => onChange(toggleMemoryChannel(excluded, channel.id))}
              />
              <span className="ai-memory-channels__name"># {channel.name}</span>
              {channel.is_private && (
                <span className="ai-memory-channels__badge">
                  <Lock size={12} aria-hidden="true" />
                  Private
                </span>
              )}
            </label>
          ))}
          {channels.length === 0 && (
            <p className="text-muted small p-2 mb-0">No channels available.</p>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
};
