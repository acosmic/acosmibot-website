import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { streamAlertsApi, StreamAlertAccount, StreamAlertAsset, StreamAlertAssets } from '@/api/streamAlerts';
import { PageNotice, plainError } from '@/utils/streamAlertAccounts';
import { alertsQueryKey } from '@/utils/streamAlertBox';
import {
  ACCEPTED_WORDS,
  ASSET_KIND_LABELS,
  assetsQueryKey,
  assetStatusText,
  assetsWaiting,
  backgroundText,
  designsQueryKey,
  formatBytes,
  formatLength,
  inUseText,
  UPLOAD_ACCEPT,
  uploadedFontFamily,
} from '@/utils/streamAlertDesigns';
import { useAssetUpload } from './assetUpload';
import { useDesignFonts } from './designFonts';
import './StreamAlertDesigns.css';

const POLL_MS = 3_000;

/** The library list, read again every few seconds while something is still converting. */
export function useAssets(accountId: number) {
  const assetsKey = assetsQueryKey(accountId);
  return useQuery({
    queryKey: assetsKey,
    queryFn: () => streamAlertsApi.getAssets(accountId),
    refetchInterval: (query) => (assetsWaiting(query.state.data?.assets) ? POLL_MS : false),
  });
}

/** A small look at the file: a frame of a video, the picture, a play button for a sound, "Aa" for a font. */
const AssetPreview: React.FC<{ asset: StreamAlertAsset }> = ({ asset }) => {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);

  if (asset.status !== 'ready' || !asset.url) {
    return <span className="stream-media__thumb is-empty" aria-hidden="true">{ASSET_KIND_LABELS[asset.kind]}</span>;
  }
  if (asset.kind === 'video') {
    const middle = Math.max(0, (asset.duration_ms ?? 0) / 2000);
    return (
      <span className="stream-media__thumb is-checker">
        <video src={`${asset.url}#t=${middle.toFixed(2)}`} muted playsInline preload="metadata" aria-hidden="true" />
      </span>
    );
  }
  if (asset.kind === 'image') {
    return <span className="stream-media__thumb is-checker"><img src={asset.url} alt="" loading="lazy" /></span>;
  }
  if (asset.kind === 'font') {
    return <span className="stream-media__thumb" style={{ fontFamily: `"${uploadedFontFamily(asset.id)}", sans-serif` }} aria-hidden="true">Aa</span>;
  }
  const toggle = () => {
    if (!audio.current) {
      audio.current = new Audio(asset.url ?? undefined);
      audio.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audio.current.pause();
      audio.current.currentTime = 0;
      setPlaying(false);
    } else {
      audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };
  return (
    <button type="button" className="stream-media__thumb is-sound" aria-label={`${playing ? 'Stop' : 'Play'} ${asset.original_name}`} onClick={toggle}>
      {playing ? 'Stop' : 'Play'}
    </button>
  );
};

const AssetRow: React.FC<{ accountId: number; asset: StreamAlertAsset }> = ({ accountId, asset }) => {
  const queryClient = useQueryClient();
  const assetsKey = assetsQueryKey(accountId);
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: () => streamAlertsApi.deleteAsset(accountId, asset.id),
    onMutate: () => setRefusal(null),
    onSuccess: () => {
      queryClient.setQueryData<StreamAlertAssets>(assetsKey, (old) => (
        old ? { ...old, assets: old.assets.filter((item) => item.id !== asset.id) } : old
      ));
    },
    // "That file is used by your Follow alert. Change that alert first." lands here, in the confirm step.
    onError: (error) => setRefusal(plainError(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: assetsKey }),
  });

  const facts = [
    ASSET_KIND_LABELS[asset.kind],
    asset.status === 'ready' && asset.bytes ? formatBytes(asset.bytes) : null,
    asset.duration_ms ? formatLength(asset.duration_ms) : null,
    asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
    asset.kind === 'font' && asset.font_family ? asset.font_family : null,
  ].filter(Boolean);
  const background = backgroundText(asset);
  const used = inUseText(asset.in_use ?? []);
  const waiting = asset.status === 'queued' || asset.status === 'processing';

  return (
    <li className={`stream-media__row is-${asset.status}`}>
      <AssetPreview asset={asset} />
      <div className="stream-media__about">
        <strong>{asset.original_name}</strong>
        <span>
          {facts.join(' · ')}
          {background && <em className={asset.has_alpha ? 'is-clear' : ''}>{background}</em>}
        </span>
        {asset.status !== 'ready' && (
          <span className={`stream-media__status is-${asset.status}`} role={asset.status === 'failed' ? 'alert' : undefined}>
            {waiting && <span className="stream-media__spinner" aria-hidden="true" />}
            {assetStatusText(asset)}
          </span>
        )}
        {used && <span className="stream-media__used">{used}</span>}
      </div>
      {!confirming && (
        <button type="button" aria-label={`Delete ${asset.original_name}`} onClick={() => { setRefusal(null); setConfirming(true); }}>
          Delete
        </button>
      )}
      {confirming && (
        <div className="stream-accounts__confirm stream-media__confirm" role="group" aria-label={`Confirm deleting ${asset.original_name}`}>
          <strong>Delete {asset.original_name}?</strong>
          <p>{used ? `${used}. Change that alert before you delete this file.` : 'It is removed from your media library for good.'}</p>
          {refusal && <p className="stream-accounts__notice is-error" role="alert">{refusal}</p>}
          <div className="stream-accounts__buttons">
            <button type="button" className="is-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
              {remove.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button type="button" autoFocus disabled={remove.isPending} onClick={() => { setConfirming(false); setRefusal(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
};

/**
 * The account's uploaded videos, pictures, sounds and fonts. Editors use it like the owner:
 * every route here is open to both.
 */
export const MediaLibraryCard: React.FC<{ account: StreamAlertAccount }> = ({ account }) => {
  const queryClient = useQueryClient();
  const accountId = account.id;
  const designsKey = designsQueryKey(accountId);
  const list = useAssets(accountId);
  const [removeBlack, setRemoveBlack] = useState(false);
  const { upload, sending, send: sendFile } = useAssetUpload(accountId);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const assets = list.data?.assets ?? [];
  const quota = list.data?.quota;
  useDesignFonts([], assets);

  // A file that has finished converting can change what a saved look or design resolves to.
  const readyKey = assets.filter((asset) => asset.status === 'ready').map((asset) => asset.id).join(',');
  const firstReady = useRef(true);
  useEffect(() => {
    if (firstReady.current) { firstReady.current = false; return; }
    queryClient.invalidateQueries({ queryKey: designsKey });
    queryClient.invalidateQueries({ queryKey: alertsQueryKey(accountId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);

  const owner = account.role === 'owner' ? 'your' : `${account.owner_username.trim() || 'the owner'}'s`;

  const send = async (files: FileList | File[] | null) => {
    const picked = files ? Array.from(files) : [];
    if (picked.length === 0 || sending) return;
    const file = picked[0];
    setNotice(picked.length > 1 ? { tone: 'note', text: `One file at a time, so only ${file.name} is being uploaded.` } : null);
    await sendFile(file, removeBlack);
    if (fileInput.current) fileInput.current.value = '';
  };

  const hasBackground = assets.some((asset) => asset.status === 'ready' && asset.kind === 'video' && !asset.has_alpha);
  const usedShare = quota && quota.max_bytes > 0 ? Math.min(100, (quota.used_bytes / quota.max_bytes) * 100) : 0;

  return (
    <section className="stream-accounts__card stream-media" aria-labelledby="stream-media-title">
      <div className="stream-accounts__card-head">
        <h3 id="stream-media-title">Media library</h3>
        <p>
          Videos, pictures, sounds and fonts for {owner} custom alerts. Files are converted for OBS after they arrive, which can take a minute.
        </p>
      </div>

      <div
        className={`stream-media__drop${dragging ? ' is-over' : ''}`}
        onDragOver={(event) => { event.preventDefault(); if (!sending) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); send(event.dataTransfer.files); }}
      >
        <div className="stream-media__drop-top">
          <input
            ref={fileInput}
            id={`stream-media-file-${accountId}`}
            className="stream-media__file"
            type="file"
            accept={UPLOAD_ACCEPT}
            disabled={sending}
            onChange={(event) => send(event.target.files)}
          />
          <button type="button" className="is-primary" disabled={sending} onClick={() => fileInput.current?.click()}>
            {sending ? 'Uploading…' : 'Upload a file'}
          </button>
          <span>or drop a file here. Up to 64 MB.</span>
        </div>
        <label className="stream-media__check">
          <input type="checkbox" checked={removeBlack} disabled={sending} onChange={(event) => setRemoveBlack(event.target.checked)} />
          <span>Remove black background (videos and pictures)</span>
        </label>
        <p className="stream-media__warn">Makes black see-through. It can also eat very dark parts of the picture.</p>
        <ul className="stream-media__accepted">
          {ACCEPTED_WORDS.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      {upload && (
        <div className={`stream-media__upload is-${upload.phase}`} role={upload.phase === 'error' ? 'alert' : 'status'}>
          {upload.phase === 'sending' && (
            <>
              <span>Uploading {upload.name}: {Math.round(upload.fraction * 100)}%</span>
              <progress max={100} value={Math.round(upload.fraction * 100)} aria-label={`Upload of ${upload.name}`} />
            </>
          )}
          {upload.phase === 'done' && <span>Received {upload.name}. It is converting now and shows as ready below when it is done.</span>}
          {upload.phase === 'error' && <span>Could not upload {upload.name}: {upload.text}</span>}
        </div>
      )}
      {notice && <p className={`stream-accounts__notice is-${notice.tone}`} role="status">{notice.text}</p>}

      {list.isLoading && <p className="stream-accounts__empty" role="status">Loading the media library…</p>}
      {list.error && !list.data && (
        <div className="stream-accounts__load-error" role="alert">
          <p className="stream-accounts__notice is-error">Could not load the media library: {plainError(list.error)}</p>
          <button type="button" disabled={list.isFetching} onClick={() => list.refetch()}>{list.isFetching ? 'Trying again…' : 'Try again'}</button>
        </div>
      )}
      {list.data && assets.length === 0 && <p className="stream-accounts__empty">No files yet. Upload a video or a picture to design a custom alert.</p>}
      {assets.length > 0 && (
        <ul className="stream-media__list">
          {assets.map((asset) => <AssetRow key={asset.id} accountId={accountId} asset={asset} />)}
        </ul>
      )}

      {hasBackground && (
        <p className="stream-accounts__aside">
          A video that has a background covers the stream behind it. For a see-through alert, export it from After Effects as QuickTime, Apple ProRes 4444, RGB + Alpha, and upload that file. Or upload it again with Remove black background.
        </p>
      )}

      {quota && (
        <div className="stream-media__quota">
          <span>
            {formatBytes(quota.used_bytes)} of {formatBytes(quota.max_bytes)} used · {quota.count} of {quota.max_count} files
          </span>
          <span className="stream-media__meter" aria-hidden="true"><span style={{ width: `${usedShare}%` }} /></span>
        </div>
      )}
    </section>
  );
};
