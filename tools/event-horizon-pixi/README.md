# Event Horizon: playback fix and PixiJS renderer

## Status — 2026-09-18

PixiJS 8.21.0 is now the default full-scene Activity renderer, following the owner's approval of small WebGL visual differences. Simulation, collision, scoring, replay version, and the relay protocol are unchanged. Canvas remains a build-time rollback: build with `VITE_EVENT_HORIZON_RENDERER=canvas` and redeploy. There is no player renderer toggle.

The production renderer uses retained meshes for black-hole arcs and nose heat, pooled sprites for objects and particles, and cached artwork textures. It does not upload a full Canvas frame each tick. The nose heat is anchored to the rocket PNG's actual nose apex and follows the ship's rotation.

Full-game local checks: 66 tests passed; default and Canvas rollback builds passed; desktop and 390 × 844 portrait previews, WebGL context loss/restoration/resume, resize, and a seeded 0–600 second scene sweep passed without captured rendering errors. The sweep peaked at 52 owned textures and ended at 33, with two stage children. Texture storage excludes geometry, MSAA, framebuffers, and browser copies.

Five full-game scenes, 240 measured frames each after warmup, ran near the local display's 120 Hz ceiling. Pixi CPU frame work averaged 0.92–1.37 ms, p95 1.5–1.9 ms, with no intervals above 25 ms. Canvas also approached 120 Hz, with one interval above 25 ms; its CPU cost was lower in some scenes. This does **not** establish a universal FPS increase. Raw full-game results are in `results/full-game-*.json`. Physical phone and authenticated two-player Discord testing remain follow-up checks.

## Full-game verification fixture

```sh
node tools/event-horizon-pixi/create-game-lab.mjs
npm run dev -- --host 127.0.0.1
# /activities/event-horizon/renderer-lab.generated.html?time=210
# Add &renderer=canvas for comparison, or use ?benchmark
# /tools/event-horizon-pixi/heat.html — enlarged heat alignment comparison
# /tools/event-horizon-pixi/mobile.html — portrait fixture
```

Generated lab files are ignored and excluded from the production build. The fixture uses seeded local simulation and does not authenticate, publish scores, or contact the relay.

## Historical isolated prototype evidence

The sections below record the initial isolated black-hole experiment. Its original decision to retain Canvas was superseded by the owner's explicit Pixi deployment approval and the full-scene integration above.

## Reproduce

```sh
npm ci
npm run dev -- --host 127.0.0.1
# Open /tools/event-horizon-pixi/index.html
# Portrait: ?width=390&height=844
# Reduced effect count: ?width=844&height=390&reduced
node tools/event-horizon-pixi/reproduce-playback.mjs
node --test src/activities/event-horizon/*.test.mjs
npm run build
```

Use **Run measurements** for five animation times; **Animate / freeze** for visual comparison. Both canvases use resolution 2, including the reduced-count comparison. That last comparison deliberately does not apply the game's usual 1.25 reduced-effects resolution. Resize by reopening with dimensions; this isolated prototype does not yet implement the game's resize/context-recovery lifecycle.

## Spectator finding and fix

A 300 ms pilot scheduling stall advances only 100 ms of simulation because the existing game loop caps elapsed simulation time. The old spectator clock retained its smallest wall-clock offset forever. After the stall drained the buffer, it kept reaching the newest snapshot and moving only when the next 10 Hz packet arrived.

Playback now follows buffered simulation progress, gently correcting presentation speed and increasing buffering for jitter. At underflow it approaches the newest known state without extrapolating collisions or inventing future movement. Pause, death, replacement, and long disconnects retain their reset behavior.

The deterministic reproduction samples 541 frames after recovery:

| Clock | Frames with unchanged motion | Largest simulation-time jump |
|---|---:|---:|
| Previous clock | 451 / 541 (83.36%) | 100 ms |
| New clock | 0 / 541 | 16.77 ms |

This is a reproduced scheduling bug, not a claim that all network glitches are eliminated. Regression tests also cover ordered bursts, changing pilot cadence, bounded buffering, and terminal states.

## GPU prototype

The black hole was the largest Canvas drawing component in earlier profiling. The experiment moves its animated elliptical and photon arcs into two retained parametric meshes. Only time uniforms change; it does not rebuild Graphics or upload a full Canvas frame each tick. Constant-width ellipse strokes use ellipse normals rather than stretching a circular sprite. Embers are reused sprites. Three cropped static textures preserve the original Canvas gradients, orbit markings, and lettering, uploading once per instance. Layer order, effect counts, colors, and resolution are retained.

The production Canvas implementation was extracted into `black-hole.mjs` so the comparison shares the actual draw routine. Its original golden drawing-command hashes remain exact in 18 cases / 36 cold-and-warm frames.

### Measured CPU submission cost

Browser on the local test computer; **portrait dimensions are not a physical phone test**. Five animation times, 30 warm-up and 120 measured frames each, alternating Canvas/Pixi draw order. Times measure JS drawing submission, not GPU completion or full-game frame rate. Noise is visible in p95; two desktop cases had slightly worse Pixi p95 despite lower means.

| Layout, resolution 2 | Canvas mean | Pixi mean | Static texture storage |
|---|---:|---:|---:|
| 1280 × 720, full effects | 0.783 ms | 0.495 ms | 13.92 MiB |
| 390 × 844, full effects | 0.753 ms | 0.399 ms | 3.71 MiB |
| 844 × 390, reduced counts | 0.507 ms | 0.301 ms | 3.78 MiB |

Texture storage excludes retained geometry, MSAA targets, framebuffers, and the browser's copies. Raw samples summarized by scene and visible-pixel comparisons are in `results/`.

### Visual gate and decision

Side-by-side desktop and portrait previews retain the overall composition. Visible-pixel comparison composites both over the same opaque background at time 120. Mean RGB channel differences were 0.230/255 desktop and 0.209/255 portrait; approximately 0.98% and 0.97% of pixels respectively differed by more than 8 in at least one channel. Thin arc/ember antialiasing differs between Canvas and WebGL. These are **not pixel-identical** results.

**Original prototype decision: keep Canvas enabled (superseded above).** The prototype saves roughly 0.3 ms CPU per frame for one effect in this environment, but does not establish a whole-game FPS gain or visual parity across target devices. The conditional production migration gate is not met. A full migration would still require full-scene integration/benchmarking, antialiasing acceptance, Discord desktop and physical-phone checks, resize, WebGL context loss/recovery, asset lifecycle, and fallback verification. These are requirements for a later migration, not capabilities claimed by this prototype.
