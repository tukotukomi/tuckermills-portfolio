// Class traits: what each companion does for the party. A port of src\PixelTraits.cs. Every number is a function of the member's
// level so levelling up can change a trait without the scene having to know how.

import { C, CA, withAlpha, rnd } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';

export const TRAIT_OF = { chocobo: 'ItemStorage', whitemage: 'Heal', blackmage: 'Fireball', mithrathief: 'LuckyCoins', warrior: 'Huzzah', moogle: 'StarHat' };
export const TRAIT_OWNER = { ItemStorage: 'chocobo', Heal: 'whitemage', Fireball: 'blackmage', LuckyCoins: 'mithrathief', Huzzah: 'warrior', StarHat: 'moogle' };

export function storageSlots(level) { return 1; }
export function healInterval(level) { return 10; }
export function healAmount(level) { return 5; }
export function fireballInterval(level) { return 8; }
export function luckyCoinChance(level) { return 0.10; }
export function luckyCoinCount(level) { return 2; }
export function huzzahInterval(level) { return 30; }
export function huzzahDuration(level) { return 5; }
export function huzzahDamageMultiplier(level) { return 2; }
export function starHatInterval(level) { return 5 * 60; }
export function starHatDuration(level) { return 60; }
export function peckDamage(level) { return 1; }
export function peckInterval(level) { return 1.0; }
export function fireballDamage(level) { return 5; }

export function traitInterval(trait, level) {
  switch (trait) {
    case 'Heal': return healInterval(level);
    case 'Fireball': return fireballInterval(level);
    case 'Huzzah': return huzzahInterval(level);
    case 'StarHat': return starHatInterval(level);
  }
  return 0;
}

/** A short line for the tavern's cards: the trait's name and what it does at `level`. */
export function traitSummary(kind, level) {
  switch (TRAIT_OF[kind]) {
    case 'ItemStorage': return 'Item Storage: +' + storageSlots(level) + ' slot' + (storageSlots(level) === 1 ? '' : 's') + ' for the party';
    case 'Heal': return 'Heal: ' + healAmount(level) + ' HP to the weakest ally every ' + healInterval(level) + ' s';
    case 'Fireball': return 'Fireball: casts one to the right every ' + fireballInterval(level) + ' s';
    case 'LuckyCoins': return 'Lucky Coins: ' + Math.round(luckyCoinChance(level) * 100) + '% chance of ' + luckyCoinCount(level) + ' coins together';
    case 'Huzzah': return 'Huzzah!: party damage x' + huzzahDamageMultiplier(level) + ' for ' + huzzahDuration(level) + ' s every ' + huzzahInterval(level) + ' s';
    case 'StarHat': return 'Star Hat: party wears one for ' + (starHatDuration(level) / 60) + ' min every ' + (starHatInterval(level) / 60) + ' min';
  }
  return '';
}

const TIMED_TRAITS = ['Heal', 'Fireball', 'Huzzah', 'StarHat'];
const SHOUT_SECONDS = 2.2;
const HAT_ROWS = ['...y...', '..bbb..', '..byb..', '.bbybb.', 'BBBBBBB'];

function plus(g, c, x, y) { g.rect(x - 1, y, 3, 1, c); g.rect(x, y - 1, 1, 3, c); }

export function installTraits(P) {
  const m = P.prototype;

  m._initTraits = function () {
    this.traitTimer = {};
    this.memberRects = {};
    this.fireballs = [];
    this.heals = [];
    this.inspireLeft = 0; this.hatLeft = 0; this.shoutAge = -1; this.castFlash = 0; this.luckyFlash = 0;
    this.headSpots = new Map();
  };

  Object.defineProperties(m, {
    itemStorage: { get() { return this.party.indexOf('chocobo') >= 0 ? storageSlots(this.levelOf('chocobo')) : 0; } },
    partyInspired: { get() { return this.inspireLeft > 0; } },
    starHatsOn: { get() { return this.hatLeft > 0; } },
  });

  /** A party member's damage after any Huzzah! bonus. */
  m._withHuzzah = function (damage) {
    return this.partyInspired ? damage * huzzahDamageMultiplier(this.levelOf('warrior')) : damage;
  };

  m._applyHeal = function (who, hp) { /* HP isn't tracked yet */ };
  m._healthFraction = function (who) { return 1.0; };

  /** Counts the timed traits down in adventuring time and fires them. */
  m._advanceTraits = function (dt, paused) {
    if (paused) return;
    for (const trait of TIMED_TRAITS) {
      const owner = TRAIT_OWNER[trait];
      if (this.party.indexOf(owner) < 0) { delete this.traitTimer[trait]; continue; }
      const level = this.levelOf(owner);
      let left = this.traitTimer[trait];
      if (left === undefined) left = traitInterval(trait, level);
      left -= dt;
      if (left <= 0) { this._fireTrait(trait, level); left = traitInterval(trait, level); }
      this.traitTimer[trait] = left;
    }
    if (this.inspireLeft > 0) this.inspireLeft = Math.max(0, this.inspireLeft - dt);
    if (this.hatLeft > 0) this.hatLeft = Math.max(0, this.hatLeft - dt);
  };

  m._fireTrait = function (trait, level) {
    switch (trait) {
      case 'Heal': {
        const target = this._weakestMember();
        const amount = healAmount(level);
        this._applyHeal(target, amount);
        this.heals.push({ from: 'whitemage', to: target, amount: amount, age: 0 });
        Sound.play('Heal');
        break;
      }
      case 'Fireball': {
        const r = this._rectOf('blackmage');
        this.fireballs.push({ x: r.x + r.w - 2, y: r.y + 5, age: 0 });
        this.castFlash = 0.35;
        Sound.play('FireCast');
        break;
      }
      case 'Huzzah':
        this.inspireLeft = huzzahDuration(level);
        this.shoutAge = 0;
        Sound.play('Huzzah');
        break;
      case 'StarHat':
        this.hatLeft = starHatDuration(level);
        Sound.play('StarHat');
        break;
    }
  };

  m._weakestMember = function () {
    let lowest = Infinity;
    for (const k of this.party) lowest = Math.min(lowest, this._healthFraction(k));
    const pool = this.party.filter(k => this._healthFraction(k) <= lowest + 1e-9);
    return pool[rnd(pool.length)];
  };

  m._rectOf = function (kind) {
    const r = this.memberRects[kind];
    if (r) return r;
    const i = this.party.indexOf(kind);
    const s = Sprites.party[kind];
    return { x: Math.trunc(this._leaderX()) - Math.max(0, i) * 25, y: this.groundY + 1 - s.h, w: s.w, h: s.h };
  };

  m._noteMemberRect = function (kind, x, y, w, h) { this.memberRects[kind] = { x: x, y: y, w: w, h: h }; };

  /** Effects that play out in real time, even while the adventure itself is paused. */
  m._advanceTraitEffects = function (dt) {
    for (let i = this.heals.length - 1; i >= 0; i--) {
      this.heals[i].age += dt / 1.3;
      if (this.heals[i].age >= 1) this.heals.splice(i, 1);
    }
    let cruise = this.groundY, partyRight = 0;
    for (const k in this.memberRects) { const r = this.memberRects[k]; cruise = Math.min(cruise, r.y); partyRight = Math.max(partyRight, r.x + r.w); }
    cruise -= 5;
    const target = this.enemy !== null && this.enemy.deathT < 0 ? this.enemy : null;
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const f = this.fireballs[i];
      f.age += dt;
      f.x += dt * 64;
      let goalY = cruise, rate = 26;
      if (target !== null && f.x > partyRight - 2) {   // clear of the party: drop onto the enemy
        const er = this._enemyRect(target);
        goalY = er.y + er.h * 0.35;
        rate = 70;
      }
      f.y += Math.max(-dt * rate, Math.min(dt * rate, goalY - f.y));
      if (target !== null && f.x >= target.x + 1) {
        this._damageEnemy(target, this._withHuzzah(fireballDamage(this.levelOf('blackmage'))), true, f.x, f.y);
        this.fireballs.splice(i, 1);
        continue;
      }
      if (f.x > this.lastLw + 12) this.fireballs.splice(i, 1);
    }
    if (this.castFlash > 0) this.castFlash = Math.max(0, this.castFlash - dt);
    if (this.luckyFlash > 0) this.luckyFlash = Math.max(0, this.luckyFlash - dt);
    if (this.shoutAge >= 0) { this.shoutAge += dt; if (this.shoutAge > SHOUT_SECONDS) this.shoutAge = -1; }
  };

  m._resetTraits = function () {
    this.traitTimer = {};
    this.fireballs.length = 0; this.heals.length = 0;
    this.inspireLeft = 0; this.hatLeft = 0; this.shoutAge = -1; this.castFlash = 0; this.luckyFlash = 0;
    this._resetEnemies();
  };

  m._saveTraitFields = function () {
    return Object.keys(this.traitTimer).map(k => k + '=' + this.traitTimer[k].toFixed(1)).join(';');
  };

  m._loadTraitFields = function (field) {
    this._resetTraits();
    if (!field) return;
    for (const pair of field.split(';').filter(s => s)) {
      const kv = pair.split('=');
      const v = parseFloat(kv[1]);
      if (kv.length === 2 && TIMED_TRAITS.indexOf(kv[0]) >= 0 && v > 0 && v < 24 * 3600) this.traitTimer[kv[0]] = v;
    }
  };

  // ---- Text for the page to draw (heal amounts, the Warrior's shout, damage numbers, enemy names) ----

  m.textOverlays = function () {
    const list = [];
    for (const h of this.heals) {
      const r = this.memberRects[h.to];
      if (!r) continue;
      const u = h.age;
      list.push({
        text: '+' + h.amount, x: (r.x + r.w / 2.0) * this.lastScale, y: this.lastTop + (r.y - 3 - u * 9) * this.lastScale,
        alpha: Math.max(0, Math.min(1, Math.min(u * 8, 1.6 * (1 - u)))), bubble: false, color: C(150, 255, 170)
      });
    }
    if (this.shoutAge >= 0 && this.party.indexOf('warrior') >= 0) {
      const r = this._rectOf('warrior');
      const a = Math.min(1, Math.min(this.shoutAge / 0.15, (SHOUT_SECONDS - this.shoutAge) / 0.4));
      list.push({ text: 'Huzzah!', x: (r.x + r.w / 2.0) * this.lastScale, y: this.lastTop + (r.y - 3) * this.lastScale, alpha: Math.max(0, a), bubble: true, color: C(70, 24, 20) });
    }
    this._appendEnemyText(list);
    return list;
  };

  // ---- Drawing -------------------------------------------------------------------------------------------

  m._drawTraitEffects = function (g, lw) {
    this._drawInspire(g);
    this._drawHeals(g);
    this._drawCastFlash(g);
    this._drawFireballs(g);
    this._drawLuckyFlash(g);
  };

  m._drawHeals = function (g) {
    for (const h of this.heals) {
      const r = this.memberRects[h.to];
      if (!r) continue;
      const u = h.age, env = Math.sin(Math.PI * Math.min(1, u));
      g.ellipse(r.x - 3, r.y - 2, r.w + 6, r.h + 4, CA(Math.trunc(95 * env), 120, 255, 170));
      for (let k = 0; k < 4; k++) {
        const v = u * 1.15 - k * 0.1;
        if (v <= 0 || v >= 1) continue;
        const px = r.x + 2 + (k * 5 + 2) % Math.max(4, r.w - 4);
        const py = r.y + r.h - 2 - Math.trunc(v * (r.h + 4));
        const a = Math.trunc(255 * Math.sin(Math.PI * v));
        plus(g, k % 2 === 0 ? CA(a, 220, 255, 230) : CA(a, 130, 255, 170), px, py);
      }
      if (h.from !== h.to && u < 0.45) {
        const c = this._rectOf(h.from);
        const w = u / 0.45;
        const sx = c.x + c.w / 2.0 + (r.x + r.w / 2.0 - (c.x + c.w / 2.0)) * w;
        const sy = c.y + 2 + (r.y + 2 - (c.y + 2)) * w - Math.sin(Math.PI * w) * 5;
        plus(g, CA(240, 200, 255, 220), Math.round(sx), Math.round(sy));
      } else if (h.from === h.to || u < 0.2) {
        const c = this._rectOf(h.from);
        plus(g, CA(Math.trunc(220 * env), 200, 255, 220), c.x + Math.trunc(c.w / 2), c.y - 3);
      }
    }
  };

  m._drawCastFlash = function (g) {
    if (this.castFlash <= 0 || this.party.indexOf('blackmage') < 0) return;
    const r = this._rectOf('blackmage');
    const u = 1 - this.castFlash / 0.35;
    const rad = 2 + Math.trunc(7 * u);
    const cx = r.x + r.w - 1, cy = r.y + 5;
    g.ring(cx - rad, cy - rad, rad * 2, rad * 2, CA(Math.trunc(230 * (1 - u)), 255, 150, 40));
    g.rect(cx - 1, cy - 1, 3, 3, CA(Math.trunc(255 * (1 - u)), 255, 230, 140));
  };

  m._drawFireballs = function (g) {
    for (const f of this.fireballs) {
      const x = Math.round(f.x), y = Math.round(f.y);
      const flick = (Math.trunc(f.age * 14)) % 2;
      g.ellipse(x - 7, y - 7, 14, 14, CA(54, 255, 140, 30));
      for (let i = 1; i <= 4; i++)
        g.rect(x - 2 - i * 2, y - (i + flick) % 2, 2, 2, CA(220 - i * 50, i < 3 ? 255 : 220, i < 3 ? 150 : 70, 30));
      const outer = C(226, 96, 18);
      g.rect(x - 2, y - 3, 5, 7, outer);
      g.rect(x - 3, y - 2, 7, 5, outer);
      g.rect(x - 2, y - 2, 5, 5, C(255, 168, 40));
      g.rect(x - 1 + flick, y - 1, 3, 3, C(255, 238, 150));
      g.rect(x, y, 1, 1, C(255, 252, 220));
    }
  };

  m._drawLuckyFlash = function (g) {
    if (this.luckyFlash <= 0 || this.party.indexOf('mithrathief') < 0) return;
    const r = this._rectOf('mithrathief');
    const u = 1 - this.luckyFlash / 1.2;
    for (let k = 0; k < 3; k++) {
      const v = u * 1.3 - k * 0.18;
      if (v <= 0 || v >= 1) continue;
      plus(g, CA(Math.trunc(255 * Math.sin(Math.PI * v)), 255, 230, 110), r.x + Math.trunc(r.w / 2) + (k - 1) * 5, r.y - 2 - Math.trunc(v * 9));
    }
  };

  m._drawInspire = function (g) {
    if (this.inspireLeft <= 0) return;
    const fade = Math.min(1, this.inspireLeft / 0.6);
    let i = 0;
    for (const k in this.memberRects) {
      const r = this.memberRects[k];
      const pulse = 0.65 + 0.35 * Math.sin(this.time * 7 + i);
      g.ellipse(r.x - 3, r.y - 1, r.w + 6, r.h + 3, CA(Math.trunc(70 * pulse * fade), 255, 214, 90));
      const v = (this.time * 1.6 + i * 0.37) % 1.0;
      plus(g, CA(Math.trunc(240 * Math.sin(Math.PI * v) * fade), 255, 226, 120), r.x + 3 + (i * 7) % Math.max(4, r.w - 6), r.y + r.h - Math.trunc(v * (r.h + 5)));
      i++;
    }
  };

  // ---- Star Hats --------------------------------------------------------------------------------------------

  /** Where the top of a sprite's head is: [centre x, top row], found from its highest opaque pixels (cached per frame). */
  m._headSpot = function (img) {
    let spot = this.headSpots.get(img);
    if (spot) return spot;
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let topRow = 0;
    outer: for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 0) { topRow = y; break outer; }
    let count = 0, sum = 0;
    for (let y = topRow; y < Math.min(c.height, topRow + 2); y++)
      for (let xx = 0; xx < c.width; xx++) if (d[(y * c.width + xx) * 4 + 3] > 0) { sum += xx; count++; }
    spot = { center: count > 0 ? Math.trunc(sum / count) : Math.trunc(c.width / 2), top: topRow };
    this.headSpots.set(img, spot);
    return spot;
  };

  m._drawStarHat = function (g, frame, x, y) {
    const spot = this._headSpot(frame);
    const left = x + spot.center - 3;
    const bottom = y + spot.top + 1;
    const rowTop = bottom - (HAT_ROWS.length - 1);
    const twinkle = (Math.trunc(this.time * 3)) % 3 === 0;
    for (let r = 0; r < HAT_ROWS.length; r++)
      for (let c = 0; c < 7; c++) {
        const ch = HAT_ROWS[r][c];
        if (ch === '.') continue;
        const col = ch === 'y' ? (twinkle && r === 0 ? C(255, 250, 200) : C(255, 224, 84)) : ch === 'B' ? C(36, 44, 132) : C(72, 96, 222);
        g.rect(left + c, rowTop + r, 1, 1, col);
      }
  };
}
