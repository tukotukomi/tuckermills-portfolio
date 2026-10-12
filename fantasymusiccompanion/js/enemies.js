// Enemies and the monster compendium's data. A port of src\PixelEnemies.cs and the definitions in src\EnemySprites.cs.
// One enemy at a time walks in from the right, closes the gap while the party keeps walking, stops in front of the first member and
// attacks it (for now only as an animation); the Paca pecks and the Fire Mage's fireballs fly into it.

import { C, CA, withAlpha, rnd } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';
import { peckDamage, peckInterval, axeInterval } from './traits.js';

export const ENEMY_KINDS = ['sheller', 'orc', 'nightmare'];
export const ENEMY_ENUM = { sheller: 'Sheller', orc: 'Orc', nightmare: 'Nightmare' };
const ENEMY_FROM_ENUM = { Sheller: 'sheller', Orc: 'orc', Nightmare: 'nightmare' };

const DEFS = {
  sheller: { name: 'Sheller', hp: 10, attackInterval: 2.0, walkSpeed: 20, nightOnly: false, headOffset: 0, habitat: 'Roams by day', note: 'A grumpy shell-back. Punches first, claws second.' },
  orc: { name: 'Orc', hp: 18, attackInterval: 3.0, walkSpeed: 15, nightOnly: false, headOffset: 7, habitat: 'Roams day and night', note: 'Fond of shiny earrings and swinging big sticks.' },
  nightmare: { name: 'Nightmare', hp: 12, attackInterval: 2.5, walkSpeed: 24, nightOnly: true, headOffset: 0, habitat: 'Roams after dark', note: 'A cloaked drifter that only calls after dark.' },
};

export function enemyDef(kind) { return DEFS[kind]; }

const ROAR = { sheller: 'ShellerRoar', orc: 'OrcRoar', nightmare: 'NightmareRoar' };
const DEATH = { sheller: 'ShellerDeath', orc: 'OrcDeath', nightmare: 'NightmareDeath' };
function attackFx(kind, pose, hit) {
  const p = kind === 'orc' ? (pose === 0 ? ['OrcSmashSwing', 'OrcSmashHit'] : ['OrcSweepSwing', 'OrcSweepHit'])
    : kind === 'nightmare' ? (pose === 0 ? ['NightmareSweepSwing', 'NightmareSweepHit'] : ['NightmareChopSwing', 'NightmareChopHit'])
      : (pose === 0 ? ['ShellerPunchSwing', 'ShellerPunchHit'] : ['ShellerClawSwing', 'ShellerClawHit']);
  return p[hit ? 1 : 0];
}
function strikeEffect(kind, pose) {
  if (kind === 'nightmare') return 'scythe';
  if (kind === 'orc') return 'impact';
  return pose === 0 ? 'impact' : 'claws';
}

const FIRST_ENEMY_SECONDS = 12;

export function installEnemies(P) {
  const m = P.prototype;

  m._initEnemies = function () {
    this.enemy = null;
    this.enemyTimer = FIRST_ENEMY_SECONDS;
    this.enemyAttacks = 0;
    this.damageTexts = [];
    this.bursts = [];
    this.peckAnim = -1;
    this.flinch = 0;
    this.kills = {};   // a kind is "known" once it has an entry here
  };

  Object.defineProperty(m, 'inCombat', { get() { return this.enemy !== null && this.enemy.deathT < 0; } });

  m._enemyRect = function (e) {
    const set = Sprites.enemy[e.kind];
    return { x: Math.round(e.x), y: this.groundY + 1 - set.h, w: set.w, h: set.h };
  };

  m._pickEnemyKind = function () {
    const pool = this.isNight ? ['nightmare', 'nightmare', 'orc'] : ['sheller', 'sheller', 'orc'];
    return pool[rnd(pool.length)];
  };

  m._canSpawnEnemy = function () {
    if (this.enc !== 'None' || this.story !== 'None' || this.camp > 0.01 || this.crystalActive) return false;
    if (this._needsTavern() && this.dayPhase >= 0.88 - 0.06) return false;
    return true;
  };

  m._spawnEnemy = function () {
    const kind = this._pickEnemyKind();
    this.enemy = { kind: kind, x: this.lastLw + 6, hp: DEFS[kind].hp, maxHp: DEFS[kind].hp, engaged: false, walkT: 0, attackTimer: 0, attackAnim: -1, attackPose: 0, struck: false, peckTimer: 0, axeTimer: 0, hurtFlash: 0, deathT: -1 };
    this._noteSeen(kind);
    Sound.play(ROAR[kind]);   // a warning as it comes into view
  };

  /** Enemy logic in adventuring time: the walk-in, the attack timer, the Paca's pecks. */
  m._advanceEnemies = function (dt, paused) {
    if (paused) return;
    if (this.enemy === null) {
      if (!this._canSpawnEnemy()) return;
      this.enemyTimer -= dt;
      if (this.enemyTimer <= 0) this._spawnEnemy();
      return;
    }
    const e = this.enemy;
    if (e.deathT >= 0) return;
    const front = this._rectOf(this.party[0]);
    const stopX = front.x + front.w + 1;

    if (!e.engaged) {
      const roadSpeed = 12.0 * this.clock.bpm / 112.0 * this.move;   // the road is still scrolling past under the party
      e.x -= (DEFS[e.kind].walkSpeed + roadSpeed) * dt;
      e.walkT += dt;
      if (e.x <= stopX) { e.x = stopX; e.engaged = true; e.attackTimer = 1.0; e.peckTimer = 0.6; e.axeTimer = 1.5; }
      return;
    }

    e.x = stopX;
    e.attackTimer -= dt;
    if (e.attackTimer <= 0 && e.attackAnim < 0) {
      e.attackAnim = 0;
      e.struck = false;
      e.attackPose = this.enemyAttacks++ % 2;
      e.attackTimer = DEFS[e.kind].attackInterval;
      Sound.play(attackFx(e.kind, e.attackPose, false));   // the wind-up
    }

    if (this.party.indexOf('paca') >= 0) {
      const level = this.levelOf('paca');
      e.peckTimer -= dt;
      if (e.peckTimer <= 0) {
        e.peckTimer += peckInterval(level);
        this.peckAnim = 0;
        Sound.play('Peck');
        this._damageEnemy(e, this._withHuzzah(peckDamage(level)), false, e.x, 0);
      }
    }

    // The Warrior throws an axe every few seconds while there is a fight.
    if (this.party.indexOf('warrior') >= 0 && e.deathT < 0) {
      const level = this.levelOf('warrior');
      e.axeTimer -= dt;
      if (e.axeTimer <= 0) {
        e.axeTimer += axeInterval(level);
        this._throwAxe(e, level);
      }
    }
  };

  m._damageEnemy = function (e, amount, fire, fx, fy) {
    if (e.deathT >= 0) return;
    e.hp = Math.max(0, e.hp - amount);
    e.hurtFlash = 0.14;
    if (fire) Sound.play('FireImpact');
    const r = this._enemyRect(e);
    this.damageTexts.push({
      x: r.x + r.w / 2.0 + (fire ? 0 : 2), y: r.y + DEFS[e.kind].headOffset - 4, age: 0, text: String(amount),
      color: fire ? C(255, 176, 64) : (this.partyInspired ? C(255, 226, 90) : C(255, 255, 255))
    });
    this.bursts.push({ x: fire ? Math.min(fx, r.x + r.w / 2.0) : r.x + 2, y: fire ? r.y + r.h * 0.4 : r.y + r.h * 0.35, kind: fire ? 'fire' : 'peck', age: 0 });
    if (e.hp <= 0) {
      e.deathT = 0;
      Sound.play(DEATH[e.kind]);
      Sound.play('CoinDrop');
      this._noteKill(e.kind);
      this.enemyTimer = 15 + Math.random() * 15;
      // It drops a coin where it fell: a real one, in the road, to be clicked before it drifts off like any other.
      this.coins.push({ worldX: this.scroll + r.x + r.w / 2.0, phase: Math.random() * 6 });
    }
  };

  /** Effects that play out in real time, even while the adventure is paused. */
  m._advanceEnemyEffects = function (dt) {
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      this.damageTexts[i].age += dt / 0.9;
      if (this.damageTexts[i].age >= 1) this.damageTexts.splice(i, 1);
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt / (b.kind === 'death' ? 0.8 : b.kind === 'fire' ? 0.4 : 0.3);
      if (b.age >= 1) this.bursts.splice(i, 1);
    }
    if (this.peckAnim >= 0) { this.peckAnim += dt / 0.25; if (this.peckAnim >= 1) this.peckAnim = -1; }
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt);

    const e = this.enemy;
    if (e === null) return;
    if (e.hurtFlash > 0) e.hurtFlash = Math.max(0, e.hurtFlash - dt);
    if (e.deathT >= 0) {
      const before = e.deathT;
      e.deathT += dt / 0.7;
      if (before === 0) this.bursts.push({ x: e.x + this._enemyRect(e).w / 2.0, y: this.groundY - 4, kind: 'death', age: 0 });
      if (e.deathT >= 1) this.enemy = null;
      return;
    }
    if (e.attackAnim >= 0) {
      e.attackAnim += dt / 0.55;
      if (!e.struck && e.attackAnim >= 0.5) {
        e.struck = true;
        Sound.play(attackFx(e.kind, e.attackPose, true));   // the blow lands
        const r = this._rectOf(this.party[0]);
        this.bursts.push({ x: r.x + r.w * 0.72, y: r.y + r.h * 0.45, kind: strikeEffect(e.kind, e.attackPose), age: 0 });
        this.flinch = 0.18;
      }
      if (e.attackAnim >= 1) e.attackAnim = -1;
    }
  };

  m._resetEnemies = function () {
    this.enemy = null;
    this.enemyTimer = FIRST_ENEMY_SECONDS;
    this.enemyAttacks = 0;
    this.damageTexts.length = 0;
    this.bursts.length = 0;
    this.peckAnim = -1;
    this.flinch = 0;
  };

  // ---- The compendium's data ----------------------------------------------------------------------------

  m.bestiary = function () {
    return ENEMY_KINDS.map(k => {
      const seen = this.kills[k] !== undefined;
      return { kind: k, name: DEFS[k].name, seen: seen, kills: seen ? this.kills[k] : 0, maxHp: DEFS[k].hp, habitat: DEFS[k].habitat, note: DEFS[k].note };
    });
  };

  m._noteSeen = function (kind) {
    if (this.kills[kind] === undefined) { this.kills[kind] = 0; this.raiseProgress(); }
  };

  m._noteKill = function (kind) {
    this.kills[kind] = (this.kills[kind] || 0) + 1;
    this.raiseProgress();
  };

  m._saveBestiaryFields = function () {
    return Object.keys(this.kills).map(k => ENEMY_ENUM[k] + '=' + this.kills[k]).join(';');
  };

  m._loadBestiaryFields = function (field) {
    this.kills = {};
    if (!field) return;
    for (const pair of field.split(';').filter(s => s)) {
      const kv = pair.split('=');
      const n = parseInt(kv[1], 10);
      if (kv.length === 2 && ENEMY_FROM_ENUM[kv[0]] && n >= 0) this.kills[ENEMY_FROM_ENUM[kv[0]]] = Math.min(n, 999999);
    }
  };

  // ---- Text for the page ------------------------------------------------------------------------------------

  m._appendEnemyText = function (list) {
    for (const d of this.damageTexts) {
      const u = d.age;
      list.push({ text: d.text, x: d.x * this.lastScale, y: this.lastTop + (d.y - u * 8) * this.lastScale, alpha: Math.max(0, Math.min(1, 1.5 * (1 - u * u))), bubble: false, color: d.color });
    }
    const e = this.enemy;
    if (e !== null && e.deathT < 0 && e.engaged) {
      const r = this._enemyRect(e);
      list.push({ text: DEFS[e.kind].name, x: (r.x + r.w / 2.0) * this.lastScale, y: this.lastTop + (r.y + DEFS[e.kind].headOffset - 11) * this.lastScale, alpha: 0.85, bubble: false, color: C(226, 230, 246) });
    }
  };

  // ---- Drawing --------------------------------------------------------------------------------------------------

  m._drawEnemies = function (g) {
    const e = this.enemy;
    if (e === null) return;
    const set = Sprites.enemy[e.kind];
    const r = this._enemyRect(e);
    let lunge = 0;
    let frame;

    if (e.deathT >= 0) frame = set.hurt;
    else {
      const walking = !e.engaged;
      frame = walking ? ((Math.trunc(e.walkT * 5)) % 2 === 0 ? set.walkA : set.walkB) : ((Math.trunc(this.time * 2)) % 2 === 0 ? set.walkA : set.walkB);
      if (e.attackAnim >= 0) {
        const u = e.attackAnim;
        if (u < 0.3) lunge = 1.5 * (u / 0.3);
        else if (u < 0.75) frame = e.attackPose === 0 ? set.attackA : set.attackB;
        if (u >= 0.3 && u < 0.5) lunge = 1.5 - 5.5 * ((u - 0.3) / 0.2);
        else if (u >= 0.5 && u < 0.75) lunge = -4 + 4 * ((u - 0.5) / 0.25);
      }
      if (e.hurtFlash > 0) frame = set.hurt;
    }

    const hover = e.kind === 'nightmare' ? 2 + Math.round(Math.sin(this.time * 3)) : 0;
    const x = Math.round(e.x + lunge);
    const y = r.y - hover + (e.deathT >= 0 ? Math.trunc(e.deathT * 3) : 0);
    g.ellipse(x + Math.trunc((set.w - 14) / 2), this.groundY, 14, 2, CA(90, 20, 30, 20));

    if (e.deathT >= 0) {
      g.image(frame, x, y, false, Math.max(0, 1 - e.deathT));
    } else {
      g.image(frame, x, y);
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      const bw = 16, bx = r.x + Math.trunc((set.w - bw) / 2), by = y + DEFS[e.kind].headOffset - 5;
      g.rect(bx - 1, by - 1, bw + 2, 4, CA(220, 30, 22, 40));
      const fill = ratio > 0.5 ? C(110, 214, 90) : ratio > 0.25 ? C(240, 200, 60) : C(230, 70, 60);
      g.rect(bx, by, Math.ceil(bw * ratio), 2, fill);
    }
  };

  m._drawEnemyEffects = function (g) {
    for (const b of this.bursts) {
      const u = b.age;
      const x = Math.round(b.x), y = Math.round(b.y);
      const fade = Math.trunc(255 * Math.max(0, 1 - u));
      switch (b.kind) {
        case 'fire': {
          const rad = 2 + Math.trunc(9 * u);
          g.ellipse(x - rad - 2, y - rad - 2, (rad + 2) * 2, (rad + 2) * 2, CA(Math.trunc(fade / 3), 255, 150, 40));
          g.ring(x - rad, y - rad, rad * 2, rad * 2, CA(fade, 255, 190, 70));
          for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4 + 0.3;
            const sx = x + Math.round(Math.cos(a) * (rad + 3)), sy = y + Math.round(Math.sin(a) * (rad + 3));
            g.rect(sx, sy, 2, 2, k % 2 === 0 ? CA(fade, 255, 226, 120) : CA(fade, 255, 120, 40));
          }
          break;
        }
        case 'peck': {
          const len = 1 + Math.trunc(3 * u);
          g.rect(x - len, y, len * 2 + 1, 1, CA(fade, 255, 255, 240));
          g.rect(x, y - len, 1, len * 2 + 1, CA(fade, 255, 255, 240));
          break;
        }
        case 'death': {
          for (let k = 0; k < 6; k++) {
            const a = k * Math.PI / 3;
            const px = x + Math.round(Math.cos(a) * (3 + 8 * u)), py = y - Math.trunc(8 * u) + Math.round(Math.sin(a) * (2 + 4 * u));
            const size = 2 + Math.trunc(2 * (1 - u));
            g.ellipse(px - size / 2, py - size / 2, size, size, CA(fade, 226, 224, 236));
          }
          break;
        }
        case 'impact': {
          const len = 2 + Math.trunc(5 * u);
          const c = CA(fade, 255, 244, 170);
          g.rect(x - len, y, len * 2 + 1, 2, c);
          g.rect(x, y - len, 2, len * 2 + 1, c);
          for (let k = 1; k <= len - 1; k++) {
            g.rect(x - k, y - k, 1, 1, c); g.rect(x + k, y - k, 1, 1, c);
            g.rect(x - k, y + k, 1, 1, c); g.rect(x + k, y + k, 1, 1, c);
          }
          break;
        }
        case 'claws': {
          for (let k = 0; k < 3; k++) {
            const grow = Math.max(0, Math.min(1, u * 3 - k * 0.45));
            if (grow <= 0) continue;
            const ox = x - 6 + k * 4;
            const steps = Math.trunc(14 * grow);
            for (let s = 0; s <= steps; s++) g.rect(ox + Math.trunc(6 * grow * s / Math.max(1, steps)), y - 7 + s, 1, 1, CA(fade, 255, 250, 235));
          }
          break;
        }
        case 'scythe': {
          const cx = x, cy = y + 1;
          const start = 200 + u * 60;
          for (let a = 0; a <= 110; a += 6) {
            const rad = (start + a) * Math.PI / 180;
            g.rect(Math.round(cx + Math.cos(rad) * 10), Math.round(cy + Math.sin(rad) * 10), 2, 1, CA(fade, 214, 196, 255));
          }
          break;
        }
      }
    }
  };
}
