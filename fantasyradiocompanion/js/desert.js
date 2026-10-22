// The desert, from Year 5 on. A port of src\PixelDesert.cs. The party walks into it over the last day of Year 4 and never leaves it (for now):
// the sky warms, the hills become flat-topped sandstone mesas, the grass turns to sand, and the trees give way to cacti and boulders.
// It still has all four seasons (the usual season tables keep tinting everything; spring brings cactus flowers, winter a dusting of white, fall
// blowing dust).

import { C, CA, mix, clamp255, hash } from './util.js';

const YEAR_DAYS = 20;   // a year: four seasons of five days (SEASON_DAYS * 4 in scene.js)

const smooth01 = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

/** How deep into the desert a point in the play clock is: in over the last day of Year 4, and there for good after that. */
export function desertAt(playDays) {
  return smooth01((playDays - (YEAR_DAYS * 4 - 1)) / 2);
}

export const SAND_KEYS = [C(222, 190, 122), C(236, 200, 120), C(212, 166, 100), C(232, 224, 204)];
export const SAND_DARK_KEYS = [C(196, 158, 94), C(212, 168, 92), C(184, 138, 80), C(206, 198, 178)];
export const DESERT_DIRT_KEYS = [C(170, 126, 78), C(180, 130, 74), C(160, 114, 68), C(190, 184, 170)];
export const DESERT_DIRT_DARK_KEYS = [C(140, 98, 60), C(150, 102, 58), C(128, 88, 54), C(160, 156, 146)];
export const DESERT_FAR_KEYS = [C(196, 124, 108), C(216, 150, 100), C(176, 92, 84), C(30, 24, 52)];
export const DESERT_NEAR_KEYS = [C(176, 104, 82), C(194, 126, 78), C(146, 72, 62), C(22, 18, 40)];
export const DUST_COLORS = [C(226, 190, 124), C(240, 214, 150), C(200, 160, 96)];

export function installDesert(P) {
  const m = P.prototype;

  m._updateDesert = function () { this.desert = desertAt(this.playDays); };

  /** Washes a sky colour towards the desert's warm haze, keeping its brightness (so the night stays dark). */
  m._desertWash = function (c, amount) {
    if (amount <= 0.001) return c;
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    return mix(c, { r: clamp255(lum * 1.3 + 8), g: clamp255(lum * 0.95), b: clamp255(lum * 0.55), a: c.a }, amount);
  };

  /** The desert's plants and rocks, in the same slots the trees use: saguaros, barrel cacti, prickly pears, dry brush and boulders. */
  m._drawDesertFlora = function (g, lw) {
    this.glow.length = 0;
    const k = Math.min(1.5, 1 + (this.groundY / 27.0 - 1) * 0.5), spacing = 34, off = this.scroll * 0.6;   // (cacti and boulders do not keep growing in a tall view)
    const t0 = Math.floor(off / spacing) - 1, t1 = Math.floor((off + lw) / spacing) + 1;
    const baseY = this.groundY + 1, winter = this.sw[3], spring = this.sw[0];
    const sh = c => this._shadeColor(c);
    const green = sh(C(86, 150, 82)), greenD = sh(C(50, 106, 62)), greenL = sh(C(140, 198, 110)), spine = sh(C(244, 238, 190));
    const rock = sh(C(184, 146, 108)), rockD = sh(C(132, 100, 72)), rockL = sh(C(214, 180, 140));
    const brush = sh(C(170, 134, 76)), brushD = sh(C(120, 90, 52)), pink = sh(C(240, 110, 158)), fruit = sh(C(206, 60, 80));
    const sn = sh(C(244, 248, 255)), snow = CA(Math.trunc(255 * Math.min(1, winter * 1.5)), sn.r, sn.g, sn.b);
    const rect = (x, y, w, h, c) => g.rect(x, y, w, h, c);
    for (let t = t0; t <= t1; t++) {
      const h = hash(t + 2000, 91);
      if (h % 5 === 0) continue;   // a gap now and then
      const x = Math.round(t * spacing + ((h >>> 8) % 14) - 7 - off);
      const sz = (0.85 + ((h >>> 16) % 5) * 0.1) * k;
      switch (Math.trunc(h >>> 20) % 7) {
        case 0:
        case 1: {   // a saguaro: a tall trunk with an arm up on each side
          const th = Math.max(10, Math.trunc(15 * sz)), top = baseY - th;
          rect(x, top, 3, th, green); rect(x, top, 1, th, greenL); rect(x + 2, top, 1, th, greenD); rect(x, top - 1, 3, 1, greenL);
          const ay = baseY - Math.trunc(th * 2 / 3), by = baseY - Math.trunc(th / 2) - 2;
          rect(x - 5, ay, 5, 2, green); rect(x - 5, ay - 4, 2, 5, green); rect(x - 5, ay - 4, 1, 5, greenL); rect(x - 5, ay - 5, 2, 1, greenL);
          rect(x + 3, by, 5, 2, green); rect(x + 6, by - 5, 2, 6, green); rect(x + 7, by - 5, 1, 6, greenD); rect(x + 6, by - 6, 2, 1, greenL);
          rect(x + 1, top + 3, 1, 1, spine); rect(x + 1, top + 7, 1, 1, spine); rect(x - 4, ay - 2, 1, 1, spine); rect(x + 7, by - 3, 1, 1, spine);
          if (spring > 0.3) { rect(x, top - 2, 2, 1, pink); rect(x - 5, ay - 6, 2, 1, pink); rect(x + 6, by - 7, 2, 1, pink); }
          if (winter > 0.05) { rect(x, top - 2, 3, 1, snow); rect(x - 5, ay - 6, 2, 1, snow); rect(x + 6, by - 7, 2, 1, snow); }
          break;
        }
        case 2: {   // a round barrel cactus with ribs
          const w = Math.max(8, Math.trunc(9 * sz)), hh = Math.max(6, Math.trunc(7 * sz));
          rect(x - Math.trunc(w / 2) + 1, baseY - hh, w - 2, 1, greenL); rect(x - Math.trunc(w / 2), baseY - hh + 1, w, hh - 1, green); rect(x - Math.trunc(w / 2) + 1, baseY - 1, w - 2, 1, greenD);
          for (let rx = x - Math.trunc(w / 2) + 2; rx < x + Math.trunc(w / 2) - 1; rx += 3) rect(rx, baseY - hh + 1, 1, hh - 2, greenD);
          rect(x - 1, baseY - hh - 1, 2, 1, spring > 0.3 ? pink : spine);
          if (winter > 0.05) rect(x - Math.trunc(w / 2) + 1, baseY - hh - 1, w - 2, 1, snow);
          break;
        }
        case 3: {   // a prickly pear: stacked paddles with red fruit
          rect(x, baseY - 4, 6, 4, green); rect(x, baseY - 4, 6, 1, greenL);
          rect(x - 2, baseY - 8, 5, 4, green); rect(x - 2, baseY - 8, 5, 1, greenL);
          rect(x + 3, baseY - 9, 5, 4, green); rect(x + 3, baseY - 9, 5, 1, greenL);
          rect(x + 1, baseY - 2, 1, 1, spine); rect(x, baseY - 6, 1, 1, spine); rect(x + 6, baseY - 7, 1, 1, spine);
          rect(x - 2, baseY - 9, 1, 1, fruit); rect(x + 7, baseY - 10, 1, 1, fruit); rect(x + 4, baseY - 10, 1, 1, fruit);
          if (winter > 0.05) { rect(x - 2, baseY - 9, 5, 1, snow); rect(x + 3, baseY - 10, 5, 1, snow); }
          break;
        }
        case 4: {   // dry brush: a tumbleweed of tangled twigs
          const r = Math.max(4, Math.trunc(5 * sz));
          for (let i = 0; i < 18; i++) {
            const hp = hash(i, h & 0xFFFF), a = (hp % 628) / 100.0, d = ((hp >>> 8) % 100) / 100.0 * r;
            rect(x + Math.trunc(Math.cos(a) * d), baseY - r + Math.trunc(Math.sin(a) * d * 0.8), 1, 1, i % 3 === 0 ? brushD : brush);
          }
          break;
        }
        default: {   // a boulder with a little cactus beside it
          const w = Math.max(10, Math.trunc(11 * sz)), hw = Math.trunc(w / 2);
          rect(x - hw + 3, baseY - 7, w - 6, 1, rockL); rect(x - hw + 1, baseY - 6, w - 2, 2, rock); rect(x - hw, baseY - 4, w, 4, rock);
          rect(x - hw + 2, baseY - 3, w - 4, 3, rockD); rect(x - hw + 3, baseY - 6, 2, 1, rockL);
          rect(x + hw + 1, baseY - 4, 2, 4, green); rect(x + hw + 1, baseY - 4, 1, 4, greenL);
          if (winter > 0.05) rect(x - hw + 3, baseY - 8, w - 6, 1, snow);
          break;
        }
      }
    }
  };
}
