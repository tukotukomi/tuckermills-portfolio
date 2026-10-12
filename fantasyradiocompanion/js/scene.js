// The marching-party scene. A port of src\PixelScene.cs, PixelSky.cs, PixelTrees.cs and PixelCamp.cs: the same structure and the same
// numbers, so a change made to the C# can be made here the same way. Drawn at a tiny logical resolution and scaled up with
// nearest-neighbour by the page.

import { C, CA, withAlpha, mix, clamp255, hash, ease, rnd, Pix, tintImage } from './util.js';
import { Sprites, PARTY } from './sprites.js';
import { Sound } from './sfx.js';

export const DESIGN_HEIGHT = 33;
export const DAY_LENGTH_SECONDS = 120;
export const SEASON_DAYS = 5;
const IDLE_BREATH_SECONDS = 3.6;
const TAVERN_SPAWN_PHASE = 0.88;
const DAY_END_PHASE = 0.9995;
export const SPACING = 25;
const ENCOUNTER_DAY = [1, 5, 10, 20, 40];

/** Beat tracking from a stream of audio levels: detects onsets, estimates tempo, and keeps time when the level is unavailable. */
export class BeatClock {
  constructor() {
    this.bpm = 112; this.phaseSeconds = 0; this.beatIndex = 0; this.beatThisFrame = false;
    this._avg = 0; this._prev = 0; this._gaps = [];
  }
  get phase() { return Math.min(1.0, this.phaseSeconds / (60.0 / this.bpm)); }
  update(dt, level) {
    this.beatThisFrame = false;
    this.phaseSeconds += dt;
    const interval = 60.0 / this.bpm;
    let onset = false;
    if (level >= 0) {
      const threshold = this._avg * 1.35 + 0.03;
      onset = level > threshold && this._prev <= threshold && this.phaseSeconds >= 0.26;
      this._avg = this._avg * 0.94 + level * 0.06;
      this._prev = level;
    }
    if (onset) {
      if (this.phaseSeconds > 0.3 && this.phaseSeconds < 1.0) {
        this._gaps.push(this.phaseSeconds);
        if (this._gaps.length > 9) this._gaps.shift();
        const sorted = this._gaps.slice().sort((a, b) => a - b);
        this.bpm = Math.max(70, Math.min(180, 60.0 / sorted[Math.floor(sorted.length / 2)]));
      }
      this._fire();
    } else if (this.phaseSeconds >= interval * (level >= 0 ? 1.3 : 1.0)) {
      this._fire();   // no onset where one was due (or no level at all): keep time at the current tempo
    }
  }
  _fire() { this.phaseSeconds = 0; this.beatIndex++; this.beatThisFrame = true; }
}

// 7 sky bands, top to bottom, for each keyframe: dawn, noon, dusk, midnight.
const SKY_KEYS = [
  [C(58, 58, 120), C(108, 80, 152), C(168, 100, 152), C(228, 132, 134), C(250, 172, 122), C(255, 206, 134), C(255, 228, 166)],
  [C(56, 124, 214), C(78, 148, 230), C(108, 170, 240), C(138, 190, 246), C(168, 210, 250), C(196, 226, 253), C(222, 240, 255)],
  [C(24, 20, 64), C(44, 30, 92), C(84, 44, 120), C(138, 58, 128), C(200, 84, 120), C(240, 128, 100), C(252, 180, 110)],
  [C(6, 8, 30), C(10, 12, 44), C(14, 18, 58), C(20, 26, 74), C(26, 34, 92), C(34, 44, 108), C(44, 56, 124)],
];
const FAR_KEYS = [C(104, 84, 146), C(98, 124, 176), C(78, 52, 122), C(20, 24, 62)];
const NEAR_KEYS = [C(62, 94, 104), C(62, 134, 112), C(44, 74, 104), C(14, 26, 52)];
const TINT_KEYS = [CA(30, 255, 170, 120), CA(0, 255, 255, 255), CA(38, 255, 120, 60), CA(82, 8, 12, 64)];

const MUL_R = [1.00, 0.95, 1.10, 1.04], MUL_G = [1.02, 1.00, 0.98, 1.07], MUL_B = [1.00, 1.08, 0.80, 1.14], GRAY_AMT = [0, 0, 0.12, 0.45];
const GRASS_KEYS = [C(104, 204, 88), C(86, 184, 66), C(176, 164, 72), C(238, 244, 250)];
const GRASS_DARK_KEYS = [C(58, 150, 72), C(44, 134, 58), C(140, 112, 52), C(196, 212, 230)];
const DIRT_KEYS = [C(120, 80, 52), C(126, 86, 50), C(118, 76, 46), C(168, 182, 208)];
const DIRT_DARK_KEYS = [C(86, 56, 40), C(90, 60, 38), C(84, 52, 36), C(138, 154, 186)];
const TRUNK_KEYS = [C(96, 64, 42), C(92, 62, 40), C(92, 60, 40), C(84, 62, 54)];
const CANOPY_KEYS = [C(110, 196, 96), C(46, 140, 66), C(212, 116, 36), C(200, 220, 240)];
const CANOPY_HI_KEYS = [C(160, 226, 130), C(88, 184, 88), C(244, 176, 56), C(230, 240, 252)];
const CANOPY_LO_KEYS = [C(70, 150, 76), C(28, 100, 52), C(156, 64, 30), C(170, 190, 214)];
const ACCENT_KEYS = [C(255, 176, 200), C(255, 236, 130), C(186, 44, 34), C(255, 255, 255)];
const ACCENT_PROB = [0.22, 0.03, 0.20, 0];
const LEAF_AMOUNT = [0.85, 1.0, 0.80, 0];
const SHADE_KEYS = [C(235, 215, 225), C(255, 255, 255), C(225, 190, 190), C(70, 84, 130)];
const PETAL_COLORS = [C(255, 184, 206), C(255, 214, 226), C(246, 150, 186)];
const LEAF_COLORS = [C(214, 112, 32), C(190, 60, 34), C(240, 178, 52), C(150, 84, 36)];
const SNOW_COLORS = [C(255, 255, 255), C(255, 255, 255), C(222, 234, 250)];

// Species by season (spring, summer, fall, winter); a tree's slot picks the column.
const SPECIES_TABLE = [
  ['redbud', 'dogwood', 'redbud'],
  ['crepe', 'magnolia', 'crepe'],
  ['camellia', 'franklin', 'franklin'],
  ['fir', 'evergreen', 'christmas'],
];
const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'];

export class PixelScene {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 160; this.canvas.height = DESIGN_HEIGHT;
    this.g = new Pix(this.canvas);

    this.lh = DESIGN_HEIGHT; this.groundY = 27; this.lastLw = 160; this.lastScale = 3; this.lastTop = 0;
    this.clock = new BeatClock();
    this.notes = [];
    this.scroll = 0; this.time = 0;
    this._marching = false; this.suspended = false; this.progressing = false;
    this.camp = 0;

    // audio signals
    this._inBass = 0; this._inMid = 0; this._inTreble = 0; this._inLoud = 0; this._inLive = false;
    this.bass = 0; this.mid = 0; this.treble = 0; this.loud = 0;
    this._prevLevel = 0; this._prevBass = 0; this.bassHit = false;
    this.wind = 0; this.windOffset = 0; this.fallClock = 0;

    // time
    this.dayPhase = 0; this.daysCompleted = 0; this.yearDay = 0;
    this.sa = 0; this.sb = 0; this.sf = 0; this.sw = [1, 0, 0, 0];
    this.mr = 1; this.mg = 1; this.mb = 1; this.gray = 0; this.shade = C(255, 255, 255);

    // party and tavern
    this.party = ['paca'];
    this.enc = 'None';
    this.arrived = false; this.tavernVisible = false; this.doorOffset = 0; this.tavernWorldX = 0;
    this.offer = null; this.joinT = 0; this.move = 1; this.groupLeft = NaN; this.saveTimer = 0;

    // sky
    this.flocks = []; this.flockTimer = 8;
    this.dragonOn = false; this.dragonX = 0; this.dragonY = 0; this.dragonTimer = 225; this.dragonFire = 0; this.dragonFireCool = 0; this.dragonDir = 1;
    this.glow = [];

    this.onProgress = null;   // callback: the saved progress changed

    this._initCoins(); this._initStory(); this._initTraits(); this._initEnemies(); this._initHealth(); this._initItems();
  }

  get marching() { return this._marching && !this.suspended; }
  set marching(v) { this._marching = v; }

  raiseProgress() { if (this.onProgress) this.onProgress(); }

  setSpectrum(live, bass, mid, treble, loud) {
    this._inLive = live; this._inBass = bass; this._inMid = mid; this._inTreble = treble; this._inLoud = loud;
  }

  // ---- Stepping ---------------------------------------------------------------------------------------

  advance(dt, level) {
    if (this.targetItem !== null) { this.targetT += dt; return; }   // a healing item is waiting for its target: everything stands still
    this.time += dt;
    this._updateAudio(dt, level);
    this._advanceParty(dt);   // real time, so the party settles and the newcomer walks out even with the music paused
    if (!this.marching) { this.notes.length = 0; this.clock.update(dt, -1); return; }

    this.clock.update(dt, level);

    const frozen = this.enc !== 'None' && this.enc !== 'Approaching';
    const travel = this.progressing;
    const fighting = this.enemy !== null && this.enemy.engaged && this.enemy.deathT < 0;
    let targetMove = frozen || !travel || fighting ? 0 : 1;
    if (this.enc === 'Approaching') {
      const remaining = this._tavernDoorScreenX() - this._leaderCenterX() - this.doorOffset;
      if (remaining <= 0.5) { this.tavernWorldX += remaining; this.arrived = true; this.move = 0; targetMove = 0; }
      else targetMove = travel && !fighting ? Math.min(1, Math.max(0.12, remaining / 28)) : 0;
    }
    if (!this.arrived || this.enc !== 'Approaching') this.move += (targetMove - this.move) * Math.min(1, dt * 6);
    this.scroll += dt * (12.0 * this.clock.bpm / 112.0) * this.move;

    // Once the Old Man has been met, a Fantasy Crystal turns up at the start of every second day and is picked up by walking into it.
    if (travel && this.oldManMet && this.enc === 'None') {
      if (!this.crystalActive && this.daysCompleted >= this.nextCrystalDay) this._spawnCrystal();
      else if (this.crystalActive && this._crystalScreenX() <= this._leaderCenterX() + 3) this._beginCrystalPickup();
    }

    this._updateCrystalHum(travel);
    if (travel && this.enc === 'None') this._updateMerchant();   // on his days he comes down the road with a shop
    this._advanceCoins(dt, frozen || !travel);
    this._advanceTraits(dt, frozen || !travel);
    this._advanceEnemies(dt, frozen || !travel);
    this._advanceSky(dt);
    this._advanceDragon(dt);

    if (!frozen && travel) {
      let dd = dt / DAY_LENGTH_SECONDS;
      const needsTavern = this._needsTavern();
      if (needsTavern && this.enc === 'None' && this.dayPhase >= TAVERN_SPAWN_PHASE && this.enemy === null) this._spawnTavern();
      const dayEnds = needsTavern && this.dayPhase + dd >= DAY_END_PHASE;
      if (dayEnds) dd = Math.max(0, DAY_END_PHASE - this.dayPhase);
      let next = this.dayPhase + dd;
      if (next >= 1.0) { next -= 1.0; this.daysCompleted++; }
      this.dayPhase = next;
      this.yearDay = this.playDays % (SEASON_DAYS * 4);
      if (dayEnds && this.enc === 'Approaching' && this.arrived) this._beginChoosing();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5) { this.saveTimer = 0; this.raiseProgress(); }

    if (this.clock.beatThisFrame && this.notes.length < 6) this.notes.push({ x: rnd(70) - 30, y: 0, age: 0 });
    for (let i = this.notes.length - 1; i >= 0; i--) {
      this.notes[i].age += dt; this.notes[i].y += dt * 14;
      if (this.notes[i].age > 1.3) this.notes.splice(i, 1);
    }
  }

  // ---- Rendering --------------------------------------------------------------------------------------

  /** Lays the scene out for a control of width x height screen pixels at `scale` screen pixels per scene pixel, and draws it. */
  render(width, height, scale) {
    const lw = Math.max(16, Math.ceil(width / scale));
    const lh = Math.max(24, Math.ceil(height / scale));
    this.lh = lh; this.lastLw = lw; this.lastScale = scale;
    this.lastTop = height - lh * scale;   // pinned to the bottom of the control
    this.groundY = lh - 6;
    this.g.resize(lw, lh);
    this.g.clear();
    const g = this.g;
    this._updateSeason();
    this._drawSky(g, lw);
    this._drawDragon(g);
    this._drawBirds(g);
    this._drawBloodMoonSky(g, lw);   // the Gargogryph's red moon, behind the hills
    this._drawMountains(g, lw);
    this._drawTrees(g, lw);
    this._drawTavern(g, lw);
    this._drawGround(g, lw);
    this._drawOldMan(g);
    this._drawMerchant(g, lw);
    this._drawCampfire(g, lw);
    this._drawEnemies(g);
    this._drawParty(g, lw);
    this._drawCoins(g);
    this._drawTraitEffects(g, lw);
    this._drawItemEffects(g);
    this._drawEnemyEffects(g);
    this._drawWeather(g, lw);
    this._drawNotes(g, lw);
    this._drawLightTint(g, lw);
    this._drawBloodMoonTint(g, lw);
    this._drawGlowSpots(g);
    this._drawCampfireGlow(g, lw);
    this._drawCrystalLayer(g, lw);
    if (this.targetItem !== null) this._drawTargetOverlay(g, lw);
    return this.canvas;
  }

  // ---- Audio signals ----------------------------------------------------------------------------------

  get beatImpulse() { return this.marching ? Math.pow(Math.max(0, 1 - this.clock.phase / 0.35), 2) : 0; }

  _updateAudio(dt, level) {
    let tb = 0, tm = 0, tt = 0, tl = 0;
    if (this.marching && this._inLive) { tb = this._inBass; tm = this._inMid; tt = this._inTreble; tl = this._inLoud; }
    else if (this.marching && level >= 0) {
      tl = level; tm = level * 0.85;
      tb = Math.pow(Math.max(0, 1 - this.clock.phase / 0.3), 2) * level;
      tt = Math.min(1, Math.max(0, level - this._prevLevel) * 8);
    }
    this._prevLevel = level < 0 ? 0 : level;

    this.bass += (tb - this.bass) * Math.min(1, dt * (tb > this.bass ? 40 : 9));
    this.mid += (tm - this.mid) * Math.min(1, dt * (tm > this.mid ? 30 : 7));
    this.treble += (tt - this.treble) * Math.min(1, dt * (tt > this.treble ? 40 : 10));
    this.loud += (tl - this.loud) * Math.min(1, dt * (tl > this.loud ? 20 : 4));
    this.bassHit = this.bass > 0.8 && this._prevBass <= 0.8;
    this._prevBass = this.bass;

    const target = this.marching ? 0.12 + 0.88 * Math.min(1, 0.65 * this.loud + 0.35 * this.mid) : 0.08;
    this.wind += (target - this.wind) * Math.min(1, dt * 1.2);
    const gust = 0.8 + 0.2 * Math.sin(this.time * 0.9) * Math.sin(this.time * 0.37 + 1.3);
    this.windOffset += dt * (1.5 + 26 * this.wind * gust);
    this.fallClock += dt * (1 + 0.5 * this.wind);
  }

  // ---- Day / night and seasons -------------------------------------------------------------------------

  get playDays() { return this.daysCompleted + this.dayPhase; }
  get year() { return Math.floor(this.daysCompleted / (SEASON_DAYS * 4)) + 1; }
  get dayOfYear() { return this.daysCompleted % (SEASON_DAYS * 4) + 1; }

  get seasonName() {
    let best = 0;
    for (let i = 1; i < 4; i++) if (this.sw[i] > this.sw[best]) best = i;
    return SEASON_NAMES[best];
  }

  _key(keys) {
    const p = this.dayPhase * 4;
    const i = Math.floor(p) % 4;
    let f = p - Math.floor(p);
    f = f * f * (3 - 2 * f);
    return mix(keys[i], keys[(i + 1) % 4], f);
  }

  _skyPalette() {
    const p = this.dayPhase * 4;
    const i = Math.floor(p) % 4;
    let f = p - Math.floor(p);
    f = f * f * (3 - 2 * f);
    const result = [];
    for (let b = 0; b < 7; b++) result.push(this._seasonTint(mix(SKY_KEYS[i][b], SKY_KEYS[(i + 1) % 4][b], f)));
    return result;
  }

  /** How starry the sky is: full at midnight, a faint few near dawn/dusk, none by day. */
  starlight() {
    let d = Math.abs(this.dayPhase - 0.75);
    if (d > 0.5) d = 1 - d;
    return Math.max(0, Math.min(1, 1 - d * 3.4));
  }

  get isNight() { return this.starlight() > 0.4; }

  _sbColor(table) { return mix(table[this.sa], table[this.sb], this.sf); }
  _sbNum(table) { return table[this.sa] + (table[this.sb] - table[this.sa]) * this.sf; }

  _updateSeason() {
    const p = this.yearDay, len = SEASON_DAYS;
    const nb = Math.floor(p / len + 0.5) * len;
    const firstSpring = nb === 0 && this.playDays < SEASON_DAYS * 4;
    if (Math.abs(p - nb) < 1 && !firstSpring) {
      const k = Math.round(nb / len);
      this.sa = ((k - 1) % 4 + 4) % 4;
      this.sb = k % 4;
      const f = (p - nb + 1) / 2;
      this.sf = f * f * (3 - 2 * f);
    } else {
      this.sa = this.sb = Math.floor(p / len) % 4;
      this.sf = 0;
    }
    for (let s = 0; s < 4; s++) this.sw[s] = (this.sa === s ? 1 - this.sf : 0) + (this.sb === s ? this.sf : 0);
    this.mr = this._sbNum(MUL_R); this.mg = this._sbNum(MUL_G); this.mb = this._sbNum(MUL_B); this.gray = this._sbNum(GRAY_AMT);
    this.shade = this._key(SHADE_KEYS);
  }

  _seasonTint(c) {
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    const r = c.r + (lum - c.r) * this.gray, g = c.g + (lum - c.g) * this.gray, b = c.b + (lum - c.b) * this.gray;
    return { r: clamp255(r * this.mr), g: clamp255(g * this.mg), b: clamp255(b * this.mb), a: c.a };
  }

  _shadeColor(c) {
    return { r: Math.trunc(c.r * this.shade.r / 255), g: Math.trunc(c.g * this.shade.g / 255), b: Math.trunc(c.b * this.shade.b / 255), a: c.a };
  }

  // ---- Sky, hills, ground -------------------------------------------------------------------------------

  _drawSky(g, lw) {
    const keys = this._skyPalette();
    const n = Math.max(7, Math.trunc((this.groundY + 1) / 6));
    const bandH = Math.ceil((this.groundY + 1) / n);
    const sky = [];
    for (let i = 0; i < n; i++) {
      const pos = n === 1 ? 0 : i * (keys.length - 1.0) / (n - 1);
      const lo = Math.min(keys.length - 2, Math.floor(pos));
      sky.push(mix(keys[lo], keys[lo + 1], pos - lo));
    }
    for (let i = 0; i < n; i++) g.rect(0, i * bandH, lw, bandH + 1, sky[i]);
    for (let i = 1; i < n; i++) for (let x = (i % 2); x < lw; x += 2) g.rect(x, i * bandH - 1, 1, 1, sky[i]);

    const night = this.starlight();
    if (night > 0.02) {
      const count = Math.trunc(lw * this.lh / 200);
      for (let i = 0; i < count; i++) {
        let h = (Math.imul(i, 2654435761) + 0x9E3779B9) >>> 0;
        h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
        let h2 = (Math.imul(h, 3266489917) + 374761393) >>> 0; h2 ^= h2 >>> 16;
        const x = h % lw, y = h2 % Math.max(9, Math.trunc(this.groundY / 3));
        const on = (Math.trunc(this.time * 2 + i) % 3) !== 0;
        const myBeat = (i % 4) === (this.clock.beatIndex % 4);
        const flare = myBeat ? this.beatImpulse : 0;
        const bright = Math.min(1.0, (on ? 1.0 : 0.59) + this.treble * 0.3 + flare);
        const alpha = Math.trunc(255 * bright * night);
        g.rect(x, y, 1, 1, CA(Math.min(255, alpha), 255, 255, 230));
        if (flare > 0.45) {
          const c = CA(Math.trunc(alpha * 0.55), 255, 255, 230);
          g.rect(x - 1, y, 1, 1, c); g.rect(x + 1, y, 1, 1, c); g.rect(x, y - 1, 1, 1, c); g.rect(x, y + 1, 1, 1, c);
        }
      }
    }

    const sun = this.dayPhase < 0.5;
    const u = sun ? this.dayPhase / 0.5 : (this.dayPhase - 0.5) / 0.5;
    const cx = Math.trunc(lw * (0.08 + 0.84 * u));
    const cy = (this.groundY - 4) - Math.trunc(Math.sin(Math.PI * u) * (this.groundY - 4) * 0.70);
    const sw = Math.trunc(2 * this.bass), sz = Math.trunc(4 * this.bass);
    if (sun) {
      g.ellipse(cx - 8 - sw, cy - 8 - sw, 16 + sz, 16 + sz, CA(46 + Math.trunc(70 * this.bass), 255, 236, 150));
      g.ellipse(cx - 4, cy - 4, 8, 8, C(255, 238, 140));
      g.ellipse(cx - 2, cy - 3, 3, 3, C(255, 252, 214));
    } else {
      g.ellipse(cx - 8 - sw, cy - 8 - sw, 16 + sz, 16 + sz, CA(16 + Math.trunc(70 * this.bass), 200, 215, 255));
      g.ellipse(cx - 4, cy - 4, 8, 8, C(250, 244, 200));
      g.ellipse(cx - 2, cy - 2, 2, 2, C(214, 206, 160));
    }
  }

  _drawLightTint(g, lw) {
    const t = this._key(TINT_KEYS);
    if (t.a < 2) return;
    g.rect(0, 0, lw, this.lh, t);
  }

  _drawMountains(g, lw) {
    const farC = this._seasonTint(this._key(FAR_KEYS)), nearC = this._seasonTint(this._key(NEAR_KEYS));
    const snow = this.sw[3];
    const snowC = this._shadeColor(C(244, 248, 255));
    const farCap = mix(farC, snowC, snow * 0.9), nearCap = mix(nearC, snowC, snow * 0.8);
    const so = Math.trunc(this.scroll * 0.12), no = Math.trunc(this.scroll * 0.35);
    const k = 1 + (this.groundY / 27.0 - 1) * 0.5;
    const lift = Math.trunc(4 * k);
    for (let x = 0; x < lw; x++) {
      const hFar = Math.trunc(k * (7 + 5 * Math.sin((x + so) * 0.07) + 2 * Math.sin((x + so) * 0.19)));
      g.rect(x, this.groundY - hFar - lift, 1, hFar + lift + 1, farC);
      if (snow > 0.03) g.rect(x, this.groundY - hFar - lift, 1, 2, farCap);
    }
    this._drawTowns(g, lw, so, k, lift, farC);
    for (let x = 0; x < lw; x++) {
      const hNear = Math.trunc(k * (3 + 2 * Math.sin((x + no) * 0.05 + 2) + 1.5 * Math.sin((x + no) * 0.17)));
      g.rect(x, this.groundY - hNear, 1, hNear + 1, nearC);
      if (snow > 0.03) g.rect(x, this.groundY - hNear, 1, 1, nearCap);
    }
  }

  _drawGround(g, lw) {
    const grass = this._sbColor(GRASS_KEYS), grassDark = this._sbColor(GRASS_DARK_KEYS), dirt = this._sbColor(DIRT_KEYS), dirtDark = this._sbColor(DIRT_DARK_KEYS);
    g.rect(0, this.groundY + 1, lw, 1, grass);
    g.rect(0, this.groundY + 2, lw, 2, grassDark);
    g.rect(0, this.groundY + 4, lw, this.lh - this.groundY - 4, dirt);
    const off = Math.trunc(this.scroll);
    for (let x = -(off % 8); x < lw; x += 8) {
      g.rect(x + 2, this.groundY + 6, 2, 1, dirtDark);
      g.rect(x + 6, this.groundY + 8, 1, 1, dirtDark);
      g.rect(x + 4, this.groundY + 1, 1, 1, grassDark);
    }
  }

  _ridgeY(worldX, k, lift) {
    const hFar = Math.trunc(k * (7 + 5 * Math.sin(worldX * 0.07) + 2 * Math.sin(worldX * 0.19)));
    return this.groundY - hFar - lift;
  }

  _drawTowns(g, lw, so, k, lift, farColor) {
    const night = this.starlight();
    const period = 210;
    const wall = mix(farColor, C(18, 16, 38), 0.55 + 0.25 * night);
    const roof = mix(farColor, C(10, 8, 24), 0.7);
    const flash = this.marching ? Math.max(0, 1 - this.clock.phase / 0.5) : 0;
    const beat = this.clock.beatIndex;
    const t0 = Math.floor(so / period) - 1, t1 = Math.floor((so + lw) / period) + 1;
    for (let t = t0; t <= t1; t++) {
      const h = hash(t + 4000, 31);
      if (h % 10 < 3) continue;
      const cx = t * period + (Math.trunc(h >>> 6) % 90) + 40 - so;
      if (cx < -30 || cx > lw + 30) continue;
      const houses = 3 + (Math.trunc(h >>> 14) % 3);
      for (let i = 0; i < houses; i++) {
        const hh = hash(t * 17 + i, 99);
        const bw = 5 + (hh % 3), bh = 3 + ((hh >>> 4) % 3);
        const bx = cx + (i - Math.trunc(houses / 2)) * 7 + ((hh >>> 8) % 3) - 1;
        const ridge = this._ridgeY(bx + Math.trunc(bw / 2) + so, k, lift);
        const bottom = ridge + 3, top = bottom - bh;
        g.rect(bx, top, bw, bh, wall);
        for (let r = 0; r < 2; r++) g.rect(bx - 1 + r, top - 1 - r, bw + 2 - 2 * r, 1, roof);
        const nWin = bw >= 6 ? 2 : 1;
        for (let wv = 0; wv < nWin; wv++) {
          const parity = ((beat + i + wv) & 1) === 0;
          const baseGlow = ((hh >>> (10 + wv)) & 1) === 1 ? 0.5 : 0.1;
          const glow = Math.min(1, baseGlow + (parity ? flash * 0.95 : 0) + this.mid * 0.25) * night;
          if (glow < 0.04) continue;
          g.rect(bx + 1 + wv * 3, top + 1 + (bh > 4 ? 1 : 0), 1, 1, CA(Math.trunc(255 * glow), 255, 214, 110));
        }
      }
      if (Math.trunc(h >>> 20) % 3 === 0) {
        const tx = cx + (Math.trunc(houses / 2) + 1) * 7, ridge = this._ridgeY(tx + 1 + so, k, lift), bottom = ridge + 3;
        g.rect(tx, bottom - 12, 3, 12, wall);
        g.rect(tx - 1, bottom - 13, 5, 1, roof);
        g.rect(tx, bottom - 14, 3, 1, roof);
        g.rect(tx + 1, bottom - 15, 1, 1, roof);
        const glow = Math.min(1, 0.4 + flash * (((beat & 1) === 0) ? 0.9 : 0.2) + this.bass * 0.3) * night;
        if (glow > 0.04) g.rect(tx + 1, bottom - 9, 1, 2, CA(Math.trunc(255 * glow), 255, 214, 110));
      }
    }
  }

  // ---- Birds, bats and the dragon ------------------------------------------------------------------------

  _advanceSky(dt) {
    const rate = this._sbNum([1.0, 1.0, 1.25, 0.5]);
    this.flockTimer -= dt * rate;
    if (this.flockTimer <= 0 && this.flocks.length < 3) {
      const dir = rnd(2) === 0 ? 1 : -1;
      const count = 3 + rnd(4) + (this.loud > 0.6 ? 1 : 0);
      this.flocks.push({
        dir: dir, count: count, seed: Math.trunc(Math.random() * 2147483647),
        x: dir > 0 ? -16 : this.lastLw + 16,
        y: 4 + Math.random() * Math.max(4, this.groundY * 0.42),
        speed: (8 + Math.random() * 8) * this.clock.bpm / 112.0, panic: 0
      });
      this.flockTimer = 25 + Math.random() * 45;
    }
    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const f = this.flocks[i];
      if (this.bassHit) f.panic = 1;
      f.panic = Math.max(0, f.panic - dt * 0.7);
      f.x += f.dir * dt * f.speed * (1 + 1.2 * f.panic);
      if ((f.dir > 0 && f.x > this.lastLw + 24) || (f.dir < 0 && f.x < -24)) this.flocks.splice(i, 1);
    }
  }

  _drawBirds(g) {
    if (this.flocks.length === 0) return;
    const night = this.starlight();
    const col = this._shadeColor(mix(C(46, 50, 78), C(28, 20, 44), night));
    const beatPos = this.clock.beatIndex + this.clock.phase;
    for (const f of this.flocks) {
      for (let i = 0; i < f.count; i++) {
        let rank = Math.trunc((i + 1) / 2), side = i % 2 === 0 ? 1 : -1;
        if (i === 0) { rank = 0; side = 0; }
        const h = hash(i, f.seed);
        const x = Math.round(f.x - f.dir * rank * 5 + (h % 3) - 1);
        const y = Math.round(f.y + side * rank * 2 + Math.sin(this.time * 1.3 + i) * 0.8);
        const up = (Math.floor(beatPos * (f.panic > 0.3 ? 4 : 2) + i * 0.5)) % 2 === 0;
        const bat = night > 0.55;
        if (up) { g.rect(x, y, 1, 1, col); g.rect(x + 4, y, 1, 1, col); g.rect(x + 1, y + 1, 1, 1, col); g.rect(x + 3, y + 1, 1, 1, col); g.rect(x + 2, y + 2, 1, 1, col); }
        else { g.rect(x + 2, y, 1, 1, col); g.rect(x + 1, y + 1, 1, 1, col); g.rect(x + 3, y + 1, 1, 1, col); g.rect(x, y + 2, 1, 1, col); g.rect(x + 4, y + 2, 1, 1, col); }
        if (bat) g.rect(x + 2, y + 1, 1, 1, col);
      }
    }
  }

  _advanceDragon(dt) {
    if (!this.dragonOn) {
      this.dragonTimer -= dt;
      if (this.dragonTimer <= 0) {
        this.dragonOn = true;
        this.dragonDir = rnd(2) === 0 ? 1 : -1;
        this.dragonX = this.dragonDir > 0 ? -34 : this.lastLw + 34;
        this.dragonY = Math.max(3, this.groundY * (0.16 + 0.12 * Math.random()));
        this.dragonFireCool = 8;
      }
      return;
    }
    this.dragonX += this.dragonDir * dt * 4.5 * (this.clock.bpm / 112.0);
    this.dragonFireCool -= dt;
    if (this.dragonFire > 0) this.dragonFire -= dt;
    if (this.bassHit && this.starlight() > 0.5 && this.dragonFireCool <= 0) { this.dragonFire = 0.7; this.dragonFireCool = 14; }
    if ((this.dragonDir > 0 && this.dragonX > this.lastLw + 40) || (this.dragonDir < 0 && this.dragonX < -40)) {
      this.dragonOn = false;
      this.dragonTimer = 300 + Math.random() * 300;
    }
  }

  _drawDragon(g) {
    if (!this.dragonOn) return;
    const frame = Math.floor((this.clock.beatIndex + this.clock.phase) / 2) % 2;
    const img = Sprites.dragon[(this.dragonDir > 0 ? 0 : 2) + frame];
    const x = Math.round(this.dragonX - img.width / 2);
    const y = Math.round(this.dragonY + Math.sin(this.time * 0.6) * 1.5 - this.bass * 1.0);
    // Distance haze: faded and tinted by the light of the time of day (cached per quantized tint).
    const key = (this.dragonDir > 0 ? 0 : 2) + frame;
    const qr = this.shade.r & ~7, qg = this.shade.g & ~7, qb = this.shade.b & ~7;
    const ck = key + ':' + qr + ',' + qg + ',' + qb;
    if (!this._dragonCache) this._dragonCache = new Map();
    let tinted = this._dragonCache.get(ck);
    if (!tinted) {
      if (this._dragonCache.size > 120) this._dragonCache.clear();
      tinted = tintImage(Sprites.dragon[key], qr, qg, qb, 0.82);
      this._dragonCache.set(ck, tinted);
    }
    g.ctx.drawImage(tinted, x, y);    if (this.dragonFire > 0) {
      const u = 1 - this.dragonFire / 0.7;
      const mx = this.dragonDir > 0 ? x + 37 : x, my = y + 8, len = Math.trunc(10 * Math.min(1, u * 3) * (1 - Math.max(0, u - 0.6) * 2.5));
      g.ellipse(mx - 12 + (this.dragonDir > 0 ? 8 : -8), my - 8, 24, 16, CA(Math.trunc(60 * (1 - u)), 255, 150, 60));
      for (let i = 0; i < len; i++) {
        const f = i / 10.0;
        const fx = mx + this.dragonDir * i;
        g.rect(fx, my + Math.round(Math.sin(i * 1.7 + this.time * 30) * 0.8) - (i > 3 ? 1 : 0), 1, 2 + (i > 3 ? 1 : 0),
          CA(Math.trunc(255 * (1 - f)), 255, Math.trunc(210 - 120 * f), Math.trunc(90 - 60 * f)));
      }
    }
  }

  // ---- Trees ----------------------------------------------------------------------------------------------

  _tn(r, g, b, alpha) {
    const c = this._shadeColor(C(r, g, b));
    c.a = Math.trunc(255 * Math.max(0, Math.min(1, alpha)));
    return c;
  }

  _drawTrees(g, lw) {
    const k = 1 + (this.groundY / 27.0 - 1) * 0.5;
    const leaf = this._sbNum(LEAF_AMOUNT), accP = this._sbNum(ACCENT_PROB);
    const trunkC = this._shadeColor(this._sbColor(TRUNK_KEYS)), main = this._shadeColor(this._sbColor(CANOPY_KEYS));
    const hi = this._shadeColor(this._sbColor(CANOPY_HI_KEYS)), lo = this._shadeColor(this._sbColor(CANOPY_LO_KEYS)), acc = this._shadeColor(this._sbColor(ACCENT_KEYS));
    const winter = this.sw[3];
    const spacing = 34;
    const off = this.scroll * 0.6;
    const t0 = Math.floor(off / spacing) - 1, t1 = Math.floor((off + lw) / spacing) + 1;
    const baseY = this.groundY + 1;
    const beatPos = this.clock.beatIndex + this.clock.phase;
    this.glow.length = 0;
    const snow = withAlpha(Math.trunc(255 * Math.min(1, winter * 1.5)), this._shadeColor(C(244, 248, 255)));
    const twigs = [[0, -1], [0, -2], [0, -3], [-1, 0], [-2, -1], [-3, -2], [2, -1], [3, -2], [4, -3]];

    for (let t = t0; t <= t1; t++) {
      const h = hash(t + 1000, 77);
      if (h % 5 === 0) continue;
      const x = Math.round(t * spacing + ((h >>> 8) % 14) - 7 - off);
      const sz = (0.8 + ((h >>> 16) % 5) * 0.1) * k;
      const th = Math.max(3, Math.trunc(5 * sz)), cw = Math.max(6, Math.trunc(10 * sz)), ch = Math.max(5, Math.trunc(8 * sz));
      const topY = baseY - th;

      const phase = ((h >>> 4) % 628) / 100.0;
      const sway = this.marching ? 1.0 * Math.sin(Math.PI * beatPos * 0.5 + phase * 0.35) : 0.55 * Math.sin(this.time * 0.55 + phase);
      const crown = Math.round(sway);
      const sinceBeat = ((this.clock.phase - ((h >>> 12) % 5) * 0.05 + 1.0) % 1.0);
      const lift = this.marching ? Math.round(Math.pow(Math.max(0, 1 - sinceBeat / 0.28), 2) * 1.4) : 0;
      const lean = dy => dy >= 2 ? crown : 0;

      const slot = Math.trunc(h >>> 20) % 10;
      if (slot >= 5) { this._drawSpeciesTree(g, x, baseY, th, sz, h, slot, crown, lift); continue; }

      g.rect(x, topY, 2, th, trunkC);
      for (const tw of twigs) g.rect(x + tw[0] + lean(-tw[1]), topY + tw[1], 1, 1, trunkC);
      if (winter > 0.05) {
        g.rect(x - 3 + lean(3), topY - 3, 1, 1, snow);
        g.rect(x + 4 + lean(4), topY - 4, 1, 1, snow);
        g.rect(x + lean(4), topY - 4, 1, 1, snow);
      }

      if (leaf < 0.02) continue;
      const left = x + 1 - Math.trunc(cw / 2), top = topY - ch + 2 - lift;
      for (let py = 0; py < ch; py++)
        for (let px = 0; px < cw; px++) {
          const nx = (px + 0.5 - cw / 2.0) / (cw / 2.0), ny = (py + 0.5 - ch / 2.0) / (ch / 2.0);
          if (nx * nx + ny * ny > 1) continue;
          const hp = hash(px * 31 + py, h & 0xFFFF);
          if ((hp % 1000) / 1000.0 >= leaf) continue;
          let c;
          if (((hp >>> 10) % 1000) / 1000.0 < accP) c = acc;
          else if (ny < -0.3 && nx < 0.25) c = hi;
          else if (ny > 0.35 || nx > 0.7) c = lo;
          else c = main;
          g.rect(left + px + crown, top + py, 1, 1, c);
        }
    }
  }

  _drawSpeciesTree(g, x, baseY, th, sz, h, slot, crown, lift) {
    const idx = slot <= 6 ? 0 : slot <= 8 ? 1 : 2;
    const a = SPECIES_TABLE[this.sa][idx], b = SPECIES_TABLE[this.sb][idx];
    if (a === b || this.sf < 0.02) this._drawSpecies(g, a, x, baseY, th, sz, h, crown, lift, 1.0);
    else if (this.sf > 0.98) this._drawSpecies(g, b, x, baseY, th, sz, h, crown, lift, 1.0);
    else {
      this._drawSpecies(g, a, x, baseY, th, sz, h, crown, lift, 1 - this.sf);
      this._drawSpecies(g, b, x, baseY, th, sz, h, crown, lift, this.sf);
    }
  }

  _drawSpecies(g, sp, x, baseY, th, sz, h, crown, lift, a) {
    const topY = baseY - th;
    const Tn = (r, gg, b, al) => this._tn(r, gg, b, al === undefined ? a : al);
    const bark = Tn(100, 66, 44);
    switch (sp) {
      case 'redbud': {
        g.rect(x, topY, 2, th, bark);
        const twigs = [[0, -1], [0, -2], [0, -3], [-1, -1], [-2, -2], [-3, -3], [-3, -4], [2, -1], [3, -2], [4, -3], [5, -4], [5, -5]];
        for (const t of twigs) g.rect(x + t[0] + (-t[1] >= 2 ? crown : 0), topY + t[1], 1, 1, bark);
        const cw = Math.max(9, Math.trunc(13 * sz)), ch = Math.max(6, Math.trunc(9 * sz));
        this._blob(g, x + 1 - Math.trunc(cw / 2) + crown, topY - ch - 1 - lift, cw, ch, h & 0xFFFF, 0.58, Tn(214, 80, 140), Tn(244, 146, 190), Tn(156, 50, 104), Tn(108, 156, 84), 0.09);
        break;
      }
      case 'dogwood': {
        g.rect(x, topY, 2, th, bark);
        const widths = [Math.trunc(14 * sz), Math.trunc(11 * sz), Math.trunc(7 * sz)];
        for (let tier = 0; tier < 3; tier++) {
          const cw = Math.max(5, widths[tier]), ty = topY - 2 - tier * 3 - lift;
          this._blob(g, x + 1 - Math.trunc(cw / 2) + crown + (tier === 1 ? 1 : 0), ty, cw, 3, ((h & 0xFFFF) + tier) >>> 0, 1.0,
            Tn(84, 142, 80), Tn(122, 176, 104), Tn(54, 100, 58), Tn(252, 250, 242), 0.44);
        }
        break;
      }
      case 'crepe': {
        for (let r = 0; r < th; r++) g.rect(x, topY + r, 2, 1, r % 2 === 0 ? Tn(158, 134, 114) : Tn(118, 96, 82));
        const stems = [[-1, 1], [-2, 0], [-3, -1], [2, 1], [3, 0], [4, -1], [0, -1], [1, -2]];
        for (const s of stems) g.rect(x + s[0] + (-s[1] >= 1 ? crown : 0), topY + s[1], 1, 1, Tn(138, 114, 98));
        const palettes = [
          [Tn(224, 62, 142), Tn(246, 132, 190), Tn(164, 36, 100)],
          [Tn(244, 134, 182), Tn(252, 190, 218), Tn(204, 90, 142)],
          [Tn(188, 140, 222), Tn(220, 190, 244), Tn(138, 96, 176)],
          [Tn(212, 50, 62), Tn(244, 110, 110), Tn(150, 30, 44)],
          [Tn(250, 242, 250), Tn(255, 255, 255), Tn(206, 196, 220)],
        ];
        const pal = palettes[(h >>> 6) % 5];
        const cw = Math.max(10, Math.trunc(14 * sz)), ch = Math.max(7, Math.trunc(10 * sz));
        this._blob(g, x + 1 - Math.trunc(cw / 2) + crown, topY - ch - lift, cw, ch, h & 0xFFFF, 0.9, pal[0], pal[1], pal[2], Tn(80, 130, 70), 0.12);
        break;
      }
      case 'magnolia': {
        g.rect(x, topY, 2, th, Tn(116, 104, 96));
        const cw = Math.max(11, Math.trunc(15 * sz)), ch = Math.max(8, Math.trunc(11 * sz));
        this._blob(g, x + 1 - Math.trunc(cw / 2) + crown, topY - ch + 2 - lift, cw, ch, h & 0xFFFF, 1.0, Tn(34, 92, 58), Tn(72, 132, 86), Tn(18, 60, 40), Tn(252, 248, 238), 0.085);
        break;
      }
      case 'camellia': {
        const cw = Math.max(10, Math.trunc(13 * sz)), ch = Math.max(7, Math.trunc(9 * sz));
        const red = ((h >>> 9) & 1) === 0;
        this._blob(g, x + 1 - Math.trunc(cw / 2) + crown, baseY - ch + 1 - lift, cw, ch, h & 0xFFFF, 1.0,
          Tn(30, 84, 52), Tn(64, 122, 78), Tn(16, 54, 34), red ? Tn(208, 36, 64) : Tn(242, 112, 152), 0.17);
        break;
      }
      case 'franklin': {
        g.rect(x, topY, 2, th, bark);
        const cw = Math.max(7, Math.trunc(10 * sz)), ch = Math.max(9, Math.trunc(13 * sz));
        const left = x + 1 - Math.trunc(cw / 2) + crown, top = topY - ch + 2 - lift;
        this._blob(g, left, top, cw, ch, h & 0xFFFF, 0.93, Tn(228, 110, 40), Tn(248, 170, 70), Tn(170, 40, 30), Tn(190, 34, 34), 0.24);
        for (let i = 0; i < 4; i++) {
          const hh = hash(i, h & 0xFFFF);
          const fx = left + 1 + (hh % Math.max(1, cw - 2)), fy = top + 2 + ((hh >>> 8) % Math.max(1, ch - 4));
          g.rect(fx, fy, 1, 1, Tn(252, 252, 240));
          g.rect(fx, fy + 1, 1, 1, Tn(250, 214, 80));
        }
        break;
      }
      case 'fir':
        this._conifer(g, x + 1, baseY, 2, Math.trunc(17 * sz), Math.max(3, Math.trunc(5 * sz)), 4, h, Tn(30, 92, 72), Tn(54, 128, 98), Tn(20, 62, 52), a, crown, false);
        break;
      case 'evergreen':
        this._conifer(g, x + 1, baseY, 2, Math.trunc(14 * sz), Math.max(4, Math.trunc(7 * sz)), 4, h, Tn(28, 100, 60), Tn(52, 140, 84), Tn(18, 70, 44), a, crown, false);
        break;
      case 'christmas':
        this._conifer(g, x + 1, baseY, 2, Math.trunc(16 * sz), Math.max(4, Math.trunc(5.5 * sz)), 4, h, Tn(30, 96, 66), Tn(54, 132, 92), Tn(20, 66, 48), a, crown, true);
        break;
    }
  }

  _blob(g, left, top, cw, ch, seed, density, main, hi, lo, acc, accP) {
    for (let py = 0; py < ch; py++)
      for (let px = 0; px < cw; px++) {
        const nx = (px + 0.5 - cw / 2.0) / (cw / 2.0), ny = (py + 0.5 - ch / 2.0) / (ch / 2.0);
        if (nx * nx + ny * ny > 1) continue;
        const hp = hash(px * 31 + py, seed);
        if ((hp % 1000) / 1000.0 >= density) continue;
        let c;
        if (((hp >>> 10) % 1000) / 1000.0 < accP) c = acc;
        else if (ny < -0.3 && nx < 0.25) c = hi;
        else if (ny > 0.35 || nx > 0.7) c = lo;
        else c = main;
        g.rect(left + px, top + py, 1, 1, c);
      }
  }

  _conifer(g, cx, baseY, trunkH, height, maxHalf, tierH, seed, main, hi, lo, a, crown, decorated) {
    height = Math.max(10, height);
    const top = baseY - trunkH - height;
    g.rect(cx - 1, baseY - trunkH, 2, trunkH, this._tn(92, 62, 42, a));
    const snow = this._tn(244, 248, 255, a * this.sw[3]);
    const lights = [];
    for (let r = 0; r < height; r++) {
      const j = r % tierH;
      let half = Math.round(r * (maxHalf / height) + (j === tierH - 1 ? 1 : 0));
      half = Math.min(maxHalf, half);
      const y = top + r;
      for (let dx = -half; dx <= half; dx++) {
        const hp = hash(r * 41 + dx + 100, seed & 0xFFFF);
        let c = dx < -half * 0.25 ? hi : dx > half * 0.35 ? lo : main;
        if (hp % 10 === 0) c = lo;
        g.rect(cx + dx + crown, y, 1, 1, c);
      }
      if (snow.a > 0 && j === tierH - 1 && half >= 2) {
        g.rect(cx - half + crown, y, 2, 1, snow);
        g.rect(cx + half - 1 + crown, y, 2, 1, snow);
      }
      if (decorated && r >= 3 && r % 3 === 0) lights.push({ x: cx + (hash(r, seed) % Math.max(1, half * 2 - 1)) - half + 1 + crown, y: y });
    }
    if (snow.a > 0) g.rect(cx + crown, top, 1, 1, snow);
    if (!decorated) return;

    const baubles = [this._tn(224, 40, 52, a), this._tn(250, 206, 70, a), this._tn(90, 150, 244, a), this._tn(246, 120, 168, a)];
    for (let i = 0; i < lights.length; i++) g.rect(lights[i].x, lights[i].y + 1, 1, 1, baubles[(i + (seed % 4)) % baubles.length]);
    const beat = this.clock.beatIndex;
    const flash = this.marching ? Math.max(0, 1 - this.clock.phase / 0.5) : 0.3;
    const bulb = [C(255, 70, 70), C(255, 220, 90), C(110, 190, 255), C(255, 140, 210)];
    for (let i = 0; i < lights.length; i++) {
      const on = ((beat + i) & 1) === 0;
      if (!on && flash > 0.4) continue;
      this.glow.push({ x: lights[i].x, y: lights[i].y, color: withAlpha(Math.trunc(255 * a * (on ? 0.55 + 0.45 * flash : 0.35)), bulb[(i + (seed % 4)) % bulb.length]), halo: on ? 2 : 0, plus: false });
    }
    this.glow.push({ x: cx + crown, y: top - 1, color: CA(Math.trunc(255 * a), 255, 226, 120), halo: 3 + Math.trunc(this.bass * 3), plus: true });
  }

  _drawGlowSpots(g) {
    for (const s of this.glow) {
      if (s.halo > 0) g.ellipse(s.x - s.halo, s.y - s.halo, s.halo * 2 + 1, s.halo * 2 + 1, withAlpha(Math.min(255, Math.trunc(s.color.a / 4)), s.color));
      g.rect(s.x, s.y, 1, 1, s.color);
      if (s.plus) { g.rect(s.x - 1, s.y, 1, 1, s.color); g.rect(s.x + 1, s.y, 1, 1, s.color); g.rect(s.x, s.y - 1, 1, 1, s.color); g.rect(s.x, s.y + 1, 1, 1, s.color); }
    }
    this.glow.length = 0;
  }

  // ---- Weather ------------------------------------------------------------------------------------------------

  _drawWeather(g, lw) {
    const area = lw * Math.max(1, this.groundY);
    this._drawFalling(g, lw, 11, this.sw[0], Math.trunc(area / 300), PETAL_COLORS, 5, 4, 0.5, false);
    this._drawFalling(g, lw, 23, this.sw[2], Math.trunc(area / 240), LEAF_COLORS, 7, 6, 0.9, true);
    this._drawFalling(g, lw, 37, this.sw[3], Math.trunc(area / 110), SNOW_COLORS, 8, 2.5, 0.3, false);
    this._drawFireflies(g, lw, this.sw[1] * this.starlight());
  }

  _drawFalling(g, lw, seed, weight, maxCount, colors, fall, sway, wind, wide) {
    if (weight < 0.01 || maxCount < 1) return;
    const fieldH = this.groundY + 1;
    for (let i = 0; i < maxCount; i++) {
      if (i / maxCount >= weight) break;
      const h = hash(i, seed);
      const speed = 0.7 + ((h >>> 8) % 100) / 100.0 * 0.6;
      const y = (this.fallClock * fall * speed + ((h >>> 16) % 1000) / 1000.0 * fieldH) % fieldH;
      let x = (h % 1000) / 1000.0 * lw + Math.sin(this.time * 0.9 + i) * sway - this.scroll * wind - this.windOffset * (0.45 + wind);
      x = ((x % lw) + lw) % lw;
      g.rect(Math.trunc(x), Math.trunc(y), wide && (h & 1) === 0 ? 2 : 1, 1, this._shadeColor(colors[(h >>> 4) % colors.length]));
    }
  }

  _drawFireflies(g, lw, amount) {
    if (amount < 0.02) return;
    const max = Math.trunc(lw * Math.max(1, this.groundY) / 300);
    for (let i = 0; i < max; i++) {
      if (i / max >= amount) break;
      const h = hash(i, 51);
      let x = (h % 1000) / 1000.0 * lw + Math.sin(this.time * 0.5 + i * 1.7) * 5 - this.scroll * 0.4;
      x = ((x % lw) + lw) % lw;
      const y = this.groundY - 3 - ((h >>> 10) % 100) / 100.0 * 14 + Math.sin(this.time * 0.8 + i) * 2;
      const blink = 0.5 + 0.5 * Math.sin(this.time * 2.2 + i * 2.3);
      const a = Math.trunc(255 * blink);
      g.rect(Math.trunc(x) - 1, Math.trunc(y), 3, 1, CA(Math.trunc(a / 4), 210, 255, 110));
      g.rect(Math.trunc(x), Math.trunc(y) - 1, 1, 3, CA(Math.trunc(a / 4), 210, 255, 110));
      g.rect(Math.trunc(x), Math.trunc(y), 1, 1, CA(a, 236, 255, 150));
    }
  }

  _drawNotes(g, lw) {
    const cx = Math.trunc(lw / 2);
    for (const n of this.notes) {
      const alpha = Math.trunc(255 * Math.max(0, 1 - n.age / 1.3));
      const x = cx + Math.trunc(n.x), y = this.groundY - 18 - Math.trunc(n.y);
      const c = CA(alpha, 255, 244, 150);
      g.rect(x + 1, y, 1, 5, c); g.rect(x, y + 5, 2, 2, c); g.rect(x + 2, y, 2, 1, c);
    }
  }

  // ---- Camp ------------------------------------------------------------------------------------------------------

  get atCamp() { return this.camp > 0.85 && this.marching && !this.progressing; }

  _updateCamp(dt) {
    const freeToCamp = this.enc === 'None' || this.enc === 'Approaching';
    if (this.marching && !this.progressing && freeToCamp) this.camp = Math.min(1, this.camp + dt / 0.9);
    else if (this.progressing || !freeToCamp) this.camp = Math.max(0, this.camp - dt / 0.7);
  }

  _campSlotLeft(index, spriteWidth, lw) {
    const side = index % 2 === 0 ? 1 : -1;
    const k = Math.trunc(index / 2);
    return { x: lw / 2.0 + side * (18 + 22 * k) - spriteWidth / 2.0, faceLeft: side > 0 };
  }

  _drawCampfire(g, lw) {
    if (this.camp < 0.04) return;
    const fade = Math.min(1.0, this.camp * 2.5);
    const fx = Math.trunc(lw / 2), baseY = this.groundY;
    const a255 = Math.trunc(255 * fade);
    const rect = (x, y, w, h, c) => g.rect(x, y, w, h, withAlpha(a255, c));

    const stoneL = C(150, 154, 170), stoneD = C(98, 102, 124);
    for (let i = -3; i <= 3; i++) rect(fx + i * 2 - 1, baseY - 1 + (Math.abs(i) % 2), 2, 1, (i % 2 === 0) ? stoneL : stoneD);
    rect(fx - 5, baseY - 2, 10, 2, C(88, 56, 36));
    rect(fx - 4, baseY - 3, 8, 1, C(124, 82, 50));
    rect(fx - 3, baseY - 4, 2, 2, C(70, 44, 30));
    rect(fx + 2, baseY - 4, 2, 2, C(70, 44, 30));

    const leap = 8 + 3.2 * this.bass + 1.5 * this.beatImpulse;
    for (let dx = -4; dx <= 4; dx++) {
      const edge = Math.pow(Math.abs(dx) / 4.6, 1.6);
      const flicker = 0.72 + 0.28 * Math.sin(this.time * 9.0 + dx * 1.9) * Math.sin(this.time * 5.3 + dx * 0.7 + 1);
      const colH = Math.round(leap * (1 - edge) * flicker);
      for (let r = 0; r < colH; r++) {
        const ratio = r / Math.max(1, colH);
        const c = ratio < 0.3 ? C(214, 56, 22) : ratio < 0.62 ? C(248, 138, 34) : ratio < 0.86 ? C(255, 210, 76) : C(255, 244, 176);
        rect(fx + dx, baseY - 4 - r, 1, 1, c);
      }
    }
    for (let i = 0; i < 6; i++) {
      const ph = (this.time * 0.7 + i / 6.0) % 1.0;
      const sx = fx + Math.sin(i * 7.3 + this.time * 2.1) * 3.5 * ph + this.wind * ph * 4, sy = baseY - 8 - ph * (16 + 5 * this.bass);
      g.rect(Math.round(sx), Math.round(sy), 1, 1, CA(Math.trunc(a255 * (1 - ph)), 255, 214, 110));
    }
    for (let i = 0; i < 4; i++) {
      const ph = (this.time * 0.3 + i * 0.25) % 1.0;
      const sx = fx + Math.sin(i * 3.1 + this.time * 0.8) * 2 + ph * (2 + 10 * this.wind), sy = baseY - 14 - ph * 20;
      g.rect(Math.round(sx), Math.round(sy), 2, 1, CA(Math.trunc(70 * (1 - ph) * fade), 150, 150, 160));
    }
  }

  _drawCampfireGlow(g, lw) {
    if (this.camp < 0.04) return;
    const night = this.starlight();
    const strength = Math.min(1.0, this.camp * 2) * (0.22 + 0.78 * night) * (0.88 + 0.12 * Math.sin(this.time * 11) + 0.2 * this.bass);
    const cx = Math.trunc(lw / 2), cy = this.groundY - 6;
    const radius = [34, 24, 15, 8], alpha = [16, 28, 44, 70];
    for (let i = 0; i < radius.length; i++)
      g.ellipse(cx - radius[i], cy - radius[i] * 0.7, radius[i] * 2, radius[i] * 1.4, CA(Math.trunc(Math.min(255, alpha[i] * strength)), 255, 150, 60));
    g.ellipse(cx - 20, this.groundY - 1, 40, 4, CA(Math.trunc(Math.min(255, 80 * strength)), 255, 190, 90));
  }

  // ---- The party and the tavern ------------------------------------------------------------------------------------

  get isChoosing() { return this.enc === 'Waiting' && this.offer !== null; }

  _needsTavern() {
    if (this.party.length >= 6) return !this.oldManMet;
    return this.daysCompleted + 1 >= ENCOUNTER_DAY[this.party.length - 1];
  }

  _leaderX() {
    return isNaN(this.groupLeft) ? this._groupLeftTarget() + (this.party.length - 1) * SPACING : this.groupLeft + (this.party.length - 1) * SPACING;
  }
  _leaderCenterX() { return this._leaderX() + Sprites.party[this._frontKind()].w / 2.0; }
  _tavernDoorScreenX() { return this.tavernWorldX - this.scroll + Sprites.tavernDoorX; }
  _groupLeftTarget() {
    const settled = this.party.length - (this.enc === 'Joining' ? 1 : 0);
    return (this.lastLw - settled * SPACING) / 2.0 + 2;
  }

  _advanceParty(dt) {
    this._advanceCoinEffects(dt);
    this._advanceTraitEffects(dt);
    this._advanceEnemyEffects(dt);
    this._advanceItemEffects(dt);
    this._updateCamp(dt);
    const target = this._groupLeftTarget();
    this.groupLeft = isNaN(this.groupLeft) ? target : this.groupLeft + (target - this.groupLeft) * Math.min(1, dt * 3);

    if (this.enc === 'Joining') {
      this.joinT += dt / 1.8;
      if (this.joinT >= 1) {
        this.joinT = 1;
        if (this.party.length >= 6 && !this.oldManMet) this._startOldMan();
        else {
          this.enc = 'None';
          this.arrived = false;
          this.daysCompleted++;
          this.dayPhase = 0;
          this.raiseProgress();
        }
      }
    }
    if (this.enc === 'Story') this._advanceStory(dt);
    if (this.tavernVisible && this.enc === 'None' && this.tavernWorldX - this.scroll + Sprites.tavern.width < -2) this.tavernVisible = false;
  }

  _spawnTavern() {
    this.enc = 'Approaching';
    this.arrived = false;
    this.tavernVisible = true;
    this.doorOffset = this.party.length >= 5 ? 38 : 0;
    this.tavernWorldX = this.scroll + this.lastLw + 6;
  }

  _beginChoosing() {
    if (this.party.length >= 6) { this._startOldMan(); return; }
    this.enc = 'Waiting';
    if (this.offer === null) {
      const pool = PARTY.filter(k => k !== 'paca' && this.party.indexOf(k) < 0);
      if (pool.length === 0) { this.enc = 'None'; return; }
      const picks = [];
      while (picks.length < Math.min(2, pool.length)) { const k = pool[rnd(pool.length)]; if (picks.indexOf(k) < 0) picks.push(k); }
      this.offer = picks;
    }
    this.raiseProgress();
  }

  /** The player's pick (0 or 1) from the two on offer. */
  choose(index) {
    if (!this.isChoosing || index < 0 || index >= this.offer.length) return;
    this.party.push(this.offer[index]);
    this.offer = null;
    this.joinT = 0;
    this.enc = 'Joining';
    this.raiseProgress();
  }

  resetProgress() {
    this.party = ['paca'];
    this.offer = null;
    this.enc = 'None';
    this.arrived = false; this.tavernVisible = false; this.joinT = 0; this.move = 1; this.groupLeft = NaN;
    this.daysCompleted = 0; this.dayPhase = 0; this.yearDay = 0;
    this.notes.length = 0;
    this._resetStory(); this._resetCoins(); this._resetTraits(); this._resetItems();
    this.kills = {};
    this.raiseProgress();
  }

  // ---- Saved progress: the same string the exe writes, so an adventure can move between them ----------------------------

  saveState() {
    const f5 = this.dayPhase.toFixed(5);
    return ['3', this.party.map(k => PARTY_ENUM[k]).join(','), f5, String(this.daysCompleted), this.offer ? this.offer.map(k => PARTY_ENUM[k]).join(',') : '',
      this._saveStoryFields(), String(this.gold), this._saveTraitFields(), this._saveBestiaryFields()].concat(this._saveItemFields(), [this._saveHpFields()]).join('|');
  }

  loadState(state) {
    if (!state) return;
    try {
      const p = state.split('|');
      if (p.length < 4 || (p[0] !== '1' && p[0] !== '2' && p[0] !== '3')) return;
      const party = ['paca'];
      for (const name of p[1].split(',').filter(s => s)) {
        const k = KIND_FROM_ENUM[name];
        if (k && k !== 'paca' && party.indexOf(k) < 0) party.push(k);
      }
      this.party = party;
      this.groupLeft = NaN;
      this.enc = 'None'; this.arrived = false; this.tavernVisible = false; this.move = 1;

      let phase = parseFloat(p[2]); if (isNaN(phase)) phase = 0;
      phase = Math.max(0, Math.min(DAY_END_PHASE, phase));
      let completed;
      if (p[0] !== '1') { completed = parseInt(p[3], 10); if (isNaN(completed)) completed = 0; }
      else { const season = parseFloat(p[3]); completed = isNaN(season) ? 0 : Math.round(season - 1 - phase); }
      this.daysCompleted = Math.max(0, completed);
      this.dayPhase = phase;
      this.yearDay = this.playDays % (SEASON_DAYS * 4);

      this.offer = null;
      if (p.length > 4 && this.party.length < 6) {
        const offer = [];
        for (const name of p[4].split(',').filter(s => s)) {
          const k = KIND_FROM_ENUM[name];
          if (k && k !== 'paca' && this.party.indexOf(k) < 0 && offer.indexOf(k) < 0) offer.push(k);
        }
        if (offer.length === Math.min(2, 6 - this.party.length)) this.offer = offer;
      }
      this._loadStoryFields(p, 5);
      const gold = p.length > 9 ? parseInt(p[9], 10) : NaN;
      this.gold = isNaN(gold) ? 0 : Math.max(0, gold);
      this.coins.length = 0; this.flying.length = 0;
      this._loadTraitFields(p.length > 10 ? p[10] : null);
      this._loadBestiaryFields(p.length > 11 ? p[11] : null);
      this._loadItemFields(p.length > 12 ? p[12] : null, p.length > 13 ? p[13] : null, p.length > 14 ? p[14] : null);   // the bag, the hot slots, the Merchant's last day
      this._loadHpFields(p.length > 15 ? p[15] : null);   // members below full health (absent in older saves: everyone is at full)
    } catch (e) { /* a bad save just starts a fresh party */ }
  }

  // ---- Drawing the tavern and the party -----------------------------------------------------------------------------------

  _drawTavern(g, lw) {
    if (!this.tavernVisible) return;
    const open = (this.enc === 'Joining' && this.joinT > 0.02 && this.joinT < 0.9)
      || (this.enc === 'Story' && ((this.story === 'OldManExit' && this.storyT < 1.0) || (this.story === 'OldManLeave' && this.storyT > 0.8)));
    const img = open ? Sprites.tavernOpen : Sprites.tavern;
    const x = Math.round(this.tavernWorldX - this.scroll);
    if (x > lw || x + img.width < 0) return;
    const y = this.groundY + 1 - img.height;
    g.image(img, x, y);
    g.ellipse(x + Sprites.tavernDoorX - 9, this.groundY, 18, 3, CA(open ? 90 : 50, 255, 214, 110));
  }

  _drawParty(g, lw) {
    const n = this.party.length;
    const walking = this.marching && this.move > 0.05;
    const stepB = walking && (this.clock.beatIndex % 2 === 1);
    const leaderX = this._leaderX();
    const order = this._lineOrder();   // the members on their feet, then the fainted, who ride in the cart behind them
    const awake = this.party.filter(k => this.hpOf(k) > 0).length;
    const asleep = [];

    for (let i = n - 1; i >= 0; i--) {
      const kind = order[i];
      if (i >= awake) { asleep.unshift(kind); continue; }
      const sprite = Sprites.party[kind];
      const newcomer = this.enc === 'Joining' && kind === this.party[n - 1];
      const slotX = leaderX - i * SPACING;
      let xD = slotX;
      let legsB = stepB;
      let mirrored = false;
      if (this.camp > 0.001 && !newcomer) {
        const slot = this._campSlotLeft(i, sprite.w, lw);
        xD = slotX + (slot.x - slotX) * ease(this.camp);
        mirrored = slot.faceLeft && this.camp > 0.5;
        legsB = this.camp < 0.999 && (Math.trunc(this.time * 5)) % 2 === 1;
      }
      if (newcomer) {
        const doorLeft = this.tavernWorldX - this.scroll + Sprites.tavernDoorX - sprite.w / 2.0;
        const e = this.joinT * this.joinT * (3 - 2 * this.joinT);
        xD = doorLeft + (slotX - doorLeft) * e;
        legsB = (Math.trunc(this.time * 4)) % 2 === 1;
      }
      if (i === 0 && !newcomer) {
        if (this.peckAnim >= 0) xD += 2 * Math.sin(Math.PI * this.peckAnim);
        if (this.flinch > 0) xD -= 2;
      }
      if (this.bloodMoonT >= 0.5 && this.bloodMoonT < 0.72 && !newcomer) xD += (Math.trunc(this.time * 24) % 2 === 0 ? 1 : -1);   // the whole party shudders under the Blood Moon
      const x = Math.round(xD);

      let hop = 0;
      const dancing = this.camp > 0.9 && this.marching;
      if (dancing) {
        const p = (this.clock.phase - i * 0.07) / 0.3;
        if (p > 0 && p < 1) hop = Math.sin(Math.PI * p) * 1.2;
      } else if (walking && !newcomer) {
        const p = (this.clock.phase - (n - 1 - i) * 0.07) / 0.45;
        if (p > 0 && p < 1) hop = Math.sin(Math.PI * p) * 3;
      }
      let breath = 0;
      if (!walking && !dancing && !newcomer && Math.sin(this.time * 2 * Math.PI / IDLE_BREATH_SECONDS - i * 0.6) > 0) breath = 1;
      const y = this.groundY + 1 - sprite.h - breath - Math.round(hop);
      const frame = mirrored ? (legsB ? sprite.fb : sprite.fa) : (legsB ? sprite.b : sprite.a);
      g.ellipse(x + Math.trunc((sprite.w - 12) / 2), this.groundY, 12, 2, CA(90, 20, 30, 20));
      g.image(frame, x, y, false, undefined, sprite.w, sprite.h + breath);
      this._noteMemberRect(kind, x, y, sprite.w, sprite.h + breath);
      this.memberFrames[kind] = frame;
      delete this.memberClip[kind];
      if (this.hatLeft > 0 && !newcomer) this._drawStarHat(g, frame, x, y);
    }
    if (asleep.length > 0) this._drawCart(g, asleep, leaderX - awake * SPACING);
  }
}

// The exe's save strings name companions with C# enum names.
export const PARTY_ENUM = { paca: 'Paca', thief: 'Thief', warrior: 'Warrior', lightmage: 'LightMage', firemage: 'FireMage', fae: 'Fae' };
export const KIND_FROM_ENUM = {};
for (const k of Object.keys(PARTY_ENUM)) KIND_FROM_ENUM[PARTY_ENUM[k]] = k;
// Saves written before the art rework used the old names; they still load.
Object.assign(KIND_FROM_ENUM, { Chocobo: 'paca', MithraThief: 'thief', WhiteMage: 'lightmage', BlackMage: 'firemage', Moogle: 'fae' });

import { installCoins } from './coins.js';
import { installStory } from './story.js';
import { installTraits } from './traits.js';
import { installEnemies } from './enemies.js';
import { installItems } from './items.js';
import { installHealth, setKindNames } from './health.js';
setKindNames(k => PARTY_ENUM[k], n => KIND_FROM_ENUM[n]);
installHealth(PixelScene);
installCoins(PixelScene);
installStory(PixelScene);
installTraits(PixelScene);
installEnemies(PixelScene);
installItems(PixelScene);
