// The Tavern Jam. A button in the bottom-right corner of the adventure pulls the camera into a medieval tavern: the party sits and stands on the
// stage round the fire, each with an instrument of their own, jamming to whatever is playing on the radio. The camera drifts and slowly pulls in and
// out; the fireplace, the lanterns and the candles light the room (and the heroes) and flicker with the music. Now and then a hero puts their
// instrument on the rack by the wall and takes another. A port of src\PixelJam.cs: the two draw the same room from the same numbers.
//
// The room is drawn once per frame into a canvas SS times as big as its pixel grid (so a slow pan and zoom is smooth rather than jumping a whole
// pixel at a time), lit by a small light map, and the camera then shows a window of it.

import { C, CA, withAlpha, mix, ease, rnd, Pix } from './util.js';
import { Sprites } from './sprites.js';

export const JAM_W = 256, JAM_H = 96;   // the room, in its own pixels
const SS = 3;                            // canvas pixels per room pixel
const STAGE_L = 58, STAGE_R = 210, STAGE_TOP = 60, STAGE_FRONT = 66, STAGE_BOTTOM = 72;
const FEET_BACK = 63, FEET_FRONT = 65;   // where a hero's feet are on the stage (two rows, so the line is not ruler-straight)
const RACK_X = 216, RACK_SLOTS = [221, 230, 239, 248];
const FADE_SECONDS = 0.55;

// The instruments. `style` is how it is played (it decides how the player moves), `sit` whether it is played on a stool.
export const INSTRUMENTS = [
  { id: 'lute', style: 'strum', sit: true, color: [236, 188, 96] },
  { id: 'harp', style: 'strum', sit: false, color: [250, 226, 140] },
  { id: 'shawm', style: 'wind', sit: false, color: [255, 214, 150] },
  { id: 'psaltery', style: 'strum', sit: true, color: [255, 206, 120] },
  { id: 'tambourine', style: 'perc', sit: false, color: [255, 232, 130] },
  { id: 'tabor', style: 'perc', sit: false, color: [255, 170, 120] },
  { id: 'bells', style: 'perc', sit: false, color: [255, 240, 160] },
  { id: 'pipes', style: 'wind', sit: false, color: [196, 236, 170] },
  { id: 'guitar', style: 'strum', sit: true, color: [255, 196, 130] }
];
const INST = {}; INSTRUMENTS.forEach(i => { INST[i.id] = i; });

// Who plays what to begin with (a hero's own instrument, if it is free; otherwise the first one that is).
const PREFERRED = {
  paca: 'tambourine', thief: 'lute', warrior: 'tabor', lightmage: 'harp', firemage: 'shawm',
  fae: 'bells', druid: 'pipes', paladin: 'psaltery', shadowknight: 'guitar'
};

const WOOD = C(78, 52, 34), WOOD_D = C(56, 38, 26), WOOD_L = C(112, 78, 50);

export function installJam(P) {
  const m = P.prototype;

  m._initJam = function () {
    this.jamActive = false; this.jamOpening = false; this.jamClosing = false; this.jamT = 0; this.jamFade = 0;
    this.jamCanvas = null; this.jamG = null; this.jamBg = null; this.jamLight = null;
    this.jamMembers = []; this.jamRack = []; this.jamSwap = null; this.jamSwapIn = 30; this.jamNotes = []; this.jamSparks = []; this.jamWaves = [];
    this.jamCam = { x: JAM_W / 2, y: 48, vh: 62 }; this.jamShot = null; this.jamShotT = 0; this.jamBeatKick = 0;
  };

  /** Open the jam: the adventure holds while it is on. */
  m.openJam = function () {
    if (this.jamActive && !this.jamClosing) return;
    this.jamActive = true; this.jamClosing = false; this.jamOpening = true; this.jamFade = 0;
    this._jamSetUp();
  };

  /** Fade out of the jam and back to the road. */
  m.closeJam = function () { if (this.jamActive) this.jamClosing = true; };

  /** Whether the adventure is free enough for a jam: no choice, story, fight at the door, shop or tip is asking for the player. */
  Object.defineProperty(m, 'canJam', {
    get() {
      return !this.starting && !this.isGameOver && (this.enc === 'None' || this.enc === 'Approaching') && !this.isTipActive && !this.isScrollPrompt &&
        !this.isWaiting && !this.isSwapping && !this.isLevelSelect && !this.isDialogue && !this.isShopping && !this.isInnMenu && !this.isSkillChoice &&
        !this.isLevelFx && !this.isChoosing && this.targetItem === null && this.targetScroll === null;
    }
  });

  /** The heroes who play: the ones on their feet. */
  m._jamHeroes = function () {
    const out = this.party.filter(k => this.hpOf(k) > 0);
    return out.length ? out : this.party.slice(0, 1);
  };

  m._jamSetUp = function () {
    const heroes = this._jamHeroes();
    const used = {};
    const give = (kind) => {
      let id = PREFERRED[kind];
      if (!id || used[id]) { id = INSTRUMENTS.map(i => i.id).filter(x => !used[x])[0]; }
      used[id] = true; return id;
    };
    // Spread along the stage in two groups that face each other across a gap in the middle (so what they play is not in each other's way):
    // the leader nearest the middle, the others alternating outward.
    const n = heroes.length, mid = (STAGE_L + STAGE_R) / 2;
    const offsets = n % 2 === 1 ? [0, -25, 25, -50, 50, -75, 75] : [-15, 15, -40, 40, -65, 65];
    this.jamMembers = heroes.map((k, i) => {
      const slot = mid + offsets[i];
      const row = i % 2;
      return {
        kind: k, homeFace: offsets[i] < 0 ? 1 : -1, home: slot, x: slot, feet: row ? FEET_FRONT : FEET_BACK, homeFeet: row ? FEET_FRONT : FEET_BACK, inst: give(k),
        face: offsets[i] < 0 ? 1 : -1, sit: 0, state: 'play', st: 0, phase: Math.random() * 6.28, from: slot, fromFeet: 0, to: 0, toFeet: 0, pickSlot: 0, away: false
      };
    });
    for (const mb of this.jamMembers) mb.sit = INST[mb.inst].sit ? 1 : 0;
    const spare = INSTRUMENTS.map(i => i.id).filter(x => !used[x]);
    this.jamRack = spare.slice(0, RACK_SLOTS.length);
    this.jamSwap = null; this.jamSwapIn = 24 + Math.random() * 16;
    this.jamNotes.length = 0; this.jamSparks.length = 0; this.jamWaves.length = 0;
    this.jamT = 0; this.jamShot = null; this.jamShotT = 0;
    this.jamCam = { x: JAM_W / 2, y: 48, vh: 90 };
    this._jamNextShot(true);
  };

  // ---- Stepping ---------------------------------------------------------------------------------------

  m._advanceJam = function (dt) {
    this.jamT += dt;
    this._updateCrystalHum(false);   // (the adventure is paused, so a crystal's hum is silent)
    if (this.starting || this.isGameOver) { this.jamActive = false; this.jamClosing = false; return; }   // a restart, or the end of the adventure, leaves the tavern
    if (this.jamClosing) { this.jamFade -= dt / FADE_SECONDS; if (this.jamFade <= 0) { this.jamFade = 0; this.jamActive = false; this.jamClosing = false; return; } }
    else if (this.jamFade < 1) this.jamFade = Math.min(1, this.jamFade + dt / FADE_SECONDS);
    const playing = this.marching;
    if (this.clock.beatThisFrame && playing) this.jamBeatKick = 1;
    this.jamBeatKick = Math.max(0, this.jamBeatKick - dt * 5);

    // Heroes: their tempo, the swap with the rack, and the notes that float up from what they play.
    this._jamAdvanceSwap(dt);
    for (const mb of this.jamMembers) {
      mb.phase += dt;
      const target = INST[mb.inst].sit && mb.state === 'play' ? 1 : 0;
      mb.sit += Math.max(-1, Math.min(1, target - mb.sit)) * Math.min(1, dt * 3.4) * 1.2;
      mb.sit = Math.max(0, Math.min(1, mb.sit));
    }
    if (playing && this.clock.beatThisFrame) {
      for (const mb of this.jamMembers) {
        if (mb.state !== 'play' || Math.random() > 0.38 || this.jamNotes.length > 14) continue;
        const col = INST[mb.inst].color;
        this.jamNotes.push({ x: mb.x + mb.face * 4, y: mb.feet - 20, age: 0, vx: (Math.random() - 0.5) * 5, c: col, kind: rnd(2) });
      }
    }
    for (let i = this.jamNotes.length - 1; i >= 0; i--) {
      const n = this.jamNotes[i]; n.age += dt; n.y -= dt * 11; n.x += n.vx * dt + Math.sin(n.age * 4) * dt * 3;
      if (n.age > 1.9) this.jamNotes.splice(i, 1);
    }
    for (let i = this.jamWaves.length - 1; i >= 0; i--) { this.jamWaves[i].age += dt; if (this.jamWaves[i].age > 0.6) this.jamWaves.splice(i, 1); }
    if (Math.random() < dt * 5) this.jamSparks.push({ x: 22 + Math.random() * 22, y: 58, age: 0, vx: (Math.random() - 0.3) * 6, vy: -(10 + Math.random() * 12) });
    for (let i = this.jamSparks.length - 1; i >= 0; i--) {
      const s = this.jamSparks[i]; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.age > 1.6 || s.y < 4) this.jamSparks.splice(i, 1);
    }
    this._jamAdvanceCamera(dt);
  };

  /** Every so often one hero (a different one each time) puts their instrument on the rack by the wall and takes another. */
  m._jamAdvanceSwap = function (dt) {
    const sw = this.jamSwap;
    if (!sw) {
      this.jamSwapIn -= dt;
      if (this.jamSwapIn > 0 || !this.jamRack.length || this.jamMembers.length === 0) return;
      const ready = this.jamMembers.filter(mb => mb.state === 'play' && mb !== this._jamLastSwapper);
      const pool = ready.length ? ready : this.jamMembers.filter(mb => mb.state === 'play');
      if (!pool.length) return;
      const mb = pool[rnd(pool.length)];
      this._jamLastSwapper = mb;
      const slot = rnd(this.jamRack.length);
      this.jamSwap = { mb: mb, slot: slot };
      mb.state = 'rise'; mb.st = 0; mb.pickSlot = slot;
      this._jamNextShot(false, mb);
      return;
    }
    const mb = sw.mb;
    mb.st += dt;
    const rackX = RACK_SLOTS[sw.slot], rackFeet = 70;
    if (mb.state === 'rise') {
      if (mb.sit <= 0.02 && mb.st > 0.5) { mb.state = 'toRack'; mb.st = 0; mb.from = mb.x; mb.fromFeet = mb.feet; mb.to = rackX - 4; mb.toFeet = rackFeet; }
      else { mb.sit = Math.max(0, mb.sit - dt * 3); }
    } else if (mb.state === 'toRack' || mb.state === 'back') {
      const dur = Math.max(1.2, Math.abs(mb.to - mb.from) / 26);
      const u = Math.min(1, mb.st / dur), e = ease(u);
      mb.x = mb.from + (mb.to - mb.from) * e; mb.feet = mb.fromFeet + (mb.toFeet - mb.fromFeet) * e;
      mb.face = mb.to >= mb.from ? 1 : -1;
      if (u >= 1) {
        if (mb.state === 'toRack') { mb.state = 'swap'; mb.st = 0; mb.face = 1; }
        else { mb.state = 'sit'; mb.st = 0; mb.face = mb.homeFace; }
      }
    } else if (mb.state === 'swap') {
      if (!sw.done && mb.st > 0.7) {   // the old one goes on the peg, the new one comes off it
        const old = mb.inst; mb.inst = this.jamRack[sw.slot]; this.jamRack[sw.slot] = old; sw.done = true;
        for (let i = 0; i < 5; i++) this.jamSparks.push({ x: rackX + (Math.random() - 0.5) * 8, y: 44, age: 0, vx: (Math.random() - 0.5) * 14, vy: -(4 + Math.random() * 8) });
      }
      if (mb.st > 1.5) { mb.state = 'back'; mb.st = 0; mb.from = mb.x; mb.fromFeet = mb.feet; mb.to = mb.home; mb.toFeet = mb.homeFeet; }
    } else if (mb.state === 'sit') {
      mb.x = mb.home; mb.feet = mb.homeFeet;
      mb.sit = INST[mb.inst].sit ? Math.min(1, mb.sit + dt * 3) : 0;
      if (mb.st > 0.6) { mb.state = 'play'; mb.st = 0; this.jamSwap = null; this.jamSwapIn = 32 + Math.random() * 40; }
    }
  };

  // ---- The camera -----------------------------------------------------------------------------------

  /** A new shot. Mostly the camera stays well back (the whole room, the stage, the fire); now and then it moves in on one hero (a "portrait").
   *  When a hero is heading for the rack it follows them there. */
  m._jamNextShot = function (first, follow) {
    const mem = this.jamMembers;
    const pick = mem.length ? mem[rnd(mem.length)] : null;
    let kind = first ? 'wide' : ['wide', 'wide', 'stage', 'stage', 'fire', 'portrait'][rnd(6)];
    if (kind === 'portrait' && this._jamLastKind === 'portrait') kind = 'wide';   // (never two close shots in a row)
    if (follow) kind = 'follow';
    this._jamLastKind = kind;
    const aspect = this.jamAspect || 3;
    let s;
    if (kind === 'wide') s = { x: JAM_W / 2 + (Math.random() - 0.5) * 24, y: 48, vh0: 96, vh1: 86 };
    else if (kind === 'stage') s = { x: pick ? pick.home : 130, y: 50, vh0: 82, vh1: 72 };
    else if (kind === 'fire') s = { x: 60, y: 48, vh0: 80, vh1: 70 };
    else if (kind === 'portrait') {
      s = { x: pick ? pick.home : 130, y: 54, vh0: 42, vh1: 34 };
      if (rnd(2) === 0) { s.vh0 = 52; s.vh1 = 44; }
    } else s = { x: follow.x, y: 54, vh0: 66, vh1: 58, follow: follow };   // (the camera stays with them: see _jamAdvanceCamera)
    s.dur = kind === 'follow' ? 60 : kind === 'portrait' ? 7 + Math.random() * 5 : 10 + Math.random() * 7;
    s.dx = (s.follow ? 0 : (Math.random() - 0.5) * 10) * (aspect > 1.5 ? 1 : 0.4);   // a slow drift sideways while the shot lasts
    if (kind !== 'portrait' && aspect < 1.1) { s.vh0 = 96; s.vh1 = 88; s.dx = (Math.random() < 0.5 ? 1 : -1) * 100; }   // a tall, narrow screen cannot hold the whole stage: the shot pans along it
    this.jamShot = s; this.jamShotT = 0;
  };

  m._jamAdvanceCamera = function (dt) {
    this.jamShotT += dt;
    const s = this.jamShot;
    if (!s) return;
    if (this.jamShotT > s.dur || (s.follow && !this.jamSwap)) { this._jamNextShot(false); return; }
    const u = Math.min(1, this.jamShotT / s.dur), e = ease(u);
    let tx = s.x + s.dx * (u - 0.5), ty = s.y, tvh = s.vh0 + (s.vh1 - s.vh0) * e;
    if (s.follow) { tx = s.follow.x + s.follow.face * 8; ty = s.follow.feet - 8; tvh = 62 - 4 * ease(Math.min(1, this.jamShotT / 8)); }
    // a gentle sway on top, so even a held shot is never still
    tx += Math.sin(this.jamT * 0.31) * 3; ty += Math.sin(this.jamT * 0.23 + 1) * 1.2; tvh *= 1 + Math.sin(this.jamT * 0.17) * 0.02;
    const k = Math.min(1, dt * 1.4);   // the camera eases toward where the shot wants it
    const c = this.jamCam;
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k; c.vh += (tvh - c.vh) * k;
  };

  // ---- Drawing -----------------------------------------------------------------------------------------

  /** Draws the room onto `ctx` filling a control of w x h (the camera's window onto it, then the fade). */
  m.renderJam = function (ctx, w, h) {
    this.jamAspect = w / Math.max(1, h);
    if (!this.jamCanvas) {
      this.jamCanvas = document.createElement('canvas'); this.jamCanvas.width = JAM_W * SS; this.jamCanvas.height = JAM_H * SS;
      this.jamG = new Pix(this.jamCanvas);
      this.jamBg = this._jamBuildBackground();
      this.jamLight = { canvas: document.createElement('canvas'), tick: 0 };
      this.jamLight.canvas.width = JAM_W / 2; this.jamLight.canvas.height = JAM_H / 2;
      this.jamLight.image = this.jamLight.canvas.getContext('2d').createImageData(JAM_W / 2, JAM_H / 2);
      this.jamLight.sums = new Float32Array((JAM_W / 2) * (JAM_H / 2) * 4);
    }

    // The camera: a window of the room, as tall as the shot says and as wide as the control needs, kept inside the room.
    const cam = this.jamCam, aspect = w / h;
    let vh = Math.min(JAM_H, cam.vh * (1 - this.jamBeatKick * 0.012)), vw = vh * aspect;
    if (vw > JAM_W) { vw = JAM_W; vh = vw / aspect; }
    const x0 = Math.max(0, Math.min(JAM_W - vw, cam.x - vw / 2)), y0 = Math.max(0, Math.min(JAM_H - vh, cam.y - vh / 2));
    this.jamView = { x0: x0, y0: y0, vw: vw, vh: vh };

    const g = this.jamG, cx = g.ctx;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.imageSmoothingEnabled = false;
    cx.globalCompositeOperation = 'copy';   // the room's own picture is opaque: copy it over, no blending
    cx.drawImage(this.jamBg, 0, 0);
    cx.globalCompositeOperation = 'source-over';
    cx.setTransform(SS, 0, 0, SS, 0, 0);
    this._jamDrawFire(g);
    this._jamDrawLanterns(g);
    this._jamDrawRack(g);
    this._jamDrawCat(g);
    this._jamDrawHeroes(g);
    this._jamDrawEffects(g);
    this._jamApplyLight(cx);
    this._jamDrawGlows(g);
    cx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;   // (the room is drawn 3x as fine as its pixels, so a slow pan still moves smoothly and the pixels stay sharp)
    ctx.drawImage(this.jamCanvas, x0 * SS, y0 * SS, vw * SS, vh * SS, 0, 0, w, h);
    if (this.jamFade < 1) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - ease(this.jamFade)).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  };

  // ---- The room that does not move ------------------------------------------------------------------------

  m._jamBuildBackground = function () {
    const cv = document.createElement('canvas'); cv.width = JAM_W * SS; cv.height = JAM_H * SS;
    const g = new Pix(cv), cx = g.ctx;
    cx.setTransform(SS, 0, 0, SS, 0, 0);
    // the back wall: planks, darker toward the ceiling
    for (let x = 0; x < JAM_W; x += 8) {
      g.rect(x, 0, 8, 66, ((x / 8) | 0) % 2 ? C(68, 45, 31) : C(62, 41, 28));
      g.rect(x, 0, 1, 66, C(46, 30, 22));
    }
    for (let y = 0; y < 16; y += 2) g.rect(0, y, JAM_W, 2, CA(Math.round(150 - y * 9), 22, 14, 14));
    // wainscot: boards along the lower wall, and a rail
    g.rect(0, 46, JAM_W, 20, C(64, 42, 28));
    for (let y = 48; y < 66; y += 4) g.rect(0, y, JAM_W, 1, C(48, 31, 21));
    g.rect(0, 44, JAM_W, 2, C(104, 72, 46)); g.rect(0, 46, JAM_W, 1, C(40, 26, 18));
    // beams across the ceiling, and the two posts at the ends of the stage
    g.rect(0, 0, JAM_W, 4, C(40, 27, 20));
    g.rect(0, 10, JAM_W, 5, C(54, 36, 25)); g.rect(0, 10, JAM_W, 1, C(88, 60, 40)); g.rect(0, 14, JAM_W, 1, C(30, 20, 15));
    for (const px of [62, 190]) {
      g.rect(px, 0, 7, 72, C(60, 40, 28)); g.rect(px, 0, 1, 72, C(92, 64, 42)); g.rect(px + 6, 0, 1, 72, C(36, 24, 18));
      g.rect(px - 2, 11, 11, 3, C(70, 48, 32));   // a bracket where the beam meets the post
    }
    // the window, with the night in it
    g.rect(90, 17, 20, 22, C(46, 30, 22)); g.rect(92, 19, 16, 18, C(20, 28, 66)); g.ellipse(92, 19, 16, 8, C(22, 32, 76));
    g.rect(92, 19, 16, 8, C(22, 32, 76));
    for (const [sx, sy] of [[94, 21], [100, 24], [105, 22], [97, 30], [103, 32], [106, 28]]) g.rect(sx, sy, 1, 1, C(230, 236, 255));
    g.ellipse(102, 20, 5, 5, C(244, 240, 214)); g.ellipse(103, 20, 4, 5, C(22, 32, 76));   // a thin moon
    g.rect(99, 19, 2, 18, C(46, 30, 22)); g.rect(92, 28, 16, 2, C(46, 30, 22)); g.rect(88, 39, 24, 3, C(96, 66, 42)); g.rect(88, 42, 24, 1, C(40, 26, 18));
    // the tapestry
    g.rect(116, 13, 24, 2, C(88, 60, 38));
    g.rect(118, 15, 20, 28, C(128, 32, 42)); g.rect(118, 15, 2, 28, C(92, 22, 32)); g.rect(136, 15, 2, 28, C(92, 22, 32));
    for (let i = 0; i < 4; i++) g.rect(118 + i * 5, 43, 4, 3 - (i % 2), C(128, 32, 42));
    g.rect(118, 41, 20, 1, C(222, 176, 70));
    g.ellipse(124, 26, 9, 8, C(226, 176, 72)); g.ellipse(126, 28, 5, 4, C(92, 44, 26));
    for (let i = 0; i < 6; i++) g.rect(131 + i, 24 - i, 2, 2, C(226, 176, 72));
    g.rect(137, 17, 2, 2, C(226, 176, 72));
    // a shelf of mugs and two barrels
    g.rect(146, 32, 34, 2, C(104, 72, 46)); g.rect(146, 34, 34, 1, C(40, 26, 18));
    for (let i = 0; i < 5; i++) { g.rect(149 + i * 6, 28, 4, 4, C(180, 140, 90)); g.rect(153 + i * 6, 29, 1, 2, C(180, 140, 90)); g.rect(149 + i * 6, 28, 4, 1, C(236, 224, 190)); }
    for (const bx of [150, 166]) {
      g.ellipse(bx, 46, 14, 18, C(104, 68, 40)); g.rect(bx, 49, 14, 12, C(104, 68, 40));
      g.rect(bx, 51, 14, 1, C(52, 52, 60)); g.rect(bx, 58, 14, 1, C(52, 52, 60)); g.rect(bx + 2, 47, 2, 14, C(138, 94, 58)); g.rect(bx + 11, 47, 1, 14, C(70, 44, 28));
    }
    // the fireplace: a breast of stone with the opening in it
    for (let by = 6, row = 0; by < 66; by += 5, row++)
      for (let bx = 4 - (row % 2) * 5; bx < 62; bx += 10) {
        const sh = (bx * 7 + by * 13) % 3;
        g.rect(Math.max(6, bx), by, Math.min(9, 60 - Math.max(6, bx) + 2), 4, sh === 0 ? C(112, 100, 94) : sh === 1 ? C(92, 82, 78) : C(78, 68, 66));
      }
    g.rect(4, 6, 2, 60, C(56, 48, 46)); g.rect(58, 6, 2, 60, C(44, 38, 38));
    g.rect(2, 26, 60, 4, C(100, 68, 42)); g.rect(2, 26, 60, 1, C(150, 108, 70)); g.rect(2, 30, 60, 1, C(40, 26, 18));
    g.rect(18, 34, 28, 30, C(26, 16, 14)); g.ellipse(18, 30, 28, 14, C(26, 16, 14));
    g.rect(16, 34, 2, 30, C(66, 56, 54)); g.rect(46, 34, 2, 30, C(66, 56, 54));
    g.rect(11, 22, 3, 4, C(240, 232, 200)); g.rect(11, 25, 3, 1, C(190, 170, 130));   // a candle on the mantel
    // a painted shield above the mantel
    g.rect(28, 12, 9, 11, C(40, 28, 22)); g.rect(29, 13, 7, 9, C(150, 36, 40)); g.rect(32, 13, 1, 9, C(236, 226, 190)); g.rect(29, 17, 7, 1, C(236, 226, 190));
    // the hearthstones
    g.rect(8, 64, 48, 4, C(98, 90, 88)); g.rect(8, 64, 48, 1, C(138, 128, 122)); g.rect(8, 67, 48, 1, C(50, 44, 44));
    // the floor of the room: planks that open out toward the viewer
    g.rect(0, 66, JAM_W, 30, C(94, 64, 42));
    for (const [fy, hh] of [[69, 1], [74, 1], [80, 1], [87, 1], [95, 1]]) g.rect(0, fy, JAM_W, hh, C(66, 44, 30));
    for (let r = 0; r < 5; r++) for (let x = (r * 37) % 29; x < JAM_W; x += 41) g.rect(x, 66 + [0, 3, 8, 14, 21][r], 1, [3, 5, 6, 7, 9][r], C(66, 44, 30));
    for (let r = 0; r < 4; r++) g.rect(0, 67 + [0, 5, 11, 18][r], JAM_W, 1, C(112, 78, 52));
    // the stage: its top, its lip and its front
    g.rect(STAGE_L, STAGE_TOP, STAGE_R - STAGE_L, STAGE_FRONT - STAGE_TOP, C(132, 92, 58));
    for (let y = STAGE_TOP + 2; y < STAGE_FRONT; y += 2) g.rect(STAGE_L, y, STAGE_R - STAGE_L, 1, C(110, 76, 48));
    for (let x = STAGE_L + 6; x < STAGE_R; x += 17) g.rect(x, STAGE_TOP, 1, STAGE_FRONT - STAGE_TOP, C(98, 66, 42));
    g.rect(STAGE_L, STAGE_FRONT, STAGE_R - STAGE_L, 1, C(176, 128, 82));
    g.rect(STAGE_L, STAGE_FRONT + 1, STAGE_R - STAGE_L, STAGE_BOTTOM - STAGE_FRONT - 1, C(88, 58, 38));
    for (let x = STAGE_L + 5; x < STAGE_R; x += 10) g.rect(x, STAGE_FRONT + 1, 1, STAGE_BOTTOM - STAGE_FRONT - 1, C(62, 40, 28));
    g.rect(STAGE_L, STAGE_BOTTOM, STAGE_R - STAGE_L, 2, CA(110, 20, 12, 10));
    g.rect(STAGE_L - 2, STAGE_TOP, 2, STAGE_BOTTOM - STAGE_TOP, C(70, 46, 30)); g.rect(STAGE_R, STAGE_TOP, 2, STAGE_BOTTOM - STAGE_TOP, C(70, 46, 30));
    // two round tables in the front corners, with their mugs and a candle, and stools round them
    for (const tx of [30, 226]) {
      g.ellipse(tx - 15, 80, 30, 9, C(40, 26, 18)); g.ellipse(tx - 14, 78, 28, 8, C(124, 86, 54)); g.ellipse(tx - 11, 79, 22, 5, C(142, 102, 66));
      g.rect(tx - 2, 83, 4, 9, C(68, 44, 30));
      g.rect(tx - 8, 77, 3, 3, C(190, 150, 96)); g.rect(tx + 6, 76, 3, 3, C(190, 150, 96)); g.rect(tx - 8, 77, 3, 1, C(240, 226, 190));
      g.rect(tx, 74, 2, 4, C(240, 232, 200));
      for (const sx of [tx - 24, tx + 20]) { g.ellipse(sx, 84, 9, 4, C(112, 76, 48)); g.rect(sx + 1, 86, 2, 6, C(60, 40, 28)); g.rect(sx + 6, 86, 2, 6, C(60, 40, 28)); }
    }
    return cv;
  };

  // ---- The things that move -------------------------------------------------------------------------------

  m._jamDrawFire = function (g) {
    const t = this.jamT, bass = this.marching ? this.bass : 0, kick = this.jamBeatKick;
    const fx = 32, base = 63;
    g.rect(fx - 9, base - 2, 18, 2, C(78, 50, 32)); g.rect(fx - 8, base - 3, 16, 1, C(120, 80, 48));   // the logs
    g.rect(fx - 6, base - 5, 3, 3, C(66, 42, 28)); g.rect(fx + 3, base - 5, 3, 3, C(66, 42, 28));
    const leap = 12 + 7 * bass + 3 * kick;
    for (let dx = -8; dx <= 8; dx++) {
      const edge = Math.pow(Math.abs(dx) / 9.0, 1.5);
      const flick = 0.72 + 0.28 * Math.sin(t * 9 + dx * 1.7) * Math.sin(t * 5.3 + dx * 0.6 + 1);
      const colH = Math.round(leap * (1 - edge) * flick);
      for (let r = 0; r < colH; r++) {
        const q = r / Math.max(1, colH);
        const c = q < 0.3 ? C(214, 56, 22) : q < 0.62 ? C(248, 138, 34) : q < 0.86 ? C(255, 210, 76) : C(255, 244, 176);
        g.rect(fx + dx, base - 4 - r, 1, 1, c);
      }
    }
    for (const s of this.jamSparks) {
      g.rect(Math.round(s.x), Math.round(s.y), 1, 1, CA(Math.round(255 * (1 - s.age / 1.6)), 255, 214, 110));
    }
  };

  m._jamLanternX = function (i) { return [98, 152, 206][i] + Math.sin(this.jamT * 0.9 + i * 2.1) * 1.4; };

  m._jamDrawLanterns = function (g) {
    for (let i = 0; i < 3; i++) {
      const x = Math.round(this._jamLanternX(i)), top = 15, y = [24, 22, 25][i];
      for (let cy = top; cy < y; cy += 2) g.rect(x, cy, 1, 1, C(60, 60, 68));   // the chain
      g.rect(x - 3, y, 7, 1, C(40, 40, 48)); g.rect(x - 2, y - 1, 5, 1, C(40, 40, 48));
      g.rect(x - 3, y + 1, 7, 7, C(250, 214, 120)); g.rect(x - 2, y + 2, 5, 5, C(255, 240, 176));
      g.rect(x - 3, y + 1, 1, 7, C(40, 40, 48)); g.rect(x + 3, y + 1, 1, 7, C(40, 40, 48)); g.rect(x, y + 1, 1, 7, CA(120, 40, 40, 48));
      g.rect(x - 3, y + 8, 7, 1, C(40, 40, 48)); g.rect(x - 1, y + 9, 3, 1, C(40, 40, 48));
    }
  };

  /** The instrument rack: a board on the wall with pegs, and whatever is spare hung on it. */
  m._jamDrawRack = function (g) {
    g.rect(RACK_X - 1, 21, 42, 45, C(34, 22, 16)); g.rect(RACK_X, 22, 40, 43, C(122, 86, 56)); g.rect(RACK_X, 22, 40, 1, C(168, 124, 82)); g.rect(RACK_X, 64, 40, 1, C(78, 52, 34));
    for (let y = 26; y < 64; y += 6) g.rect(RACK_X + 1, y, 38, 1, C(104, 72, 46));
    for (const sx of RACK_SLOTS) { g.rect(sx - 2, 26, 5, 3, C(210, 190, 140)); g.rect(sx, 26, 1, 2, C(60, 44, 30)); }
    g.rect(RACK_X - 3, 65, 46, 3, C(70, 46, 30)); g.rect(RACK_X - 3, 65, 46, 1, C(140, 100, 64));
    for (let i = 0; i < this.jamRack.length; i++) {
      const id = this.jamRack[i];
      if (!id) continue;
      const bob = this.jamSwap && this.jamSwap.slot === i && this.jamSwap.mb.state === 'swap' ? Math.sin(this.jamT * 16) * 0.6 : 0;
      this._jamInstrument(g, id, RACK_SLOTS[i], 30 + bob, 1, 0, 0, true);
    }
  };

  /** A cat asleep in front of the fire, breathing. */
  m._jamDrawCat = function (g) {
    const br = Math.sin(this.jamT * 1.6) > 0 ? 1 : 0;
    g.ellipse(30, 68 - br, 11, 5 + br, C(210, 130, 60)); g.ellipse(27, 67 - br, 5, 4, C(222, 150, 76));
    g.rect(36, 69, 5, 1, C(210, 130, 60)); g.rect(33, 66 - br, 1, 1, C(150, 80, 36)); g.rect(36, 66 - br, 1, 1, C(150, 80, 36));
    g.rect(26, 66 - br, 1, 1, C(150, 80, 36)); g.rect(28, 66 - br, 1, 1, C(150, 80, 36));
  };

  m._jamDrawHeroes = function (g) {
    const order = this.jamMembers.slice().sort((a, b) => a.feet - b.feet);
    const playing = this.marching, beat = this.clock.beatIndex, ph = this.clock.phase;
    for (const mb of order) {
      const sp = Sprites.party[mb.kind];
      if (!sp) continue;
      const inst = INST[mb.inst], busy = mb.state === 'play' && playing;
      const walking = mb.state === 'toRack' || mb.state === 'back';
      // The player's own tempo: percussion hops on the beat, strings and winds sway.
      let hop = 0;
      if (busy) {
        const p = (ph - (mb.phase % 1) * 0.05) / 0.4;
        hop = p > 0 && p < 1 ? Math.sin(Math.PI * p) * (inst.style === 'perc' ? 1.6 : inst.style === 'strum' ? 0.9 : 0.5) : 0;
      }
      const x = Math.round(mb.x - sp.w / 2), cut = Math.round(3 * mb.sit);
      const feet = Math.round(mb.feet);
      const yTop = feet - sp.h + cut - Math.round(hop);
      const frames = mb.face > 0 ? sp.f : sp.ff;
      const fi = walking ? Math.floor(this.jamT * 6) % 4 : busy && ((beat + this.jamMembers.indexOf(mb)) % 2 === 1) && inst.style !== 'wind' ? 1 : 0;
      // the stool they sit on
      if (INST[mb.inst].sit && mb.state !== 'toRack' && mb.state !== 'back' && mb.state !== 'swap') {
        g.rect(Math.round(mb.x) - 6, feet - 5, 12, 2, C(140, 98, 60)); g.rect(Math.round(mb.x) - 6, feet - 5, 12, 1, C(176, 130, 82));
        g.rect(Math.round(mb.x) - 5, feet - 3, 2, 3, C(70, 46, 30)); g.rect(Math.round(mb.x) + 3, feet - 3, 2, 3, C(70, 46, 30));
      }
      g.ellipse(Math.round(mb.x) - 6, feet - 1, 12, 3, CA(110, 14, 8, 8));
      const ctx = g.ctx, img = frames[fi];
      ctx.drawImage(img, 0, 0, sp.w, sp.h - cut, x, yTop, sp.w, sp.h - cut);
      mb.hold = { x: mb.x, top: yTop };
      // what they play (carried, not played, while they walk)
      if (mb.state !== 'swap' || !(this.jamSwap && this.jamSwap.done)) this._jamInstrument(g, mb.inst, Math.round(mb.x) + mb.face * 3, yTop + 8, mb.face, busy ? 1 : 0, mb.phase, false, mb);
      else this._jamInstrument(g, mb.inst, Math.round(mb.x) + mb.face * 3, yTop + 8, mb.face, 0, mb.phase, false, mb);
    }
  };

  m._jamDrawEffects = function (g) {
    for (const n of this.jamNotes) {
      const a = Math.max(0, Math.min(1, n.age < 0.2 ? n.age / 0.2 : 1 - (n.age - 1.1) / 0.8));
      const col = CA(Math.round(255 * a), n.c[0], n.c[1], n.c[2]), x = Math.round(n.x), y = Math.round(n.y);
      g.rect(x, y + 3, 2, 2, col); g.rect(x + 1, y, 1, 4, col);
      if (n.kind === 1) { g.rect(x + 2, y, 1, 1, col); g.rect(x + 2, y + 1, 1, 1, col); }
      else { g.rect(x + 2, y, 2, 1, col); }
    }
    for (const w of this.jamWaves) {
      const r = 2 + w.age * 12, a = Math.round(200 * (1 - w.age / 0.6));
      g.ring(w.x - r / 2, w.y - r / 2, r, r, CA(a, 255, 240, 200));
    }
  };

  // ---- Light ------------------------------------------------------------------------------------------

  m._jamLights = function () {
    const t = this.jamT, bass = this.marching ? this.bass : 0, kick = this.jamBeatKick, treble = this.marching ? this.treble : 0;
    const flick = (s) => 0.86 + 0.14 * Math.sin(t * 7.3 + s) * Math.sin(t * 4.1 + s * 2.3);
    const L = [];
    L.push({ x: 32, y: 52, r: 92, k: (1.2 + 0.45 * bass + 0.2 * kick) * flick(0), c: [255, 150, 64] });   // the fireplace
    for (let i = 0; i < 3; i++) L.push({ x: this._jamLanternX(i), y: [29, 27, 30][i], r: 60, k: (0.9 + 0.25 * treble) * flick(i + 1), c: [255, 200, 112] });
    L.push({ x: 12, y: 21, r: 20, k: 0.55 * flick(5), c: [255, 190, 100] });                               // a candle on the mantel
    L.push({ x: 30, y: 74, r: 30, k: 0.6 * flick(6), c: [255, 190, 100] });                                // the candles on the tables
    L.push({ x: 226, y: 74, r: 30, k: 0.6 * flick(7), c: [255, 190, 100] });
    L.push({ x: 100, y: 28, r: 44, k: 0.42, c: [140, 160, 255] });                                         // the moon in the window
    L.push({ x: 134, y: 58, r: 96, k: 0.5 + 0.14 * kick, c: [255, 180, 100] });                            // a warm wash over the stage
    return L;
  };

  /** The light map: a small grid, where every cell is as dark as the room is there and as warm as the lamps make it, laid over the room.
   *  The lamps flicker slowly, so the grid is worked out every other frame (and each lamp only touches the cells it reaches). The dark rim round
   *  the camera's picture is part of it too: it costs nothing here, where a full-screen overlay would cost a lot at full-screen sizes. */
  m._jamApplyLight = function (cx) {
    const lc = this.jamLight.canvas, lw = lc.width, lh = lc.height, lctx = lc.getContext('2d');
    if ((this.jamLight.tick++ & 1) === 0) {
      const img = this.jamLight.image, d = img.data, sums = this.jamLight.sums, L = this._jamLights();
      sums.fill(0);
      for (const l of L) {
        const cx0 = Math.max(0, Math.floor((l.x - l.r) / 2)), cx1 = Math.min(lw - 1, Math.ceil((l.x + l.r) / 2));
        const cy0 = Math.max(0, Math.floor((l.y - l.r / 1.15) / 2)), cy1 = Math.min(lh - 1, Math.ceil((l.y + l.r / 1.15) / 2));
        const inv = 1 / (l.r * l.r);
        for (let y = cy0; y <= cy1; y++) {
          const dy = (y * 2 + 1 - l.y) * 1.15, dy2 = dy * dy;
          for (let x = cx0; x <= cx1; x++) {
            const dx = x * 2 + 1 - l.x, q = (dx * dx + dy2) * inv;
            if (q >= 1) continue;
            const f = 1 - q, w = l.k * f * Math.sqrt(f), o = (y * lw + x) * 4;
            sums[o] += w * l.c[0]; sums[o + 1] += w * l.c[1]; sums[o + 2] += w * l.c[2]; sums[o + 3] += w;
          }
        }
      }
      const amb = 0.62, v = this.jamView || { x0: 0, y0: 0, vw: JAM_W, vh: JAM_H };
      for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
        const i = (y * lw + x) * 4, tot = sums[i + 3], I = Math.min(1, tot);
        let ad = amb * (1 - I), wr = 255, wg = 190, wb = 110;
        if (tot > 0.0001) { wr = sums[i] / tot; wg = sums[i + 1] / tot; wb = sums[i + 2] / tot; }
        const aw = Math.min(0.4, tot * 0.34);
        // the dark rim round whatever the camera is showing
        const nx = ((x * 2 + 1) - v.x0) / v.vw - 0.5, ny = ((y * 2 + 1) - v.y0) / v.vh - 0.5;
        const dd = Math.sqrt(nx * nx + ny * ny) * 2, rim = Math.max(0, Math.min(1, (dd - 0.62) / 0.7)) * 0.55;
        ad = 1 - (1 - ad) * (1 - rim);
        const A = 1 - (1 - ad) * (1 - aw);
        if (A <= 0.001) { d[i + 3] = 0; continue; }
        d[i] = Math.round((10 * ad * (1 - aw) + wr * aw) / A); d[i + 1] = Math.round((8 * ad * (1 - aw) + wg * aw) / A);
        d[i + 2] = Math.round((28 * ad * (1 - aw) + wb * aw) / A); d[i + 3] = Math.round(A * 255);
      }
      lctx.putImageData(img, 0, 0);
    }
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(lc, 0, 0, lw, lh, 0, 0, JAM_W, JAM_H);
    cx.imageSmoothingEnabled = false;
  };

  /** The flames, lantern glass and candle flames, over the light so they stay bright. */
  m._jamDrawGlows = function (g) {
    const t = this.jamT;
    for (let i = 0; i < 3; i++) {
      const x = Math.round(this._jamLanternX(i)), y = [24, 22, 25][i];
      g.rect(x - 2, y + 2, 5, 5, CA(220, 255, 236, 160)); g.rect(x - 1, y + 3, 3, 3, CA(255, 255, 250, 220));
    }
    for (const [fx, fy] of [[12, 21], [30, 73], [226, 73]]) {
      const h = 2 + (Math.sin(t * 11 + fx) > 0 ? 1 : 0);
      g.rect(fx, fy - h, 1, h, C(255, 220, 110)); g.rect(fx, fy - h - 1, 1, 1, C(255, 250, 200));
    }
  };

  // ---- The instruments ---------------------------------------------------------------------------------------

  /** Draws one instrument. (ox, oy) is where it is held (the player's belly, facing `face`); `play` is 1 while it is being played, `ph` the
   *  player's own phase; `rack` draws it hung on a peg instead. */
  m._jamInstrument = function (g, id, ox, oy, face, play, ph, rack, mb) {
    const r = (dx, dy, w, h, c) => g.rect(face > 0 ? ox + dx : ox - dx - w, oy + dy, w, h, c);
    const t = this.jamT, beat = this.clock.phase, kick = play ? this.jamBeatKick : 0;
    const strum = play ? Math.sin(t * 17 + ph) : 0, hand = C(240, 200, 160);
    const wood = C(176, 112, 58), woodD = C(110, 68, 34), woodL = C(214, 150, 84), hole = C(40, 24, 16), str = C(236, 226, 196), gold = C(240, 196, 70);
    switch (id) {
      case 'lute':
        r(0, 0, 9, 7, woodD); r(1, 1, 7, 5, wood); r(2, 1, 4, 2, woodL); r(3, 3, 3, 3, hole); r(4, 4, 1, 1, C(150, 90, 50));
        for (let i = 0; i < 6; i++) r(7 + i, -i, 2, 2, C(66, 42, 26));
        r(12, -8, 3, 3, C(66, 42, 26)); r(14, -9, 1, 2, C(66, 42, 26)); r(12, -9, 1, 1, gold);
        r(1, 3, 6, 1, str);
        if (!rack) { r(2 + Math.round(strum), 3 + Math.round(strum * 0.6), 2, 2, hand); if (play && Math.sin(t * 9 + ph) > 0.7) r(5, 2, 1, 1, C(255, 255, 255)); }
        break;
      case 'harp':
        r(1, -7, 12, 2, C(160, 104, 52)); r(1, -7, 12, 1, woodL);
        r(1, -5, 2, 17, C(190, 140, 70)); r(10, -5, 4, 17, C(150, 96, 48)); r(10, -5, 1, 17, woodL); r(9, 10, 6, 2, woodD);
        for (let i = 0; i < 5; i++) { r(3 + i * 1.4 | 0, -5 + i * 1, 1, 9 + 2 * i - i, str); }
        r(2, -6, 12, 1, gold);
        if (!rack && play) { const sy = Math.round(((Math.sin(t * 6 + ph) + 1) / 2) * 9); r(3, -3 + sy, 7, 1, C(255, 255, 255)); r(1 + Math.round(strum), -2 + sy, 2, 2, hand); }
        break;
      case 'shawm': {
        const sway = play ? Math.round(Math.sin(t * 3 + ph)) : 0;
        r(-1, -6, 2, 2, C(224, 200, 124)); r(0, -4, 2, 1, C(60, 40, 28));
        for (let i = 0; i < 8; i++) r(1 + i, -4 + i + (i > 4 ? sway : 0), 2, 2, C(78, 48, 30));
        r(3, -2, 1, 1, gold); r(6, 1, 1, 1, gold); r(4, 0, 1, 1, hole); r(5, 1, 1, 1, hole);
        r(8, 4 + sway, 5, 3, C(110, 68, 38)); r(8, 4 + sway, 5, 1, gold); r(9, 6 + sway, 3, 1, hole);
        if (!rack && play && kick > 0.4) this.jamWaves.length < 4 && this.jamWaves.push({ x: ox + face * 11, y: oy + 6, age: 0 });
        break;
      }
      case 'psaltery':
        for (let i = 0; i < 5; i++) r(2 - i * 0, 3 + i, 8 + i * 2 - 1 + 1, 1, i === 0 ? woodL : woodD);
        r(0, 4, 14, 3, wood); r(2, 3, 10, 1, woodL); r(1, 7, 13, 1, woodD);
        for (let i = 0; i < 4; i++) r(1 + i * 3, 4, 1, 3, str);
        r(0, 4, 1, 3, gold);
        if (!rack && play) { const k2 = 2 + ((Math.floor(t * 7 + ph) % 4) * 3); r(k2, 3, 1, 1, C(255, 255, 255)); r(k2 - 1 + Math.round(strum), 1, 2, 2, hand); }
        break;
      case 'tambourine': {
        const j = play ? Math.round(Math.sin(t * 38 + ph) * 1 + 0.2) : 0, jy = play ? Math.round(Math.cos(t * 31 + ph)) : 0;
        r(3 + j, -2 + jy, 8, 8, C(120, 74, 38)); r(4 + j, -1 + jy, 6, 6, C(238, 218, 176)); r(5 + j, 0 + jy, 4, 4, C(220, 196, 150));
        for (const [dx, dy] of [[3, 2], [10, 2], [6, -2], [6, 5]]) r(dx + j, dy + jy, 1, 1, ((Math.floor(t * 10 + dx) & 1) && play) ? C(255, 250, 200) : gold);
        r(1 + j, 3 + jy, 2, 2, hand);
        break;
      }
      case 'tabor': {
        const hit = play && beat < 0.16;
        r(1, -1, 7, 2, hit ? C(255, 246, 214) : C(236, 224, 188)); r(1, 0, 7, 1, C(196, 180, 140));
        r(1, 1, 7, 12, C(150, 70, 40)); r(1, 1, 1, 12, C(190, 100, 56)); r(7, 1, 1, 12, C(100, 44, 28));
        for (let i = 0; i < 5; i++) { r(2 + (i % 2), 2 + i * 2, 4, 1, C(232, 206, 150)); }
        r(1, 12, 7, 1, C(70, 40, 30));
        if (!rack) {
          const sx = hit ? 7 : 9, sy = hit ? -3 : -8;
          for (let i = 0; i < 4; i++) r(sx - i * (hit ? 1 : 0.4) | 0, sy + i * (hit ? 0.5 : 1.4) | 0, 1, 1, C(190, 140, 80));
          r(sx + 1, sy - 1, 2, 2, hand);
        } else { r(10, -4, 1, 6, C(190, 140, 80)); }
        break;
      }
      case 'bells': {
        const swing = play ? Math.sin(t * 5 + ph) : 0;
        const bell = (dx, dy, s) => {
          r(dx + Math.round(s), dy - 3, 1, 3, C(120, 80, 46)); r(dx - 1 + Math.round(s * 0.5), dy, 5, 1, gold); r(dx - 2 + Math.round(s * 0.5), dy + 1, 7, 3, C(240, 196, 70)); r(dx - 2 + Math.round(s * 0.5), dy + 4, 7, 1, C(176, 132, 40));
          r(dx - 1 + Math.round(s * 0.5), dy + 1, 2, 2, C(255, 240, 150));
        };
        bell(2, -3, swing * 2); bell(9, 1, -swing * 2);
        if (!rack && play && Math.sin(t * 5 + ph) > 0.92) { r(2, -8, 1, 1, C(255, 255, 255)); r(1, -7, 3, 1, C(255, 255, 255)); r(9, -4, 1, 1, C(255, 255, 255)); }
        break;
      }
      case 'pipes': {
        const sway = play ? Math.round(Math.sin(t * 2.4 + ph)) : 0;
        for (let i = 0; i < 6; i++) { const hh = 8 - i; r(i * 2 + sway, -7 + (8 - hh), 2, hh, i % 2 ? C(214, 170, 96) : C(196, 152, 84)); r(i * 2 + sway, -7 + (8 - hh), 2, 1, hole); }
        r(0 + sway, -3, 12, 1, C(150, 44, 44)); r(0 + sway, 0, 12, 1, C(150, 44, 44));
        if (!rack) r(-1 + sway, 2, 2, 2, hand);
        break;
      }
      case 'guitar':
        r(0, 3, 8, 7, woodD); r(1, 4, 6, 5, C(224, 178, 100)); r(0, 0, 6, 5, woodD); r(1, 1, 4, 3, C(224, 178, 100)); r(3, 4, 2, 2, hole); r(2, 8, 4, 1, C(120, 74, 38));
        for (let i = 0; i < 6; i++) r(7 + i, 3 - (i >> 1) - i + i, 2, 2, C(66, 42, 26));
        r(12, -4, 4, 3, C(66, 42, 26)); r(13, -5, 1, 1, gold); r(15, -4, 1, 1, gold);
        if (!rack) { r(3 + Math.round(strum * 1.5), 4 + Math.round(strum), 2, 2, hand); }
        break;
    }
  };
}
