import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CircleAlert,
  Copy,
  Download,
  LockKeyhole,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Smile,
  Trash2,
  Upload,
} from 'lucide-react';
import type { EmojiPack, EmojiPackJob, EmojiPacksOverview, LiveEmoji, NewPackSource } from '@/api/emojiPacks';
import { emojiPacksApi } from '@/api/emojiPacks';
import { ServerImagesError } from '@/api/serverImages';
import { LoadingSpinner } from '@/components/ui';
import { SevenTvBrowser } from './SevenTvBrowser';
import { useEmojiPacks } from './useEmojiPacks';
import './EmojiPacksPanel.css';

const PREVIEW_COUNT = 14;
const TIER_NAMES: Record<string, string> = { free: 'Free', plus: 'Plus', pro: 'Pro', max: 'Max' };
const JOB_VERBS: Record<EmojiPackJob['kind'], string> = {
  snapshot: 'Saving your current emoji',
  capture: 'Saving live emoji into the pack',
  apply: 'Applying pack',
};

type Status = { tone: 'ok' | 'error'; text: string } | null;

export const EmojiPacksPanel: React.FC = () => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const packs = useEmojiPacks(guildId);
  const { query } = packs;
  const [status, setStatus] = useState<Status>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ packId: number; action: 'apply' | 'delete' } | null>(null);

  if (query.isLoading) return <LoadingSpinner />;
  if (query.error || !query.data) {
    return (
      <div className="server-images-state" role="alert">
        <CircleAlert aria-hidden="true" />
        <h2>Emoji packs could not load</h2>
        <p>{query.error instanceof Error ? query.error.message : 'Emoji packs are unavailable right now.'}</p>
        <button type="button" className="btn primary" onClick={() => void query.refetch()}>Try again</button>
      </div>
    );
  }

  const data = query.data;
  const job = data.job;
  const working = job?.status === 'queued' || job?.status === 'running';
  const readOnly = data.locked;

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setStatus(null);
    try {
      await action();
      if (success) setStatus({ tone: 'ok', text: success });
    } catch (caught) {
      setStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'Something went wrong.' });
    } finally {
      setConfirm(null);
    }
  };

  if (!data.enabled) {
    return readOnly
      ? <UpsellCard guildId={guildId} />
      : <EnableCard data={data} busy={packs.enable.isPending} onEnable={() => void run(() => packs.enable.mutateAsync())} status={status} />;
  }

  const selected = data.packs.find((pack) => pack.id === selectedId) ?? null;
  const livePack = data.packs.find((pack) => pack.live) ?? null;
  const atLimit = data.custom_pack_count >= data.pack_limit;

  return (
    <div className="emoji-packs">
      {readOnly && (
        <p className="server-images-status server-images-status--error" role="status">
          This server is on the Free plan, so emoji packs are read-only. You can still download every pack.{' '}
          <Link to={`/pricing?guild=${guildId}`}>Upgrade to Plus</Link> to apply or edit them.
        </p>
      )}
      {job && <JobBanner job={job} packs={data.packs} />}
      {!working && !readOnly && !data.packs.some((pack) => pack.kind === 'original') && (
        <div className="server-images-confirm">
          <span>Your current emoji haven't been backed up yet.</span>
          <button type="button" className="btn primary" disabled={packs.enable.isPending}
            onClick={() => void run(() => packs.enable.mutateAsync(), 'Saving your current emoji…')}>
            Save my current emoji
          </button>
        </div>
      )}
      {status && (
        <p className={`server-images-status server-images-status--${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}

      <LiveCard
        data={data}
        livePack={livePack}
        busy={readOnly || packs.setKeep.isPending}
        onToggleKeep={(emoji) => {
          const kept = new Set(data.live.emojis.filter((item) => item.kept).map((item) => item.id));
          if (kept.has(emoji.id)) kept.delete(emoji.id); else kept.add(emoji.id);
          void run(() => packs.setKeep.mutateAsync([...kept]), emoji.kept ? `:${emoji.name}: can be swapped again.` : `:${emoji.name}: will always stay.`);
        }}
      />

      <section aria-labelledby="emoji-packs-title">
        <div className="server-images-library__head">
          <h2 id="emoji-packs-title"><Smile aria-hidden="true" /> Packs</h2>
          <span>
            {data.custom_pack_count} of {data.pack_limit} used on {TIER_NAMES[data.tier] ?? data.tier}. The Original backup is free.
          </span>
        </div>

        {!readOnly && (
          <NewPackForm
            packs={data.packs}
            disabled={atLimit || working || packs.createPack.isPending}
            atLimit={atLimit}
            guildId={guildId}
            onCreate={(input) => void run(async () => {
              const result = await packs.createPack.mutateAsync(input);
              setSelectedId(result.pack.id);
            }, input.source === 'live' ? 'Pack created. Saving the live emoji into it…' : 'Pack created.')}
          />
        )}

        <ul className="emoji-packs-grid">
          {data.packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              guildId={guildId}
              selected={pack.id === selectedId}
              confirming={confirm?.packId === pack.id ? confirm.action : null}
              busy={readOnly || working || packs.apply.isPending || packs.deletePack.isPending}
              liveLimit={data.live.limit}
              onSelect={() => setSelectedId(pack.id === selectedId ? null : pack.id)}
              onConfirm={(action) => setConfirm({ packId: pack.id, action })}
              onCancel={() => setConfirm(null)}
              onApply={() => void run(() => packs.apply.mutateAsync(pack.id), `Applying ${pack.name}. You can leave this page.`)}
              onDelete={() => void run(async () => {
                await packs.deletePack.mutateAsync(pack.id);
                if (selectedId === pack.id) setSelectedId(null);
              }, 'Pack deleted.')}
            />
          ))}
          {atLimit && data.tier !== 'max' && !readOnly && (
            <li className="emoji-pack-card emoji-pack-card--upsell">
              <LockKeyhole aria-hidden="true" />
              <strong>Need more packs?</strong>
              <span>Pro includes 5 packs and Max includes 10.</span>
              <Link to={`/pricing?guild=${guildId}`} className="btn secondary">Compare plans <ArrowRight aria-hidden="true" /></Link>
            </li>
          )}
        </ul>
      </section>

      {data.seventv && !readOnly && (
        <SevenTvBrowser
          guildId={guildId}
          packs={data.packs}
          preferredPackId={selectedId}
          working={working}
          hooks={packs}
          onStatus={setStatus}
          canCreatePack={!atLimit}
          onCreatePack={async (name) => {
            const result = await packs.createPack.mutateAsync({ name, source: 'empty' });
            setSelectedId(result.pack.id);
            return result.pack.id;
          }}
        />
      )}

      {selected && (
        <PackEditor
          key={selected.id}
          pack={selected}
          limit={data.live.limit}
          readOnly={readOnly || !selected.usable || selected.kind === 'original'}
          working={working}
          hooks={packs}
          onStatus={setStatus}
        />
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ states */

const UpsellCard: React.FC<{ guildId: string }> = ({ guildId }) => (
  <section className="server-images-lock" aria-labelledby="emoji-packs-lock-title">
    <div className="server-images-lock__signal" aria-hidden="true"><LockKeyhole /></div>
    <div>
      <span className="server-images-kicker">Plus feature</span>
      <h2 id="emoji-packs-lock-title">Swap whole sets of server emoji in one click.</h2>
      <p>
        Save your emoji as packs, such as a Halloween set and a Winter set, and switch between them. Plus includes
        3 packs, Pro 5 and Max 10, and your current emoji are always backed up first.
      </p>
      <Link to={`/pricing?guild=${guildId}`} className="btn primary">Compare plans <ArrowRight aria-hidden="true" /></Link>
    </div>
  </section>
);

const EnableCard: React.FC<{ data: EmojiPacksOverview; busy: boolean; onEnable: () => void; status: Status }> = ({
  data, busy, onEnable, status,
}) => {
  const count = data.live.emojis.filter((emoji) => !emoji.managed).length;
  return (
    <section className="server-images-lock emoji-packs-enable" aria-labelledby="emoji-packs-enable-title">
      <div className="server-images-lock__signal" aria-hidden="true"><Smile /></div>
      <div>
        <span className="server-images-kicker">Emoji packs</span>
        <h2 id="emoji-packs-enable-title">Turn on emoji packs</h2>
        <p>
          Acosmibot will first save all {count} of this server's custom emoji as an <strong>Original</strong> pack.
          It's your backup and doesn't count toward your plan. Nothing in Discord changes until you apply a pack.
        </p>
        <p className="emoji-packs-slots-line">
          This server has {data.live.limit} static and {data.live.limit} animated emoji slots at its boost level.
        </p>
        {status?.tone === 'error' && <p className="server-images-status server-images-status--error" role="alert">{status.text}</p>}
        <button type="button" className="btn primary" disabled={busy} onClick={onEnable}>
          {busy ? 'Starting…' : 'Turn on and save my emoji'}
        </button>
      </div>
    </section>
  );
};

const JobBanner: React.FC<{ job: EmojiPackJob; packs: EmojiPack[] }> = ({ job, packs }) => {
  const pack = packs.find((item) => item.id === job.pack_id);
  if (job.status === 'queued' || job.status === 'running') {
    const total = Math.max(job.progress_total, 0);
    const pct = total ? Math.round((job.progress_done / total) * 100) : 0;
    return (
      <section className="emoji-packs-job" role="status" aria-live="polite">
        <div className="emoji-packs-job__head">
          <RefreshCw aria-hidden="true" className="emoji-packs-spin" />
          <strong>{JOB_VERBS[job.kind]}{job.kind === 'apply' && pack ? `: ${pack.name}` : ''}</strong>
          <span>{job.status === 'queued' ? 'Waiting for Acosmibot…' : total ? `${job.progress_done} of ${total}` : 'Starting…'}</span>
        </div>
        <div className="emoji-packs-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <p>
          {job.message ?? 'Working…'} Discord limits how fast emoji can be uploaded, so large packs can take a while.
          You can leave this page.
        </p>
      </section>
    );
  }
  if (!job.message) return null;
  return (
    <p className={`server-images-status server-images-status--${job.status === 'failed' ? 'error' : 'ok'}`}
      role={job.status === 'failed' ? 'alert' : 'status'}>
      {job.status === 'failed' ? 'Last change didn’t finish: ' : ''}{job.message}
    </p>
  );
};

/* -------------------------------------------------------------------- live */

const LiveCard: React.FC<{
  data: EmojiPacksOverview;
  livePack: EmojiPack | null;
  busy: boolean;
  onToggleKeep: (emoji: LiveEmoji) => void;
}> = ({ data, livePack, busy, onToggleKeep }) => {
  const { live } = data;
  return (
    <section className="server-images-current emoji-packs-live" aria-labelledby="emoji-packs-live-title">
      <div className="emoji-packs-live__body">
        <span className="server-images-kicker">Live in Discord</span>
        <h2 id="emoji-packs-live-title">{livePack ? livePack.name : 'Current emoji'}</h2>
        <div className="emoji-packs-meters">
          <SlotMeter label="Static" used={live.static} limit={live.limit} />
          <SlotMeter label="Animated" used={live.animated} limit={live.limit} />
        </div>
        <p>
          Pin an emoji to <strong>always keep</strong> it whichever pack is live. Emoji used by reaction roles and
          integration emoji are always kept automatically. Kept emoji still use slots.
        </p>
      </div>
      {live.emojis.length === 0 ? (
        <p className="server-images-empty">This server has no custom emoji right now.</p>
      ) : (
        <ul className="emoji-grid emoji-grid--live">
          {live.emojis.map((emoji) => {
            const auto = emoji.managed || emoji.reaction_role;
            const title = emoji.managed ? 'Managed by an integration' : emoji.reaction_role ? 'Used by a reaction role' : emoji.kept ? 'Always kept' : undefined;
            return (
              <li key={emoji.id} className={`emoji-tile${emoji.kept || auto ? ' is-kept' : ''}`} title={title}>
                <img src={emoji.url} alt="" loading="lazy" />
                <span className="emoji-tile__name">:{emoji.name}:</span>
                {auto ? (
                  <span className="emoji-tile__flag"><LockKeyhole aria-label={title} /></span>
                ) : (
                  <button type="button" className="emoji-tile__flag" disabled={busy}
                    aria-pressed={emoji.kept}
                    aria-label={emoji.kept ? `Stop always keeping :${emoji.name}:` : `Always keep :${emoji.name}:`}
                    onClick={() => onToggleKeep(emoji)}>
                    {emoji.kept ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const SlotMeter: React.FC<{ label: string; used: number; limit: number }> = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="emoji-packs-meter">
      <div><span>{label}</span><strong>{used}/{limit}</strong></div>
      <div className="emoji-packs-progress" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}
        aria-label={`${label} emoji slots used`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------- packs */

const NewPackForm: React.FC<{
  packs: EmojiPack[];
  disabled: boolean;
  atLimit: boolean;
  guildId: string;
  onCreate: (input: { name: string; source: NewPackSource; from_pack_id?: number }) => void;
}> = ({ packs, disabled, atLimit, onCreate }) => {
  const [name, setName] = useState('');
  const [source, setSource] = useState<string>('empty');
  return (
    <form
      className="server-images-upload emoji-packs-new"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        const fromPack = source.startsWith('pack:') ? Number(source.slice(5)) : undefined;
        onCreate({ name: name.trim(), source: fromPack ? 'duplicate' : (source as NewPackSource), from_pack_id: fromPack });
        setName('');
        setSource('empty');
      }}
    >
      <h3><Plus aria-hidden="true" /> New pack</h3>
      <div className="server-images-upload__row">
        <label className="server-images-field">
          <span>Name</span>
          <input type="text" maxLength={64} value={name} placeholder="e.g. Halloween" onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="server-images-field emoji-packs-source">
          <span>Start from</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="empty">Empty pack</option>
            <option value="live">What's live in Discord now</option>
            {packs.map((pack) => <option key={pack.id} value={`pack:${pack.id}`}>Copy of {pack.name}</option>)}
          </select>
        </label>
        <button type="submit" className="btn primary" disabled={disabled || !name.trim()}>
          <Plus aria-hidden="true" /> Create
        </button>
      </div>
      {atLimit && <p>You've used every pack on your plan. Delete one or upgrade to add more.</p>}
    </form>
  );
};

const PackCard: React.FC<{
  pack: EmojiPack;
  guildId: string;
  selected: boolean;
  confirming: 'apply' | 'delete' | null;
  busy: boolean;
  liveLimit: number;
  onSelect: () => void;
  onConfirm: (action: 'apply' | 'delete') => void;
  onCancel: () => void;
  onApply: () => void;
  onDelete: () => void;
}> = ({ pack, guildId, selected, confirming, busy, liveLimit, onSelect, onConfirm, onCancel, onApply, onDelete }) => {
  const overflow = pack.counts.static > liveLimit || pack.counts.animated > liveLimit;
  const preview = pack.items.slice(0, PREVIEW_COUNT);
  return (
    <li className={`emoji-pack-card${pack.live ? ' is-live' : ''}${selected ? ' is-selected' : ''}${pack.usable ? '' : ' is-locked'}`}>
      <div className="emoji-pack-card__head">
        <h3>{pack.name}</h3>
        <div className="server-images-badges">
          {pack.live && <span className="server-images-badge server-images-badge--current">Live</span>}
          {pack.kind === 'original' && <span className="server-images-badge">Backup</span>}
          {!pack.usable && <span className="server-images-badge">Locked on this plan</span>}
        </div>
      </div>
      <p className="server-images-card__meta">
        {pack.counts.static} static · {pack.counts.animated} animated
        {overflow && <span className="emoji-pack-card__warn"> · needs more slots than this server has</span>}
      </p>
      <div className="emoji-pack-card__preview" aria-hidden="true">
        {preview.length === 0 ? <span>Empty</span> : preview.map((item) => <img key={item.id} src={item.url} alt="" loading="lazy" />)}
        {pack.items.length > preview.length && <span>+{pack.items.length - preview.length}</span>}
      </div>
      {confirming ? (
        <div className="server-images-confirm">
          <span>
            {confirming === 'apply'
              ? 'Apply this pack? Only emoji that differ change, and anything unsaved is backed up first.'
              : 'Delete this pack? Emoji in Discord are not affected.'}
          </span>
          <button type="button" className={`btn ${confirming === 'apply' ? 'primary' : 'danger'}`} disabled={busy}
            onClick={confirming === 'apply' ? onApply : onDelete}>
            {confirming === 'apply' ? 'Apply' : 'Delete'}
          </button>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        </div>
      ) : (
        <div className="server-images-actions">
          <button type="button" className="btn primary" disabled={busy || !pack.usable || overflow}
            title={overflow ? 'This pack has more emoji than the server has slots' : undefined}
            onClick={() => onConfirm('apply')}>
            {pack.live ? 'Re-apply' : 'Apply'}
          </button>
          <button type="button" className="btn secondary" aria-expanded={selected} onClick={onSelect}>
            <Pencil aria-hidden="true" /> {pack.kind === 'original' || !pack.usable ? 'View' : 'Edit'}
          </button>
          <a className="server-images-icon-btn" href={emojiPacksApi.downloadUrl(guildId, pack.id)} aria-label={`Download ${pack.name} as a zip`}>
            <Download aria-hidden="true" />
          </a>
          {pack.kind !== 'original' && (
            <button type="button" className="server-images-icon-btn" disabled={busy || pack.live}
              aria-label={`Delete ${pack.name}`} title={pack.live ? 'Apply another pack before deleting this one' : undefined}
              onClick={() => onConfirm('delete')}>
              <Trash2 aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
};

/* ------------------------------------------------------------------ editor */

const PackEditor: React.FC<{
  pack: EmojiPack;
  limit: number;
  readOnly: boolean;
  working: boolean;
  hooks: ReturnType<typeof useEmojiPacks>;
  onStatus: (status: Status) => void;
}> = ({ pack, limit, readOnly, working, hooks, onStatus }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [packName, setPackName] = useState(pack.name);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [filter, setFilter] = useState('');
  const busy = readOnly || hooks.addItems.isPending || hooks.renameItem.isPending || hooks.deleteItem.isPending;
  const items = useMemo(
    () => pack.items.filter((item) => item.name.toLowerCase().includes(filter.trim().toLowerCase())),
    [pack.items, filter],
  );

  const run = async (action: () => Promise<unknown>, success: string) => {
    onStatus(null);
    try {
      await action();
      onStatus({ tone: 'ok', text: success });
    } catch (caught) {
      onStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'Something went wrong.' });
    }
  };

  const onFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (!files.length) return;
    void run(async () => {
      const result = await hooks.addItems.mutateAsync({ packId: pack.id, files });
      if (result.errors.length) {
        throw new ServerImagesError(
          `Added ${result.added.length}. Skipped ${result.errors.map((error) => `${error.file} (${error.message})`).join('; ')}`,
          400,
        );
      }
    }, `Added ${files.length} emoji to ${pack.name}.`);
  };

  return (
    <section className="server-images-upload emoji-pack-editor" aria-labelledby="emoji-pack-editor-title">
      <div className="emoji-pack-editor__head">
        <h2 id="emoji-pack-editor-title">{readOnly ? <Smile aria-hidden="true" /> : <Pencil aria-hidden="true" />} {pack.name}</h2>
        <span>{pack.counts.static}/{limit} static · {pack.counts.animated}/{limit} animated</span>
      </div>

      {pack.kind === 'original' && (
        <p>The Original pack is the backup taken when you turned emoji packs on. Copy it to make an editable version.</p>
      )}

      {!readOnly && (
        <>
          <form className="server-images-upload__row" onSubmit={(event) => {
            event.preventDefault();
            if (packName.trim() && packName.trim() !== pack.name) {
              void run(() => hooks.renamePack.mutateAsync({ packId: pack.id, name: packName.trim() }), 'Pack renamed.');
            }
          }}>
            <label className="server-images-field">
              <span>Pack name</span>
              <input type="text" maxLength={64} value={packName} onChange={(event) => setPackName(event.target.value)} />
            </label>
            <button type="submit" className="btn secondary" disabled={!packName.trim() || packName.trim() === pack.name}>Rename</button>
          </form>

          <div className="emoji-pack-editor__tools">
            <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={onFiles} />
            <button type="button" className="btn primary" disabled={busy} onClick={() => fileInput.current?.click()}>
              <Upload aria-hidden="true" /> {hooks.addItems.isPending ? 'Uploading…' : 'Add emoji'}
            </button>
            <button type="button" className="btn secondary" disabled={busy || working}
              onClick={() => void run(() => hooks.capture.mutateAsync(pack.id), `Saving the live emoji into ${pack.name}…`)}>
              <Copy aria-hidden="true" /> Replace with live emoji
            </button>
          </div>
          <p>
            PNG, JPEG, GIF or WebP, up to 50 at a time. File names become emoji names, and anything over Discord's
            256 KB limit is shrunk. Editing a pack doesn't change Discord until you apply it.
          </p>
        </>
      )}

      {pack.items.length > 12 && (
        <label className="server-images-field emoji-pack-editor__filter">
          <span>Find an emoji</span>
          <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Name" />
        </label>
      )}

      {pack.items.length === 0 ? (
        <p className="server-images-empty">No emoji in this pack yet.</p>
      ) : (
        <ul className="emoji-grid">
          {items.map((item) => (
            <li key={item.id} className="emoji-tile emoji-tile--editable"
              title={item.source === '7tv' ? `From 7TV${item.source_author ? ` · by ${item.source_author}` : ''}` : undefined}>
              <img src={item.url} alt="" loading="lazy" />
              {editing?.id === item.id ? (
                <form className="emoji-tile__rename" onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await hooks.renameItem.mutateAsync({ packId: pack.id, itemId: item.id, name: editing.name.trim() });
                    setEditing(null);
                  }, 'Emoji renamed.');
                }}>
                  <input aria-label="Emoji name" value={editing.name} maxLength={32} autoFocus
                    pattern="[A-Za-z0-9_]{2,32}" onChange={(event) => setEditing({ id: item.id, name: event.target.value })} />
                  <button type="submit" className="btn primary" disabled={busy}>Save</button>
                  <button type="button" className="btn secondary" onClick={() => setEditing(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <span className="emoji-tile__name">:{item.name}:{item.animated ? ' · GIF' : ''}</span>
                  {!readOnly && (
                    <span className="emoji-tile__actions">
                      <button type="button" className="server-images-icon-btn" aria-label={`Rename :${item.name}:`} disabled={busy}
                        onClick={() => setEditing({ id: item.id, name: item.name })}>
                        <Pencil aria-hidden="true" />
                      </button>
                      <button type="button" className="server-images-icon-btn" aria-label={`Remove :${item.name}: from ${pack.name}`} disabled={busy}
                        onClick={() => void run(() => hooks.deleteItem.mutateAsync({ packId: pack.id, itemId: item.id }), `Removed :${item.name}:.`)}>
                        <Trash2 aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
