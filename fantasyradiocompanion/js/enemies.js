// Enemies and the monster compendium's data. A port of src\PixelEnemies.cs and the definitions in src\EnemySprites.cs.
// One enemy at a time walks in from the right, closes the gap while the party keeps walking, stops in front of the first member and
// attacks it (for now only as an animation); the Paca pecks and the Fire Mage's fireballs fly into it.

import { C, CA, withAlpha, rnd, hash } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';
import { peckDamage, peckInterval, axeInterval, axeRangeBlocks, BLOCK_PIXELS, crossbowInterval, toxinDamage, BASIC_ATTACKERS, basicDamage, goo, GOO_PALETTES, basicInterval, paladinLightInterval, paladinLightTicks, paladinLightDamage, scytheDamage, scytheInterval, SPELL_RANGE_BLOCKS } from './traits.js';

const BOW_FIRST_DELAY = 1.5;   // seconds from the Thief first being able to shoot to his first bolt
import { t } from './i18n.js';

// The four originals, then the variant of each that takes over half the spawns from Year 2 (same moves, twice the damage) and all of
// them from Year 3, then the Toucan (no variant: it joins them from Year 3).
export const ENEMY_KINDS = ['sheller', 'orc', 'nightmare', 'gargogryph', 'spikedsheller', 'bassorc', 'slasher', 'wickedgryph', 'toucan', 'magmashellra', 'percussiveorc', 'shadecrow', 'sandcrab', 'venomflayer'];
export const ENEMY_ENUM = { sheller: 'Sheller', orc: 'Orc', nightmare: 'Nightmare', gargogryph: 'Gargogryph', spikedsheller: 'SpikedSheller', bassorc: 'BassOrc', slasher: 'Slasher', wickedgryph: 'Wickedgryph', toucan: 'Toucan', magmashellra: 'MagmaShellra', percussiveorc: 'PercussiveOrc', shadecrow: 'Shadecrow', sandcrab: 'SandCrab', venomflayer: 'VenomFlayer' };
const ENEMY_FROM_ENUM = { Sheller: 'sheller', Orc: 'orc', Nightmare: 'nightmare', Gargogryph: 'gargogryph', SpikedSheller: 'spikedsheller', BassOrc: 'bassorc', Slasher: 'slasher', Wickedgryph: 'wickedgryph', Toucan: 'toucan', MagmaShellra: 'magmashellra', PercussiveOrc: 'percussiveorc', Shadecrow: 'shadecrow', SandCrab: 'sandcrab', VenomFlayer: 'venomflayer' };

const DEFS = {
  toucan: { name: 'Toucan', hp: 48, attackInterval: 1.0, walkSpeed: 22, nightOnly: false, headOffset: 0, hover: 6, habitat: 'Roams day and night, from Year 3', note: 'A purple toucan made of two tin cans, with metal talons. It slings a can tab that slices through the whole party.' },
  sheller: { name: 'Sheller', hp: 10, attackInterval: 2.0, walkSpeed: 20, nightOnly: false, headOffset: 0, habitat: 'Roams by day', note: 'A grumpy shell-back. Punches first, claws second.' },
  orc: { name: 'Orc', hp: 18, attackInterval: 3.0, walkSpeed: 15, nightOnly: false, headOffset: 7, habitat: 'Roams day and night', note: 'Fond of shiny earrings and swinging big sticks.' },
  nightmare: { name: 'Nightmare', hp: 12, attackInterval: 2.5, walkSpeed: 24, nightOnly: true, headOffset: 4, hover: 2, habitat: 'Roams after dark', note: 'A cloaked drifter that only calls after dark. Its scythe cuts through the first two in line.' },
  gargogryph: { name: 'Gargogryph', hp: 40, attackInterval: 3.5, walkSpeed: 18, nightOnly: true, headOffset: 4, hover: 5, standoff: 30, habitat: 'Only under a dark sky', note: 'A stone lion-ox with eagle wings, hard to hurt. Wingbeats throw razor feathers, and it can call down a Blood Moon.' },
};

DEFS.spikedsheller = Object.assign({}, DEFS.sheller, { base: 'sheller', name: 'Spiked Sheller', hp: 20, habitat: 'Roams by day, from Year 2', note: 'A Sheller that grew spikes over the winter. Hits twice as hard.' });
DEFS.bassorc = Object.assign({}, DEFS.orc, { base: 'orc', name: 'Bass Orc', hp: 36, habitat: 'Roams day and night, from Year 2', note: 'Plays its orcish bass guitar at the party, and swings it, too. Hits twice as hard.' });
DEFS.slasher = Object.assign({}, DEFS.nightmare, { base: 'nightmare', name: 'Slasher', hp: 24, habitat: 'Roams after dark, from Year 2', headOffset: 0, note: 'A Nightmare that traded its scythe for a horror knife. Hits twice as hard, and still cuts through the first two in line.' });
DEFS.wickedgryph = Object.assign({}, DEFS.gargogryph, { base: 'gargogryph', name: 'Wickedgryph', hp: 80, habitat: 'Only under a dark sky, from Year 2', note: 'A Gargogryph with big fangs and a worse temper. Hits twice as hard, and so does its Blood Moon.' });

// The Year 4 monsters: half of their family's spawns, with stats of their own.
DEFS.magmashellra = Object.assign({}, DEFS.sheller, { base: 'sheller', name: 'Magma Shellra', hp: 40, damage: 8, attackInterval: 3.0, reach: 2, standoff: 16, habitat: 'Roams by day, from Year 4', note: 'A Sheller whose shell has split open to molten rock. It spits a fireball that scorches the first two in line.' });
DEFS.percussiveorc = Object.assign({}, DEFS.orc, { base: 'orc', name: 'Percussive Orc', hp: 72, damage: 4, attackInterval: 1.0, habitat: 'Roams day and night, from Year 4', note: 'Hammers a drum slung at its belly and bellows between beats. Hits fast and hard.' });
DEFS.shadecrow = Object.assign({}, DEFS.nightmare, { base: 'nightmare', name: 'Shadecrow', hp: 48, damage: 6, attackInterval: 4.0, reach: 3, headOffset: 4, habitat: 'Roams after dark, from Year 4', note: 'A cloaked scarecrow that watches from the field. Its long pitchfork spears the first three in line.' });

// The Year 5 desert monsters: the only ones that turn up in Year 5. Their specials are in the attack code below.
DEFS.sandcrab = { name: 'Sand Crab', hp: 110, damage: 10, attackInterval: 1.5, walkSpeed: 16, nightOnly: false, headOffset: 0, habitat: 'Roams the Year 5 desert, day and night', note: 'A big tan crab with a cactus-ridged shell. Its claw pinches the first in line, and at half health it kicks up a Sand Blast: it hurts the whole party and Blinds every hero, so their next attack misses.' };
DEFS.venomflayer = { name: 'Venom Flayer', hp: 70, damage: 8, attackInterval: 5.0, walkSpeed: 22, nightOnly: false, headOffset: 0, habitat: 'Roams the Year 5 desert, day and night', note: 'An imposing cobra with glinting fangs. Its bite poisons the first in line, and at 30% health it spits Venom over the first three, poisoning each of them.' };

/** The original a variant is built on (an original is its own): a variant behaves, sounds and moves like it. */
const baseOf = kind => DEFS[kind].base || kind;
const isVariant = kind => baseOf(kind) !== kind;
/** How many members of the party one of its blows reaches: the Nightmare's scythe cuts through the first two in the line. */
const reachOf = kind => (DEFS[kind].reach !== undefined ? DEFS[kind].reach : (baseOf(kind) === 'nightmare' ? 2 : 1));
const VARIANT_OF = { sheller: 'spikedsheller', orc: 'bassorc', nightmare: 'slasher', gargogryph: 'wickedgryph' };
/** The top tier of a family, half of its spawns from Year 4 (a family with no third tier tops out at its variant). */
const THIRD_OF = { sheller: 'magmashellra', orc: 'percussiveorc', nightmare: 'shadecrow', gargogryph: 'wickedgryph' };

/** HP an attack takes off the member it lands on: 2 for most (doubled from 1), 4 for the Gargogryph (a whole volley of feathers counts as one attack); the variants hit twice as hard again. */
const enemyDamage = kind => (DEFS[kind].damage !== undefined ? DEFS[kind].damage : baseOf(kind) === 'toucan' ? 2 : (baseOf(kind) === 'gargogryph' ? 4 : 2) * (isVariant(kind) ? 2 : 1));   // the Toucan: a fixed 2 to every member its can tab cuts
/** HP the Blood Moon takes off every member of the party when it breaks (a Wickedgryph's takes twice as much). */
const bloodMoonDamage = kind => (isVariant(kind) ? 10 : 5);   // the Gargogryph's Blood Moon 5, the Wickedgryph's (Blood Moon II) 10

export function enemyDef(kind) { return DEFS[kind]; }

const ROAR = { sheller: 'ShellerRoar', orc: 'OrcRoar', nightmare: 'NightmareRoar', gargogryph: 'GargogryphRoar', toucan: 'ToucanRoar', sandcrab: 'ShellerRoar', venomflayer: 'NightmareRoar' };
const DEATH = { sheller: 'ShellerDeath', orc: 'OrcDeath', nightmare: 'NightmareDeath', gargogryph: 'GargogryphDeath', toucan: 'ToucanDeath', sandcrab: 'ShellerDeath', venomflayer: 'NightmareDeath' };
const BLOOD_MOON_SECONDS = 3.2;
const SAND_BLAST_HP_FRACTION = 0.5, VENOM_SPIT_HP_FRACTION = 0.3, SAND_BLAST_SECONDS = 1.8, VENOM_SPIT_SECONDS = 0.6;
const SAND_BLAST_DAMAGE = 5, VENOM_SPIT_DAMAGE = 3, VENOM_SPIT_TICKS = 3;
const BLOOD_MOON_HP_FRACTION = 0.55;   // it is called down once, when the Gargogryph is hurt this badly
function attackFx(kind, pose, hit) {
  if (kind === 'magmashellra') return hit ? 'MagmaSpit' : 'FireCast';   // the fire gathers, then is spat
  if (kind === 'percussiveorc') return pose === 0 ? (hit ? 'OrcSmashHit' : 'OrcSmashSwing') : (hit ? 'OrcShout' : 'OrcSweepSwing');   // the drumstick, then the shout
  if (kind === 'venomflayer') return hit ? 'NightmareChopHit' : 'NightmareChopSwing';
  kind = baseOf(kind);
  if (kind === 'gargogryph') return hit ? 'GargogryphShot' : 'GargogryphFlap';
  if (kind === 'toucan') return hit ? 'ToucanSling' : 'ToucanSwing';   // (the tab's own clang plays as it cuts a member)
  const p = kind === 'orc' ? (pose === 0 ? ['OrcSmashSwing', 'OrcSmashHit'] : ['OrcSweepSwing', 'OrcSweepHit'])
    : kind === 'nightmare' ? (pose === 0 ? ['NightmareSweepSwing', 'NightmareSweepHit'] : ['NightmareChopSwing', 'NightmareChopHit'])
      : (pose === 0 ? ['ShellerPunchSwing', 'ShellerPunchHit'] : ['ShellerClawSwing', 'ShellerClawHit']);
  return p[hit ? 1 : 0];
}
function strikeEffect(kind, pose) {
  if (kind === 'magmashellra') return 'fireball';
  if (kind === 'percussiveorc') return pose === 0 ? 'impact' : 'shout';
  if (kind === 'sandcrab') return 'claws';
  if (kind === 'venomflayer') return 'fangs';
  kind = baseOf(kind);
  if (kind === 'gargogryph') return 'feathers';
  if (kind === 'nightmare') return 'scythe';
  if (kind === 'toucan') return 'tab';
  if (kind === 'orc') return 'impact';
  return pose === 0 ? 'impact' : 'claws';
}

const FIRST_ENEMY_SECONDS = 12;
const SPIT_SECONDS = 0.5, SPIT_ARC = 16;   // the Magma Shellra's fireball: how long its lob takes, and how high it rises

/** A poisoned enemy's frame: the same picture washed a little green (made once per frame image and kept). */
const POISONED = new WeakMap();
function poisonedFrame(img) {
  let c = POISONED.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(70,255,70,0.22)';
    x.fillRect(0, 0, c.width, c.height);
    POISONED.set(img, c);
  }
  return c;
}
const TAB_SPEED = 140;   // the Toucan's can tab, scene pixels per second
// Its four spin positions (6x6): a ring seen flat, edge-on, and turning.
const TAB_SHAPES = [
  [[1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [5, 1], [1, 2], [2, 2], [3, 2], [4, 2]],
  [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [1, 0], [0, 1], [3, 4], [4, 3]],
  [[1, 0], [0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 3], [3, 2], [3, 1], [2, 0]],
  [[4, 0], [3, 1], [2, 2], [1, 3], [0, 4], [3, 0], [4, 1], [0, 3], [1, 4]],
];

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
    this.shots = [];   // the Gargogryph's feathers in flight
    this.tabs = [];    // the Toucan's can tabs in flight
    this.sandT = -1; this.sandStruck = false;   // the Sand Crab's Sand Blast: 0..1 while it plays out
    this.venomSpits = [];   // the Venom Flayer's globs in flight
    this.spits = [];   // the Magma Shellra's fireballs in flight (lobbed, to come down on the ground and burst into flames)
    this.bloodMoonT = -1;   // 0..1 while the Blood Moon plays out, <0 otherwise
    this.bloodMoonStruck = false;
    this.kills = {};   // a kind is "known" once it has an entry here
    this.basicTimer = {};   // seconds to each basic attack of the Thief, Fae, Light Mage and Fire Mage
    this.bowTimer = BOW_FIRST_DELAY;   // seconds to the Thief's next crossbow bolt
  };

  Object.defineProperty(m, 'inCombat', { get() { return this.enemy !== null && this.enemy.deathT < 0; } });

  m._enemyRect = function (e) {
    const set = Sprites.enemy[e.kind];
    return { x: Math.round(e.x), y: this.groundY + 1 - set.h - (DEFS[e.kind].hover || 0), w: set.w, h: set.h };
  };

  m._pickEnemyKind = function () {
    if (this.year === 5) return Math.random() < 0.5 ? 'sandcrab' : 'venomflayer';   // the whole of Year 5 is spent in the desert, with only its own monsters
    // Twice the old weights (the Sheller and the Nightmare 4, the Orc and the Gargogryph 2) so that the Toucan, at 1, turns up
    // half as often as the rarest of the others.
    const pool = this.isNight
      ? ['nightmare', 'nightmare', 'nightmare', 'nightmare', 'orc', 'orc', 'gargogryph', 'gargogryph']
      : ['sheller', 'sheller', 'sheller', 'sheller', 'orc', 'orc'];
    if (this.year >= 3) pool.push('toucan');   // the Toucan only joins from Year 3
    let kind = pool[rnd(pool.length)];
    // From Year 2 half of them turn up as their meaner variant, from Year 3 only the variants do, and from Year 4 half of each family
    // is the top tier (the Toucan has no variants).
    if (this.year >= 4) kind = Math.random() < 0.5 ? (THIRD_OF[kind] || kind) : (VARIANT_OF[kind] || kind);
    else if (this.year >= 3 || (this.year >= 2 && Math.random() < 0.5)) kind = VARIANT_OF[kind] || kind;
    return kind;
  };

  m._canSpawnEnemy = function () {
    if (this.enc !== 'None' || this.story !== 'None' || this.camp > 0.01 || this.crystalActive || (this.merchantActive && !this.merchantMet)) return false;
    if (this._needsTavern() && this.dayPhase >= 0.88 - 0.06) return false;
    return true;
  };

  m._spawnEnemy = function () {
    const kind = this._pickEnemyKind();
    this.enemy = { kind: kind, x: this.lastLw + 6, hp: DEFS[kind].hp, maxHp: DEFS[kind].hp, engaged: false, walkT: 0, attackTimer: 0, attackAnim: -1, attackPose: 0, struck: false, peckTimer: 0, axeTimer: 0, axeStarted: false, poisonTicks: 0, poisonTick: 0, lightTicks: 0, lightTick: 0, bloodMoonUsed: false, specialUsed: false, hurtFlash: 0, deathT: -1 };
    this.basicTimer = {};
    this.bowTimer = BOW_FIRST_DELAY;
    this._noteSeen(kind);
    Sound.play(ROAR[baseOf(kind)]);   // a warning as it comes into view
  };

  /** Enemy logic in adventuring time: the walk-in, the attack timer, the Paca's pecks. */
  m._advanceEnemies = function (dt, paused) {
    if (paused) return;
    this._advanceStatus(dt);   // poison ticks, in adventuring time
    if (this.enemy === null) {
      if (!this._canSpawnEnemy()) return;
      this.enemyTimer -= dt;
      if (this.enemyTimer <= 0) this._spawnEnemy();
      return;
    }
    const e = this.enemy;
    if (e.deathT >= 0) return;

    // The Druid's Natural Toxin: a tick of damage every second until it has run its course.
    if (e.poisonTicks > 0) {
      e.poisonTick -= dt;
      if (e.poisonTick <= 0) {
        e.poisonTick += 1.0;
        e.poisonTicks--;
        this._damageEnemy(e, this._withHuzzah(toxinDamage(this.levelOf('druid'))), false, e.x, 0, true);
        if (e.deathT >= 0) return;
      }
    }

    // The Paladin's light: a tick of damage every second until it has run its course.
    if (e.lightTicks > 0) {
      e.lightTick -= dt;
      if (e.lightTick <= 0) {
        e.lightTick += 1.0;
        e.lightTicks--;
        this._damageEnemy(e, this._withHuzzah(paladinLightDamage(this.levelOf('paladin'))), false, e.x, 0, false, true);
        if (e.deathT >= 0) return;
      }
    }

    const front = this._rectOf(this._frontKind());
    // Ranged enemies keep their distance, as far as there is room for them on screen.
    const room = Math.max(0, this.lastLw - (front.x + front.w + 1) - Sprites.enemy[e.kind].w - 2);
    let stopX = front.x + front.w + 1 + Math.min(DEFS[e.kind].standoff || 0, room);
    if (DEFS[e.kind].standoff)   // on a very narrow view a flier hangs over the leader's shoulder rather than leave the screen
      stopX = Math.max(front.x + front.w + 1 - 12, Math.min(stopX, this.lastLw - Sprites.enemy[e.kind].w - 1));    if (!e.engaged) {
      const roadSpeed = 12.0 * this.clock.bpm / 112.0 * this.move;   // the road is still scrolling past under the party
      e.x -= (DEFS[e.kind].walkSpeed + roadSpeed) * dt;
      e.walkT += dt;
      this._warriorAxeOnApproach(e, dt);   // his axe flies as soon as it is within reach, not only when it has arrived
      this._thiefCrossbow(e, dt);
      if (e.x <= stopX) {
        e.x = stopX; e.engaged = true; e.attackTimer = 1.0; e.peckTimer = 0.6;
        if (!e.axeStarted) e.axeTimer = 1.5;   // (otherwise the axes already in the air keep their rhythm)
      }
      return;
    }

    e.x = stopX;

    // The Gargogryph's special: once, when it is badly hurt, it calls down a Blood Moon in place of an attack.
    if (baseOf(e.kind) === 'gargogryph' && !e.bloodMoonUsed && e.hp <= e.maxHp * BLOOD_MOON_HP_FRACTION && e.attackAnim < 0 && this.bloodMoonT < 0) {
      e.bloodMoonUsed = true;
      this.bloodMoonDamage = bloodMoonDamage(e.kind);
      this.bloodMoonT = 0;
      this.bloodMoonStruck = false;
      e.attackTimer = 5.5;   // and a breather afterwards
      Sound.play('BloodMoon');
    }

    // The Year 5 specials, once each, in place of an attack: the Sand Crab's Sand Blast at half health, the Venom Flayer's Venom Spit at 30%.
    if (!e.specialUsed && e.attackAnim < 0 && this.bloodMoonT < 0 && this.sandT < 0) {
      if (e.kind === 'sandcrab' && e.hp <= e.maxHp * SAND_BLAST_HP_FRACTION) {
        e.specialUsed = true;
        this.sandT = 0; this.sandStruck = false;
        e.attackAnim = 0; e.struck = true; e.attackPose = 1;   // it rears up, claws high (nothing lands from the animation itself)
        e.attackTimer = DEFS[e.kind].attackInterval + 1.5;
        Sound.play('GargogryphFlap');
      } else if (e.kind === 'venomflayer' && e.hp <= e.maxHp * VENOM_SPIT_HP_FRACTION) {
        e.specialUsed = true;
        e.attackAnim = 0; e.struck = true; e.attackPose = 0;
        e.attackTimer = DEFS[e.kind].attackInterval + 1.0;
        this._spitVenom(e);
        Sound.play('ToxinCast');
      }
    }

    e.attackTimer -= dt;
    if (e.attackTimer <= 0 && e.attackAnim < 0 && this.bloodMoonT < 0 && this.sandT < 0) {
      e.attackAnim = 0;
      e.struck = false;
      e.attackPose = this.enemyAttacks++ % 2;
      e.attackTimer = DEFS[e.kind].attackInterval;
      Sound.play(attackFx(e.kind, e.attackPose, false));   // the wind-up
    }

    if (this._active('paca')) {
      const level = this.levelOf('paca');
      e.peckTimer -= dt;
      if (e.peckTimer <= 0) {
        e.peckTimer += peckInterval(level);
        this.peckAnim = 0;
        if (!this._takeBlind('paca')) {
          Sound.play('Peck');
          this._damageEnemy(e, this._withHuzzah(peckDamage(level)), false, e.x, 0);
        }
      }
    }

    // The Thief, Fae, Light Mage and Fire Mage have a basic attack of their own, but only while they lead the line and stand right
    // next to the enemy. A flier that hangs back at its standoff (the Gargogryph and its variant) can still be struck: otherwise
    // the melee fighters would be useless against it.
    {
      const lead = this._frontKind();
      const rr = this._rectOf(lead), adjacent = e.deathT < 0 && (!!DEFS[e.kind].standoff || e.x - (rr.x + rr.w) <= 4);
      for (const who of BASIC_ATTACKERS) {
        const interval = basicInterval(who);
        if (who !== lead || !this._active(who) || !adjacent) { this.basicTimer[who] = interval; continue; }
        let left = this.basicTimer[who] === undefined ? interval : this.basicTimer[who];
        left -= dt;
        if (left <= 0) {
          left += interval;
          this.peckAnim = 0;   // the leader lunges
          if (!this._takeBlind(who)) {
            Sound.play('Peck');
            this._damageEnemy(e, this._withHuzzah(basicDamage(this.levelOf(who))), false, e.x, 0);
          }
        }
        this.basicTimer[who] = left;
      }

      // The Shadow Knight swings a scythe from the first or the second place: its long reach takes in an enemy at the front of the line.
      {
        const knight = 'shadowknight', interval = scytheInterval(this.levelOf(knight));
        if (!this._active(knight) || this._lineIndexOf(knight) > 1 || !adjacent) this.basicTimer[knight] = interval;
        else {
          let left = this.basicTimer[knight] === undefined ? interval : this.basicTimer[knight];
          left -= dt;
          if (left <= 0) {
            left += interval;
            if (knight === lead) this.peckAnim = 0;   // (the leader lunges)
            if (!this._takeBlind(knight)) {
              Sound.play('Peck');
              this._damageEnemy(e, this._withHuzzah(scytheDamage(this.levelOf(knight))), false, e.x, 0);
            }
          }
          this.basicTimer[knight] = left;
        }
      }
    }

    this._thiefCrossbow(e, dt);
    this._paladinLight(e, dt);

    // The Warrior throws an axe every few seconds while there is a fight.
    if (this._active('warrior') && e.deathT < 0) {
      const level = this.levelOf('warrior');
      e.axeTimer -= dt;
      if (e.axeTimer <= 0) {
        e.axeTimer += axeInterval(level);
        this._throwAxe(e, level);
      }
    }
  };

  /** The Thief's crossbow: whenever he cannot make his basic melee attack (he is not leading the line, or the enemy is still
   *  walking in) and the enemy is on screen, a bolt for 2 damage every 5 seconds. */
  /** The Paladin from any place but the front: every 3 seconds a beam of light on an enemy in range, 2 damage over the next 2 seconds.
   * (At the front he strikes in melee instead; see the basic attackers.) */
  m._paladinLight = function (e, dt) {
    const level = this.levelOf('paladin'), interval = paladinLightInterval(level);
    const ready = this._active('paladin') && this._frontKind() !== 'paladin' && e.deathT < 0 && e.x < this.lastLw
      && e.x - (this._rectOf('paladin').x + this._rectOf('paladin').w) <= SPELL_RANGE_BLOCKS * BLOCK_PIXELS;
    if (!ready) { this.lightTimer = interval; return; }
    this.lightTimer = (this.lightTimer === undefined ? interval : this.lightTimer) - dt;
    if (this.lightTimer > 0) return;
    this.lightTimer += interval;
    if (this._takeBlind('paladin')) return;   // sand in the eyes: it misses
    e.lightTicks = paladinLightTicks(level);
    e.lightTick = 1.0;
    const pr = this._rectOf('paladin'), er = this._enemyRect(e);
    this.beams.push({ x1: pr.x + pr.w - 2, y1: pr.y + pr.h * 0.4, x2: er.x + er.w * 0.3, y2: er.y + er.h * 0.45, age: 0 });
    Sound.play('StarHat');
  };

  m._drawBeams = function (g) {
    for (const b of this.beams) {
      const a = Math.trunc(235 * Math.max(0, 1 - b.age));
      const n = Math.max(Math.abs(b.x2 - b.x1), Math.abs(b.y2 - b.y1), 1);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(b.x1 + (b.x2 - b.x1) * i / n), y = Math.round(b.y1 + (b.y2 - b.y1) * i / n);
        g.rect(x, y - 1, 1, 3, CA(Math.trunc(a / 3), 255, 226, 120));
        g.rect(x, y, 1, 1, CA(a, 255, 250, 214));
      }
    }
  };

  m._thiefCrossbow = function (e, dt) {
    const rr = this._rectOf('thief');
    const melee = this._frontKind() === 'thief' && (!!DEFS[e.kind].standoff || e.x - (rr.x + rr.w) <= 4);
    if (!this._active('thief') || e.deathT >= 0 || e.x >= this.lastLw || melee) { this.bowTimer = BOW_FIRST_DELAY; return; }
    this.bowTimer -= dt;
    if (this.bowTimer > 0) return;
    this.bowTimer += crossbowInterval(this.levelOf('thief'));
    this._fireBolt(e);
  };

  /** While an enemy is still walking in, the Warrior starts throwing axes once it is on screen and within the axe's reach. */
  m._warriorAxeOnApproach = function (e, dt) {
    if (!this._active('warrior') || e.deathT >= 0) return;
    const level = this.levelOf('warrior');
    const reach = axeRangeBlocks(level) * BLOCK_PIXELS;
    const wr = this._rectOf('warrior'), hand = wr.x + wr.w - 2;
    if (e.x >= this.lastLw || e.x - hand > reach) { if (!e.axeStarted) e.axeTimer = 0.4; return; }   // not yet: the first axe leaves a moment after it comes within reach
    e.axeTimer -= dt;
    if (e.axeTimer <= 0) {
      e.axeTimer += axeInterval(level);
      e.axeStarted = true;
      this._throwAxe(e, level);
    }
  };

  m._damageEnemy = function (e, amount, fire, fx, fy, toxin, light) {
    if (e.deathT >= 0) return;
    e.hp = Math.max(0, e.hp - amount);
    if (!toxin && !light) e.hurtFlash = 0.14;   // (a poison tick doesn't blanch it, so the green shows)
    if (fire) Sound.play('FireImpact');
    const r = this._enemyRect(e);
    this.damageTexts.push({
      x: r.x + r.w / 2.0 + (fire ? 0 : 2), y: r.y + DEFS[e.kind].headOffset - 4, age: 0, text: String(amount),
      color: light ? C(255, 238, 150) : toxin ? C(150, 240, 100) : fire ? C(255, 176, 64) : (this.partyInspired ? C(255, 226, 90) : C(255, 255, 255))
    });
    this.bursts.push({ x: fire ? Math.min(fx, r.x + r.w / 2.0) : r.x + 2, y: fire ? r.y + r.h * 0.4 : r.y + r.h * 0.35, kind: light ? 'light' : toxin ? 'toxin' : fire ? 'fire' : 'peck', age: 0 });
    if (e.hp <= 0) {
      e.deathT = 0;
      Sound.play(DEATH[baseOf(e.kind)]);
      Sound.play('CoinDrop');
      this._noteKill(e.kind);
      this.enemyTimer = 15 + Math.random() * 15;
      // It drops a coin where it fell: a real one, in the road, to be clicked before it drifts off like any other.
      this.coins.push({ worldX: this.scroll + r.x + r.w / 2.0, phase: Math.random() * 6 });
      if (baseOf(e.kind) === 'gargogryph' || e.kind === 'toucan') this._maybeDropScroll(r);   // the hard ones may also leave a scroll, which the party picks up by itself
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
      if (b.stick && this.enemy !== null) b.x = this.enemy.x + b.off;   // the slime goes where the enemy goes
      b.age += dt / (b.kind === 'death' ? 0.8 : b.kind === 'blood' ? 0.7 : b.kind === 'fire' ? 0.4 : b.kind === 'toxin' ? 0.55 : b.kind === 'shout' ? 0.45 : b.kind === 'ash' ? 0.9 : b.kind === 'flames' ? 0.75 : b.kind === 'drain' ? 0.6 : b.kind === 'light' ? 0.5 : b.kind === 'splat' ? 0.95 : b.kind === 'sand' ? 0.7 : 0.3);
      if (b.age >= 1) this.bursts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].age += dt / 0.4; if (this.beams[i].age >= 1) this.beams.splice(i, 1); }
    if (this.peckAnim >= 0) { this.peckAnim += dt / 0.25; if (this.peckAnim >= 1) this.peckAnim = -1; }
    if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt);

    // Feathers in flight, from the Gargogryph's wings to the front of the party.
    if (this.shots.length > 0) {
      const fr = this._rectOf(this._frontKind());
      const hitX = fr.x + fr.w * 0.8;
      for (let i = this.shots.length - 1; i >= 0; i--) {
        const s = this.shots[i];
        if (s.delay > 0) { s.delay -= dt; continue; }
        s.age += dt;
        s.x -= dt * 78;
        s.y += Math.max(-dt * 22, Math.min(dt * 22, s.targetY - s.y));
        if (s.x <= hitX) {
          this.bursts.push({ x: hitX, y: s.y, kind: 'feather', age: 0 });
          Sound.play('GargogryphShardHit');
          if (s.damage > 0) this.damageMember(this._frontKind(), s.damage * this.monsterDamageMultiplier);
          this.flinch = 0.14;
          this.shots.splice(i, 1);
        }
      }
    }

    // Spat fireballs are lobbed in an arc that comes down on the ground in front of the party, where they burst into flames that
    // catch the first members.
    for (let i = this.spits.length - 1; i >= 0; i--) {
      const sp = this.spits[i];
      sp.age += dt;
      const u = Math.min(1, sp.age / SPIT_SECONDS);
      sp.x = sp.startX + (sp.endX - sp.startX) * u;
      sp.y = sp.startY + (sp.endY - sp.startY) * u - SPIT_ARC * Math.sin(Math.PI * u);
      if (u < 1) continue;
      const hit = this._lineOrder().filter(k => this.hpOf(k) > 0).slice(0, reachOf('magmashellra'));
      if (hit.length === 0) hit.push(this._frontKind());
      let left = Infinity, right = -Infinity;
      for (const k of hit) {
        const hr = this._rectOf(k);
        left = Math.min(left, hr.x); right = Math.max(right, hr.x + hr.w);
        this.damageMember(k, enemyDamage('magmashellra') * this.monsterDamageMultiplier);
      }
      this.bursts.push({ x: (left + right) / 2, y: this.groundY, w: right - left + 8, kind: 'flames', age: 0 });
      this.bursts.push({ x: sp.endX, y: this.groundY - 3, kind: 'fire', age: 0 });   // and the blast where it landed
      Sound.play('FireImpact');
      this.flinch = 0.2;
      this.spits.splice(i, 1);
    }

    // Can tabs in flight: each takes its damage off a member as it reaches them, then flies on through the rest of the line.
    for (let i = this.tabs.length - 1; i >= 0; i--) {
      const tb = this.tabs[i];
      tb.age += dt;
      tb.x -= dt * TAB_SPEED;
      tb.y += Math.max(-dt * 60, Math.min(dt * 60, tb.targetY - tb.y));   // it settles to the height of the party as it goes
      for (const k of this.party.slice()) {
        if (tb.cut.indexOf(k) >= 0 || this.hpOf(k) <= 0) continue;
        const mr = this._rectOf(k);
        if (tb.x > mr.x + mr.w * 0.75) continue;
        tb.cut.push(k);
        this.bursts.push({ x: mr.x + mr.w * 0.7, y: mr.y + mr.h * 0.45, kind: 'scythe', age: 0 });
        if (!tb.sounded) { tb.sounded = true; Sound.play('ToucanHit'); }
        this.flinch = 0.14;
        this.damageMember(k, enemyDamage('toucan') * this.monsterDamageMultiplier);
      }
      if (tb.x < -8) this.tabs.splice(i, 1);
    }

    // The Sand Crab's Sand Blast: a wall of sand sweeps over the whole party; at the peak it hurts everyone and blinds them.
    if (this.sandT >= 0) {
      this.sandT += dt / SAND_BLAST_SECONDS;
      if (this.enemy !== null && this.enemy.deathT >= 0) this.sandT = Math.max(this.sandT, 0.8);   // it ends with the Sand Crab
      if (!this.sandStruck && this.sandT >= 0.4) {
        this.sandStruck = true;
        for (const k of this.party) {
          const mr = this._rectOf(k);
          this.bursts.push({ x: mr.x + mr.w / 2.0, y: mr.y + mr.h * 0.45, kind: 'sand', age: 0 });
        }
        for (const k of this.party.slice()) {
          this.damageMember(k, SAND_BLAST_DAMAGE * this.monsterDamageMultiplier);
          if (this.hpOf(k) > 0) this._applyBlind(k);   // their next attack will miss
        }
        this.flinch = 0.5;
      }
      if (this.sandT >= 1) this.sandT = -1;
    }

    // The Venom Flayer's spit: purple globs lobbed at each of the first three, poisoning them where they land.
    for (let i = this.venomSpits.length - 1; i >= 0; i--) {
      const sp = this.venomSpits[i];
      if (sp.delay > 0) { sp.delay -= dt; continue; }
      sp.age += dt;
      const u = Math.min(1, sp.age / VENOM_SPIT_SECONDS);
      sp.x = sp.startX + (sp.endX - sp.startX) * u;
      sp.y = sp.startY + (sp.endY - sp.startY) * u - 14 * Math.sin(Math.PI * u);
      if (u < 1) continue;
      this.venomSpits.splice(i, 1);
      this.bursts.push({ x: sp.endX, y: sp.endY, kind: 'splat', pal: 1, age: 0 });
      Sound.play('ToxinTick');
      this._applyPoison(sp.target, VENOM_SPIT_DAMAGE * this.monsterDamageMultiplier, VENOM_SPIT_TICKS);
      this.flinch = 0.14;
    }

    // The Blood Moon: a red moon rises, the sky bleeds, and at the peak a wave of red light breaks over the whole party.
    if (this.bloodMoonT >= 0) {
      this.bloodMoonT += dt / BLOOD_MOON_SECONDS;
      if (this.enemy !== null && this.enemy.deathT >= 0) this.bloodMoonT = Math.max(this.bloodMoonT, 0.8);   // it ends with the Gargogryph
      if (!this.bloodMoonStruck && this.bloodMoonT >= 0.5) {
        this.bloodMoonStruck = true;
        for (const k of this.party) {
          const mr = this._rectOf(k);
          this.bursts.push({ x: mr.x + mr.w / 2.0, y: mr.y + mr.h * 0.45, kind: 'blood', age: 0 });
        }
        for (const k of this.party.slice()) this.damageMember(k, (this.bloodMoonDamage || 5) * this.monsterDamageMultiplier);   // the wave of red light hurts everyone
        this.flinch = 0.6;
      }
      if (this.bloodMoonT >= 1) this.bloodMoonT = -1;
    }

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
        const r = this._rectOf(this._frontKind());
        const effect = strikeEffect(e.kind, e.attackPose);
        if (effect === 'feathers') {
          // A ranged attack: the wingbeat throws a volley of feathers that arrive one after another.
          const er = this._enemyRect(e);
          for (let i = 0; i < 3; i++)
            this.shots.push({ x: er.x + 6, y: er.y + er.h * (0.35 + 0.12 * i), targetY: r.y + r.h * (0.3 + 0.18 * ((i + e.attackPose) % 3)), delay: 0.1 + i * 0.16, age: 0, damage: i === 0 ? enemyDamage(e.kind) : 0 });
        } else if (effect === 'fireball') {
          // A ranged attack: a fireball is spat from its mouth at the front of the party (it hits the first two when it lands).
          const er = this._enemyRect(e);
          const sx = er.x + 2, sy = er.y + er.h * 0.3;
          this.spits.push({ x: sx, y: sy, startX: sx, startY: sy, endX: r.x + r.w * 0.5, endY: this.groundY - 2, age: 0 });
        } else if (effect === 'tab') {
          // A ranged attack: the can tab is slung forward from its beak and cuts through everyone in the line.
          const er = this._enemyRect(e);
          this.tabs.push({ x: er.x + 2, y: er.y + er.h * 0.4, targetY: r.y + r.h * 0.45, age: 0, cut: [], sounded: false });
        } else {
          // A blow lands on the front member, and on the next one behind them if it reaches that far (the scythe).
          const hit = this._lineOrder().filter(k => this.hpOf(k) > 0).slice(0, reachOf(e.kind));
          if (hit.length === 0) hit.push(this._frontKind());
          for (const k of hit) {
            const hr = this._rectOf(k);
            this.bursts.push({ x: hr.x + hr.w * 0.72, y: hr.y + hr.h * 0.45, kind: effect === 'fangs' ? 'claws' : effect, age: 0 });
          }
          this.flinch = 0.18;
          for (const k of hit) this.damageMember(k, enemyDamage(e.kind) * this.monsterDamageMultiplier);
          if (e.kind === 'venomflayer') for (const k of hit) this._applyPoison(k, 2 * this.monsterDamageMultiplier, 2);   // and the bite poisons: 2 a second for 2 seconds
        }
      }
      if (e.attackAnim >= 1) e.attackAnim = -1;
    }
  };

  /** The Venom Flayer rears back and spits at each of the first three in line. */
  m._spitVenom = function (e) {
    const er = this._enemyRect(e), sx = er.x + 4, sy = er.y + er.h * 0.2;
    let n = 0;
    for (const k of this._lineOrder()) {
      if (n >= 3) break;
      if (this.hpOf(k) <= 0) continue;
      const hr = this._rectOf(k);
      this.venomSpits.push({ target: k, startX: sx, startY: sy, x: sx, y: sy, endX: hr.x + hr.w * 0.55, endY: hr.y + hr.h * 0.4, age: 0, delay: n * 0.12 });
      n++;
    }
  };

  m._resetEnemies = function () {
    this.enemy = null;
    this.enemyTimer = FIRST_ENEMY_SECONDS;
    this.enemyAttacks = 0;
    this.damageTexts.length = 0;
    this.bursts.length = 0;
    this.beams.length = 0; this.lightTimer = 0;
    this.peckAnim = -1;
    this.flinch = 0;
    this.shots.length = 0;
    this.tabs.length = 0;
    this.spits.length = 0;
    this.venomSpits.length = 0; this.sandT = -1;
    this.bloodMoonT = -1;
    this.bloodMoonStruck = false;
  };

  // ---- The compendium's data ----------------------------------------------------------------------------

  m.bestiary = function () {
    return ENEMY_KINDS.map(k => {
      const seen = this.kills[k] !== undefined;
      return {
        kind: k, name: DEFS[k].name, seen: seen, kills: seen ? this.kills[k] : 0, maxHp: DEFS[k].hp, habitat: DEFS[k].habitat, note: DEFS[k].note,
        hit: enemyDamage(k), interval: DEFS[k].attackInterval, bloodMoon: baseOf(k) === 'gargogryph' ? bloodMoonDamage(k) : 0
      };
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
    if (this.bloodMoonT >= 0 && this.bloodMoonT < 0.8 && e !== null) {
      const br = this._enemyRect(e);
      const env = Math.min(1, Math.min(this.bloodMoonT / 0.1, (0.8 - this.bloodMoonT) / 0.15));
      list.push({ text: t('Blood Moon!'), x: (br.x + br.w / 2.0) * this.lastScale, y: this.lastTop + (br.y + DEFS[e.kind].headOffset - 17) * this.lastScale, alpha: Math.max(0, env), bubble: false, color: C(255, 96, 96) });
    }
    if (e !== null && e.deathT < 0 && e.engaged) {
      const r = this._enemyRect(e);
      list.push({ text: t(DEFS[e.kind].name), x: (r.x + r.w / 2.0) * this.lastScale, y: this.lastTop + (r.y + DEFS[e.kind].headOffset - 11) * this.lastScale, alpha: 0.85, bubble: false, color: C(226, 230, 246) });
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
      const flier = baseOf(e.kind) === 'gargogryph';
      // The walk cycle: four frames, a step (or a wing beat) every beat of it; standing still, the first and third (the arm sways, the wings flap).
      const winged = flier || baseOf(e.kind) === 'toucan';
      frame = walking ? set.walk[Math.trunc(e.walkT * (winged ? 12 : 8)) & 3] : set.walk[(Math.trunc(this.time * (flier ? 4 : 2)) % 2) * 2];
      if (e.attackAnim >= 0) {
        const u = e.attackAnim;
        if (flier) {   // wings high with the beak open, then thrust forward as the feathers fly; no lunge
          if (u < 0.75) frame = u < 0.4 ? set.attackA : set.attackB;
        } else {
          if (u < 0.3) lunge = 1.5 * (u / 0.3);
          else if (u < 0.75) frame = e.attackPose === 0 ? set.attackA : set.attackB;
          if (u >= 0.3 && u < 0.5) lunge = 1.5 - 5.5 * ((u - 0.3) / 0.2);
          else if (u >= 0.5 && u < 0.75) lunge = -4 + 4 * ((u - 0.5) / 0.25);
        }
      } else if (this.bloodMoonT >= 0 && flier) {   // calling the moon: wings raised, beak open, then the thrust that breaks it
        frame = this.bloodMoonT < 0.5 ? set.attackA : (this.bloodMoonT < 0.75 ? set.attackB : set.walkA);
      }
      if (e.hurtFlash > 0) frame = set.hurt;
    }

    // Floaters bob (the Nightmare drifts low, the Gargogryph hangs in the air; the base height is already in the rect).
    const hover = (DEFS[e.kind].hover || 0) > 0 ? Math.round(Math.sin(this.time * 3)) : 0;
    const x = Math.round(e.x + lunge);
    const y = r.y - hover + (e.deathT >= 0 ? Math.trunc(e.deathT * 3) : 0);
    g.ellipse(x + Math.trunc((set.w - 14) / 2), this.groundY, 14, 2, CA(90, 20, 30, 20));

    if (e.deathT >= 0) {
      g.image(frame, x, y, false, Math.max(0, 1 - e.deathT));
    } else {
      if (e.poisonTicks > 0) {
        // Poisoned: washed green, with bubbles rising off it.
        g.image(poisonedFrame(frame), x, y);
        for (let i = 0; i < 3; i++) {
          const ph = (this.time * 0.9 + i / 3) % 1;
          const bx2 = x + Math.trunc(set.w * (0.25 + 0.25 * i) + Math.sin(this.time * 3 + i * 2) * 1.5);
          const by2 = y + Math.trunc(set.h * 0.8 - ph * set.h * 0.8);
          g.rect(bx2, by2, 2, 2, CA(Math.trunc(220 * (1 - ph)), 150, 240, 110));
        }
      } else g.image(frame, x, y);
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      const bw = 16, bx = r.x + Math.trunc((set.w - bw) / 2), by = y + DEFS[e.kind].headOffset - 5;
      g.rect(bx - 1, by - 1, bw + 2, 4, CA(220, 30, 22, 40));
      const fill = ratio > 0.5 ? C(110, 214, 90) : ratio > 0.25 ? C(240, 200, 60) : C(230, 70, 60);
      g.rect(bx, by, Math.ceil(bw * ratio), 2, fill);
    }
  };

  /** The Blood Moon's strength 0..1: it rises in the first moments, holds, then sinks away. */
  m._bloodMoonEnv = function () {
    if (this.bloodMoonT < 0) return 0;
    const t = this.bloodMoonT;
    return Math.max(0, Math.min(1, Math.min(t / 0.18, (1 - t) / 0.2)));
  };

  /** The red moon itself, hung in the sky behind the hills. */
  m._drawBloodMoonSky = function (g, lw) {
    const env = this._bloodMoonEnv();
    if (env <= 0) return;
    const rad = 9 + Math.trunc(env * 3);
    const cx = Math.trunc(lw * 0.66), cy = Math.max(rad + 2, Math.trunc(this.groundY * 0.38)) + Math.trunc((1 - env) * 14);
    g.ellipse(cx - rad - 8, cy - rad - 8, (rad + 8) * 2, (rad + 8) * 2, CA(Math.trunc(46 * env), 220, 30, 40));
    g.ellipse(cx - rad - 3, cy - rad - 3, (rad + 3) * 2, (rad + 3) * 2, CA(Math.trunc(70 * env), 230, 40, 50));
    const a = Math.trunc(255 * env);
    g.ellipse(cx - rad, cy - rad, rad * 2, rad * 2, CA(a, 196, 24, 40));
    g.ellipse(cx - rad + 3, cy - rad + 2, rad * 2 - 3, rad * 2 - 2, CA(a, 130, 10, 32));
    g.ellipse(cx - rad, cy - rad, rad * 2 - 4, rad * 2 - 3, CA(a, 214, 40, 52));
    const cr = CA(Math.trunc(230 * env), 150, 14, 34);
    g.rect(cx - Math.trunc(rad / 2), cy - Math.trunc(rad / 3), 3, 2, cr);
    g.rect(cx + Math.trunc(rad / 4), cy + Math.trunc(rad / 4), 4, 2, cr);
    g.rect(cx - 1, cy - Math.trunc(rad / 2) - 1, 2, 2, cr);
    g.rect(cx - rad + 2, cy - Math.trunc(rad / 2), 1, Math.trunc(rad / 2), CA(Math.trunc(200 * env), 255, 120, 100));
  };

  /** The whole scene bathed in red while the Blood Moon is up. */
  m._drawBloodMoonTint = function (g, lw) {
    const env = this._bloodMoonEnv();
    if (env <= 0) return;
    const pulse = 0.8 + 0.2 * Math.sin(this.time * 7);
    g.rect(0, 0, lw, this.lh, CA(Math.trunc(78 * env * pulse), 190, 10, 24));
    if (this.bloodMoonT >= 0.5 && this.bloodMoonT < 0.62)   // the flash as it breaks
      g.rect(0, 0, lw, this.lh, CA(Math.trunc(120 * (1 - (this.bloodMoonT - 0.5) / 0.12)), 255, 60, 60));
  };

  const SPLAT_VX = [-16, -12, -9, -6, -14, -5, -11], SPLAT_VY = [-14, 6, -8, 12, -2, -16, 14], SPLAT_DRIP_X = [-2, 0, 2], SPLAT_DRIP_LEN = [8, 12, 6];

  m._drawEnemyEffects = function (g) {
    this._drawBeams(g);
    if (this.sandT >= 0) {   // the Sand Blast: a tan wash and streaks of sand blown from the monster across the party
      const su = Math.min(1, this.sandT), env = Math.sin(Math.PI * su), lw = this.lastLw;
      g.rect(0, 0, lw, this.lh, CA(Math.trunc(110 * env), 226, 188, 120));
      for (let i = 0; i < 70; i++) {
        const hh = hash(i, 913), speed = 140 + (hh % 120);
        let x = (((hh >>> 4) % (lw + 40)) - this.sandT * 1.8 * speed) % (lw + 40);
        if (x < 0) x += lw + 40;
        g.rect(Math.trunc(x) - 20, (hh >>> 12) % Math.max(8, this.groundY), 3 + (hh % 6), 1, CA(Math.trunc(210 * env), (hh & 1) === 0 ? 232 : 214, (hh & 1) === 0 ? 200 : 170, (hh & 1) === 0 ? 140 : 100));
      }
    }
    for (const vs of this.venomSpits) {   // the Venom Flayer's globs in flight
      if (vs.delay > 0) continue;
      goo(g, vs.x, vs.y, 3.4, 2.8, 255, 1);
    }
    // Spat fireballs: a ball of flame with a hot heart, shedding embers behind it.
    for (const sp of this.spits) {
      const x = Math.round(sp.x), y = Math.round(sp.y);
      g.rect(x + 5, y + 1, 2, 1, CA(150, 255, 110, 30)); g.rect(x + 7, y + 3, 1, 1, CA(150, 255, 110, 30));
      g.rect(x - 1, y - 1, 6, 6, C(238, 92, 24));
      g.rect(x, y, 4, 4, C(255, 170, 50));
      g.rect(x + 1, y + 1, 2, 2, C(255, 240, 170));
    }
    // Can tabs: a spinning silver ring-pull, with a short glint trailing behind it.
    for (const tb of this.tabs) {
      const x = Math.round(tb.x), y = Math.round(tb.y);
      const shape = TAB_SHAPES[Math.trunc(tb.age * 20) % 4];
      g.rect(x + 6, y + 2, 5, 1, CA(110, 214, 224, 255));
      for (const p of shape) g.rect(x + p[0] + 1, y + p[1] + 1, 1, 1, CA(200, 30, 22, 40));
      for (const p of shape) g.rect(x + p[0], y + p[1], 1, 1, C(214, 222, 238));
      g.rect(x + shape[0][0], y + shape[0][1], 1, 1, C(255, 255, 255));
    }
    // Feathers in flight: a bright slash with a crimson tip, pointing the way they fly.
    for (const s of this.shots) {
      if (s.delay > 0) continue;
      const x = Math.round(s.x), y = Math.round(s.y);
      g.rect(x + 3, y, 5, 1, CA(110, 214, 196, 255));
      g.rect(x, y, 4, 1, CA(255, 236, 232, 255));
      g.rect(x - 1, y, 2, 1, CA(255, 220, 50, 66));
    }    for (const b of this.bursts) {
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
        case 'flames': {   // flames bursting up from the ground where the fireball came down
          const span = Math.max(14, b.w || 14);
          const n = Math.max(4, Math.trunc(span / 3));
          const rise = Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - 0.25 * u);   // up fast, then guttering out
          const fa = Math.trunc(255 * Math.max(0, 1 - u * u));
          g.ellipse(Math.trunc(x - span / 2 - 3), y - 3, Math.trunc(span) + 6, 6, CA(Math.trunc(fa / 3), 255, 140, 40));   // a glow on the ground
          for (let k = 0; k < n; k++) {
            const fx = Math.round(x - span / 2 + k * (span / Math.max(1, n - 1)));
            const wob = 0.65 + 0.35 * Math.sin(k * 1.7 + u * 16);
            const h = Math.trunc((5 + 8 * (0.5 + 0.5 * Math.sin(k * 2.1))) * rise * wob);
            if (h < 1) continue;
            g.rect(fx, y - h, 3, h + 1, CA(fa, 232, 70, 24));
            g.rect(fx, y - Math.trunc(h * 0.75), 2, Math.trunc(h * 0.75) + 1, CA(fa, 255, 150, 40));
            g.rect(fx, y - Math.trunc(h * 0.4), 1, Math.trunc(h * 0.4) + 1, CA(fa, 255, 236, 140));
          }
          break;
        }
        case 'shout': {   // rings of sound rolling out of a shout
          for (let k = 0; k < 3; k++) {
            const rx = x - Math.trunc(u * 14) - k * 4, h = 5 + k * 3, col = CA(Math.trunc(fade * (1 - k * 0.2)), 255, 244, 200);
            g.rect(rx, y - Math.trunc(h / 2), 1, h, col); g.rect(rx + 1, y - Math.trunc(h / 2), 1, 1, col); g.rect(rx + 1, y + Math.trunc(h / 2) - 1, 1, 1, col);
          }
          break;
        }
        case 'ash': {   // a spent fireball: grey ash drifting down
          for (let k = 0; k < 7; k++) {
            const ax = x + (k - 3) * 2 + Math.trunc(u * (k % 2 === 0 ? 4 : -3)), ay = y + Math.trunc(u * 12) + (k % 3);
            g.rect(ax, ay, k % 3 === 0 ? 2 : 1, 1, k % 2 === 0 ? CA(fade, 168, 166, 178) : CA(fade, 120, 118, 130));
          }
          g.rect(x - 1, y - 1, 2, 2, CA(Math.trunc(255 * Math.max(0, 1 - u * 3)), 255, 150, 60));
          break;
        }
        case 'light': {   // golden motes rising off the enemy where the light lands
          for (let k = 0; k < 5; k++)
            g.rect(x - 4 + k * 2 + (k % 2), y - Math.trunc(8 * u) - (k % 3), 2, 2, CA(fade, 255, k % 2 === 0 ? 236 : 255, k % 2 === 0 ? 130 : 220));
          g.ellipse(x - 5, y - 5, 10, 10, CA(Math.trunc(fade / 3), 255, 236, 140));
          break;
        }
        case 'drain': {   // dark purple wisps pulled out of the enemy and drawn away to the left, towards the party
          for (let k = 0; k < 6; k++) {
            const ph = Math.min(1, u * 1.2 + k * 0.05);
            const dx = x + Math.trunc(Math.sin(k * 2.1) * 4) - Math.trunc(ph * (14 + k * 3)), dy = y + Math.trunc(Math.cos(k * 1.7) * 5) - Math.trunc(Math.sin(ph * Math.PI) * 6);
            g.rect(dx, dy, 2, 2, CA(fade, k % 2 === 0 ? 150 : 214, 70, k % 2 === 0 ? 200 : 255));
          }
          break;
        }
        case 'splat': {   // the glob hits: it squashes flat against the enemy, flings spatters, and the slime drips down
          const sq = Math.min(1, u / 0.2), a = u < 0.6 ? 255 : Math.trunc(255 * (1 - (u - 0.6) / 0.4));
          if (u < 0.25) {
            const rad = 3 + Math.trunc(8 * u / 0.25);
            g.ring(x - rad, y - rad, rad * 2, rad * 2, CA(Math.trunc(200 * (1 - u / 0.25)), 160, 236, 110));
          }
          const gp = GOO_PALETTES[b.pal || 0];
          goo(g, x, y, 4 - 2.2 * sq, 3.2 + 2.6 * sq, a, b.pal);
          if (sq > 0.5) { goo(g, x - 1, y - 3.5 * sq, 1.6, 1.8, a, b.pal); goo(g, x - 1, y + 3.5 * sq, 1.6, 1.8, a, b.pal); }
          const tt = Math.min(u, 0.6) * 0.8;
          for (let k = 0; k < SPLAT_VX.length; k++) {
            const sz = k % 2 === 0 ? 2 : 1;
            g.rect(x + Math.trunc(SPLAT_VX[k] * tt), y + Math.trunc(SPLAT_VY[k] * tt + 40 * tt * tt), sz, sz, CA(a, ...gp[1]));
          }
          const ease = Math.min(1, Math.max(0, (u - 0.12) / 0.55));
          for (let j = 0; j < SPLAT_DRIP_X.length; j++) {
            const len = Math.trunc(SPLAT_DRIP_LEN[j] * ease);
            if (len < 1) continue;
            g.rect(x + SPLAT_DRIP_X[j], y + 5, 1, len, CA(a, ...gp[1]));
            g.rect(x + SPLAT_DRIP_X[j] - 1, y + 5 + len, 2, 2, CA(a, ...gp[4]));
          }
          break;
        }
        case 'sand': {   // a puff of sand where the blast hits a hero
          for (let k = 0; k < 8; k++) {
            const ang = k * Math.PI / 4;
            g.rect(x + Math.trunc(Math.cos(ang) * (3 + 9 * u)), y + Math.trunc(Math.sin(ang) * (3 + 7 * u)), 2, 2, CA(fade, 226, 190, 124));
          }
          break;
        }
        case 'toxin': {   // a few green bubbles lifting off where the poison bites
          for (let k = 0; k < 4; k++) g.rect(x - 3 + k * 2, y - Math.trunc(7 * u) - (k % 2) * 2, 2, 2, CA(fade, 140, 236, 100));
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
        case 'feather': {   // a spray of pale slivers where a feather lands
          for (let k = 0; k < 5; k++) {
            const a = Math.PI + (k - 2) * 0.5;
            const dd = 1 + Math.trunc(5 * u);
            g.rect(x + Math.round(Math.cos(a) * dd), y + Math.round(Math.sin(a) * dd), 2, 1, CA(fade, 236, 232, 255));
          }
          g.rect(x, y, 2, 2, CA(fade, 220, 50, 66));
          break;
        }
        case 'blood': {   // red light breaking over a party member
          const rad = 3 + Math.trunc(12 * u);
          g.ellipse(x - rad, y - rad, rad * 2, rad * 2, CA(Math.trunc(fade / 3), 220, 20, 40));
          g.ring(x - rad, y - rad, rad * 2, rad * 2, CA(fade, 255, 70, 70));
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
