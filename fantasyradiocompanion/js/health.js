// Party hit points. Everyone starts at full health; a member at 0 HP has fainted: they go to the back of the line and ride, passed
// out, in a pull cart behind the party until healed. Nothing damages the party yet, so damageMember is the one place the fights will
// call when they do. A port of src\PixelHealth.cs.

import { C, CA } from './util.js';
import { Sprites } from './sprites.js';
import { t } from './i18n.js';

/** Hit points at full health. Everyone has 50 for now; the Warrior, the front-liner, has 80. */
export function maxHp(kind, level) { return kind === 'warrior' ? 80 : 50; }

const INK = C(30, 22, 40), WOOD = C(158, 100, 58), DARK = C(104, 62, 38), PALE = C(204, 146, 92);

/** A greyed, darkened copy of an image: a member who is out cold. Cached per image. */
const dimmed = new WeakMap();
function dimImage(img) {
  let c = dimmed.get(img);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const mix = 0.55, dim = 0.82;
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i + 1], b = d.data[i + 2], gray = 0.30 * r + 0.59 * g + 0.11 * b;
    d.data[i] = ((1 - mix) * r + mix * gray) * dim;
    d.data[i + 1] = ((1 - mix) * g + mix * gray) * dim;
    d.data[i + 2] = Math.min(255, ((1 - mix) * b + mix * gray) * dim + 13);
  }
  x.putImageData(d, 0, 0);
  dimmed.set(img, c);
  return c;
}

export function installHealth(P) {
  const m = P.prototype;

  m._initHealth = function () {
    this.hp = {};            // only members below full health are listed
    this.memberClip = {};    // for a member in the cart: the y below which the board hides them
  };

  m.maxHpOf = function (kind) { return maxHp(kind, this.levelOf(kind)); };

  m.hpOf = function (kind) {
    const max = this.maxHpOf(kind), v = this.hp[kind];
    return v === undefined ? max : Math.max(0, Math.min(max, v));
  };

  /** True for a party member with no HP left: out cold in the cart. */
  m.isFainted = function (kind) { return this.party.indexOf(kind) >= 0 && this.hpOf(kind) <= 0; };

  /** True once every member of the party has fainted into the cart: the adventure is over and the score is shown. */
  Object.defineProperty(m, 'isGameOver', { get() { return this.party.length > 0 && this.party.every(k => this.hpOf(k) <= 0); } });

  /** The whole years and the days beyond them that the party survived (a year is four seasons of five days). */
  Object.defineProperty(m, 'survivedYears', { get() { return Math.floor(this.daysCompleted / 20); } });
  Object.defineProperty(m, 'survivedDays', { get() { return this.daysCompleted % 20; } });

  /** In the party and on their feet: the only members whose traits and attacks fire. */
  m._active = function (kind) { return this.party.indexOf(kind) >= 0 && this.hpOf(kind) > 0; };

  /** The first member who is up: the one the enemies meet. (If everyone is down, the leader.) */
  m._frontKind = function () {
    for (const k of this.party) if (this.hpOf(k) > 0) return k;
    return this.party[0];
  };

  /** The line the party walks in: the members on their feet in join order, then the fainted, who ride in the cart at the back. */
  m._lineOrder = function () {
    return this.party.filter(k => this.hpOf(k) > 0).concat(this.party.filter(k => this.hpOf(k) <= 0));
  };

  m._lineIndexOf = function (kind) { return this._lineOrder().indexOf(kind); };

  /** Takes HP off a member. At 0 they faint. */
  m.damageMember = function (kind, amount) {
    if (this.party.indexOf(kind) < 0 || amount <= 0) return;
    const before = this.hpOf(kind);
    if (before <= 0) return;   // already out cold
    this.hp[kind] = Math.max(0, before - amount);
    const r = this._rectOf(kind);
    if (this.hp[kind] === 0) this._addItemText(t('Fainted!'), r.x + r.w / 2.0, r.y - 4, C(255, 170, 160));
    else this._addItemText('-' + (before - this.hp[kind]), r.x + r.w / 2.0, r.y - 4, C(255, 150, 150));
    this.raiseProgress();
  };

  /** Gives HP back, up to full. A member brought up from 0 wakes and takes their place in the line again. */
  m._restoreHp = function (kind, amount) {
    if (this.party.indexOf(kind) < 0 || amount <= 0) return;
    const max = this.maxHpOf(kind), now = Math.min(max, this.hpOf(kind) + amount);
    if (now >= max) delete this.hp[kind]; else this.hp[kind] = now;
  };

  // ---- Saved: "Warrior=70;Fae=0" (only members below full health) -----------------------------------------------

  m._saveHpFields = function () {
    return this.party.filter(k => this.hpOf(k) < this.maxHpOf(k)).map(k => PARTY_ENUM_OF(k) + '=' + this.hpOf(k)).join(';');
  };

  m._loadHpFields = function (field) {
    this.hp = {};
    if (!field) return;
    for (const pair of field.split(';').filter(s => s)) {
      const kv = pair.split('=');
      const kind = kv.length === 2 ? KIND_FROM(kv[0]) : null;
      const v = kv.length === 2 ? parseInt(kv[1], 10) : NaN;
      if (kind && this.party.indexOf(kind) >= 0 && !isNaN(v) && v >= 0 && v < this.maxHpOf(kind)) this.hp[kind] = v;
    }
  };

  // ---- A simple bar above the head of anyone who isn't at full health ----------------------------------------------

  m._drawHpBars = function (g) {
    let riders = 0;
    for (const k of this._lineOrder()) {
      const r = this.memberRects[k];
      if (!r) continue;
      const hp = this.hpOf(k), max = this.maxHpOf(k);
      if (hp >= max || max <= 0) continue;
      const rider = hp <= 0;   // in the cart: a narrower bar, every other one a little higher so neighbours don't overlap
      const w = rider ? 10 : 14;
      const x = r.x + Math.trunc((r.w - w) / 2);
      const y = r.y - 5 - (this.hatLeft > 0 && !rider ? 6 : 0) - (rider && (riders++ % 2) === 1 ? 4 : 0);
      const f = hp / max;
      const fill = f > 0.5 ? C(92, 214, 104) : f > 0.25 ? C(250, 212, 76) : C(232, 70, 70);
      g.rect(x - 1, y - 1, w + 2, 4, C(30, 22, 40));
      g.rect(x, y, w, 2, C(78, 56, 70));
      if (hp > 0) g.rect(x, y, Math.max(1, Math.ceil(w * f)), 2, fill);
    }
  };

  // ---- Text: HP above each member while a healing item waits for its target ------------------------------------

  m._appendHpText = function (list) {
    if (!this.isTargeting) return;
    let riders = 0;
    for (const k of this._lineOrder()) {
      const r = this.memberRects[k];
      if (!r) continue;
      const hp = this.hpOf(k), max = this.maxHpOf(k), f = max > 0 ? hp / max : 1;
      // Above the head; in a short view that would run into the HUD pills, so it goes across the member instead.
      let y = this.lastTop + (r.y - (hp < max ? 12 : 5)) * this.lastScale;   // clear of the bar a hurt member wears
      if (y < 48) y = this.lastTop + (r.y + r.h * 0.62) * this.lastScale;
      if (hp <= 0 && (riders++ % 2) === 1) y += 13;   // riders sit close together: stagger their labels
      list.push({
        text: t('HP {n}', { n: hp + '/' + max }), x: (r.x + r.w / 2.0) * this.lastScale, y: y, alpha: 1, bubble: false,
        color: hp <= 0 ? C(255, 150, 150) : f < 0.5 ? C(255, 226, 130) : C(190, 255, 210)
      });
    }
  };

  // ---- The pull cart ----------------------------------------------------------------------------------------------

  /**
   * The cart the fainted ride in, behind the last member on their feet: a long side board hiding the riders' lower halves, two spoked
   * wheels that turn with the road and a short shaft out to the party. `slotX` is the left edge of the first fainted member's place.
   */
  m._drawCart = function (g, riders, slotX) {
    const k = riders.length, w = 12 + 10 * k;
    const right = Math.round(slotX) + Sprites.party[riders[0]].w + 4, x = right - w;
    const gy = this.groundY + 1, boardTop = gy - 8, boardH = 4;
    g.ellipse(x + 1, this.groundY, w - 2, 2, CA(90, 20, 30, 20));

    // The riders, slumped in the bed (dimmed, the board in front of their lower half) with a drifting Z or two.
    for (let j = 0; j < k; j++) {
      const sp = Sprites.party[riders[j]];
      const sx = x + 4 + j * 10, sy = boardTop + 4 - sp.h + (j % 2);
      g.image(dimImage(sp.a), sx, sy, false, undefined, sp.w, sp.h);
      this._noteMemberRect(riders[j], sx, sy, sp.w, sp.h);
      this.memberFrames[riders[j]] = sp.a;
      this.memberClip[riders[j]] = boardTop;
      for (let z = 0; z < 2; z++) {
        const u = (this.time * 0.45 + j * 0.31 + z * 0.5) % 1.0;
        const a = Math.max(0, Math.trunc(235 * Math.sin(Math.PI * u)));
        const zx = sx + sp.w - 4 + Math.round(Math.sin(u * 5 + j) * 1.5), zy = sy - 1 - Math.trunc(u * 9);
        const c = CA(a, 205, 222, 255);
        g.rect(zx, zy, 3, 1, c); g.rect(zx + 1, zy + 1, 1, 1, c); g.rect(zx, zy + 2, 3, 1, c);
      }
    }

    // The side board, with a post up at each end.
    g.rect(x - 1, boardTop - 1, w + 2, boardH + 2, INK);
    g.rect(x, boardTop, w, boardH, WOOD);
    g.rect(x, boardTop, w, 1, PALE);
    g.rect(x, boardTop + boardH - 1, w, 1, DARK);
    for (let s = 6; s < w - 2; s += 7) g.rect(x + s, boardTop + 1, 1, boardH - 1, DARK);
    for (const px of [x - 1, right - 1]) { g.rect(px, boardTop - 3, 3, 3, INK); g.rect(px + 1, boardTop - 2, 1, 2, WOOD); }

    // Two wheels, turning as the road goes by.
    const cy = this.groundY - 3;
    [x + 6, right - 6].forEach((cx, idx) => {
      g.ellipse(cx - 3, cy - 3, 7, 7, INK);
      g.ellipse(cx - 2, cy - 2, 5, 5, WOOD);
      const a = this.scroll * 0.55 + idx * 0.9;
      for (let s = 0; s < 2; s++) {
        const aa = a + s * Math.PI / 2;
        for (let d = -2; d <= 2; d++) g.rect(Math.round(cx + Math.cos(aa) * d), Math.round(cy + Math.sin(aa) * d), 1, 1, DARK);
      }
      g.rect(cx, cy, 1, 1, C(250, 212, 76));
    });

    // The shaft, reaching out towards the party.
    for (let i = 0; i <= 6; i++) g.rect(right - 1 + i, gy - 6 - Math.trunc(i / 2), 1, 2, DARK);
  };
}

// The exe's save strings name companions with C# enum names (set by scene.js, which owns the table).
let PARTY_ENUM_OF = k => k;
let KIND_FROM = n => n;
export function setKindNames(toEnum, fromEnum) { PARTY_ENUM_OF = toEnum; KIND_FROM = fromEnum; }
