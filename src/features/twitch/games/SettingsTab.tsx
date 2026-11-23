/** Per-game settings cards (§12.5 Settings: `games`). Each card owns its fields; the page owns saving. */
import React from 'react';
import { NumberInput } from '@/components/ui';
import { DurationInput, Field, Switch } from '../shared/ui';
import {
  EMOTE_RE, GAME_LIMITS, RULES, SLOT_SYMBOLS, linesOf, listText,
  type GameCommon, type GamesSettings,
} from './model';

interface Props {
  form: GamesSettings;
  disabled: boolean;
  currency: string;
  onChange: (patch: Partial<GamesSettings>) => void;
  issuesFor: (path: string) => string[];
}

interface CardProps {
  id: string;
  title: string;
  rules: string;
  enabled: boolean;
  disabled: boolean;
  onEnabled: (enabled: boolean) => void;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ id, title, rules, enabled, disabled, onEnabled, children }) => (
  <section className="tw-games-card" aria-labelledby={`tw-games-${id}`}>
    <div className="tw-games-card__header">
      <div>
        <h2 id={`tw-games-${id}`} className="tw-games-card__title">{title}</h2>
        <p className="tw-muted">{rules}</p>
      </div>
      <Switch label={`${title} enabled`} checked={enabled} disabled={disabled} onChange={onEnabled} />
    </div>
    {children && <div className="tw-games-card__grid">{children}</div>}
  </section>
);

interface NumberFieldProps {
  label: string; help?: string; value: number; min: number; max: number; step?: number; disabled: boolean; error?: string;
  onValue: (value: number) => void;
}
const NumberField: React.FC<NumberFieldProps> = ({ label, help, value, min, max, step, disabled, error, onValue }) => (
  <Field label={label} help={help} error={error}>
    {(control) => <NumberInput {...control} className="form-control" min={min} max={max} step={step} value={value}
      disabled={disabled} onValueChange={onValue} />}
  </Field>
);

export const SettingsTab: React.FC<Props> = ({ form, disabled, currency, onChange, issuesFor }) => {
  const err = (path: string) => issuesFor(`games.${path}`)[0];
  const common = <K extends 'gamble' | 'roulette' | 'slots' | 'duel' | 'heist'>(key: K) => {
    const game = form[key] as GameCommon;
    const patch = (next: Partial<GameCommon>) => onChange({ [key]: { ...form[key], ...next } } as Partial<GamesSettings>);
    return (
      <>
        <NumberField label={`Smallest bet (${currency})`} value={game.min_bet} min={1} max={1_000_000_000}
          disabled={disabled} error={err(`${key}.min_bet`)} onValue={(min_bet) => patch({ min_bet })} />
        <NumberField label={`Largest bet (${currency})`} value={game.max_bet} min={1} max={1_000_000_000}
          disabled={disabled} error={err(`${key}.max_bet`)} onValue={(max_bet) => patch({ max_bet })} />
        <div className="tw-games-card__switch">
          <Switch label="Allow all-in bets" description="Viewers can bet “all” or 100% of their balance." checked={game.allow_all_in}
            disabled={disabled} onChange={(allow_all_in) => patch({ allow_all_in })} />
        </div>
      </>
    );
  };
  const set = <K extends keyof GamesSettings>(key: K, next: Partial<GamesSettings[K]>) =>
    onChange({ [key]: { ...form[key], ...next } } as Partial<GamesSettings>);

  return (
    <div className="tw-games-stack">
      <Card id="gamble" title="Gamble" rules={RULES.gamble} enabled={form.gamble.enabled} disabled={disabled}
        onEnabled={(enabled) => set('gamble', { enabled })}>
        <NumberField label="Win chance (%)" help="48% is the default. At 48% the house keeps 4% of every bet."
          value={form.gamble.win_chance_percent} min={1} max={95} disabled={disabled}
          error={err('gamble.win_chance_percent')} onValue={(win_chance_percent) => set('gamble', { win_chance_percent })} />
        {common('gamble')}
      </Card>

      <Card id="roulette" title="Roulette" rules={RULES.roulette} enabled={form.roulette.enabled} disabled={disabled}
        onEnabled={(enabled) => set('roulette', { enabled })}>
        {common('roulette')}
      </Card>

      <Card id="slots" title="Slots" rules={RULES.slots} enabled={form.slots.enabled} disabled={disabled}
        onEnabled={(enabled) => set('slots', { enabled })}>
        {common('slots')}
        <fieldset className="tw-games-card__symbols">
          <legend>Symbols</legend>
          {SLOT_SYMBOLS.map((name) => (
            <Field key={name} label={name[0].toUpperCase() + name.slice(1)} error={err(`slots.symbols.${name}`)}>
              {(control) => (
                <input {...control} className="form-control" maxLength={25} value={form.slots.symbols?.[name] ?? ''}
                  disabled={disabled}
                  onChange={(event) => set('slots', { symbols: { ...form.slots.symbols, [name]: event.target.value } })} />
              )}
            </Field>
          ))}
        </fieldset>
      </Card>

      <Card id="duel" title="Duel" rules={RULES.duel} enabled={form.duel.enabled} disabled={disabled}
        onEnabled={(enabled) => set('duel', { enabled })}>
        <DurationInput label="Time to accept" seconds={form.duel.accept_seconds} min={10} max={600} units={['s']}
          disabled={disabled} onChange={(accept_seconds) => set('duel', { accept_seconds })} />
        <NumberField label="Fee (%)" help="Taken from the winner's payout. 0 means the winner takes both bets."
          value={form.duel.fee_percent} min={0} max={20} disabled={disabled} error={err('duel.fee_percent')}
          onValue={(fee_percent) => set('duel', { fee_percent })} />
        {common('duel')}
      </Card>

      <Card id="heist" title="Heist" rules={RULES.heist} enabled={form.heist.enabled} disabled={disabled}
        onEnabled={(enabled) => set('heist', { enabled })}>
        <DurationInput label="Lobby time" seconds={form.heist.lobby_seconds} min={30} max={600} units={['s']}
          disabled={disabled} onChange={(lobby_seconds) => set('heist', { lobby_seconds })} />
        <NumberField label="Fewest players" help="With fewer, everyone gets their bet back."
          value={form.heist.min_players} min={1} max={100} disabled={disabled} error={err('heist.min_players')}
          onValue={(min_players) => set('heist', { min_players })} />
        <DurationInput label="Wait between heists" seconds={form.heist.cooldown_s} min={0} max={7200} units={['s', 'm']}
          disabled={disabled} onChange={(cooldown_s) => set('heist', { cooldown_s })} />
        {common('heist')}
      </Card>

      <Card id="raffle" title="Raffle" rules={RULES.raffle} enabled={form.raffle.enabled} disabled={disabled}
        onEnabled={(enabled) => set('raffle', { enabled })}>
        <NumberField label={`Default prize (${currency})`} value={form.raffle.default_amount} min={1} max={10_000_000}
          disabled={disabled} error={err('raffle.default_amount')} onValue={(default_amount) => set('raffle', { default_amount })} />
        <NumberField label={`Largest prize (${currency})`} value={form.raffle.max_amount} min={1} max={1_000_000_000}
          disabled={disabled} error={err('raffle.max_amount')} onValue={(max_amount) => set('raffle', { max_amount })} />
        <DurationInput label="Default length" seconds={form.raffle.default_duration_s} min={10} max={600} units={['s']}
          disabled={disabled} onChange={(default_duration_s) => set('raffle', { default_duration_s })} />
        <NumberField label="Most winners" value={form.raffle.max_winners} min={1} max={100} disabled={disabled}
          error={err('raffle.max_winners')} onValue={(max_winners) => set('raffle', { max_winners })} />
        <NumberField label="Subscriber luck" help="1 gives everyone the same chance. 2 makes a subscriber twice as likely to win."
          value={form.raffle.subscriber_luck} min={1} max={10} step={0.5} disabled={disabled} error={err('raffle.subscriber_luck')}
          onValue={(subscriber_luck) => set('raffle', { subscriber_luck })} />
      </Card>

      <Card id="eightball" title="8-ball" rules={RULES.eightball} enabled={form.eightball.enabled} disabled={disabled}
        onEnabled={(enabled) => set('eightball', { enabled })}>
        <Field label="Answers" help={`One per line, up to ${GAME_LIMITS.eightballAnswersMax} answers of ${GAME_LIMITS.eightballAnswerMax} characters.`}
          error={err('eightball.answers')}>
          {(control) => (
            <textarea {...control} className="form-control" rows={6} value={listText(form.eightball.answers)}
              disabled={disabled} onChange={(event) => set('eightball', { answers: linesOf(event.target.value) })} />
          )}
        </Field>
      </Card>

      <Card id="trivia" title="Trivia" rules={RULES.trivia} enabled={form.trivia.enabled} disabled={disabled}
        onEnabled={(enabled) => set('trivia', { enabled })}>
        <NumberField label={`Reward (${currency})`} value={form.trivia.reward} min={0} max={1_000_000} disabled={disabled}
          error={err('trivia.reward')} onValue={(reward) => set('trivia', { reward })} />
        <DurationInput label="Time to answer" seconds={form.trivia.answer_seconds} min={10} max={300} units={['s']}
          disabled={disabled} onChange={(answer_seconds) => set('trivia', { answer_seconds })} />
        <NumberField label="Ask automatically every (minutes)" help="0 means only when a moderator starts a question. Automatic questions are asked only while live."
          value={form.trivia.auto_interval_minutes} min={0} max={240} disabled={disabled}
          error={err('trivia.auto_interval_minutes')} onValue={(auto_interval_minutes) => set('trivia', { auto_interval_minutes })} />
        <div className="tw-games-card__switch">
          <Switch label="Forgive one typo" description="For answers of six or more characters, one wrong, missing or extra letter still counts."
            checked={form.trivia.fuzzy} disabled={disabled} onChange={(fuzzy) => set('trivia', { fuzzy })} />
        </div>
      </Card>

      <Card id="bingo" title="Bingo" rules={RULES.bingo} enabled={form.bingo.enabled} disabled={disabled}
        onEnabled={(enabled) => set('bingo', { enabled })}>
        <NumberField label={`Reward (${currency})`} value={form.bingo.reward} min={0} max={1_000_000} disabled={disabled}
          error={err('bingo.reward')} onValue={(reward) => set('bingo', { reward })} />
        <DurationInput label="Round length" seconds={form.bingo.duration_s} min={30} max={1800} units={['s', 'm']}
          disabled={disabled} onChange={(duration_s) => set('bingo', { duration_s })} />
        <DurationInput label="Hint every" seconds={form.bingo.hint_interval_s} min={0} max={600} units={['s', 'm']}
          disabled={disabled} help="0 turns hints off. The first hint is the first letter, the second is the length."
          onChange={(hint_interval_s) => set('bingo', { hint_interval_s })} />
        <Field label="Emotes" error={err('bingo.emotes') ?? (form.bingo.emotes.some((e) => !EMOTE_RE.test(e)) ? 'Each emote is one word.' : undefined)}
          help={`One per line, up to ${GAME_LIMITS.emotesMax}. Leave empty to use your channel's emotes.`}>
          {(control) => (
            <textarea {...control} className="form-control" rows={4} value={listText(form.bingo.emotes)} disabled={disabled}
              onChange={(event) => set('bingo', { emotes: linesOf(event.target.value) })} />
          )}
        </Field>
        <div className="tw-games-card__switch">
          <Switch label="Use channel emotes when the list is empty" checked={form.bingo.use_channel_emotes}
            disabled={disabled} onChange={(use_channel_emotes) => set('bingo', { use_channel_emotes })} />
        </div>
      </Card>

      <Card id="contests" title="Betting contests" rules={RULES.contests} enabled={form.contests.enabled} disabled={disabled}
        onEnabled={(enabled) => set('contests', { enabled })}>
        <NumberField label={`Smallest bet (${currency})`} value={form.contests.min_bet} min={1} max={1_000_000_000}
          disabled={disabled} error={err('contests.min_bet')} onValue={(min_bet) => set('contests', { min_bet })} />
        <NumberField label={`Largest bet (${currency})`} value={form.contests.max_bet} min={1} max={1_000_000_000}
          disabled={disabled} error={err('contests.max_bet')} onValue={(max_bet) => set('contests', { max_bet })} />
        <NumberField label="Most options" value={form.contests.max_options} min={2} max={10} disabled={disabled}
          error={err('contests.max_options')} onValue={(max_options) => set('contests', { max_options })} />
      </Card>
    </div>
  );
};
