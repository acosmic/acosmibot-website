import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Clock3, Gift, Pencil, RotateCcw, Search, ShieldCheck, XCircle } from 'lucide-react';
import {
  adminApi,
  type PremiumGrant,
  type PremiumGrantInput,
  type PremiumGrantSource,
  type PremiumGrantStatus,
  type PremiumGrantTier,
} from '@/api/admin';
import { PremiumTierIcon, PREMIUM_TIER_LABELS } from '@/components/ui';
import { showToast } from '@/utils/toast';

const SOURCES: Array<{ value: PremiumGrantSource; label: string }> = [
  { value: 'support_server', label: 'Support server' },
  { value: 'partner', label: 'Partner' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'giveaway', label: 'Giveaway' },
  { value: 'internal', label: 'Internal' },
  { value: 'test', label: 'Test' },
];

const FILTERS: Array<{ value: PremiumGrantStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' },
];

const localInputValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

const initialForm = (): PremiumGrantInput => {
  const now = new Date();
  const expiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    guild_id: '', tier: 'max', source: 'partner', reason: '',
    starts_at: localInputValue(now), expires_at: localInputValue(expiry),
  };
};

const formatDate = (value: string | null) => {
  if (!value) return 'Permanent';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

const sourceLabel = (value: PremiumGrantSource) =>
  SOURCES.find((source) => source.value === value)?.label ?? value;

export const PremiumGrantsTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<PremiumGrantStatus | 'all'>('active');
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search.trim());
  const [guildSearch, setGuildSearch] = React.useState('');
  const [form, setForm] = React.useState<PremiumGrantInput>(initialForm);
  const [permanent, setPermanent] = React.useState(false);
  const [editing, setEditing] = React.useState<PremiumGrant | null>(null);

  const grantsQuery = useQuery({
    queryKey: ['admin', 'premium-grants', status, deferredSearch],
    queryFn: () => adminApi.getPremiumGrants({ status, search: deferredSearch }),
    refetchInterval: 60_000,
    retry: false,
  });
  const guildsQuery = useQuery({
    queryKey: ['admin', 'guild-options'], queryFn: adminApi.getGuildOptions,
    staleTime: 60_000, retry: false,
  });

  const resetForm = () => {
    setEditing(null); setForm(initialForm()); setGuildSearch(''); setPermanent(false);
  };

  const saveMutation = useMutation({
    mutationFn: (payload: PremiumGrantInput) => editing
      ? adminApi.updatePremiumGrant(editing.id, payload)
      : adminApi.createPremiumGrant(payload),
    onSuccess: async () => {
      showToast(editing ? 'Complimentary grant updated.' : 'Complimentary grant created.', 'success');
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'premium-grants'] }),
        queryClient.invalidateQueries({ queryKey: ['guild'] }),
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
        queryClient.invalidateQueries({ queryKey: ['user', 'guilds'] }),
      ]);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Could not save the premium grant.', 'error'),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ grant, restore }: { grant: PremiumGrant; restore: boolean }) =>
      restore ? adminApi.restorePremiumGrant(grant.id) : adminApi.revokePremiumGrant(grant.id),
    onSuccess: async (_, variables) => {
      showToast(variables.restore ? 'Grant restored.' : 'Grant revoked.', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'premium-grants'] }),
        queryClient.invalidateQueries({ queryKey: ['guild'] }),
        queryClient.invalidateQueries({ queryKey: ['guilds'] }),
        queryClient.invalidateQueries({ queryKey: ['user', 'guilds'] }),
      ]);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : 'Could not update grant status.', 'error'),
  });

  const guilds = guildsQuery.data?.guilds ?? [];
  const visibleGuilds = guilds.filter((guild) => {
    const query = guildSearch.trim().toLowerCase();
    return !query || guild.name.toLowerCase().includes(query) || guild.id.includes(query);
  });

  const beginEdit = (grant: PremiumGrant) => {
    setEditing(grant);
    setPermanent(grant.expires_at === null);
    setGuildSearch(grant.guild_name ?? grant.guild_id);
    setForm({
      guild_id: grant.guild_id, tier: grant.tier, source: grant.source, reason: grant.reason,
      starts_at: localInputValue(grant.starts_at),
      expires_at: grant.expires_at ? localInputValue(grant.expires_at) : null,
    });
    document.querySelector('.grant-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.guild_id) return showToast('Choose a server for this grant.', 'error');
    if (!form.reason.trim()) return showToast('Add a private reason for the audit trail.', 'error');
    const startsAt = new Date(form.starts_at);
    const expiresAt = permanent || !form.expires_at ? null : new Date(form.expires_at);
    if (Number.isNaN(startsAt.getTime()) || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
      return showToast('Choose valid start and expiration dates.', 'error');
    }
    saveMutation.mutate({
      ...form, reason: form.reason.trim(), starts_at: startsAt.toISOString(),
      expires_at: expiresAt?.toISOString() ?? null,
    });
  };

  return (
    <div className="premium-grants">
      <section className="grant-editor" aria-labelledby="grant-editor-title">
        <header>
          <span className="grant-editor__mark"><Gift aria-hidden="true" /></span>
          <div>
            <p>{editing ? 'Edit entitlement' : 'New entitlement'}</p>
            <h3 id="grant-editor-title">{editing ? `Update ${editing.guild_name ?? editing.guild_id}` : 'Grant complimentary access'}</h3>
            <span>Private notes and actor IDs stay inside this owner-only control plane.</span>
          </div>
          {editing && <button type="button" className="grant-editor__cancel" onClick={resetForm}>Cancel edit</button>}
        </header>

        <form onSubmit={submit}>
          <div className="grant-field grant-field--server">
            <label htmlFor="grant-guild-search">Find server</label>
            <div className="grant-search-control"><Search aria-hidden="true" /><input
              id="grant-guild-search" type="search" value={guildSearch}
              onChange={(event) => {
                setGuildSearch(event.target.value);
                if (form.guild_id) setForm({ ...form, guild_id: '' });
              }}
              placeholder="Search name or Discord ID"
              disabled={guildsQuery.isLoading || saveMutation.isPending}
            /></div>
            <select aria-label="Server" value={form.guild_id}
              onChange={(event) => setForm({ ...form, guild_id: event.target.value })}
              disabled={guildsQuery.isLoading || saveMutation.isPending} required>
              <option value="">{guildsQuery.isLoading ? 'Loading servers…' : 'Select a server'}</option>
              {visibleGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name} · {guild.id}</option>)}
            </select>
            {guildsQuery.isError && <small role="alert">Servers could not be loaded. Refresh and try again.</small>}
          </div>
          <div className="grant-field"><label htmlFor="grant-tier">Tier</label><select id="grant-tier" value={form.tier} disabled={saveMutation.isPending} onChange={(event) => setForm({ ...form, tier: event.target.value as PremiumGrantTier })}>
            {(['plus', 'pro', 'max'] as const).map((tier) => <option key={tier} value={tier}>{PREMIUM_TIER_LABELS[tier]}</option>)}
          </select></div>
          <div className="grant-field"><label htmlFor="grant-source">Category</label><select id="grant-source" value={form.source} disabled={saveMutation.isPending} onChange={(event) => setForm({ ...form, source: event.target.value as PremiumGrantSource })}>
            {SOURCES.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select></div>
          <div className="grant-field"><label htmlFor="grant-start">Starts</label><input id="grant-start" type="datetime-local" value={form.starts_at} disabled={saveMutation.isPending} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} required /></div>
          <div className="grant-field grant-field--expiry">
            <div className="grant-field__label-row"><label htmlFor="grant-expiry">Expires</label><label className="grant-permanent"><input type="checkbox" checked={permanent} disabled={saveMutation.isPending} onChange={(event) => setPermanent(event.target.checked)} /> Permanent</label></div>
            <input id="grant-expiry" type="datetime-local" value={form.expires_at ?? ''} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} disabled={permanent || saveMutation.isPending} required={!permanent} />
          </div>
          <div className="grant-field grant-field--reason"><label htmlFor="grant-reason">Private reason</label><textarea id="grant-reason" value={form.reason} disabled={saveMutation.isPending} onChange={(event) => setForm({ ...form, reason: event.target.value })} maxLength={1000} rows={3} placeholder="What agreement or internal decision authorizes this access?" required /><small>{form.reason.length}/1000 · Never shown to server administrators</small></div>
          <button type="submit" className="grant-save" disabled={saveMutation.isPending || guildsQuery.isLoading}><Check aria-hidden="true" /> {saveMutation.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create grant'}</button>
        </form>
      </section>

      <section className="grant-ledger" aria-labelledby="grant-ledger-title">
        <header className="grant-ledger__header"><div><p>Entitlement ledger</p><h3 id="grant-ledger-title">Premium grants</h3></div><span>{grantsQuery.data?.total ?? 0} matching</span></header>
        <div className="grant-ledger__tools">
          <div className="grant-filters" role="group" aria-label="Filter grants">{FILTERS.map((filter) => <button key={filter.value} type="button" aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>)}</div>
          <label className="grant-ledger__search"><Search aria-hidden="true" /><span className="visually-hidden">Search grants</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search server, source, or note" /></label>
        </div>

        {grantsQuery.isLoading ? (
          <div className="grant-state" role="status"><Clock3 aria-hidden="true" /><strong>Loading grant history…</strong></div>
        ) : grantsQuery.isError ? (
          <div className="grant-state is-error" role="alert"><XCircle aria-hidden="true" /><div><strong>Grant history is unavailable.</strong><span>Refresh the module to try the owner API again.</span></div></div>
        ) : (grantsQuery.data?.grants.length ?? 0) === 0 ? (
          <div className="grant-state"><ShieldCheck aria-hidden="true" /><div><strong>No {status === 'all' ? '' : `${status} `}grants found.</strong><span>Create one above or change the ledger filter.</span></div></div>
        ) : (
          <div className="grant-records">{grantsQuery.data?.grants.map((grant) => (
            <article key={grant.id} className={`grant-record is-${grant.status}`}>
              <div className="grant-record__identity"><PremiumTierIcon tier={grant.tier} size={32} /><div><strong>{grant.guild_name ?? 'Unknown server'}</strong><span>{grant.guild_id}</span></div></div>
              <div className="grant-record__entitlement"><span className={`grant-status is-${grant.status}`}>{grant.status}</span><strong>{PREMIUM_TIER_LABELS[grant.tier]} · {sourceLabel(grant.source)}</strong><span><CalendarClock aria-hidden="true" /> {grant.status === 'scheduled' ? `Starts ${formatDate(grant.starts_at)}` : grant.expires_at ? `Ends ${formatDate(grant.expires_at)}` : 'Permanent access'}</span></div>
              <div className="grant-record__note"><span>Private note</span><p>{grant.reason}</p></div>
              <div className="grant-record__actions"><button type="button" onClick={() => beginEdit(grant)}><Pencil aria-hidden="true" /> Edit / extend</button>{grant.status === 'revoked' ? <button type="button" onClick={() => lifecycleMutation.mutate({ grant, restore: true })} disabled={lifecycleMutation.isPending}><RotateCcw aria-hidden="true" /> Restore</button> : <button type="button" className="is-danger" onClick={() => lifecycleMutation.mutate({ grant, restore: false })} disabled={lifecycleMutation.isPending}><XCircle aria-hidden="true" /> Revoke</button>}</div>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
};
