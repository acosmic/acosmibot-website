import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const admin = read('src/pages/admin/AdminPage.tsx');
const app = read('src/App.tsx');
const gate = read('src/components/auth/RequireSuperAdmin.tsx');
const page = read('src/pages/stream-alerts/StreamAlertsPage.tsx');
const workspace = read('src/pages/stream-alerts/StreamAlertsWorkspace.tsx');
const tab = read('src/pages/stream-alerts/StreamAlertsPanel.tsx');
const obsLink = read('src/pages/stream-alerts/ObsLinkCard.tsx');
const editorsCard = read('src/pages/stream-alerts/EditorsCard.tsx');
const accountsCss = read('src/pages/stream-alerts/StreamAlertAccounts.css');
const adminApi = read('src/api/admin.ts');
const api = read('src/api/streamAlerts.ts');
const overlay = read('public/stream-overlay/effects.html');
const hosting = JSON.parse(read('public/staticwebapp.config.json'));

test('stream alerts is its own page at /admin/stream-alerts, behind the super admin gate', () => {
  const gated = app.slice(app.indexOf('<Route element={<RequireSuperAdmin />}>'));
  const block = gated.slice(0, gated.indexOf('</Route>', gated.indexOf('/admin/stream-alerts')));
  assert.match(block, /<Route path="\/admin" element=\{<AdminPage \/>\} \/>/);
  assert.match(block, /<Route path="\/admin\/stream-alerts" element=\{<StreamAlertsPage \/>\} \/>/);
  // The gate sits inside the signed-in routes, so a signed-out visitor never reaches it.
  assert.ok(app.indexOf('<Route element={<RequireAuth />}>') < app.indexOf('<Route element={<RequireSuperAdmin />}>'));
  assert.match(page, /<div className="admin-surface">\s*<StreamAlertsWorkspace \/>/);
  assert.match(workspace, /<StreamAlertsPanel key=\{selected\.id\} account=\{selected\} \/>/);
  assert.match(page, /to="\/admin"/);
});

test('the gate lets only a super admin through and renders nothing of the page before that', () => {
  assert.match(gate, /\/api\/admin\/check/);
  assert.match(gate, /if \(!d\.is_super_admin\) navigate\('\/'\);/);
  assert.match(gate, /\.catch\(\(\) => navigate\('\/'\)\)/);
  assert.match(gate, /if \(!authChecked\) \{[\s\S]*?\}\s*return <Outlet \/>;/);
  // The admin page relies on the route gate instead of its own copy.
  assert.doesNotMatch(admin, /\/api\/admin\/check/);
});

test('the admin page no longer has a stream alerts tab, only a link to the page', () => {
  assert.doesNotMatch(admin, /id: 'stream'/);
  assert.doesNotMatch(admin, /StreamAlertsTab|StreamAlertsPanel/);
  assert.match(admin, /<Link to="\/admin\/stream-alerts">[\s\S]*?<strong>Stream Alerts<\/strong>/);
});

test('every alert the overlay draws can be previewed and sent from the dashboard', () => {
  const overlayKinds = [...overlay.matchAll(/^    (\w+): \{ kicker: /gm)].map((match) => match[1]).sort();
  const dashboardKinds = [...tab.matchAll(/\{ type: '(\w+)', label: /g)].map((match) => match[1]).sort();
  assert.deepEqual(dashboardKinds, overlayKinds);
  assert.deepEqual(dashboardKinds, ['cheer', 'donation', 'follow', 'gift', 'hypetrain', 'raid', 'resub', 'sub']);
  for (const kind of dashboardKinds) assert.match(api, new RegExp(`'${kind}'`));
  assert.match(tab, /Send to OBS/);
  assert.match(tab, /Replay in OBS/);
  assert.match(tab, /streamAlertsApi\.fireAlert\(accountId, input\)/);
  assert.match(tab, /streamAlertsApi\.replayAlert\(accountId, id\)/);
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

test('dashboard calls go through the stream alert accounts API, on the selected account', () => {
  assert.match(api, /const BASE = '\/api\/stream-alerts';/);
  assert.match(api, /const account = \(accountId: number\) => `\$\{BASE\}\/accounts\/\$\{accountId\}`;/);
  for (const path of ['status', 'recent?limit=', 'recent/clear', 'test', 'effect', 'replay', 'control', 'settings',
    'overlay-url', 'overlay-key/regenerate', 'editors']) {
    assert.ok(api.includes('`${account(accountId)}/' + path), path);
  }
  assert.match(api, /getMe: \(\) =>\s*api\.fetch<StreamAlertsMe>\(`\$\{BASE\}\/me`\)/);
  assert.match(api, /createAccount: \(\) =>[\s\S]*?`\$\{BASE\}\/accounts`, \{ method: 'POST' \}/);
  assert.match(api, /removeEditor: \(accountId: number, discordId: string\) =>[\s\S]*?\/editors\/\$\{encodeURIComponent\(discordId\)\}`, \{ method: 'DELETE' \}/);
  assert.match(api, /deleteAccount: \(accountId: number\) =>[\s\S]*?account\(accountId\), \{ method: 'DELETE' \}/);
  // Every function for a route under an account takes the account id first.
  const functions = [...api.matchAll(/^  (\w+): \(([^)]*)\)/gm)].map((match) => [match[1], match[2]]);
  assert.equal(functions.length, 16);
  for (const [name, args] of functions) {
    if (name === 'getMe' || name === 'createAccount') assert.equal(args, '', name);
    else assert.match(args, /^accountId: number/, name);
  }
  // The stream alert client moved out of the admin client, and nothing calls the old routes.
  assert.doesNotMatch(adminApi, /stream-alerts|StreamAlert|StreamEffect/);
  for (const source of [api, workspace, tab, obsLink, editorsCard]) assert.doesNotMatch(source, /\/api\/admin\/stream-alerts|adminApi/);
  assert.doesNotMatch(tab, /Bearer|overlay key value|STREAM_ALERTS_OVERLAY_KEY/);
});

test('live controls reach OBS through the account control and settings routes', () => {
  assert.match(api, /export interface StreamAlertSettings \{/);
  assert.match(api, /export type StreamAlertControlAction = 'skip' \| 'clear' \| 'pause' \| 'resume' \| 'safe_mode_on' \| 'safe_mode_off' \| 'stop_effects'/);
  assert.match(api, /settings: StreamAlertSettings;/);
  assert.match(api, /sendControl: \(accountId: number, action: StreamAlertControlAction\)[\s\S]*?`\$\{account\(accountId\)\}\/control`, \{\s*method: 'POST'/);
  assert.match(api, /updateSettings: \(accountId: number, [\s\S]*?`\$\{account\(accountId\)\}\/settings`, \{\s*method: 'PUT'/);
  assert.match(tab, /streamAlertsApi\.sendControl\(accountId, action\)/);
  assert.match(tab, /streamAlertsApi\.updateSettings\(accountId, partial\)/);
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
  assert.match(api, /clearRecent: \(accountId: number, scope: StreamAlertClearScope\)[\s\S]*?`\$\{account\(accountId\)\}\/recent\/clear`, \{\s*method: 'POST',\s*body: JSON\.stringify\(\{ scope \}\)/);
  assert.match(tab, /streamAlertsApi\.clearRecent\(accountId, scope\)/);
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

test('channel point effects reach OBS through the account effect route', () => {
  assert.match(api, /export type StreamEffectName = 'boop' \| 'meteor' \| 'news' \| 'flood' \| 'rewind'/);
  assert.match(api, /fireEffect: \(accountId: number, payload: StreamEffectInput\)[\s\S]*?`\$\{account\(accountId\)\}\/effect`, \{\s*method: 'POST',\s*body: JSON\.stringify\(payload\)/);
  assert.match(tab, /streamAlertsApi\.fireEffect\(accountId, input\)/);
  assert.match(tab, /fireEffect\.mutate\(\{ effect: effect\.name, name: name\.trim\(\) \|\| undefined, message: message\.trim\(\) \|\| undefined \}\)/);
  assert.match(tab, /if \(fireEffect\.isPending\) return;/);
  assert.match(tab, /Sent \$\{effectLabel\(input\.effect\)\} to OBS\./);
  assert.match(tab, /Could not send \$\{effectLabel\(input\.effect\)\}: /);
});

test('the effects are a second list beside the alerts, each with Preview and Send to OBS', () => {
  const effects = [...tab.matchAll(/\{ name: '(\w+)', label: '/g)].map((match) => match[1]);
  assert.deepEqual(effects, ['boop', 'meteor', 'news', 'flood', 'rewind']);
  // Blackout was removed on 2026-11-22: the overlay must not still carry it.
  assert.doesNotMatch(overlay, /blackout/i);
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
  const css = read('src/pages/stream-alerts/StreamAlertsPanel.css');
  // The layout follows the tab's own width (the admin page has a sidebar), not the window's.
  assert.match(css, /\.stream-alerts \{[^}]*container: stream-alerts \/ inline-size/);
  assert.match(css, /\.stream-alerts__controls \{[^}]*container: stream-controls \/ inline-size/);
  assert.match(css, /@container stream-controls \(min-width: 600px\) \{\s*\.stream-alerts__lists \{ grid-template-columns: minmax\(0, 1\.3fr\) minmax\(0, 1fr\)/);
  assert.match(css, /@container stream-alerts \(max-width: 1000px\) \{\s*\.stream-alerts__layout \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /@container stream-list \(max-width: 440px\)/);
  assert.match(css, /\.stream-alerts__lists \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.stream-alerts__stage \{ position: sticky/);
});

test('the page loads /me and handles loading, failure, no access and no account', () => {
  assert.match(workspace, /useQuery\(\{ queryKey: ME_KEY, queryFn: \(\) => streamAlertsApi\.getMe\(\) \}\)/);
  assert.match(workspace, /if \(me\.isLoading\) \{\s*return <p className="stream-accounts__state" role="status">Loading your stream alerts…<\/p>;/);
  assert.match(workspace, /if \(!me\.data\) \{[\s\S]*?role="alert"[\s\S]*?Could not load your stream alerts\.[\s\S]*?onClick=\{\(\) => me\.refetch\(\)\}/);
  assert.match(workspace, /const canSetUp = me\.data\.can_create && me\.data\.own_account_id === null;/);
  for (const text of ['Set up stream alerts', 'You do not have stream alerts yet.', 'Stream alerts are not open to your account yet.',
    'Could not set up stream alerts: ', 'Your stream alerts are set up. Next, copy your OBS link and add it to OBS.']) {
    assert.ok(workspace.includes(text), text);
  }
  assert.match(workspace, /mutationFn: \(\) => streamAlertsApi\.createAccount\(\)/);
  // A failed set up refreshes /me too: "already set up" means this list is out of date.
  assert.match(workspace, /onSettled: \(\) => queryClient\.invalidateQueries\(\{ queryKey: ME_KEY \}\)/);
});

test('the account switcher shows only with more than one account and keeps the choice in ?account=', () => {
  assert.match(workspace, /const ACCOUNT_PARAM = 'account';/);
  assert.match(workspace, /const requested = params\.get\(ACCOUNT_PARAM\);/);
  assert.match(workspace, /const selected = pickAccount\(accounts, requested, me\.data\?\.own_account_id \?\? null\);/);
  assert.match(workspace, /\{accounts\.length > 1 && \(\s*<div className="stream-accounts__switch" role="group"/);
  assert.match(workspace, /aria-pressed=\{account\.id === selected\.id\}\s*onClick=\{\(\) => selectAccount\(account\.id\)\}\s*>\s*\{accountLabel\(account\)\}/);
  assert.match(workspace, /next\.set\(ACCOUNT_PARAM, String\(id\)\);/);
  assert.match(workspace, /\}, \{ replace: true \}\);/);
  assert.ok(workspace.includes('You do not have access to the stream alerts in that link'));
});

test('owner-only cards are gated on the owner role, and an editor is told whose alerts these are', () => {
  assert.match(workspace, /const isOwner = selected\.role === 'owner';/);
  assert.match(workspace, /\{isOwner && \(\s*<div className="stream-accounts__cards" key=\{selected\.id\}>\s*<ObsLinkCard account=\{selected\} \/>\s*<EditorsCard account=\{selected\} \/>\s*<\/div>\s*\)\}/);
  // The cards appear nowhere else, so an editor never mounts them or calls their routes.
  assert.equal(workspace.match(/<ObsLinkCard /g)?.length, 1);
  assert.equal(workspace.match(/<EditorsCard /g)?.length, 1);
  assert.doesNotMatch(workspace, /getOverlayUrl|regenerateOverlayKey|getEditors/);
  assert.doesNotMatch(tab, /getOverlayUrl|regenerateOverlayKey|getEditors|addEditor|removeEditor/);
  assert.match(workspace, /\{!isOwner && \(\s*<p className="stream-accounts__who">\s*<strong>You are controlling \{ownerPossessive\(selected\.owner_username\)\} stream alerts\.<\/strong>/);
  assert.ok(workspace.includes('can see the OBS link or change the editors.'));
});

test('everything shown for an account is keyed to it, so switching cannot carry anything over', () => {
  // The panel and the owner cards remount per account: notices, typed limits and a shown link go with them.
  assert.match(workspace, /<StreamAlertsPanel key=\{selected\.id\} account=\{selected\} \/>/);
  assert.match(workspace, /className="stream-accounts__cards" key=\{selected\.id\}/);
  assert.match(tab, /const accountId = account\.id;/);
  assert.match(tab, /const statusKey = \['stream-alerts', accountId, 'status'\];/);
  assert.match(tab, /const recentKey = \['stream-alerts', accountId, 'recent'\];/);
  assert.match(editorsCard, /const editorsKey = \['stream-alerts', accountId, 'editors'\];/);
  // No query key is written inline, and each one is an account key (or /me).
  for (const source of [workspace, tab, editorsCard]) {
    const keys = [...source.matchAll(/queryKey: ([^,}\s]+)/g)].map((match) => match[1]);
    assert.ok(keys.length > 0);
    for (const key of keys) assert.match(key, /^(ME_KEY|statusKey|recentKey|editorsKey)$/);
  }
  assert.match(tab, /queryClient\.setQueryData<StreamAlertStatus>\(statusKey, /);
  assert.doesNotMatch(tab, /\['admin', 'stream-alerts'/);
});

test('the status text names the "Acosmic Effects" source only for the account that uses the installed overlay', () => {
  assert.match(tab, /const reconnectHint = account\.legacy_overlay\s*\? 'Open OBS, or refresh the "Acosmic Effects" source\.'\s*: `Open OBS, or refresh the browser source that uses \$\{account\.role === 'owner' \? 'your' : ownerPossessive\(account\.owner_username\)\} link\.`;/);
  assert.equal(tab.match(/Acosmic Effects/g)?.length, 1);
});

test('the OBS link is fetched only on Show or Copy and is never cached or logged', () => {
  // Plain calls kept in component state: React Query keeps query and mutation results, so it is not used here.
  assert.doesNotMatch(obsLink, /@tanstack\/react-query|useQuery|useMutation|queryClient|setQueryData/);
  assert.doesNotMatch(obsLink, /console\.\w|localStorage|sessionStorage|useEffect\(\(\) => \{[^}]*getOverlayUrl/);
  assert.equal(obsLink.match(/streamAlertsApi\.getOverlayUrl\(account\.id\)/g)?.length, 2);
  assert.match(obsLink, /const show = async \(\) => \{[\s\S]*?await streamAlertsApi\.getOverlayUrl\(account\.id\);\s*setShownUrl\(result\.url\);/);
  assert.match(obsLink, /const copy = async \(\) => \{[\s\S]*?: streamAlertsApi\.getOverlayUrl\(account\.id\)\.then\(/);
  assert.match(obsLink, /const hide = \(\) => \{\s*setShownUrl\(null\);/);
  assert.match(obsLink, /useState<string \| null>\(null\)/);
  for (const source of [workspace, tab, editorsCard]) assert.doesNotMatch(source, /overlay-url|getOverlayUrl|regenerateOverlayKey/);
  assert.match(api, /getOverlayUrl: [\s\S]*?\/overlay-url`, \{ cache: 'no-store' \}\)/);
  assert.match(api, /regenerateOverlayKey: [\s\S]*?\/overlay-key\/regenerate`, \{ method: 'POST', cache: 'no-store' \}\)/);
});

test('the OBS link card shows, copies and regenerates behind an in-page confirm step', () => {
  for (const text of ['OBS link', 'Show link', 'Hide link', 'Copy link', 'Make a new link', 'Make a new link?', 'Yes, make a new link', 'Cancel',
    'Link hidden. Anyone who has it can show your alerts, so keep it off your stream.',
    'Link copied. Paste it into the URL box of your Browser source in OBS.',
    'The link you have now stops working right away.',
    'In OBS, add a source and choose Browser.', 'Paste your link into the URL box.',
    'Set Width to 1920 and Height to 1080, then choose OK.']) {
    assert.ok(obsLink.includes(text), text);
  }
  // Regenerate runs only from the confirm step.
  assert.equal(obsLink.match(/onClick=\{regenerate\}/g)?.length, 1);
  const confirm = obsLink.slice(obsLink.indexOf('{confirming && ('), obsLink.indexOf('{notice && ('));
  assert.match(confirm, /onClick=\{regenerate\}/);
  assert.match(confirm, /autoFocus disabled=\{busy !== null\} onClick=\{closeConfirm\}>Cancel</);
  assert.match(obsLink, /onClick=\{\(\) => \{ setNotice\(null\); setConfirming\(true\); \}\}/);
  // A new link stays hidden unless the old one was already on screen.
  assert.match(obsLink, /setShownUrl\(\(current\) => \(current === null \? null : result\.url\)\);/);
  for (const source of [workspace, tab, obsLink, editorsCard]) assert.doesNotMatch(source, /window\.confirm|\bconfirm\(|\balert\(/);
  assert.match(obsLink, /\{account\.legacy_overlay && \(\s*<p className="stream-accounts__aside">\s*The overlay already installed in your OBS keeps working as it is\. You only need this link if you want to move OBS to the hosted overlay\./);
});

test('the editors card lists editors with Remove and adds from the candidates', () => {
  assert.match(editorsCard, /queryFn: \(\) => streamAlertsApi\.getEditors\(accountId\)/);
  assert.match(editorsCard, /mutationFn: \(discordId: string\) => streamAlertsApi\.addEditor\(accountId, discordId\)/);
  assert.match(editorsCard, /mutationFn: \(editor: StreamAlertEditor\) => streamAlertsApi\.removeEditor\(accountId, editor\.discord_id\)/);
  assert.match(api, /addEditor: [\s\S]*?\/editors`, \{\s*method: 'POST',\s*body: JSON\.stringify\(\{ discord_id: discordId \}\)/);
  assert.match(editorsCard, /\{candidates\.map\(\(person\) => \(\s*<option key=\{person\.discord_id\} value=\{person\.discord_id\}>\{person\.username\}<\/option>/);
  assert.match(editorsCard, /aria-label=\{`Remove \$\{editor\.username\}`\}/);
  for (const text of ['No editors yet. Only you can control your alerts.', 'There is nobody you can add right now.',
    'Could not load your editors: ', 'Could not add that person: ', 'Could not remove ${editor.username}: ', 'They may already have been removed, so the list was refreshed.', 'Add editor', 'Choose a person']) {
    assert.ok(editorsCard.includes(text), text);
  }
  assert.match(editorsCard, /role=\{notice\.tone === 'error' \? 'alert' : 'status'\}/);
});

test('the account area keeps touch targets, focus rings and narrow screens in shape', () => {
  assert.match(accountsCss, /\.stream-accounts button \{\s*min-height: 44px; max-width: 100%;/);
  assert.match(accountsCss, /\.stream-accounts \.form-control \{ min-height: 44px; \}/);
  assert.match(accountsCss, /\.stream-accounts button:focus-visible, \.stream-accounts input:focus-visible, \.stream-accounts select:focus-visible \{ outline: 2px solid var\(--primary-color\)/);
  assert.match(accountsCss, /\.stream-accounts \{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*container: stream-accounts \/ inline-size/);
  assert.match(accountsCss, /@container stream-accounts \(min-width: 900px\) \{\s*\.stream-accounts__cards \{ grid-template-columns:/);
  // The account area sits beside the panel, not around it, so its button rules cannot restyle the panel.
  assert.match(workspace, /<div className="stream-alerts-workspace">\s*<div className="stream-accounts">/);
  const accountArea = workspace.slice(workspace.indexOf('<div className="stream-alerts-workspace">'));
  assert.ok(accountArea.lastIndexOf('</div>', accountArea.indexOf('<StreamAlertsPanel ')) > accountArea.indexOf('<ObsLinkCard '));
});

test('new wording on the page uses no em dashes', () => {
  for (const source of [workspace, obsLink, editorsCard]) assert.doesNotMatch(source, /—/);
});
