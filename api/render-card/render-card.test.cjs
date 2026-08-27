const test = require('node:test');
const assert = require('node:assert/strict');
const { inflateSync } = require('node:zlib');

process.env.RENDER_SHARED_SECRET = 'render-card-test-secret';

const { run } = require('./index.js');

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
      { key: 'images', label: 'Included Images', used: 98, limit: 100, detail: 'generated', locked: false },
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
