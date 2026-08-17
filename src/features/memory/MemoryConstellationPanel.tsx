import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, LoaderCircle, Orbit, RefreshCw } from 'lucide-react';
import { memoryGraphApi, type MemoryGraphNode } from '@/api/memoryGraph';
import { memoryApi } from '@/api/memory';
import { ConstellationCanvas } from './ConstellationCanvas';
import '@/styles/memory-constellation.css';

type PanelMode = 'public' | 'member' | 'manager' | 'owner';
type PanelView = 'constellation' | 'timeline' | 'review';

interface Props { mode: PanelMode; guildId?: string; compact?: boolean }

const flagForMode: Record<PanelMode, 'member' | 'home' | 'manager' | 'admin'> = { public: 'home', member: 'member', manager: 'manager', owner: 'admin' };

const TimelineList: React.FC<{ nodes: MemoryGraphNode[]; label: string; onSelect?: (node: MemoryGraphNode) => void }> = ({ nodes, label, onSelect }) => {
  const ordered = [...nodes].sort((left, right) => {
    const leftDate = new Date(left.first_seen_at || left.last_reinforced_at || 0).getTime();
    const rightDate = new Date(right.first_seen_at || right.last_reinforced_at || 0).getTime();
    return rightDate - leftDate;
  });
  return <ol className="memory-timeline" aria-label={label}>{ordered.length ? ordered.map(node => {
    const date = node.first_seen_at || node.last_reinforced_at;
    return <li key={node.id}><time dateTime={date}>{date ? new Date(date).toLocaleDateString() : 'Current projection'}</time><button type="button" onClick={() => onSelect?.(node)} disabled={!onSelect}><strong>{node.label || node.type || 'Memory event'}</strong><span>{node.summary || node.status || node.reinforcement_bucket || 'Authorized graph item'}</span></button></li>;
  }) : <li className="memory-timeline__empty">No timeline events are available in this view.</li>}</ol>;
};

const DisabledSurface: React.FC<{ mode: PanelMode }> = ({ mode }) => <div className="memory-constellation__state is-disabled" role="status"><Orbit aria-hidden="true" /><div><strong>{mode === 'public' ? 'The public field is being calibrated.' : 'This constellation is not enabled yet.'}</strong><span>Projection, authorization, and deletion checks must pass before graph data is requested.</span></div></div>;

export const MemoryConstellationPanel: React.FC<Props> = ({ mode, guildId, compact = false }) => {
  const [view, setView] = React.useState<PanelView>(mode === 'manager' ? 'constellation' : 'constellation');
  const [selected, setSelected] = React.useState<MemoryGraphNode | null>(null);
  const [reportedId, setReportedId] = React.useState<string | null>(null);
  const [capturePaused, setCapturePaused] = React.useState(false);
  const [auditInput, setAuditInput] = React.useState('');
  const [auditGuildId, setAuditGuildId] = React.useState('');
  const flags = useQuery({ queryKey: ['memory-rollout-flags'], queryFn: () => memoryGraphApi.flags(), staleTime: 30_000, retry: false });
  const enabled = flags.data?.data?.[flagForMode[mode]] === true;
  const graph = useQuery({
    queryKey: ['memory-graph', mode, guildId, auditGuildId, view],
    queryFn: () => {
      if (mode === 'public') return memoryGraphApi.publicConstellation();
      if (mode === 'owner') return auditGuildId ? memoryGraphApi.ownerGuildConstellation(auditGuildId) : memoryGraphApi.ownerConstellation();
      if (mode === 'manager') {
        if (view === 'timeline') return memoryGraphApi.managerTimeline(guildId!);
        if (view === 'review') return memoryGraphApi.managerReview(guildId!);
        return memoryGraphApi.managerConstellation(guildId!);
      }
      return view === 'timeline' ? memoryGraphApi.memberTimeline(guildId!) : memoryGraphApi.memberConstellation(guildId!);
    },
    enabled: flags.isSuccess && enabled && (mode === 'public' || mode === 'owner' || Boolean(guildId)),
    staleTime: mode === 'public' ? 60_000 : 20_000,
    retry: false,
  });
  const node = useQuery({
    queryKey: ['memory-graph-node', guildId, selected?.id],
    queryFn: () => mode === 'manager' ? memoryGraphApi.managerNode(guildId!, selected!.id) : memoryGraphApi.node(guildId!, selected!.id),
    enabled: flags.isSuccess && enabled && (mode === 'member' || mode === 'manager') && Boolean(guildId && selected?.id),
    retry: false,
  });
  const report = useMutation({ mutationFn: (publicId: string) => memoryApi.reportNode(guildId!, publicId), onSuccess: (_, publicId) => setReportedId(publicId) });
  const retract = useMutation({
    mutationFn: (item: MemoryGraphNode) => item.type === 'episode'
      ? memoryApi.managerDeleteEpisode(guildId!, item.id)
      : memoryApi.managerDeleteFact(guildId!, item.id),
    onSuccess: () => { setSelected(null); void graph.refetch(); },
  });
  const capture = useMutation({ mutationFn: () => capturePaused ? memoryApi.resumeGuildMemory(guildId!) : memoryApi.pauseGuildMemory(guildId!), onSuccess: () => setCapturePaused(value => !value) });
  const data = graph.data;
  const title = mode === 'public' ? 'A living community constellation' : mode === 'manager' ? 'Guild memory review' : mode === 'owner' ? 'Memory operations field' : 'Your community constellation';
  const description = mode === 'public'
    ? 'A privacy-safe view of how Acosmibot connects community systems.'
    : mode === 'manager'
      ? 'Review only community memory. Personal facts and proposal content never enter this surface.'
      : mode === 'owner'
        ? 'Aggregate health signals for operations. Tenant content stays behind its own authorization boundary.'
        : 'Explore the nodes you are allowed to see. Hidden topology is removed before it reaches the browser.';

  const tabs: Array<{ id: PanelView; label: string }> = mode === 'manager'
    ? [{ id: 'constellation', label: 'Graph' }, { id: 'timeline', label: 'Timeline' }, { id: 'review', label: 'Review queue' }]
    : mode === 'member' ? [{ id: 'constellation', label: 'Constellation' }, { id: 'timeline', label: 'Timeline' }] : [];

  return (
    <section className={`memory-constellation${compact ? ' memory-constellation--compact' : ''}`} aria-labelledby={`memory-constellation-title-${mode}`}>
      <header className="memory-constellation__header">
        <div><span className="memory-constellation__kicker"><Orbit aria-hidden="true" /> Privacy-aware field</span><h2 id={`memory-constellation-title-${mode}`}>{title}</h2><p>{description}</p></div>
        <div className="memory-constellation__actions">
          {mode === 'owner' && <form className="memory-constellation__audit" onSubmit={(event) => { event.preventDefault(); setAuditGuildId(auditInput.trim()); }}><label><span className="sr-only">Guild ID for content audit</span><input value={auditInput} onChange={(event) => setAuditInput(event.target.value)} inputMode="numeric" placeholder="Guild ID" /></label><button type="submit" disabled={!auditInput.trim()}>Audit guild</button></form>}
          {tabs.length > 0 && <div className="memory-constellation__tabs" role="tablist" aria-label={`${mode} memory views`}>{tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} className={view === tab.id ? 'is-active' : ''} onClick={() => { setView(tab.id); setSelected(null); }}>{tab.label}</button>)}</div>}
          {mode === 'manager' && <button type="button" className="memory-constellation__capture" onClick={() => capture.mutate()} disabled={!enabled || capture.isPending}>{capturePaused ? 'Resume capture' : 'Pause capture'}</button>}
          <button type="button" className="memory-constellation__refresh" onClick={() => void graph.refetch()} aria-label="Refresh constellation" disabled={!enabled}><RefreshCw aria-hidden="true" /></button>
        </div>
      </header>
      {!flags.isSuccess ? <div className="memory-constellation__state" role="status"><LoaderCircle className="memory-constellation__spin" /> Checking rollout gate…</div> : !enabled ? <DisabledSurface mode={mode} /> : graph.isLoading ? <div className="memory-constellation__state" role="status"><LoaderCircle className="memory-constellation__spin" /> Reading the field…</div> : graph.error || !data ? <div className="memory-constellation__state is-error" role="alert"><AlertCircle aria-hidden="true" /><span>This privacy-scoped field is unavailable right now.</span><button type="button" onClick={() => void graph.refetch()}>Try again</button></div> : (
        <>
          {view === 'constellation' ? <ConstellationCanvas nodes={data.nodes} edges={data.edges} veil={data.veil} onSelect={mode === 'member' || mode === 'manager' || mode === 'owner' ? setSelected : undefined} /> : <TimelineList nodes={data.nodes} label={`${title} timeline`} onSelect={mode === 'manager' || mode === 'member' || mode === 'owner' ? setSelected : undefined} />}
          {mode === 'owner' && <HealthStrip summary={data.summary} />}
          {selected && <aside className="memory-constellation__detail" aria-live="polite"><strong>{selected.label || 'Selected node'}</strong><span>{node.isLoading ? 'Loading permitted detail…' : node.data?.data?.summary || selected.summary || 'No additional detail is available.'}</span><dl><div><dt>Lifecycle</dt><dd>{selected.status || 'active'} · {selected.reinforcement_bucket || 'bucketed reinforcement'}</dd></div><div><dt>Evidence</dt><dd>{selected.evidence_count == null ? 'bucketed' : `${selected.evidence_count} screened items`}</dd></div></dl>{(mode === 'member' || mode === 'manager') && selected.type === 'community_fact' && <>{reportedId === selected.id ? <span><CheckCircle2 aria-hidden="true" /> Report sent.</span> : <button type="button" onClick={() => report.mutate(selected.id)} disabled={report.isPending}>Report a problem</button>}</>}{mode === 'manager' && (selected.type === 'community_fact' || selected.type === 'episode') && <button type="button" className="memory-button memory-button--danger" onClick={() => retract.mutate(selected)} disabled={retract.isPending}>{retract.isPending ? 'Retracting…' : 'Retract community memory'}</button>}{mode === 'owner' && auditGuildId && <span>Content audit is limited to this selected, authorized guild projection.</span>}<button type="button" onClick={() => setSelected(null)}>Close detail</button></aside>}
          <footer className="memory-constellation__footer"><span>{data.nodes.length} visible node{data.nodes.length === 1 ? '' : 's'}</span><span>Scope: {data.scope}</span><span>{data.revision ? `Revision ${data.revision}` : 'Live projection'}</span></footer>
        </>
      )}
    </section>
  );
};

const HealthStrip: React.FC<{ summary?: Record<string, unknown> }> = ({ summary }) => {
  const health = summary?.health_buckets && typeof summary.health_buckets === 'object' ? summary.health_buckets as Record<string, unknown> : {};
  const rows: Array<[string, unknown]> = [['Projection', health.projection], ['Cost', health.cost], ['Deletion', health.deletion], ['Failures', health.failures]];
  return <div className="memory-health-strip" aria-label="Aggregate memory operations health">{rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{String(value || 'not reported').replaceAll('_', ' ')}</strong></div>)}</div>;
};

export const PublicConstellationPanel: React.FC = () => <MemoryConstellationPanel mode="public" compact />;
