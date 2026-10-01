// Synthesised adaptive soundtrack and effects. No audio files are fetched.
// Every call is best-effort: audio failures must never interrupt a flight.
const NOTES = [220, 261.63, 329.63, 392, 493.88, 523.25, 659.25];
const ARP = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 6, 5, 4, 2, 4];

export function createAudio() {
  let ctx = null, master, musicBus, sfxBus, noise, music = null, boost = null, timer = 0, muted = false;
  let step = 0, nextNote = 0, state = { intensity: 0, heat: 0, depth: 0, boost: false, active: false };

  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) {
        const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return null;
        ctx = new Context();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = .004; limiter.release.value = .2;
        master = ctx.createGain(); master.gain.value = .9; master.connect(limiter); limiter.connect(ctx.destination);
        musicBus = ctx.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
        sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
        noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
      return ctx;
    } catch { return null; }
  }
  const now = () => ctx.currentTime;
  const glide = (param, value, time = .25) => { try { param.setTargetAtTime(value, now(), time); } catch { /* ignore */ } };

  function voice({ type = 'sine', freq = 440, end = freq, duration = .2, gain = .05, attack = .005, bus = sfxBus, filter = null, when = 0, detune = 0 }) {
    if (!(gain > .0005)) return;
    const t = now() + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    let node = o; o.connect(g);
    if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; f.Q.value = filter.q ?? 1; g.connect(f); node = f; } else node = g;
    node.connect(bus); o.start(t); o.stop(t + duration + .05);
  }
  function hiss({ duration = .3, gain = .05, type = 'bandpass', freq = 1200, end = freq, q = 1, when = 0, bus = sfxBus }) {
    if (!(gain > .0005)) return;
    const t = now() + when, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, end), t + duration);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + duration + .05);
  }

  function startMusic() {
    if (music || !ensure()) return;
    const drone = ctx.createGain(), pad = ctx.createGain(), arp = ctx.createGain(), hats = ctx.createGain();
    for (const g of [drone, pad, arp, hats]) { g.gain.value = 0; g.connect(musicBus); }
    const droneFilter = ctx.createBiquadFilter(); droneFilter.type = 'lowpass'; droneFilter.frequency.value = 180; droneFilter.Q.value = 4; droneFilter.connect(drone);
    const oscillators = [];
    for (const [freq, type, detune] of [[55, 'sawtooth', -7], [55, 'sawtooth', 8], [27.5, 'sine', 0], [82.4, 'triangle', 3]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(droneFilter); o.start(); oscillators.push(o);
    }
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); lfo.frequency.value = .07; lfoGain.gain.value = 60;
    lfo.connect(lfoGain); lfoGain.connect(droneFilter.frequency); lfo.start(); oscillators.push(lfo);
    const padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.connect(pad);
    for (const freq of [110, 164.81, 220, 261.63, 329.63]) for (const detune of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = detune; o.connect(padFilter); o.start(); oscillators.push(o);
    }
    const arpFilter = ctx.createBiquadFilter(); arpFilter.type = 'lowpass'; arpFilter.frequency.value = 2400; arpFilter.Q.value = 3; arpFilter.connect(arp);
    music = { drone, pad, arp, hats, droneFilter, padFilter, arpFilter, oscillators };
    glide(drone.gain, .22, 1.2);
    step = 0; nextNote = now() + .1;
    timer = setInterval(schedule, 50);
  }
  // Look-ahead sequencer: 16th notes at 112 BPM, scheduled 200 ms ahead.
  function schedule() {
    try { sequence(); } catch { /* a scheduling hiccup must never reach window.onerror */ }
  }
  function sequence() {
    if (!music || !ctx) return;
    const sixteenth = 60 / 112 / 4;
    while (nextNote < now() + .2) {
      const when = nextNote - now();
      if (state.active && state.intensity > .2) {
        const note = NOTES[ARP[step % ARP.length]] * (state.intensity > .7 && step % 32 >= 16 ? 2 : 1);
        voice({ type: 'square', freq: note, duration: sixteenth * 1.6, gain: .05, bus: music.arpFilter, when });
      }
      if (state.active && state.intensity > .55 && step % 2 === 0) hiss({ duration: .05, gain: step % 4 === 2 ? .05 : .025, type: 'highpass', freq: 7000, bus: music.hats, when });
      if (state.active && step % 16 === 0) voice({ type: 'sine', freq: 70, end: 38, duration: .35, gain: .16 * Math.min(1, state.intensity * 1.6), bus: music.drone, when });
      nextNote += sixteenth; step++;
    }
  }
  function stopMusic() {
    if (!music) return;
    const m = music; music = null; clearInterval(timer);
    for (const g of [m.drone, m.pad, m.arp, m.hats]) glide(g.gain, 0, .3);
    setTimeout(() => { for (const o of m.oscillators) { try { o.stop(); } catch { /* already stopped */ } } }, 1500);
  }
  function boostLoop(on) {
    if (!ctx) return;
    if (!boost) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; src.loop = true; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .8; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); boost = { src, f, g };
    }
    glide(boost.g.gain, on ? .07 : 0, on ? .05 : .12); glide(boost.f.frequency, on ? 1600 : 700, .2);
  }

  const effects = {
    launch() { voice({ type: 'sine', freq: 140, end: 620, duration: .5, gain: .08 }); hiss({ duration: .6, gain: .05, freq: 400, end: 3000 }); },
    arm() { voice({ type: 'triangle', freq: 330, end: 660, duration: .18, gain: .04 }); },
    dash() { voice({ type: 'sawtooth', freq: 160, end: 1200, duration: .28, gain: .06, filter: { type: 'lowpass', freq: 2600 } }); hiss({ duration: .35, gain: .09, freq: 3000, end: 500, q: 2 }); voice({ type: 'sine', freq: 880, end: 1760, duration: .25, gain: .03, when: .05 }); },
    near({ combo = 1 } = {}) { const base = 520 * 2 ** (Math.min(combo, 12) / 12); voice({ type: 'triangle', freq: base, end: base * 1.5, duration: .14, gain: .05 }); voice({ type: 'sine', freq: base * 2, duration: .2, gain: .025, when: .04 }); hiss({ duration: .18, gain: .05, freq: 5000, end: 1500, q: 1.5 }); },
    shard({ index = 0 } = {}) { const f = NOTES[index % 5 + 2] * 2; voice({ type: 'sine', freq: f, duration: .22, gain: .045 }); voice({ type: 'sine', freq: f * 1.5, duration: .3, gain: .02, when: .03 }); },
    phase() { voice({ type: 'triangle', freq: 220, end: 330, duration: .6, gain: .05, attack: .15 }); voice({ type: 'triangle', freq: 277, end: 415, duration: .6, gain: .04, attack: .15 }); hiss({ duration: 1, gain: .06, freq: 300, end: 4000, q: 1.2 }); },
    storm() { voice({ type: 'sawtooth', freq: 110, end: 220, duration: .9, gain: .05, filter: { type: 'lowpass', freq: 900 } }); hiss({ duration: 1.1, gain: .05, freq: 200, end: 2400 }); },
    incoming() { voice({ type: 'square', freq: 660, duration: .07, gain: .025, filter: { type: 'lowpass', freq: 2000 } }); voice({ type: 'square', freq: 660, duration: .07, gain: .025, when: .12, filter: { type: 'lowpass', freq: 2000 } }); },
    warning({ critical = false } = {}) { voice({ type: 'triangle', freq: critical ? 240 : 320, end: critical ? 170 : 240, duration: .2, gain: .045 }); },
    death() { hiss({ duration: 1.4, gain: .22, type: 'lowpass', freq: 3000, end: 80, q: .7 }); voice({ type: 'sine', freq: 120, end: 28, duration: 1.2, gain: .2 }); voice({ type: 'sawtooth', freq: 300, end: 40, duration: .7, gain: .05, filter: { type: 'lowpass', freq: 1200 } }); },
    best() { [0, 2, 4, 5].forEach((n, i) => voice({ type: 'triangle', freq: NOTES[n] * 2, duration: .5, gain: .05, when: i * .09 })); voice({ type: 'sine', freq: NOTES[4] * 4, duration: 1, gain: .03, when: .36 }); },
    click() { voice({ type: 'sine', freq: 550, duration: .08, gain: .03 }); },
  };

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    setMuted(value) {
      muted = value;
      if (muted) { stopMusic(); if (boost) glide(boost.g.gain, 0, .05); }
    },
    play(name, options) { if (muted || !ensure()) return; try { effects[name]?.(options); } catch { /* best effort */ } },
    // Called every frame with presentation state only.
    update(next) {
      state = next;
      if (muted || !ctx) return;
      if (!music && next.music) startMusic();
      if (music && !next.music) stopMusic();
      if (music) {
        const i = next.intensity;
        glide(music.drone.gain, next.active ? .16 + next.depth * .18 : .12, .4);
        glide(music.droneFilter.frequency, 140 + next.depth * 700 + next.heat * 500, .3);
        glide(music.pad.gain, next.active ? .03 + i * .05 : .045, .8);
        glide(music.padFilter.frequency, 500 + i * 2200, .6);
        glide(music.arp.gain, next.active && i > .2 ? .35 + i * .4 : 0, .3);
        glide(music.hats.gain, next.active && i > .55 ? .9 : 0, .3);
      }
      boostLoop(!!next.boost && next.active);
    },
    suspend() { try { if (ctx?.state === 'running') void ctx.suspend(); } catch { /* ignore */ } },
  };
}
