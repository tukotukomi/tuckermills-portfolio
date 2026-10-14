// Sound effects, synthesized in code at 22 kHz, chiptune style: no sound files. The recipes are a line-for-line port of
// src\SoundEffects.cs (SfxLibrary), so the two versions sound the same; the Windows mixer is replaced by Web Audio.

const R = 22050;
let noiseState = 2463534242;

// ---- Building blocks --------------------------------------------------------------------------------

function make(seconds, sample) {
  const n = Math.trunc(seconds * R);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = sample(i / R);
  return d;
}

function noise() {
  noiseState ^= noiseState << 13; noiseState >>>= 0;
  noiseState ^= noiseState >>> 17;
  noiseState ^= noiseState << 5; noiseState >>>= 0;
  return (noiseState & 0xFFFF) / 32768 - 1;
}

const sqr = (ph, duty) => ((ph - Math.floor(ph)) < duty ? 1 : -1);
const saw = ph => (ph - Math.floor(ph)) * 2 - 1;
const tri = ph => { const p = ph - Math.floor(ph); return Math.abs(p * 4 - 2) - 1; };
const sin = ph => Math.sin(ph * Math.PI * 2);
const exp = (t, tau) => Math.exp(-t / tau);
const attack = (t, secs) => Math.min(1, t / secs);
const crush = (x, levels) => Math.round(x * levels) / levels;

function layer(dst, src, offset, gain) {
  const start = Math.trunc(offset * R);
  for (let i = 0; i < src.length && start + i < dst.length; i++) dst[start + i] += src[i] * gain;
}

function note(hz, seconds, tau, wave, gain) {
  let ph = 0;
  return make(seconds, t => { ph += hz / R; return wave(ph) * attack(t, 0.004) * exp(t, tau) * gain; });
}

function whoosh(seconds, cut0, cut1, swell, gain, highpass) {
  let lp = 0;
  return make(seconds, t => {
    const u = t / seconds;
    const cut = cut0 + (cut1 - cut0) * u;
    lp += cut * (noise() - lp);
    const x = highpass ? noise() - lp : lp;
    const env = swell > 0 ? Math.sin(Math.PI * Math.pow(u, 1 - swell * 0.6)) : Math.pow(1 - u, 2);
    return x * env * gain;
  });
}

function thump(seconds, f0, f1, noiseAmt, gain) {
  let ph = 0;
  return make(seconds, t => {
    const u = t / seconds;
    const f = f1 + (f0 - f1) * Math.exp(-u * 7);
    ph += f / R;
    return (sin(ph) * exp(t, seconds * 0.35) + noise() * noiseAmt * exp(t, 0.012)) * gain;
  });
}

// ---- The sounds ----------------------------------------------------------------------------------------

const RECIPES = {
  // The party.
  Peck() { let ph = 0; return make(0.09, t => { ph += (2300 - 9500 * t) / R; return sqr(ph, 0.3) * exp(t, 0.022) * 0.55 + noise() * 0.25 * exp(t, 0.004); }); },
  ShopBell() {
    const d = new Float32Array(Math.trunc(0.7 * R));
    layer(d, note(1568, 0.35, 0.14, sin, 0.5), 0.0, 1);
    layer(d, note(3136, 0.25, 0.08, sin, 0.18), 0.0, 1);
    layer(d, note(2093, 0.45, 0.17, sin, 0.45), 0.14, 1);
    layer(d, note(4186, 0.3, 0.1, sin, 0.15), 0.14, 1);
    return d;
  },
  ItemBuy() {
    const d = new Float32Array(Math.trunc(0.6 * R));
    layer(d, note(988, 0.08, 0.035, p => sqr(p, 0.25), 0.4), 0.0, 1);
    layer(d, note(1319, 0.08, 0.035, p => sqr(p, 0.25), 0.4), 0.06, 1);
    layer(d, note(1976, 0.2, 0.08, p => sqr(p, 0.25), 0.4), 0.12, 1);
    layer(d, note(2637, 0.3, 0.12, sin, 0.3), 0.2, 1);
    return d;
  },
  ElixirUse() {
    const d = new Float32Array(Math.trunc(1.0 * R));
    const notes = [523.25, 784, 1047, 1568, 2093, 3136];
    for (let i = 0; i < notes.length; i++) layer(d, note(notes[i], 0.4, 0.15, sin, 0.42), i * 0.06, 1);
    layer(d, whoosh(0.5, 0.2, 0.9, 1, 0.5, true), 0.0, 1);
    layer(d, note(130.8, 0.6, 0.3, tri, 0.4), 0.0, 1);
    return d;
  },
  PotionUse() {
    const d = new Float32Array(Math.trunc(0.55 * R));
    let ph = 0, ph2 = 0;
    layer(d, make(0.16, t => { ph += (330 - 700 * t) / R; return sin(ph) * exp(t, 0.06) * 0.7; }), 0.0, 1);
    layer(d, make(0.14, t => { ph2 += (260 - 600 * t) / R; return sin(ph2) * exp(t, 0.05) * 0.6; }), 0.17, 1);
    layer(d, note(1500, 0.06, 0.02, sin, 0.35), 0.36, 1);
    layer(d, note(1900, 0.05, 0.02, sin, 0.3), 0.42, 1);
    return d;
  },
  DiscClick() {
    let ph = 0;
    return make(0.07, t => { ph += (900 + 600 * t) / R; return tri(ph) * exp(t, 0.02) * 0.45 + noise() * 0.12 * exp(t, 0.004); });
  },
  GargogryphRoar() {
    let ph = 0, gr = 0;
    return make(0.75, t => {
      const u = t / 0.75;
      ph += (1500 - 700 * u + 120 * Math.sin(t * 60)) / R;
      gr += (62 + 8 * Math.sin(t * 14)) / R;
      const env = attack(t, 0.03) * Math.pow(1 - u, 0.8);
      return (saw(ph) * 0.38 + sqr(ph * 0.5, 0.5) * 0.2 + noise() * 0.18 + saw(gr) * 0.35) * env * 0.8;
    });
  },
  GargogryphFlap() {
    const d = new Float32Array(Math.trunc(0.5 * R));
    layer(d, whoosh(0.2, 0.05, 0.3, 1, 0.8, false), 0.0, 1);
    layer(d, thump(0.16, 90, 40, 0.15, 0.7), 0.03, 1);
    layer(d, whoosh(0.2, 0.05, 0.3, 1, 0.8, false), 0.22, 0.9);
    layer(d, thump(0.16, 90, 40, 0.15, 0.7), 0.25, 0.8);
    return d;
  },
  GargogryphShot() {
    const d = new Float32Array(Math.trunc(0.45 * R));
    for (let i = 0; i < 3; i++) layer(d, whoosh(0.12, 0.35, 0.9, 1, 0.6, true), i * 0.1, 1 - i * 0.15);
    return d;
  },
  GargogryphShardHit() {
    let ph = 0;
    return make(0.1, t => { ph += (1800 - 8000 * t) / R; return sqr(ph, 0.25) * exp(t, 0.018) * 0.45 + noise() * 0.3 * exp(t, 0.006); });
  },
  GargogryphDeath() {
    let ph = 0, lp = 0;
    return make(1.1, t => {
      const u = t / 1.1;
      ph += (1400 * Math.exp(-u * 2.6) + 90) / R;
      lp += (0.5 * Math.exp(-u * 3) + 0.04) * (noise() - lp);
      const crumble = noise() > 0.9 ? noise() * 0.5 * exp(t, 0.3) : 0;
      return (saw(ph) * 0.4 * Math.pow(1 - u, 1.4) + lp * 0.9 * exp(t, 0.4) + crumble) * 0.8;
    });
  },
  ToucanRoar() {   // a tinny two-note squawk
    let ph = 0, lp = 0;
    return make(0.55, t => {
      const first = t < 0.24;
      const u = first ? t / 0.24 : (t - 0.24) / 0.31;
      const hz = (first ? 760 + 380 * u : 620 + 520 * u) + 40 * Math.sin(t * 70);
      ph += hz / R;
      lp += 0.5 * (noise() - lp);
      const env = first ? Math.sin(Math.PI * u) : Math.pow(1 - u, 0.7) * attack(t - 0.24, 0.02);
      return (sqr(ph, 0.35) * 0.4 + saw(ph * 2) * 0.15 + (noise() - lp) * 0.12) * env * 0.85;
    });
  },
  ToucanSwing() {   // the bill drawing back: a quick rising peep and a breath
    let ph = 0;
    return make(0.16, t => { ph += (500 + 2200 * t) / R; return tri(ph) * exp(t, 0.07) * 0.3 + noise() * 0.25 * Math.sin(Math.PI * t / 0.16); });
  },
  ToucanHit() {   // the bill clanging on armour: a ring of tin and a click
    let a = 0, b = 0;
    return make(0.3, t => {
      a += 1180 / R; b += 1770 / R;
      return (sin(a) * 0.5 + sin(b) * 0.35 + sqr(a * 0.5, 0.5) * 0.1) * exp(t, 0.07) * 0.7 + noise() * 0.5 * exp(t, 0.006);
    });
  },
  ToucanDeath() {   // a falling squawk and the rattle of a dropped can
    let ph = 0, a = 0;
    return make(0.9, t => {
      const u = t / 0.9;
      ph += (1100 * Math.exp(-u * 3) + 140) / R;
      a += 1400 / R;
      const rattle = noise() > 0.85 ? noise() * 0.5 * exp(t, 0.35) : 0;
      return (sqr(ph, 0.3) * 0.35 * Math.pow(1 - u, 1.2) + rattle + sin(a) * 0.15 * exp(t, 0.1)) * 0.85;
    });
  },
  BloodMoon() {
    const d = new Float32Array(Math.trunc(3.2 * R));
    let a = 0, b = 0;
    layer(d, make(2.0, t => {
      const u = t / 2.0;
      a += (55 + 55 * u * u) / R; b += (55.7 + 55 * u * u) / R;
      const env = Math.pow(u, 1.5) * (0.75 + 0.25 * sin(t * (3 + 6 * u)));
      return (saw(a) * 0.3 + saw(b) * 0.3 + sin(a * 0.5) * 0.4) * env * 0.8;
    }), 0.0, 1);
    layer(d, thump(0.9, 80, 28, 0.9, 1), 1.6, 1);
    layer(d, whoosh(1.2, 0.5, 0.05, 0, 0.9, false), 1.6, 0.8);
    return d;
  },
  AxeThrow() {
    let lp = 0, ph = 0;
    return make(0.32, t => {
      const u = t / 0.32;
      lp += (0.12 + 0.35 * u) * (noise() - lp);
      const spin = 0.65 + 0.35 * sin(t * 22);
      const env = Math.sin(Math.PI * Math.pow(u, 0.7));
      ph += (260 - 120 * u) / R;
      return ((noise() - lp) * 0.8 + tri(ph) * 0.18) * spin * env * 0.8;
    });
  },
  BowShot() {   // a crossbow's release: a click, the taut string's twang, and the bolt's short hiss
    let ph = 0, lp = 0;
    return make(0.3, t => {
      ph += (230 + 90 * Math.exp(-t * 45)) / R;
      lp += 0.35 * (noise() - lp);
      return tri(ph) * exp(t, 0.085) * 0.6 + sin(ph * 2) * exp(t, 0.05) * 0.2
        + noise() * 0.45 * exp(t, 0.005) + (noise() - lp) * 0.22 * exp(t, 0.05);
    });
  },
  AxeHit() {
    let ph = 0;
    return make(0.22, t => {
      ph += (150 * Math.exp(-t * 18) + 55) / R;
      return sin(ph) * exp(t, 0.07) * 0.95 + noise() * 0.6 * exp(t, 0.008) + sqr(ph * 3, 0.5) * 0.15 * exp(t, 0.02);
    });
  },
  FireCast() {
    let ph = 0, lp = 0;
    return make(0.5, t => {
      ph += (120 + 1100 * t * t) / R;
      lp += 0.22 * (noise() - lp);
      const swell = t < 0.38 ? t / 0.38 : Math.max(0, 1 - (t - 0.38) / 0.12);
      return (saw(ph) * 0.3 + lp * 1.0) * swell * 0.7;
    });
  },
  FireImpact() {
    let ph = 0, lp = 0;
    return make(0.65, t => {
      ph += (170 * Math.exp(-t * 6) + 38) / R;
      lp += (0.6 * Math.exp(-t * 5) + 0.05) * (noise() - lp);
      const crackle = noise() > 0.82 ? noise() * 0.5 * exp(t, 0.2) : 0;
      return (lp * 1.1 * exp(t, 0.22) + sin(ph) * 0.9 * exp(t, 0.26) + crackle) * 0.85;
    });
  },
  Heal() {
    const d = new Float32Array(Math.trunc(0.75 * R));
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i++) layer(d, note(notes[i], 0.35, 0.12, tri, 0.55), i * 0.075, 1);
    layer(d, note(2093, 0.4, 0.15, sin, 0.3), 0.3, 1);
    return d;
  },
  LuckyCoins() {
    const d = new Float32Array(Math.trunc(0.5 * R));
    const sq = p => sqr(p, 0.25);
    layer(d, note(1318.5, 0.12, 0.05, sq, 0.4), 0.0, 1);
    layer(d, note(1760, 0.12, 0.05, sq, 0.4), 0.07, 1);
    layer(d, note(2349, 0.25, 0.09, sq, 0.4), 0.14, 1);
    layer(d, note(3136, 0.18, 0.07, sin, 0.3), 0.2, 1);
    return d;
  },
  Huzzah() {
    const d = new Float32Array(Math.trunc(0.95 * R));
    let ph1 = 0, ph2 = 0;
    layer(d, make(0.28, t => { ph1 += (150 - 80 * t) / R; const env = attack(t, 0.02) * Math.max(0, 1 - t / 0.28); return (saw(ph1) * 0.6 + sqr(ph1 * 0.5, 0.5) * 0.3 + noise() * 0.12) * env * 0.7; }), 0.0, 1);
    layer(d, make(0.42, t => { ph2 += (210 - 70 * t) / R; const env = attack(t, 0.02) * Math.max(0, 1 - t / 0.42); return (saw(ph2) * 0.6 + sqr(ph2 * 0.5, 0.5) * 0.3 + noise() * 0.12) * env * 0.7; }), 0.3, 1);
    for (const f of [196.0, 293.66, 392.0]) layer(d, note(f, 0.45, 0.2, p => sqr(p, 0.5), 0.22), 0.5, 1);
    return d;
  },
  StarHat() {
    const d = new Float32Array(Math.trunc(0.9 * R));
    const notes = [880, 1108.7, 1318.5, 1760, 2217.5, 2637];
    for (let i = 0; i < notes.length; i++) layer(d, note(notes[i], 0.4, 0.14, sin, 0.5), i * 0.07, 1);
    layer(d, note(3520, 0.5, 0.2, sin, 0.25), 0.35, 1);
    return d;
  },

  // Enemy voices.
  ShellerRoar() { let ph = 0; return make(0.4, t => { ph += (96 - 60 * t) / R; const trem = 0.6 + 0.4 * sin(t * 30); return (saw(ph) * 0.6 + noise() * 0.35) * trem * attack(t, 0.03) * Math.max(0, 1 - t / 0.4) * 0.6; }); },
  OrcRoar() {
    let ph = 0, lp = 0;
    return make(0.6, t => {
      ph += (68 - 22 * t + 6 * Math.sin(t * 38)) / R;
      lp += 0.35 * (noise() - lp);
      return (saw(ph) * 0.65 + sqr(ph, 0.4) * 0.3 + lp * 0.4) * attack(t, 0.05) * Math.max(0, 1 - t / 0.6) * 0.75;
    });
  },
  NightmareRoar() {
    let ph = 0;
    const wail = make(0.8, t => {
      ph += (540 - 260 * t + 22 * Math.sin(t * 32)) / R;
      const env = attack(t, 0.1) * Math.max(0, 1 - t / 0.8);
      return (sin(ph) * 0.6 + sin(ph * 2) * 0.2 + sin(ph * 3.02) * 0.08) * env;
    });
    const d = new Float32Array(Math.trunc(1.2 * R));
    layer(d, wail, 0, 0.7); layer(d, wail, 0.22, 0.35); layer(d, wail, 0.44, 0.18);
    return d;
  },

  // Sheller attacks.
  ShellerPunchSwing() { return whoosh(0.1, 0.1, 0.5, 1, 0.5, false); },
  ShellerPunchHit() { return thump(0.16, 170, 55, 0.5, 0.95); },
  ShellerClawSwing() { return whoosh(0.16, 0.35, 0.9, 0.6, 0.45, true); },
  ShellerClawHit() {
    const d = new Float32Array(Math.trunc(0.28 * R));
    for (let i = 0; i < 3; i++) layer(d, whoosh(0.07, 0.6, 0.9, 0, 0.7, true), i * 0.07, 1);
    return d;
  },

  // Orc attacks.
  OrcSmashSwing() { return whoosh(0.32, 0.05, 0.35, 1, 0.8, false); },
  OrcSmashHit() {
    const d = thump(0.5, 110, 34, 0.9, 1.0);
    layer(d, whoosh(0.05, 0.7, 0.9, 0, 0.8, true), 0.0, 1);
    layer(d, note(180, 0.12, 0.04, p => sqr(p, 0.5), 0.3), 0.0, 1);
    return d;
  },
  OrcSweepSwing() { return whoosh(0.34, 0.08, 0.55, 0.8, 0.75, false); },
  OrcSweepHit() {
    const d = thump(0.34, 140, 48, 0.6, 0.95);
    layer(d, note(720, 0.07, 0.02, p => sqr(p, 0.3), 0.35), 0.0, 1);
    layer(d, note(540, 0.07, 0.02, p => sqr(p, 0.3), 0.3), 0.04, 1);
    return d;
  },

  // Nightmare attacks.
  NightmareSweepSwing() {
    let ph = 0;
    const air = whoosh(0.42, 0.05, 0.45, 1, 0.55, true);
    const d = make(0.42, t => { const u = t / 0.42; ph += (900 - 520 * u) / R; return sin(ph) * Math.sin(Math.PI * u) * 0.25; });
    layer(d, air, 0, 1);
    return d;
  },
  NightmareSweepHit() {
    const d = whoosh(0.1, 0.8, 0.95, 0, 0.9, true);
    const all = new Float32Array(Math.trunc(0.6 * R));
    layer(all, d, 0, 1);
    layer(all, note(2217, 0.55, 0.14, sin, 0.45), 0.0, 1);
    layer(all, note(2243, 0.55, 0.12, sin, 0.3), 0.0, 1);
    return all;
  },
  NightmareChopSwing() {
    let ph = 0;
    return make(0.3, t => { const u = t / 0.3; ph += (1500 - 1150 * u) / R; return (sin(ph) * 0.35 + noise() * 0.18 * u) * attack(t, 0.02) * Math.max(0, 1 - u * u) * 0.8; });
  },
  NightmareChopHit() {
    const d = thump(0.5, 120, 40, 0.5, 0.9);
    layer(d, whoosh(0.06, 0.85, 0.95, 0, 0.9, true), 0.0, 1);
    layer(d, note(1568, 0.45, 0.16, sin, 0.35), 0.0, 1);
    return d;
  },

  // Deaths.
  ShellerDeath() { let ph = 0; return make(0.45, t => { ph += (950 * Math.exp(-t * 6) + 120) / R; return sqr(ph, 0.4) * 0.45 * exp(t, 0.18) + noise() * 0.5 * exp(t, 0.03); }); },
  OrcDeath() {
    const d = new Float32Array(Math.trunc(0.7 * R));
    let ph = 0;
    layer(d, make(0.3, t => { ph += (130 - 90 * t) / R; return (saw(ph) * 0.6 + noise() * 0.2) * attack(t, 0.02) * Math.max(0, 1 - t / 0.3) * 0.8; }), 0.0, 1);
    layer(d, thump(0.4, 90, 32, 0.6, 1), 0.28, 1);
    return d;
  },
  NightmareDeath() {
    let ph = 0;
    return make(0.95, t => {
      const u = t / 0.95;
      ph += (720 * Math.exp(-u * 3.2) + 70 + 40 * Math.sin(t * 28)) / R;
      return (sin(ph) * 0.55 + noise() * 0.12 * (1 - u)) * Math.pow(1 - u, 1.5);
    });
  },

  // The world.
  CoinPickup() {
    const d = new Float32Array(Math.trunc(0.25 * R));
    layer(d, note(987.8, 0.07, 0.09, p => sqr(p, 0.5), 0.4), 0.0, 1);
    layer(d, note(1318.5, 0.2, 0.09, p => sqr(p, 0.5), 0.4), 0.06, 1);
    return d;
  },
  CoinDrop() {
    const d = new Float32Array(Math.trunc(0.25 * R));
    layer(d, note(2637, 0.15, 0.04, sin, 0.5), 0.0, 1);
    layer(d, note(3951, 0.15, 0.05, sin, 0.3), 0.0, 1);
    layer(d, note(2093, 0.15, 0.05, sin, 0.3), 0.07, 1);
    return d;
  },
  CrystalHum() {   // a seamless two-second loop (every frequency makes whole cycles in it)
    return make(2.0, t => {
      const a = t * Math.PI * 2;
      const v = Math.sin(a * 392.0) * 0.5 + Math.sin(a * 392.5) * 0.45 + Math.sin(a * 588.0) * 0.28 + Math.sin(a * 784.0) * 0.18 + Math.sin(a * 1176.0) * 0.07;
      const trem = 0.72 + 0.28 * Math.sin(a * 1.0);
      const sparkle = Math.sin(a * 2352.0) * 0.1 * Math.max(0, Math.sin(a * 0.5)) * Math.max(0, Math.sin(a * 3.0));
      return (v * trem + sparkle) * 0.3;
    });
  },
  CrystalCollect() {
    const d = new Float32Array(Math.trunc(1.5 * R));
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
    for (let i = 0; i < notes.length; i++) {
      layer(d, note(notes[i], 0.5, 0.17, tri, 0.5), i * 0.065, 1);
      layer(d, note(notes[i] * 2, 0.4, 0.1, sin, 0.18), i * 0.065, 1);
    }
    layer(d, make(1.0, t => (sin(t * 1046.5) + sin(t * 1049.5) + sin(t * 1568)) * 0.12 * attack(t, 0.25) * exp(Math.max(0, t - 0.3), 0.35)), 0.4, 1);
    return d;
  },
  LevelUp() {
    const d = new Float32Array(Math.trunc(1.0 * R));
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < 3; i++) layer(d, note(notes[i], 0.14, 0.2, p => sqr(p, 0.5), 0.33), i * 0.1, 1);
    layer(d, note(notes[3], 0.6, 0.25, p => sqr(p, 0.5), 0.33), 0.3, 1);
    layer(d, note(notes[3] * 1.5, 0.5, 0.2, tri, 0.25), 0.3, 1);
    return d;
  },
};

/** One chiptune blip of the dialogue's "speech". */
function blipData(hz, soft) {
  let ph = 0;
  return make(0.055, t => {
    ph += (hz * (1 + 0.04 * Math.sin(t * 90))) / R;
    const wave = soft ? tri(ph) : sqr(ph, 0.5);
    const env = Math.min(1, t / 0.003) * Math.max(0, 1 - t / 0.055);
    return crush(wave * env * 0.5, 6);
  });
}

// ---- The player ---------------------------------------------------------------------------------------

export const Sound = {
  _ctx: null,
  _master: null,
  _buffers: {},
  _blips: {},
  _loops: {},
  _lastPlayed: {},
  _volume: 70,

  /** The effects volume, 0-100. */
  get volume() { return this._volume; },
  set volume(v) {
    this._volume = Math.max(0, Math.min(100, v));
    if (this._master) this._master.gain.value = this._gain(this._volume);
  },

  _gain(percent) { const v = percent / 100; return v * v; },

  /** Browsers only let audio start after a click or key press: call this from one. */
  unlock() {
    const ctx = this._context();
    // 'interrupted' is Safari's word for a context a phone call or lock screen stopped.
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      try { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); } catch (e) { /* not allowed yet */ }
    }
  },

  /** 'running' when effects can be heard; otherwise why not ('suspended' until the page has been clicked, 'none' if unsupported). */
  get state() { return this._ctx ? this._ctx.state : 'none'; },

  /** True when effects can play right now. A blocked context is nudged awake so the next effect, after any user gesture, is heard. */
  _ready() {
    const ctx = this._context();
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    this.unlock();
    return false;
  },

  /** The output node effects go to, so the page can add a main-volume stage if it wants. */
  _context() {
    if (this._ctx) return this._ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this._ctx = new AC();
      this._master = this._ctx.createGain();
      this._master.gain.value = this._gain(this._volume);
      this._master.connect(this.output || this._ctx.destination);
    } catch (e) { this._ctx = null; }
    return this._ctx;
  },

  _buffer(name) {
    let b = this._buffers[name];
    if (b) return b;
    const recipe = RECIPES[name];
    if (!recipe) return null;
    const data = recipe();
    for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i] * 1.1) * 0.9;   // a soft limiter rather than a hard clip
    b = this._ctx.createBuffer(1, data.length, R);
    b.getChannelData(0).set(data);
    this._buffers[name] = b;
    return b;
  },

  _start(buffer, gain, loop) {
    const src = this._ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = !!loop;
    const g = this._ctx.createGain();
    g.gain.value = gain;
    src.connect(g); g.connect(this._master);
    src.start();
    return { src: src, gain: g };
  },

  /** Plays a sound once. Repeats of the same sound within 30 ms are dropped. */
  play(name, gain) {
    if (this._volume <= 0) return;
    if (!this._ready()) return;
    const now = performance.now();
    if (now - (this._lastPlayed[name] || 0) < 30) return;
    this._lastPlayed[name] = now;
    const b = this._buffer(name);
    if (b) this._start(b, gain === undefined ? 1 : gain, false);
  },

  /** One blip of dialogue "speech". */
  blip(hz, gain, soft) {
    if (this._volume <= 0) return;
    if (!this._ready()) return;
    const ctx = this._ctx;
    hz = Math.max(60, Math.min(1800, Math.trunc(hz / 10) * 10));
    const key = hz + (soft ? 's' : 'q');
    let b = this._blips[key];
    if (!b) {
      const data = blipData(hz, soft);
      b = ctx.createBuffer(1, data.length, R);
      b.getChannelData(0).set(data);
      this._blips[key] = b;
    }
    this._start(b, gain, false);
  },

  startLoop(key, name, gain) {
    const ctx = this._context();
    if (!ctx || this._loops[key]) return;
    const b = this._buffer(name);
    if (!b) return;
    const v = this._start(b, 0, true);
    v.gain.gain.value = gain;
    this._loops[key] = v;
  },

  setLoopGain(key, gain) {
    const v = this._loops[key];
    if (v) v.gain.gain.setTargetAtTime(gain, this._ctx.currentTime, 0.05);
  },

  stopLoop(key) {
    const v = this._loops[key];
    if (!v) return;
    delete this._loops[key];
    try {
      v.gain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05);
      v.src.stop(this._ctx.currentTime + 0.4);
    } catch (e) { /* already stopped */ }
  },

  /** Every sound's name, for tests. */
  names() { return Object.keys(RECIPES); },
  /** Synthesizes a sound's samples (for tests and the sound check). */
  samples(name) { return RECIPES[name](); },
};
