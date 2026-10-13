// The tavern's inn. Every tavern visit ends with it (after any hero to pick, the Old Man's talk, a Fantasy Crystal...), and a tavern now
// stands on the last day of every year, at the end of the day (Day 20 of Year 1, of Year 2, ...). "Need to rest and reorganize?": 10 gold heals and wakes the whole party, 30 gold
// swaps the places of two heroes (chosen on a dimmed screen with the party glowing, like the Healing Potion's). A port of src\PixelInn.cs.

import { C } from './util.js';
import { Sound } from './sfx.js';
import { t } from './i18n.js';

export const INN_REST_COST = 10, INN_REORGANIZE_COST = 30;

export function installInn(P) {
  const m = P.prototype;

  m._initInn = function () {
    this.innStage = 0;         // 0 = the menu, 1 = choosing the two heroes to swap
    this.swapFirst = -1;       // index in the party of the first hero chosen
    this.innAfterOldMan = false;   // the Old Man's visit has just ended: finishing here completes that day too
  };

  Object.defineProperties(m, {
    isInn: { get() { return this.enc === 'Inn'; } },
    isInnMenu: { get() { return this.enc === 'Inn' && this.innStage === 0; } },
    isSwapping: { get() { return this.enc === 'Inn' && this.innStage === 1; } },
    /** The hero chosen first while swapping (null until one is). */
    swapFirstKind: { get() { return this.swapFirst >= 0 && this.swapFirst < this.party.length ? this.party[this.swapFirst] : null; } },
    anyoneHurt: { get() { return this.party.some(k => this.hpOf(k) < this.maxHpOf(k)); } },
    canRest: { get() { return this.gold >= INN_REST_COST && this.anyoneHurt; } },
    canReorganize: { get() { return this.gold >= INN_REORGANIZE_COST && this.party.length >= 2; } },
  });

  /** The last day of every year ends at a tavern, whether or not a companion is due. (When one is, it is the same visit, so the inn
   *  never comes on two days in a row.) */
  m._yearTavernDay = function () { return this.daysCompleted % 20 === 19; };

  m._beginInn = function () {
    this.enc = 'Inn';
    this.innStage = 0;
    this.swapFirst = -1;
    this.targetHover = null;
    this.raiseProgress();
  };

  /** 10 gold: everyone is healed to full and the fainted wake. */
  m.innRest = function () {
    if (!this.isInnMenu || !this.canRest) return false;
    this.gold -= INN_REST_COST;
    this.goldPulse = 1;
    for (const k of this.party.slice()) {
      const missing = this.maxHpOf(k) - this.hpOf(k);
      if (missing <= 0) continue;
      this._restoreHp(k, missing);
      this.heals.push({ from: k, to: k, amount: missing, age: 0 });
    }
    Sound.play('Heal');
    const r = this._rectOf(this._frontKind());
    this._addItemText(t('Rested!'), r.x + r.w / 2.0, r.y - 6, C(160, 255, 190));
    this.raiseProgress();
    return true;
  };

  /** 30 gold, taken when the swap is made: opens the screen where two heroes are picked. */
  m.innReorganize = function () {
    if (!this.isInnMenu || !this.canReorganize) return false;
    this.innStage = 1; this.swapFirst = -1; this.targetHover = null;
    Sound.play('DiscClick');
    return true;
  };

  /** A tap on a hero while swapping: the first is marked, the second trades places with it (and the gold is spent). */
  m.innPick = function (who) {
    if (!this.isSwapping) return false;
    const i = this.party.indexOf(who);
    if (i < 0) return false;
    if (this.swapFirst < 0) { this.swapFirst = i; Sound.play('DiscClick'); return true; }
    if (this.swapFirst === i) { this.swapFirst = -1; Sound.play('DiscClick'); return true; }   // tapped again: let go of it
    if (this.gold < INN_REORGANIZE_COST) { this.innCancel(); return false; }
    const first = this.party[this.swapFirst];
    this.party[this.swapFirst] = this.party[i];
    this.party[i] = first;
    this.gold -= INN_REORGANIZE_COST;
    this.goldPulse = 1;
    this.swapFirst = -1; this.innStage = 0; this.targetHover = null;
    Sound.play('ItemBuy');
    const r = this._rectOf(this._frontKind());
    this._addItemText(t('Swapped!'), r.x + r.w / 2.0, r.y - 6, C(255, 226, 150));
    this.raiseProgress();
    return true;
  };

  /** Back out of the swap screen to the menu (nothing is charged). */
  m.innCancel = function () {
    if (!this.isSwapping) return;
    this.innStage = 0; this.swapFirst = -1; this.targetHover = null;
    Sound.play('DiscClick');
  };

  /** "Not now": the party leaves the tavern and the day is done. */
  m.innLeave = function () {
    if (!this.isInnMenu) return;
    Sound.play('DiscClick');
    this._finishTavernDay();
  };

  m._finishTavernDay = function () {
    this.enc = 'None';   // everyone's together; time starts running again at the next dawn
    this.arrived = false;
    this.innStage = 0; this.swapFirst = -1;
    this.daysCompleted++;   // the day that ended at the tavern is done; the next starts at dawn
    this.dayPhase = 0;
    if (this.innAfterOldMan) {
      this.innAfterOldMan = false;
      this.nextCrystalDay = (Math.trunc(this.daysCompleted / 2) + 1) * 2;   // the next even-numbered day boundary
    }
    this.raiseProgress();
  };

  /** Over each hero while swapping: the place they hold in the line, 1 at the front. */
  m._appendSwapText = function (list) {
    if (!this.isSwapping) return;
    const order = this._lineOrder();
    for (let i = 0; i < order.length; i++) {
      const r = this.memberRects[order[i]];
      if (!r) continue;
      let y = this.lastTop + (r.y - 5) * this.lastScale;
      if (y < 48) y = this.lastTop + (r.y + r.h * 0.62) * this.lastScale;
      list.push({ text: String(i + 1), x: (r.x + r.w / 2) * this.lastScale, y: y, alpha: 1, bubble: false, color: this.swapFirstKind === order[i] ? C(255, 226, 150) : C(255, 255, 255) });
    }
  };
}
