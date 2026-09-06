const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

process.env.RENDER_SHARED_SECRET = 'render-card-test-secret';

const { run, isAllowedDataDragonAssetUrl, LOL_RENDER_LIMITS, compactLolText } = require('./index.js');

function aiStatusPayload(overrides = {}) {
  return {
    card: 'ai-status',
    guildName: 'Acosmibot',
    status: 'enabled',
    statusLabel: 'Operational',
    statusDetail: 'AI is ready for this server.',
    tierName: 'Max',
    monthlyReset: 'Sep 1, 2026',
    accessLabel: 'Complimentary',
    accessTerm: 'Permanent',
    usage: [
      { key: 'chat-daily', label: 'Chat Today', used: 2, limit: 200, detail: 'used today', locked: false },
      { key: 'chat-monthly', label: 'Chat This Month', used: 1312, limit: 3000, detail: 'this month', locked: false },
      { key: 'images', label: 'Images Generated', used: 98, limit: 100, detail: 'generated', locked: false },
      { key: 'analysis', label: 'Image Analysis', used: 121, limit: 200, detail: 'analyses', locked: false },
      { key: 'image-search', label: 'Image Search', used: 16, limit: 100, detail: 'searches', locked: false },
      { key: 'summary', label: 'Channel Summary', used: 2, limit: 300, detail: 'summaries', locked: false },
    ],
    guildCreditImages: 0,
    personalCreditImages: 0,
    serverCredits: 0,
    ambientAvailable: true,
    ambientRepliesEnabled: true,
    ambientImagesEnabled: true,
    personalityName: 'Acosmibot',
    personalityTraits: '',
    personalityTemporary: false,
    customPersonalityLocked: false,
    ...overrides,
  };
}

async function render(payload) {
  const context = { log: { error() {} } };
  await run(context, {
    headers: { 'x-render-key': process.env.RENDER_SHARED_SECRET },
    body: JSON.stringify(payload),
  });
  return context.res;
}

function pngDimensions(buffer) {
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function rgbaPixels(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  assert.equal(bitDepth, 8, 'expected an 8-bit PNG');
  assert.equal(colorType, 6, 'expected RGBA output');

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }

  const source = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let sourceOffset = 0;

  const paeth = (left, up, upperLeft) => {
    const estimate = left + up - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
    return upDistance <= upperLeftDistance ? up : upperLeft;
  };

  for (let y = 0; y < height; y += 1) {
    const filter = source[sourceOffset];
    sourceOffset += 1;
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = source[sourceOffset + x];
      const left = x >= 4 ? pixels[rowOffset + x - 4] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[rowOffset - stride + x - 4] : 0;
      const predictor =
        filter === 0 ? 0
          : filter === 1 ? left
            : filter === 2 ? up
              : filter === 3 ? Math.floor((left + up) / 2)
                : filter === 4 ? paeth(left, up, upperLeft)
                  : assert.fail(`unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
    sourceOffset += stride;
  }

  return {
    alphaAt(x, y) {
      return pixels[y * stride + x * 4 + 3];
    },
  };
}

test('renders the portrait AI status ledger with bundled assets', async () => {
  const response = await render(aiStatusPayload());

  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'image/png');
  assert.equal(response.isRaw, true);
  assert.deepEqual(pngDimensions(response.body), { width: 1086, height: 1448 });
  const pixels = rgbaPixels(response.body);
  assert.equal(pixels.alphaAt(0, 0), 0, 'the exterior corner should be transparent');
  assert.equal(pixels.alphaAt(0, 724), 0, 'the exterior side should be transparent');
  assert.equal(pixels.alphaAt(543, 724), 255, 'the card interior should stay opaque');
});

test('renders not-configured and locked states without changing the canvas', async () => {
  const response = await render(
    aiStatusPayload({
      guildName: 'A Server Name Long Enough To Exercise Truncation',
      status: 'not-configured',
      statusLabel: 'Setup Required',
      statusDetail: 'A server manager can configure AI from the Acosmibot dashboard.',
      usage: aiStatusPayload().usage.map((item) => ({ ...item, locked: true })),
      serverCredits: 123456789012,
      ambientAvailable: false,
      personalityName: 'A Very Long Custom Personality Name',
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(pngDimensions(response.body), { width: 1086, height: 1448 });
});

function lolParticipant(index, overrides = {}) {
  const blue = index < 5;
  return {
    riotId: `Pilot ${index + 1}#NA${index + 1}`,
    teamSide: blue ? 'blue' : 'red',
    championId: 100 + index,
    championName: `Champion ${index + 1}`,
    role: ['top', 'jungle', 'middle', 'bottom', 'support'][index % 5],
    level: 18 - (index % 4),
    summonerSpellIds: [4, 14],
    kills: index + 1,
    deaths: index % 5,
    assists: index + 3,
    cs: 120 + index * 9,
    gold: 8000 + index * 900,
    damage: 10000 + index * 1300,
    items: Array.from({ length: 7 }, (_, slot) => ({
      itemId: 1000 + index * 7 + slot,
      itemName: `Item ${index + 1}-${slot + 1}`,
    })),
    ...overrides,
  };
}

function lolBase(card, overrides = {}) {
  return {
    card,
    riotId: 'Orbit Ledger#NA1',
    platform: 'NA1',
    dataDragonVersion: '16.18.1',
    ...overrides,
  };
}

function lolMatchPayload(overrides = {}) {
  return lolBase('lol-match', {
    matchSuffix: 'A1B2C3D4',
    queueLabel: 'Ranked Solo/Duo',
    durationSeconds: 1872,
    patch: '16.18',
    teams: [
      { side: 'blue', result: 'victory', kills: 26, deaths: 18, assists: 57, gold: 62400, towers: 8, dragons: 3, heralds: 1, barons: 1, inhibitors: 1 },
      { side: 'red', result: 'defeat', kills: 18, deaths: 26, assists: 32, gold: 55300, towers: 2, dragons: 1, heralds: 0, barons: 0, inhibitors: 0 },
    ],
    participants: Array.from({ length: 10 }, (_, index) => lolParticipant(index)),
    ...overrides,
  });
}

function lolCardFixtures() {
  const player = lolParticipant(0, { damageTaken: 12345, visionScore: 39, summonerSpellIds: [], runeIds: [] });
  return [
    lolBase('lol-profile', {
      level: 212,
      soloDuo: { status: 'ranked', tier: 'GOLD', division: 'II', leaguePoints: 64, wins: 22, losses: 17 },
      flex: { status: 'unranked' },
      mastery: [],
    }),
    lolBase('lol-history', {
      matches: [{ result: 'victory', relativeTime: '18 minutes ago', durationSeconds: 1872, queueLabel: 'Ranked Solo/Duo', championName: 'Aurora', role: 'middle', kills: 8, deaths: 2, assists: 11, cs: 208, csPerMin: 6.7 }],
    }),
    lolMatchPayload({ participants: Array.from({ length: 10 }, (_, index) => lolParticipant(index, { championId: undefined, summonerSpellIds: [], items: [] })) }),
    lolBase('lol-player', {
      matchSuffix: 'A1B2C3D4', queueLabel: 'Ranked Solo/Duo', durationSeconds: 1872, patch: '16.18', result: 'victory',
      player,
      derived: { killParticipation: 0.73, csPerMin: 6.7, goldPerMin: 421.4, teamDamageShare: 0.29 },
    }),
    lolBase('lol-timeline', {
      matchSuffix: 'A1B2C3D4', queueLabel: 'Ranked Solo/Duo', durationSeconds: 1872, status: 'available',
      leadFrames: [{ minute: 0, blueGold: 2500, redGold: 2500 }, { minute: 15, blueGold: 26000, redGold: 24200 }],
      events: [{ timestampSeconds: 641, type: 'dragon', side: 'blue', summary: 'Blue team secured the first dragon.' }],
    }),
  ];
}

test('renders every League field-report family at 1200x675 without remote assets', async () => {
  for (const fixture of lolCardFixtures()) {
    const response = await render(fixture);
    assert.equal(response.status, 200, fixture.card);
    assert.equal(response.headers['Content-Type'], 'image/png');
    assert.deepEqual(pngDimensions(response.body), { width: 1200, height: 675 });
    const pixels = rgbaPixels(response.body);
    assert.equal(pixels.alphaAt(10, 10), 255, `${fixture.card} header is opaque`);
    assert.equal(pixels.alphaAt(600, 660), 255, `${fixture.card} footer is opaque`);
  }
});

test('renders complete factual fields with explicit placeholders when static assets are unavailable', async () => {
  const response = await render(lolMatchPayload({
    dataDragonVersion: null,
    participants: Array.from({ length: 10 }, (_, index) => lolParticipant(index)),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(pngDimensions(response.body), { width: 1200, height: 675 });
});

test('keeps Unicode truncation and named-or-descriptive raster fallbacks safe', async () => {
  assert.equal(compactLolText('123456789012345😀', 15), '12345678901234…', 'must not retain a split surrogate');
  assert.equal(compactLolText('Signal🚀#NA1', 32), 'Signal🚀#NA1');

  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith('/champion.json')) {
      return new Response(JSON.stringify({ data: { Ahri: { key: '103', id: 'Ahri', name: 'Ahri' } } }), { headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/summoner.json')) {
      return new Response(JSON.stringify({ data: { Flash: { key: '4', name: 'Flash', image: { full: 'SummonerFlash.png' } } } }), { headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/runesReforged.json')) {
      return new Response(JSON.stringify([{ slots: [{ runes: [{ id: 8005, name: 'Press the Attack', icon: 'perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png' }] }] }]), { headers: { 'content-type': 'application/json' } });
    }
    return new Response('', { status: 404, headers: { 'content-type': 'text/plain' } });
  };
  try {
    const player = lolParticipant(0, {
      championId: 103,
      championName: 'Ahri',
      summonerSpellIds: [4],
      runeIds: [8005],
      damageTaken: 12345,
      visionScore: 39,
      items: [{ itemId: 1001, itemName: 'Boots of Speed' }],
    });
    const response = await render(lolBase('lol-player', {
      dataDragonVersion: '16.19.0',
      matchSuffix: 'A1B2C3D4', queueLabel: 'Ranked Solo/Duo', durationSeconds: 1872, patch: '16.18', result: 'victory',
      player,
      derived: {},
    }));
    assert.equal(response.status, 200, 'catalog display names remain usable when image fetches fail');
    assert.deepEqual(pngDimensions(response.body), { width: 1200, height: 675 });
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects malformed League discriminators, hostile identifiers, and bounded-shape violations', async () => {
  const invalids = [
    lolBase('lol-unknown'),
    lolBase('lol-profile', { level: 1, profileIconId: 0, soloDuo: { status: 'unranked' }, flex: { status: 'unranked' }, mastery: [] }),
    lolBase('lol-profile', { level: 1, soloDuo: { status: 'unranked' }, flex: { status: 'unranked' }, mastery: [{ championId: '../secret', championName: 'Nope', level: 1, points: 2 }] }),
    lolMatchPayload({ participants: [lolParticipant(0, { summonerSpellIds: [0] })] }),
    lolBase('lol-history', { matches: Array.from({ length: 11 }, () => ({})) }),
    lolMatchPayload({ participants: Array.from({ length: 11 }, (_, index) => lolParticipant(index)) }),
    lolBase('lol-timeline', { matchSuffix: 'A1B2C3D4', queueLabel: 'Ranked', durationSeconds: 12, status: 'available', leadFrames: [], events: [{ timestampSeconds: Infinity, type: 'dragon', side: 'blue', summary: 'No.' }] }),
  ];
  for (const payload of invalids) {
    const response = await render(payload);
    assert.equal(response.status, 400);
    assert.equal(response.body, 'Invalid League card payload');
  }
});

test('accepts Core-compatible Riot IDs and only exact Data Dragon asset URLs', async () => {
  const coreCompatible = lolBase('lol-profile', {
    riotId: 'Lumen/Signal!#éβ3',
    level: 1,
    soloDuo: { status: 'unranked' },
    flex: { status: 'unranked' },
    mastery: [],
  });
  const response = await render(coreCompatible);
  assert.equal(response.status, 200, 'Core game names are not limited to a punctuation whitelist');

  assert.equal(isAllowedDataDragonAssetUrl('https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Ahri.png'), true);
  [
    'http://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Ahri.png',
    'https://ddragon.leagueoflegends.com.evil.test/cdn/16.18.1/img/champion/Ahri.png',
    'https://attacker@ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Ahri.png',
    'https://ddragon.leagueoflegends.com:443/cdn/16.18.1/img/champion/Ahri.png',
    'https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/Ahri.png?target=internal',
    'https://ddragon.leagueoflegends.com/cdn/16.18.1/img/champion/%2e%2e.png',
  ].forEach((url) => assert.equal(isAllowedDataDragonAssetUrl(url), false, url));
  assert.equal(LOL_RENDER_LIMITS.assetConcurrency, 6);
  assert.equal(LOL_RENDER_LIMITS.maxCatalogBytes, 768 * 1024);
});

test('full scoreboard spike deduplicates bounded Data Dragon assets and stays within six concurrent fetches', async () => {
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5eAAAAABJRU5ErkJggg==', 'base64');
  const originalFetch = global.fetch;
  let active = 0;
  let maxActive = 0;
  let requests = 0;
  global.fetch = async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    requests += 1;
    await new Promise(resolve => setTimeout(resolve, 3));
    active -= 1;
    const path = String(url);
    if (path.endsWith('/champion.json')) {
      return new Response(JSON.stringify({ data: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [
        `Champion${index + 1}`, { key: String(100 + index), id: `Champion${index + 1}` },
      ])) }), { headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/summoner.json')) {
      return new Response(JSON.stringify({ data: {
        Flash: { key: '4', image: { full: 'SummonerFlash.png' } },
        Ignite: { key: '14', image: { full: 'SummonerDot.png' } },
      } }), { headers: { 'content-type': 'application/json' } });
    }
    if (path.endsWith('/runesReforged.json')) return new Response('[]', { headers: { 'content-type': 'application/json' } });
    return new Response(tinyPng, { headers: { 'content-type': 'image/png', 'content-length': String(tinyPng.length) } });
  };
  try {
    const startedAt = performance.now();
    const response = await render(lolMatchPayload());
    const elapsedMs = performance.now() - startedAt;
    assert.equal(response.status, 200);
    assert.deepEqual(pngDimensions(response.body), { width: 1200, height: 675 });
    assert.ok(maxActive <= 6, `saw ${maxActive} concurrent Data Dragon fetches`);
    assert.ok(requests <= 86, `expected deduplicated workload, got ${requests} requests`);
    assert.ok(elapsedMs < 2500, `full fixture took ${elapsedMs.toFixed(1)}ms`);
  } finally {
    global.fetch = originalFetch;
  }
});

test('asset catalog and image failures preserve factual card output through explicit visual fallback', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    const path = String(url);
    if (path.endsWith('/summoner.json') || path.endsWith('/runesReforged.json')) {
      return new Response('not an image', { headers: { 'content-type': 'text/plain' } });
    }
    return { ok: true, redirected: true, headers: new Headers({ 'content-type': 'image/png' }), arrayBuffer: async () => new ArrayBuffer(0) };
  };
  try {
    const response = await render(lolMatchPayload({ dataDragonVersion: '16.18.2', participants: [lolParticipant(0)] }));
    assert.equal(response.status, 200);
    assert.deepEqual(pngDimensions(response.body), { width: 1200, height: 675 });
  } finally {
    global.fetch = originalFetch;
  }
});

test('caps catalog streams even when Content-Length lies and never calls arrayBuffer', async () => {
  const originalFetch = global.fetch;
  let streamReads = 0;
  global.fetch = async () => ({
    ok: true,
    redirected: false,
    headers: new Headers({ 'content-type': 'application/json', 'content-length': '1' }),
    body: new ReadableStream({
      start(controller) {
        streamReads += 1;
        controller.enqueue(new Uint8Array(800 * 1024));
      },
    }),
    arrayBuffer: async () => assert.fail('bounded catalog reads must use the response stream'),
  });
  try {
    const response = await render(lolMatchPayload({ dataDragonVersion: '16.18.3', participants: [lolParticipant(0)] }));
    assert.equal(response.status, 200);
    assert.ok(streamReads >= 1, 'catalog stream was attempted');
  } finally {
    global.fetch = originalFetch;
  }
});

test('counts warm cached images against the per-render aggregate byte cap', async () => {
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5eAAAAABJRU5ErkJggg==', 'base64');
  const paddedPng = Buffer.concat([tinyPng, Buffer.alloc(350 * 1024 - tinyPng.length)]);
  const originalFetch = global.fetch;
  let assetRequests = 0;
  const cacheFixture = lolMatchPayload({
    dataDragonVersion: '16.19.7',
    participants: [
      lolParticipant(0, { championId: undefined, summonerSpellIds: [], items: Array.from({ length: 7 }, (_, index) => ({ itemId: 7000 + index, itemName: `Cache item ${index}` })) }),
      lolParticipant(1, { championId: undefined, summonerSpellIds: [], items: Array.from({ length: 2 }, (_, index) => ({ itemId: 7100 + index, itemName: `Cache item ${index}` })) }),
    ],
  });
  global.fetch = async () => {
    assetRequests += 1;
    return new Response(paddedPng, { headers: { 'content-type': 'image/png', 'content-length': String(paddedPng.length) } });
  };
  try {
    await render(cacheFixture);
    await render(cacheFixture);
    const afterSecondRender = assetRequests;
    await render(cacheFixture);
    assert.equal(afterSecondRender, 10, 'only the ninth image remains uncached after the warm-cache render');
    assert.equal(assetRequests, 11, 'the warm cache cannot bypass the 3 MiB per-render cap');
  } finally {
    global.fetch = originalFetch;
  }
});
