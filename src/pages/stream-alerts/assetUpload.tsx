import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { streamAlertsApi, StreamAlertAsset, StreamAlertAssetKind, StreamAlertAssets } from '@/api/streamAlerts';
import { plainError } from '@/utils/streamAlertAccounts';
import { ASSET_KIND_LABELS, assetsQueryKey, assetStatusText, canRemoveBlack, MAX_UPLOAD_BYTES } from '@/utils/streamAlertDesigns';
import './StreamAlertDesigns.css';

export type Upload =
  | { phase: 'sending'; name: string; fraction: number }
  | { phase: 'done'; name: string }
  | { phase: 'error'; name: string; text: string };

/**
 * Sends one file to the account's media library and puts it at the top of the library list.
 * The Media library page and the upload buttons on each alert page both use it.
 */
export function useAssetUpload(accountId: number) {
  const queryClient = useQueryClient();
  const assetsKey = assetsQueryKey(accountId);
  const [upload, setUpload] = useState<Upload | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** The stored file (still converting, usually), or null when it was refused or failed to send. */
  const send = async (file: File, removeBlack: boolean): Promise<StreamAlertAsset | null> => {
    if (busy.current) return null;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUpload({ phase: 'error', name: file.name, text: 'That file is larger than 64 MB' });
      return null;
    }
    busy.current = true;
    setUpload({ phase: 'sending', name: file.name, fraction: 0 });
    try {
      const result = await streamAlertsApi.uploadAsset(accountId, file, removeBlack && canRemoveBlack(file), {
        onProgress: (fraction) => { if (mounted.current) setUpload({ phase: 'sending', name: file.name, fraction }); },
      });
      queryClient.setQueryData<StreamAlertAssets>(assetsKey, (old) => (
        old && result.asset ? { ...old, assets: [result.asset, ...old.assets.filter((item) => item.id !== result.asset.id)] } : old
      ));
      if (mounted.current) setUpload({ phase: 'done', name: file.name });
      return result.asset ?? null;
    } catch (error) {
      if (mounted.current) {
        let text = plainError(error);
        if (error instanceof ApiError && error.status === 503) text = 'Uploads are not available right now. Try again later.';
        setUpload({ phase: 'error', name: file.name, text });
      }
      return null;
    } finally {
      busy.current = false;
      queryClient.invalidateQueries({ queryKey: assetsKey });
    }
  };

  return { upload, sending: upload?.phase === 'sending', send, clear: () => setUpload(null) };
}

type Purpose = 'media' | 'sound' | 'font';

const PURPOSES: Record<Purpose, { button: string; kinds: StreamAlertAssetKind[]; accept: string; formats: string }> = {
  media: {
    button: 'Upload a video or picture',
    kinds: ['video', 'image'],
    accept: '.mp4,.m4v,.mov,.webm,.mkv,.gif,.png,.apng,.webp,.jpg,.jpeg,video/*,image/*',
    formats: 'MP4, MOV, WebM, GIF, PNG, JPEG or WebP. Up to 64 MB; videos up to 30 seconds.',
  },
  sound: {
    button: 'Upload a sound',
    kinds: ['sound'],
    accept: '.mp3,.wav,.ogg,.oga,.opus,.flac,.aac,.m4a,audio/*',
    formats: 'MP3, WAV, OGG, FLAC, AAC or M4A. Up to 30 seconds.',
  },
  font: {
    button: 'Upload a font',
    kinds: ['font'],
    accept: '.ttf,.otf,.woff,.woff2',
    formats: 'TTF, OTF, WOFF or WOFF2.',
  },
};

type Outcome = { tone: 'done' | 'error'; text: string };

/**
 * An upload button inside an alert's settings. The file goes into the media library like any
 * other; once it has converted, `onReady` puts it into this alert (unsaved, like any other edit).
 */
export const QuickUpload: React.FC<{
  accountId: number;
  /** The library list, so this can see when the new file is ready. */
  assets: StreamAlertAsset[];
  purpose: Purpose;
  onReady: (asset: StreamAlertAsset) => void;
}> = ({ accountId, assets, purpose, onReady }) => {
  const about = PURPOSES[purpose];
  const { upload, sending, send, clear } = useAssetUpload(accountId);
  const [removeBlack, setRemoveBlack] = useState(false);
  const [waiting, setWaiting] = useState<{ id: number; name: string } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const latestOnReady = useRef(onReady);
  latestOnReady.current = onReady;

  // Pick the file for this alert as soon as the library shows it converted.
  useEffect(() => {
    if (!waiting) return;
    const asset = assets.find((item) => item.id === waiting.id);
    if (!asset) return;
    if (asset.status === 'failed') {
      setOutcome({ tone: 'error', text: `Could not use ${waiting.name}: ${assetStatusText(asset)}` });
      setWaiting(null);
    } else if (asset.status === 'ready' && asset.url) {
      if (about.kinds.includes(asset.kind)) {
        latestOnReady.current(asset);
        const covers = asset.kind === 'video' && !asset.has_alpha ? ' It has a background, so it covers the stream behind it.' : '';
        setOutcome({ tone: 'done', text: `${waiting.name} is ready and picked here. Save settings to keep it.${covers}` });
      } else {
        setOutcome({ tone: 'error', text: `${waiting.name} is a ${ASSET_KIND_LABELS[asset.kind].toLowerCase()}, so it is in the Media library but not used here.` });
      }
      setWaiting(null);
    }
  }, [assets, waiting, about.kinds]);

  const busy = sending || waiting !== null;
  const start = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || busy) return;
    setOutcome(null);
    const asset = await send(file, purpose === 'media' && removeBlack);
    if (fileInput.current) fileInput.current.value = '';
    if (asset) {
      clear();
      setWaiting({ id: asset.id, name: file.name });
    }
  };

  return (
    <div
      className={`stream-quick-upload${dragging ? ' is-over' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); start(event.dataTransfer.files); }}
    >
      <div className="stream-quick-upload__row">
        <input
          ref={fileInput}
          className="stream-media__file"
          type="file"
          accept={about.accept}
          disabled={busy}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => start(event.target.files)}
        />
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          {sending ? 'Uploading…' : waiting ? 'Converting…' : about.button}
        </button>
        {purpose === 'media' && (
          <label className="stream-media__check">
            <input type="checkbox" checked={removeBlack} disabled={busy} onChange={(event) => setRemoveBlack(event.target.checked)} />
            <span>Remove black background</span>
          </label>
        )}
      </div>
      <small className="stream-props__hint">{about.formats} It is also saved in your Media library.</small>

      {upload?.phase === 'sending' && (
        <div className="stream-media__upload is-sending" role="status">
          <span>Uploading {upload.name}: {Math.round(upload.fraction * 100)}%</span>
          <progress max={100} value={Math.round(upload.fraction * 100)} aria-label={`Upload of ${upload.name}`} />
        </div>
      )}
      {upload?.phase === 'error' && (
        <div className="stream-media__upload is-error" role="alert">Could not upload {upload.name}: {upload.text}</div>
      )}
      {waiting && (
        <div className="stream-media__upload" role="status">
          <span><span className="stream-media__spinner" aria-hidden="true" /> Converting {waiting.name} for OBS. It is picked here when it is ready.</span>
        </div>
      )}
      {outcome && (
        <div className={`stream-media__upload is-${outcome.tone}`} role={outcome.tone === 'error' ? 'alert' : 'status'}>{outcome.text}</div>
      )}
    </div>
  );
};
