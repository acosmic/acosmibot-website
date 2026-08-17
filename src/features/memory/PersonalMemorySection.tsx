import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Check, Download, Eye, EyeOff, History, LockKeyhole, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react';
import { memoryApi, type MemoryClearPreview, type UserFact } from '@/api/memory';
import { showToast } from '@/utils/toast';
import { usePersonalMemory } from './usePersonalMemory';
import '@/styles/memory.css';

const CLEAR_PHRASE = 'CLEAR MY MEMORY';
const DELETE_PHRASE = 'DELETE THIS FACT';

type Draft = {
  namespace: string;
  fact_key: string;
  value: string;
  display_text: string;
  visibility: 'private' | 'shared_guilds';
  character: string;
  realm: string;
  region: string;
};

const blankDraft = (): Draft => ({ namespace: 'about', fact_key: 'about', value: '', display_text: '', visibility: 'private', character: '', realm: '', region: 'us' });
const factValue = (fact: UserFact) => typeof fact.value === 'string' ? fact.value : fact.display_text;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Memory action failed';
const keysFor = (namespace: string) => ({ wow: ['main', 'alts'], gaming: ['platform', 'gamertag', 'mains'], streaming: ['twitch', 'kick', 'youtube'], music: ['favorite_artist', 'favorite_genre'], identity: ['pronouns', 'timezone', 'name_preference'] }[namespace] ?? []);

export const PersonalMemorySection: React.FC = () => {
  const memory = usePersonalMemory();
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editing, setEditing] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, Awaited<ReturnType<typeof memoryApi.history>>['data']>>({});
  const [clearPreview, setClearPreview] = useState<MemoryClearPreview | null>(null);
  const [clearInput, setClearInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<UserFact | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [proposalVisibility, setProposalVisibility] = useState<Record<string, 'private' | 'shared_guilds'>>({});
  const [deletionOperation, setDeletionOperation] = useState<string | null>(null);
  const [deletionStatus, setDeletionStatus] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!clearPreview && !deleteTarget) return;
    returnFocusRef.current = document.activeElement as HTMLElement;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>('button, input')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setClearPreview(null); setDeleteTarget(null); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button, input')].filter((item) => !item.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); returnFocusRef.current?.focus(); };
  }, [clearPreview, deleteTarget]);

  useEffect(() => {
    if (!deletionOperation) return;
    let active = true;
    const poll = async () => { try { const result = await memoryApi.deletionStatus(deletionOperation); if (active) setDeletionStatus(String(result.data.status ?? 'processing')); } catch { if (active) setDeletionStatus('processing'); } };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [deletionOperation]);

  const grouped = useMemo(() => {
    const groups = new Map<string, UserFact[]>();
    for (const fact of memory.facts.data ?? []) groups.set(fact.namespace, [...(groups.get(fact.namespace) ?? []), fact]);
    return [...groups.entries()];
  }, [memory.facts.data]);

  const beginEdit = (fact: UserFact) => {
    setEditing(fact.public_id);
    setEditingVersion(fact.version);
    const value = fact.value && typeof fact.value === 'object' ? fact.value as Record<string, unknown> : {};
    setDraft({ namespace: fact.namespace, fact_key: fact.fact_key, value: factValue(fact), display_text: fact.display_text, visibility: fact.visibility, character: String(value.character ?? ''), realm: String(value.realm ?? ''), region: String(value.region ?? 'us') });
  };

  const save = () => {
    if ((!draft.value.trim() && !(draft.namespace === 'wow' && draft.fact_key === 'main')) || (draft.namespace === 'wow' && draft.fact_key === 'main' && (!draft.character.trim() || !draft.realm.trim()))) return;
    let value: unknown = draft.value.trim();
    if (draft.namespace === 'wow' && draft.fact_key === 'main') value = { character: draft.character.trim(), realm: draft.realm.trim(), region: draft.region.trim().toLowerCase() };
    if (draft.namespace === 'wow' && draft.fact_key === 'alts') value = draft.value.split(',').map((item) => item.trim()).filter(Boolean);
    const payload = { namespace: draft.namespace, fact_key: draft.fact_key, value, visibility: draft.visibility, ...(editing && editingVersion != null ? { expected_version: editingVersion } : {}) };
    setConflict(false);
    const onError = (error: unknown) => {
      const message = errorMessage(error);
      if (/changed|another tab|refresh|generation|disabled/i.test(message)) setConflict(true);
      showToast(message, 'error');
    };
    if (editing) {
      memory.update.mutate({ publicId: editing, payload }, { onSuccess: () => { setEditing(null); setEditingVersion(null); setDraft(blankDraft()); showToast('Memory updated', 'success'); }, onError });
    } else {
      memory.create.mutate(payload, { onSuccess: () => { setEditingVersion(null); setDraft(blankDraft()); showToast('Memory saved', 'success'); }, onError });
    }
  };

  const loadHistory = async (publicId: string) => {
    if (expanded === publicId) { setExpanded(null); return; }
    setExpanded(publicId);
    if (history[publicId]) return;
    try {
      const result = await memoryApi.history(publicId);
      setHistory((current) => ({ ...current, [publicId]: result.data }));
    } catch (error) { showToast(errorMessage(error), 'error'); }
  };

  const exportMemory = async () => {
    try {
      const result = await memoryApi.exportMemory();
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'acosmibot-memory-export.json'; anchor.click(); URL.revokeObjectURL(url);
      showToast('Memory export downloaded', 'success');
    } catch (error) { showToast(errorMessage(error), 'error'); }
  };

  const requestClear = () => {
    memory.clearPreview.mutate(undefined, { onSuccess: (result) => { setClearPreview(result.data); setClearInput(''); }, onError: (error) => showToast(errorMessage(error), 'error') });
  };

  const confirmClear = () => {
    if (!clearPreview || clearInput.trim() !== CLEAR_PHRASE) return;
    memory.clear.mutate({ confirmation_token: typeof clearPreview.confirmation_token === 'string' ? clearPreview.confirmation_token : undefined, confirmation: clearInput }, {
      onSuccess: (result) => { setClearPreview(null); setClearInput(''); setDeletionOperation(typeof result.data.operation_id === 'string' ? result.data.operation_id : null); setDeletionStatus('processing'); showToast('Your memory is cleared from reads immediately', 'success'); },
      onError: (error) => showToast(errorMessage(error), 'error'),
    });
  };

  if (memory.facts.isLoading || memory.proposals.isLoading) return <section className="personal-memory" aria-busy="true"><div className="personal-memory__loading">Loading your memory controls…</div></section>;
  if (memory.facts.isError) return <section className="personal-memory"><div className="personal-memory__error" role="alert"><ShieldAlert aria-hidden="true" /><div><strong>Personal memory is unavailable.</strong><p>{errorMessage(memory.facts.error)}. Your existing data has not been changed.</p><button type="button" className="memory-button memory-button--quiet" onClick={() => void memory.facts.refetch()}>Retry</button></div></div></section>;

  const confirmDelete = () => {
    if (!deleteTarget || deleteInput.trim() !== DELETE_PHRASE) return;
    memory.remove.mutate({ publicId: deleteTarget.public_id, confirmation: deleteInput.trim() }, { onSuccess: () => { setDeleteTarget(null); setDeleteInput(''); showToast('Memory deleted', 'success'); }, onError: (error) => showToast(errorMessage(error), 'error') });
  };

  return <section className="personal-memory" aria-labelledby="personal-memory-title">
    <header className="personal-memory__header">
      <div><p className="member-kicker">Portable memory</p><h2 id="personal-memory-title">Your facts, your reach.</h2><p>Only you can change these facts. Private stays with you; shared-guild facts can help Acosmibot in servers you currently share. Where a fact was learned is never shown.</p></div>
      <div className="personal-memory__header-actions"><button type="button" className="memory-button memory-button--quiet" onClick={() => void exportMemory()}><Download aria-hidden="true" /> Export</button><button type="button" className="memory-button memory-button--danger" onClick={requestClear} disabled={memory.clearPreview.isPending}><Trash2 aria-hidden="true" /> Clear everything</button></div>
    </header>

    {memory.proposals.data?.filter((proposal) => proposal.status === 'pending').map((proposal) => <div className="personal-memory__proposal" key={proposal.public_id}><div><p className="member-kicker">Acosmibot noticed a possibility</p><strong>{proposal.display_text}</strong><span>Nothing is saved globally until you approve it.</span><label className="proposal-visibility">Who can use it?<select value={proposalVisibility[proposal.public_id] ?? 'private'} onChange={(event) => setProposalVisibility({ ...proposalVisibility, [proposal.public_id]: event.target.value as 'private' | 'shared_guilds' })}><option value="private">Only me</option><option value="shared_guilds">Servers I currently share</option></select></label></div><div><button type="button" className="memory-button" onClick={() => memory.accept.mutate({ publicId: proposal.public_id, visibility: proposalVisibility[proposal.public_id] ?? 'private' })} disabled={memory.accept.isPending}><Check aria-hidden="true" /> Save fact</button><button type="button" className="memory-button memory-button--quiet" onClick={() => memory.reject.mutate(proposal.public_id)} disabled={memory.reject.isPending}><X aria-hidden="true" /> Not now</button></div></div>)}

    <div className="personal-memory__workspace">
      {conflict && <div className="personal-memory__conflict" role="alert"><ShieldAlert aria-hidden="true" /><span><strong>This memory changed in another tab.</strong> Refresh the list before saving again; your unsaved value was not applied.</span><button type="button" className="memory-button memory-button--quiet" onClick={() => { setConflict(false); void memory.facts.refetch(); }}>Refresh facts</button></div>}
      <div className="personal-memory__facts">
        <div className="personal-memory__section-heading"><div><p className="member-kicker">Declared by you</p><h3>Known facts</h3></div><span>{memory.facts.data?.length ?? 0} saved</span></div>
        {grouped.length === 0 ? <div className="personal-memory__empty"><Archive aria-hidden="true" /><strong>Nothing saved yet.</strong><span>Add one fact below when you want Acosmibot to carry it with you.</span></div> : grouped.map(([namespace, facts]) => <section className="personal-memory__group" key={namespace} aria-labelledby={`memory-group-${namespace}`}><h4 id={`memory-group-${namespace}`}>{namespace}</h4>{facts.map((fact) => <article className="personal-memory__fact" key={fact.public_id}><div className="personal-memory__fact-main"><span className="personal-memory__fact-key">{fact.fact_key}</span><strong>{fact.display_text}</strong><span className="personal-memory__fact-meta">{fact.visibility === 'private' ? <><LockKeyhole aria-hidden="true" /> Only you</> : <><Eye aria-hidden="true" /> Servers you currently share</>} · {fact.source.replace('_', ' ')}</span></div><div className="personal-memory__fact-actions"><button type="button" className="icon-button" onClick={() => beginEdit(fact)} aria-label={`Edit ${fact.fact_key}`}><Pencil aria-hidden="true" /></button><button type="button" className="icon-button" onClick={() => void loadHistory(fact.public_id)} aria-expanded={expanded === fact.public_id} aria-label={`Show history for ${fact.fact_key}`}><History aria-hidden="true" /></button><button type="button" className="icon-button icon-button--danger" onClick={() => { setDeleteTarget(fact); setDeleteInput(''); }} aria-label={`Delete ${fact.fact_key}`}><Trash2 aria-hidden="true" /></button></div>{expanded === fact.public_id && <div className="personal-memory__history"><strong>Prior versions</strong>{(history[fact.public_id] ?? []).length ? history[fact.public_id].map((version) => <div key={version.version}><span>Version {version.version} · {version.display_text}</span><button type="button" className="memory-button memory-button--quiet" onClick={() => memory.restore.mutate({ publicId: fact.public_id, version: version.version }, { onSuccess: () => showToast('Prior version restored', 'success') })}>Restore</button></div>) : <span>No prior versions retained.</span>}</div>}</article>)}</section>)}</div>

      <form className="personal-memory__editor" onSubmit={(event) => { event.preventDefault(); save(); }} aria-labelledby="memory-editor-title"><div className="personal-memory__section-heading"><div><p className="member-kicker">Owner write surface</p><h3 id="memory-editor-title">{editing ? 'Update a fact' : 'Add a fact'}</h3></div>{editing && <button type="button" className="icon-button" onClick={() => { setEditing(null); setDraft(blankDraft()); }} aria-label="Cancel editing"><X aria-hidden="true" /></button>}</div><label>Namespace<select value={draft.namespace} onChange={(event) => { const namespace = event.target.value; setDraft({ ...draft, namespace, fact_key: namespace === 'about' ? 'about' : keysFor(namespace)[0] ?? '' }); }}><option value="about">About</option><option value="wow">WoW</option><option value="gaming">Gaming</option><option value="streaming">Streaming</option><option value="music">Music</option><option value="identity">Identity</option></select></label><label>Fact key{draft.namespace === 'about' ? <input value={draft.fact_key} onChange={(event) => setDraft({ ...draft, fact_key: event.target.value })} maxLength={64} required /> : <select value={draft.fact_key} onChange={(event) => setDraft({ ...draft, fact_key: event.target.value })}>{keysFor(draft.namespace).map((key) => <option value={key} key={key}>{key.replaceAll('_', ' ')}</option>)}</select>}</label>{draft.namespace === 'wow' && draft.fact_key === 'main' ? <div className="structured-fact-fields"><label>Character<input value={draft.character} onChange={(event) => setDraft({ ...draft, character: event.target.value })} maxLength={64} required /></label><label>Realm<input value={draft.realm} onChange={(event) => setDraft({ ...draft, realm: event.target.value })} maxLength={64} required /></label><label>Region<select value={draft.region} onChange={(event) => setDraft({ ...draft, region: event.target.value })}><option value="us">US</option><option value="eu">EU</option><option value="kr">KR</option><option value="tw">TW</option></select></label></div> : <label>What should Acosmibot remember?<textarea value={draft.value} onChange={(event) => setDraft({ ...draft, value: event.target.value })} maxLength={1000} rows={4} required /></label>}<label>Who can use it?<select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as Draft['visibility'] })}><option value="private">Only me</option><option value="shared_guilds">Servers I currently share</option></select></label><p className="personal-memory__editor-note"><EyeOff aria-hidden="true" /> The API renders the display text and enforces this scope.</p><button type="submit" className="memory-button memory-button--primary" disabled={memory.create.isPending || memory.update.isPending}><Plus aria-hidden="true" /> {editing ? 'Update fact' : 'Save fact'}</button></form>
    </div>

    {deletionStatus && <p className="personal-memory__status" role="status">Global clear: {deletionStatus === 'complete' ? 'physical cleanup complete.' : 'your facts are hidden; physical cleanup is still processing.'}</p>}
    {(clearPreview || deleteTarget) && <div className="memory-dialog-backdrop" role="presentation"><section ref={dialogRef} className="memory-dialog" role="dialog" aria-modal="true" aria-labelledby="memory-dialog-title">{deleteTarget ? <><h3 id="memory-dialog-title">Delete this fact?</h3><p>This permanently removes <strong>{deleteTarget.display_text}</strong> and its retained history everywhere. There is no undo.</p><label>Type <strong>{DELETE_PHRASE}</strong> to continue<input value={deleteInput} onChange={(event) => setDeleteInput(event.target.value)} /></label><div className="memory-dialog__actions"><button type="button" className="memory-button memory-button--quiet" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="memory-button memory-button--danger" disabled={deleteInput.trim() !== DELETE_PHRASE || memory.remove.isPending} onClick={confirmDelete}>Delete fact</button></div></> : <><h3 id="memory-dialog-title">Clear your portable memory?</h3><p>This is irreversible. It removes your personal facts, history, and pending proposals everywhere. Community memory cleanup may finish afterward, but your deleted facts are hidden immediately.</p><dl><div><dt>Facts</dt><dd>{clearPreview?.fact_count ?? '—'}</dd></div><div><dt>History</dt><dd>{clearPreview?.history_count ?? '—'}</dd></div><div><dt>Proposals</dt><dd>{clearPreview?.proposal_count ?? '—'}</dd></div></dl><label>Type <strong>{CLEAR_PHRASE}</strong> to continue<input value={clearInput} onChange={(event) => setClearInput(event.target.value)} /></label><div className="memory-dialog__actions"><button type="button" className="memory-button memory-button--quiet" onClick={() => setClearPreview(null)}>Cancel</button><button type="button" className="memory-button memory-button--danger" disabled={clearInput.trim() !== CLEAR_PHRASE || memory.clear.isPending} onClick={confirmClear}>{memory.clear.isPending ? 'Clearing…' : 'Delete everything'}</button></div></>}</section></div>}
  </section>;
};
