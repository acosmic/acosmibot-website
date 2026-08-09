import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Bot, CheckCircle2, CircleDollarSign, Gamepad2, Landmark,
  LoaderCircle, Medal, MessageSquareText, RefreshCw, ShieldCheck, Sparkles,
  Trophy, Users, WalletCards, X,
} from 'lucide-react';
import { aiCreditsApi, type CreditPack } from '@/api/aiCredits';
import { CreditCheckoutDialog } from '@/components/CreditCheckoutDialog';
import { PublicNav } from '@/components/layout/PublicNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { showToast } from '@/utils/toast';
import '@/styles/member-server-hub.css';

const format = (value: number | null | undefined) => new Intl.NumberFormat().format(value ?? 0);
const relativeTime = (value: string | null) => {
  if (!value) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
};

export const MemberServerHubPage: React.FC = () => {
  const { guildId = '' } = useParams<{ guildId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const purchaseId = searchParams.get('purchase');
  const canceled = searchParams.get('canceled') === 'true';
  const [selectedPack, setSelectedPack] = React.useState<CreditPack | null>(null);

  const hub = useQuery({ queryKey: ['member-hub', guildId], queryFn: () => aiCreditsApi.getMemberHub(guildId), retry: false });
  const catalog = useQuery({ queryKey: ['ai-credits', 'catalog'], queryFn: aiCreditsApi.getCatalog, staleTime: 300_000, retry: false });
  const contributions = useQuery({
    queryKey: ['member-hub', guildId, 'contributions'],
    queryFn: () => aiCreditsApi.getGuildContributions(guildId),
    enabled: Boolean(hub.data?.ai_fuel.public_log_enabled),
    retry: false,
  });
  const purchase = useQuery({
    queryKey: ['ai-credits', 'purchase', purchaseId], queryFn: () => aiCreditsApi.getPurchase(purchaseId!),
    enabled: Boolean(purchaseId), retry: false,
    refetchInterval: (query) => ['pending', 'processing', 'checkout_created'].includes(query.state.data?.purchase.status ?? '') ? 2500 : false,
  });

  React.useEffect(() => {
    if (purchase.data?.purchase.status !== 'fulfilled') return;
    void queryClient.invalidateQueries({ queryKey: ['member-hub', guildId] });
    void queryClient.invalidateQueries({ queryKey: ['member-hub', guildId, 'contributions'] });
  }, [guildId, purchase.data?.purchase.status, queryClient]);

  const checkout = useMutation({
    mutationFn: ({ pack, anonymous }: { pack: CreditPack; anonymous: boolean }) => aiCreditsApi.createGuildContribution(guildId, {
      pack_sku: pack.sku, anonymous, accepted_terms_version: catalog.data?.catalog.terms_version ?? '',
    }),
    onSuccess: ({ checkout_url }) => window.location.assign(checkout_url),
    onError: (error) => showToast(error instanceof Error ? error.message : 'Could not open AI Credits Checkout.', 'error'),
  });

  if (hub.isLoading) return <HubState icon={<LoaderCircle className="member-hub__spinner" />} title="Reading this server’s signal…" />;
  if (hub.error || !hub.data) return <HubState icon={<RefreshCw />} title="This server could not be opened" detail="Discord membership could not be verified or the server is unavailable." retry={() => void hub.refetch()} />;

  const data = hub.data;
  const purchaseStatus = purchase.data?.purchase;
  const canContribute = data.ai_fuel.contributions_enabled && data.ai_fuel.sales_enabled && (catalog.data?.catalog.packs.length ?? 0) > 0;
  const packs = catalog.data?.catalog.packs.filter((pack) => pack.active) ?? [];

  return (
    <div className="member-hub">
      <PublicNav variant="observatory" />
      <main className="member-hub__main">
        <section className="member-hub__hero" aria-labelledby="member-hub-title">
          <div className="member-hub__hero-signal" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="member-hub__kicker">Member station · {format(data.guild.member_count)} members</p>
            <h1 id="member-hub-title">{data.guild.name}</h1>
            <p>Follow the community pulse, see your place in the field, and keep the AI Fuel Reserve ready for the next burst.</p>
          </div>
          <div className="member-hub__hero-actions">
            <a href="#fuel" className="member-hub__primary"><Sparkles aria-hidden="true" /> {canContribute ? 'Contribute AI Credits' : 'View AI Fuel'}</a>
            <Link to={`/leaderboard/${guildId}`} className="member-hub__quiet">View leaderboard <ArrowRight aria-hidden="true" /></Link>
            {data.is_admin && <Link to={`/server/${guildId}/overview`} className="member-hub__manage"><ShieldCheck aria-hidden="true" /> Manage server</Link>}
          </div>
        </section>

        {(canceled || purchaseStatus) && (
          <section className={`member-hub__purchase is-${purchaseStatus?.status ?? 'canceled'}`} role="status" aria-live="polite">
            <div><CheckCircle2 aria-hidden="true" /><div><strong>{purchaseStatus?.status === 'fulfilled' ? 'Fuel Cell delivered to the server.' : canceled ? 'Checkout canceled.' : `Checkout ${purchaseStatus?.status.replace(/_/g, ' ') ?? 'in progress'}.`}</strong><span>{purchaseStatus?.status === 'fulfilled' ? `${format(purchaseStatus.granted_credits)} AI Credits were added to ${data.guild.name}.` : 'No server credits are added until Stripe confirms payment.'}</span></div></div>
            <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('purchase'); next.delete('canceled'); setSearchParams(next, { replace: true }); }} aria-label="Dismiss checkout status"><X aria-hidden="true" /></button>
          </section>
        )}

        <section className="member-hub__your-place" aria-labelledby="your-place-title">
          <header><p className="member-hub__kicker">Your place</p><h2 id="your-place-title">{data.viewer.display_name}, you’re part of the signal.</h2></header>
          <div className="member-hub__personal-grid">
            <Metric icon={<Medal />} label="Server rank" value={data.viewer.rank ? `#${data.viewer.rank}` : '—'} detail={`Level ${format(data.viewer.level)} · ${format(data.viewer.exp)} XP`} />
            <Metric icon={<CircleDollarSign />} label="Server balance" value={format(data.viewer.currency)} detail="Available in this community" />
            <Metric icon={<Trophy />} label="Achievements" value={format(data.viewer.achievements)} detail="Unlocked across Acosmibot" />
            <Metric icon={<Gamepad2 />} label="Game record" value={format(data.viewer.games.total_games)} detail={`${format(data.viewer.games.wins)} wins · ${data.viewer.games.win_rate}% win rate`} />
          </div>
        </section>

        <div className="member-hub__content-grid">
          <section className="member-hub__pulse" aria-labelledby="pulse-title">
            <header><p className="member-hub__kicker">Community pulse</p><h2 id="pulse-title">The shared activity field.</h2></header>
            <div className="member-hub__pulse-grid">
              <Metric icon={<Users />} label="Active members" value={format(data.community.active_members)} detail="Members with a current server record" />
              <Metric icon={<MessageSquareText />} label="Messages" value={format(data.community.messages)} detail="Recorded community messages" />
              <Metric icon={<Gamepad2 />} label="Games played" value={format(data.community.games)} detail="Across the community" />
              <Metric icon={<Landmark />} label="Guild vault" value={format(data.guild.vault_currency)} detail="Shared economy balance" />
            </div>
          </section>

          <section className="member-hub__leaders" aria-labelledby="leaders-title">
            <header><p className="member-hub__kicker">Leaderboard preview</p><h2 id="leaders-title">Top of the field.</h2></header>
            {data.leaderboard.length ? <ol>{data.leaderboard.map((entry) => <li key={entry.user_id}><span className="member-hub__rank">#{entry.rank}</span>{entry.avatar_url ? <img src={entry.avatar_url} alt="" /> : <span className="member-hub__avatar" aria-hidden="true">{(entry.display_name || '?').slice(0, 1)}</span>}<div><strong>{entry.display_name || 'Community member'}</strong><span>Level {format(entry.level)} · {format(entry.exp)} XP</span></div></li>)}</ol> : <Empty copy="The first leaderboard entry will appear as members earn XP." />}
            <Link to={`/leaderboard/${guildId}`} className="member-hub__section-link">View full leaderboard <ArrowRight aria-hidden="true" /></Link>
          </section>
        </div>

        <section id="fuel" className="member-hub__fuel" aria-labelledby="fuel-title">
          <header><div><p className="member-hub__kicker">AI Fuel Reserve</p><h2 id="fuel-title">Keep shared AI ready.</h2><p>The server-owned reserve funds eligible AI requests after included plan allowance. Personal wallets and member prompt activity stay private.</p></div><span className={data.ai_fuel.server_pool_enabled ? 'member-hub__status is-on' : 'member-hub__status'}>{data.ai_fuel.server_pool_enabled ? 'Server-funded AI enabled' : 'Server-funded AI off'}</span></header>
          <div className="member-hub__fuel-grid">
            <div className="member-hub__fuel-readout"><WalletCards aria-hidden="true" /><span>Available</span><strong>{format(data.ai_fuel.wallet.available_credits)}</strong><small>AI Credits</small></div>
            <div><span>Reserved</span><strong>{format(data.ai_fuel.wallet.reserved_credits)}</strong><small>Active requests</small></div>
            <div><span>30-day usage</span><strong>{format(data.ai_fuel.usage.total_credits)}</strong><small>{format(data.ai_fuel.usage.total_calls)} eligible calls</small></div>
          </div>
          {canContribute ? <div className="member-hub__packs" aria-label="Fuel Cell contribution packs">{packs.map((pack) => <button type="button" className={pack.sku === 'fuel_cell_25k' ? 'is-power' : pack.sku === 'fuel_cell_10k' ? 'is-standard' : undefined} key={pack.sku} onClick={() => setSelectedPack(pack)}><span>{pack.name}</span><strong>{format(pack.credits)} credits</strong><small>{new Intl.NumberFormat('en-US', { style: 'currency', currency: pack.currency.toUpperCase() }).format(pack.amount_cents / 100)}</small><ArrowRight aria-hidden="true" /></button>)}</div> : <div className="member-hub__fuel-disabled"><Bot aria-hidden="true" /><div><strong>{data.ai_fuel.contributions_enabled ? 'Fuel Cells are paused' : 'This server is not accepting contributions'}</strong><span>{data.ai_fuel.contributions_enabled ? 'Sales will appear here when AI Credit checkout is enabled.' : 'An administrator can reopen member contributions when the community is ready.'}</span></div></div>}
        </section>

        {data.ai_fuel.public_log_enabled && <section className="member-hub__boosts" aria-labelledby="boost-log-title"><header><div><p className="member-hub__kicker">Server Boost Log</p><h2 id="boost-log-title">Fuel supplied by the community.</h2></div><span>Names are optional · refunds remain visible</span></header>{contributions.isLoading ? <div className="member-hub__log-loading"><LoaderCircle className="member-hub__spinner" /> Reading recent boosts…</div> : contributions.error ? <Empty copy="The boost log is unavailable right now. Try refreshing this server." /> : contributions.data?.entries.length ? <ol>{contributions.data.entries.map((entry, index) => <li key={`${entry.created_at ?? 'recent'}-${entry.pack_sku}-${index}`} className={entry.status !== 'fulfilled' ? 'is-reversed' : ''}>{entry.avatar_url ? <img src={entry.avatar_url} alt="" /> : <span className="member-hub__avatar" aria-hidden="true">{entry.anonymous ? 'A' : entry.display_name.slice(0, 1)}</span>}<div><strong>{entry.display_name}</strong><span>{entry.pack_name} · {format(entry.credits)} AI Credits · {relativeTime(entry.created_at)}</span></div>{entry.status !== 'fulfilled' && <em>{entry.status.replace(/_/g, ' ')}</em>}</li>)}</ol> : <Empty copy="The first Fuel Cell contribution will appear here." />}</section>}
      </main>
      <SiteFooter />
      {selectedPack && <CreditCheckoutDialog pack={selectedPack} currency={catalog.data?.catalog.currency ?? 'usd'} targetLabel={data.guild.name} targetType="guild" termsVersion={catalog.data?.catalog.terms_version ?? ''} contribution isPending={checkout.isPending} onClose={() => setSelectedPack(null)} onConfirm={(anonymous) => checkout.mutate({ pack: selectedPack, anonymous })} />}
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; detail: string }> = ({ icon, label, value, detail }) => <div className="member-hub__metric"><span className="member-hub__metric-icon" aria-hidden="true">{icon}</span><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
const Empty: React.FC<{ copy: string }> = ({ copy }) => <p className="member-hub__empty">{copy}</p>;
const HubState: React.FC<{ icon: React.ReactNode; title: string; detail?: string; retry?: () => void }> = ({ icon, title, detail, retry }) => <div className="member-hub"><PublicNav variant="observatory" /><main className="member-hub__main"><section className="member-hub__state" role="status">{icon}<h1>{title}</h1>{detail && <p>{detail}</p>}{retry && <button type="button" onClick={retry}>Try again</button>}</section></main><SiteFooter /></div>;

export default MemberServerHubPage;
