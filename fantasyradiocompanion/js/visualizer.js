// The scene's canvas: the frame loop, the HUD (calendar, gold, satchel, buttons), the tavern cards, dialogue and level-up screens, the
// summoning effect and mouse/touch input. A port of src\VisualizerControl.cs; the popups (tuner, compendium) are page elements (ui.js).

import { DESIGN_HEIGHT } from './scene.js';
import { Sprites, PARTY_NAMES } from './sprites.js';
import { roundRect, SummonEffect } from './summon.js';
import { traitSummary } from './traits.js';
import { css } from './util.js';
import { Sound } from './sfx.js';
import { ITEM_DEFS, HOT_SLOT_COUNT } from './items.js';
import { t, isCjk } from './i18n.js';
import { QUALITY, QUALITY_MODES, QUALITY_LEVELS, AutoQuality, guessLevel, isLevel } from './quality.js';

export const ZOOMED_SCALE = 5;
export const PARTY_ZOOM_OUT = 0.8;   // the party is drawn at about 80% of the size it would otherwise be, in every view (20% zoomed out)
/** A scale taken down by PARTY_ZOOM_OUT and snapped to the nearest whole number (at least 1): a fractional scale makes single scene
 *  pixels land 2 or 3 screen pixels wide, so sprites shimmer as they move. */
const zoomedOut = scale => Math.max(1, Math.round(scale * PARTY_ZOOM_OUT));

// On a phone or tablet the adventure only progresses while the page is on screen: backgrounded or with the screen locked, the radio
// plays on but the game waits (desktop browsers keep their own rules: a visible window keeps going).
export const IS_MOBILE = (() => {
  try {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)   // iPadOS reports itself as a Mac
      || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(hover: hover)').matches);
  } catch (e) { return false; }
})();
export const BLURB = {
  thief: 'Quick, quiet and always one step ahead.',
  warrior: 'A stalwart front-liner who never backs down.',
  lightmage: 'Keeps the whole party hale and humming.',
  firemage: 'A short fuse and a flair for the dramatic.',
  fae: 'A glimmering lucky charm who never tires.',
  druid: 'Tends the wild, and the wild answers.',
  paca: 'Fast, loyal and always out front.',
};
const FONT = '"Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
const PT = 96 / 72;   // points to CSS pixels

function rgba(r, g, b, a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + (a === undefined ? 1 : a) + ')'; }

export class Visualizer {
  /**
   * @param canvas   the <canvas> to draw on
   * @param scene    a PixelScene
   * @param host     callbacks: openTuner(), openCompendium(), toggleFullscreen(), restartRequested(), spectrum() -> {live,bass,mid,treble,loud}, level() -> number
   */
  constructor(canvas, scene, host) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = scene;
    this.host = host;
    this.summon = new SummonEffect();
    this.zoomed = false;       // the enlarged views (Adventure tab, full screen)
    this.fullscreen = false;
    this.buffering = false;
    this.bufferingName = '';
    this.summonAlpha = 0;
    this.popupOpen = false;    // a popup (tuner, compendium) is up over the scene
    this.width = 0; this.height = 0; this.dpr = 1;
    this.hover = { button: false, restart: false, tuner: false, comp: false, card: -1, tile: -1, levelUp: false };
    this.running = false;
    this.last = 0;
    this._frame = this._frame.bind(this);
    this._hotDown = false; this._discOpen = false; this._discByPress = false; this._hotDownAt = 0;   // the hot item button and its disc
    this._discHover = -1; this._overHot = false; this._shopHover = null; this._shopInfoId = null;
    this._settingsOpen = false;   // the cog's menu
    // Quality (Auto, Low, Medium, High): see quality.js. Auto starts from a guess about the device and then watches the frames.
    this._qMode = 'auto'; this._q = QUALITY.high; this._lastDraw = 0; this._sliderDrag = false;
    this._auto = new AutoQuality(guessLevel(IS_MOBILE), () => { this._applyQuality(); this._saveQuality(); });
    this._applyQuality();
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); this._auto.pause(); });

    canvas.addEventListener('pointermove', e => this._onMove(e));
    canvas.addEventListener('pointerleave', () => { this.hover = { button: false, restart: false, tuner: false, comp: false, card: -1, tile: -1, levelUp: false }; canvas.style.cursor = 'default'; });
    canvas.addEventListener('pointerdown', e => this._onDown(e));
    canvas.addEventListener('pointerup', e => this._onUp(e));
    canvas.addEventListener('pointercancel', () => { this._hotDown = false; this._sliderDrag = false; });
    window.addEventListener('resize', () => this.resize());
  }

  // ---- Lifecycle -----------------------------------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.resize();
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this._q.dprMax);   // (Low and Medium draw fewer canvas pixels on a sharp screen)
    const w = Math.max(1, Math.round(this.canvas.clientWidth)), h = Math.max(1, Math.round(this.canvas.clientHeight));
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  get hud() { return this.fullscreen ? Math.max(1, Math.min(3, this.height / 640)) : 1; }
  get sceneScale() {
    if (this.zoomed) {
      const want = this.fullscreen ? Math.max(ZOOMED_SCALE, Math.floor(this.height / 150)) : ZOOMED_SCALE;
      // On a narrow screen (a phone held upright) keep at least ~150 world pixels across so the whole party fits.
      return zoomedOut(Math.max(2, Math.min(want, Math.floor(this.width / 150))));
    }
    return zoomedOut(Math.floor(this.height / DESIGN_HEIGHT));
  }
  get vw() { return this.width / this.hud; }
  get vh() { return this.height / this.hud; }

  _frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this._frame);
    const cap = this._q.fps;
    if (cap && now - this._lastDraw < 1000 / cap - 2) return;   // Low and Medium draw less often (the time carries over: dt runs from the last frame drawn)
    const frameStart = performance.now(), interval = now - this._lastDraw;
    this._lastDraw = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (IS_MOBILE && document.visibilityState !== 'visible') {
      this.scene._updateCrystalHum(false);   // silent too: the hum belongs to the game, not the radio
      return;
    }
    dt = Math.min(dt, 0.25);   // a long stall (a hidden tab) is taken in one capped step, not replayed
    this.resize();
    const spec = this.host.spectrum ? this.host.spectrum() : { live: false, bass: 0, mid: 0, treble: 0, loud: 0 };
    this.summonAlpha = this.buffering ? Math.min(1, this.summonAlpha + dt / 0.35) : Math.max(0, this.summonAlpha - dt / 0.45);
    this.scene.suspended = this.popupOpen;
    this.scene.setSpectrum(spec.live, spec.bass, spec.mid, spec.treble, spec.loud);
    const level = this.scene.marching && this.host.level ? this.host.level() : -1;
    this.scene.advance(dt, level);
    if (this.scene.isTipActive) { this._discOpen = false; this._hotDown = false; }   // no switching potions under a tip
    if (this._hotDown && !this._discOpen && performance.now() - this._hotDownAt >= 450) {   // held: the disc of four
      this._discOpen = true; this._discByPress = true;
      Sound.play('DiscClick');
    }
    this._draw(now / 1000);
    if (this._qMode === 'auto') {
      if (this.popupOpen) this._auto.pause(); else this._auto.note(now, interval, performance.now() - frameStart, cap ? 1000 / cap : 16.7);
    }
  }

  // ---- Quality -------------------------------------------------------------------------------------------

  /** Picks Auto, Low, Medium or High (and, when restoring a saved choice, the level Auto had settled on). */
  setQuality(mode, autoLevel) {
    this._qMode = QUALITY_MODES.indexOf(mode) >= 0 ? mode : 'auto';
    if (isLevel(autoLevel)) this._auto.level = autoLevel;
    this._auto.pause(); this._auto.good = 0; this._auto.cool = 1;
    this._applyQuality();
    this._saveQuality();
  }

  /** The Auto checkbox: on starts a fresh detection from the device's own hints; off keeps the level Auto had reached, now fixed. */
  setAuto(on) {
    if (on) { this._auto.level = guessLevel(IS_MOBILE); this._auto.failed = {}; this.setQuality('auto'); }
    else this.setQuality(this.qualityLevel);
  }

  /** The level in force: the chosen one, or what Auto has settled on. */
  get qualityLevel() { return this._qMode === 'auto' ? this._auto.level : this._qMode; }

  _applyQuality() {
    this._q = QUALITY[this.qualityLevel];
    this.scene.fxDensity = this._q.fx;
    this.scene.glowHalos = this._q.halos;
    this.resize();   // size the canvas again now, for the new density
  }

  _saveQuality() { if (this.host.qualityChanged) this.host.qualityChanged(this._qMode, this._auto.level); }

  // ---- Drawing -------------------------------------------------------------------------------------------

  _draw(timeSeconds) {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    const scale = this.sceneScale;
    const sc = this.scene.render(w, h, scale);
    ctx.drawImage(sc, 0, h - sc.height * scale, sc.width * scale, sc.height * scale);
    const front = this.scene.frontCanvas;
    if (front) {   // the start sign is in view: its words go on the board, and the party and the rest of the scene over them
      this._drawOneSceneText(ctx, this.scene.signTextItem());
      ctx.drawImage(front, 0, h - front.height * scale, front.width * scale, front.height * scale);
    }

    this.summon.render(ctx, w, h, timeSeconds, this.summonAlpha, this.zoomed ? scale : 3, this.bufferingName, this.hud);
    this._drawSceneText(ctx);
    this._drawEncounter(ctx);
    this._drawStoryUi(ctx);
    this._drawCampHint(ctx);

    ctx.strokeStyle = 'rgb(192,192,192)'; ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // The corner controls, enlarged in full screen.
    const hud = this.hud;
    ctx.save();
    if (hud !== 1) ctx.scale(hud, hud);
    this._drawExpandButton(ctx);
    this._drawSettingsButton(ctx);
    this._drawDayCounter(ctx);
    this._drawGoldCounter(ctx);
    this._drawStorageChip(ctx);
    this._drawBerserkChip(ctx);
    this._drawNowPlaying(ctx);
    this._drawTunerButton(ctx);
    this._drawCompendiumButton(ctx);
    this._drawHotButton(ctx);
    this._drawMultiplierPicker(ctx);
    this._drawDisc(ctx);
    this._drawSettingsMenu(ctx);
    this._drawInnMenu(ctx);
    this._drawGameOver(ctx);
    ctx.restore();
    this._drawShop(ctx);
    this._drawTip(ctx);
  }

  _text(ctx, str, x, y, o) {
    ctx.font = (o.weight || 600) + ' ' + o.px + 'px ' + FONT;
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  _measure(ctx, str, px, weight) {
    ctx.font = (weight || 600) + ' ' + px + 'px ' + FONT;
    return ctx.measureText(str).width;
  }

  _pill(ctx, x, y, w, h, r, bg, rim, rimWidth) {
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
    ctx.fillStyle = bg; ctx.fill();
    if (rim) { ctx.strokeStyle = rim; ctx.lineWidth = rimWidth || 1.2; ctx.stroke(); }
  }

  // ---- HUD geometry (in HUD units: pixels at hud scale 1) -------------------------------------------------------

  // The HUD pills flow along the top-left and wrap to the next row when they would run into the buttons.
  _dayWidth(ctx) {
    const px = 9.5 * PT;
    const leftW = this._measure(ctx, t('Year {y}  Day {d}', { y: this.scene.year, d: this.scene.dayOfYear }) + '   ', px);
    let seasonW = 0;
    for (const n of ['Spring', 'Summer', 'Fall', 'Winter']) seasonW = Math.max(seasonW, this._measure(ctx, t(n), px));
    return { w: Math.round(leftW + seasonW + 24), leftW: leftW, seasonW: seasonW };
  }

  /** Where each pill goes: left to right along the top, wrapping below when the next would reach the buttons (later rows: the edge). */
  _hudLayout(ctx) {
    const limit = (this.zoomed ? this._compRect.x : this._buttonRect.x) - 8;
    let x = 8, y = 8;
    const rowLimit = () => (y === 8 ? limit : this.vw - 8);
    const place = w => {
      if (x > 8 && x + w > rowLimit()) { x = 8; y += 26 + 8; }
      const r = { x: x, y: y, w: w, h: 26 };
      x += w + 8;
      return r;
    };
    const day = this._dayWidth(ctx);
    const L = { day: Object.assign(place(day.w), { leftW: day.leftW, seasonW: day.seasonW }), gold: null, storage: null, berserk: null, np: null };
    const goldW = Math.max(62, Math.round(36 + this._measure(ctx, this.scene.gold.toLocaleString('en-US'), 10.5 * PT) + 10));
    L.gold = place(goldW);
    if (this.scene.itemStorage > 0) L.storage = place(Math.round(8 + 16 + 6 + this._measure(ctx, '+' + this.scene.itemStorage, 9.5 * PT) + 10));
    if (this.scene.berserkLeft > 0) L.berserk = place(Math.round(this._measure(ctx, this._berserkText(), 9.5 * PT) + 22));
    const n = this._np();
    if (n) {
      const px = 9.5 * PT;
      ctx.font = this._npFont(px, true, false); const sw = n.station ? Math.ceil(ctx.measureText(n.station).width) : 0;
      ctx.font = this._npFont(px, false, true); const tw = n.title ? Math.ceil(ctx.measureText(n.title).width) : 0;
      const natural = 30 + sw + (n.station && n.title ? 18 : 0) + tw + 12;
      let avail = rowLimit() - x;
      if (x > 8 && avail < Math.min(natural, 200)) { x = 8; y += 26 + 8; avail = rowLimit() - x; }
      L.np = { x: x, y: y, w: Math.min(natural, Math.max(200, avail)), h: 26, second: y > 8, n: n, sw: sw, px: px };
    }
    return L;
  }

  _berserkText() {
    const s = Math.ceil(this.scene.berserkLeft);
    return t('Monsters x{n}', { n: this.scene.monsterDamageMultiplier }) + '  ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /** A pill with the Monster Berserker's multiplier and the time it has left. */
  _drawBerserkChip(ctx) {
    const r = this._hudLayout(ctx).berserk;
    if (!r) return;
    this._pill(ctx, r.x, r.y, r.w, r.h, r.h / 2, 'rgba(72,26,16,0.88)', 'rgba(255,150,60,0.92)', 1.4);
    this._text(ctx, this._berserkText(), r.x + r.w / 2, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: 'rgb(255,226,190)', align: 'center' });
  }

  // ---- The Monster Berserker's 1X to 5X ----------------------------------------------------------------------

  /** Five round buttons in a row, in the room to the right of the cancel button and below the HUD. */
  _multiplierRects() {
    const r = this._hotRect, L = this._hudLayout(this.ctx);
    let bottom = 0;
    for (const p of [L.day, L.gold, L.storage, L.berserk, L.np]) if (p) bottom = Math.max(bottom, p.y + p.h);
    const gap = 8, left = r.x + r.w + 12, avail = Math.max(120, this.vw - left - 12);
    const d = Math.max(28, Math.min(52, Math.min(Math.trunc((avail - 4 * gap) / 5), Math.trunc(this.vh / 2) - 8)));
    const total = 5 * d + 4 * gap, x0 = left + Math.max(0, Math.trunc((avail - total) / 2));
    const cy = Math.min(Math.max(bottom + 8 + Math.trunc(d / 2), Math.trunc(this.vh / 2)), this.vh - Math.trunc(d / 2) - 6);
    const rects = [];
    for (let i = 0; i < 5; i++) rects.push({ x: x0 + i * (d + gap), y: cy - Math.trunc(d / 2), w: d, h: d });
    return rects;
  }

  _multiplierAt(h) {
    const rects = this._multiplierRects();
    for (let i = 0; i < rects.length; i++) {
      const dx = h.x - (rects[i].x + rects[i].w / 2), dy = h.y - (rects[i].y + rects[i].h / 2), rr = rects[i].w / 2 + 3;
      if (dx * dx + dy * dy <= rr * rr) return i;
    }
    return -1;
  }

  _drawMultiplierPicker(ctx) {
    if (!this.scene.isPicking) return;
    const rects = this._multiplierRects();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 4.5), current = this.scene.monsterDamageMultiplier;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i], hot = i === this._mulHover, cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2;
      for (let k = 3; k >= 1; k--) {   // the glow
        ctx.beginPath(); ctx.arc(cx, cy, rad + k * 3 + pulse * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,150,50,' + ((hot ? 0.18 : 0.12) * (1.1 - k * 0.22)).toFixed(3) + ')'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, rad - 0.5, 0, Math.PI * 2);
      ctx.fillStyle = hot ? 'rgba(104,50,18,0.94)' : 'rgba(54,26,14,0.92)'; ctx.fill();
      ctx.strokeStyle = hot ? 'rgb(255,238,170)' : 'rgba(255,176,70,0.92)'; ctx.lineWidth = (i + 1 === current && current > 1) ? 3 : 2; ctx.stroke();
      this._text(ctx, (i + 1) + 'X', cx, cy + 0.5, { px: Math.max(8, r.w * 0.28) * 0.75 * (96 / 72), color: 'white', align: 'center', weight: 700 });
    }
  }

  _dayPillRect(ctx) { return this._hudLayout(ctx).day; }
  _goldRect(ctx) { return this._hudLayout(ctx).gold; }
  _storageRect(ctx) { return this._hudLayout(ctx).storage; }

  /** The left edge of the free space along the top: clear of every pill that sits on the first row. */
  _hudRightPx(ctx) {
    const L = this._hudLayout(ctx);
    let right = L.day.x + L.day.w;
    for (const r of [L.gold, L.storage, L.berserk, L.np]) if (r && r.y === 8) right = Math.max(right, r.x + r.w);
    return Math.trunc((right + 10) * this.hud);
  }
  // ---- The now-playing pill (full screen only: the page already shows these in its own controls) ---------------

  _np() {
    if (!this.fullscreen || !this.host.nowPlaying) return null;
    const n = this.host.nowPlaying();
    if (!n || (!n.station && !n.title)) return null;
    return n;
  }

  _npFont(px, bold, italic) { return (italic ? 'italic ' : '') + (bold ? '700' : '400') + ' ' + px + 'px ' + FONT; }

  _npRect(ctx) { return this._hudLayout(ctx).np; }
  _drawNowPlaying(ctx) {
    const r = this._npRect(ctx);
    if (!r) return;
    this._pill(ctx, r.x, r.y, r.w, r.h, 6, rgba(12, 16, 44, 0.59), 'rgba(130,200,255,0.82)', 1.4);
    // A little equaliser: three bars that bounce while it plays.
    const t = performance.now() / 1000;
    ctx.fillStyle = 'rgb(120,200,255)';
    for (let i = 0; i < 3; i++) {
      const h = 5 + Math.round(5 * (0.5 + 0.5 * Math.sin(t * (5 + i * 1.7) + i * 2)));
      ctx.fillRect(r.x + 9 + i * 5, r.y + (r.h + 12) / 2 - h, 3, h);
    }
    const n = r.n, right = r.x + r.w - 12, cy = r.y + r.h / 2 + 0.5;
    let x = r.x + 30;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (n.station) {   // the name is gold and bold...
      const maxW = Math.max(40, right - x);
      ctx.font = this._npFont(r.px, true, false); ctx.fillStyle = 'rgb(255,214,120)';
      ctx.fillText(this._fit(ctx, n.station, maxW), x, cy);
      x += Math.min(r.sw + 2, maxW);
      if (n.title) { ctx.fillStyle = 'rgba(190,210,255,0.6)'; ctx.fillRect(x + 8, r.y + r.h / 2 - 1, 3, 3); x += 18; }
    }
    if (n.title && x < right) {   // ...and the song is white and italic
      ctx.font = this._npFont(r.px, false, true); ctx.fillStyle = 'white';
      ctx.fillText(this._fit(ctx, n.title, right - x), x, cy);
    }
  }

  /** The text cut with an ellipsis to fit; the context's font must already be set. */
  _fit(ctx, str, maxW) {
    if (ctx.measureText(str).width <= maxW) return str;
    let s = str;
    while (s.length > 1 && ctx.measureText(s + '\u2026').width > maxW) s = s.slice(0, -1);
    return s + '\u2026';
  }
  _topPillX(ctx, w) {
    const left = this._hudRightPx(ctx), right = this.width - (this.zoomed ? 112 : 78) * this.hud;
    let x = Math.trunc((this.width - w) / 2);
    if (x + w > right) x = right - w;
    if (x < left) x = left;
    return x;
  }
  get _settingsRect() { return { x: this.vw - 34, y: 8, w: 26, h: 26 }; }          // the cog, top-right corner
  get _buttonRect() { return { x: this.vw - 68, y: 8, w: 26, h: 26 }; }
  get _compRect() { return { x: this.vw - 102, y: 8, w: 26, h: 26 }; }
  get _tunerRect() { return { x: 8, y: this.vh - 8 - 52, w: 52, h: 52 }; }          // bottom-left
  // The menu: a heading row (Quality, and the level now chosen, the only level label shown), a slider with the Auto checkbox beside it,
  // and the Restart item. Nothing is a fixed width: the menu is as wide as its words are in the current language (so a longer word, as in
  // German, just widens it), within the page.
  _qLabel(level) { return t(level.charAt(0).toUpperCase() + level.slice(1)); }

  _settingsLayout() {
    const ctx = this.ctx, px = 8.5 * PT, c = this._settingsRect, pad = 10, box = 14, gap = 12, minSlider = 90;
    const widest = Math.max(...QUALITY_LEVELS.map(l => this._measure(ctx, this._qLabel(l), px)));
    const headW = this._measure(ctx, t('Quality'), px);
    const autoW = box + 6 + this._measure(ctx, t('Auto'), px);
    const restartW = this._measure(ctx, t('Restart'), 9.5 * PT) + 24;
    let w = Math.ceil(Math.max(headW + gap + widest, minSlider + gap + autoW, restartW) + pad * 2);
    w = Math.max(150, Math.min(w, Math.trunc(this.vw - 16)));
    const x = c.x + c.w - w, y = c.y + c.h + 6, rowY = y + 4 + 20;
    const autoRect = { x: x + w - pad - autoW, y: rowY, w: autoW, h: 28 };
    const sliderLeft = x + pad + 7, sliderRight = autoRect.x - gap - 7;
    return {
      menu: { x: x, y: y, w: w, h: 4 + 20 + 28 + 6 + 30 + 4 },
      head: { x: x + pad, y: y + 4, w: w - pad * 2, h: 20 },
      auto: autoRect, box: box,
      slider: { x: sliderLeft, y: rowY + 14, w: Math.max(20, sliderRight - sliderLeft) },   // the track's centre line; the thumb has a radius of 7
      sliderHit: { x: x + pad, y: rowY, w: Math.max(20, autoRect.x - gap - (x + pad)), h: 28 },
      restart: { x: x + 4, y: rowY + 28 + 6, w: w - 8, h: 30 },
    };
  }
  get _settingsMenuRect() { return this._settingsLayout().menu; }
  get _restartItemRect() { return this._settingsLayout().restart; }

  /** A press or drag on the slider: the thumb goes to the nearest of its three steps (which switches Auto off). */
  _dragSlider(h) {
    const L = this._settingsLayout();
    const idx = Math.max(0, Math.min(QUALITY_LEVELS.length - 1, Math.round((h.x - L.slider.x) / L.slider.w * (QUALITY_LEVELS.length - 1))));
    const level = QUALITY_LEVELS[idx];
    if (this._qMode !== level) { this.setQuality(level); Sound.play('DiscClick'); }
  }

  _drawExpandButton(ctx) {
    const r = this._buttonRect, hot = this.hover.button;
    this._pill(ctx, r.x, r.y, r.w, r.h, 5, rgba(12, 16, 44, hot ? 0.75 : 0.47), rgba(210, 224, 255, hot ? 1 : 0.67));
    const cx = r.x + r.w / 2 - 0.5, cy = r.y + r.h / 2 - 0.5;
    const outer = 7, arm = 4;
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'square';
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const a = this.fullscreen ? 2.5 : outer;
      const px = cx + sx * a, py = cy + sy * a;
      ctx.beginPath();
      if (this.fullscreen) { ctx.moveTo(px, py); ctx.lineTo(px + sx * arm, py); ctx.moveTo(px, py); ctx.lineTo(px, py + sy * arm); }
      else { ctx.moveTo(px, py); ctx.lineTo(px - sx * arm, py); ctx.moveTo(px, py); ctx.lineTo(px, py - sy * arm); }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  /** A plain cog: a ring of eight teeth round a hole. */
  _drawSettingsButton(ctx) {
    const r = this._settingsRect, hot = this.hover.settings || this._settingsOpen;
    this._pill(ctx, r.x, r.y, r.w, r.h, 5, rgba(12, 16, 44, hot ? 0.75 : 0.47), rgba(210, 224, 255, hot ? 1 : 0.67));
    const cx = r.x + r.w / 2 - 0.5, cy = r.y + r.h / 2 - 0.5;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      for (const [da, rad] of [[-0.30, 6.0], [-0.17, 9.0], [0.17, 9.0], [0.30, 6.0]]) {
        const x = cx + Math.cos(a + da) * rad, y = cy + Math.sin(a + da) * rad;
        if (i === 0 && da === -0.30) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = 'white'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = hot ? 'rgb(56,60,100)' : 'rgb(40,46,84)'; ctx.fill();
  }

  _drawSettingsMenu(ctx) {
    if (!this._settingsOpen) return;
    const m = this._settingsMenuRect, item = this._restartItemRect;
    this._pill(ctx, m.x, m.y, m.w, m.h, 7, 'rgba(22,18,52,0.92)', 'rgba(255,214,120,0.9)', 1.4);
    const L = this._settingsLayout(), auto = this._qMode === 'auto', level = this.qualityLevel, px = 8.5 * PT;
    this._text(ctx, t('Quality'), L.head.x, L.head.y + L.head.h / 2 + 0.5, { px: px, color: 'rgb(255,214,120)' });
    this._text(ctx, this._qLabel(level), L.head.x + L.head.w, L.head.y + L.head.h / 2 + 0.5, { px: px, color: 'white', align: 'right' });   // the one level label: the current one
    // The slider: a track, a step mark for each level, the part up to the thumb filled, and the thumb itself.
    const sx = L.slider.x, sy = L.slider.y, sw = L.slider.w, idx = QUALITY_LEVELS.indexOf(level), tx = sx + sw * idx / (QUALITY_LEVELS.length - 1);
    const lit = this.hover.qslider || this._sliderDrag;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(150,160,220,0.45)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw, sy); ctx.stroke();
    ctx.strokeStyle = 'rgb(255,204,82)';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, sy); ctx.stroke();
    ctx.fillStyle = 'rgba(22,18,52,0.9)';
    for (let i = 0; i < QUALITY_LEVELS.length; i++) { ctx.beginPath(); ctx.arc(sx + sw * i / (QUALITY_LEVELS.length - 1), sy, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(tx, sy, lit ? 8 : 7, 0, Math.PI * 2);
    ctx.fillStyle = lit ? 'rgb(255,226,130)' : 'rgb(255,204,82)'; ctx.fill();
    ctx.strokeStyle = 'rgb(255,244,190)'; ctx.lineWidth = 1.5; ctx.stroke();
    // The Auto checkbox, label to its right.
    const bx = L.auto.x, by = L.auto.y + (L.auto.h - L.box) / 2;
    this._pill(ctx, bx, by, L.box, L.box, 3, auto ? 'rgb(255,204,82)' : (this.hover.qauto ? 'rgba(90,70,150,0.6)' : 'rgba(60,52,110,0.55)'), auto ? 'rgb(255,244,190)' : 'rgba(170,186,240,0.7)', 1.2);
    if (auto) {
      ctx.strokeStyle = 'rgb(70,36,8)'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx + 3.5, by + 7.5); ctx.lineTo(bx + 6, by + 10); ctx.lineTo(bx + 10.5, by + 4.5); ctx.stroke();
    }
    this._text(ctx, t('Auto'), bx + L.box + 6, L.auto.y + L.auto.h / 2 + 0.5, { px: px, color: 'white' });
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
    if (this.hover.restart) this._pill(ctx, item.x, item.y, item.w, item.h, 5, 'rgba(90,70,150,0.47)');
    this._text(ctx, t('Restart'), item.x + item.w / 2, item.y + item.h / 2 + 0.5, { px: 9.5 * PT, color: 'white', align: 'center' });
  }

  _drawDayCounter(ctx) {
    const s = this.scene;
    const season = s.seasonName;
    const seasonColor = season === 'Spring' ? 'rgb(166,230,150)' : season === 'Summer' ? 'rgb(255,220,110)' : season === 'Fall' ? 'rgb(246,156,76)' : 'rgb(176,218,255)';
    const r = this._dayPillRect(ctx);
    this._pill(ctx, r.x, r.y, r.w, r.h, 6, rgba(12, 16, 44, 0.59), rgba(210, 224, 255, 0.78));
    const left = t('Year {y}  Day {d}', { y: s.year, d: s.dayOfYear }) + '   ';
    this._text(ctx, left, r.x + 12, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: 'white' });
    this._text(ctx, t(season), r.x + 12 + r.leftW, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: seasonColor });
  }

  _drawGoldCounter(ctx) {
    const s = this.scene;
    const pulse = s.goldPulse;
    const gr = this._goldRect(ctx);
    const h = 26 + Math.trunc(3 * pulse);
    this._pill(ctx, gr.x, gr.y, gr.w, h, 6, rgba(12, 16, 44, 0.59));
    if (pulse > 0) this._pill(ctx, gr.x, gr.y, gr.w, h, 6, rgba(255, 226, 110, 0.47 * pulse));
    roundRect(ctx, gr.x + 0.5, gr.y + 0.5, gr.w - 1, h - 1, 6);
    ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.4; ctx.stroke();
    const coin = Sprites.coin;
    const cs = 2, cw = coin.width * cs, ch = coin.height * cs;
    ctx.drawImage(coin, gr.x + 8, gr.y + (h - ch) / 2, cw, ch);
    this._text(ctx, s.gold.toLocaleString('en-US'), gr.x + 12 + cw, gr.y + h / 2 + 0.5, { px: 10.5 * PT, color: 'white' });
  }

  _drawStorageChip(ctx) {
    if (this.scene.itemStorage <= 0) return;
    const r = this._storageRect(ctx);
    this._pill(ctx, r.x, r.y, r.w, r.h, 6, rgba(12, 16, 44, 0.59), 'rgba(214,168,96,0.86)', 1.4);
    const bx = r.x + 8, by = r.y + 7;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = 'rgb(120,74,34)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx + 3, by + 1); ctx.lineTo(bx + 3, by - 1); ctx.lineTo(bx + 12, by - 1); ctx.stroke();
    ctx.fillStyle = 'rgb(176,118,58)'; ctx.fillRect(bx, by + 1, 16, 11);
    ctx.fillStyle = 'rgb(128,80,36)'; ctx.fillRect(bx, by + 1, 16, 5);
    ctx.fillStyle = 'rgb(255,218,100)'; ctx.fillRect(bx + 6, by + 4, 4, 4);
    ctx.strokeStyle = 'rgb(70,38,14)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 1.5, 15, 10);
    ctx.restore();
    this._text(ctx, '+' + this.scene.itemStorage, r.x + 8 + 16 + 6, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: 'white' });
  }

  _drawTunerButton(ctx) {
    if (!this.zoomed) return;
    const r = this._tunerRect, hot = this.hover.tuner;
    const cx = r.x + r.w / 2 - 0.5, cy = r.y + r.h / 2 - 0.5;
    ctx.beginPath(); ctx.arc(cx + 0.5, cy + 0.5, (r.w - 1) / 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(12, 16, 44, hot ? 0.75 : 0.47); ctx.fill();
    ctx.strokeStyle = rgba(210, 224, 255, hot ? 1 : 0.67); ctx.lineWidth = 1; ctx.stroke();
    const s = r.w / 52;
    // The frequency scale with a gold needle sliding across it, and a knob underneath.
    const baseY = cy + 4 * s, left = cx - 14 * s;
    ctx.strokeStyle = 'white'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, 2 * s);
    ctx.beginPath(); ctx.moveTo(left, baseY); ctx.lineTo(cx + 14 * s, baseY); ctx.stroke();
    ctx.lineWidth = Math.max(1, 1.5 * s);
    for (let i = 0; i < 8; i++) {
      const x = left + i * 4 * s;
      ctx.beginPath(); ctx.moveTo(x, baseY - 2 * s); ctx.lineTo(x, baseY - (i % 2 === 0 ? 8.5 : 5.5) * s); ctx.stroke();
    }
    ctx.strokeStyle = 'rgb(255,214,120)'; ctx.lineWidth = Math.max(1.5, 2.2 * s);
    ctx.beginPath(); ctx.moveTo(cx + 5 * s, cy - 12 * s); ctx.lineTo(cx + 5 * s, baseY + 5 * s); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = Math.max(1.2, 1.7 * s);
    ctx.beginPath(); ctx.arc(cx, cy + 15.5 * s, 4.5 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 12.5 * s); ctx.lineTo(cx, cy + 15 * s); ctx.stroke();
    ctx.lineCap = 'butt';
    if (hot) this._tip(ctx, t('Tuner: music & radio stations'), r.x + r.w + 10, r.y + r.h / 2, true);
  }

  _drawCompendiumButton(ctx) {
    if (!this.zoomed) return;
    const r = this._compRect, hot = this.hover.comp;
    this._pill(ctx, r.x, r.y, r.w, r.h, 5, rgba(12, 16, 44, hot ? 0.75 : 0.47), rgba(210, 224, 255, hot ? 1 : 0.67));
    const bx = r.x + 5, by = r.y + 7;
    ctx.fillStyle = 'rgb(240,232,200)'; ctx.fillRect(bx, by, 7, 11);
    ctx.fillStyle = 'rgb(214,206,176)'; ctx.fillRect(bx + 8, by, 7, 11);
    ctx.fillStyle = 'rgb(150,60,80)'; ctx.fillRect(bx + 7, by - 1, 1, 13);
    ctx.fillStyle = 'rgb(120,90,80)';
    for (let i = 0; i < 3; i++) { ctx.fillRect(bx + 1, by + 2 + i * 3, 5, 1); ctx.fillRect(bx + 9, by + 2 + i * 3, 5, 1); }
    ctx.fillStyle = 'rgb(255,214,120)'; ctx.fillRect(bx + 11, by + 8, 2, 5);
    if (hot) this._tip(ctx, t('Compendium'), r.x - 8, r.y + r.h / 2);
  }

  /** A little label beside a button: ending at anchorX, or (alignLeft) starting at it. */
  _tip(ctx, text, anchorX, midY, alignLeft) {
    const px = 8.5 * PT;
    const w = Math.round(this._measure(ctx, text, px)) + 20;
    const x = alignLeft ? anchorX : anchorX - w;
    this._pill(ctx, x, midY - 12, w, 24, 6, 'rgba(22,18,52,0.84)', 'rgba(255,214,120,0.9)');
    this._text(ctx, text, x + w / 2, midY + 0.5, { px: px, color: 'white', align: 'center' });
  }

  // ---- Scene text, camp hint ---------------------------------------------------------------------------------------

  _drawSceneText(ctx) {
    for (const t of this.scene.textOverlays()) this._drawOneSceneText(ctx, t);
  }

  _drawOneSceneText(ctx, t) {
    const px = Math.round(11 * PT * this.hud), pxSmall = Math.round(8.25 * PT * this.hud);
    {
      if (t.alpha <= 0.01) return;
      const a = Math.min(1, t.alpha);
      let fpx = t.small ? pxSmall : px;
      const lines = String(t.text).split('\n');
      const widest = () => { ctx.font = '700 ' + fpx + 'px ' + FONT; return Math.max.apply(null, lines.map(l => ctx.measureText(l).width)); };
      let tw = widest();
      if (t.maxWidth > 0) {   // smaller until it fits (the words on the start sign, in a narrow view)
        while (tw > t.maxWidth && fpx > 6) { fpx -= 0.5; tw = widest(); }
      }
      if (t.bubble) {
        const w = Math.round(tw) + 14 * this.hud, h = px + 6 * this.hud;
        const x = Math.max(4, Math.min(this.width - w - 4, t.x - w / 2)), y = Math.max(4, t.y - h - 7);
        ctx.save();
        ctx.globalAlpha = a;
        roundRect(ctx, x, y, w, h, 7); ctx.fillStyle = 'rgba(255,250,232,0.96)'; ctx.fill();
        ctx.strokeStyle = 'rgb(90,56,30)'; ctx.lineWidth = 1.6; ctx.stroke();
        const tx = Math.max(x + 8, Math.min(x + w - 8, t.x));
        ctx.beginPath(); ctx.moveTo(tx - 5, y + h - 1); ctx.lineTo(tx + 5, y + h - 1); ctx.lineTo(tx, y + h + 6); ctx.closePath();
        ctx.fillStyle = 'rgba(255,250,232,0.96)'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = css(t.color); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(t.text, x + 7 * this.hud, y + h / 2 + 1);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lh = fpx * 1.3, top = t.y - (lines.length - 1) * lh / 2;
        lines.forEach((line, i) => {
          ctx.fillStyle = 'rgba(10,24,16,0.75)'; ctx.fillText(line, t.x + 1, top + i * lh + 1);
          ctx.fillStyle = css(t.color); ctx.fillText(line, t.x, top + i * lh);
        });
        ctx.restore();
      }
    }
  }

  _drawCampHint(ctx) {
    const s = this.scene;
    if (!s.atCamp || this.width < 560 || s.isDialogue || s.isLevelSelect || s.isChoosing) return;
    const text = t('Resting at camp: play a radio stream to keep adventuring');
    const px = 9 * PT;
    const tw = Math.round(this._measure(ctx, text, px));
    const w = tw + 28, h = px + 12;
    const x = Math.round((this.width - w) / 2), y = Math.round((this.height - h) / 2);
    this._pill(ctx, x, y, w, h, h / 2, 'rgba(26,16,40,0.67)', 'rgba(255,170,90,0.82)', 1.3);
    this._text(ctx, text, x + w / 2, y + h / 2 + 0.5, { px: px, color: 'rgb(255,226,190)', align: 'center' });
  }

  // ---- Items: the hot item button, its disc menu, and the Merchant's shop --------------------------------------------

  get _hotRect() {
    if (!this._compactDisc) return { x: 8, y: Math.trunc(this.vh / 2) - 22, w: 44, h: 44 };   // middle of the left edge
    // A short strip: a smaller button just under the HUD pills, at the left edge (the full-size one would sit over the calendar).
    const size = 32, L = this._hudLayout(this.ctx);
    let bottom = 0;
    for (const r of [L.day, L.gold, L.storage, L.berserk, L.np]) if (r) bottom = Math.max(bottom, r.y + r.h);
    let y = bottom + 6;
    if (y + size + 6 > this.vh) y = Math.max(0, this.vh - size - 6);
    return { x: 6, y: y, w: size, h: size };
  }
  // The item button belongs to every view the party is shown in, not only the enlarged one.
  get _hotVisible() { return !this.scene.isShopping && !this.scene.isGameOver && !this.scene.starting && !this.scene.isInnMenu; }
  get _discCenter() { return { x: 8 + 46 + 22 + 6, y: this._hotRect.y + 22 }; }   // the disc opens inward; its edge keeps the button's 8 px margin

  /** In a short view (the party strip under the Radio and Local Music tabs) the four-way disc would not fit, so the slots open as a row. */
  get _compactDisc() { return this.vh < 2 * (46 + 22 + 6) + 16; }
  get _slotR() { return this._compactDisc ? 16 : 22; }   // the slots are the size of the button itself
  get _compactBounds() {
    const r = this._hotRect, SR = 16, GAP = 6, w = HOT_SLOT_COUNT * (SR * 2 + GAP) + GAP;
    return { x: r.x + r.w + 6, y: r.y + r.h / 2 - SR - 5, w: w, h: SR * 2 + 10 };
  }

  _discSlotCenter(i) {
    if (this._compactDisc) {
      const b = this._compactBounds;
      return { x: b.x + 6 + 16 + i * (16 * 2 + 6), y: b.y + b.h / 2 };
    }
    const c = this._discCenter;
    return [{ x: c.x, y: c.y - 46 }, { x: c.x + 46, y: c.y }, { x: c.x, y: c.y + 46 }, { x: c.x - 46, y: c.y }][i];
  }

  _discSlotAt(h) {
    for (let i = 0; i < HOT_SLOT_COUNT; i++) {
      const c = this._discSlotCenter(i), dx = h.x - c.x, dy = h.y - c.y;
      const rr = this._slotR + 3;
      if (dx * dx + dy * dy <= rr * rr) return i;
    }
    return -1;
  }

  _inHot(h) {
    if (!this._hotVisible) return false;
    const r = this._hotRect, dx = h.x - (r.x + r.w / 2), dy = h.y - (r.y + r.h / 2);
    return dx * dx + dy * dy <= (r.w / 2) * (r.w / 2);
  }

  /** Closes the disc menu or the shop if one is up (for Escape). True if something was closed. */
  dismissOverlay() {
    if (this.scene.isWaiting) { this.scene.cancelTargeting(); return true; }
    if (this.scene.isSwapping) { this.scene.innCancel(); return true; }
    if (this._settingsOpen) { this._settingsOpen = false; return true; }
    if (this._discOpen) { this._discOpen = false; this._hotDown = false; return true; }
    if (this.scene.isShopping) { if (this._shopInfoId) this._shopInfoId = null; else this.scene.leaveShop(); return true; }
    return false;
  }

  _onUp(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this._sliderDrag) { this._sliderDrag = false; return; }
    if (this.popupOpen) return;
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    if (this._discOpen) {
      const slot = this._discSlotAt(h);
      const opened = this._discByPress;
      this._discByPress = false;
      this._hotDown = false;
      // The release that ends the long press only opens the menu. In the radial disc the pointer is still over a slot (the left one
      // sits on the button), so that release must not choose it: the menu stays up until the next tap.
      if (opened) return;
      if (slot >= 0) { this.scene.selectHot(slot); this._discOpen = false; }
      else this._discOpen = false;   // a tap outside the disc closes it
      return;
    }
    if (this._hotDown) {
      this._hotDown = false;
      if (this._inHot(h)) this.scene.useHotItem();
    }
  }

  _drawItemIcon(ctx, id, cx, cy, factor, dim) {
    const img = Sprites.items && Sprites.items[id];
    if (!img) return;
    const w = img.width * factor, h = img.height * factor;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (dim) ctx.globalAlpha = 0.35;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    ctx.restore();
  }

  _drawCountBadge(ctx, n, right, bottom) {
    const s = n < 0 ? '\u221e' : n > 99 ? '99+' : String(n);   // a negative count is "never runs out"
    const px = 8.5 * PT;
    const tw = this._measure(ctx, s, px);
    const w = Math.round(tw + 8), x = right - w, y = bottom - 14;
    this._pill(ctx, x, y, w, 14, 6, 'rgba(22,18,52,0.92)', 'rgba(255,214,120,0.86)', 1);
    this._text(ctx, s, x + w / 2, y + 7.5, { px: px, color: n !== 0 ? 'white' : 'rgb(255,150,140)', align: 'center' });
  }

  /** While a healing item waits for its target the item button turns into a cancel button, with a prompt beside it. */
  _drawTargetUi(ctx) {
    const r = this._hotRect, hot = this._overHot;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.beginPath(); ctx.arc(cx, cy, (r.w - 1) / 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(44, 16, 30, hot ? 0.9 : 0.78); ctx.fill();
    ctx.strokeStyle = hot ? 'rgb(255,214,120)' : 'rgba(255,170,150,0.86)'; ctx.lineWidth = 1.6; ctx.stroke();
    const d = r.w * 0.18;
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx - d, cy + d); ctx.lineTo(cx + d, cy - d); ctx.stroke();
    ctx.lineCap = 'butt';
    if (this.scene.isPicking && this.vh < 180) return;   // a short view has no room for the words beside the buttons
    const label = t(this.scene.isPicking ? 'Monster damage multiplier'
      : this.scene.isSwapping ? (this.scene.swapFirstKind ? 'Now choose who to swap with' : 'Choose two heroes to swap')
        : 'Choose who to heal'), px = 8.5 * PT, w = Math.round(this._measure(ctx, label, px) + 20);
    let x = r.x + r.w + 8, y = r.y + (r.h - 24) / 2;
    if (this.scene.isPicking) {   // over the middle of the buttons rather than beside the cross, where it would run into them
      const mr = this._multiplierRects(), mid = Math.trunc((mr[0].x + mr[4].x + mr[4].w) / 2);
      x = Math.max(6, mid - Math.trunc(w / 2)); y = Math.max(2, mr[0].y - 32);
    }
    this._pill(ctx, x, y, w, 24, 6, 'rgba(22,18,52,0.88)', 'rgba(150,255,190,0.9)', 1.2);
    this._text(ctx, label, x + w / 2, y + 12.5, { px: px, color: 'white', align: 'center' });
  }

  // ---- The inn: Need to rest and reorganize? --------------------------------------------------------------

  /** The banner and the three buttons (Rest, Reorganize, Not now), under the HUD in a short view and centred in a tall one. */
  _innLayout() {
    let top = 40;
    const L = this._hudLayout(this.ctx);
    for (const r of [L.day, L.gold, L.storage, L.berserk, L.np]) if (r) top = Math.max(top, r.y + r.h + 4);
    const text = t('Need to rest and reorganize?');
    const bw = Math.min(this.vw - 16, Math.round(this._measure(this.ctx, text, 10.5 * PT) + 32)), bh = 24;
    if (this.vh < 190) {
      const banner = { x: Math.trunc((this.vw - bw) / 2), y: top, w: bw, h: bh };
      const h = Math.max(30, Math.min(40, this.vh - (banner.y + bh) - 8)), w = Math.trunc((this.vw - 24 - 16) / 3), y = banner.y + bh + 6;
      return { banner, rest: { x: 12, y, w, h }, reorg: { x: 12 + w + 8, y, w, h }, leave: { x: 12 + 2 * (w + 8), y, w, h } };
    }
    const side = this.vw >= 470, bwid = side ? 190 : Math.min(this.vw - 32, 260), bhgt = 74;
    const blockH = bh + 10 + (side ? bhgt : 2 * bhgt + 8) + 10 + 34;
    const y0 = Math.max(top, Math.trunc((this.vh - blockH) / 2));
    const banner = { x: Math.trunc((this.vw - bw) / 2), y: y0, w: bw, h: bh }, by = y0 + bh + 10;
    if (side) {
      return { banner, rest: { x: Math.trunc(this.vw / 2) - bwid - 6, y: by, w: bwid, h: bhgt }, reorg: { x: Math.trunc(this.vw / 2) + 6, y: by, w: bwid, h: bhgt },
        leave: { x: Math.trunc((this.vw - 150) / 2), y: by + bhgt + 10, w: 150, h: 34 } };
    }
    const rest = { x: Math.trunc((this.vw - bwid) / 2), y: by, w: bwid, h: bhgt };
    const reorg = { x: rest.x, y: by + bhgt + 8, w: bwid, h: bhgt };
    return { banner, rest, reorg, leave: { x: Math.trunc((this.vw - 150) / 2), y: reorg.y + reorg.h + 10, w: 150, h: 34 } };
  }

  _innButtonAt(h) {
    const L = this._innLayout();
    if (this._inRect(h, L.rest)) return 0;
    if (this._inRect(h, L.reorg)) return 1;
    if (this._inRect(h, L.leave)) return 2;
    return -1;
  }

  _drawInnMenu(ctx) {
    if (!this.scene.isInnMenu) return;
    const L = this._innLayout(), s = this.scene, compact = this.vh < 190;
    this._pill(ctx, L.banner.x, L.banner.y, L.banner.w, L.banner.h, L.banner.h / 2, 'rgba(22,18,52,0.88)', 'rgba(255,214,120,0.92)', 1.5);
    this._text(ctx, t('Need to rest and reorganize?'), L.banner.x + L.banner.w / 2, L.banner.y + L.banner.h / 2 + 0.5, { px: 10.5 * PT, color: 'white', align: 'center' });
    const coin = Sprites.coin;
    const button = (r, idx, title, sub, cost, enabled) => {
      const hot = this._innHover === idx && enabled;
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, !enabled ? 'rgba(52,54,74,0.6)' : hot ? 'rgb(255,226,130)' : 'rgb(255,204,82)');
      g.addColorStop(1, !enabled ? 'rgba(34,36,54,0.6)' : hot ? 'rgb(236,160,40)' : 'rgb(214,124,24)');
      this._pill(ctx, r.x, r.y, r.w, r.h, 9, g, enabled ? 'rgb(255,244,190)' : 'rgba(130,136,160,0.63)', 1.6);
      const ink = enabled ? 'rgb(70,36,8)' : 'rgb(170,176,190)';
      this._text(ctx, title, r.x + r.w / 2, r.y + (compact ? r.h * 0.28 : 18) + 0.5, { px: (compact ? 9 : 11.5) * PT, color: ink, align: 'center', weight: 700 });
      const cs = compact ? 1 : 2, num = String(cost), npx = (compact ? 8.5 : 10) * PT, nw = this._measure(ctx, num, npx, 700);
      const total = coin.width * cs + 4 + nw, x0 = r.x + (r.w - total) / 2, cy = r.y + (compact ? r.h * 0.72 : 39);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(coin, Math.round(x0), Math.round(cy - coin.height * cs / 2), coin.width * cs, coin.height * cs);
      ctx.restore();
      this._text(ctx, num, x0 + coin.width * cs + 4, cy + 0.5, { px: npx, color: ink, weight: 700 });
      if (!compact) this._text(ctx, sub, r.x + r.w / 2, r.y + r.h - 13, { px: 8.5 * PT, color: ink, align: 'center', weight: 400 });
    };
    const restSub = s.canRest ? t('Fully heals the party.') : (s.anyoneHurt ? t('Not enough gold') : t('Everyone is fine'));
    const reorgSub = s.canReorganize ? t('Swap the positions of 2 heroes.') : t('Not enough gold');
    button(L.rest, 0, t('Rest'), restSub, 10, s.canRest);
    button(L.reorg, 1, t('Reorganize'), reorgSub, 30, s.canReorganize);
    const lv = L.leave, hotLeave = this._innHover === 2;
    this._pill(ctx, lv.x, lv.y, lv.w, lv.h, 8, hotLeave ? 'rgba(26,22,60,0.92)' : 'rgba(26,22,60,0.8)', hotLeave ? 'rgb(255,214,120)' : 'rgba(170,186,240,0.78)', 1.5);
    this._text(ctx, t('Not now'), lv.x + lv.w / 2, lv.y + lv.h / 2 + 0.5, { px: (compact ? 9 : 10.5) * PT, color: 'white', align: 'center', weight: 700 });
  }

  // ---- Game over: the score and a Start Over button ----------------------------------------------------------

  get _compactGameOver() { return this.vh < 180; }

  /** Where the pieces of the defeat screen go (HUD units): the big title, the score, the record to beat, the button. */
  _gameOverLayout() {
    if (this._compactGameOver) {
      const btnW = 112, left = 14;
      let top = 36;
      const L = this._hudLayout(this.ctx);
      for (const r of [L.day, L.gold, L.storage, L.berserk, L.np]) if (r) top = Math.max(top, r.y + r.h + 2);   // below the HUD pills, which may have wrapped
      const th = Math.max(26, Math.min(46, this.vh - top - 22));
      const title = { x: left, y: top, w: this.vw - left - btnW - 26, h: th };
      const score = { x: left, y: title.y + title.h, w: title.w, h: 18 };
      return { title: title, score: score, record: null, button: { x: this.vw - 12 - btnW, y: top + 4 + Math.trunc((th + 18 - 32) / 2), w: btnW, h: 32 } };
    }
    const titleH = Math.trunc(Math.max(64, Math.min(150, Math.min(this.vh * 0.30, this.vw * 0.18))));
    const cy = Math.max(44 + titleH, Math.trunc(this.vh * 0.52 - 28));
    const title = { x: 0, y: cy - titleH, w: this.vw, h: titleH };
    const score = { x: 0, y: cy + 4, w: this.vw, h: 28 };
    const record = { x: 0, y: score.y + score.h, w: this.vw, h: 22 };
    return { title: title, score: score, record: record, button: { x: Math.trunc((this.vw - 170) / 2), y: record.y + record.h + 12, w: 170, h: 40 } };
  }

  _startOverRect() { return this._gameOverLayout().button; }

  _yearsDays(y, d) {
    return t(y === 1 ? '{n} year' : '{n} years', { n: y }) + ', ' + t(d === 1 ? '{n} day' : '{n} days', { n: d });
  }

  _survivedText() { return t('Survived: {s}', { s: this._yearsDays(this.scene.survivedYears, this.scene.survivedDays) }); }

  /** The quest lettering. The medieval face comes from Google Fonts, asked for only once a defeat has been shown (the rest of the
   *  time the page makes no third-party request); until it arrives, or without a connection, the machine's own medieval-looking
   *  faces and then a serif stand in. */
  _ensureQuestFont() {
    if (this._questFontAsked) return;
    this._questFontAsked = true;
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap';
      document.head.appendChild(link);
      if (document.fonts && document.fonts.load) document.fonts.load('48px "MedievalSharp"').catch(() => { });
    } catch (x) { /* fine: the fallbacks do */ }
  }

  _questFace() {
    return isCjk() ? FONT : '"MedievalSharp", "Lucida Calligraphy", Gabriola, "Palatino Linotype", "Old English Text MT", Georgia, serif';
  }

  /** The big word: filled with a gradient, edged in dark, with a soft halo, scaled down to fit the width available. */
  _drawQuestTitle(ctx, text, box, record) {
    let px = box.h * 0.9;
    ctx.save();
    ctx.font = px + 'px ' + this._questFace();
    const w = ctx.measureText(text).width;
    if (w > box.w - 24) { px *= (box.w - 24) / w; ctx.font = px + 'px ' + this._questFace(); }
    const cx = this._compactGameOver ? box.x + Math.min(box.w, ctx.measureText(text).width) / 2 : box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3);
    ctx.lineWidth = Math.max(2, px * 0.22);
    ctx.strokeStyle = record ? 'rgba(255,214,90,' + (0.28 + 0.2 * pulse).toFixed(2) + ')' : 'rgba(200,30,40,0.28)';
    ctx.strokeText(text, cx, cy);
    ctx.lineWidth = Math.max(2, px * 0.13);
    ctx.strokeStyle = 'rgba(10,6,14,0.9)';
    ctx.strokeText(text, cx, cy);
    const g = ctx.createLinearGradient(0, cy - px * 0.5, 0, cy + px * 0.5);
    if (record) { g.addColorStop(0, 'rgb(255,248,176)'); g.addColorStop(1, 'rgb(236,118,26)'); }
    else { g.addColorStop(0, 'rgb(255,132,112)'); g.addColorStop(1, 'rgb(140,16,34)'); }
    ctx.fillStyle = g;
    ctx.fillText(text, cx, cy);
    ctx.lineWidth = Math.max(1, px * 0.025);
    ctx.strokeStyle = record ? 'rgb(255,240,160)' : 'rgb(255,170,150)';
    ctx.strokeText(text, cx, cy);
    if (record) {   // sparkles drifting round the lettering
      const tw = ctx.measureText(text).width, tm = performance.now() / 1000;
      ctx.fillStyle = 'rgb(255,252,220)';
      for (let i = 0; i < 9; i++) {
        const ph = (tm * 0.55 + i * 0.37) % 1.0;
        const sx = cx - tw / 2 + (((i * 0.137 + 0.05 * Math.sin(tm + i)) % 1 + 1) % 1) * tw;
        const sy = cy - px * 0.4 + ((i * 0.61) % 1) * px * 0.8;
        const a = Math.max(0, Math.sin(Math.PI * ph)), r = 2 + 4 * a;
        ctx.globalAlpha = a;
        ctx.fillRect(sx - 0.5, sy - r, 1.5, r * 2);
        ctx.fillRect(sx - r, sy - 0.5, r * 2, 1.5);
      }
    }
    ctx.restore();
  }

  _drawGameOver(ctx) {
    if (!this.scene.isGameOver) return;
    this._ensureQuestFont();
    const L = this._gameOverLayout(), b = L.button, compact = this._compactGameOver, rec = this.scene.newRecord;
    this._drawQuestTitle(ctx, t(rec ? 'NEW RECORD' : 'DEFEAT'), L.title, rec);
    const sx = compact ? L.score.x : this.vw / 2, sy = L.score.y + L.score.h / 2 + 0.5, al = compact ? 'left' : 'center';
    this._text(ctx, this._survivedText(), sx + 1, sy + 1, { px: (compact ? 9.5 : 13) * PT, color: 'rgba(0,0,0,0.78)', align: al, weight: 700 });
    this._text(ctx, this._survivedText(), sx, sy, { px: (compact ? 9.5 : 13) * PT, color: 'white', align: al, weight: 700 });
    if (L.record && !rec && this.scene.bestDays > 0) {
      const text = t('Furthest: {s}', { s: this._yearsDays(Math.floor(this.scene.bestDays / 20), this.scene.bestDays % 20) });
      const ry = L.record.y + L.record.h / 2 + 0.5;
      this._text(ctx, text, this.vw / 2 + 1, ry + 1, { px: 10 * PT, color: 'rgba(0,0,0,0.78)', align: 'center', weight: 400 });
      this._text(ctx, text, this.vw / 2, ry, { px: 10 * PT, color: 'rgb(214,220,244)', align: 'center', weight: 400 });
    }
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, this._overStartOver ? 'rgb(255,232,130)' : 'rgb(255,206,80)');
    g.addColorStop(1, this._overStartOver ? 'rgb(236,160,40)' : 'rgb(220,130,24)');
    this._pill(ctx, b.x, b.y, b.w, b.h, 8, g, 'rgb(255,244,190)', 1.6);
    this._text(ctx, t('Start Over'), b.x + b.w / 2, b.y + b.h / 2 + 0.5, { px: 10.5 * PT, color: 'rgb(70,36,8)', align: 'center', weight: 700 });
  }

  _drawHotButton(ctx) {
    if (!this._hotVisible) return;
    if (this.scene.isWaiting || this.scene.isSwapping) { this._drawTargetUi(ctx); return; }
    const s = this.scene, r = this._hotRect, tipLit = s.isTipPrompt, hot = this._overHot || this._hotDown || tipLit;
    const id = s.hotItem, n = s.itemCount(id);
    if (tipLit) {   // the tutorial: a green glow pulsing out from the button the Old Man points at
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 5), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      for (let i = 4; i >= 1; i--) {
        const gr = r.w / 2 + i * 3.5 + pulse * 4;
        ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2);
        ctx.fillStyle = rgba(150, 255, 190, 0.27 * (1.15 - i * 0.2) * (0.55 + 0.45 * pulse)); ctx.fill();
      }
    }
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, (r.w - 1) / 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(12, 16, 44, hot ? 0.75 : 0.47); ctx.fill();
    ctx.strokeStyle = hot ? 'rgb(255,214,120)' : rgba(210, 224, 255, 0.75); ctx.lineWidth = 1.6; ctx.stroke();
    this._drawItemIcon(ctx, id, r.x + r.w / 2, r.y + r.h / 2, this._compactDisc ? 1 : 2, n <= 0);
    this._drawCountBadge(ctx, s.isInfinite(id) ? -1 : n, r.x + r.w + 2, r.y + r.h + 2);
    if (this._overHot && !this._discOpen && !tipLit) this._tip(ctx, t('Tap: use   Hold: switch'), r.x + r.w + 10, r.y + r.h / 2, true);
  }

  _drawDisc(ctx) {
    if (!this._discOpen || !this._hotVisible) return;
    const c = this._discCenter, outer = 46 + 22 + 6, compact = this._compactDisc;
    const s = this.scene, hot = s.hotItems();
    if (compact) {
      const b = this._compactBounds;
      this._pill(ctx, b.x, b.y, b.w, b.h, b.h / 2, 'rgba(14,16,46,0.88)', 'rgba(255,214,120,0.9)', 1.8);
    } else {
      ctx.beginPath(); ctx.arc(c.x, c.y, outer, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(14,16,46,0.84)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.8; ctx.stroke();
    }
    for (let i = 0; i < HOT_SLOT_COUNT; i++) {
      const sc = this._discSlotCenter(i), selected = i === s.hotSelected, hover = i === this._discHover;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, this._slotR, 0, Math.PI * 2);
      ctx.fillStyle = hover ? 'rgba(52,48,110,0.92)' : 'rgba(26,28,74,0.75)'; ctx.fill();
      ctx.strokeStyle = selected ? 'rgb(255,214,120)' : hover ? 'white' : 'rgba(170,186,240,0.67)'; ctx.lineWidth = selected ? 2.4 : 1.4; ctx.stroke();
      const n = s.itemCount(hot[i]);
      this._drawItemIcon(ctx, hot[i], sc.x, sc.y, compact ? 1 : 2, n <= 0);
      this._drawCountBadge(ctx, s.isInfinite(hot[i]) ? -1 : n, sc.x + this._slotR + 3, sc.y + this._slotR + 3);
    }
    // The hub shows what is selected, with a name above the disc.
    const cur = s.hotItem;
    if (!compact) {
      ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,18,52,0.86)'; ctx.fill();
      this._drawItemIcon(ctx, cur, c.x, c.y, 1, s.itemCount(cur) <= 0);
    }
    const label = t(ITEM_DEFS[this._discHover >= 0 ? hot[this._discHover] : cur].name);
    const px = 8.5 * PT, w = Math.round(this._measure(ctx, label, px) + 20);
    const cb = this._compactBounds;   // in a short view the name sits beside the row, clear of the HUD
    const lx = compact ? cb.x + cb.w + 6 : Math.max(6, c.x - w / 2);
    const ly = compact ? cb.y + (cb.h - 24) / 2 : c.y - outer - 30;
    this._pill(ctx, lx, ly, w, 24, 6, 'rgba(22,18,52,0.88)', 'rgba(255,214,120,0.9)', 1.2);
    this._text(ctx, label, lx + w / 2, ly + 12.5, { px: px, color: 'white', align: 'center' });
  }

  // The shop panel (screen pixels, like the tavern's cards). One row per item for sale: icon, name, how many are in the bag, an (i)
  // button and the price button. The description is a small card opened by the icon or the (i), so the panel stays compact at any
  // window size or language.

  _shopLayout() {
    const stock = Object.keys(ITEM_DEFS).filter(id => ITEM_DEFS[id].price > 0);
    const PW = 340, HEAD = 40, ROW = 60, FOOT = 48, units = HEAD + stock.length * ROW + FOOT;
    let k = Math.max(1.0, Math.min(2.0, this.height / 300.0));
    k = Math.max(0.5, Math.min(k, (this.width - 24) / PW, (this.height - 16) / units));
    const w = Math.trunc(PW * k), h = Math.trunc(units * k);
    const p = { x: Math.trunc((this.width - w) / 2), y: Math.trunc((this.height - h) / 2), w: w, h: h };
    const rows = stock.map((id, i) => {
      const y = p.y + Math.trunc((HEAD + i * ROW) * k), rh = Math.trunc(ROW * k), pad = Math.trunc(14 * k);
      const bw = Math.trunc(92 * k), bh = Math.trunc(34 * k), iw = Math.trunc(28 * k), isz = Math.trunc(48 * k);
      const buy = { x: p.x + p.w - pad - bw, y: y + Math.trunc((rh - bh) / 2), w: bw, h: bh };
      const info = { x: buy.x - Math.trunc(10 * k) - iw, y: y + Math.trunc((rh - iw) / 2), w: iw, h: iw };
      const icon = { x: p.x + pad - Math.trunc(2 * k), y: y + Math.trunc((rh - isz) / 2), w: isz, h: isz };
      const nx = icon.x + icon.w + Math.trunc(8 * k);
      return { id: id, y: y, rh: rh, buy: buy, info: info, icon: icon, nameX: nx, nameW: Math.max(10, info.x - Math.trunc(8 * k) - nx) };
    });
    const lw = Math.trunc(84 * k), lh = Math.trunc(32 * k);
    return { k: k, p: p, rows: rows, leave: { x: p.x + p.w - Math.trunc(14 * k) - lw, y: p.y + p.h - Math.trunc(8 * k) - lh, w: lw, h: lh } };
  }

  /** What is under the point: { kind: 0 nothing | 1 buy | 2 icon or (i) | 3 leave, row }. */
  _shopHit(pt) {
    const L = this._shopLayout();
    for (let i = 0; i < L.rows.length; i++) {
      const r = L.rows[i];
      if (this._inRect(pt, r.buy)) return { kind: 1, row: i };
      if (this._inRect(pt, r.info) || this._inRect(pt, r.icon)) return { kind: 2, row: i };
    }
    if (this._inRect(pt, L.leave)) return { kind: 3, row: -1 };
    return { kind: 0, row: -1 };
  }

  _drawShopButton(ctx, b, enabled, hot) {
    this._pill(ctx, b.x, b.y, b.w, b.h, b.h / 2,
      enabled ? (hot ? 'rgba(120,86,24,0.94)' : 'rgba(90,62,16,0.9)') : 'rgba(40,40,56,0.8)',
      enabled ? 'rgb(255,214,120)' : 'rgba(120,120,150,0.63)', 1.6);
  }

  _drawShop(ctx) {
    const s = this.scene;
    if (!s.isShopping) { this._shopInfoId = null; return; }
    const L = this._shopLayout(), k = L.k, r = L.p;
    const hover = this._shopInfoId ? { kind: 0, row: -1 } : (this._shopHover || { kind: 0, row: -1 });
    ctx.fillStyle = 'rgba(0,0,0,0.47)'; ctx.fillRect(0, 0, this.width, this.height);
    this._pill(ctx, r.x, r.y, r.w, r.h, 10 * k, 'rgba(24,20,58,0.94)', 'rgb(255,214,120)', 2.2);
    const nameFont = 10.5 * PT * k, small = 8.5 * PT * k;
    this._text(ctx, t('Merchant'), r.x + 14 * k, r.y + 21 * k, { px: 12 * PT * k, color: 'rgb(255,226,150)' });
    // the gold in hand
    const coin = Sprites.coin, cs = Math.max(1, Math.round(1.5 * k));
    const gold = s.gold.toLocaleString('en-US');
    const gw = this._measure(ctx, gold, nameFont);
    this._text(ctx, gold, r.x + r.w - 14 * k - gw, r.y + 21 * k, { px: nameFont, color: 'white' });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(coin, Math.round(r.x + r.w - 14 * k - gw - 6 - coin.width * cs), Math.round(r.y + 21 * k - coin.height * cs / 2), coin.width * cs, coin.height * cs);
    ctx.strokeStyle = 'rgba(170,186,240,0.47)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r.x + 12 * k, r.y + 40 * k + 0.5); ctx.lineTo(r.x + r.w - 12 * k, r.y + 40 * k + 0.5); ctx.stroke();

    L.rows.forEach((row, i) => {
      const def = ITEM_DEFS[row.id], hotIcon = hover.kind === 2 && hover.row === i;
      this._drawItemIcon(ctx, row.id, row.icon.x + row.icon.w / 2, row.icon.y + row.icon.h / 2, Math.max(2, Math.round(3 * k)), false);
      if (hotIcon) { ctx.strokeStyle = 'rgba(255,214,120,0.6)'; ctx.lineWidth = 1.4; ctx.strokeRect(row.icon.x + 0.5, row.icon.y + 0.5, row.icon.w, row.icon.h); }
      this._fitText(ctx, t(def.name), row.nameX, row.y + row.rh / 2 - 10 * k, row.nameW, { px: nameFont, color: 'white' });
      this._fitText(ctx, t('In bag: {n}', { n: s.itemCount(row.id) }), row.nameX, row.y + row.rh / 2 + 11 * k, row.nameW, { px: small, color: 'rgb(255,214,120)', weight: 400 });

      // (i): the description
      const ib = row.info, cx = ib.x + ib.w / 2, cy = ib.y + ib.h / 2;
      ctx.beginPath(); ctx.arc(cx, cy, ib.w / 2 - 0.5, 0, Math.PI * 2);
      ctx.fillStyle = hotIcon ? 'rgba(70,80,140,0.92)' : 'rgba(44,50,98,0.86)'; ctx.fill();
      ctx.strokeStyle = 'rgba(170,186,240,0.86)'; ctx.lineWidth = 1.4; ctx.stroke();
      this._text(ctx, 'i', cx, cy + 0.5, { px: nameFont, color: 'white', align: 'center' });

      // the price is the button; dim, with the number in red, while there isn't enough gold
      const afford = s.gold >= def.price, hotBuy = hover.kind === 1 && hover.row === i && afford;
      this._drawShopButton(ctx, row.buy, afford, hotBuy);
      const ptxt = String(def.price), pw = this._measure(ctx, ptxt, nameFont), gap = 5 * k, cw = coin.width * cs;
      const x0 = row.buy.x + (row.buy.w - (cw + gap + pw)) / 2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(coin, Math.round(x0), Math.round(row.buy.y + (row.buy.h - coin.height * cs) / 2), cw, coin.height * cs);
      this._text(ctx, ptxt, x0 + cw + gap, row.buy.y + row.buy.h / 2 + 0.5, { px: nameFont, color: afford ? 'white' : 'rgb(255,150,140)' });
    });
    this._drawShopButton(ctx, L.leave, true, hover.kind === 3);
    this._text(ctx, t('Leave'), L.leave.x + L.leave.w / 2, L.leave.y + L.leave.h / 2 + 0.5, { px: nameFont, color: 'white', align: 'center' });

    if (this._shopInfoId) this._drawShopInfo(ctx, L);
  }

  /** The item's description as a small card over the shop; any tap (or Esc) closes it. */
  _drawShopInfo(ctx, L) {
    const k = L.k, id = this._shopInfoId, def = ITEM_DEFS[id];
    ctx.fillStyle = 'rgba(0,0,0,0.43)'; ctx.fillRect(0, 0, this.width, this.height);
    const cw = Math.min(Math.trunc(300 * k), this.width - 24), pad = Math.trunc(14 * k), innerW = cw - 2 * pad;
    const small = 8.5 * PT * k, headH = Math.trunc(48 * k), hintH = Math.trunc(22 * k);
    const lines = this._wrapLines(ctx, t(def.blurb), innerW, small, 400);
    const lh = small * 1.25;
    const ch = Math.min(this.height - 16, pad + headH + Math.trunc(6 * k) + lines.length * lh + Math.trunc(8 * k) + hintH + Math.trunc(pad / 2));
    const x = Math.trunc((this.width - cw) / 2), y = Math.max(8, Math.trunc((this.height - ch) / 2));
    this._pill(ctx, x, y, cw, ch, 10 * k, 'rgba(28,24,66,0.97)', 'rgb(255,214,120)', 2);
    this._drawItemIcon(ctx, id, x + pad + 22 * k, y + pad + headH / 2, Math.max(2, Math.round(3 * k)), false);
    this._fitText(ctx, t(def.name), x + pad + 52 * k, y + pad + headH / 2, innerW - 52 * k, { px: 12 * PT * k, color: 'rgb(255,226,150)' });
    const ty = y + pad + headH + 6 * k;
    this._wrap(ctx, t(def.blurb), x + pad, ty, innerW, small, 'rgb(214,222,250)', 400, 40);
    this._text(ctx, t('Tap anywhere to close'), x + cw - pad, y + ch - pad / 2 - hintH / 2, { px: small, color: 'rgb(160,172,220)', weight: 400, align: 'right' });
  }

  /** Single-line text that is cut with an ellipsis when it would pass maxW. */
  _fitText(ctx, str, x, y, maxW, o) {
    let s = str;
    if (this._measure(ctx, s, o.px, o.weight) > maxW) {
      const chars = Array.from(s);
      while (chars.length > 1 && this._measure(ctx, chars.join('') + '...', o.px, o.weight) > maxW) chars.pop();
      s = chars.join('') + '...';
    }
    this._text(ctx, s, x, y, o);
  }

  // ---- Story UI: tavern cards, dialogue, level-up ----------------------------------------------------------------
  _uiScale(designWidth) {
    const k = Math.max(1.0, Math.min(2.2, this.height / 130.0));
    return Math.min(k, (this.width - 24.0) / designWidth);
  }
  /**
   * The tavern's banner and its cards are one block, centered on the page whatever its size. Wide screens put the two cards either
   * side of the middle (so the tavern and the Paca at its door stay in view); on a narrow, tall screen (a phone upright) they would
   * shrink to nothing side by side, so they stack instead, at a readable size.
   */
  _cardLayout() {
    const s = this.scene;
    const n = s.offer ? s.offer.length : 0;
    const out = { k: 0, stacked: false, rects: [], bannerY: 0, bannerH: 0 };
    if (!s.isChoosing || n === 0) return out;
    if (s.starting && this.height < 250) return out;   // a short view has no room for the cards: the heroes at the fire are tapped instead
    const bannerOf = k => Math.round(10.5 * PT * k + 6 * k + 4);
    // The block sits below the HUD pills (which may have wrapped onto a second row), never under them.
    const L0 = this._hudLayout(this.ctx);
    let hudBottom = 0;
    for (const r of [L0.day, L0.gold, L0.storage, L0.np]) if (r) hudBottom = Math.max(hudBottom, r.y + r.h);
    const top0 = Math.trunc(hudBottom * this.hud) + 6, room = this.height - top0 - 8;
    const k0 = Math.max(1.0, Math.min(2.2, this.height / 130.0));
    const kSide = Math.min(k0, (this.width - 40.0) / 660.0);
    let k, stacked = false;
    if (kSide >= 0.85) k = kSide;
    else {
      stacked = true;
      k = Math.min(1.6, (this.width - 24.0) / 216.0);
      const fit = kk => bannerOf(kk) + Math.trunc(10 * kk) + n * Math.trunc(96 * kk) + (n - 1) * Math.trunc(10 * kk);
      while (k > 0.5 && fit(k) > room) k -= 0.05;
    }
    if (k < 0.5) return out;
    const cw = Math.trunc(216 * k), ch = Math.trunc(96 * k), gap = Math.trunc(10 * k);
    const bannerH = bannerOf(k);
    const total = bannerH + gap + (stacked ? n * ch + (n - 1) * gap : ch);
    const bannerY = Math.max(top0, top0 + Math.trunc((room - total) / 2));
    const top = bannerY + bannerH + gap;
    const cx = Math.trunc(this.width / 2);
    const rects = [];
    if (stacked) {
      for (let i = 0; i < n; i++) rects.push({ x: cx - Math.trunc(cw / 2), y: top + i * (ch + gap), w: cw, h: ch });
    } else {
      const mid = Math.trunc(228 * k);   // the clear middle for the tavern and the Paca at its door
      rects.push({ x: cx - Math.trunc(mid / 2) - cw, y: top, w: cw, h: ch });
      if (n > 1) rects.push({ x: cx + Math.trunc(mid / 2), y: top, w: cw, h: ch });
    }
    out.k = k; out.stacked = stacked; out.rects = rects; out.bannerY = bannerY; out.bannerH = bannerH;
    return out;
  }

  _cardRects() { return this._cardLayout().rects; }
  _banner(ctx, k, title, centered, atY) {
    let px = 10.5 * PT * k;
    let tw = this._measure(ctx, title, px);
    if (tw + 28 * k > this.width - 16) { const f = (this.width - 16) / (tw + 28 * k); px *= f; tw *= f; }   // never wider than the page
    const pw = Math.round(tw + 28 * k * (px / (10.5 * PT * k))), ph = Math.round(px + 6 * k + 4);
    const x = centered ? Math.round((this.width - pw) / 2) : this._topPillX(ctx, pw);
    const y = atY !== undefined ? atY : (centered ? Math.round((this.height - ph) / 2) : Math.trunc(5 * k));
    this._pill(ctx, x, y, pw, ph, ph / 2, 'rgba(22,18,52,0.84)', 'rgba(255,214,120,0.9)', 1.5);
    this._text(ctx, title, x + pw / 2, y + ph / 2 + 0.5, { px: px, color: 'white', align: 'center' });
  }

  _drawEncounter(ctx) {
    const lay = this._cardLayout(), rects = lay.rects;
    if (rects.length === 0) return;
    const s = this.scene, k = lay.k;
    const title = s.starting ? t('Who will you adventure as?') : t(s.offer.length === 1 ? 'A tavern! Your last companion is waiting.' : 'A tavern! Who joins the party?');
    this._banner(ctx, k, title, true, lay.bannerY);   // centered above the cards, in the middle of the page
    for (let i = 0; i < rects.length && i < s.offer.length; i++) {
      const r = rects[i], hot = i === this.hover.card, kind = s.offer[i];
      roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 9 * k);
      ctx.fillStyle = hot ? 'rgba(44,40,96,0.94)' : 'rgba(22,22,60,0.87)'; ctx.fill();
      ctx.strokeStyle = hot ? 'rgb(255,214,120)' : 'rgba(170,186,240,0.78)'; ctx.lineWidth = hot ? 2.5 : 1.5; ctx.stroke();

      const sp = Sprites.party[kind];
      const factor = Math.max(1, Math.trunc((48 * k) / sp.h));
      const pw = sp.w * factor, ph = sp.h * factor;
      const px0 = r.x + Math.trunc(10 * k), py0 = r.y + Math.trunc((r.h - ph) / 2);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sp.a, px0, py0, pw, ph);

      const tx = px0 + pw + Math.trunc(10 * k), tw = r.x + r.w - tx - Math.trunc(8 * k);
      this._text(ctx, t(PARTY_NAMES[kind]), tx, r.y + Math.trunc(7 * k) + 9 * k, { px: 10.5 * PT * k, color: hot ? 'rgb(255,226,150)' : 'white' });
      let y = r.y + Math.trunc(7 * k) + 18 * k + 2;
      y = this._wrap(ctx, traitSummary(kind, 1), tx, y, tw, 8 * PT * k, 'rgb(255,214,120)', 600, 2);
      this._wrap(ctx, t(BLURB[kind]), tx, y + 2, tw, 7.5 * PT * k, 'rgb(178,190,232)', 400, 2, 'italic ');
    }
  }

  _wrapLines(ctx, text, maxW, px, weight, style) {
    ctx.font = (style || '') + weight + ' ' + px + 'px ' + FONT;
    const cjk = isCjk();
    const words = cjk ? Array.from(text) : text.split(' ');
    const sep = cjk ? '' : ' ';
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + sep + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /** Draws wrapped text (up to maxLines) and returns the y below it. */
  _wrap(ctx, text, x, y, maxW, px, color, weight, maxLines, style) {
    const cjk = isCjk();
    const lines = this._wrapLines(ctx, text, maxW, px, weight, style);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const lh = px * 1.25;
    for (let i = 0; i < lines.length && i < maxLines; i++) {
      let line = lines[i];
      if (i === maxLines - 1 && lines.length > maxLines) line = (cjk ? line.slice(0, -1) : line.replace(/\s*\S*$/, '')) + '...';
      ctx.fillText(line, x, y + i * lh);
    }
    return y + Math.min(lines.length, maxLines) * lh;
  }

  _dialogueRect() {
    const k = this._uiScale(640);
    const w = Math.trunc(Math.min(this.width - 24, 620 * k)), h = Math.trunc(36 * k);
    return { x: Math.trunc((this.width - w) / 2), y: Math.trunc((this.height - h) / 2), w: w, h: h };
  }

  _drawStoryUi(ctx) {
    const s = this.scene;
    if (s.isDialogue) this._drawDialogue(ctx);
    else if (s.isLevelSelect) this._drawLevelSelect(ctx);
    else if (s.isLevelFx) this._banner(ctx, this._uiScale(640), s.levelFxText, true);
  }

  _drawDialogue(ctx) {
    const s = this.scene, k = this._uiScale(640), r = this._dialogueRect();
    roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 9 * k);
    ctx.fillStyle = 'rgba(18,16,46,0.91)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.92)'; ctx.lineWidth = 1.8; ctx.stroke();
    const pad = 14 * k, px = 10.5 * PT * k;
    const who = s.dialogueWho, text = s.dialogueShownText;
    let x = r.x + pad;
    if (who) {
      this._text(ctx, t(who) + ':', x, r.y + r.h / 2 + 0.5, { px: px, color: 'rgb(255,214,120)' });
      x += this._measure(ctx, t(who) + ':', px) + 8 * k;
      this._text(ctx, text, x, r.y + r.h / 2 + 0.5, { px: px, color: 'white', weight: 400 });
    } else {
      ctx.font = 'italic 400 ' + px + 'px ' + FONT;
      ctx.fillStyle = 'rgb(200,226,255)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x, r.y + r.h / 2 + 0.5);
    }
    if (s.dialogueReady && (Math.trunc(performance.now() / 450)) % 2 === 0) {
      const ax = r.x + r.w - 18 * k, ay = r.y + r.h / 2, sz = 5 * k;
      ctx.fillStyle = 'rgb(255,214,120)';
      ctx.beginPath(); ctx.moveTo(ax - sz, ay - sz * 0.6); ctx.lineTo(ax + sz, ay - sz * 0.6); ctx.lineTo(ax, ay + sz * 0.8); ctx.closePath(); ctx.fill();
    }
  }

  /** Where the Old Man and his box go: side by side in the room to the right of the potion button, centred in the view. */
  _tipLayout(ctx, k) {
    const s = this.scene, hr = this._hotRect;
    const left = Math.trunc((hr.x + hr.w) * this.hud + 40 * k), right = this.width - Math.trunc(12 * k);
    const avail = Math.max(Math.trunc(200 * k), right - left);
    const sp = Sprites.oldMan;
    const ph = Math.trunc(Math.min(this.height - 16, 76 * k)), factor = Math.max(1, Math.trunc((ph - 10 * k) / sp.h));
    const pw = Math.max(Math.trunc(48 * k), sp.w * factor + Math.trunc(14 * k)), gap = Math.trunc(10 * k);
    const boxW = Math.max(Math.trunc(150 * k), Math.min(avail - pw - gap, Math.trunc(600 * k)));
    const pad = Math.trunc(14 * k), px = 10.5 * PT * k, innerW = boxW - pad * 2;
    const who = t('Old Man') + ':', nameW = this._measure(ctx, who, px) + 8 * k;
    const inline = nameW + this._measure(ctx, s.tipText, px, 400) <= innerW;
    const lines = inline ? [s.tipText] : this._wrapLines(ctx, s.tipText, innerW, px, 400);
    const lh = px * 1.25, boxH = inline ? Math.trunc(36 * k) : Math.max(Math.trunc(36 * k), Math.trunc(px * 1.3 + 2 * k + lines.length * lh + 14 * k));
    const total = boxW + gap + pw, gx = left + Math.max(0, Math.trunc((avail - total) / 2)), cy = Math.trunc(this.height / 2);
    return {
      box: { x: gx, y: cy - Math.trunc(boxH / 2), w: boxW, h: boxH },
      portrait: { x: gx + boxW + gap, y: cy - Math.trunc(ph / 2), w: pw, h: ph },
      who: who, nameW: nameW, inline: inline, lines: lines, px: px, lh: lh, pad: pad, factor: factor
    };
  }

  /** The Old Man's tip: a dark overlay over the whole view, the potion button lit (for the first tip), the Old Man standing beside a
   *  dialogue box in the style of his story, the words written out a letter at a time. */
  _drawTip(ctx) {
    const s = this.scene;
    if (!s.isTipDialogue) return;
    const k = this._uiScale(640), hud = this.hud;
    ctx.fillStyle = 'rgba(0,0,0,0.745)'; ctx.fillRect(0, 0, this.width, this.height);
    if (s.isTipPrompt) {
      ctx.save();
      if (hud !== 1) ctx.scale(hud, hud);
      this._drawHotButton(ctx);   // lit again over the dark
      const hr = this._hotRect, ax = hr.x + hr.w + 8 + 3 + 3 * Math.sin(performance.now() / 1000 * 7), ay = hr.y + hr.h / 2;
      ctx.fillStyle = 'rgb(255,214,120)';
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + 11, ay - 7); ctx.lineTo(ax + 11, ay + 7); ctx.closePath(); ctx.fill();   // a bouncing arrow beside it
      ctx.restore();
    }
    const L = this._tipLayout(ctx, k), b = L.box, p = L.portrait;
    roundRect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 9 * k);
    ctx.fillStyle = 'rgba(18,16,46,0.91)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.92)'; ctx.lineWidth = 1.8; ctx.stroke();
    const shown = s.tipShownText, x = b.x + L.pad;
    if (L.inline) {
      this._text(ctx, L.who, x, b.y + b.h / 2 + 0.5, { px: L.px, color: 'rgb(255,214,120)' });
      this._text(ctx, shown, x + L.nameW, b.y + b.h / 2 + 0.5, { px: L.px, color: 'white', weight: 400 });
    } else {
      this._text(ctx, L.who, x, b.y + 7 * k + L.px * 0.65, { px: L.px, color: 'rgb(255,214,120)' });
      const shownLines = this._wrapLines(ctx, s.tipText, b.w - L.pad * 2, L.px, 400);
      let used = 0;   // only the characters written so far are shown, on the lines they will be wrapped to
      ctx.font = '400 ' + L.px + 'px ' + FONT; ctx.fillStyle = 'white'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      shownLines.forEach((line, i) => {
        const take = Math.max(0, Math.min(line.length, shown.length - used));
        used += line.length + (isCjk() ? 0 : 1);
        if (take > 0) ctx.fillText(line.substring(0, take), x, b.y + 7 * k + L.px * 1.3 + 2 * k + i * L.lh);
      });
    }
    if (s.isTipCoins && !s.tipTyping && (Math.trunc(performance.now() / 450)) % 2 === 0) {   // a blinking "click to continue" arrow
      const ax = b.x + b.w - 18 * k, ay = b.y + b.h - 12 * k, sz = 5 * k;
      ctx.fillStyle = 'rgb(255,214,120)';
      ctx.beginPath(); ctx.moveTo(ax - sz, ay - sz * 0.6); ctx.lineTo(ax + sz, ay - sz * 0.6); ctx.lineTo(ax, ay + sz * 0.8); ctx.closePath(); ctx.fill();
    }

    // The Old Man himself, facing the potion button, bobbing a little as he talks.
    roundRect(ctx, p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1, 10 * k);
    ctx.fillStyle = 'rgba(18,16,46,0.91)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.92)'; ctx.lineWidth = 1.8; ctx.stroke();
    const sp = Sprites.oldMan, f = L.factor, dw = sp.w * f, dh = sp.h * f;
    const bob = s.tipTyping && (Math.trunc(performance.now() / 140) % 2 === 0) ? Math.max(1, Math.trunc(f / 2)) : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sp.la, Math.round(p.x + (p.w - dw) / 2), Math.round(p.y + p.h - 5 * k - dh - bob), dw, dh);
    ctx.restore();
  }

  /** Where the picked hero's portrait and the LEVEL UP button go: a column in the middle of the scene, sitting just above the party's
   *  heads (the portrait only when there is room for it above the button, under the heading). */
  _levelLayout() {
    const k = this._uiScale(640);
    const bw = Math.trunc(150 * k), bh = Math.trunc(34 * k), pw = Math.trunc(84 * k), ph = Math.trunc(70 * k), gap = Math.trunc(8 * k);
    const top = Math.trunc(36 * k);                                       // under the heading
    const bottom = Math.trunc(this.scene.partyTopPixel()) - Math.trunc(6 * k);   // over the party's heads
    const by = Math.max(top, bottom - bh - 30);   // (30 px higher than flush with the heads)
    const py = by - gap - ph;
    return {
      levelUp: { x: Math.trunc((this.width - bw) / 2), y: by, w: bw, h: bh },
      portrait: py >= top ? { x: Math.trunc((this.width - pw) / 2), y: py, w: pw, h: ph } : null,
      k: k
    };
  }

  _drawLevelSelect(ctx) {
    // The heroes themselves glow in the scene (the colour of the Fantasy Crystal); this is the heading, the picked hero held up above
    // the party, and the LEVEL UP button that confirms it (dull until someone is picked).
    const s = this.scene;
    const { levelUp, portrait, k } = this._levelLayout();
    const picked = s.selected >= 0 && s.selected < s.party.length;
    const kind = picked ? s.party[s.selected] : null;
    this._banner(ctx, k, picked
      ? t('Level up {name} to Lv. {n}?', { name: t(PARTY_NAMES[kind]), n: s.levelOf(kind) + 1 })
      : t('Give the crystal to someone in your party'), false);
    if (picked && portrait) {
      roundRect(ctx, portrait.x + 0.5, portrait.y + 0.5, portrait.w - 1, portrait.h - 1, 10 * k);
      ctx.fillStyle = 'rgba(18,26,66,0.92)'; ctx.fill();
      ctx.strokeStyle = 'rgb(150,210,255)'; ctx.lineWidth = 2.2; ctx.stroke();
      const sp = Sprites.party[kind];
      const room = portrait.h - 22 * k;
      const factor = Math.max(1, Math.trunc(room / sp.h));
      const pw = sp.w * factor, ph = sp.h * factor;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sp.a, portrait.x + Math.trunc((portrait.w - pw) / 2), portrait.y + Math.trunc(6 * k) + Math.trunc((room - ph) / 2), pw, ph);
      this._text(ctx, t('Lv. {n}', { n: s.levelOf(kind) }) + '  >  ' + t('Lv. {n}', { n: s.levelOf(kind) + 1 }),
        portrait.x + portrait.w / 2, portrait.y + portrait.h - 10 * k, { px: 8.5 * PT * k, color: 'rgb(190,226,255)', align: 'center' });
    }
    const ready = picked;
    const hot = this.hover.levelUp && ready;
    roundRect(ctx, levelUp.x + 0.5, levelUp.y + 0.5, levelUp.w - 1, levelUp.h - 1, 8 * k);
    const grad = ctx.createLinearGradient(0, levelUp.y, 0, levelUp.y + levelUp.h);
    if (!ready) { grad.addColorStop(0, 'rgba(70,74,96,0.59)'); grad.addColorStop(1, 'rgba(44,46,64,0.59)'); }
    else if (hot) { grad.addColorStop(0, 'rgb(255,232,130)'); grad.addColorStop(1, 'rgb(236,160,40)'); }
    else { grad.addColorStop(0, 'rgb(255,206,80)'); grad.addColorStop(1, 'rgb(220,130,24)'); }
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = ready ? 'rgb(255,244,190)' : 'rgba(120,126,150,0.63)'; ctx.lineWidth = ready ? 2 : 1.2; ctx.stroke();
    this._text(ctx, t('LEVEL UP'), levelUp.x + levelUp.w / 2, levelUp.y + levelUp.h / 2 + 0.5, { px: 11 * PT * k, weight: 700, color: ready ? 'rgb(70,36,8)' : 'rgb(150,160,176)', align: 'center' });
  }

  // ---- Input ---------------------------------------------------------------------------------------------------------

  _point(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _inRect(p, r) { return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; }

  _inTuner(h) {
    if (!this.zoomed) return false;
    const r = this._tunerRect;
    const dx = h.x - (r.x + r.w / 2), dy = h.y - (r.y + r.h / 2);
    return dx * dx + dy * dy <= (r.w / 2) * (r.w / 2);
  }

  _onMove(e) {
    if (this.popupOpen) { this.canvas.style.cursor = 'default'; return; }
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    const s = this.scene;
    if (this._sliderDrag) { this._dragSlider(h); this.canvas.style.cursor = 'pointer'; return; }
    if (s.isTipDialogue) {   // the Old Man's tip: nothing but the potion button answers the pointer
      this._overHot = s.isTipPrompt && this._inHot(h);
      this.canvas.style.cursor = this._overHot || s.isTipCoins ? 'pointer' : 'default';
      return;
    }
    if (s.isInn) {
      if (s.isSwapping) {
        const overCancel = this._inHot(h), member = overCancel ? null : s.memberAt(p.x, p.y);
        s.targetHover = member;
        this._overHot = overCancel;
        this.canvas.style.cursor = overCancel || member ? 'pointer' : 'default';
      } else {
        const b = this._innButtonAt(h);
        const usable = b === 0 ? s.canRest : b === 1 ? s.canReorganize : b === 2;
        this._innHover = b >= 0 && usable ? b : -1;
        this.canvas.style.cursor = this._innHover >= 0 ? 'pointer' : 'default';
      }
      return;
    }
    if (s.isGameOver) {
      this._overStartOver = this._inRect(h, this._startOverRect());
      if (this._overStartOver) { this.canvas.style.cursor = 'pointer'; return; }
    }
    if (s.isPicking) {
      const overCancel = this._inHot(h), mi = overCancel ? -1 : this._multiplierAt(h);
      this._mulHover = mi; this._overHot = overCancel;
      this.canvas.style.cursor = overCancel || mi >= 0 ? 'pointer' : 'default';
      return;
    }
    if (s.isTargeting) {
      const overCancel = this._inHot(h), member = overCancel ? null : s.memberAt(p.x, p.y);
      s.targetHover = member;
      this._overHot = overCancel;
      this.canvas.style.cursor = overCancel || member ? 'pointer' : 'default';
      return;
    }
    const hover = {
      button: this._inRect(h, this._buttonRect),
      settings: this._inRect(h, this._settingsRect),
      restart: this._settingsOpen && this._inRect(h, this._restartItemRect),
      qslider: this._settingsOpen && this._inRect(h, this._settingsLayout().sliderHit),
      qauto: this._settingsOpen && this._inRect(h, this._settingsLayout().auto),
      tuner: this._inTuner(h),
      comp: this.zoomed && this._inRect(h, this._compRect),
      card: -1, tile: -1, levelUp: false
    };
    this._overHot = this._inHot(h);
    this._discHover = this._discOpen ? this._discSlotAt(h) : -1;
    if (s.isShopping) {
      this._shopHover = this._shopHit(p);
      this.canvas.style.cursor = this._shopHover.kind || this._shopInfoId ? 'pointer' : 'default';
      return;
    }
    if (s.starting) {
      s.startHover = s.startCandidateAt(p.x, p.y);
      if (s.startHover >= 0) hover.card = -1;
    }
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) hover.card = i;
    if (s.isLevelSelect) {
      // The crystal is being given: the heroes in the scene glow, and tapping one picks them (then LEVEL UP confirms).
      const b = this._levelLayout(), overButton = this._inRect(p, b.levelUp);
      hover.levelUp = overButton && s.selected >= 0;   // (dull and dead until someone is picked)
      const member = overButton ? null : s.memberAt(p.x, p.y);
      s.targetHover = member;
      if (member) hover.tile = 0;
    }
    this.hover = hover;
    const overCoin = !s.isLevelSelect && !s.isDialogue && !s.isChoosing && s.isCoinAt(p.x, p.y);
    this.canvas.style.cursor = hover.button || hover.settings || hover.restart || hover.qslider || hover.qauto || hover.tuner || hover.comp || this._overHot || this._discHover >= 0 || hover.card >= 0 || hover.tile >= 0 || hover.levelUp || overCoin ? 'pointer' : 'default';
  }

  _onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.host.unlockAudio && this.host.unlockAudio();
    if (this.popupOpen) return;
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    const s = this.scene;
    if (s.isTipDialogue) {
      // Every other tap is blocked. The first tip goes on only with a tap on the potion button (a plain tap: no holding for the disc, so
      // the potion can't be swapped); the second reads on with a tap anywhere.
      if (s.isTipPrompt) { if (this._inHot(h)) { s.tipUsePotion(); this._overHot = false; this._hotDown = false; } }
      else s.advanceTip();
      return;
    }
    if (s.isInn) {
      if (s.isSwapping) {   // tap two heroes to swap them; the cross, or a tap anywhere else, backs out
        if (this._inHot(h)) s.innCancel();
        else { const who = s.memberAt(p.x, p.y); if (who) s.innPick(who); else s.innCancel(); }
        this._overHot = false;
      } else {
        const b = this._innButtonAt(h);
        if (b === 0) s.innRest(); else if (b === 1) s.innReorganize(); else if (b === 2) s.innLeave();
        this._innHover = -1;
      }
      return;
    }
    if (s.isGameOver && this._inRect(h, this._startOverRect())) {
      this._overStartOver = false;
      this.host.startOver && this.host.startOver();   // no confirmation: the adventure is already over
      return;
    }
    if (s.isPicking) {   // tap 1X to 5X; the cross, or a tap anywhere else, puts it back
      const mi = this._inHot(h) ? -1 : this._multiplierAt(h);
      if (mi >= 0) s.chooseMultiplier(mi + 1); else s.cancelTargeting();
      this._overHot = false; this._hotDown = false; this._mulHover = -1;
      return;
    }
    if (s.isTargeting) {   // tap a member to use the item on them; the cross, or a tap anywhere else, puts it back
      const who = this._inHot(h) ? null : s.memberAt(p.x, p.y);
      if (who) s.chooseTarget(who); else s.cancelTargeting();
      this._overHot = false; this._hotDown = false;
      return;
    }
    if (s.isShopping) {   // the shop is modal
      if (this._shopInfoId) { this._shopInfoId = null; return; }   // any tap closes the description
      const hit = this._shopHit(p), L = this._shopLayout();
      if (hit.kind === 1) s.buyItem(L.rows[hit.row].id);
      else if (hit.kind === 2) this._shopInfoId = L.rows[hit.row].id;
      else if (hit.kind === 3) { this._shopHover = null; s.leaveShop(); }
      return;
    }
    if (this._settingsOpen) {
      const SL = this._settingsLayout();   // (the menu stays open to show a change)
      if (this._inRect(h, SL.sliderHit)) {
        this._sliderDrag = true;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* a drag still works while the pointer stays over the canvas */ }
        this._dragSlider(h);
        return;
      }
      if (this._inRect(h, SL.auto)) { this.setAuto(this._qMode !== 'auto'); Sound.play('DiscClick'); return; }
      if (this._inRect(h, this._restartItemRect)) { this._settingsOpen = false; this.hover.restart = false; this.host.restartRequested && this.host.restartRequested(); return; }
      if (this._inRect(h, this._settingsMenuRect)) return;   // the menu's own heading and gaps do nothing
      if (!this._inRect(h, this._settingsRect)) { this._settingsOpen = false; return; }   // a click elsewhere just closes it
    }
    if (this._inRect(h, this._settingsRect)) { this._settingsOpen = !this._settingsOpen; Sound.play('DiscClick'); return; }
    if (this._discOpen) return;   // a tap on the disc is settled when the pointer comes up
    if (this._inHot(h)) { this._hotDown = true; this._hotDownAt = performance.now(); this._discByPress = false; return; }
    if (s.starting) {
      const sc = s.startCandidateAt(p.x, p.y);   // tapping a hero at the fire picks them (the cards need room a short view hasn't got)
      if (sc >= 0) { s.choose(sc); this.hover.card = -1; return; }
    }
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) { s.choose(i); this.hover.card = -1; return; }
    if (this._inTuner(h)) { this.host.openTuner && this.host.openTuner(); return; }
    if (this.zoomed && this._inRect(h, this._compRect)) { this.host.openCompendium && this.host.openCompendium(); return; }
    if (this._inRect(h, this._buttonRect)) { this.host.toggleFullscreen && this.host.toggleFullscreen(); return; }

    if (s.isLevelSelect) {
      const b = this._levelLayout();
      if (this._inRect(p, b.levelUp)) { if (s.selected >= 0 && s.confirmLevelUp()) { this.hover.levelUp = false; s.targetHover = null; } }
      else { const who = s.memberAt(p.x, p.y); if (who) s.pickMember(who); }
    } else if (s.isDialogue) s.advanceDialogue();
    else if (s.isLevelFx) s.skipLevelFx();
    else if (!s.isChoosing) s.collectCoinAt(p.x, p.y);
  }
}
