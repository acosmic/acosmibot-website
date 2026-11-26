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
const twitchCard = read('src/pages/stream-alerts/TwitchCard.tsx');
const rewardsCard = read('src/pages/stream-alerts/RewardsCard.tsx');
const accountUtils = read('src/utils/streamAlertAccounts.ts');
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
  assert.match(workspace, /<StreamAlertsPanel key=\{selected\.id\} account=\{selected\} previewRef=\{previewRef\} \/>/);
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
  assert.equal(functions.length, 29);
  for (const [name, args] of functions) {
    if (name === 'getMe' || name === 'createAccount') assert.equal(args, '', name);
    else assert.match(args, /^accountId: number/, name);
  }
  // The stream alert client moved out of the admin client, and nothing calls the old routes.
  assert.doesNotMatch(adminApi, /stream-alerts|StreamAlert|StreamEffect/);
  for (const source of [api, workspace, tab, obsLink, editorsCard, twitchCard, rewardsCard]) assert.doesNotMatch(source, /\/api\/admin\/stream-alerts|adminApi/);
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
  assert.ok(workspace.includes('can see the OBS link, change the editors, or connect and disconnect Twitch.'));
});

test('everything shown for an account is keyed to it, so switching cannot carry anything over', () => {
  // The panel and the owner cards remount per account: notices, typed limits and a shown link go with them.
  assert.match(workspace, /<StreamAlertsPanel key=\{selected\.id\} account=\{selected\} previewRef=\{previewRef\} \/>/);
  assert.match(workspace, /className="stream-accounts__cards" key=\{selected\.id\}/);
  assert.match(tab, /const accountId = account\.id;/);
  assert.match(tab, /const statusKey = \['stream-alerts', accountId, 'status'\];/);
  assert.match(tab, /const recentKey = \['stream-alerts', accountId, 'recent'\];/);
  assert.match(editorsCard, /const editorsKey = \['stream-alerts', accountId, 'editors'\];/);
  // No query key is written inline, and each one is an account key (or /me).
  for (const source of [workspace, tab, editorsCard, twitchCard, rewardsCard]) {
    const keys = [...source.matchAll(/queryKey: ([^,}\s]+)/g)].map((match) => match[1]);
    assert.ok(keys.length > 0);
    for (const key of keys) assert.match(key, /^(ME_KEY|statusKey|recentKey|editorsKey|twitchKey|rewardsKey|assetsKey|designsKey)$/);
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
  for (const source of [workspace, obsLink, editorsCard, twitchCard, rewardsCard, accountUtils]) assert.doesNotMatch(source, /—/);
});

/* ---- Connect Twitch and channel point rewards ---- */

test('the client has one function per Twitch and reward route', () => {
  assert.match(api, /getTwitch: \(accountId: number\) =>\s*api\.fetch<StreamAlertTwitchState>\(`\$\{account\(accountId\)\}\/twitch`\)/);
  assert.match(api, /disconnectTwitch: \(accountId: number\) =>\s*api\.fetch<\{ success: boolean \}>\(`\$\{account\(accountId\)\}\/twitch`, \{ method: 'DELETE' \}\)/);
  assert.match(api, /resubscribeTwitch: \(accountId: number\) =>[\s\S]*?`\$\{account\(accountId\)\}\/twitch\/resubscribe`, \{ method: 'POST' \}\)/);
  assert.match(api, /getRewards: \(accountId: number\) =>\s*api\.fetch<StreamRewards>\(`\$\{account\(accountId\)\}\/rewards`\)/);
  assert.match(api, /setRewardMapping: \(accountId: number, rewardId: string, mapping: StreamRewardMappingInput\) =>[\s\S]*?`\$\{account\(accountId\)\}\/rewards\/\$\{encodeURIComponent\(rewardId\)\}`, \{\s*method: 'PUT',\s*body: JSON\.stringify\(mapping\)/);
  assert.match(api, /createReward: \(accountId: number, effect: StreamEffectName\) =>[\s\S]*?`\$\{account\(accountId\)\}\/rewards`, \{\s*method: 'POST',\s*body: JSON\.stringify\(\{ effect \}\)/);
  // Shapes from the contract.
  assert.match(api, /export interface StreamAlertTwitchState \{\s*success: boolean;\s*connected: boolean;[\s\S]*?connect_url: string \| null;\s*twitch: StreamAlertTwitchLink \| null;\s*\}/);
  assert.match(api, /export type StreamAlertTwitchLinkStatus = 'connected' \| 'reauth_required';/);
  assert.match(api, /export interface StreamAlertTwitchLink extends StreamAlertTwitchChannel \{\s*missing_scopes: string\[\];\s*subscriptions: StreamAlertTwitchSubscription\[\];\s*\}/);
  assert.match(api, /export type StreamRewardTrigger = 'redeemed' \| 'fulfilled';/);
  assert.match(api, /export interface StreamRewardMappingInput \{\s*effect: StreamEffectName \| null;\s*on\?: StreamRewardTrigger;\s*\}/);
  for (const field of ['id: string;', 'title: string;', 'cost: number;', 'is_enabled: boolean;', 'is_paused: boolean;', 'manageable: boolean;', 'mapping: StreamRewardMapping | null;']) {
    assert.ok(api.slice(api.indexOf('export interface StreamReward {')).includes(field), field);
  }
  // Status says whether Twitch is connected.
  assert.match(api, /export interface StreamAlertStatus \{[\s\S]*?twitch\?: StreamAlertTwitchChannel \| null;\s*\}/);
});

test('Connect Twitch is a link to the API connect page, never a request from the page', () => {
  assert.match(twitchCard, /<a className="stream-accounts__link-button is-primary" href=\{connectHref\}>\{label\}<\/a>/);
  assert.match(twitchCard, /connectLink\('Connect Twitch'\)/);
  assert.match(twitchCard, /connectLink\('Reconnect Twitch'\)/);
  // The address comes from the API answer and is checked before it becomes a link.
  assert.match(twitchCard, /const connectHref = isOwner \? twitchConnectHref\(data\?\.connect_url, accountId\) : null;/);
  // Same tab, nothing scripted: the browser itself goes there, so the sign-in cookie travels.
  assert.doesNotMatch(twitchCard, /target=|window\.open|location\.(href|assign|replace)|navigate\(|\bfetch\(/);
  for (const source of [api, workspace, rewardsCard, tab]) assert.doesNotMatch(source, /auth\/stream-alerts|connect_url: string;|\bconnectTwitch/);
  // Said before the click.
  assert.ok(twitchCard.includes('Twitch will ask you to approve Acosmibot reading follows, subs, bits and hype trains, and managing channel point rewards. Acosmibot only listens. It does not post in chat.'));
  assert.match(twitchCard, /<p className="stream-twitch__ask">\{WHAT_TWITCH_ASKS\}<\/p>\s*<div className="stream-accounts__buttons">\s*<a /);
});

test('the Twitch card shows not connected, connected, failed events and reconnect', () => {
  assert.match(twitchCard, /queryFn: \(\) => streamAlertsApi\.getTwitch\(accountId\)/);
  assert.match(twitchCard, /const twitchKey = twitchQueryKey\(accountId\);/);
  for (const text of ['Twitch is not connected.', 'Connected to ', 'Listening for ', 'Still listening for ', 'Not listening for {listWords(events.failed)}.',
    'Twitch is still setting up {listWords(events.settingUp)}.', '<strong>Reconnect Twitch</strong>', 'Checking Twitch…', 'Could not check Twitch: ',
    'Fixed. Twitch is sending those alerts again.', 'Could not fix it: ', 'Could not disconnect Twitch: ',
    'Twitch is disconnected. Real Twitch alerts and channel point rewards no longer play on your overlay.']) {
    assert.ok(twitchCard.includes(text), text);
  }
  assert.match(twitchCard, /const needsReconnect = Boolean\(link && \(link\.status !== 'connected' \|\| \(link\.missing_scopes \?\? \[\]\)\.length > 0\)\);/);
  assert.match(twitchCard, /mutationFn: \(\) => streamAlertsApi\.resubscribeTwitch\(accountId\)/);
  assert.match(twitchCard, /mutationFn: \(\) => streamAlertsApi\.disconnectTwitch\(accountId\)/);
  // The message for the trip back from Twitch waits for the API before it says "connected".
  assert.match(twitchCard, /twitchReturnNotice\(arrival, data \? Boolean\(link\) && !needsReconnect : null\)/);
  // Scope names are never shown.
  assert.doesNotMatch(twitchCard, /missing_scopes\.(map|join)/);
});

test('an editor sees the Twitch state and maps rewards, with none of the owner buttons', () => {
  // Both cards sit outside the owner-only block, once each.
  assert.equal(workspace.match(/<TwitchCard /g)?.length, 1);
  assert.equal(workspace.match(/<RewardsCard /g)?.length, 1);
  const ownerBlock = workspace.slice(workspace.indexOf('{isOwner && (\n          <div className="stream-accounts__cards" key={selected.id}>'));
  assert.ok(ownerBlock.indexOf(')}') < ownerBlock.indexOf('<TwitchCard '));
  assert.match(workspace, /<div className="stream-accounts__cards is-twitch" key=\{`twitch-\$\{selected\.id\}`\}>\s*<TwitchCard account=\{selected\} arrival=\{[^\n]+\} \/>\s*<RewardsCard account=\{selected\} \/>/);
  assert.match(twitchCard, /const isOwner = account\.role === 'owner';/);
  // Connect and Reconnect, Fix, Disconnect and its confirm step are each behind the owner check.
  assert.match(twitchCard, /\{isOwner && connectLink\('Connect Twitch'\)\}/);
  assert.match(twitchCard, /\{isOwner && connectLink\('Reconnect Twitch'\)\}/);
  assert.match(twitchCard, /\{isOwner && \(\s*<div className="stream-accounts__buttons">\s*<button type="button" className="is-primary" disabled=\{working\} onClick=\{\(\) => fix\.mutate\(\)\}>/);
  assert.match(twitchCard, /\{isOwner && !confirming && \(/);
  assert.match(twitchCard, /\{isOwner && confirming && \(/);
  assert.equal(twitchCard.match(/fix\.mutate\(\)/g)?.length, 1);
  for (const text of ['Only ${owner} can connect it.', 'Only ${owner} can reconnect it.', 'Only ${owner} can fix this.']) assert.ok(twitchCard.includes(text), text);
  // Rewards: the mapping selects are for everyone, Create reward for the owner only.
  assert.match(rewardsCard, /const unused = isOwner \? effectsWithoutReward\(effects, rewards\) : \[\];/);
  assert.match(rewardsCard, /\{unused\.length > 0 && \(\s*<div className="stream-rewards__create">/);
  assert.equal(rewardsCard.match(/create\.mutate\(/g)?.length, 1);
  assert.doesNotMatch(rewardsCard, /disconnectTwitch|resubscribeTwitch/);
  assert.doesNotMatch(tab, /getTwitch|disconnectTwitch|resubscribeTwitch|getRewards|setRewardMapping|createReward/);
});

test('disconnecting Twitch goes through an in-page confirm step', () => {
  for (const source of [twitchCard, rewardsCard]) assert.doesNotMatch(source, /window\.confirm|\bconfirm\(|\balert\(|\bprompt\(/);
  // Disconnect runs only from the confirm step, which opens on Cancel.
  assert.equal(twitchCard.match(/disconnect\.mutate\(\)/g)?.length, 1);
  const confirm = twitchCard.slice(twitchCard.indexOf('{isOwner && confirming && ('), twitchCard.indexOf('{shownNotice && ('));
  assert.match(confirm, /role="group" aria-label="Confirm disconnecting Twitch"/);
  assert.match(confirm, /className="is-danger" disabled=\{working\} onClick=\{\(\) => disconnect\.mutate\(\)\}/);
  assert.match(confirm, /autoFocus disabled=\{working\} onClick=\{closeConfirm\}>Cancel</);
  assert.ok(confirm.includes('Disconnect Twitch?'));
  assert.ok(confirm.includes('what each reward was set to do is forgotten. The rewards themselves stay on your Twitch channel.'));
  assert.match(twitchCard, /onClick=\{\(\) => \{ startAction\(\); setConfirming\(true\); \}\}/);
  // Afterwards the card shows not connected at once and the status (recent alerts intro) is read again.
  assert.match(twitchCard, /setQueryData<StreamAlertTwitchState>\(twitchKey, \(old\) => \(old \? \{ \.\.\.old, connected: false, twitch: null \} : old\)\);/);
  assert.match(twitchCard, /queryClient\.invalidateQueries\(\{ queryKey: statusKey \}\);/);
});

test('the page reads ?twitch= once, keeps the result for that account and removes only that parameter', () => {
  const effect = workspace.slice(workspace.indexOf('useEffect(() => {'), workspace.indexOf('const selectAccount'));
  assert.match(effect, /if \(!me\.data \|\| linkChecked\.current\) return;\s*linkChecked\.current = true;/);
  assert.match(effect, /const back = readTwitchReturn\(params\);/);
  assert.match(effect, /if \(!missed && !back\.present\) return;/);
  // Shown only to the owner of the account the address names.
  assert.match(effect, /const account = me\.data\.accounts\.find\(\(item\) => item\.id === back\.accountId\);\s*if \(back\.result && account\?\.role === 'owner'\) \{\s*setTwitchArrival\(\{ accountId: account\.id, result: back\.result \}\);/);
  // The Twitch state is asked for again.
  assert.match(effect, /for \(const queryKey of \[twitchQueryKey\(account\.id\), rewardsQueryKey\(account\.id\), \['stream-alerts', account\.id, 'status'\]\]\) \{[\s\S]*?queryClient\.invalidateQueries\(\{ queryKey \}, \{ cancelRefetch: false \}\);/);
  // One address write, replacing the history entry, that keeps ?account= unless that account cannot be opened.
  assert.match(effect, /const next = withoutTwitchResult\(params\);\s*if \(missed\) next\.delete\(ACCOUNT_PARAM\);\s*setParams\(next, \{ replace: true \}\);/);
  assert.equal(effect.match(/setParams\(/g)?.length, 1);
  assert.doesNotMatch(effect, /writeAccountParam/);
  // The result is not kept anywhere that outlives the visit.
  for (const source of [workspace, twitchCard]) assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.match(accountUtils, /export const TWITCH_RESULT_PARAM = 'twitch';/);
  assert.match(accountUtils, /export const TWITCH_RESULTS = \['connected', 'denied', 'missing_scopes', 'in_use', 'expired', 'error'\] as const;/);
});

test('each reward row maps to "Nothing" or an effect from the API, with a "when" choice once mapped', () => {
  assert.match(rewardsCard, /queryFn: \(\) => streamAlertsApi\.getRewards\(accountId\)/);
  assert.match(rewardsCard, /<option value="">Nothing<\/option>\s*\{effects\.map\(\(effect\) => <option key=\{effect\.name\} value=\{effect\.name\}>\{effect\.label\}<\/option>\)\}/);
  assert.match(rewardsCard, /\{ value: 'redeemed', label: 'When it is redeemed' \},\s*\{ value: 'fulfilled', label: 'When a mod marks it done' \},/);
  // The second choice exists only for a mapped reward.
  assert.match(rewardsCard, /\{mapping && \(\s*<label>\s*<span>When it plays<\/span>/);
  assert.match(rewardsCard, /aria-label=\{`What \$\{reward\.title\} does`\}/);
  assert.match(rewardsCard, /aria-label=\{`When \$\{reward\.title\} plays`\}/);
  assert.match(rewardsCard, /<strong>\{reward\.title\}<\/strong>\s*<span>\s*\{rewardCost\(reward\.cost\)\}\s*\{note && <em>\{note\}<\/em>\}/);
  assert.match(rewardsCard, /const note = rewardNote\(reward\);/);
  // Choosing an effect keeps the "when" already chosen and starts at "redeemed"; "Nothing" clears the mapping.
  assert.match(rewardsCard, /save\(effect \? \{ effect: effect\.name, on: mapping\?\.on \?\? 'redeemed' \} : null\);/);
  assert.match(rewardsCard, /streamAlertsApi\.setRewardMapping\(accountId, reward\.id, sending \?\? \{ effect: null \}\)/);
  for (const text of ['Loading the rewards from Twitch…', 'No channel point rewards yet.', 'Could not load the rewards: ',
    'Twitch is not connected any more, so the rewards cannot be shown.', 'Refresh from Twitch', 'Channel point rewards']) {
    assert.ok(rewardsCard.includes(text), text);
  }
  // The card exists only while Twitch is connected and working.
  assert.match(rewardsCard, /if \(!link \|\| link\.status !== 'connected'\) return null;\s*return <RewardsList account=\{account\} \/>;/);
});

test('a reward saves by itself per row: shown at once, then saved, or put back with the reason', () => {
  // The choice in flight is row state, so a failure only has to drop it to show the confirmed mapping again.
  assert.match(rewardsCard, /const mapping = draft !== undefined \? draft : reward\.mapping;/);
  assert.match(rewardsCard, /const save = async \(next: StreamRewardMapping \| null\) => \{\s*setDraft\(next\);\s*setPhase\(\{ kind: 'saving' \}\);/);
  assert.match(rewardsCard, /\} catch \(error\) \{\s*line\.waiting = false;\s*if \(mounted\.current\) \{[\s\S]*?setDraft\(undefined\);\s*setPhase\(\{ kind: 'error', text: `Could not save, so this reward is unchanged: \$\{plainError\(error\)\}` \}\);/);
  assert.match(rewardsCard, /setDraft\(undefined\);\s*setPhase\(\{ kind: 'saved' \}\);/);
  assert.match(rewardsCard, /\{phase\.kind === 'saving' && 'Saving…'\}\s*\{phase\.kind === 'saved' && 'Saved'\}\s*\{phase\.kind === 'error' && phase\.text\}/);
  assert.match(rewardsCard, /role=\{phase\.kind === 'error' \? 'alert' : 'status'\}/);
  // The selects stay usable while saving (no lost keyboard focus); saves for one reward go out in order.
  assert.doesNotMatch(rewardsCard, /<select[^>]*disabled/);
  assert.match(rewardsCard, /if \(line\.running\) return;\s*line\.running = true;\s*try \{\s*while \(line\.waiting\) \{/);
  // A confirmed mapping goes into the loaded list, after stopping a read that could put the old one back.
  assert.match(rewardsCard, /await queryClient\.cancelQueries\(\{ queryKey: rewardsKey \}\);\s*queryClient\.setQueryData<StreamRewards>\(rewardsKey, \(old\) => \(\s*old \? \{ \.\.\.old, rewards: withRewardMapping\(old\.rewards, rewardId, mapping\) \} : old/);
  assert.match(rewardsCard, /<RewardRow key=\{reward\.id\} accountId=\{accountId\} reward=\{reward\} effects=\{effects\} onSaved=\{applyMapping\} \/>/);
});

test('the owner can create the standard reward for an effect no reward plays, with the refusal shown beside it', () => {
  assert.match(rewardsCard, /mutationFn: \(effect: StreamRewardEffectOption\) => streamAlertsApi\.createReward\(accountId, effect\.name\)/);
  assert.match(rewardsCard, /aria-label=\{`Create a reward for \$\{effect\.label\}`\}\s*disabled=\{create\.isPending\}\s*onClick=\{\(\) => create\.mutate\(effect\)\}/);
  assert.ok(rewardsCard.includes("'Create reward'"));
  // The API's 409 sentence ("A reward with that name already exists. Map it instead.") lands in that effect's row.
  assert.match(rewardsCard, /onError: \(error, effect\) => setCreateErrors\(\(old\) => \(\{ \.\.\.old, \[effect\.name\]: plainError\(error\) \}\)\),/);
  assert.match(rewardsCard, /\{createErrors\[effect\.name\] && \(\s*<p className="stream-accounts__notice is-error" role="alert">\{createErrors\[effect\.name\]\}<\/p>/);
  // The list is read again either way, so a reward made on Twitch meanwhile shows up to be mapped.
  assert.match(rewardsCard, /onSettled: \(\) => queryClient\.invalidateQueries\(\{ queryKey: rewardsKey \}\),/);
  assert.ok(rewardsCard.includes('Create reward adds a new reward to your Twitch channel at a standard cost and sets it to play the effect.'));
  // Costs come from the API answer, not from a second copy on the page.
  assert.match(rewardsCard, /`Created "\$\{reward\.title\}" for \$\{rewardCost\(reward\.cost\)\} on your Twitch channel\.`/);
  assert.doesNotMatch(rewardsCard, /\b(300|1000|1500|2500)\b/);
});

test('Twitch state, rewards and their messages belong to one account', () => {
  // Both cards remount per account, so notices, an open confirm step and row states go with them.
  assert.match(workspace, /className="stream-accounts__cards is-twitch" key=\{`twitch-\$\{selected\.id\}`\}/);
  assert.match(accountUtils, /export const twitchQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'twitch'\] as const;/);
  assert.match(accountUtils, /export const rewardsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'rewards'\] as const;/);
  for (const source of [twitchCard, rewardsCard]) {
    assert.match(source, /const accountId = account\.id;/);
    assert.match(source, /const twitchKey = twitchQueryKey\(accountId\);/);
    assert.doesNotMatch(source, /queryKey: \[/);
  }
  assert.match(rewardsCard, /const rewardsKey = rewardsQueryKey\(accountId\);/);
  // Rewards are not kept once the card is gone: after a disconnect an old copy would show mappings that no longer exist.
  assert.match(rewardsCard, /queryKey: rewardsKey,\s*queryFn: \(\) => streamAlertsApi\.getRewards\(accountId\),[\s\S]*?gcTime: 0,/);
  // The message from Twitch is tied to the account it was about and dropped when the account is switched.
  assert.match(workspace, /arrival=\{twitchArrival\?\.accountId === selected\.id \? twitchArrival\.result : null\}/);
  assert.match(workspace, /const switchAccount = \(id: number\) => \{\s*setPendingAccount\(null\);\s*setUnsavedDesign\(null\);\s*setLinkMissed\(false\);[\s\S]*?setTwitchArrival\(null\);\s*writeAccountParam\(id\);/);
});

test('the recent alerts intro says where real Twitch alerts stand', () => {
  assert.match(tab, /const twitchConnected = status\.data\?\.twitch\?\.status === 'connected';/);
  const intro = tab.slice(tab.indexOf('<h3>Recent alerts</h3>'), tab.indexOf('className="stream-alerts__recent-tools"'));
  assert.match(intro, /\{!account\.legacy_overlay && \(twitchConnected\s*\? 'Real Twitch alerts and test alerts sent from this page, newest first\.[^']*'\s*: 'Test alerts sent from this page, newest first\. Real Twitch alerts appear here too once Twitch is connected\.[^']*'\)\}/);
  assert.match(intro, /\{account\.legacy_overlay && \(twitchConnected/);
  assert.doesNotMatch(intro, /Twitch alerts are not connected to a hosted link yet/);
  assert.doesNotMatch(intro, /—/);
});

test('the Twitch and rewards cards keep touch targets, focus rings and narrow screens in shape', () => {
  assert.match(accountsCss, /\.stream-accounts a\.stream-accounts__link-button \{[^}]*min-height: 44px; max-width: 100%;/);
  assert.match(accountsCss, /\.stream-accounts a\.stream-accounts__link-button:focus-visible \{ outline: 2px solid var\(--primary-color\); outline-offset: 2px; \}/);
  assert.match(accountsCss, /\.stream-twitch:focus-visible \{ outline: 2px solid var\(--primary-color\)/);
  // The reward selects are form controls, so the 44px and focus rules of the account area already apply to them.
  assert.equal(rewardsCard.match(/<select\s+className="form-control"/g)?.length, 2);
  assert.match(accountsCss, /\.stream-rewards \{ container: stream-rewards \/ inline-size; \}/);
  assert.match(accountsCss, /@container stream-rewards \(max-width: 640px\) \{\s*\.stream-rewards__row \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(accountsCss, /\.stream-rewards__choices select \{ width: 190px; max-width: 100%; \}/);
  assert.match(accountsCss, /@container stream-accounts \(min-width: 900px\) \{\s*\.stream-accounts__cards\.is-twitch \{ grid-template-columns:/);
  assert.match(accountsCss, /\.stream-accounts__cards > :only-child \{ grid-column: 1 \/ -1; \}/);
  assert.match(accountsCss, /\.stream-rewards__name strong \{[^}]*overflow-wrap: anywhere;/);
});

/* ---- Media library and alert designs ---- */

const mediaCard = read('src/pages/stream-alerts/MediaLibraryCard.tsx');
const designsCard = read('src/pages/stream-alerts/AlertDesignsCard.tsx');
const stage = read('src/pages/stream-alerts/DesignStage.tsx');
const props = read('src/pages/stream-alerts/TextBoxProperties.tsx');
const previewHandle = read('src/pages/stream-alerts/previewHandle.ts');
const designFonts = read('src/pages/stream-alerts/designFonts.ts');
const designUtils = read('src/utils/streamAlertDesigns.ts');
const designsCss = read('src/pages/stream-alerts/StreamAlertDesigns.css');
const client = read('src/api/client.ts');

test('the client has one function per media and design route, each on the selected account', () => {
  assert.match(api, /uploadAsset: \(accountId: number, file: File, removeBlack: boolean, options\?: UploadOptions\) => \{[\s\S]*?form\.append\('file', file\);\s*if \(removeBlack\) form\.append\('remove_black', '1'\);\s*return api\.upload<\{ success: boolean; asset: StreamAlertAsset \}>\(`\$\{account\(accountId\)\}\/assets`, form, options\);/);
  assert.match(api, /getAssets: \(accountId: number\) =>\s*api\.fetch<StreamAlertAssets>\(`\$\{account\(accountId\)\}\/assets`\)/);
  assert.match(api, /getAsset: \(accountId: number, assetId: number\) =>\s*api\.fetch<[^>]+>\(`\$\{account\(accountId\)\}\/assets\/\$\{assetId\}`\)/);
  assert.match(api, /deleteAsset: \(accountId: number, assetId: number\) =>\s*api\.fetch<\{ success: boolean \}>\(`\$\{account\(accountId\)\}\/assets\/\$\{assetId\}`, \{ method: 'DELETE' \}\)/);
  assert.match(api, /getDesigns: \(accountId: number\) =>\s*api\.fetch<StreamAlertDesigns>\(`\$\{account\(accountId\)\}\/designs`\)/);
  assert.match(api, /saveDesign: \(accountId: number, kind: StreamAlertType, design: StreamAlertDesign\) =>[\s\S]*?`\$\{account\(accountId\)\}\/designs\/\$\{kind\}`, \{\s*method: 'PUT',\s*body: JSON\.stringify\(design\)/);
  assert.match(api, /resetDesign: \(accountId: number, kind: StreamAlertType\) =>\s*api\.fetch<\{ success: boolean \}>\(`\$\{account\(accountId\)\}\/designs\/\$\{kind\}`, \{ method: 'DELETE' \}\)/);
  // The asset object and the design follow the contract's names.
  for (const field of ['original_name: string;', 'url: string | null;', 'duration_ms: number | null;', 'has_alpha: boolean;', 'has_audio: boolean;', 'font_family: string | null;', 'error: string | null;', 'in_use: StreamAlertType[];',
    'appear_ms: number;', 'disappear_ms: number | null;', "entrance: StreamAlertTextEntrance;", "fit: StreamAlertTextFit;", 'weight: 400 | 700;', 'fonts: { family: string; url: string }[];']) {
    assert.ok(api.includes(field), field);
  }
});

test('uploads report progress and send the session cookie like every other call', () => {
  assert.match(client, /function apiUpload<T>\(path: string, form: FormData, options: UploadOptions = \{\}\): Promise<T>/);
  assert.match(client, /const xhr = new XMLHttpRequest\(\);\s*xhr\.open\('POST', url\);\s*xhr\.withCredentials = true;/);
  assert.match(client, /xhr\.upload\.onprogress = /);
  assert.match(client, /if \(xhr\.status === 401\) clearExpiredSession\(\);/);
  // No Content-Type header: the browser sets the multipart boundary itself.
  assert.doesNotMatch(client.slice(client.indexOf('function apiUpload')), /setRequestHeader/);
  assert.match(client, /export const api = \{ fetch: apiFetch, upload: apiUpload \};/);
  // A refusal keeps its status and body, so a 400 can point at its `field`, while the message reads as before.
  assert.match(client, /throw new ApiError\(reason \?\? `API error \$\{response\.status\}`, response\.status,/);
  assert.doesNotMatch(client, /this\.name = /);
});

test('editors get the media library and the designer too, keyed to the account', () => {
  assert.match(workspace, /<div className="stream-accounts stream-designs-area" key=\{`designs-\$\{selected\.id\}`\}>\s*<MediaLibraryCard account=\{selected\} \/>\s*<AlertDesignsCard account=\{selected\} preview=\{previewRef\} onDirtyChange=\{setUnsavedDesign\} \/>/);
  // Not behind the owner check.
  const ownerBlock = workspace.slice(workspace.indexOf('{isOwner && ('), workspace.indexOf('</div>', workspace.indexOf('<EditorsCard ')));
  assert.doesNotMatch(ownerBlock, /MediaLibraryCard|AlertDesignsCard/);
  assert.doesNotMatch(mediaCard + designsCard, /role === 'owner' \?\? |isOwner &&/);
  for (const source of [mediaCard, designsCard]) {
    assert.match(source, /const accountId = account\.id;/);
    const keys = [...source.matchAll(/queryKey: ([^,}\s]+)/g)].map((match) => match[1]);
    assert.ok(keys.length > 0);
    for (const key of keys) assert.match(key, /^(assetsKey|designsKey)$/);
  }
  assert.match(designUtils, /export const assetsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'assets'\] as const;/);
  assert.match(designUtils, /export const designsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'designs'\] as const;/);
});

test('the media library polls every 3 seconds only while a file is converting', () => {
  assert.match(mediaCard, /const POLL_MS = 3_000;/);
  assert.match(mediaCard, /refetchInterval: \(query\) => \(assetsWaiting\(query\.state\.data\?\.assets\) \? POLL_MS : false\)/);
  assert.match(mediaCard, /streamAlertsApi\.uploadAsset\(accountId, file, removeBlack && canRemoveBlack\(file\), \{\s*onProgress:/);
  assert.match(mediaCard, /<progress max=\{100\}/);
  assert.match(mediaCard, /onDrop=\{\(event\) => \{ event\.preventDefault\(\); setDragging\(false\); send\(event\.dataTransfer\.files\); \}\}/);
  assert.match(mediaCard, /if \(file\.size > MAX_UPLOAD_BYTES\)/);
  for (const text of ['Remove black background (videos and pictures)', 'It can also eat very dark parts of the picture.',
    'export it from After Effects as QuickTime, Apple ProRes 4444, RGB + Alpha', 'Yes, delete', 'Cancel']) {
    assert.ok(mediaCard.includes(text), text);
  }
  assert.ok(designUtils.includes("'Converting…'"));
  // Delete runs only from its in-page confirm step, and a refusal (the in-use 409) shows inside it.
  const confirm = mediaCard.slice(mediaCard.indexOf('{confirming && ('), mediaCard.indexOf('</li>'));
  assert.match(confirm, /onClick=\{\(\) => remove\.mutate\(\)\}/);
  assert.match(confirm, /\{refusal && <p className="stream-accounts__notice is-error" role="alert">\{refusal\}<\/p>\}/);
  assert.equal(mediaCard.match(/remove\.mutate\(/g)?.length, 1);
});

test('the designer has a tab per kind, Save, Discard, Preview, Send to OBS and the built-in reset behind a confirm', () => {
  assert.match(designsCard, /role="tablist" aria-label="Alert kind"/);
  assert.match(designsCard, /role="tab"/);
  for (const text of ['Custom', 'Built-in', 'Make a custom design', 'Discard changes', 'Preview', 'Send to OBS', 'Use the built-in card',
    'Yes, use the built-in card', 'Discard changes and switch', 'Keep editing', 'Sample values for the preview',
    'Custom alerts play on the OBS link (the hosted overlay)', 'keeps the built-in look until OBS is moved to the OBS link']) {
    assert.ok(designsCard.includes(text), text);
  }
  assert.match(designsCard, /\{account\.legacy_overlay && \(/);
  assert.equal(designsCard.match(/reset\.mutate\(/g)?.length, 1);
  const confirm = designsCard.slice(designsCard.indexOf('{confirmReset && base && ('), designsCard.indexOf('{generalProblem &&'));
  assert.match(confirm, /onClick=\{\(\) => reset\.mutate\(kind\)\}/);
  assert.match(confirm, /autoFocus disabled=\{reset\.isPending\} onClick=\{\(\) => setConfirmReset\(false\)\}>Cancel</);
  // Send to OBS uses the existing test route, which plays the saved design.
  assert.match(designsCard, /streamAlertsApi\.fireAlert\(accountId, sampleTestInput\(kind, samples\)\)/);
  assert.match(designsCard, /streamAlertsApi\.saveDesign\(accountId, input\.kind, input\.design\)/);
  assert.match(designsCard, /streamAlertsApi\.resetDesign\(accountId, kindReset\)/);
});

test('unsaved changes are never lost silently: switching kind or account asks in the page first', () => {
  assert.match(designsCard, /if \(dirty\) \{ setPendingKind\(next\); return; \}/);
  assert.match(designsCard, /useEffect\(\(\) => \{ onDirtyChange\(dirty \? KIND_LABELS\[kind\] : null\); \}, \[dirty, kind, onDirtyChange\]\);/);
  assert.match(designsCard, /window\.addEventListener\('beforeunload', warn\);/);
  assert.match(workspace, /if \(unsavedDesign && id !== selected\?\.id\) \{\s*setPendingAccount\(id\);\s*return;\s*\}/);
  assert.match(workspace, /onClick=\{\(\) => switchAccount\(pendingAccount\)\}>Discard changes and switch</);
  for (const source of [workspace, mediaCard, designsCard, stage, props, tab]) assert.doesNotMatch(source, /window\.confirm|\bconfirm\(|\balert\(|\bprompt\(/);
});

test('a save refusal is shown beside the field the API names', () => {
  assert.match(designsCard, /const field = normalizeField\(error instanceof ApiError \? error\.body\.field : null\) \?\? '';/);
  assert.match(designsCard, /setServerProblem\(\{ field, error: plainError\(error\) \}\);/);
  assert.match(designsCard, /if \(serverProblem\?\.field === field\) return serverProblem\.error;/);
  assert.match(designsCard, /problem=\{\(name\) => problemFor\(`texts\.\$\{selected\}\.\$\{name\}`\)\}/);
  for (const field of ['video', 'sound', 'duration_ms', 'scale', 'volume', 'texts']) assert.ok(designsCard.includes(`problemFor('${field}')`), field);
  for (const field of ['template', 'font', 'size', 'color', 'appear_ms', 'disappear_ms']) assert.ok(props.includes(`problem('${field}')`), field);
  assert.match(props, /role="alert"/);
});

test('the stage drags with pointer events, nudges with the arrow keys and resizes from a corner handle', () => {
  assert.match(stage, /setPointerCapture\(event\.pointerId\)/);
  assert.match(stage, /onPointerMove=\{onPointerMove\}/);
  assert.match(stage, /onPointerDown=\{\(event\) => startDrag\(event, 'media'\)\}\s*onKeyDown=\{keyMedia\}/);
  assert.match(stage, /onPointerDown=\{\(event\) => startDrag\(event, 'resize', index\)\}\s*onKeyDown=\{\(event\) => keyBox\(event, index, 'resize'\)\}/);
  assert.match(stage, /moveMedia\(current\.start, screenToStage\(dx, scale\), screenToStage\(dy, scale\)\)/);
  assert.match(stage, /const visible = boxVisibleAt\(text, time\);/);
  assert.match(stage, /fillTemplate\(text\.template, values\)/);
  // The template is drawn as text, never as HTML.
  assert.doesNotMatch(stage + props + designsCard, /dangerouslySetInnerHTML|innerHTML/);
  // The timeline seeks the real video and marks each box's appear and disappear time.
  assert.match(stage, /element\.currentTime = target;/);
  assert.match(stage, /stream-timeline__marker is-\$\{marker\.kind\}/);
  assert.match(props, /set\(\{ appear_ms: Math\.round\(time\) \}\)/);
  assert.match(props, /set\(\{ disappear_ms: Math\.round\(time\) \}\)/);
});

test('the properties panel offers only the kind variables as chips and the shared font list', () => {
  assert.match(props, /\{variables\.map\(\(name\) => \(/);
  assert.match(designsCard, /const variables = variablesFor\(kind, data\?\.variables\?\.\[kind\]\);/);
  assert.match(props, /insertAtCursor\(text\.template, input\?\.selectionStart \?\? null, input\?\.selectionEnd \?\? null, `\{\$\{name\}\}`\)/);
  assert.match(props, /templateProblem\(text\.template, kind, variables\)/);
  assert.match(props, /style=\{\{ fontFamily: fontCss\(font\) \}\}/);
  assert.match(props, /value=\{`asset:\$\{asset\.id\}`\}/);
  assert.match(designsCard, /const fonts = data\?\.fonts\?\.length \? data\.fonts : DESIGN_FONTS;/);
  assert.match(designFonts, /googleFontsHref\(fonts\)/);
  assert.match(designFonts, /new FontFace\(family, /);
});

test('Preview plays the draft through the panel preview frame, and says so when its overlay copy is too old', () => {
  assert.match(designsCard, /const resolved = resolveDraft\(draft, assets\);/);
  assert.match(designsCard, /saved\[kind\] = resolved;/);
  assert.match(designsCard, /handle\.playDesign\(saved, kind, sampleFireOptions\(kind, samples\),/);
  assert.match(designsCard, /result === 'unsupported'/);
  assert.ok(designsCard.includes('an older copy of the overlay that cannot show custom designs yet'));
  assert.match(tab, /if \(typeof fx\.applyDesigns !== 'function'\) return 'unsupported';/);
  assert.match(tab, /await fx\.applyDesigns\(designs\);\s*draftInFrame\.current = true;\s*fx\.fire\(kind, options\);/);
  // The frame keeps the saved designs (also after it reloads), so the panel's own previews look like OBS.
  assert.match(tab, /onLoad=\{\(\) => \{ void applySavedDesigns\(\); \}\}/);
  assert.match(designsCard, /preview\.current\?\.setSavedDesigns\(data\.resolved \?\? \{\}\)/);
  assert.match(previewHandle, /export interface PreviewHandle \{/);
  assert.match(previewHandle, /'played' \| 'loading' \| 'unsupported' \| 'failed'/);
});

test('the media and design cards keep touch targets, focus rings and narrow screens in shape', () => {
  assert.match(designsCss, /\.stream-stage__outer \{[^}]*overflow: auto;/);
  assert.match(designsCss, /\.stream-designs \{ container: stream-designs \/ inline-size; \}/);
  assert.match(designsCss, /@container stream-designs \(max-width: 520px\)/);
  assert.match(designsCss, /\.stream-accounts \[tabindex\]:focus-visible \{ outline: 2px solid var\(--primary-color\)/);
  assert.match(designsCss, /\.stream-props__colour input\[type="color"\] \{[^}]*width: 44px; height: 44px;/);
  assert.match(designsCss, /\.stream-media__check, \.stream-props__check \{[^}]*min-height: 44px;/);
  assert.match(designsCss, /\.stream-timeline__track input\[type="range"\] \{[^}]*min-height: 44px;/);
  // Their buttons and inputs live inside .stream-accounts, so the 44px and focus rules of the account area apply.
  assert.match(workspace, /className="stream-accounts stream-designs-area"/);
});

test('the new media and design wording uses no em dashes', () => {
  for (const source of [mediaCard, designsCard, stage, props, designUtils, previewHandle, workspace]) assert.doesNotMatch(source, /—/);
});
