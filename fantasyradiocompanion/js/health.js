// Party hit points. Everyone starts at full health; a member at 0 HP has fainted: they go to the back of the line and ride, passed
// out, in a pull cart behind the party until healed. Nothing damages the party yet, so damageMember is the one place the fights will
// call when they do. A port of src\PixelHealth.cs.

import { C, CA } from './util.js';
import { Sprites } from './sprites.js';
import { t } from './i18n.js';

/** Hit points at full health. Everyone has 50 for now; the Warrior, the front-liner, has 80. */
/** The HP a level-up adds, from `fromLevel` to the next. Four tiers, every one at 10 or more in the early levels: the tank (Warrior)
 *  starts at +14 and gains one more each level; the sturdy Paca +12, rising one every two levels; the Thief a flat +11; and the casters
 *  (Light Mage, Fire Mage, Fae, Druid) +10 through the fifth level-up, then fading one every three levels to a floor of +6. */
export function hpGain(kind, fromLevel) {
  const l = Math.max(1, fromLevel);
  switch (kind) {
    case 'warrior': return 14 + (l - 1);
    case 'paca': return 12 + Math.trunc((l - 1) / 2);
    case 'thief': return 11;
    case 'paladin': return 13 + Math.trunc((l - 1) / 2);       // sturdy, a little under the Warrior
    case 'shadowknight': return 11 + Math.trunc((l - 1) / 3);
    default: return l <= 5 ? 10 : Math.max(6, 9 - Math.trunc((l - 6) / 3));
  }
}

/** Hit points at full health at `level`: a base (50; the Warrior, the front-liner, 80) plus what each level-up has added. */
export function maxHp(kind, level) {
  let hp = kind === 'warrior' ? 80 : kind === 'paladin' ? 70 : kind === 'shadowknight' ? 60 : 50;
  for (let l = 1; l < level; l++) hp += hpGain(kind, l);
  return hp;
}

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
  m.damageMember = function (kind, amount, pure, elemental) {   // pure: poison, which no Shield Wall or hat softens; elemental: not a physical blow (fire, sand, the Blood Moon, a shout)
    if (this.party.indexOf(kind) < 0 || amount <= 0) return;
    if (!pure && this.wallLeft > 0 && this.wallTarget === kind && kind !== 'paladin' && this.shieldWallUp()) kind = 'paladin';   // Shield Wall: the Paladin takes the blow
    const before = this.hpOf(kind);
    if (before <= 0) return;   // already out cold
    if (!pure && kind === 'paladin' && this.wallLeft > 0 && this.wallTarget === 'paladin') amount = Math.ceil(amount / 2);   // the Paladin in front: the wall halves what he takes
    if (!pure && !elemental) amount = this._skillIncoming(kind, amount);   // a Stalwart hero takes a quarter less from physical blows (not poison, not anything elemental)
    if (!pure) amount = this._hatDamage(kind, amount);   // a Blue Hat halves what its wearer takes (on top of that)
    this.hp[kind] = Math.max(0, before - amount);
    if (this.hp[kind] === 0 && this._tryRerevive(kind)) return;   // Rerevive: they get up again on the spot with half their HP
    const r = this._rectOf(kind);
    if (this.hp[kind] === 0) this._addItemText(t('Fainted!'), r.x + r.w / 2.0, r.y - 4, C(255, 170, 160));
    else this._addItemText('-' + (before - this.hp[kind]), r.x + r.w / 2.0, r.y - 4, pure ? C(206, 140, 244) : C(255, 150, 150));
    this._checkHpTip(kind);   // the first time anyone is low, the Old Man steps in
    this.raiseProgress();
  };

  // ---- What the Year 5 desert monsters can do to a hero besides plain damage. Poison: a few HP lost every second for a few seconds, which no
  // hat or Shield Wall softens. Blind: sand in the eyes, so the hero's next attack misses (used up by that attempt). Neither is saved.

  m._st = function (kind, make) {
    if (!this.status) this.status = {};
    if (!this.status[kind] && make) this.status[kind] = { poisonTicks: 0, poisonDamage: 0, poisonTimer: 0, blind: false };
    return this.status[kind];
  };
  m.isPoisoned = function (kind) { const s = this._st(kind); return !!s && s.poisonTicks > 0; };
  m.isBlind = function (kind) { const s = this._st(kind); return !!s && s.blind; };

  /** Poisons a hero: `damage` HP a second for `ticks` seconds (a new poison renews the old). */
  m._applyPoison = function (kind, damage, ticks) {
    if (this.party.indexOf(kind) < 0 || this.hpOf(kind) <= 0 || damage <= 0) return;
    const s = this._st(kind, true);
    s.poisonTicks = ticks; s.poisonDamage = damage; s.poisonTimer = 1.0;
  };
  m._applyBlind = function (kind) {
    if (this.party.indexOf(kind) < 0 || this.hpOf(kind) <= 0) return;
    this._st(kind, true).blind = true;
  };
  /** A hero is about to attack: if sand is in their eyes the attack misses (and the blindness is spent). True when it misses. */
  m._takeBlind = function (who) {
    const s = this._st(who);
    if (!s || !s.blind) return false;
    s.blind = false;
    const r = this._rectOf(who);
    this._addItemText(t('Miss!'), r.x + r.w / 2.0, r.y - 10, C(236, 206, 140));
    return true;
  };
  m._advanceStatus = function (dt) {
    if (!this.status) return;
    for (const kind of Object.keys(this.status)) {
      const s = this.status[kind];
      if (this.hpOf(kind) <= 0 || this.party.indexOf(kind) < 0) { s.poisonTicks = 0; s.blind = false; continue; }   // out cold: it all stops
      if (s.poisonTicks <= 0) continue;
      s.poisonTimer -= dt;
      if (s.poisonTimer > 0) continue;
      s.poisonTimer += 1.0;
      s.poisonTicks--;
      this.damageMember(kind, s.poisonDamage, true);
    }
  };
  m._resetStatuses = function () { this.status = {}; };

  /** Purple bubbles rising off a poisoned hero, and a little ring of sand circling the head of a blinded one. */
  m._drawStatus = function (g) {
    if (!this.status) return;
    for (const kind of Object.keys(this.status)) {
      const s = this.status[kind];
      if (this.party.indexOf(kind) < 0 || this.hpOf(kind) <= 0) continue;
      const r = this._rectOf(kind);
      if (s.poisonTicks > 0)
        for (let i = 0; i < 3; i++) {
          const ph = (this.time * 1.4 + i * 0.33) % 1.0;
          g.rect(r.x + 3 + Math.trunc(i * (r.w - 7) / 2) + Math.trunc(Math.sin(this.time * 3 + i) * 1.5), r.y + r.h - 4 - Math.trunc(ph * (r.h - 4)), 2, 2, CA(Math.trunc(220 * (1 - ph)), i % 2 === 0 ? 170 : 206, 90, i % 2 === 0 ? 226 : 244));
        }
      if (s.blind)
        for (let i = 0; i < 4; i++) {
          const a = this.time * 4.5 + i * Math.PI / 2;
          g.rect(r.x + Math.trunc(r.w / 2) - 1 + Math.trunc(Math.cos(a) * 6), r.y - 3 + Math.trunc(Math.sin(a) * 2), 2, 2, CA(235, i % 2 === 0 ? 226 : 255, i % 2 === 0 ? 188 : 232, i % 2 === 0 ? 120 : 170));
        }
    }
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
    for (const k of this._lineOrder()) {
      const r = this.memberRects[k];
      if (!r) continue;
      const hp = this.hpOf(k), max = this.maxHpOf(k);
      if (hp >= max || max <= 0) continue;
      if (hp <= 0) continue;   // out cold in the cart: no bar
      const w = 14;
      const x = r.x + Math.trunc((r.w - w) / 2);
      const y = r.y - 5 - (this.hatLeft > 0 ? 6 : 0);
      const f = hp / max;
      const fill = f > 0.5 ? C(92, 214, 104) : f > 0.25 ? C(250, 212, 76) : C(232, 70, 70);
      g.rect(x - 1, y - 1, w + 2, 4, C(30, 22, 40));
      g.rect(x, y, w, 2, C(78, 56, 70));
      g.rect(x, y, Math.max(1, Math.ceil(w * f)), 2, fill);
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
export function enumOf(kind) { return PARTY_ENUM_OF(kind); }
export function kindOfEnum(name) { return KIND_FROM(name); }
