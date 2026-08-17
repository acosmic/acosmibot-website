import React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldOff } from 'lucide-react';
import { MemoryConstellationPanel } from '@/features/memory/MemoryConstellationPanel';
import { memoryApi } from '@/api/memory';

export const MemoryMemberPage: React.FC = () => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const queryClient = useQueryClient();
  const preference = useQuery({ queryKey: ['memory-participation', guildId], queryFn: () => memoryApi.getParticipation(guildId).then(result => result.data), enabled: Boolean(guildId), retry: false });
  const update = useMutation({ mutationFn: ({ participation, version }: { participation: 'inherit' | 'enabled' | 'paused'; version?: number }) => memoryApi.setParticipation(guildId, participation, version), onSuccess: (result) => { queryClient.setQueryData(['memory-participation', guildId], result.data); } });
  const remove = useMutation({ mutationFn: () => memoryApi.removeParticipation(guildId), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['memory-participation', guildId] }); } });
  const [removeArmed, setRemoveArmed] = React.useState(false);
  const current = preference.data;
  return (
    <div className="feature-page memory-member-page">
      <header className="page-header text-start mt-0 mb-4">
        <p className="text-muted text-uppercase small mb-2">Member constellation</p>
        <h1>Your community memory field</h1>
        <p>Inspect the privacy-scoped nodes available to you. Your personal facts remain in Settings.</p>
      </header>
      <MemoryConstellationPanel mode="member" guildId={guildId} />
      <section className="memory-participation" aria-labelledby="memory-participation-title">
        <div><p className="text-muted text-uppercase small mb-2">About this graph</p><h2 id="memory-participation-title">Choose whether Acosmibot learns community memory about you.</h2><p className="text-muted">Pausing stops new capture. Removing participation also retracts your existing community-memory participation; your personal facts are managed separately in Settings.</p></div>
        {preference.isLoading ? <span role="status">Reading participation setting…</span> : preference.error ? <span role="alert">Participation controls are unavailable right now.</span> : <div className="memory-participation__controls"><label>Participation<select value={current?.participation ?? 'inherit'} onChange={event => update.mutate({ participation: event.target.value as 'inherit' | 'enabled' | 'paused', version: current?.version || undefined })} disabled={update.isPending}><option value="inherit">Use server setting</option><option value="enabled">Allow community memory</option><option value="paused">Pause learning about me</option></select></label><button type="button" className="memory-button memory-button--danger" onClick={() => { if (!removeArmed) { setRemoveArmed(true); return; } remove.mutate(); setRemoveArmed(false); }} disabled={remove.isPending}>{removeArmed ? 'Confirm remove participation' : 'Remove my participation'} <ShieldOff aria-hidden="true" /></button>{update.error && <span role="alert">Could not save this setting. Refresh and try again.</span>}{update.isSuccess && <span className="memory-participation__saved" role="status"><CheckCircle2 aria-hidden="true" /> Saved</span>}</div>}
      </section>
    </div>
  );
};

export default MemoryMemberPage;
