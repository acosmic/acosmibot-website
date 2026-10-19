import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ExternalLink, Plus, Search, Send, Users } from 'lucide-react';
import type { EmojiPack, SevenTvEmote, SevenTvSort } from '@/api/emojiPacks';
import { PackPicker } from './PackPicker';
import { useEmojiPacks, useSevenTvSearch, useSevenTvSet, useSevenTvUsers } from './useEmojiPacks';

type Status = { tone: 'ok' | 'error'; text: string } | null;
type Mode = 'emotes' | 'sets';

const SEARCH_DELAY_MS = 350;

function useDebounced<T>(value: T, delay = SEARCH_DELAY_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

const describe = (result: { added: unknown[]; errors: { file: string; message: string }[] }, target: string) => {
  const added = `Added ${result.added.length} to ${target}.`;
  if (!result.errors.length) return { tone: 'ok' as const, text: added };
  return {
    tone: result.added.length ? ('ok' as const) : ('error' as const),
    text: `${added} Skipped ${result.errors.map((error) => `${error.file} (${error.message})`).join('; ')}`,
  };
};

/**
 * Search 7TV (Plus and higher) and add emotes straight to the server, or to a pack
 * when the server uses packs. ``packs`` is empty when packs are off.
 */
export const SevenTvBrowser: React.FC<{
  guildId: string;
  packs: EmojiPack[];
  preferredPackId: number | null;
  working: boolean;
  hooks: ReturnType<typeof useEmojiPacks>;
  onStatus: (status: Status) => void;
  onCreatePack: (name: string) => Promise<number>;
  canCreatePack: boolean;
}> = ({ guildId, packs, preferredPackId, working, hooks, onStatus, onCreatePack, canCreatePack }) => {
  const packMode = packs.length > 0;
  const editable = packs.filter((pack) => pack.kind === 'custom' && pack.usable);
  const [mode, setMode] = useState<Mode>('emotes');
  const [targetId, setTargetId] = useState<number | null>(null);
  const target = editable.find((pack) => pack.id === (targetId ?? preferredPackId)) ?? editable[0] ?? null;

  const addToPack = (emotes: SevenTvEmote[], packId = target?.id, packName = target?.name) => {
    if (!packId || !packName) return Promise.resolve();
    onStatus(null);
    return hooks.addSevenTv
      .mutateAsync({ packId, emotes: emotes.map((emote) => ({ id: emote.id, name: emote.name })) })
      .then((result) => onStatus(describe(result, packName)))
      .catch((caught: unknown) => onStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'Something went wrong.' }));
  };

  const addToServer = (emote: SevenTvEmote) => {
    onStatus(null);
    hooks.addSevenTvToServer
      .mutateAsync({ id: emote.id, name: emote.name })
      .then((result) => onStatus({
        tone: 'ok',
        text: result.job
          ? `Adding :${emote.name}: to your server. It also stays in the live pack.`
          : `Added :${result.emoji?.name ?? emote.name}: to your server.`,
      }))
      .catch((caught: unknown) => onStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'Something went wrong.' }));
  };

  const busy = hooks.addSevenTv.isPending || hooks.addSevenTvToServer.isPending;
  const actions: TileActions = {
    packMode,
    packs: editable,
    serverDisabled: working || busy,
    packDisabled: busy,
    onPack: (emote, pack) => void addToPack([emote], pack.id, pack.name),
    onServer: addToServer,
  };

  return (
    <section className="server-images-upload seventv" aria-labelledby="seventv-title">
      <div className="seventv__head">
        <h2 id="seventv-title"><Search aria-hidden="true" /> Find emotes on 7TV</h2>
        <div className="seventv__modes" role="tablist" aria-label="Browse by">
          <button type="button" role="tab" aria-selected={mode === 'emotes'} className={mode === 'emotes' ? 'is-active' : ''}
            onClick={() => setMode('emotes')}>
            <Search aria-hidden="true" /> Emotes
          </button>
          <button type="button" role="tab" aria-selected={mode === 'sets'} className={mode === 'sets' ? 'is-active' : ''}
            onClick={() => setMode('sets')}>
            <Users aria-hidden="true" /> Streamer sets
          </button>
        </div>
      </div>

      {mode === 'sets' && packMode && (
        <label className="server-images-field seventv__target">
          <span>Add selected emotes to</span>
          {editable.length ? (
            <select value={target?.id ?? ''} onChange={(event) => setTargetId(Number(event.target.value))}>
              {editable.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
            </select>
          ) : (
            <span className="seventv__hint">No packs yet. Use “New pack from selection” or create one above.</span>
          )}
        </label>
      )}

      {mode === 'emotes'
        ? <EmoteSearch guildId={guildId} actions={actions} />
        : (
          <SetImport
            guildId={guildId}
            target={target}
            busy={busy}
            canImport={packMode}
            canCreatePack={canCreatePack}
            actions={actions}
            onImport={async (emotes, newPackName) => {
              let packId = target?.id;
              if (newPackName) {
                try {
                  packId = await onCreatePack(newPackName);
                } catch (caught) {
                  onStatus({ tone: 'error', text: caught instanceof Error ? caught.message : 'The pack could not be created.' });
                  return;
                }
              }
              await addToPack(emotes, packId, newPackName ?? target?.name);
            }}
          />
        )}

      <p className="seventv__credit">
        Emotes from <a href="https://7tv.app" target="_blank" rel="noreferrer">7TV</a>, made by its community.
        {!packMode && ' Turn on emoji packs to save emotes into packs too.'}
      </p>
    </section>
  );
};

/** Free servers add 7TV emotes with the bot's /7tv upload; the browser is Plus and higher. */
export const SevenTvCommandNote: React.FC<{ guildId: string }> = ({ guildId }) => (
  <section className="server-images-upload seventv" aria-labelledby="seventv-title">
    <div className="seventv__head">
      <h2 id="seventv-title"><Search aria-hidden="true" /> 7TV emotes</h2>
    </div>
    <p>
      Add any 7TV emote on every plan with <code>/7tv upload</code> in Discord: paste the emote's link or ID.{' '}
      <Link to={`/pricing?guild=${guildId}`}>Upgrade to Plus</Link> to browse 7TV here, add emotes in one click and
      import whole streamer sets into packs.
    </p>
  </section>
);

/* ------------------------------------------------------------------ search */

const EmoteSearch: React.FC<{ guildId: string; actions: TileActions }> = ({ guildId, actions }) => {
  const [text, setText] = useState('');
  const [sort, setSort] = useState<SevenTvSort>('trending');
  const [animated, setAnimated] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());
  useEffect(() => setPage(1), [q, sort, animated]);
  const search = useSevenTvSearch(guildId, { q, sort, animated, page });
  const pages = Math.max(1, search.data?.pages ?? 1);

  return (
    <>
      <div className="server-images-upload__row">
        <label className="server-images-field">
          <span>Search</span>
          <input type="search" value={text} placeholder="e.g. catJAM" onChange={(event) => setText(event.target.value)} />
        </label>
        <label className="server-images-field seventv__select">
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SevenTvSort)}>
            <option value="trending">Trending</option>
            <option value="top">Most used</option>
            <option value="new">Newest</option>
          </select>
        </label>
        <label className="server-images-field seventv__select">
          <span>Type</span>
          <select value={animated} onChange={(event) => setAnimated(event.target.value as '' | 'true' | 'false')}>
            <option value="">All</option>
            <option value="true">Animated</option>
            <option value="false">Static</option>
          </select>
        </label>
      </div>

      {search.error ? (
        <p className="server-images-status server-images-status--error" role="alert">
          {search.error instanceof Error ? search.error.message : '7TV is unavailable right now.'}
        </p>
      ) : search.isLoading ? (
        <p className="server-images-empty">Loading 7TV…</p>
      ) : !search.data?.emotes.length ? (
        <p className="server-images-empty">No emotes match that search.</p>
      ) : (
        <ul className={`emoji-grid seventv__grid${search.isFetching ? ' is-fetching' : ''}`} aria-busy={search.isFetching}>
          {search.data.emotes.map((emote) => <EmoteTile key={emote.id} emote={emote} actions={actions} />)}
        </ul>
      )}

      {pages > 1 && <Pager page={page} pages={Math.min(pages, 100)} onPage={setPage} />}
    </>
  );
};

/* -------------------------------------------------------------------- sets */

const SetImport: React.FC<{
  guildId: string;
  target: EmojiPack | null;
  busy: boolean;
  canImport: boolean;
  canCreatePack: boolean;
  actions: TileActions;
  onImport: (emotes: SevenTvEmote[], newPackName?: string) => Promise<void>;
}> = ({ guildId, target, busy, canImport, canCreatePack, actions, onImport }) => {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const users = useSevenTvUsers(guildId, q);
  const [setId, setSetId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Map<string, SevenTvEmote>>(new Map());
  const set = useSevenTvSet(guildId, setId, page);
  const current = set.data?.set;
  const pages = current ? Math.max(1, Math.ceil(current.total / current.per_page)) : 1;

  const choose = (id: string) => {
    setSetId(id);
    setPage(1);
    setPicked(new Map());
  };
  const toggle = (emote: SevenTvEmote) => setPicked((previous) => {
    const next = new Map(previous);
    if (next.has(emote.id)) next.delete(emote.id); else next.set(emote.id, emote);
    return next;
  });
  const selectPage = () => setPicked((previous) => {
    const next = new Map(previous);
    current?.emotes.forEach((emote) => next.set(emote.id, emote));
    return next;
  });
  const run = (newPackName?: string) => void onImport([...picked.values()], newPackName).then(() => setPicked(new Map()));

  return (
    <>
      <label className="server-images-field">
        <span>Streamer</span>
        <input type="search" value={text} placeholder="Twitch or Kick name" onChange={(event) => setText(event.target.value)} />
      </label>

      {q.length >= 2 && !setId && (
        users.isLoading ? <p className="server-images-empty">Searching 7TV…</p>
          : users.error ? <p className="server-images-status server-images-status--error" role="alert">{users.error instanceof Error ? users.error.message : '7TV is unavailable right now.'}</p>
            : !users.data?.users.length ? <p className="server-images-empty">No 7TV users match that name.</p>
              : (
                <ul className="seventv__users">
                  {users.data.users.map((user) => (
                    <li key={user.id}>
                      <button type="button" onClick={() => choose(user.emote_set_id)}>
                        {user.avatar_url ? <img src={user.avatar_url} alt="" loading="lazy" /> : <Users aria-hidden="true" />}
                        <span><strong>{user.name}</strong>{user.platform && <small>{user.platform}</small>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
      )}

      {setId && (
        <div className="seventv__set">
          <div className="seventv__set-head">
            <button type="button" className="btn secondary" onClick={() => setSetId(null)}>
              <ChevronLeft aria-hidden="true" /> Streamers
            </button>
            {current && (
              <span>
                <strong>{current.name}</strong>
                {current.owner ? ` by ${current.owner}` : ''} · {current.total} emotes
              </span>
            )}
          </div>

          {set.error ? (
            <p className="server-images-status server-images-status--error" role="alert">
              {set.error instanceof Error ? set.error.message : '7TV is unavailable right now.'}
            </p>
          ) : set.isLoading || !current ? (
            <p className="server-images-empty">Loading set…</p>
          ) : (
            <>
              {canImport && <div className="seventv__set-tools">
                <button type="button" className="btn secondary" onClick={selectPage}>Select this page</button>
                <button type="button" className="btn secondary" disabled={!picked.size} onClick={() => setPicked(new Map())}>Clear</button>
                <span>{picked.size} selected</span>
                <button type="button" className="btn primary" disabled={busy || !picked.size || !target} onClick={() => run()}>
                  <Plus aria-hidden="true" /> {busy ? 'Adding…' : `Add to ${target?.name ?? 'pack'}`}
                </button>
                {canCreatePack && (
                  <button type="button" className="btn secondary" disabled={busy || !picked.size} onClick={() => run(current.name)}>
                    New pack from selection
                  </button>
                )}
              </div>}
              <ul className={`emoji-grid seventv__grid${set.isFetching ? ' is-fetching' : ''}`}>
                {current.emotes.map((emote) => (
                  <EmoteTile key={emote.id} emote={emote} actions={actions} picked={picked.has(emote.id)}
                    onPick={canImport ? () => toggle(emote) : undefined} />
                ))}
              </ul>
              {pages > 1 && <Pager page={page} pages={pages} onPage={setPage} />}
            </>
          )}
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ pieces */

type TileActions = {
  packMode: boolean;
  packs: EmojiPack[];
  packDisabled: boolean;
  serverDisabled: boolean;
  onPack: (emote: SevenTvEmote, pack: EmojiPack) => void;
  onServer: (emote: SevenTvEmote) => void;
};

const EmoteTile: React.FC<{ emote: SevenTvEmote; actions: TileActions; picked?: boolean; onPick?: () => void }> = ({
  emote, actions, picked, onPick,
}) => (
  <li className={`emoji-tile seventv__tile${picked ? ' is-kept' : ''}`}>
    {onPick && (
      <input type="checkbox" className="seventv__pick" checked={picked} onChange={onPick} aria-label={`Select :${emote.name}:`} />
    )}
    <img src={emote.preview_url} alt="" loading="lazy" />
    <span className="emoji-tile__name" title={emote.name}>:{emote.name}:</span>
    <a className="seventv__author" href={emote.page_url} target="_blank" rel="noreferrer" title="View on 7TV">
      {emote.author ? `by ${emote.author}` : '7TV'} <ExternalLink aria-hidden="true" />
    </a>
    <span className="emoji-tile__actions">
      {actions.packMode && (
        <PackPicker label={`Add :${emote.name}: to a pack`} packs={actions.packs} disabled={actions.packDisabled}
          onPick={(pack) => actions.onPack(emote, pack)} />
      )}
      <button type="button" className="server-images-icon-btn" disabled={actions.serverDisabled}
        aria-label={`Add :${emote.name}: to the server`} title="Add to server now" onClick={() => actions.onServer(emote)}>
        <Send aria-hidden="true" />
      </button>
    </span>
  </li>
);

const Pager: React.FC<{ page: number; pages: number; onPage: (page: number) => void }> = ({ page, pages, onPage }) => (
  <nav className="seventv__pager" aria-label="7TV pages">
    <button type="button" className="server-images-icon-btn" disabled={page <= 1} aria-label="Previous page" onClick={() => onPage(page - 1)}>
      <ChevronLeft aria-hidden="true" />
    </button>
    <span>Page {page} of {pages}</span>
    <button type="button" className="server-images-icon-btn" disabled={page >= pages} aria-label="Next page" onClick={() => onPage(page + 1)}>
      <ChevronRight aria-hidden="true" />
    </button>
  </nav>
);
