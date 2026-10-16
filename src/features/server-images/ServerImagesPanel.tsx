import React, { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Archive,
  CircleAlert,
  Download,
  ImagePlus,
  LockKeyhole,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ServerImagesError,
  type ServerImage,
  type ServerImageKind,
  type ServerImagesOverview,
} from '@/api/serverImages';
import { LoadingSpinner } from '@/components/ui';
import { useServerImages } from './useServerImages';
import './ServerImagesPage.css';

export const IMAGE_KINDS: { kind: ServerImageKind; label: string; shape: 'square' | 'wide'; spec: string }[] = [
  { kind: 'icon', label: 'Server Icon', shape: 'square', spec: 'Cropped to a 1024×1024 square' },
  { kind: 'banner', label: 'Server Banner', shape: 'wide', spec: 'Cropped to 16:9, up to 1920×1080' },
  { kind: 'splash', label: 'Invite Background', shape: 'wide', spec: 'Cropped to 16:9, up to 1920×1080' },
];

const SOURCE_LABELS: Record<string, string> = {
  previous: 'Archived',
  applied: 'Set by Acosmibot',
  upload: 'Uploaded',
};

function availability(kind: ServerImageKind, perks: ServerImagesOverview['perks']): { allowed: boolean; note: string } {
  if (kind === 'icon') {
    return {
      allowed: true,
      note: perks.animated_icon ? 'Animated GIF icons are unlocked.' : 'Animated icons unlock at Boost Level 1; GIFs use their first frame.',
    };
  }
  if (kind === 'banner') {
    if (!perks.banner) return { allowed: false, note: 'Discord unlocks the server banner at Boost Level 2 (7 boosts).' };
    return {
      allowed: true,
      note: perks.animated_banner ? 'Animated GIF banners are unlocked.' : 'Animated banners unlock at Boost Level 3; GIFs use their first frame.',
    };
  }
  if (!perks.invite_background) return { allowed: false, note: 'Discord unlocks the invite background at Boost Level 1 (2 boosts).' };
  return { allowed: true, note: 'Invite backgrounds are always still images.' };
}

function formatDate(value: string | null): string {
  if (!value) return 'Unknown date';
  const date = new Date(value.endsWith('Z') || value.includes('+') ? value : `${value}Z`);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatBytes(size: number): string {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}

/** One image type on the Server Branding page (icon, banner or invite background). */
export const ServerImagesPanel: React.FC<{ kind: ServerImageKind }> = ({ kind }) => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const { query, upload, update, remove, apply, removeCurrent } = useServerImages(guildId);
  const [confirming, setConfirming] = useState<{ id: number; action: 'apply' | 'delete' } | null>(null);
  const [confirmRemoveCurrent, setConfirmRemoveCurrent] = useState(false);
  const [editing, setEditing] = useState<{ id: number; label: string } | null>(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const images = useMemo(
    () => (query.data?.images ?? []).filter((image) => image.kind === kind),
    [query.data?.images, kind],
  );

  if (query.isLoading) return <LoadingSpinner />;

  const error = query.error;
  if (error instanceof ServerImagesError && error.code === 'tier_required') {
    return (
      <div className="server-images-page">
        <section className="server-images-lock" aria-labelledby="server-images-lock-title">
          <div className="server-images-lock__signal" aria-hidden="true"><LockKeyhole /></div>
          <div>
            <span className="server-images-kicker">Plus feature</span>
            <h2 id="server-images-lock-title">Keep every server icon, banner and invite background.</h2>
            <p>
              On Plus and higher, Acosmibot can set your server images from this page, and archives
              the old one first so you can always switch back.
            </p>
            <Link to={`/pricing?guild=${guildId}`} className="btn primary">
              Compare plans <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (error || !query.data) {
    return (
      <div className="server-images-page">
        <div className="server-images-state" role="alert">
          <CircleAlert aria-hidden="true" />
          <h1>Server images could not load</h1>
          <p>{error instanceof Error ? error.message : 'The image library is unavailable right now.'}</p>
          <button type="button" className="btn primary" onClick={() => void query.refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const data = query.data;
  const meta = IMAGE_KINDS.find((item) => item.kind === kind)!;
  const readOnly = Boolean(data.locked);
  const rule = availability(kind, data.perks);
  const current = data.current[kind];
  const busy = readOnly || upload.isPending || update.isPending || remove.isPending || apply.isPending
    || removeCurrent.isPending;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setStatus(null);
    try {
      await action();
      setStatus({ tone: 'ok', text: success });
    } catch (caught) {
      setStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'Something went wrong.' });
    } finally {
      setConfirming(null);
      setConfirmRemoveCurrent(false);
    }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void run(async () => {
      const result = await upload.mutateAsync({ kind, file, label: uploadLabel });
      setUploadLabel('');
      if (result.notes.length) setStatus({ tone: 'ok', text: `Added to the library. ${result.notes.join(' ')}` });
    }, 'Added to the library.');
  };

  return (
    <div className="server-images-page">
      {readOnly && (
        <p className="server-images-status server-images-status--error" role="status">
          This server is on the Free plan, so the library is read-only. You can still open and download every
          image. <Link to={`/pricing?guild=${guildId}`}>Upgrade to Plus</Link> to switch or add images.
        </p>
      )}

      {status && (
        <p className={`server-images-status server-images-status--${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}

      <section className="server-images-current" aria-labelledby="server-images-current-title">
        <div className={`server-images-frame server-images-frame--${meta.shape}`}>
          {current.url
            ? <img src={current.url} alt={`Current ${meta.label.toLowerCase()}`} />
            : <span>No {meta.label.toLowerCase()}</span>}
        </div>
        <div className="server-images-current__body">
          <span className="server-images-kicker">Live in Discord</span>
          <h2 id="server-images-current-title">Current {meta.label.toLowerCase()}</h2>
          <p>{rule.note} {meta.spec}; uploads and switches are fitted automatically.</p>
          {current.url && (
            confirmRemoveCurrent ? (
              <div className="server-images-confirm">
                <span>Remove it? A copy stays in the library.</span>
                <button type="button" className="btn danger" disabled={busy}
                  onClick={() => void run(() => removeCurrent.mutateAsync(kind), `${meta.label} removed.`)}>
                  Remove
                </button>
                <button type="button" className="btn secondary" onClick={() => setConfirmRemoveCurrent(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="btn secondary" disabled={busy} onClick={() => setConfirmRemoveCurrent(true)}>
                <Trash2 aria-hidden="true" /> Remove current
              </button>
            )
          )}
        </div>
      </section>

      <section className="server-images-upload" aria-labelledby="server-images-upload-title">
        <h2 id="server-images-upload-title"><ImagePlus aria-hidden="true" /> Add to the library</h2>
        <div className="server-images-upload__row">
          <label className="server-images-field">
            <span>Name (optional)</span>
            <input
              type="text"
              maxLength={100}
              value={uploadLabel}
              placeholder="e.g. Winter icon"
              onChange={(event) => setUploadLabel(event.target.value)}
            />
          </label>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={onFile} />
          <button type="button" className="btn primary" disabled={busy} onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden="true" /> {upload.isPending ? 'Uploading…' : 'Choose image'}
          </button>
        </div>
        <p>PNG, JPEG, GIF or WebP, up to 10 MB. Adding doesn't change Discord until you set it as current.</p>
      </section>

      <section aria-labelledby="server-images-library-title">
        <div className="server-images-library__head">
          <h2 id="server-images-library-title"><Archive aria-hidden="true" /> Library</h2>
          <span>Keeps the newest {data.max_unpinned_per_kind} unpinned per type. Pin one to keep it forever.</span>
        </div>
        {images.length === 0 ? (
          <p className="server-images-empty">
            Nothing stored yet. Images appear here whenever Acosmibot sets or replaces the {meta.label.toLowerCase()}, or
            when you add one above.
          </p>
        ) : (
          <ul className={`server-images-grid server-images-grid--${meta.shape}`}>
            {images.map((image) => (
              <LibraryCard
                key={image.id}
                image={image}
                shape={meta.shape}
                canApply={rule.allowed}
                busy={busy}
                confirming={confirming?.id === image.id ? confirming.action : null}
                editing={editing?.id === image.id ? editing.label : null}
                onConfirm={(action) => setConfirming({ id: image.id, action })}
                onCancel={() => setConfirming(null)}
                onApply={() => void run(() => apply.mutateAsync(image.id), `${meta.label} updated in Discord.`)}
                onDelete={() => void run(() => remove.mutateAsync(image.id), 'Deleted from the library.')}
                onPin={() => void run(() => update.mutateAsync({ id: image.id, pinned: !image.pinned }), image.pinned ? 'Unpinned.' : 'Pinned.')}
                onEdit={(label) => setEditing(label === null ? null : { id: image.id, label })}
                onRename={(label) => void run(async () => {
                  await update.mutateAsync({ id: image.id, label });
                  setEditing(null);
                }, 'Renamed.')}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface LibraryCardProps {
  image: ServerImage;
  shape: 'square' | 'wide';
  canApply: boolean;
  busy: boolean;
  confirming: 'apply' | 'delete' | null;
  editing: string | null;
  onConfirm: (action: 'apply' | 'delete') => void;
  onCancel: () => void;
  onApply: () => void;
  onDelete: () => void;
  onPin: () => void;
  onEdit: (label: string | null) => void;
  onRename: (label: string) => void;
}

const LibraryCard: React.FC<LibraryCardProps> = ({
  image, shape, canApply, busy, confirming, editing, onConfirm, onCancel, onApply, onDelete, onPin, onEdit, onRename,
}) => (
  <li className={`server-images-card${image.current ? ' is-current' : ''}`}>
    <div className={`server-images-frame server-images-frame--${shape}`}>
      <img src={image.url} alt={image.label} loading="lazy" />
    </div>
    <div className="server-images-card__body">
      {editing !== null ? (
        <form
          className="server-images-rename"
          onSubmit={(event) => { event.preventDefault(); if (editing.trim()) onRename(editing.trim()); }}
        >
          <input
            aria-label="Image name"
            maxLength={100}
            value={editing}
            autoFocus
            onChange={(event) => onEdit(event.target.value)}
          />
          <button type="submit" className="btn primary" disabled={busy || !editing.trim()}>Save</button>
          <button type="button" className="btn secondary" onClick={() => onEdit(null)}>Cancel</button>
        </form>
      ) : (
        <h3>
          <span>#{image.id}</span> {image.label}
          <button type="button" className="server-images-icon-btn" aria-label={`Rename ${image.label}`} onClick={() => onEdit(image.label)}>
            <Pencil aria-hidden="true" />
          </button>
        </h3>
      )}
      <div className="server-images-badges">
        {image.current && <span className="server-images-badge server-images-badge--current">Current</span>}
        <span className="server-images-badge">{SOURCE_LABELS[image.source] ?? image.source}</span>
        {image.animated && <span className="server-images-badge">GIF</span>}
        {image.pinned && <span className="server-images-badge">Pinned</span>}
      </div>
      <p className="server-images-card__meta">
        {image.width}×{image.height} · {formatBytes(image.byte_size)} · {formatDate(image.created_at)}
      </p>

      {confirming ? (
        <div className="server-images-confirm">
          <span>{confirming === 'apply' ? 'Set this in Discord? The current one is archived first.' : 'Delete this from the library?'}</span>
          <button type="button" className={`btn ${confirming === 'apply' ? 'primary' : 'danger'}`} disabled={busy}
            onClick={confirming === 'apply' ? onApply : onDelete}>
            {confirming === 'apply' ? 'Set as current' : 'Delete'}
          </button>
          <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
        </div>
      ) : (
        <div className="server-images-actions">
          <button type="button" className="btn primary" disabled={busy || image.current || !canApply}
            title={!canApply ? 'This server has not unlocked this image type' : undefined}
            onClick={() => onConfirm('apply')}>
            {image.current ? 'In use' : 'Set as current'}
          </button>
          <a className="btn secondary" href={image.url} target="_blank" rel="noreferrer" download>
            <Download aria-hidden="true" /> Open
          </a>
          <button type="button" className="server-images-icon-btn" disabled={busy}
            aria-label={image.pinned ? `Unpin ${image.label}` : `Pin ${image.label}`} onClick={onPin}>
            {image.pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
          </button>
          <button type="button" className="server-images-icon-btn" disabled={busy || image.current}
            aria-label={`Delete ${image.label}`} title={image.current ? 'Switch to another image before deleting this one' : undefined}
            onClick={() => onConfirm('delete')}>
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  </li>
);
