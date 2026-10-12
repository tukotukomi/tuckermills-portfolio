// The scene's canvas: the frame loop, the HUD (calendar, gold, satchel, buttons), the tavern cards, dialogue and level-up screens, the
// summoning effect and mouse/touch input. A port of src\VisualizerControl.cs; the popups (tuner, compendium) are page elements (ui.js).

import { DESIGN_HEIGHT } from './scene.js';
import { Sprites, PARTY_NAMES } from './sprites.js';
import { roundRect, SummonEffect } from './summon.js';
import { traitSummary } from './traits.js';
import { css } from './util.js';
import { Sound } from './sfx.js';
import { ITEM_DEFS, HOT_SLOT_COUNT } from './items.js';

export const ZOOMED_SCALE = 5;

// On a phone or tablet the adventure only progresses while the page is on screen: backgrounded or with the screen locked, the radio
// plays on but the game waits (desktop browsers keep their own rules: a visible window keeps going).
export const IS_MOBILE = (() => {
  try {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)   // iPadOS reports itself as a Mac
      || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(hover: hover)').matches);
  } catch (e) { return false; }
})();
const BLURB = {
  thief: 'Quick, quiet and always one step ahead.',
  warrior: 'A stalwart front-liner who never backs down.',
  lightmage: 'Keeps the whole party hale and humming.',
  firemage: 'A short fuse and a flair for the dramatic.',
  fae: 'A glimmering lucky charm who never tires.',
  paca: 'Fast, loyal and always out front.',
};
const FONT = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';
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
    this._discHover = -1; this._overHot = false; this._overBuy = false; this._overLeave = false;
    this._settingsOpen = false;   // the cog's menu
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });

    canvas.addEventListener('pointermove', e => this._onMove(e));
    canvas.addEventListener('pointerleave', () => { this.hover = { button: false, restart: false, tuner: false, comp: false, card: -1, tile: -1, levelUp: false }; canvas.style.cursor = 'default'; });
    canvas.addEventListener('pointerdown', e => this._onDown(e));
    canvas.addEventListener('pointerup', e => this._onUp(e));
    canvas.addEventListener('pointercancel', () => { this._hotDown = false; });
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
    const dpr = window.devicePixelRatio || 1;
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
      return Math.max(2, Math.min(want, Math.floor(this.width / 150)));
    }
    return Math.max(1, Math.floor(this.height / DESIGN_HEIGHT));
  }
  get vw() { return this.width / this.hud; }
  get vh() { return this.height / this.hud; }

  _frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this._frame);
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
    if (this._hotDown && !this._discOpen && performance.now() - this._hotDownAt >= 450) {   // held: the disc of four
      this._discOpen = true; this._discByPress = true;
      Sound.play('DiscClick');
    }
    this._draw(now / 1000);
  }

  // ---- Drawing -------------------------------------------------------------------------------------------

  _draw(timeSeconds) {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);

    const scale = this.sceneScale;
    const sc = this.scene.render(w, h, scale);
    ctx.drawImage(sc, 0, h - sc.height * scale, sc.width * scale, sc.height * scale);

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
    this._drawNowPlaying(ctx);
    this._drawTunerButton(ctx);
    this._drawCompendiumButton(ctx);
    this._drawHotButton(ctx);
    this._drawDisc(ctx);
    this._drawSettingsMenu(ctx);
    ctx.restore();
    this._drawShop(ctx);
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
    const leftW = this._measure(ctx, 'Year ' + this.scene.year + '  Day ' + this.scene.dayOfYear + '   ', px);
    let seasonW = 0;
    for (const n of ['Spring', 'Summer', 'Fall', 'Winter']) seasonW = Math.max(seasonW, this._measure(ctx, n, px));
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
    const L = { day: Object.assign(place(day.w), { leftW: day.leftW, seasonW: day.seasonW }), gold: null, storage: null, np: null };
    const goldW = Math.max(62, Math.round(36 + this._measure(ctx, this.scene.gold.toLocaleString('en-US'), 10.5 * PT) + 10));
    L.gold = place(goldW);
    if (this.scene.itemStorage > 0) L.storage = place(Math.round(8 + 16 + 6 + this._measure(ctx, '+' + this.scene.itemStorage, 9.5 * PT) + 10));
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

  _dayPillRect(ctx) { return this._hudLayout(ctx).day; }
  _goldRect(ctx) { return this._hudLayout(ctx).gold; }
  _storageRect(ctx) { return this._hudLayout(ctx).storage; }

  /** The left edge of the free space along the top: clear of every pill that sits on the first row. */
  _hudRightPx(ctx) {
    const L = this._hudLayout(ctx);
    let right = L.day.x + L.day.w;
    for (const r of [L.gold, L.storage, L.np]) if (r && r.y === 8) right = Math.max(right, r.x + r.w);
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
  get _settingsMenuRect() { const c = this._settingsRect; return { x: c.x + c.w - 118, y: c.y + c.h + 6, w: 118, h: 38 }; }
  get _restartItemRect() { const m = this._settingsMenuRect; return { x: m.x + 4, y: m.y + 4, w: m.w - 8, h: 30 }; }

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
    if (this.hover.restart) this._pill(ctx, item.x, item.y, item.w, item.h, 5, 'rgba(90,70,150,0.47)');
    this._text(ctx, 'Restart', item.x + item.w / 2, item.y + item.h / 2 + 0.5, { px: 9.5 * PT, color: 'white', align: 'center' });
  }

  _drawDayCounter(ctx) {
    const s = this.scene;
    const season = s.seasonName;
    const seasonColor = season === 'Spring' ? 'rgb(166,230,150)' : season === 'Summer' ? 'rgb(255,220,110)' : season === 'Fall' ? 'rgb(246,156,76)' : 'rgb(176,218,255)';
    const r = this._dayPillRect(ctx);
    this._pill(ctx, r.x, r.y, r.w, r.h, 6, rgba(12, 16, 44, 0.59), rgba(210, 224, 255, 0.78));
    const left = 'Year ' + s.year + '  Day ' + s.dayOfYear + '   ';
    this._text(ctx, left, r.x + 12, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: 'white' });
    this._text(ctx, season, r.x + 12 + r.leftW, r.y + r.h / 2 + 0.5, { px: 9.5 * PT, color: seasonColor });
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
    if (hot) this._tip(ctx, 'Tuner: music & radio stations', r.x + r.w + 10, r.y + r.h / 2, true);
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
    if (hot) this._tip(ctx, 'Monster Compendium', r.x - 8, r.y + r.h / 2);
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
    const px = Math.round(11 * PT * this.hud);
    for (const t of this.scene.textOverlays()) {
      if (t.alpha <= 0.01) continue;
      const a = Math.min(1, t.alpha);
      ctx.font = '700 ' + px + 'px ' + FONT;
      const tw = ctx.measureText(t.text).width;
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
        ctx.fillStyle = 'rgba(10,24,16,0.75)'; ctx.fillText(t.text, t.x + 1, t.y + 1);
        ctx.fillStyle = css(t.color); ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }
    }
  }

  _drawCampHint(ctx) {
    const s = this.scene;
    if (!s.atCamp || this.width < 560 || s.isDialogue || s.isLevelSelect || s.isChoosing) return;
    const text = 'Resting at camp: play a radio stream to keep adventuring';
    const px = 9 * PT;
    const tw = Math.round(this._measure(ctx, text, px));
    const w = tw + 28, h = px + 12;
    const x = Math.round((this.width - w) / 2), y = Math.round((this.height - h) / 2);
    this._pill(ctx, x, y, w, h, h / 2, 'rgba(26,16,40,0.67)', 'rgba(255,170,90,0.82)', 1.3);
    this._text(ctx, text, x + w / 2, y + h / 2 + 0.5, { px: px, color: 'rgb(255,226,190)', align: 'center' });
  }

  // ---- Items: the hot item button, its disc menu, and the Merchant's shop --------------------------------------------

  get _hotRect() { return { x: 8, y: Math.trunc(this.vh / 2) - 22, w: 44, h: 44 }; }   // middle of the left edge
  get _hotVisible() { return this.zoomed && !this.scene.isShopping; }
  get _discCenter() { return { x: 6 + 44 + 19, y: this._hotRect.y + 22 }; }   // the disc opens inward, to the right of the button

  _discSlotCenter(i) {
    const c = this._discCenter;
    return [{ x: c.x, y: c.y - 44 }, { x: c.x + 44, y: c.y }, { x: c.x, y: c.y + 44 }, { x: c.x - 44, y: c.y }][i];
  }

  _discSlotAt(h) {
    for (let i = 0; i < HOT_SLOT_COUNT; i++) {
      const c = this._discSlotCenter(i), dx = h.x - c.x, dy = h.y - c.y;
      if (dx * dx + dy * dy <= 22 * 22) return i;
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
    if (this._settingsOpen) { this._settingsOpen = false; return true; }
    if (this._discOpen) { this._discOpen = false; this._hotDown = false; return true; }
    if (this.scene.isShopping) { this.scene.leaveShop(); return true; }
    return false;
  }

  _onUp(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this.popupOpen) return;
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    if (this._discOpen) {
      const slot = this._discSlotAt(h);
      const opened = this._discByPress;
      this._discByPress = false;
      this._hotDown = false;
      if (slot >= 0) { this.scene.selectHot(slot); this._discOpen = false; }
      else if (!opened) this._discOpen = false;   // a tap outside the disc closes it; released after the long press it stays up to be tapped
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
    const s = n > 99 ? '99+' : String(n);
    const px = 8.5 * PT;
    const tw = this._measure(ctx, s, px);
    const w = Math.round(tw + 8), x = right - w, y = bottom - 14;
    this._pill(ctx, x, y, w, 14, 6, 'rgba(22,18,52,0.92)', 'rgba(255,214,120,0.86)', 1);
    this._text(ctx, s, x + w / 2, y + 7.5, { px: px, color: n > 0 ? 'white' : 'rgb(255,150,140)', align: 'center' });
  }

  _drawHotButton(ctx) {
    if (!this._hotVisible) return;
    const r = this._hotRect, hot = this._overHot || this._hotDown;
    const s = this.scene, id = s.hotItem, n = s.itemCount(id);
    ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, (r.w - 1) / 2, 0, Math.PI * 2);
    ctx.fillStyle = rgba(12, 16, 44, hot ? 0.75 : 0.47); ctx.fill();
    ctx.strokeStyle = hot ? 'rgb(255,214,120)' : rgba(210, 224, 255, 0.75); ctx.lineWidth = 1.6; ctx.stroke();
    this._drawItemIcon(ctx, id, r.x + r.w / 2, r.y + r.h / 2, 2, n <= 0);
    this._drawCountBadge(ctx, n, r.x + r.w + 2, r.y + r.h + 2);
    if (this._overHot && !this._discOpen) this._tip(ctx, 'Tap: use   Hold: switch', r.x + r.w + 10, r.y + r.h / 2, true);
  }

  _drawDisc(ctx) {
    if (!this._discOpen || !this._hotVisible) return;
    const c = this._discCenter, outer = 44 + 19 + 6;
    const s = this.scene, hot = s.hotItems();
    ctx.beginPath(); ctx.arc(c.x, c.y, outer, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,16,46,0.84)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.8; ctx.stroke();
    for (let i = 0; i < HOT_SLOT_COUNT; i++) {
      const sc = this._discSlotCenter(i), selected = i === s.hotSelected, hover = i === this._discHover;
      ctx.beginPath(); ctx.arc(sc.x, sc.y, 19, 0, Math.PI * 2);
      ctx.fillStyle = hover ? 'rgba(52,48,110,0.92)' : 'rgba(26,28,74,0.75)'; ctx.fill();
      ctx.strokeStyle = selected ? 'rgb(255,214,120)' : hover ? 'white' : 'rgba(170,186,240,0.67)'; ctx.lineWidth = selected ? 2.4 : 1.4; ctx.stroke();
      const n = s.itemCount(hot[i]);
      this._drawItemIcon(ctx, hot[i], sc.x, sc.y, 2, n <= 0);
      this._drawCountBadge(ctx, n, sc.x + 22, sc.y + 22);
    }
    // The hub shows what is selected, with a name above the disc.
    const cur = s.hotItem;
    ctx.beginPath(); ctx.arc(c.x, c.y, 14, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,18,52,0.86)'; ctx.fill();
    this._drawItemIcon(ctx, cur, c.x, c.y, 1, s.itemCount(cur) <= 0);
    const label = ITEM_DEFS[this._discHover >= 0 ? hot[this._discHover] : cur].name;
    const px = 8.5 * PT, w = Math.round(this._measure(ctx, label, px) + 20);
    const lx = Math.max(6, c.x - w / 2);
    this._pill(ctx, lx, c.y - outer - 30, w, 24, 6, 'rgba(22,18,52,0.88)', 'rgba(255,214,120,0.9)', 1.2);
    this._text(ctx, label, lx + w / 2, c.y - outer - 30 + 12.5, { px: px, color: 'white', align: 'center' });
  }

  // The shop panel (screen pixels, like the tavern's cards).

  _shopScale() { return Math.min(Math.max(1.0, Math.min(2.0, this.height / 300.0)), (this.width - 24.0) / 400.0); }

  _shopRect() {
    const k = this._shopScale(), w = Math.trunc(400 * k), h = Math.trunc(200 * k);
    return { x: Math.trunc((this.width - w) / 2), y: Math.trunc((this.height - h) / 2), w: w, h: h, k: k };
  }

  _shopButtons() {
    const r = this._shopRect(), k = r.k;
    const bw = Math.trunc(84 * k), bh = Math.trunc(34 * k), x = r.x + r.w - bw - Math.trunc(14 * k);
    return { buy: { x: x, y: r.y + Math.trunc(88 * k), w: bw, h: bh }, leave: { x: x, y: r.y + r.h - bh - Math.trunc(10 * k), w: bw, h: bh } };
  }

  _drawShopButton(ctx, b, text, px, enabled, hot) {
    this._pill(ctx, b.x, b.y, b.w, b.h, b.h / 2,
      enabled ? (hot ? 'rgba(120,86,24,0.94)' : 'rgba(90,62,16,0.9)') : 'rgba(40,40,56,0.8)',
      enabled ? 'rgb(255,214,120)' : 'rgba(120,120,150,0.63)', 1.6);
    this._text(ctx, text, b.x + b.w / 2, b.y + b.h / 2 + 0.5, { px: px, color: enabled ? 'white' : 'rgb(170,170,190)', align: 'center' });
  }

  _drawShop(ctx) {
    const s = this.scene;
    if (!s.isShopping) return;
    const r = this._shopRect(), k = r.k, id = 'SynergyElixir', def = ITEM_DEFS[id];
    ctx.fillStyle = 'rgba(0,0,0,0.47)'; ctx.fillRect(0, 0, this.width, this.height);
    this._pill(ctx, r.x, r.y, r.w, r.h, 10 * k, 'rgba(24,20,58,0.94)', 'rgb(255,214,120)', 2.2);
    const nameFont = 10.5 * PT * k, small = 8.5 * PT * k;
    this._text(ctx, 'Merchant', r.x + 14 * k, r.y + 21 * k, { px: 12 * PT * k, color: 'rgb(255,226,150)' });
    // the gold in hand
    const gold = s.gold.toLocaleString('en-US');
    const gw = this._measure(ctx, gold, nameFont);
    this._text(ctx, gold, r.x + r.w - 14 * k - gw, r.y + 21 * k, { px: nameFont, color: 'white' });
    const coin = Sprites.coin, cs = Math.max(1, Math.round(1.5 * k));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(coin, Math.round(r.x + r.w - 14 * k - gw - 6 - coin.width * cs), Math.round(r.y + 21 * k - coin.height * cs / 2), coin.width * cs, coin.height * cs);
    ctx.strokeStyle = 'rgba(170,186,240,0.47)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r.x + 12 * k, r.y + 40 * k + 0.5); ctx.lineTo(r.x + r.w - 12 * k, r.y + 40 * k + 0.5); ctx.stroke();

    // the one thing he sells
    const rowY = r.y + 52 * k;
    this._drawItemIcon(ctx, id, r.x + 38 * k, rowY + 30 * k, Math.max(2, Math.round(3 * k)), false);
    const tx = r.x + 76 * k, tw = r.x + r.w - tx - 110 * k;
    this._text(ctx, def.name, tx, rowY + 11 * k, { px: nameFont, color: 'white' });
    this._wrap(ctx, def.blurb, tx, rowY + 26 * k, tw, small, 'rgb(200,210,245)', 400, 4);
    this._text(ctx, 'In bag: ' + s.itemCount(id), tx, rowY + 90 * k, { px: small, color: 'rgb(255,214,120)', weight: 400 });

    // Buy and Leave
    const b = this._shopButtons(), afford = s.gold >= def.price;
    this._text(ctx, def.price + ' Gold', b.buy.x + b.buy.w / 2, b.buy.y - 14 * k, { px: nameFont, color: afford ? 'rgb(255,226,150)' : 'rgb(255,150,140)', align: 'center' });
    this._drawShopButton(ctx, b.buy, afford ? 'Buy' : 'Need ' + def.price, nameFont, afford, this._overBuy && afford);
    this._drawShopButton(ctx, b.leave, 'Leave', nameFont, true, this._overLeave);
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
    const bannerOf = k => Math.round(10.5 * PT * k + 6 * k + 4);
    const k0 = Math.max(1.0, Math.min(2.2, this.height / 130.0));
    const kSide = Math.min(k0, (this.width - 40.0) / 660.0);
    let k, stacked = false;
    if (kSide >= 0.85) k = kSide;
    else {
      stacked = true;
      k = Math.min(1.6, (this.width - 24.0) / 216.0);
      const fit = kk => bannerOf(kk) + Math.trunc(10 * kk) + n * Math.trunc(96 * kk) + (n - 1) * Math.trunc(10 * kk);
      while (k > 0.5 && fit(k) > this.height - 16) k -= 0.05;
    }
    if (k < 0.5) return out;
    const cw = Math.trunc(216 * k), ch = Math.trunc(96 * k), gap = Math.trunc(10 * k);
    const bannerH = bannerOf(k);
    const total = bannerH + gap + (stacked ? n * ch + (n - 1) * gap : ch);
    const bannerY = Math.max(Math.trunc(5 * k), Math.trunc((this.height - total) / 2));
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
    const title = s.offer.length === 1 ? 'A tavern! Your last companion is waiting.' : 'A tavern! Who joins the party?';
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
      this._text(ctx, PARTY_NAMES[kind], tx, r.y + Math.trunc(7 * k) + 9 * k, { px: 10.5 * PT * k, color: hot ? 'rgb(255,226,150)' : 'white' });
      let y = r.y + Math.trunc(7 * k) + 18 * k + 2;
      y = this._wrap(ctx, traitSummary(kind, 1), tx, y, tw, 8 * PT * k, 'rgb(255,214,120)', 600, 2);
      this._wrap(ctx, BLURB[kind], tx, y + 2, tw, 7.5 * PT * k, 'rgb(178,190,232)', 400, 2, 'italic ');
    }
  }

  /** Draws wrapped text (up to maxLines) and returns the y below it. */
  _wrap(ctx, text, x, y, maxW, px, color, weight, maxLines, style) {
    ctx.font = (style || '') + weight + ' ' + px + 'px ' + FONT;
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const lh = px * 1.25;
    for (let i = 0; i < lines.length && i < maxLines; i++) {
      let line = lines[i];
      if (i === maxLines - 1 && lines.length > maxLines) line = line.replace(/\s*\S*$/, '') + '...';
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
      this._text(ctx, who + ':', x, r.y + r.h / 2 + 0.5, { px: px, color: 'rgb(255,214,120)' });
      x += this._measure(ctx, who + ':', px) + 8 * k;
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

  _tileRects() {
    const n = this.scene.party.length;
    const k = this._uiScale(n * 120 + (n - 1) * 8 + 24 + 88);
    const tw = Math.trunc(120 * k), th = Math.trunc(56 * k), gap = Math.trunc(8 * k), bw = Math.trunc(88 * k);
    const total = n * tw + (n - 1) * gap + Math.trunc(24 * k) + bw;
    const x = Math.trunc((this.width - total) / 2), top = Math.trunc(34 * k);
    const tiles = [];
    for (let i = 0; i < n; i++) tiles.push({ x: x + i * (tw + gap), y: top, w: tw, h: th });
    return { tiles: tiles, levelUp: { x: x + n * (tw + gap) - gap + Math.trunc(24 * k), y: top, w: bw, h: th }, k: k };
  }

  _drawLevelSelect(ctx) {
    const s = this.scene;
    const { tiles, levelUp, k } = this._tileRects();
    this._banner(ctx, k, 'Give the crystal to someone in your party', false);
    for (let i = 0; i < tiles.length && i < s.party.length; i++) {
      const r = tiles[i], selected = i === s.selected, hot = i === this.hover.tile, kind = s.party[i];
      roundRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8 * k);
      ctx.fillStyle = selected ? 'rgba(52,52,118,0.96)' : hot ? 'rgba(36,36,84,0.93)' : 'rgba(22,22,60,0.87)'; ctx.fill();
      ctx.strokeStyle = selected ? 'rgb(255,224,120)' : hot ? 'rgb(190,204,255)' : 'rgba(150,168,232,0.75)'; ctx.lineWidth = selected ? 3 : 1.5; ctx.stroke();
      const sp = Sprites.party[kind];
      const factor = Math.max(1, Math.trunc((r.h - 10 * k) / sp.h));
      const pw = sp.w * factor, ph = sp.h * factor;
      const px0 = r.x + Math.trunc(8 * k);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sp.a, px0, r.y + Math.trunc((r.h - ph) / 2), pw, ph);
      const tx = px0 + pw + Math.trunc(6 * k);
      this._text(ctx, PARTY_NAMES[kind], tx, r.y + Math.trunc(8 * k) + 9 * k, { px: 7.5 * PT * k, color: 'white' });
      this._text(ctx, 'Lv. ' + s.levelOf(kind), tx, r.y + Math.trunc(28 * k) + 10 * k, { px: 10 * PT * k, color: 'rgb(255,214,120)' });
    }
    const ready = s.selected >= 0;
    const hotBtn = this.hover.levelUp && ready;
    roundRect(ctx, levelUp.x + 0.5, levelUp.y + 0.5, levelUp.w - 1, levelUp.h - 1, 8 * k);
    const grad = ctx.createLinearGradient(0, levelUp.y, 0, levelUp.y + levelUp.h);
    if (!ready) { grad.addColorStop(0, 'rgba(70,74,96,0.59)'); grad.addColorStop(1, 'rgba(44,46,64,0.59)'); }
    else if (hotBtn) { grad.addColorStop(0, 'rgb(255,232,130)'); grad.addColorStop(1, 'rgb(236,160,40)'); }
    else { grad.addColorStop(0, 'rgb(255,206,80)'); grad.addColorStop(1, 'rgb(220,130,24)'); }
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = ready ? 'rgb(255,244,190)' : 'rgba(120,126,150,0.63)'; ctx.lineWidth = ready ? 2 : 1.2; ctx.stroke();
    this._text(ctx, 'LEVEL UP', levelUp.x + levelUp.w / 2, levelUp.y + levelUp.h / 2 + 0.5, { px: 11 * PT * k, weight: 700, color: ready ? 'rgb(70,36,8)' : 'rgb(150,160,176)', align: 'center' });
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
    const hover = {
      button: this._inRect(h, this._buttonRect),
      settings: this._inRect(h, this._settingsRect),
      restart: this._settingsOpen && this._inRect(h, this._restartItemRect),
      tuner: this._inTuner(h),
      comp: this.zoomed && this._inRect(h, this._compRect),
      card: -1, tile: -1, levelUp: false
    };
    this._overHot = this._inHot(h);
    this._discHover = this._discOpen ? this._discSlotAt(h) : -1;
    if (s.isShopping) {
      const b = this._shopButtons();
      this._overBuy = this._inRect(p, b.buy); this._overLeave = this._inRect(p, b.leave);
      this.canvas.style.cursor = this._overBuy || this._overLeave ? 'pointer' : 'default';
      return;
    }
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) hover.card = i;
    if (s.isLevelSelect) {
      const t = this._tileRects();
      for (let i = 0; i < t.tiles.length; i++) if (this._inRect(p, t.tiles[i])) hover.tile = i;
      hover.levelUp = this._inRect(p, t.levelUp) && s.selected >= 0;
    }
    this.hover = hover;
    const overCoin = !s.isLevelSelect && !s.isDialogue && !s.isChoosing && s.isCoinAt(p.x, p.y);
    this.canvas.style.cursor = hover.button || hover.settings || hover.restart || hover.tuner || hover.comp || this._overHot || this._discHover >= 0 || hover.card >= 0 || hover.tile >= 0 || hover.levelUp || overCoin ? 'pointer' : 'default';
  }

  _onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.host.unlockAudio && this.host.unlockAudio();
    if (this.popupOpen) return;
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    const s = this.scene;
    if (s.isShopping) {   // the shop is modal
      const b = this._shopButtons();
      if (this._inRect(p, b.buy)) s.buyItem('SynergyElixir');
      else if (this._inRect(p, b.leave)) { this._overBuy = false; this._overLeave = false; s.leaveShop(); }
      return;
    }
    if (this._settingsOpen) {
      if (this._inRect(h, this._restartItemRect)) { this._settingsOpen = false; this.hover.restart = false; this.host.restartRequested && this.host.restartRequested(); return; }
      if (!this._inRect(h, this._settingsRect)) { this._settingsOpen = false; return; }   // a click elsewhere just closes it
    }
    if (this._inRect(h, this._settingsRect)) { this._settingsOpen = !this._settingsOpen; Sound.play('DiscClick'); return; }
    if (this._discOpen) return;   // a tap on the disc is settled when the pointer comes up
    if (this._inHot(h)) { this._hotDown = true; this._hotDownAt = performance.now(); this._discByPress = false; return; }
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) { s.choose(i); this.hover.card = -1; return; }
    if (this._inTuner(h)) { this.host.openTuner && this.host.openTuner(); return; }
    if (this.zoomed && this._inRect(h, this._compRect)) { this.host.openCompendium && this.host.openCompendium(); return; }
    if (this._inRect(h, this._buttonRect)) { this.host.toggleFullscreen && this.host.toggleFullscreen(); return; }

    if (s.isLevelSelect) {
      const t = this._tileRects();
      for (let i = 0; i < t.tiles.length; i++) if (this._inRect(p, t.tiles[i])) { s.selectMember(i); return; }
      if (this._inRect(p, t.levelUp) && s.confirmLevelUp()) this.hover.levelUp = false;
    } else if (s.isDialogue) s.advanceDialogue();
    else if (s.isLevelFx) s.skipLevelFx();
    else if (!s.isChoosing) s.collectCoinAt(p.x, p.y);
  }
}
