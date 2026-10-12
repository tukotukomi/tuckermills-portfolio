// Small helpers shared by the scene code. The scene was written against .NET's GDI+ (Color, SolidBrush, FillRectangle ...); these keep
// the JavaScript port close enough to the C# in src\Pixel*.cs that a change made there can be made here the same way.

/** A colour: { r, g, b, a } with every channel 0-255 (like System.Drawing.Color). */
export function C(r, g, b) { return { r: r, g: g, b: b, a: 255 }; }
export function CA(a, r, g, b) { return { r: r, g: g, b: b, a: a }; }
/** Color.FromArgb(alpha, color): the same colour with a new alpha. */
export function withAlpha(a, c) { return { r: c.r, g: c.g, b: c.b, a: a }; }

export function mix(a, b, f) {
  return { r: Math.trunc(a.r + (b.r - a.r) * f), g: Math.trunc(a.g + (b.g - a.g) * f), b: Math.trunc(a.b + (b.b - a.b) * f), a: Math.trunc(a.a + (b.a - a.a) * f) };
}

export function css(c) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (Math.max(0, Math.min(255, c.a)) / 255).toFixed(3) + ')'; }
export function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.trunc(v); }
export function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

/** The scene's integer hash (uint32 arithmetic, as in PixelScene.Hash). */
export function hash(a, b) {
  let h = (Math.imul(a >>> 0, 2654435761) + Math.imul(b >>> 0, 2246822519) + 0x9E3779B9) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

export function ease(u) { u = clamp01(u); return u * u * (3 - 2 * u); }

/** A random integer in [0, n). */
export function rnd(n) { return Math.floor(Math.random() * n); }

/**
 * A pixel-art drawing surface over a canvas 2D context, with the handful of GDI+ operations the scene uses. Everything is whole pixels:
 * canvas paths are anti-aliased, which would blur a 16-bit look, so ellipses are rasterized by scanlines.
 */
export class Pix {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
  }

  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  resize(w, h) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = false;
    }
  }

  clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  /** FillRectangle with a colour. */
  rect(x, y, w, h, c) {
    if (w <= 0 || h <= 0 || c.a <= 0) return;
    this.ctx.fillStyle = css(c);
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** FillEllipse of the box (x, y, w, h), as hard-edged rows of pixels. */
  ellipse(x, y, w, h, c) {
    if (w <= 0 || h <= 0 || c.a <= 0) return;
    this.ctx.fillStyle = css(c);
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
    const y0 = Math.floor(y), y1 = Math.ceil(y + h);
    for (let row = y0; row < y1; row++) {
      const dy = (row + 0.5 - cy) / ry;
      if (dy * dy > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      const x0 = Math.round(cx - half), x1 = Math.round(cx + half);
      if (x1 > x0) this.ctx.fillRect(x0, row, x1 - x0, 1);
    }
  }

  /** DrawEllipse: a one-pixel outline of the box. */
  ring(x, y, w, h, c) {
    if (w <= 0 || h <= 0 || c.a <= 0) return;
    this.ctx.fillStyle = css(c);
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
    const steps = Math.max(16, Math.ceil((rx + ry) * 5));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      this.ctx.fillRect(Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), 1, 1);
    }
  }

  /** DrawImage of a whole image at (x, y), optionally mirrored and/or faded. */
  image(img, x, y, flip, alpha, w, h) {
    if (!img) return;
    const ctx = this.ctx;
    const iw = w === undefined ? img.width : w, ih = h === undefined ? img.height : h;
    const prev = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = prev * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(Math.round(x) + iw, Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, iw, ih);
      ctx.restore();
    } else {
      ctx.drawImage(img, Math.round(x), Math.round(y), iw, ih);
    }
    ctx.globalAlpha = prev;
  }
}

/** A copy of an image with each pixel's colour multiplied by (r, g, b)/255 and its alpha by `alpha` (a GDI+ ColorMatrix tint). */
export function tintImage(img, r, g, b, alpha) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i] = d.data[i] * r / 255; d.data[i + 1] = d.data[i + 1] * g / 255; d.data[i + 2] = d.data[i + 2] * b / 255;
    d.data[i + 3] = d.data[i + 3] * alpha;
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** A copy of an image brightened toward white by `amount` (0..1): the "brighter copy" the crystal pulses with. */
export function brightenImage(img, amount) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    d.data[i] = Math.min(255, d.data[i] + 255 * amount);
    d.data[i + 1] = Math.min(255, d.data[i + 1] + 255 * amount);
    d.data[i + 2] = Math.min(255, d.data[i + 2] + 255 * amount);
  }
  x.putImageData(d, 0, 0);
  return c;
}

/** A copy of an image with every pixel set to one colour (a silhouette). */
export function silhouetteImage(img, c) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const x = cv.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, cv.width, cv.height);
  for (let i = 0; i < d.data.length; i += 4) { d.data[i] = c.r; d.data[i + 1] = c.g; d.data[i + 2] = c.b; }
  x.putImageData(d, 0, 0);
  return cv;
}

/** A mirrored copy of an image. */
export function flipImage(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.translate(img.width, 0); x.scale(-1, 1);
  x.drawImage(img, 0, 0);
  return c;
}
