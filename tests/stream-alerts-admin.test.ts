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
const shell = read('src/pages/stream-alerts/AlertBoxShell.tsx');
const previewPane = read('src/pages/stream-alerts/PreviewPane.tsx');
const eventPage = read('src/pages/stream-alerts/AlertEventPage.tsx');
const testMenu = read('src/pages/stream-alerts/TestMenu.tsx');
const generalPage = read('src/pages/stream-alerts/GeneralSettingsPage.tsx');
const globalPage = read('src/pages/stream-alerts/GlobalEditingPage.tsx');
const lookForm = read('src/pages/stream-alerts/LookForm.tsx');
const boxUtils = read('src/utils/streamAlertBox.ts');
const boxCss = read('src/pages/stream-alerts/StreamAlertBox.css');
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
  assert.match(workspace, /<AlertBoxShell\s*key=\{selected\.id\}\s*account=\{selected\}/);
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
  // The Test menu sends every kind (and each variation); each event page sends its own look.
  assert.match(testMenu, /streamAlertsApi\.fireAlert\(account\.id, \{ \.\.\.sampleTestInput\(input\.kind, samples\), variation: input\.variation \}\)/);
  assert.match(testMenu, /\{kindsFor\(account\.legacy_overlay\)\.map\(\(kind\) => \{/);
  assert.match(eventPage, /streamAlertsApi\.fireAlert\(accountId, \{ \.\.\.sampleTestInput\(kind, samples\), variation: variation \? variation\.id : 'base' \}\)/);
  assert.match(eventPage, />\s*\{sendToObs\.isPending \? 'Sending…' : 'Send to OBS'\}/);
  assert.match(tab, /Replay in OBS/);
  assert.match(tab, /streamAlertsApi\.replayAlert\(accountId, id\)/);
});

test('the preview frame loads the hosted overlay without connecting to anything', () => {
  assert.match(previewPane, /src="\/stream-overlay\/effects\.html\?offline=1"/);
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
    'overlay-url', 'overlay-key/regenerate', 'editors', 'alerts', 'alerts/${kind}', 'alert-settings', 'alerts/apply-defaults', 'moderation']) {
    assert.ok(api.includes('`${account(accountId)}/' + path), path);
  }
  assert.match(api, /getMe: \(\) =>\s*api\.fetch<StreamAlertsMe>\(`\$\{BASE\}\/me`\)/);
  assert.match(api, /createAccount: \(\) =>[\s\S]*?`\$\{BASE\}\/accounts`, \{ method: 'POST' \}/);
  assert.match(api, /removeEditor: \(accountId: number, discordId: string\) =>[\s\S]*?\/editors\/\$\{encodeURIComponent\(discordId\)\}`, \{ method: 'DELETE' \}/);
  assert.match(api, /deleteAccount: \(accountId: number\) =>[\s\S]*?account\(accountId\), \{ method: 'DELETE' \}/);
  // Every function for a route under an account takes the account id first.
  const functions = [...api.matchAll(/^  (\w+): \(([^)]*)\)/gm)].map((match) => [match[1], match[2]]);
  assert.equal(functions.length, 35);
  for (const [name, args] of functions) {
    if (name === 'getMe' || name === 'createAccount') assert.equal(args, '', name);
    else assert.match(args, /^accountId: number/, name);
  }
  // The stream alert client moved out of the admin client, and nothing calls the old routes.
  assert.doesNotMatch(adminApi, /stream-alerts|StreamAlert|StreamEffect/);
  for (const source of [api, workspace, shell, tab, obsLink, editorsCard, twitchCard, rewardsCard, eventPage, testMenu, generalPage, globalPage]) assert.doesNotMatch(source, /\/api\/admin\/stream-alerts|adminApi/);
  assert.doesNotMatch(tab, /Bearer|overlay key value|STREAM_ALERTS_OVERLAY_KEY/);
});

test('live controls reach OBS through the account control and settings routes', () => {
  assert.match(api, /export interface StreamAlertSettings \{/);
  assert.match(api, /export type StreamAlertControlAction = 'skip' \| 'clear' \| 'pause' \| 'resume' \| 'safe_mode_on' \| 'safe_mode_off' \| 'stop_effects'/);
  assert.match(api, /settings: StreamAlertSettings;/);
  assert.match(api, /sendControl: \(accountId: number, action: StreamAlertControlAction\)[\s\S]*?`\$\{account\(accountId\)\}\/control`, \{\s*method: 'POST'/);
  assert.match(api, /updateSettings: \(accountId: number, [\s\S]*?`\$\{account\(accountId\)\}\/settings`, \{\s*method: 'PUT'/);
  assert.match(tab, /streamAlertsApi\.sendControl\(accountId, action\)/);
  // The smallest raid and cheer are General settings minimums now (the API keeps the old settings in step).
  assert.match(generalPage, /streamAlertsApi\.saveAlertSettings\(account\.id, generalSettingsPart\(input\)\)/);
});

test('the top bar offers skip, pause, clear, Safe Mode and stop effects; the limits are General settings minimums', () => {
  for (const text of ['Live controls', 'Skip alert', 'Pause alerts', 'Resume alerts', 'Clear waiting', 'Stop effects',
    'Follow and raid alerts are hidden until you turn it off']) {
    assert.ok(tab.includes(text), text);
  }
  for (const action of ['skip', 'clear', 'pause', 'resume', 'safe_mode_on', 'safe_mode_off']) assert.match(tab, new RegExp(`'${action}'`));
  // Live controls sit in the top bar, above the menu and the page.
  assert.ok(shell.indexOf('<LiveControls account={account} preview={preview} />') < shell.indexOf('className="stream-box__body"'));
  assert.ok(shell.indexOf('className="stream-box__top"') < shell.indexOf('<LiveControls '));
  assert.match(boxUtils, /\{ kind: 'raid', label: 'Raids', unit: 'viewers' \}/);
  assert.match(boxUtils, /\{ kind: 'cheer', label: 'Bits', unit: 'bits' \}/);
});

test('the preview mirrors skip and clear only when its overlay copy supports them', () => {
  assert.match(previewPane, /fx\?\.skip\?\.\(\)/);
  assert.match(previewPane, /fx\?\.clear\?\.\(\)/);
  assert.match(previewPane, /typeof fx\?\.queue === 'function'/);
  assert.match(previewPane, /Preview a follow flood/);
  assert.match(previewPane, /counting follows only/);
  assert.match(tab, /preview\.current\?\.mirror\(action\)/);
  assert.doesNotMatch(previewPane + tab, /fx\?\.(pause|resume|applySettings)/);
});

test('a new preview cuts off the one before it', () => {
  assert.match(previewPane, /stop\?: \(\) => void/);
  assert.match(previewPane, /stopPreview\(\);\s*try \{\s*fx\.fire\(name, options\);/);
  assert.match(previewPane, /overlayFX\(\)\?\.stop\?\.\(\)/);
  assert.match(previewPane, />Stop preview</);
});

test('stop effects ends channel point effects in OBS and mirrors in the preview when supported', () => {
  assert.match(tab, /stop_effects: \{ done: 'Stopped the effects in OBS\.'/);
  assert.match(tab, /runControl\('stop_effects'\)/);
  assert.match(tab, />\s*Stop effects\s*</);
  assert.match(tab, /title="Ends a running channel point effect, such as Flood\. Alert cards stay\."/);
  assert.match(previewPane, /stopEffects\?: \(\) => void/);
  assert.match(previewPane, /typeof fx\?\.stopEffects === 'function'\) fx\.stopEffects\(\)/);
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

test('the channel point effects sit under Channel points, each with Preview and Send to OBS', () => {
  const effects = [...tab.matchAll(/\{ name: '(\w+)', label: '/g)].map((match) => match[1]);
  assert.deepEqual(effects, ['boop', 'meteor', 'news', 'flood', 'rewind']);
  // Blackout was removed on 2026-11-22: the overlay must not still carry it.
  assert.doesNotMatch(overlay, /blackout/i);
  for (const effect of effects) assert.match(overlay, new RegExp(`^    ${effect}: function`, 'm'));
  const listStart = tab.indexOf('className="stream-alerts__kinds is-effects"');
  assert.ok(tab.indexOf('>Channel point effects</h3>') < listStart);
  const list = tab.slice(listStart, tab.indexOf('</ul>', listStart));
  assert.match(list, /onClick=\{\(\) => previewEffect\(effect\)\}>Preview</);
  assert.match(list, /disabled=\{fireEffect\.isPending \|\| !status\.data\?\.configured\}\s*onClick=\{\(\) => sendEffect\(effect\)\}\s*>\s*Send to OBS/);
  assert.match(tab, /preview\.current\?\.play\(effect\.name, /);
  assert.match(tab, /name: 'news', label: 'Breaking News', accent: '[^']+', usesMessage: true/);
  assert.match(shell, /<RewardsCard account=\{account\} \/>\s*<ChannelEffects account=\{account\} preview=\{preview\}/);
  // Flood and stop stay under the preview.
  const rewards = previewPane.slice(previewPane.indexOf('className="stream-alerts__rewards"'));
  assert.match(rewards, /Preview a follow flood/);
  assert.match(rewards, />Stop preview</);
});

test('the page loads /me and handles loading, failure, no access and no account', () => {
  assert.match(workspace, /useQuery\(\{ queryKey: ME_KEY, queryFn: \(\) => streamAlertsApi\.getMe\(\) \}\)/);
  assert.match(workspace, /if \(me\.isLoading\) \{\s*return <p className="stream-accounts__state" role="status">Loading your stream alerts…<\/p>;/);
  assert.match(workspace, /if \(!me\.data\) \{[\s\S]*?role="alert"[\s\S]*?Could not load your stream alerts\.[\s\S]*?onClick=\{\(\) => me\.refetch\(\)\}/);
  assert.match(workspace, /const canSetUp = me\.data\.can_create && me\.data\.own_account_id === null;/);
  for (const text of ['Set up stream alerts', 'You do not have stream alerts yet.', 'Stream alerts are not open to your account yet.',
    'Could not set up stream alerts: ', 'Your stream alerts are set up. Next, copy your OBS link at the top and add it to OBS.']) {
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
  assert.match(workspace, /const switcher = accounts\.length > 1 && \(\s*<div className="stream-accounts__switch stream-box__switch" role="group"/);
  assert.match(shell, /<div className="stream-box__top-row">\s*\{switcher\}/);
  assert.match(workspace, /aria-pressed=\{account\.id === selected\.id\}\s*onClick=\{\(\) => selectAccount\(account\.id\)\}\s*>\s*\{accountLabel\(account\)\}/);
  assert.match(workspace, /next\.set\(ACCOUNT_PARAM, String\(id\)\);/);
  assert.match(workspace, /\}, \{ replace: true \}\);/);
  assert.ok(workspace.includes('You do not have access to the stream alerts in that link'));
});

test('owner-only cards are gated on the owner role, and an editor is told whose alerts these are', () => {
  assert.match(workspace, /const isOwner = selected\.role === 'owner';/);
  assert.match(shell, /const isOwner = account\.role === 'owner';/);
  assert.match(shell, /\{isOwner \? <ObsLinkCard account=\{account\} compact \/> : \(/);
  assert.match(shell, /\{isOwner \? <EditorsCard account=\{account\} \/> : \(/);
  // The cards appear nowhere else, so an editor never mounts them or calls their routes.
  assert.equal(shell.match(/<ObsLinkCard /g)?.length, 1);
  assert.equal(shell.match(/<EditorsCard /g)?.length, 1);
  assert.doesNotMatch(workspace, /<ObsLinkCard |<EditorsCard /);
  for (const source of [workspace, shell]) assert.doesNotMatch(source, /getOverlayUrl|regenerateOverlayKey|getEditors/);
  assert.doesNotMatch(tab, /getOverlayUrl|regenerateOverlayKey|getEditors|addEditor|removeEditor/);
  assert.match(workspace, /\{!isOwner && \(\s*<p className="stream-accounts__who">\s*<strong>You are controlling \{ownerPossessive\(selected\.owner_username\)\} stream alerts\.<\/strong>/);
  assert.ok(workspace.includes('can see the OBS link, change the editors, or connect and disconnect Twitch.'));
  assert.ok(shell.includes('can see the OBS link.'));
});

test('everything shown for an account is keyed to it, so switching cannot carry anything over', () => {
  // The whole alert box remounts per account: drafts, notices, typed values and a shown link go with it.
  assert.match(workspace, /<AlertBoxShell\s*key=\{selected\.id\}/);
  assert.match(tab, /const accountId = account\.id;/);
  assert.match(tab, /export const statusQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'status'\];/);
  assert.match(tab, /export const recentQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'recent'\];/);
  assert.match(editorsCard, /const editorsKey = \['stream-alerts', accountId, 'editors'\];/);
  // No query key is written inline, and each one is an account key (or /me).
  for (const source of [workspace, shell, tab, testMenu, editorsCard, twitchCard, rewardsCard]) {
    const keys = [...source.matchAll(/queryKey: ([^,}\s]+)/g)].map((match) => match[1]);
    for (const key of keys) assert.match(key, /^(ME_KEY|statusKey|recentKey|editorsKey|twitchKey|rewardsKey|assetsKey|designsKey|alertsKey|settingsKey|(status|recent|assets)QueryKey\((accountId|account\.id)\))$/, key);
  }
  assert.match(tab, /queryClient\.setQueryData<StreamAlertStatus>\(statusQueryKey\(accountId\), /);
  assert.doesNotMatch(tab + shell, /\['admin', 'stream-alerts'/);
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
  // The whole alert box sits inside .stream-accounts, so the 44px and focus rules reach every page.
  assert.match(workspace, /<div className="stream-alerts-workspace stream-accounts">/);
});

test('new wording on the page uses no em dashes', () => {
  for (const source of [workspace, shell, tab, previewPane, obsLink, editorsCard, twitchCard, rewardsCard, accountUtils]) assert.doesNotMatch(source, /—/);
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
  // Both cards are mounted for everyone, once each, outside any owner check.
  assert.equal(shell.match(/<TwitchCard /g)?.length, 1);
  assert.equal(shell.match(/<RewardsCard /g)?.length, 1);
  assert.match(shell, /<TwitchCard account=\{account\} arrival=\{twitchArrival\} \/>\s*\{isOwner \? <EditorsCard/);
  assert.doesNotMatch(shell.slice(shell.indexOf("case 'channel-points':"), shell.indexOf("case 'media':")), /isOwner/);
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
  assert.match(effect, /const next = withoutTwitchResult\(params\);\s*if \(missed\) next\.delete\(ACCOUNT_PARAM\);\s*if \(back\.result && account\?\.role === 'owner'\) next\.set\(VIEW_PARAM, 'connections'\);\s*setParams\(next, \{ replace: true \}\);/);
  assert.equal(effect.match(/setParams\(/g)?.length, 1);
  assert.doesNotMatch(effect, /writeAccountParam/);
  // The result is not kept anywhere that outlives the visit.
  for (const source of [workspace, shell, twitchCard]) assert.doesNotMatch(source, /localStorage|sessionStorage/);
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
  // Both cards remount per account with the alert box, so notices, an open confirm step and row states go with them.
  assert.match(workspace, /<AlertBoxShell\s*key=\{selected\.id\}/);
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
  assert.match(workspace, /twitchArrival=\{twitchArrival\?\.accountId === selected\.id \? twitchArrival\.result : null\}/);
  assert.match(shell, /<TwitchCard account=\{account\} arrival=\{twitchArrival\} \/>/);
  assert.match(workspace, /const switchAccount = \(id: number\) => \{\s*setPendingAccount\(null\);\s*setUnsaved\(null\);\s*setLinkMissed\(false\);[\s\S]*?setTwitchArrival\(null\);\s*writeAccountParam\(id\);/);
});

test('the recent alerts intro says where real Twitch alerts stand', () => {
  assert.match(tab, /const twitchConnected = status\.data\?\.twitch\?\.status === 'connected';/);
  const intro = tab.slice(tab.indexOf('>Recent alerts</h3>'), tab.indexOf('className="stream-alerts__recent-tools"'));
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
const designsCard = read('src/pages/stream-alerts/CustomDesignEditor.tsx');
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

test('editors get the media library and every alert page too, keyed to the account', () => {
  assert.match(shell, /case 'media':[\s\S]*?<MediaLibraryCard account=\{account\} \/>/);
  assert.match(shell, /<AlertEventPage\s*key=\{kind\}\s*account=\{account\}/);
  // Not behind the owner check.
  for (const name of ['MediaLibraryCard', 'AlertEventPage', 'GeneralSettingsPage', 'GlobalEditingPage', 'ActivityList', 'TestMenu', 'LiveControls']) {
    assert.doesNotMatch(shell, new RegExp(`isOwner (&&|\\?) <${name}`), name);
  }
  assert.doesNotMatch(mediaCard + designsCard + eventPage, /role === 'owner' \?\? |isOwner &&/);
  assert.match(mediaCard, /const accountId = account\.id;/);
  for (const key of [...mediaCard.matchAll(/queryKey: ([^,}\s]+)/g)].map((match) => match[1])) assert.match(key, /^(assetsKey|designsKey|alertsQueryKey\(accountId\))$/);
  assert.match(shell, /const alertsKey = alertsQueryKey\(accountId\);\s*const settingsKey = alertSettingsQueryKey\(accountId\);/);
  assert.match(boxUtils, /export const alertsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'alerts'\] as const;/);
  assert.match(boxUtils, /export const alertSettingsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'alert-settings'\] as const;/);
  assert.match(designUtils, /export const assetsQueryKey = \(accountId: number\) => \['stream-alerts', accountId, 'assets'\] as const;/);
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

test('each alert page has Enabled, the three styles, Save settings, Discard, Preview and Send to OBS; Custom shows the designer', () => {
  for (const text of ['On: this alert shows in OBS', 'Save settings', 'Discard changes', 'Preview', 'Send to OBS', '+ Add variation', 'Move up', 'Move down',
    'Delete variation', 'Yes, delete it', 'Used when']) {
    assert.ok(eventPage.includes(text), text);
  }
  assert.match(boxUtils, /\{ value: 'classic', label: 'Classic'/);
  assert.match(boxUtils, /\{ value: 'preset', label: 'Preset'/);
  assert.match(boxUtils, /\{ value: 'custom', label: 'Custom'/);
  assert.match(lookForm, /\{look\.style === 'custom' && !defaults && \([\s\S]*?<CustomDesignEditor/);
  for (const text of ['Layout', 'Video or picture', 'Video volume', 'Message template', "Show the viewer&apos;s message under the alert", 'Shows for (seconds)',
    "Match the video&apos;s length", 'Text waits (seconds)', 'Acosmibot sound', 'No sound', 'Your sounds', 'Sound volume', 'Comes in with', 'Goes away with',
    'Text comes in with', 'Letter animation', 'Text goes away with', 'Font settings', 'Highlight colour']) {
    assert.ok(lookForm.includes(text), text);
  }
  assert.match(lookForm, /<details className="stream-box__card stream-box__font"/);
  for (const text of ['Make a custom design', 'Add text', 'Centre on screen']) assert.ok(designsCard.includes(text), text);
  // Delete runs only from its confirm step; the save is the kind's whole settings.
  assert.equal(eventPage.match(/removeVariation\(/g)?.length, 1);
  assert.match(eventPage, /streamAlertsApi\.saveAlert\(accountId, kind, alertForApi\(input, kind\)\)/);
  // Send to OBS uses the saved look: a variation that is not saved yet cannot be sent.
  assert.match(eventPage, /disabled=\{sendToObs\.isPending \|\| !savedVariation\}/);
});

test('unsaved changes are never lost silently: leaving the page or switching account asks in the page first', () => {
  assert.match(shell, /if \(wouldLose\(next\)\) \{\s*setPending\(/);
  assert.match(shell, /onClick=\{pending\.run\}>Discard changes and go</);
  assert.match(shell, /useEffect\(\(\) => \{ onDirtyChange\(dirtyLabel\); \}, \[dirtyLabel, onDirtyChange\]\);/);
  assert.match(shell, /window\.addEventListener\('beforeunload', warn\);/);
  // The kind and its variations share one draft, so moving between them keeps the changes.
  assert.match(shell, /\(alertDirty && alertDraft && !\(next\.page === 'alert' && next\.kind === alertDraft\.kind\)\)/);
  assert.match(workspace, /if \(unsaved && id !== selected\?\.id\) \{\s*setPendingAccount\(id\);\s*return;\s*\}/);
  assert.match(workspace, /onClick=\{\(\) => switchAccount\(pendingAccount\)\}>Discard changes and switch</);
  for (const source of [workspace, shell, eventPage, generalPage, globalPage, mediaCard, designsCard, stage, props, tab]) assert.doesNotMatch(source, /window\.confirm|\bconfirm\(|\balert\(|\bprompt\(/);
});

test('a save refusal is shown beside the field the API names', () => {
  assert.match(eventPage, /const field = apiField\(error instanceof ApiError \? error\.body\.field : null\);/);
  assert.match(eventPage, /setServerProblem\(\{ field, error: plainError\(error\) \}\);/);
  assert.match(eventPage, /if \(serverProblem\?\.field === field\) return serverProblem\.error;/);
  assert.match(eventPage, /problem=\{\(field\) => problemAt\(`\$\{lookPrefix\}\$\{field\}`\)\}/);
  assert.match(eventPage, /const lookPrefix = variation \? `variations\.\$\{index\}\.look\.` : 'look\.';/);
  // A refusal about another look says where it is, with a button to open it.
  assert.match(eventPage, /Open \{alert\.variations\[elsewhereVariation\]\.name \|\| 'that variation'\}/);
  assert.match(generalPage, /setServerProblem\(\{ field: apiField\(error instanceof ApiError \? error\.body\.field : null\), error: plainError\(error\) \}\)/);
  for (const field of ['video', 'sound', 'duration_ms', 'scale', 'volume', 'texts']) assert.ok(designsCard.includes(`problem('${field}')`), field);
  for (const field of ['template', 'font', 'size', 'color', 'appear_ms', 'disappear_ms']) assert.ok(props.includes(`problem('${field}')`), field);
  for (const field of ['template', 'duration_ms', 'text_delay_ms', 'sound', 'font.family', 'font.size', 'font.highlight']) assert.ok(lookForm.includes(`'${field}'`), field);
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
  assert.doesNotMatch(stage + props + designsCard + lookForm + eventPage, /dangerouslySetInnerHTML|innerHTML/);
  // The timeline seeks the real video and marks each box's appear and disappear time.
  assert.match(stage, /element\.currentTime = target;/);
  assert.match(stage, /stream-timeline__marker is-\$\{marker\.kind\}/);
  assert.match(props, /set\(\{ appear_ms: Math\.round\(time\) \}\)/);
  assert.match(props, /set\(\{ disappear_ms: Math\.round\(time\) \}\)/);
});

test('the properties panel offers only the kind variables as chips and the shared font list', () => {
  assert.match(props, /\{variables\.map\(\(name\) => \(/);
  assert.match(eventPage, /const variables = templateVariables\(kind, data\?\.variables\?\.\[kind\]\);/);
  assert.match(lookForm, /\{variables\.map\(\(name\) => \(/);
  assert.match(props, /insertAtCursor\(text\.template, input\?\.selectionStart \?\? null, input\?\.selectionEnd \?\? null, `\{\$\{name\}\}`\)/);
  assert.match(props, /templateProblem\(text\.template, kind, variables\)/);
  assert.match(props, /style=\{\{ fontFamily: fontCss\(font\) \}\}/);
  assert.match(props, /value=\{`asset:\$\{asset\.id\}`\}/);
  assert.match(eventPage, /const fonts = data\?\.fonts\?\.length \? data\.fonts : DESIGN_FONTS;/);
  assert.match(designFonts, /googleFontsHref\(fonts\)/);
  assert.match(designFonts, /new FontFace\(family, /);
});

test('Preview plays the unsaved draft through applyConfig, and says so when the overlay copy is too old', () => {
  assert.match(eventPage, /const built = draftPreviewConfig\(\{ saved: savedConfig, kind, draft: alert, variation: variation\?\.id \?\? null, assets \}\);/);
  assert.match(eventPage, /handle\.playDraft\(built\.config, kind, \{ \.\.\.sampleFireOptions\(kind, samples\), variation: variation \? variation\.id : 'base' \}\)/);
  assert.match(previewPane, /if \(typeof fx\.applyConfig !== 'function'\) return 'unsupported';/);
  assert.match(previewPane, /await fx\.applyConfig\(config\);\s*draftInFrame\.current = true;\s*fx\.fire\(kind, options\);/);
  assert.ok(previewHandle.includes('an older copy of the overlay that cannot show unsaved settings yet'));
  // The frame keeps the saved settings (also after it reloads), so plain previews look like OBS; an older copy gets the designs.
  assert.match(previewPane, /onLoad=\{\(\) => \{ draftInFrame\.current = false; void applySaved\(\); \}\}/);
  assert.match(previewPane, /if \(typeof fx\.applyConfig === 'function'\) await fx\.applyConfig\(config\);\s*else if \(typeof fx\.applyDesigns === 'function'\) await fx\.applyDesigns\(config\.designs\);/);
  assert.match(shell, /savedPreviewConfig\(alerts\.data\?\.resolved, settings\.data\?\.general\)/);
  assert.match(previewHandle, /export interface PreviewHandle \{/);
  assert.match(previewHandle, /'played' \| 'loading' \| 'unsupported' \| 'failed'/);
  // A background colour behind the preview.
  assert.match(previewPane, /aria-label="Preview background colour"/);
  assert.match(previewPane, /<input type="color" value=\{background\}/);
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
  assert.match(workspace, /className="stream-alerts-workspace stream-accounts"/);
});

test('the new media and design wording uses no em dashes', () => {
  for (const source of [mediaCard, designsCard, stage, props, designUtils, previewHandle, workspace]) assert.doesNotMatch(source, /—/);
});

/* ---- Alert box (phase 5) ---- */

test('the client has one function per alert box route, each on the selected account', () => {
  assert.match(api, /getAlerts: \(accountId: number\) =>\s*api\.fetch<StreamAlertAlerts>\(`\$\{account\(accountId\)\}\/alerts`\)/);
  assert.match(api, /saveAlert: \(accountId: number, kind: StreamAlertType, alert: StreamAlertKindSettings\) =>[\s\S]*?`\$\{account\(accountId\)\}\/alerts\/\$\{kind\}`, \{\s*method: 'PUT',/);
  assert.match(api, /getAlertSettings: \(accountId: number\) =>\s*api\.fetch<[^>]+>\(`\$\{account\(accountId\)\}\/alert-settings`\)/);
  assert.match(api, /saveAlertSettings: \(accountId: number, general: Partial<StreamAlertGeneral>\) =>[\s\S]*?\/alert-settings`, \{\s*method: 'PUT',/);
  assert.match(api, /applyDefaults: [\s\S]*?\/alerts\/apply-defaults`, \{\s*method: 'POST',\s*body: JSON\.stringify\(kinds \? \{ kinds, fields \} : \{ fields \}\)/);
  assert.match(api, /moderate: [\s\S]*?\/moderation`, \{\s*method: 'POST',\s*body: JSON\.stringify\(\{ alert_id: alertId, decision \}\)/);
  assert.match(api, /export interface StreamAlertTestInput \{[\s\S]*?variation\?: string;/);
  assert.match(api, /moderation\?: StreamAlertModeration \| null;/);
  assert.match(api, /export type StreamAlertModeration = 'pending' \| 'approved' \| 'blocked' \| 'released';/);
});

test('the layout: top bar, a left menu that is a page picker on narrow screens, and the page in ?view=', () => {
  assert.match(shell, /const requested = parseView\(params\.get\(VIEW_PARAM\), \{ legacy \}\);/);
  assert.match(shell, /<nav className="stream-box__menu" aria-label="Alert box pages">/);
  assert.match(shell, /<select className="form-control" value=\{current\} onChange=\{\(event\) => go\(parseView\(event\.target\.value, \{ legacy \}\)\)\}>/);
  assert.match(shell, /\+ Add variation/);
  assert.match(shell, /<TestMenu account=\{account\} savedAlert=\{savedAlert\} samples=\{samples\} \/>/);
  assert.match(shell, /<OverlayLight account=\{account\} \/>\s*<TwitchPill /);
  assert.match(boxUtils, /export const VIEW_PARAM = 'view';/);
  assert.match(boxCss, /@container stream-box \(max-width: 860px\) \{\s*\.stream-box__body \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(boxCss, /\.stream-box__side \{ position: sticky;/);
  assert.match(boxCss, /\.stream-box__savebar \{\s*position: sticky; bottom: 0;/);
  assert.match(boxCss, /\.stream-alerts button\.stream-box__swatch \{ width: 44px; min-width: 44px; height: 44px;/);
});

test('General settings cover profanity, minimums, message minimums, timing and moderation, without the defaults', () => {
  for (const text of ['Profanity filter', 'Use the built-in English word list', 'Your own bad words', 'Allowed words (never filtered)', 'Minimums', 'Message minimums',
    'Gap between alerts (seconds)', 'A new alert ends the one on screen instead of waiting', 'Alert moderation', 'Hold, then show', 'Show only once approved', 'Hold each alert for (seconds)']) {
    assert.ok(generalPage.includes(text), text);
  }
  assert.match(boxUtils, /export function generalSettingsPart\(general: StreamAlertGeneral\): Omit<StreamAlertGeneral, 'defaults'>/);
  assert.match(generalPage, /aria-label=\{`Remove \$\{word\}`\}/);
});

test('Global editing saves only the defaults and applies the ticked parts after an in-page confirm', () => {
  assert.match(globalPage, /streamAlertsApi\.saveAlertSettings\(account\.id, \{ defaults: look \}\)/);
  assert.match(globalPage, /streamAlertsApi\.applyDefaults\(account\.id, applyFields\(ticked\)\)/);
  assert.equal(globalPage.match(/apply\.mutate\(\)/g)?.length, 1);
  const confirm = globalPage.slice(globalPage.indexOf('{confirming && ('));
  assert.match(confirm, /onClick=\{\(\) => apply\.mutate\(\)\}/);
  assert.match(confirm, /autoFocus disabled=\{apply\.isPending\} onClick=\{\(\) => setConfirming\(false\)\}>Cancel</);
  assert.match(globalPage, /disabled=\{dirty \|\| fields\.length === 0 \|\| apply\.isPending\}/);
  assert.match(boxUtils, /\{ key: 'animations', label: 'Animations', fields: \['animation', 'text'\] \}/);
});

test('Activity approves or blocks held alerts through the moderation route', () => {
  assert.match(tab, /streamAlertsApi\.moderate\(accountId, input\.id, input\.decision\)/);
  assert.match(tab, /\{alert\.moderation === 'pending' && \(/);
  assert.match(tab, /moderate\.mutate\(\{ id: alert\.id, decision: 'approve' \}\)/);
  assert.match(tab, /moderate\.mutate\(\{ id: alert\.id, decision: 'block' \}\)/);
  assert.match(tab, /refetchInterval: \(query\) => \(anyPending\(query\.state\.data\?\.alerts\) \? 3_000 : 15_000\)/);
});

test('the alert box wording uses no em dashes', () => {
  for (const source of [shell, eventPage, testMenu, generalPage, globalPage, lookForm, boxUtils, previewPane]) assert.doesNotMatch(source, /—/);
});
