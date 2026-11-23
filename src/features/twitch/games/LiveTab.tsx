/**
 * Live controls (§12.5.9): start a raffle, trivia question, bingo or contest, and manage what is
 * running. Everything here is an action the bot carries out; the page never moves points itself.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui';
import { showToast } from '@/utils/toast';
import {
  EmptyState,
  Field,
  StatusChip,
  formatNumber,
  isTwitchApiError,
  tk,
  twitchErrorMessage,
  twitchRetry,
  useChannelMutation,
} from '../shared/ui';
import { gamesApi } from './api';
import {
  EMPTY_CONTEST_DRAFT, GAME_LABELS, GAME_LIMITS, STATUS_LABELS, bingoRequest, contestOptions, contestRequest,
  describeActionFailure, describeStakes, isActiveRound, raffleRequest, roundTitle, triviaRequest,
  type ActionRequest, type GameRound, type GamesSettings,
} from './model';

interface Props { channelId: string; settings: GamesSettings; currency: string }

type Pending =
  | { kind: 'cancel'; round: GameRound }
  | { kind: 'refund'; round: GameRound }
  | { kind: 'resolve'; round: GameRound; option: number }
  | null;

export const LiveTab: React.FC<Props> = ({ channelId, settings, currency }) => {
  const [raffle, setRaffle] = useState({ amount: String(settings.raffle.default_amount), seconds: String(settings.raffle.default_duration_s), winners: '1' });
  const [questionId, setQuestionId] = useState('');
  const [reward, setReward] = useState('');
  const [contest, setContest] = useState(EMPTY_CONTEST_DRAFT);
  const [problem, setProblem] = useState<{ game: string; text: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [resolveChoice, setResolveChoice] = useState<Record<number, number>>({});

  const rounds = useQuery({
    queryKey: tk(channelId, 'games', 'active'),
    queryFn: () => gamesApi.rounds(channelId, ''),
    retry: twitchRetry,
    refetchInterval: 5_000,
  });
  const questions = useQuery({
    queryKey: tk(channelId, 'games', 'questions'),
    queryFn: () => gamesApi.questions(channelId),
    retry: twitchRetry,
  });
  const active = (rounds.data?.items ?? []).filter(isActiveRound);

  const act = useChannelMutation({
    mutationFn: (request: ActionRequest) => gamesApi.act(channelId, request),
    invalidate: [tk(channelId, 'games', 'active'), tk(channelId, 'games', 'rounds')],
    errorMessage: false,
    onSuccess: () => { setPending(null); setProblem(null); },
    onError: (error) => {
      setPending(null);
      const code = isTwitchApiError(error) ? error.code : undefined;
      showToast(describeActionFailure(code, twitchErrorMessage(error, 'The bot could not do that.')), 'error');
    },
  });

  const run = (game: string, request: ActionRequest | string, success: string) => {
    if (typeof request === 'string') { setProblem({ game, text: request }); return; }
    setProblem(null);
    act.mutate(request, { onSuccess: () => showToast(success, 'success') });
  };

  const maxOptions = Math.min(settings.contests.max_options, GAME_LIMITS.contestOptionsMax);
  const enabledQuestions = (questions.data?.items ?? []).filter((q) => q.enabled);
  const off = (enabled: boolean) => (enabled ? null : <p className="tw-muted">Turned off in Settings. Turn it on there first.</p>);
  const issue = (game: string) => (problem?.game === game ? <p className="tw-games-problem" role="alert">{problem.text}</p> : null);

  return (
    <div className="tw-games-stack">
      <section className="tw-games-card" aria-labelledby="tw-games-running">
        <h2 id="tw-games-running" className="tw-games-card__title">Running now</h2>
        {rounds.isPending ? <p className="tw-muted">Loading…</p> : rounds.isError ? (
          <p className="tw-games-problem" role="alert">The running rounds did not load. {twitchErrorMessage(rounds.error)}</p>
        ) : active.length === 0 ? (
          <EmptyState title="Nothing is running" description="Start a game below, or viewers can start a duel or a heist from chat." />
        ) : (
          <ul className="tw-games-rounds">
            {active.map((round) => {
              const options = contestOptions(round);
              const choice = resolveChoice[round.id] ?? 1;
              return (
                <li key={round.id} className="tw-games-round">
                  <div className="tw-games-round__head">
                    <strong>{GAME_LABELS[round.game]}: {roundTitle(round)}</strong>
                    <StatusChip tone="active">{STATUS_LABELS[round.status]}</StatusChip>
                  </div>
                  <p className="tw-muted">{describeStakes(round, currency)}</p>
                  <div className="tw-games-round__actions">
                    {round.game === 'contest' && round.status === 'open' && (
                      <button type="button" className="btn" disabled={act.isPending}
                        onClick={() => run('round', { action: 'contest_close', params: { round_id: round.id } }, 'Betting closed')}>
                        Close betting
                      </button>
                    )}
                    {round.game === 'contest' && (
                      <>
                        <Field label="Winning option" hideLabel>
                          {(control) => (
                            <select {...control} className="form-select" value={choice}
                              onChange={(event) => setResolveChoice({ ...resolveChoice, [round.id]: Number(event.target.value) })}>
                              {options.map((label, index) => <option key={index} value={index + 1}>{index + 1}. {label}</option>)}
                            </select>
                          )}
                        </Field>
                        <button type="button" className="btn primary" disabled={act.isPending}
                          onClick={() => setPending({ kind: 'resolve', round, option: choice })}>
                          Pay out winners
                        </button>
                        <button type="button" className="btn" disabled={act.isPending} onClick={() => setPending({ kind: 'refund', round })}>
                          Refund all bets
                        </button>
                      </>
                    )}
                    {round.game !== 'contest' && (
                      <button type="button" className="btn" disabled={act.isPending} onClick={() => setPending({ kind: 'cancel', round })}>
                        Cancel round
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {issue('round')}
      </section>

      <section className="tw-games-card" aria-labelledby="tw-games-raffle">
        <h2 id="tw-games-raffle" className="tw-games-card__title">Raffle</h2>
        <p className="tw-muted">Viewers type !join to enter. The winners receive the prize as new {currency}.</p>
        {off(settings.raffle.enabled)}
        <div className="tw-games-card__grid">
          <Field label={`Prize (${currency})`}>
            {(control) => <input {...control} className="form-control" inputMode="numeric" value={raffle.amount}
              onChange={(event) => setRaffle({ ...raffle, amount: event.target.value })} />}
          </Field>
          <Field label="Length (seconds)">
            {(control) => <input {...control} className="form-control" inputMode="numeric" value={raffle.seconds}
              onChange={(event) => setRaffle({ ...raffle, seconds: event.target.value })} />}
          </Field>
          <Field label="Winners">
            {(control) => <input {...control} className="form-control" inputMode="numeric" value={raffle.winners}
              onChange={(event) => setRaffle({ ...raffle, winners: event.target.value })} />}
          </Field>
        </div>
        {issue('raffle')}
        <div className="tw-games-card__footer">
          <button type="button" className="btn primary" disabled={act.isPending || !settings.raffle.enabled}
            onClick={() => run('raffle', raffleRequest(raffle, { maxAmount: settings.raffle.max_amount, maxWinners: settings.raffle.max_winners }), 'Raffle started')}>
            Start raffle
          </button>
        </div>
      </section>

      <section className="tw-games-card" aria-labelledby="tw-games-trivia">
        <h2 id="tw-games-trivia" className="tw-games-card__title">Trivia</h2>
        <p className="tw-muted">Asks one question from your bank. The first correct answer in chat wins {formatNumber(settings.trivia.reward)} {currency}.</p>
        {off(settings.trivia.enabled)}
        <Field label="Question" help="Leave on “Random” to pick one that was not asked lately.">
          {(control) => (
            <select {...control} className="form-select" value={questionId} onChange={(event) => setQuestionId(event.target.value)}>
              <option value="">Random</option>
              {enabledQuestions.map((q) => <option key={q.id} value={q.id}>{q.question.slice(0, 80)}</option>)}
            </select>
          )}
        </Field>
        {questions.isSuccess && enabledQuestions.length === 0 && <p className="tw-muted">No enabled questions yet. Add some on the Trivia questions tab.</p>}
        <div className="tw-games-card__footer">
          <button type="button" className="btn primary" disabled={act.isPending || !settings.trivia.enabled}
            onClick={() => run('trivia', triviaRequest(questionId), 'Question asked')}>
            Ask a question
          </button>
        </div>
      </section>

      <section className="tw-games-card" aria-labelledby="tw-games-bingo">
        <h2 id="tw-games-bingo" className="tw-games-card__title">Bingo</h2>
        <p className="tw-muted">Hides one emote. The first message with it wins. Default reward {formatNumber(settings.bingo.reward)} {currency}.</p>
        {off(settings.bingo.enabled)}
        <Field label={`Reward (${currency})`} optional help="Leave empty for the default reward.">
          {(control) => <input {...control} className="form-control" inputMode="numeric" value={reward}
            onChange={(event) => setReward(event.target.value)} />}
        </Field>
        {issue('bingo')}
        <div className="tw-games-card__footer">
          <button type="button" className="btn primary" disabled={act.isPending || !settings.bingo.enabled}
            onClick={() => run('bingo', bingoRequest(reward), 'Bingo started')}>
            Start bingo
          </button>
        </div>
      </section>

      <section className="tw-games-card" aria-labelledby="tw-games-contest">
        <h2 id="tw-games-contest" className="tw-games-card__title">Betting contest</h2>
        <p className="tw-muted">Viewers bet with !bet &lt;number&gt; &lt;amount&gt;. When you pick the winning option, the winners share all the bets.</p>
        {off(settings.contests.enabled)}
        <Field label="Title">
          {(control) => <input {...control} className="form-control" maxLength={GAME_LIMITS.contestTitleMax} value={contest.title}
            onChange={(event) => setContest({ ...contest, title: event.target.value })} />}
        </Field>
        <div className="tw-games-options">
          {contest.options.map((option, index) => (
            <div key={index} className="tw-games-options__row">
              <Field label={`Option ${index + 1}`}>
                {(control) => <input {...control} className="form-control" maxLength={GAME_LIMITS.contestOptionMax} value={option}
                  onChange={(event) => setContest({ ...contest, options: contest.options.map((o, i) => (i === index ? event.target.value : o)) })} />}
              </Field>
              {contest.options.length > 2 && (
                <button type="button" className="btn tw-games-icon-btn" aria-label={`Remove option ${index + 1}`}
                  onClick={() => setContest({ ...contest, options: contest.options.filter((_, i) => i !== index) })}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="btn" disabled={contest.options.length >= maxOptions}
            onClick={() => setContest({ ...contest, options: [...contest.options, ''] })}>
            <Plus size={16} aria-hidden="true" /> Add option
          </button>
        </div>
        {issue('contest')}
        <div className="tw-games-card__footer">
          <button type="button" className="btn primary" disabled={act.isPending || !settings.contests.enabled}
            onClick={() => {
              const request = contestRequest(contest, settings.contests.max_options);
              run('contest', request, 'Contest opened');
              if (typeof request !== 'string') setContest(EMPTY_CONTEST_DRAFT);
            }}>
            Open contest
          </button>
        </div>
      </section>

      {pending && (
        <ConfirmDialog
          kicker={pending.kind === 'resolve' ? 'Pay out' : pending.kind === 'refund' ? 'Refund' : 'Cancel'}
          title={pending.kind === 'resolve' ? `Pay out option ${pending.option}?`
            : pending.kind === 'refund' ? 'Refund every bet?' : `Cancel this ${GAME_LABELS[pending.round.game].toLowerCase()}?`}
          confirmLabel={pending.kind === 'resolve' ? 'Pay out' : pending.kind === 'refund' ? 'Refund all' : 'Cancel round'}
          pending={act.isPending}
          onConfirm={() => run('round',
            pending.kind === 'resolve' ? { action: 'contest_resolve', params: { round_id: pending.round.id, option: pending.option } }
              : pending.kind === 'refund' ? { action: 'contest_refund', params: { round_id: pending.round.id } }
                : { action: 'cancel_round', params: { round_id: pending.round.id } },
            pending.kind === 'resolve' ? 'Winners paid' : 'Every stake was returned')}
          onClose={() => setPending(null)}
        >
          {pending.kind === 'resolve'
            ? <p>The winners share every bet. This cannot be undone. If nobody bet on that option, every bet is returned instead.</p>
            : <p>Every stake held by this round goes back to the viewer who placed it, once.</p>}
        </ConfirmDialog>
      )}
    </div>
  );
};
