import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVariation,
  addWords,
  alertForApi,
  alertSettingsQueryKey,
  alertsQueryKey,
  animationNames,
  apiField,
  applyFields,
  changeConditionType,
  conditionFromInput,
  conditionInput,
  conditionProblem,
  conditionTypesFor,
  defaultCondition,
  defaultGeneral,
  defaultLook,
  defaultsPreviewConfig,
  describeCondition,
  draftPreviewConfig,
  fieldScope,
  generalSettingsPart,
  kindsFor,
  MAX_VARIATIONS,
  menuGroups,
  moveVariation,
  newVariationId,
  normalizeAlert,
  normalizeGeneral,
  normalizeLook,
  parseView,
  previewGeneral,
  removeVariation,
  resolveAlert,
  resolveLook,
  sameAlert,
  sameDefaults,
  sameGeneralSettings,
  savedPreviewConfig,
  settleView,
  updateVariation,
  validateAlert,
  validateGeneral,
  viewLabel,
  viewParam,
} from '../src/utils/streamAlertBox.ts';

const asset = (id: number, kind: string, extra: Record<string, unknown> = {}) => ({
  id, kind, status: 'ready', url: `https://media.test/${id}`, width: 800, height: 600, duration_ms: kind === 'video' ? 6000 : null,
  has_alpha: false, has_audio: kind === 'video', font_family: kind === 'font' ? 'Fancy' : null, ...extra,
}) as never;
const library = [asset(12, 'video'), asset(13, 'image'), asset(14, 'sound'), asset(15, 'font'), asset(16, 'video', { status: 'processing', url: null })];
/** A random source that walks through fixed values, so ids are predictable. */
const walk = (...values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

test('query keys carry the account id', () => {
  assert.deepEqual(alertsQueryKey(3), ['stream-alerts', 3, 'alerts']);
  assert.deepEqual(alertSettingsQueryKey(7), ['stream-alerts', 7, 'alert-settings']);
});

test('the view parameter names a page, a kind or a variation, and anything else is General settings', () => {
  assert.deepEqual(parseView(null, { legacy: false }), { page: 'general' });
  assert.deepEqual(parseView('activity', { legacy: false }), { page: 'activity' });
  assert.deepEqual(parseView('channel-points', { legacy: false }), { page: 'channel-points' });
  assert.deepEqual(parseView('follow', { legacy: false }), { page: 'alert', kind: 'follow', variation: null });
  assert.deepEqual(parseView('cheer:v_3fa9c1d2', { legacy: false }), { page: 'alert', kind: 'cheer', variation: 'v_3fa9c1d2' });
  // A broken variation id opens the kind; extra parts or unknown names open General settings.
  assert.deepEqual(parseView('cheer:v_XYZ', { legacy: false }), { page: 'alert', kind: 'cheer', variation: null });
  assert.deepEqual(parseView('cheer:v_3fa9c1d2:x', { legacy: false }), { page: 'general' });
  assert.deepEqual(parseView('nonsense', { legacy: false }), { page: 'general' });
  // Donations only exist on the account that drives the installed overlay.
  assert.deepEqual(parseView('donation', { legacy: false }), { page: 'general' });
  assert.deepEqual(parseView('donation', { legacy: true }), { page: 'alert', kind: 'donation', variation: null });
  for (const value of ['general', 'global', 'media', 'connections', 'raid', 'gift:v_00000001']) {
    assert.equal(viewParam(parseView(value, { legacy: true })), value);
  }
});

test('a variation page whose variation is gone settles on the kind', () => {
  const alert = { variations: [{ id: 'v_00000001' }] } as never;
  assert.deepEqual(settleView({ page: 'alert', kind: 'follow', variation: 'v_00000001' }, alert), { page: 'alert', kind: 'follow', variation: 'v_00000001' });
  assert.deepEqual(settleView({ page: 'alert', kind: 'follow', variation: 'v_00000002' }, alert), { page: 'alert', kind: 'follow', variation: null });
  assert.deepEqual(settleView({ page: 'media' }, null), { page: 'media' });
});

test('the menu follows the Streamlabs order, with donations only for the legacy account', () => {
  const labels = (legacy: boolean) => menuGroups(legacy).flatMap((group) => group.items.map((item) => item.label));
  assert.deepEqual(labels(false), ['General settings', 'Global editing', 'Follows', 'New subs', 'Resubs', 'Gift subs', 'Bits', 'Raids', 'Hype train', 'Channel points', 'Media library', 'Activity', 'Connections']);
  assert.ok(labels(true).includes('Donations'));
  assert.equal(menuGroups(false)[2].label, 'Subscriptions');
  assert.deepEqual(kindsFor(false).includes('donation'), false);
  const alert = { variations: [{ id: 'v_00000001', name: 'Big cheers' }] } as never;
  assert.equal(viewLabel({ page: 'alert', kind: 'cheer', variation: 'v_00000001' }, alert), 'Bits: Big cheers');
  assert.equal(viewLabel({ page: 'global' }), 'Global editing');
});

test('a missing alert reads as on and classic; an old phase 4 design reads as the custom style', () => {
  const plain = normalizeAlert(undefined, 'follow');
  assert.equal(plain.enabled, true);
  assert.equal(plain.look.style, 'classic');
  assert.deepEqual(plain.variations, []);
  assert.equal(plain.look.template, '{name} is now following!');
  const legacy = normalizeAlert(undefined, 'raid', { video: null, image: 13, sound: null, duration_ms: 5000, x: 960, y: 540, scale: 0.75, volume: 0.8, texts: [] });
  assert.equal(legacy.look.style, 'custom');
  assert.equal(legacy.look.custom?.image, 13);
  // Partial looks are filled with the defaults, in a fixed order.
  const partial = normalizeLook({ style: 'preset', font: { color: '#ff0000' }, sound: 14 }, 'cheer');
  assert.equal(partial.font.color, '#ff0000');
  assert.equal(partial.font.highlight, '#61daf1');
  assert.equal(partial.sound, 14);
  assert.deepEqual(Object.keys(partial), Object.keys(defaultLook()));
  assert.equal(normalizeLook({ duration_ms: null }).duration_ms, null);
});

test('unsaved changes are found by comparing the filled-in drafts', () => {
  const saved = normalizeAlert({ enabled: true, look: { style: 'classic' }, variations: [] }, 'follow');
  assert.ok(sameAlert(saved, normalizeAlert(undefined, 'follow'), 'follow'));
  assert.ok(!sameAlert(saved, { ...saved, enabled: false }, 'follow'));
  assert.ok(!sameAlert(saved, { ...saved, look: { ...saved.look, size: 120 } }, 'follow'));
  assert.deepEqual(alertForApi(saved, 'follow'), saved);
  const general = defaultGeneral();
  assert.ok(sameGeneralSettings(general, normalizeGeneral({})));
  assert.ok(!sameGeneralSettings(general, { ...general, interrupt: true }));
  // The defaults look is its own draft: General settings ignore it.
  assert.ok(sameGeneralSettings(general, { ...general, defaults: { ...general.defaults, size: 50 } }));
  assert.ok(!sameDefaults(general.defaults, { ...general.defaults, size: 50 }));
  assert.equal('defaults' in generalSettingsPart(general), false);
});

test('variation ids are v_ and 8 lowercase hex digits, unique within the kind', () => {
  assert.match(newVariationId([]), /^v_[0-9a-f]{8}$/);
  assert.equal(newVariationId([], walk(0)), 'v_00000000');
  assert.equal(newVariationId([], walk(0.99)), 'v_ffffffff');
  // A clash is drawn again.
  assert.equal(newVariationId(['v_00000000'], walk(0, 0, 0, 0, 0, 0, 0, 0, 0.5)), 'v_80000000');
});

test('adding, editing, moving and removing variations', () => {
  const base = normalizeAlert({ look: { style: 'preset', size: 140 } }, 'cheer');
  const first = addVariation(base, 'cheer', walk(0.1));
  assert.ok(first);
  assert.equal(first.alert.variations.length, 1);
  const added = first.alert.variations[0];
  assert.equal(added.name, 'Variation 1');
  assert.equal(added.enabled, true);
  assert.deepEqual(added.condition, { type: 'amount_at_least', value: 1000 });
  // It starts as a copy of the alert's own look, not a shared object.
  assert.equal(added.look.size, 140);
  assert.notEqual(added.look, base.look);
  const second = addVariation(first.alert, 'cheer', walk(0.2))!;
  assert.equal(second.alert.variations[1].name, 'Variation 2');
  const renamed = updateVariation(second.alert, first.id, { name: 'Big cheers', id: 'v_ffffffff' });
  assert.equal(renamed.variations[0].name, 'Big cheers');
  assert.equal(renamed.variations[0].id, first.id, 'the id never changes');
  const moved = moveVariation(renamed, first.id, 1);
  assert.deepEqual(moved.variations.map((item) => item.id), [second.id, first.id]);
  assert.equal(moveVariation(moved, first.id, 1), moved, 'the last cannot move down');
  assert.deepEqual(removeVariation(moved, second.id).variations.map((item) => item.id), [first.id]);
  let full = base;
  for (let i = 0; i < MAX_VARIATIONS; i += 1) full = addVariation(full, 'cheer')!.alert;
  assert.equal(full.variations.length, 10);
  assert.equal(addVariation(full, 'cheer'), null);
});

test('each kind offers only its own condition types', () => {
  assert.deepEqual(conditionTypesFor('follow'), ['random', 'viewer']);
  assert.deepEqual(conditionTypesFor('cheer'), ['amount_at_least', 'amount_exactly', 'random', 'viewer']);
  assert.deepEqual(conditionTypesFor('resub'), ['months_at_least', 'months_exactly', 'tier', 'random', 'viewer']);
  assert.deepEqual(conditionTypesFor('sub'), ['tier', 'random', 'viewer']);
  assert.deepEqual(conditionTypesFor('gift'), ['amount_at_least', 'amount_exactly', 'tier', 'random', 'viewer']);
  assert.deepEqual(conditionTypesFor('donation'), ['amount_at_least', 'amount_exactly', 'random', 'viewer']);
  assert.deepEqual(conditionTypesFor('cheer', ['viewer', 'random']), ['random', 'viewer'], 'the API list wins');
  assert.deepEqual(defaultCondition('sub'), { type: 'tier', value: '1000' });
  assert.deepEqual(changeConditionType('cheer', 'random'), { type: 'random', value: 50 });
});

test('condition values are checked per type, and donations are typed in dollars but sent in cents', () => {
  assert.equal(conditionProblem('cheer', { type: 'amount_at_least', value: 1000 }), null);
  assert.match(conditionProblem('cheer', { type: 'amount_at_least', value: 0 }) ?? '', /whole number/);
  assert.match(conditionProblem('cheer', { type: 'amount_at_least', value: 'lots' }) ?? '', /whole number/);
  assert.match(conditionProblem('follow', { type: 'amount_at_least', value: 5 }) ?? '', /cannot use/);
  assert.match(conditionProblem('follow', { type: 'random', value: 101 }) ?? '', /1 to 100/);
  assert.equal(conditionProblem('follow', { type: 'viewer', value: 'Nova' }), null);
  assert.match(conditionProblem('follow', { type: 'viewer', value: ' ' }) ?? '', /viewer name/);
  assert.match(conditionProblem('follow', { type: 'viewer', value: 'x'.repeat(33) }) ?? '', /32/);
  assert.match(conditionProblem('sub', { type: 'tier', value: '4000' }) ?? '', /tier/);
  assert.deepEqual(conditionFromInput('donation', 'amount_at_least', '12.5'), { type: 'amount_at_least', value: 1250 });
  assert.equal(conditionInput('donation', { type: 'amount_at_least', value: 1250 }), '12.50');
  assert.equal(conditionInput('donation', { type: 'amount_at_least', value: 1000 }), '10');
  assert.deepEqual(conditionFromInput('cheer', 'amount_at_least', '2.5'), { type: 'amount_at_least', value: 2.5 });
  assert.match(conditionProblem('cheer', { type: 'amount_at_least', value: 2.5 }) ?? '', /whole number/);
  assert.equal(describeCondition('cheer', { type: 'amount_at_least', value: 1000 }), 'Bits at least 1,000');
  assert.equal(describeCondition('donation', { type: 'amount_exactly', value: 500 }), 'Dollars exactly $5.00');
  assert.equal(describeCondition('resub', { type: 'months_at_least', value: 12 }), 'Months at least 12');
  assert.equal(describeCondition('follow', { type: 'random', value: 25 }), '25% chance');
});

test('the checks before saving name the same field paths as the API', () => {
  const alert = normalizeAlert({ look: { style: 'preset', template: '{bits} from {nope}', size: 300, media: { video: 16 } } }, 'cheer');
  const withVariation = addVariation(alert, 'cheer', walk(0.3))!.alert;
  const broken = updateVariation(withVariation, withVariation.variations[0].id, {
    name: '',
    condition: { type: 'amount_at_least', value: 0 },
    look: normalizeLook({ style: 'preset', font: { family: 'Comic Sans' }, animation: { show: 'spin' } }, 'cheer'),
  });
  const fields = validateAlert(broken, 'cheer', { assets: library }).map((item) => item.field);
  assert.ok(fields.includes('look.template'));
  assert.ok(fields.includes('look.size'));
  assert.ok(fields.includes('look.media.video'), 'a video still converting is refused');
  assert.ok(fields.includes('variations.0.name'));
  assert.ok(fields.includes('variations.0.condition.value'));
  assert.ok(fields.includes('variations.0.look.font.family'));
  assert.ok(fields.includes('variations.0.look.animation.show'));
  // Classic looks only check what classic uses.
  assert.deepEqual(validateAlert(normalizeAlert(undefined, 'cheer'), 'cheer', { assets: [] }), []);
  // "match the video" needs a video.
  const picture = normalizeAlert({ look: { style: 'preset', media: { image: 13 }, duration_ms: null } }, 'follow');
  assert.deepEqual(validateAlert(picture, 'follow', { assets: library }).map((item) => item.field), ['look.duration_ms']);
  // Custom style without a design, and custom design fields under look.custom.
  const custom = normalizeAlert({ look: { style: 'custom' } }, 'follow');
  assert.deepEqual(validateAlert(custom, 'follow', { assets: library }).map((item) => item.field), ['look.custom']);
  assert.equal(apiField('variations[1].look.font.family'), 'variations.1.look.font.family');
  assert.deepEqual(fieldScope('variations.1.look.font.family'), { variation: 1, rest: 'look.font.family' });
  assert.deepEqual(fieldScope('look.size'), { variation: null, rest: 'look.size' });
});

test('general settings are filled, checked and edited as chips', () => {
  const general = normalizeGeneral({ minimums: { raid: 25 }, profanity: { mode: 'replace', words: ['heck', 7] } });
  assert.equal(general.minimums.raid, 25);
  assert.equal(general.minimums.cheer, 1);
  assert.equal(general.minimums.donation, 0);
  assert.deepEqual(general.profanity.words, ['heck']);
  assert.equal(general.moderation.mode, 'off');
  assert.deepEqual(validateGeneral(general), []);
  const bad = { ...general, delay_ms: 31000, minimums: { ...general.minimums, cheer: -1 }, moderation: { mode: 'hold' as const, seconds: 2 } };
  assert.deepEqual(validateGeneral(bad).map((item) => item.field), ['minimums.cheer', 'delay_ms', 'moderation.seconds']);
  assert.deepEqual(addWords(['heck'], 'Darn, HECK,\n  frick ', 500), { list: ['heck', 'darn', 'frick'], error: null });
  assert.match(addWords([], 'x'.repeat(41), 500).error ?? '', /40 characters/);
  assert.deepEqual(addWords(['a', 'b'], 'c, d', 3), { list: ['a', 'b', 'c'], error: 'The list is full (3 words).' });
});

test('Apply to all alerts sends the API field names of the ticked parts', () => {
  assert.deepEqual(applyFields(['font', 'animations', 'layout']), ['layout', 'animation', 'text', 'font']);
  assert.deepEqual(applyFields([]), []);
});

test('a look resolves from the library facts, and one whose file is not ready falls back to classic', () => {
  const preset = normalizeLook({ style: 'preset', media: { video: 12 }, sound: 14, font: { family: 'asset:15' } }, 'follow');
  const resolved = resolveLook(preset, library)!;
  assert.equal(resolved.media.video?.url, 'https://media.test/12');
  assert.equal(resolved.media.image, null);
  assert.deepEqual(resolved.sound, { url: 'https://media.test/14', duration_ms: null });
  assert.equal(resolved.font.family, 'acosmic-font-15');
  assert.deepEqual(resolved.fonts, [{ family: 'acosmic-font-15', url: 'https://media.test/15' }]);
  assert.equal(resolveLook(normalizeLook({ style: 'preset', media: { video: 16 } }), library), null);
  assert.equal(resolveLook(normalizeLook({ style: 'preset', sound: 99 }), library), null);
  const alert = normalizeAlert({ look: { style: 'preset', media: { video: 16 }, sound: 'none', animation: { show: 'zoom', hide: 'fade' } } }, 'follow');
  const fallback = resolveAlert(alert, library).look;
  assert.equal(fallback.style, 'classic');
  assert.equal(fallback.sound, 'none');
  assert.equal(fallback.animation.show, 'zoom');
  assert.equal(resolveLook(normalizeLook({ style: 'custom' }), library), null);
});

test('the preview config keeps the saved settings, swaps in the draft, and always shows the card', () => {
  const general = normalizeGeneral({ minimums: { raid: 25 }, delay_ms: 3000, moderation: { mode: 'manual', seconds: 10 }, profanity: { mode: 'replace' } });
  const shown = previewGeneral(general) as ReturnType<typeof normalizeGeneral>;
  assert.equal(shown.minimums.raid, 0);
  assert.equal(shown.delay_ms, 0);
  assert.equal(shown.moderation.mode, 'off');
  assert.equal(shown.profanity.mode, 'replace');
  assert.deepEqual(previewGeneral(null), {});
  const customDesign = { video: null, image: { url: 'x' }, sound: null, duration_ms: 5000, x: 960, y: 540, scale: 1, volume: 1, texts: [], fonts: [] };
  const saved = savedPreviewConfig({ raid: { enabled: true, look: { ...resolveLook(defaultLook('raid'), [])!, style: 'custom', custom: customDesign as never }, variations: [] } }, general);
  assert.deepEqual(Object.keys(saved.designs), ['raid'], 'older overlay copies still get the custom designs');
  const draft = normalizeAlert({ look: { style: 'preset', media: { image: 13 }, template: '{name} hi' } }, 'follow');
  const built = draftPreviewConfig({ saved, kind: 'follow', draft, variation: null, assets: library });
  assert.equal(built.problem, null);
  assert.equal(built.config.alerts.follow?.look.media.image?.url, 'https://media.test/13');
  assert.ok(built.config.alerts.raid, 'other kinds stay as saved');
  const notReady = draftPreviewConfig({ saved, kind: 'follow', draft: normalizeAlert({ look: { style: 'preset', media: { video: 16 } } }, 'follow'), variation: null, assets: library });
  assert.match(notReady.problem ?? '', /not ready/);
  const defaults = { ...defaultLook(), layout: 'side' as const, size: 60 };
  const global = defaultsPreviewConfig(saved, 'follow', defaults, draft, library);
  assert.equal(global.alerts.follow?.look.style, 'preset');
  assert.equal(global.alerts.follow?.look.layout, 'side');
  assert.equal(global.alerts.follow?.look.template, '{name} hi', 'the alert keeps its own message');
});

test('animation names come from the API when it sends them', () => {
  assert.ok(animationNames(null).show.includes('glitch'));
  assert.deepEqual(animationNames({ show: ['none', 'fade'] }).show, ['none', 'fade']);
  assert.ok(animationNames({ show: [] }).show.includes('pop'));
});
