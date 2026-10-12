// The scene's canvas: the frame loop, the HUD (calendar, gold, satchel, buttons), the tavern cards, dialogue and level-up screens, the
// summoning effect and mouse/touch input. A port of src\VisualizerControl.cs; the popups (tuner, compendium) are page elements (ui.js).

import { DESIGN_HEIGHT } from './scene.js';
import { Sprites, PARTY_NAMES } from './sprites.js';
import { roundRect, SummonEffect } from './summon.js';
import { traitSummary } from './traits.js';
import { css } from './util.js';

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
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });

    canvas.addEventListener('pointermove', e => this._onMove(e));
    canvas.addEventListener('pointerleave', () => { this.hover = { button: false, restart: false, tuner: false, comp: false, card: -1, tile: -1, levelUp: false }; canvas.style.cursor = 'default'; });
    canvas.addEventListener('pointerdown', e => this._onDown(e));
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
    if (this._restartVisible) this._drawRestartButton(ctx);
    this._drawDayCounter(ctx);
    this._drawGoldCounter(ctx);
    this._drawStorageChip(ctx);
    this._drawNowPlaying(ctx);
    this._drawTunerButton(ctx);
    this._drawCompendiumButton(ctx);
    ctx.restore();
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

  _dayPillRect(ctx) {
    const left = 'Year ' + this.scene.year + '  Day ' + this.scene.dayOfYear + '   ';
    const px = 9.5 * PT;
    const leftW = this._measure(ctx, left, px);
    let seasonW = 0;
    for (const n of ['Spring', 'Summer', 'Fall', 'Winter']) seasonW = Math.max(seasonW, this._measure(ctx, n, px));
    return { x: 8, y: 8, w: Math.round(leftW + seasonW + 24), h: 26, leftW: leftW, seasonW: seasonW };
  }
  _goldRect(ctx) {
    const textW = this._measure(ctx, this.scene.gold.toLocaleString('en-US'), 10.5 * PT);
    const d = this._dayPillRect(ctx);
    return { x: d.x + d.w + 8, y: 8, w: Math.max(62, Math.round(36 + textW + 10)), h: 26 };
  }
  _storageRect(ctx) {
    const textW = this._measure(ctx, '+' + this.scene.itemStorage, 9.5 * PT);
    const g = this._goldRect(ctx);
    return { x: g.x + g.w + 8, y: 8, w: Math.round(8 + 16 + 6 + textW + 10), h: 26 };
  }
  _hudRightPx(ctx) {
    const r = this.scene.itemStorage > 0 ? this._storageRect(ctx) : this._goldRect(ctx);
    let right = r.x + r.w + 10;
    const np = this._npRect(ctx);
    if (np && !np.second) right = Math.max(right, np.x + np.w + 10);
    return Math.trunc(right * this.hud);
  }

  // ---- The now-playing pill (full screen only: the page already shows these in its own controls) ---------------

  _np() {
    if (!this.fullscreen || !this.host.nowPlaying) return null;
    const n = this.host.nowPlaying();
    if (!n || (!n.station && !n.title)) return null;
    return n;
  }

  _npFont(px, bold, italic) { return (italic ? 'italic ' : '') + (bold ? '700' : '400') + ' ' + px + 'px ' + FONT; }

  /** The pill sits right after the item storage chip when there is room on the first row, else on a row of its own below. */
  _npRect(ctx) {
    const n = this._np();
    if (!n) return null;
    const px = 9.5 * PT;
    ctx.font = this._npFont(px, true, false); const sw = n.station ? Math.ceil(ctx.measureText(n.station).width) : 0;
    ctx.font = this._npFont(px, false, true); const tw = n.title ? Math.ceil(ctx.measureText(n.title).width) : 0;
    const ICON = 30, GAP = 18, PADR = 12;
    const natural = ICON + sw + (n.station && n.title ? GAP : 0) + tw + PADR;
    const s = this.scene.itemStorage > 0 ? this._storageRect(ctx) : this._goldRect(ctx);
    const left = s.x + s.w + 8, maxRight = this._compRect.x - 8;
    const avail = maxRight - left;
    if (avail >= Math.min(natural, 200)) return { x: left, y: 8, w: Math.min(natural, avail), h: 26, second: false, n: n, sw: sw, px: px };
    return { x: 8, y: 8 + 26 + 8, w: Math.min(natural, Math.max(200, this.vw - 16)), h: 26, second: true, n: n, sw: sw, px: px };
  }

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
    const left = this._hudRightPx(ctx), right = this.width - (this.zoomed ? 78 : 44) * this.hud;
    let x = Math.trunc((this.width - w) / 2);
    if (x + w > right) x = right - w;
    if (x < left) x = left;
    return x;
  }
  get _buttonRect() { return { x: this.vw - 34, y: 8, w: 26, h: 26 }; }
  get _compRect() { return { x: this.vw - 34 - 34, y: 8, w: 26, h: 26 }; }
  get _tunerRect() { return { x: this.vw - 8 - 52, y: this.vh - 8 - 52, w: 52, h: 52 }; }
  get _restartRect() { return { x: 8, y: this.vh - 34, w: 66, h: 26 }; }
  get _restartVisible() { return !this.scene.isLevelSelect; }

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

  _drawRestartButton(ctx) {
    const r = this._restartRect, hot = this.hover.restart;
    this._pill(ctx, r.x, r.y, r.w, r.h, 5, rgba(12, 16, 44, hot ? 0.75 : 0.47), rgba(210, 224, 255, hot ? 1 : 0.67));
    this._text(ctx, 'Restart', r.x + r.w / 2, r.y + r.h / 2 + 0.5, { px: 8.5 * PT, color: 'white', align: 'center' });
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
    if (hot) this._tip(ctx, 'Tuner: music & radio stations', r.x - 10, r.y + r.h / 2);
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

  _tip(ctx, text, rightX, midY) {
    const px = 8.5 * PT;
    const w = Math.round(this._measure(ctx, text, px)) + 20;
    this._pill(ctx, rightX - w, midY - 12, w, 24, 6, 'rgba(22,18,52,0.84)', 'rgba(255,214,120,0.9)');
    this._text(ctx, text, rightX - w / 2, midY + 0.5, { px: px, color: 'white', align: 'center' });
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

  // ---- Story UI: tavern cards, dialogue, level-up ----------------------------------------------------------------

  _uiScale(designWidth) {
    const k = Math.max(1.0, Math.min(2.2, this.height / 130.0));
    return Math.min(k, (this.width - 24.0) / designWidth);
  }
  _cardScale() {
    const k = Math.max(1.0, Math.min(2.2, this.height / 130.0));
    return Math.min(k, (this.width - 40.0) / 660.0);
  }

  _cardRects() {
    const s = this.scene;
    if (!s.isChoosing || !s.offer) return [];
    const k = this._cardScale();
    if (k < 0.5) return [];
    const cw = Math.trunc(216 * k), ch = Math.trunc(96 * k), gap = Math.trunc(228 * k);
    const top = Math.trunc(34 * k);
    const cx = Math.trunc(this.width / 2);
    const rects = [{ x: cx - Math.trunc(gap / 2) - cw, y: top, w: cw, h: ch }];
    if (s.offer.length > 1) rects.push({ x: cx + Math.trunc(gap / 2), y: top, w: cw, h: ch });
    return rects;
  }

  _banner(ctx, k, title, centered) {
    const px = 10.5 * PT * k;
    const tw = this._measure(ctx, title, px);
    const pw = Math.round(tw + 28 * k), ph = Math.round(px + 6 * k + 4);
    const x = centered ? Math.round((this.width - pw) / 2) : this._topPillX(ctx, pw);
    const y = centered ? Math.round((this.height - ph) / 2) : Math.trunc(5 * k);
    this._pill(ctx, x, y, pw, ph, ph / 2, 'rgba(22,18,52,0.84)', 'rgba(255,214,120,0.9)', 1.5);
    this._text(ctx, title, x + pw / 2, y + ph / 2 + 0.5, { px: px, color: 'white', align: 'center' });
  }

  _drawEncounter(ctx) {
    const rects = this._cardRects();
    if (rects.length === 0) return;
    const s = this.scene, k = this._cardScale();
    const title = s.offer.length === 1 ? 'A tavern! Your last companion is waiting.' : 'A tavern! Who joins the party?';
    this._banner(ctx, k, title, false);
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
      restart: this._restartVisible && this._inRect(h, this._restartRect),
      tuner: this._inTuner(h),
      comp: this.zoomed && this._inRect(h, this._compRect),
      card: -1, tile: -1, levelUp: false
    };
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) hover.card = i;
    if (s.isLevelSelect) {
      const t = this._tileRects();
      for (let i = 0; i < t.tiles.length; i++) if (this._inRect(p, t.tiles[i])) hover.tile = i;
      hover.levelUp = this._inRect(p, t.levelUp) && s.selected >= 0;
    }
    this.hover = hover;
    const overCoin = !s.isLevelSelect && !s.isDialogue && !s.isChoosing && s.isCoinAt(p.x, p.y);
    this.canvas.style.cursor = hover.button || hover.restart || hover.tuner || hover.comp || hover.card >= 0 || hover.tile >= 0 || hover.levelUp || overCoin ? 'pointer' : 'default';
  }

  _onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.host.unlockAudio && this.host.unlockAudio();
    if (this.popupOpen) return;
    const p = this._point(e);
    const h = { x: p.x / this.hud, y: p.y / this.hud };
    const s = this.scene;
    const cards = this._cardRects();
    for (let i = 0; i < cards.length; i++) if (this._inRect(p, cards[i])) { s.choose(i); this.hover.card = -1; return; }
    if (this._inTuner(h)) { this.host.openTuner && this.host.openTuner(); return; }
    if (this.zoomed && this._inRect(h, this._compRect)) { this.host.openCompendium && this.host.openCompendium(); return; }
    if (this._restartVisible && this._inRect(h, this._restartRect)) { this.host.restartRequested && this.host.restartRequested(); return; }
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
