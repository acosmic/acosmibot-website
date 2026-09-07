import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Bot, CircleAlert, Expand, Globe2, Pause, Play, TerminalSquare, X } from 'lucide-react';

type Category = 'command' | 'ai' | 'website';
type Outcome = 'running' | 'success' | 'error' | 'blocked' | 'cancelled';

interface LiveEvent {
  activity_id: string;
  revision: number;
  cursor?: string;
  category: Category;
  action: string;
  outcome: Outcome;
  occurred_at: string;
  completed_at?: string | null;
  user_name?: string | null;
  guild_name?: string | null;
  trace_id?: string | null;
  metadata?: Record<string, unknown>;
}

const FILTERS: Array<{ id: Category; label: string; icon: typeof Activity }> = [
  { id: 'command', label: 'Commands', icon: TerminalSquare },
  { id: 'ai', label: 'AI usage', icon: Bot },
  { id: 'website', label: 'Website actions', icon: Globe2 },
];

const apiBase = () => (window as any).AppConfig?.apiBaseUrl ?? 'https://api.acosmibot.com';

function upsert(events: LiveEvent[], incoming: LiveEvent[]) {
  const byId = new Map(events.map((event) => [event.activity_id, event]));
  for (const event of incoming) {
    const current = byId.get(event.activity_id);
    if (!current || event.revision >= current.revision) byId.set(event.activity_id, event);
  }
  return [...byId.values()]
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, 500);
}

function elapsed(event: LiveEvent) {
  const end = event.completed_at ? Date.parse(event.completed_at) : Date.now();
  const ms = Math.max(0, end - Date.parse(event.occurred_at));
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function locationLabel(event: LiveEvent) {
  return event.guild_name || (event.category === 'website' ? 'Website' : 'Direct / global');
}

export const LiveActivityTab: React.FC = () => {
  const [categories, setCategories] = useState<Set<Category>>(() => {
    const stored = localStorage.getItem('admin-live-activity-filters');
    const parsed = stored?.split(',').filter((value): value is Category => FILTERS.some((item) => item.id === value));
    return new Set(parsed?.length ? parsed : FILTERS.map((item) => item.id));
  });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [paused, setPaused] = useState(false);
  const [buffered, setBuffered] = useState<LiveEvent[]>([]);
  const [selected, setSelected] = useState<LiveEvent | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef('$');
  const pausedRef = useRef(false);
  const detailRef = useRef<HTMLElement>(null);

  const categoryParam = useMemo(() => [...categories].sort().join(','), [categories]);

  useEffect(() => {
    localStorage.setItem('admin-live-activity-filters', categoryParam);
    setBuffered([]);
    if (!categoryParam) {
      setEvents([]);
      setConnection('offline');
      return;
    }
    let cancelled = false;
    let source: EventSource | undefined;
    setConnection('connecting');
    setError(null);
    fetch(`${apiBase()}/api/admin/activity?limit=100&categories=${categoryParam}`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Activity history unavailable');
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const initial = body.events as LiveEvent[];
        setEvents(initial);
        setNextCursor(body.next_cursor || null);
        cursorRef.current = initial[0]?.cursor || '$';
        source = new EventSource(
          `${apiBase()}/api/admin/activity/stream?categories=${categoryParam}&cursor=${encodeURIComponent(cursorRef.current)}`,
          { withCredentials: true },
        );
        source.onopen = () => setConnection('live');
        source.onmessage = (message) => {
          const event = JSON.parse(message.data) as LiveEvent;
          cursorRef.current = message.lastEventId || event.cursor || cursorRef.current;
          setBuffered((pending) => pausedRef.current ? upsert(pending, [event]) : pending);
          if (!pausedRef.current) setEvents((current) => upsert(current, [event]));
        };
        source.onerror = () => setConnection('connecting');
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setConnection('offline');
        }
      });
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [categoryParam]);

  const selectedActivityId = selected?.activity_id;

  useEffect(() => {
    if (!selectedActivityId) return;
    const controller = new AbortController();
    fetch(`${apiBase()}/api/admin/activity/${selectedActivityId}`, {
      credentials: 'include', signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (body?.event) setSelected((current) => (
          current?.activity_id === body.event.activity_id ? body.event : current
        ));
      })
      .catch((reason) => {
        if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
          // The streamed snapshot remains useful when its short-lived detail expires.
        }
    });
    return () => controller.abort();
  }, [selectedActivityId]);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key !== 'Tab' || !detailRef.current) return;
      const focusable = [...detailRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
      previousFocus?.focus();
    };
  }, [selected]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  const togglePause = () => {
    if (paused && buffered.length) {
      setEvents((current) => upsert(current, buffered));
      setBuffered([]);
    }
    setPaused((value) => {
      pausedRef.current = !value;
      return !value;
    });
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
    else setFullscreen((value) => !value);
  };

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(`${apiBase()}/api/admin/activity?limit=100&categories=${categoryParam}&before=${encodeURIComponent(nextCursor)}`, { credentials: 'include' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Older activity unavailable');
      setEvents((current) => upsert(current, body.events));
      setNextCursor(body.next_cursor || null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoadingOlder(false);
    }
  };

  return (
    <div ref={shellRef} className={`live-activity${fullscreen ? ' is-fullscreen' : ''}`}>
      <div className="live-activity__topline">
        <div className={`live-activity__connection is-${connection}`} role="status">
          <i /> <span>{connection === 'live' ? 'Live across Acosmibot' : connection === 'offline' ? 'Feed unavailable' : 'Connecting…'}</span>
        </div>
        <div className="live-activity__actions">
          <button type="button" onClick={togglePause} aria-pressed={paused}>
            {paused ? <Play /> : <Pause />} {paused ? `Resume${buffered.length ? ` · ${buffered.length} new` : ''}` : 'Pause'}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            <Expand /> {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className="live-activity__filters" role="group" aria-label="Activity categories">
        {FILTERS.map(({ id, label, icon: Icon }) => {
          const active = categories.has(id);
          return <button key={id} type="button" className={active ? 'is-active' : ''} aria-pressed={active} onClick={() => {
            setCategories((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}><span><i /> <Icon /></span>{label}</button>;
        })}
      </div>

      <div className="live-activity__feed" aria-live="polite" aria-busy={connection === 'connecting'}>
        {error ? <div className="live-activity__empty is-error"><CircleAlert /><strong>Activity feed unavailable</strong><span>{error}</span></div>
          : events.length === 0 ? <div className="live-activity__empty"><Activity /><strong>Listening for activity</strong><span>New commands, AI routes, and website actions will arrive here.</span></div>
          : <>{events.map((event) => (
            <button className={`live-event is-${event.outcome}`} type="button" key={event.activity_id} onClick={() => setSelected(event)}>
              <span className="live-event__pulse" aria-hidden="true" />
              <span className="live-event__identity"><strong>{locationLabel(event)}</strong><span>{event.user_name || 'Acosmibot system'}</span></span>
              <span className="live-event__action"><strong>{event.action}</strong><span>{event.outcome === 'running' ? 'In progress' : event.outcome}</span></span>
              <span className="live-event__time"><time dateTime={event.occurred_at}>{new Date(event.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span>{elapsed(event)}</span></span>
            </button>
          ))}{nextCursor && events.length < 500 && <button type="button" className="live-activity__older" onClick={() => void loadOlder()} disabled={loadingOlder}>{loadingOlder ? 'Loading history…' : 'Load older activity'}</button>}</>}
      </div>

      {selected && <div className="live-detail__backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
        <aside ref={detailRef} className="live-detail" role="dialog" aria-modal="true" aria-labelledby="live-detail-title">
          <header><div><span>Activity log</span><h3 id="live-detail-title">{selected.action}</h3></div><button autoFocus type="button" onClick={() => setSelected(null)} aria-label="Close activity log"><X /></button></header>
          <div className="live-detail__status"><i className={`is-${selected.outcome}`} /><strong>{selected.outcome}</strong><span>{new Date(selected.occurred_at).toLocaleString()}</span></div>
          <dl>
            <div><dt>Location</dt><dd>{locationLabel(selected)}</dd></div>
            <div><dt>User</dt><dd>{selected.user_name || 'Acosmibot system'}</dd></div>
            <div><dt>Duration</dt><dd>{elapsed(selected)}</dd></div>
            <div><dt>Category</dt><dd>{selected.category}</dd></div>
            {typeof selected.metadata?.error_code === 'string' && <div><dt>Error reason</dt><dd><code>{selected.metadata.error_code}</code></dd></div>}
            {selected.trace_id && <div><dt>AI trace</dt><dd><code>{selected.trace_id}</code></dd></div>}
          </dl>
          <section><span>Safe metadata</span><pre>{JSON.stringify(selected.metadata || {}, null, 2)}</pre></section>
          <footer>Activity ID <code>{selected.activity_id}</code></footer>
        </aside>
      </div>}
    </div>
  );
};
