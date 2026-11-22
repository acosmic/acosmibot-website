import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = read('src/pages/admin/AdminPage.tsx');
const tab = read('src/pages/admin/StreamAlertsTab.tsx');
const api = read('src/api/admin.ts');
const overlay = read('public/stream-overlay/effects.html');
const hosting = JSON.parse(read('public/staticwebapp.config.json'));

test('stream alerts is an owner admin tab', () => {
  assert.match(admin, /id: 'stream', label: 'Stream Alerts'/);
  assert.match(admin, /tab === 'stream' && \(\s*<div className="admin-surface">\s*<StreamAlertsTab \/>/);
});

test('every alert the overlay draws can be previewed and sent from the dashboard', () => {
  const overlayKinds = [...overlay.matchAll(/^    (\w+): \{ kicker: /gm)].map((match) => match[1]).sort();
  const dashboardKinds = [...tab.matchAll(/\{ type: '(\w+)', label: /g)].map((match) => match[1]).sort();
  assert.deepEqual(dashboardKinds, overlayKinds);
  assert.deepEqual(dashboardKinds, ['cheer', 'donation', 'follow', 'gift', 'hypetrain', 'raid', 'resub', 'sub']);
  for (const kind of dashboardKinds) assert.match(api, new RegExp(`'${kind}'`));
  assert.match(tab, /Send to OBS/);
  assert.match(tab, /Replay in OBS/);
  assert.match(tab, /adminApi\.fireStreamAlert/);
  assert.match(tab, /adminApi\.replayStreamAlert/);
});

test('the preview frame loads the hosted overlay without connecting to anything', () => {
  assert.match(tab, /src="\/stream-overlay\/effects\.html\?offline=1"/);
  assert.match(overlay, /GENERATED COPY/);
  assert.match(overlay, /window\.AcosmicFX = /);
});

test('only the overlay path may be framed, and only by this site', () => {
  assert.equal(hosting.globalHeaders['X-Frame-Options'], 'DENY');
  const route = hosting.routes.find((item: { route: string }) => item.route === '/stream-overlay/*');
  assert.ok(route);
  assert.match(route.headers['Content-Security-Policy'], /frame-ancestors 'self'/);
  assert.equal(route.headers['X-Robots-Tag'], 'noindex, nofollow');
});

test('dashboard calls stay on the owner-only admin API', () => {
  for (const path of ['status', 'recent', 'test', 'replay']) assert.match(api, new RegExp(`/api/admin/stream-alerts/${path}`));
  assert.doesNotMatch(tab, /Bearer|overlay key value|STREAM_ALERTS_OVERLAY_KEY/);
});

test('live controls reach OBS through the owner-only control and settings routes', () => {
  assert.match(api, /export interface StreamAlertSettings \{/);
  assert.match(api, /export type StreamAlertControlAction = 'skip' \| 'clear' \| 'pause' \| 'resume' \| 'safe_mode_on' \| 'safe_mode_off' \| 'stop_effects'/);
  assert.match(api, /settings: StreamAlertSettings;/);
  assert.match(api, /sendStreamAlertControl: [\s\S]*?'\/api\/admin\/stream-alerts\/control', \{\s*method: 'POST'/);
  assert.match(api, /updateStreamAlertSettings: [\s\S]*?'\/api\/admin\/stream-alerts\/settings', \{\s*method: 'PUT'/);
  assert.match(tab, /adminApi\.sendStreamAlertControl/);
  assert.match(tab, /adminApi\.updateStreamAlertSettings/);
});

test('the tab offers skip, pause, clear, Safe Mode and the raid and cheer limits', () => {
  for (const text of ['Live controls', 'Skip current alert', 'Pause alerts', 'Resume alerts', 'Clear waiting alerts',
    'Smallest raid to show', 'Smallest cheer to show', 'Follow and raid alerts are hidden until you turn it off']) {
    assert.ok(tab.includes(text), text);
  }
  for (const action of ['skip', 'clear', 'pause', 'resume', 'safe_mode_on', 'safe_mode_off']) assert.match(tab, new RegExp(`'${action}'`));
  // Live controls sit above the preview and test-alert grid.
  assert.ok(tab.indexOf('aria-label="Live controls"') < tab.indexOf('className="stream-alerts__layout"'));
});

test('the preview mirrors skip and clear only when its overlay copy supports them', () => {
  assert.match(tab, /fx\?\.skip\?\.\(\)/);
  assert.match(tab, /fx\?\.clear\?\.\(\)/);
  assert.match(tab, /typeof fx\?\.queue === 'function'/);
  assert.match(tab, /Preview a follow flood/);
  assert.match(tab, /counting follows only/);
  assert.doesNotMatch(tab, /fx\?\.(pause|resume|applySettings)/);
});

test('a new preview cuts off the one before it', () => {
  assert.match(tab, /stop\?: \(\) => void/);
  assert.match(tab, /stopPreview\(\);\s*overlay\.AcosmicFX\.fire\(effect, options\)/);
  assert.match(tab, /AcosmicFX\?\.stop\?\.\(\)/);
  assert.match(tab, />Stop preview</);
});

test('stop effects ends channel point effects in OBS and mirrors in the preview when supported', () => {
  assert.match(tab, /stop_effects: \{ done: 'Stopped the effects in OBS\.'/);
  assert.match(tab, /runControl\('stop_effects'\)/);
  assert.match(tab, />\s*Stop effects\s*</);
  assert.match(tab, /Skip ends the alert card on screen\. Stop effects ends a channel point effect/);
  assert.match(tab, /stopEffects\?: \(\) => void/);
  assert.match(tab, /typeof fx\?\.stopEffects === 'function'\) fx\.stopEffects\(\)/);
});

test('the recent list can be cleared of tests, or fully after a confirmation step', () => {
  assert.match(api, /export type StreamAlertClearScope = 'tests' \| 'all'/);
  assert.match(api, /clearRecentStreamAlerts: \(scope: StreamAlertClearScope\)[\s\S]*?'\/api\/admin\/stream-alerts\/recent\/clear', \{\s*method: 'POST',\s*body: JSON\.stringify\(\{ scope \}\)/);
  assert.match(tab, /adminApi\.clearRecentStreamAlerts/);
  for (const text of ['Clear test alerts', 'Clear recent alerts', 'Clear all recent alerts?', 'Yes, clear', 'Cancel',
    'Nothing to clear.', 'This only tidies this list. It does not change anything in OBS or Stripe.']) {
    assert.ok(tab.includes(text), text);
  }
  assert.match(tab, /runClear\('tests'\)/);
  assert.match(tab, /runClear\('all'\)/);
  assert.match(tab, /disabled=\{clearRecent\.isPending \|\| !hasTestAlerts\}/);
  assert.match(tab, /disabled=\{clearRecent\.isPending \|\| alerts\.length === 0\}/);
  assert.match(tab, /alert\.test \|\| alert\.sandbox/);
  assert.doesNotMatch(tab, /window\.confirm/);
  // Clearing the list is not an OBS control.
  assert.doesNotMatch(tab, /disabled=\{[^}]*clearRecent[^}]*(liveDisabled|obsReady)/);
});

test('channel point effects reach OBS through the owner-only effect route', () => {
  assert.match(api, /export type StreamEffectName = 'boop' \| 'meteor' \| 'news' \| 'blackout' \| 'flood' \| 'rewind'/);
  assert.match(api, /fireStreamEffect: \(payload: StreamEffectInput\)[\s\S]*?'\/api\/admin\/stream-alerts\/effect', \{\s*method: 'POST',\s*body: JSON\.stringify\(payload\)/);
  assert.match(tab, /adminApi\.fireStreamEffect/);
  assert.match(tab, /fireEffect\.mutate\(\{ effect: effect\.name, name: name\.trim\(\) \|\| undefined, message: message\.trim\(\) \|\| undefined \}\)/);
  assert.match(tab, /if \(fireEffect\.isPending\) return;/);
  assert.match(tab, /Sent \$\{effectLabel\(input\.effect\)\} to OBS\./);
  assert.match(tab, /Could not send \$\{effectLabel\(input\.effect\)\}: /);
});

test('the effects are a second list beside the alerts, each with Preview and Send to OBS', () => {
  const effects = [...tab.matchAll(/\{ name: '(\w+)', label: '/g)].map((match) => match[1]);
  assert.deepEqual(effects, ['boop', 'meteor', 'news', 'blackout', 'flood', 'rewind']);
  for (const effect of effects) assert.match(overlay, new RegExp(`^    ${effect}: function`, 'm'));
  const listStart = tab.indexOf('className="stream-alerts__kinds is-effects"');
  assert.ok(listStart > tab.indexOf('>Alerts</h3>'));
  assert.ok(tab.indexOf('>Channel point effects</h3>') < listStart);
  const list = tab.slice(listStart, tab.indexOf('</ul>', listStart));
  assert.match(list, /onClick=\{\(\) => previewEffect\(effect\)\}>Preview</);
  assert.match(list, /disabled=\{fireEffect\.isPending \|\| !status\.data\?\.configured\}\s*onClick=\{\(\) => sendEffect\(effect\)\}\s*>\s*Send to OBS/);
  assert.match(tab, /previewEffect = \(effect: RewardEffect\) => playInPreview\(effect\.name, /);
  assert.match(tab, /name: 'news', label: 'Breaking News', accent: '[^']+', usesMessage: true/);
  // The old preview-only effect buttons under the stage are gone; flood and stop stay there.
  assert.doesNotMatch(tab, /preview only/);
  const rewards = tab.slice(tab.indexOf('className="stream-alerts__rewards"'), tab.indexOf('</section>', tab.indexOf('className="stream-alerts__rewards"')));
  assert.doesNotMatch(rewards, /REWARD_EFFECTS/);
  assert.match(rewards, /Preview a follow flood/);
  assert.match(rewards, />Stop preview</);
});

test('the two lists sit side by side when there is room and stack otherwise', () => {
  const css = read('src/pages/admin/StreamAlertsTab.css');
  // The layout follows the tab's own width (the admin page has a sidebar), not the window's.
  assert.match(css, /\.stream-alerts \{[^}]*container: stream-alerts \/ inline-size/);
  assert.match(css, /\.stream-alerts__controls \{[^}]*container: stream-controls \/ inline-size/);
  assert.match(css, /@container stream-controls \(min-width: 600px\) \{\s*\.stream-alerts__lists \{ grid-template-columns: minmax\(0, 1\.3fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@container stream-alerts \(max-width: 1000px\) \{\s*\.stream-alerts__layout \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@container stream-list \(max-width: 440px\)/);
  assert.match(css, /\.stream-alerts__lists \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.stream-alerts__stage \{ position: sticky/);
});
