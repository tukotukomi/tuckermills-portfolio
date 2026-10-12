// The "summoning the radio" effect shown in the middle of the scene while a stream is connecting or buffering. A port of
// src\SummonEffect.cs: a rotating magic circle ringed with crystals, pulses spreading out, notes spiralling up and a little radio
// materialising at the centre, drawn on a 64x64 canvas and enlarged by a whole number so it keeps the scene's chunky pixels.

import { C, CA, Pix } from './util.js';

const SIZE = 64, TAU = Math.PI * 2;
const ARCANE = C(140, 210, 255), GOLD = C(255, 214, 120);

function a(c, alpha) { return { r: c.r, g: c.g, b: c.b, a: Math.max(0, Math.min(255, alpha)) }; }

/** One coloured pixel-art polygon, filled by scanlines (canvas paths would anti-alias). */
function polygon(g, pts, c) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs = [];
    const yy = y + 0.5;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((p[1] <= yy && q[1] > yy) || (q[1] <= yy && p[1] > yy)) xs.push(p[0] + (yy - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) g.rect(Math.round(xs[i]), y, Math.max(1, Math.round(xs[i + 1]) - Math.round(xs[i])), 1, c);
  }
}

function outline(g, pts, c) {
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1]))));
    for (let s = 0; s <= n; s++) g.rect(Math.round(p[0] + (q[0] - p[0]) * s / n), Math.round(p[1] + (q[1] - p[1]) * s / n), 1, 1, c);
  }
}

function arc(g, cx, cy, r, startDeg, sweepDeg, c) {
  const steps = Math.max(4, Math.round(Math.abs(sweepDeg) * r / 40));
  for (let i = 0; i <= steps; i++) {
    const ang = (startDeg + sweepDeg * i / steps) * Math.PI / 180;
    g.rect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1, c);
  }
}

export class SummonEffect {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = SIZE; this.canvas.height = SIZE;
    this.g = new Pix(this.canvas);
  }

  /** Draws the effect centred in a width x height area (screen pixels) of `ctx`. */
  render(ctx, width, height, t, alpha, baseScale, name, uiScale) {
    if (alpha <= 0.01) return;
    this._drawCanvas(t);
    const scale = Math.max(1, Math.min(baseScale, Math.floor((height - 80) / SIZE)));
    const px = SIZE * scale;
    const dx = Math.round((width - px) / 2), dy = Math.round((height - px) / 2);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(this.canvas, dx, dy, px, px);
    ctx.restore();

    // The caption pill under it, with dots that count.
    const dots = Math.trunc(t * 2.5) % 4;
    const who = name ? name : 'the radio';
    const text = 'Summoning ' + who + '.'.repeat(dots);
    const widest = 'Summoning ' + who + '...';
    const fontPx = Math.round(13.3 * (uiScale || 1));
    ctx.save();
    ctx.font = '600 ' + fontPx + 'px "Segoe UI", system-ui, -apple-system, sans-serif';
    const w = Math.round(ctx.measureText(widest).width) + 26, h = fontPx + 10;
    const pillX = dx + (px - w) / 2, pillY = dy + px + 4;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = 'rgba(22,18,52,0.84)';
    roundRect(ctx, pillX, pillY, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.lineWidth = 1.4;
    roundRect(ctx, pillX, pillY, w, h, h / 2); ctx.stroke();
    ctx.fillStyle = 'rgb(255,244,214)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pillX + 13, pillY + h / 2 + 0.5);
    ctx.restore();
  }

  _drawCanvas(t) {
    const g = this.g, c = SIZE / 2;
    g.clear();
    g.ellipse(2, 2, SIZE - 4, SIZE - 4, CA(120, 10, 14, 40));

    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.75 + k / 3.0) % 1.0;
      const r = 7 + Math.trunc(23 * phase);
      g.ring(c - r, c - r, r * 2, r * 2, a(ARCANE, 210 * (1 - phase)));
    }

    const segs = 16, rot = t * 28;
    for (let i = 0; i < segs; i += 2) arc(g, c, c, 28, rot + i * 360 / segs, 360 / segs * 0.8, a(GOLD, 235));
    g.ring(c - 21, c - 21, 42, 42, a(ARCANE, 150));
    for (let i = 0; i < 12; i++) {
      const ang = -t * 0.9 + i * TAU / 12;
      const x = c + Math.round(Math.cos(ang) * 21), y = c + Math.round(Math.sin(ang) * 21);
      g.rect(x - 1, y - 1, 2, 2, i % 3 === 0 ? a(GOLD, 255) : a(ARCANE, 230));
    }

    for (let i = 0; i < 6; i++) this._crystal(g, c, c, t * 0.45 + i * TAU / 6, 15, 1.0 + 0.5 * Math.sin(t * 3 + i * 1.7));

    const gr = 10 + Math.round(Math.sin(t * 4) * 1.5);
    g.ellipse(c - gr, c - gr, gr * 2, gr * 2, CA(120, 200, 230, 255));
    this._radio(g, c, c + Math.round(Math.sin(t * 3) * 1.2), t);

    for (let i = 0; i < 4; i++) {
      const phase = (t * 0.45 + i / 4.0) % 1.0;
      const ang = t * 0.7 + i * TAU / 4;
      const rad = 11 + phase * 17;
      const x = c + Math.round(Math.cos(ang) * rad) - 1;
      const y = c + Math.round(Math.sin(ang) * rad * 0.8) - Math.trunc(phase * 8) - 3;
      this._note(g, x, y, Math.sin(Math.PI * phase));
    }
  }

  _crystal(g, cx, cy, angle, radius, glint) {
    const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
    const mx = cx + ux * radius, my = cy + uy * radius;
    const P = (along, across) => [Math.round(mx + ux * along + vx * across), Math.round(my + uy * along + vy * across)];
    const tip = P(5.5, 0), root = P(-4.5, 0), left = P(0.5, -2.6), right = P(0.5, 2.6);
    polygon(g, [tip, left, root], C(205, 238, 255));
    polygon(g, [tip, right, root], C(86, 148, 232));
    outline(g, [tip, left, root, right], C(38, 74, 160));
    const al = Math.trunc(255 * Math.max(0, Math.min(1, glint - 0.25)));
    if (al > 0) {
      const h = P(0.5, 0);
      g.rect(h[0], h[1] - 1, 1, 3, CA(al, 255, 255, 255));
      g.rect(h[0] - 1, h[1], 3, 1, CA(al, 255, 255, 255));
    }
  }

  _radio(g, cx, cy, t) {
    const x = cx - 6, y = cy - 4;
    const brass = C(222, 178, 84), body = C(118, 76, 36), dark = C(44, 26, 14), grille = C(214, 170, 80), win = C(252, 244, 214), needle = C(200, 40, 30);
    for (let i = 0; i < 4; i++) g.rect(x + 9 + i, y - 1 - i, 1, 1, brass);
    g.rect(x + 12, y - 5, 2, 1, brass);
    g.rect(x, y, 13, 10, brass);
    g.rect(x + 1, y + 1, 11, 8, body);
    g.rect(x + 2, y + 2, 5, 6, dark);
    for (let r = 0; r < 3; r++) g.rect(x + 3, y + 3 + r * 2, 3, 1, grille);
    g.rect(x + 8, y + 2, 4, 2, win);
    g.rect(x + 8 + Math.round((Math.sin(t * 2.2) * 0.5 + 0.5) * 3), y + 2, 1, 2, needle);
    g.rect(x + 8, y + 6, 2, 2, brass);
    g.rect(x + 11, y + 6, 1, 2, brass);
  }

  _note(g, x, y, alpha) {
    const al = Math.trunc(255 * Math.max(0, Math.min(1, alpha * 1.3)));
    if (al < 8) return;
    const c = CA(al, 255, 226, 140);
    g.rect(x, y + 5, 3, 2, c);
    g.rect(x + 2, y, 1, 6, c);
    g.rect(x + 3, y, 1, 1, c);
    g.rect(x + 4, y + 1, 1, 2, c);
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
