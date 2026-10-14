// Class traits: what each companion does for the party. A port of src\PixelTraits.cs. Every number is a function of the member's
// level so levelling up can change a trait without the scene having to know how.

import { C, CA, withAlpha, rnd } from './util.js';
import { Sprites, PARTY } from './sprites.js';
import { Sound } from './sfx.js';
import { t } from './i18n.js';

export const TRAIT_OF = { paca: 'ItemStorage', lightmage: 'Heal', firemage: 'Fireball', thief: 'LuckyCoins', warrior: 'Huzzah', fae: 'StarHat', druid: 'NaturalToxin' };
export const TRAIT_OWNER = { ItemStorage: 'paca', Heal: 'lightmage', Fireball: 'firemage', LuckyCoins: 'thief', Huzzah: 'warrior', StarHat: 'fae', NaturalToxin: 'druid' };

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
// The basic attacks of the other four: 1 damage every few seconds, but only from the front of the line and right next to the enemy.
export const BASIC_ATTACKERS = ['thief', 'fae', 'lightmage', 'firemage'];
export const BASIC_DAMAGE = 1;
export function basicInterval(kind) { return { thief: 2, fae: 3, lightmage: 3, firemage: 5 }[kind] || 5; }
export function fireballDamage(level) { return 5; }
export function axeDamage(level) { return 3; }          // the Warrior's thrown axe
export function axeInterval(level) { return 3.0; }
export function axeRangeBlocks(level) { return 10; }   // blocks of grass it travels
export const BLOCK_PIXELS = 8;                          // one block of grass = one repeat of the ground's pattern
export function crossbowDamage(level) { return 2; }    // the Thief's crossbow bolt, for when he is out of melee reach
export function crossbowInterval(level) { return 5.0; }
export function toxinInterval(level) { return 10; }   // seconds of adventuring between the Druid's casts
export function toxinDamage(level) { return 2; }       // taken off the enemy at every tick
export function toxinTicks(level) { return 5; }        // one tick a second, so 5 seconds

export function traitInterval(trait, level) {
  switch (trait) {
    case 'Heal': return healInterval(level);
    case 'Fireball': return fireballInterval(level);
    case 'Huzzah': return huzzahInterval(level);
    case 'StarHat': return starHatInterval(level);
    case 'NaturalToxin': return toxinInterval(level);
  }
  return 0;
}

/** A short line for the tavern's cards: the trait's name and what it does at `level`. */
export function traitSummary(kind, level) {
  switch (TRAIT_OF[kind]) {
    case 'ItemStorage': return t(storageSlots(level) === 1 ? 'Item Storage: +{n} slot for the party' : 'Item Storage: +{n} slots for the party', { n: storageSlots(level) });
    case 'Heal': return t('Heal: {hp} HP to the weakest ally every {s} s', { hp: healAmount(level), s: healInterval(level) });
    case 'Fireball': return t('Fireball: casts one to the right every {s} s', { s: fireballInterval(level) });
    case 'LuckyCoins': return t('Lucky Coins: {p}% chance of {n} coins together', { p: Math.round(luckyCoinChance(level) * 100), n: luckyCoinCount(level) });
    case 'Huzzah': return t('Huzzah!: party damage x{m} for {d} s every {s} s', { m: huzzahDamageMultiplier(level), d: huzzahDuration(level), s: huzzahInterval(level) });
    case 'StarHat': return t('Star Hat: party wears one for {d} min every {s} min', { d: starHatDuration(level) / 60, s: starHatInterval(level) / 60 });
    case 'NaturalToxin': return t('Natural Toxin: {d} damage a second for {n} s, every {s} s', { d: toxinDamage(level), n: toxinTicks(level), s: toxinInterval(level) });
  }
  return '';
}

const AXE_SPEED = 90;   // scene pixels per second
const AXE_ARC = 11;     // how high the lob rises above the straight line
const BOLT_SPEED = 170;  // the Thief's crossbow bolt, scene pixels per second
const BOLT_ARC = 4;      // a slight lob, enough to clear the heads in front
const AXE_COLORS = { n: C(158, 100, 58), w: C(250, 250, 255), g: C(206, 212, 226), G: C(126, 134, 160) };
// The axe's four spin positions (5x5): one picture turned a quarter turn at a time.
const AXE_FRAMES = (() => {
  let grid = ['..nwg', '..ngg', '..nGg', '..n..', '..n..'];
  const frames = [];
  for (let f = 0; f < 4; f++) {
    frames.push(grid);
    const next = [];
    for (let y = 0; y < 5; y++) { let row = ''; for (let x = 0; x < 5; x++) row += grid[4 - x][y]; next.push(row); }
    grid = next;
  }
  return frames;
})();
const TIMED_TRAITS = ['Heal', 'Fireball', 'Huzzah', 'StarHat', 'NaturalToxin'];
const GLOB_SPEED = 100;  // the Druid's toxin glob, scene pixels per second
const GLOB_ARC = 8;      // how high the lob rises above the straight line
const SHOUT_SECONDS = 2.2;
const HAT_ROWS = ['...y...', '..bbb..', '..byb..', '.bbybb.', 'BBBBBBB'];

function plus(g, c, x, y) { g.rect(x - 1, y, 3, 1, c); g.rect(x, y - 1, 1, 3, c); }

export function installTraits(P) {
  const m = P.prototype;

  m._initTraits = function () {
    this.heroesUsed = new Set();   // every hero ever in a party (the page keeps it across restarts), for the party compendium
    this.onHeroes = null;
    this.traitTimer = {};
    this.memberRects = {};
    this.fireballs = [];
    this.axes = [];
    this.bolts = [];
    this.globs = [];
    this.toxinFlash = 0;
    this.heals = [];
    this.inspireLeft = 0; this.hatLeft = 0; this.shoutAge = -1; this.castFlash = 0; this.luckyFlash = 0;
    this.headSpots = new Map();
  };

  Object.defineProperties(m, {
    itemStorage: { get() { return this.party.indexOf('paca') >= 0 && !this.starting ? storageSlots(this.levelOf('paca')) : 0; } },
    partyInspired: { get() { return this.inspireLeft > 0; } },
    starHatsOn: { get() { return this.hatLeft > 0; } },
  });

  /** A party member's damage after any Huzzah! bonus. */
  m._withHuzzah = function (damage) {
    return this.partyInspired ? damage * huzzahDamageMultiplier(this.levelOf('warrior')) : damage;
  };

  /** Everyone in the party now counts as used (the pair at the campfire don't, until one is picked). */
  m._noteHeroesUsed = function () {
    if (this.starting || !this.heroesUsed) return;
    let added = false;
    for (const k of this.party) if (!this.heroesUsed.has(k)) { this.heroesUsed.add(k); added = true; }
    if (added && this.onHeroes) this.onHeroes(Array.from(this.heroesUsed));
  };

  /** One entry per hero, used or not, for the compendium: their numbers in one place (a balance reference). */
  m.partyBook = function () {
    this._noteHeroesUsed();
    const attack = kind => {
      switch (kind) {
        case 'paca': return 'Peck ' + peckDamage(1) + ' dmg / ' + peckInterval(1) + ' s';
        case 'warrior': return 'Thrown axe ' + axeDamage(1) + ' dmg / ' + axeInterval(1) + ' s, ' + axeRangeBlocks(1) + ' blocks';
        case 'thief': return 'Melee ' + BASIC_DAMAGE + ' dmg / ' + basicInterval(kind) + ' s when leading; crossbow ' + crossbowDamage(1) + ' dmg / ' + crossbowInterval(1) + ' s otherwise';
        case 'druid': return 'None';
        default: return 'Melee ' + BASIC_DAMAGE + ' dmg / ' + basicInterval(kind) + ' s when leading';
      }
    };
    return PARTY.map(k => ({
      kind: k, seen: this.heroesUsed.has(k), maxHp: this.maxHpOf(k),
      attack: attack(k), skill: traitSummary(k, 1) + (k === 'firemage' ? ' (' + fireballDamage(1) + ' dmg)' : '')
    }));
  };

  m._applyHeal = function (who, hp) { this._restoreHp(who, hp); };
  m._healthFraction = function (who) { const max = this.maxHpOf(who); return max > 0 ? this.hpOf(who) / max : 1.0; };

  /** Counts the timed traits down in adventuring time and fires them. */
  m._advanceTraits = function (dt, paused) {
    if (paused) return;
    for (const trait of TIMED_TRAITS) {
      const owner = TRAIT_OWNER[trait];
      if (!this._active(owner)) { delete this.traitTimer[trait]; continue; }   // out cold in the cart: no skills
      const level = this.levelOf(owner);
      let left = this.traitTimer[trait];
      if (left === undefined) left = traitInterval(trait, level);
      left -= dt;
      if (left <= 0) {
        if (trait === 'NaturalToxin' && !this._toxinTargetReady()) left = 0;   // ready, and waiting for something to cast it on
        else { this._fireTrait(trait, level); left = traitInterval(trait, level); }
      }
      this.traitTimer[trait] = left;
    }
    if (this.berserkLeft > 0) this.berserkLeft = Math.max(0, this.berserkLeft - dt);   // the Monster Berserker runs in adventuring time too
    if (this.inspireLeft > 0) this.inspireLeft = Math.max(0, this.inspireLeft - dt);
    if (this.hatLeft > 0) this.hatLeft = Math.max(0, this.hatLeft - dt);
  };

  m._fireTrait = function (trait, level) {
    switch (trait) {
      case 'Heal': {
        const target = this._weakestMember();
        const amount = healAmount(level);
        this._applyHeal(target, amount);
        this.heals.push({ from: 'lightmage', to: target, amount: amount, age: 0 });
        Sound.play('Heal');
        break;
      }
      case 'Fireball': {
        const r = this._rectOf('firemage');
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
      case 'NaturalToxin':
        this._castToxin();
        break;
    }
  };

  m._weakestMember = function () {
    let cands = this.party.filter(k => this.hpOf(k) > 0);   // the fainted are past the Light Mage's reach: only a potion wakes them
    if (cands.length === 0) cands = this.party.slice();
    let lowest = Infinity;
    for (const k of cands) lowest = Math.min(lowest, this._healthFraction(k));
    const pool = cands.filter(k => this._healthFraction(k) <= lowest + 1e-9);
    return pool[rnd(pool.length)];
  };

  m._rectOf = function (kind) {
    const r = this.memberRects[kind];
    if (r) return r;
    const i = this._lineIndexOf(kind);
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
        this._damageEnemy(target, this._withHuzzah(fireballDamage(this.levelOf('firemage'))), true, f.x, f.y);
        this.fireballs.splice(i, 1);
        continue;
      }
      if (f.x > this.lastLw + 12) this.fireballs.splice(i, 1);
    }
    // Axes lob up and over the party and come down on the enemy, or in the grass if it is out of reach.
    for (let i = this.axes.length - 1; i >= 0; i--) {
      const a = this.axes[i];
      a.age += dt;
      a.travel = Math.min(a.range, a.travel + dt * AXE_SPEED);
      const u = a.range > 0 ? a.travel / a.range : 1;
      a.x = a.startX + a.travel;
      a.y = a.startY + (a.endY - a.startY) * u - AXE_ARC * Math.sin(Math.PI * u);
      if (a.travel < a.range) continue;
      this.axes.splice(i, 1);
      if (target !== null && this.enemy !== null && this.enemy.deathT < 0 && a.x >= this.enemy.x - 0.5) {
        this._damageEnemy(this.enemy, this._withHuzzah(axeDamage(this.levelOf('warrior'))), false, a.x, a.y);
      } else {
        this.bursts.push({ x: a.x, y: this.groundY - 1, kind: 'peck', age: 0 });   // it sinks into the grass short of its mark
      }
      Sound.play('AxeHit');
    }
    // Bolts fly straight on to where the enemy was and hit it if it is still there (it only ever walks towards them).
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.travel = Math.min(b.range, b.travel + dt * BOLT_SPEED);
      const u = b.range > 0 ? b.travel / b.range : 1;
      b.x = b.startX + b.travel;
      b.y = b.startY + (b.endY - b.startY) * u - BOLT_ARC * Math.sin(Math.PI * u);
      if (b.travel < b.range) continue;
      this.bolts.splice(i, 1);
      if (this.enemy !== null && this.enemy.deathT < 0 && b.x >= this.enemy.x - 0.5) {
        this._damageEnemy(this.enemy, this._withHuzzah(crossbowDamage(this.levelOf('thief'))), false, b.x, b.y);
        Sound.play('Peck');
      }
    }
    // Toxin globs lob over the party to the enemy and, where they land, the poison takes hold (a new one renews it).
    for (let i = this.globs.length - 1; i >= 0; i--) {
      const gl = this.globs[i];
      gl.age += dt;
      gl.travel = Math.min(gl.range, gl.travel + dt * GLOB_SPEED);
      const u = gl.range > 0 ? gl.travel / gl.range : 1;
      gl.x = gl.startX + gl.travel;
      gl.y = gl.startY + (gl.endY - gl.startY) * u - GLOB_ARC * Math.sin(Math.PI * u);
      if (gl.travel < gl.range) continue;
      this.globs.splice(i, 1);
      if (this.enemy !== null && this.enemy.deathT < 0 && gl.x >= this.enemy.x - 0.5) {
        this.enemy.poisonTicks = toxinTicks(this.levelOf('druid'));
        this.enemy.poisonTick = 1.0;
        this.bursts.push({ x: gl.x, y: gl.y, kind: 'toxin', age: 0 });
        Sound.play('ToxinTick');
      }
    }
    if (this.toxinFlash > 0) this.toxinFlash = Math.max(0, this.toxinFlash - dt);

    if (this.castFlash > 0) this.castFlash = Math.max(0, this.castFlash - dt);
    if (this.luckyFlash > 0) this.luckyFlash = Math.max(0, this.luckyFlash - dt);
    if (this.shoutAge >= 0) { this.shoutAge += dt; if (this.shoutAge > SHOUT_SECONDS) this.shoutAge = -1; }
  };

  /** The Warrior's basic attack: throws an axe that travels up to axeRangeBlocks blocks of grass. */
  m._throwAxe = function (e, level) {
    const r = this._rectOf('warrior');
    const sx = r.x + r.w - 2, sy = r.y + 4;
    let range = axeRangeBlocks(level) * BLOCK_PIXELS;
    const toEnemy = e.x - sx;
    let endY = this.groundY - 2;   // short of the enemy it comes down in the grass
    if (toEnemy <= range) {
      range = Math.max(6, toEnemy);
      const er = this._enemyRect(e);
      endY = er.y + er.h * 0.4;
    }
    this.axes.push({ startX: sx, startY: sy, endY: endY, range: range, travel: 0, x: sx, y: sy, age: 0 });
    Sound.play('AxeThrow');
  };

  /** The Thief's crossbow: looses a bolt at the enemy. */
  m._fireBolt = function (e) {
    const r = this._rectOf('thief');
    const sx = r.x + r.w - 1, sy = r.y + r.h * 0.45;
    const er = this._enemyRect(e);
    this.bolts.push({ startX: sx, startY: sy, endY: er.y + er.h * 0.45, range: Math.max(6, e.x - sx), travel: 0, x: sx, y: sy });
    Sound.play('BowShot');
  };

  /** The toxin only goes off with something to cast it on: an enemy that is alive and on screen. */
  m._toxinTargetReady = function () { return this.enemy !== null && this.enemy.deathT < 0 && this.enemy.x < this.lastLw; };

  /** The Druid's Natural Toxin: a glob of venom is lobbed at the enemy. */
  m._castToxin = function () {
    const e = this.enemy;
    if (e === null) return;
    const r = this._rectOf('druid'), er = this._enemyRect(e);
    const sx = r.x + r.w - 2, sy = r.y + 5;
    this.globs.push({ startX: sx, startY: sy, endY: er.y + er.h * 0.45, range: Math.max(6, e.x - sx), travel: 0, x: sx, y: sy, age: 0 });
    this.toxinFlash = 0.35;
    Sound.play('ToxinCast');
  };

  m._drawToxin = function (g) {
    for (const gl of this.globs) {
      const x = Math.round(gl.x), y = Math.round(gl.y);
      g.rect(x + 3, y + 1, 1, 1, CA(130, 110, 220, 80));
      g.rect(x + 5, y, 1, 1, CA(130, 110, 220, 80));
      g.rect(x - 1, y - 1, 4, 4, C(30, 100, 50));
      g.rect(x, y, 2, 2, C(124, 232, 84));
      g.rect(x, y, 1, 1, C(220, 255, 170));
    }
    if (this.toxinFlash > 0 && this.party.indexOf('druid') >= 0) {
      const r = this._rectOf('druid');
      const u = 1 - this.toxinFlash / 0.35;
      const rad = 2 + Math.trunc(7 * u), cx = r.x + r.w - 1, cy = r.y + 5;
      g.ring(cx - rad, cy - rad, rad * 2, rad * 2, CA(Math.trunc(230 * (1 - u)), 110, 230, 90));
      g.rect(cx - 1, cy - 1, 3, 3, CA(Math.trunc(255 * (1 - u)), 200, 255, 150));
    }
  };

  m._drawBolts = function (g) {
    for (const b of this.bolts) {
      const x = Math.round(b.x), y = Math.round(b.y);
      g.rect(x - 4, y, 4, 1, C(176, 128, 74));
      g.rect(x - 5, y, 1, 1, C(210, 70, 60));
      g.rect(x, y, 2, 1, C(232, 236, 244));
    }
  };

  m._resetTraits = function () {
    this.traitTimer = {};
    this.fireballs.length = 0; this.axes.length = 0; this.bolts.length = 0; this.globs.length = 0; this.toxinFlash = 0; this.heals.length = 0;
    this.hp = {}; this.memberClip = {};
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
      list.push({ text: t('Huzzah!'), x: (r.x + r.w / 2.0) * this.lastScale, y: this.lastTop + (r.y - 3) * this.lastScale, alpha: Math.max(0, a), bubble: true, color: C(70, 24, 20) });
    }
    this._appendEnemyText(list);
    this._appendItemText(list);
    this._appendHpText(list);
    this._appendStartText(list);
    this._appendSwapText(list);
    return list;
  };

  // ---- Drawing -------------------------------------------------------------------------------------------

  m._drawTraitEffects = function (g, lw) {
    this._drawInspire(g);
    this._drawHeals(g);
    this._drawCastFlash(g);
    this._drawFireballs(g);
    this._drawAxes(g);
    this._drawBolts(g);
    this._drawToxin(g);
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
    if (this.castFlash <= 0 || this.party.indexOf('firemage') < 0) return;
    const r = this._rectOf('firemage');
    const u = 1 - this.castFlash / 0.35;
    const rad = 2 + Math.trunc(7 * u);
    const cx = r.x + r.w - 1, cy = r.y + 5;
    g.ring(cx - rad, cy - rad, rad * 2, rad * 2, CA(Math.trunc(230 * (1 - u)), 255, 150, 40));
    g.rect(cx - 1, cy - 1, 3, 3, CA(Math.trunc(255 * (1 - u)), 255, 230, 140));
  };

  m._drawAxes = function (g) {
    for (const a of this.axes) {
      const grid = AXE_FRAMES[Math.trunc(a.age * 16) % 4];
      const ox = Math.round(a.x) - 2, oy = Math.round(a.y) - 2;
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) {
          const col = AXE_COLORS[grid[y][x]];
          if (col) g.rect(ox + x, oy + y, 1, 1, col);
        }
    }
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
    if (this.luckyFlash <= 0 || this.party.indexOf('thief') < 0) return;
    const r = this._rectOf('thief');
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
