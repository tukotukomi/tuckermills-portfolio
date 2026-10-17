// The new-player tips, spoken by the Old Man over a dark overlay. A port of src\PixelTutorial.cs.
// The first time anyone in the party falls below 25 HP the game pauses and tells the player to heal them with a potion; only a tap on the
// potion button gets past it (and the potion can't be switched for another). Healing, or cancelling the heal, leads to a second tip
// about gold coins and the Merchant. Each tip is shown once, ever (the page keeps the list across restarts and new adventures).

import { Sound } from './sfx.js';
import { t } from './i18n.js';

/** A member's HP has to fall below this for the first-aid tip to come up. */
export const HP_TIP_BELOW = 25;
const CHARS_PER_SECOND = 34;

export function installTutorial(P) {
  const m = P.prototype;

  m._initTips = function () {
    this.tip = 'None';           // None | HpPrompt | HpTarget | Coins
    this.tipText = '';
    this.tipChars = 0;           // characters of the tip written out so far
    this.tipSounded = 0;         // ...and how many of them have had their blip
    this.tipsSeen = new Set();   // the tips already shown (the page keeps them across restarts)
    this.onTips = null;          // callback: a tip was shown for the first time
  };

  Object.defineProperties(m, {
    /** True while the Old Man's tip is up over the dark overlay, waiting for a tap on the potion button. */
    isTipPrompt: { get() { return this.tip === 'HpPrompt'; } },
    /** True for the second tip (gold coins and the Merchant), which any tap reads on from. */
    isTipCoins: { get() { return this.tip === 'Coins'; } },
    /** True while the Old Man's words are on screen (the game is paused behind them). */
    isTipDialogue: { get() { return this.tip === 'HpPrompt' || this.tip === 'Coins'; } },
    /** True during any part of the potion tutorial, including the choosing of who to heal. */
    isTipActive: { get() { return this.tip !== 'None'; } },
    tipShownText: { get() { return this.tipText.substring(0, Math.max(0, Math.min(this.tipText.length, Math.trunc(this.tipChars)))); } },
    tipTyping: { get() { return Math.trunc(this.tipChars) < this.tipText.length; } },
  });

  m._markTipSeen = function (name) {
    if (this.tipsSeen.has(name)) return;
    this.tipsSeen.add(name);
    if (this.onTips) this.onTips(Array.from(this.tipsSeen));
  };

  m._setTipText = function (text) {
    this.tipText = t(text);
    this.tipChars = 0;
    this.tipSounded = 0;
  };

  /** Called after a member takes damage: the first time anyone is below 25 HP, the game stops and the Old Man explains potions. */
  m._checkHpTip = function (who) {
    if (this.tip !== 'None' || this.tipsSeen.has('hp') || this.starting || this.isGameOver) return;
    if (this.party.indexOf(who) < 0 || this.hpOf(who) >= HP_TIP_BELOW || this.hpOf(who) <= 0) return;   // (a potion can't wake the fainted, so only someone still up counts)
    this._markTipSeen('hp');
    // The potion button must show the Healing Potion I whatever was selected before.
    const slot = this.hot.indexOf('PotionGreen');
    if (slot >= 0) this.hotSel = slot;
    if (slot < 0 || this.itemCount('PotionGreen') <= 0) { this._beginCoinTip(); return; }   // no potion to tap: just the second tip
    this.tip = 'HpPrompt';
    this._setTipText('Your party is in danger! Heal them with a potion.');
  };

  /** The tap on the potion button: the Healing Potion I is used, and the player is asked who to heal (or may cancel). */
  m.tipUsePotion = function () {
    if (this.tip !== 'HpPrompt') return false;
    this.tip = 'HpTarget';
    if (!this.useHotItem()) { this.tip = 'None'; this._beginCoinTip(); return false; }
    return true;
  };

  m._beginCoinTip = function () {
    this.tip = 'Coins';
    this._setTipText('Collect Gold Coins to buy more Healing Potions from the Merchant!');
    this.raiseProgress();
  };

  /** A tap while the second tip is up: the first one finishes the line, the next sends the Old Man away and the game goes on. */
  m.advanceTip = function () {
    if (this.tip !== 'Coins') return;
    if (this.tipTyping) { this.tipChars = this.tipText.length; this.tipSounded = this.tipText.length; return; }
    this.tip = 'None';
    this.raiseProgress();
  };

  /** Writes the Old Man's words out a character at a time, with his mumbling blips. */
  m._advanceTipText = function (dt) {
    if (this.tipChars < this.tipText.length) this.tipChars = Math.min(this.tipText.length, this.tipChars + dt * CHARS_PER_SECOND);
    const shown = Math.min(this.tipText.length, Math.trunc(this.tipChars));
    let blipped = false;
    while (this.tipSounded < shown) {
      const c = this.tipText[this.tipSounded++];
      if (blipped || !/[\p{L}\p{N}]/u.test(c)) continue;
      blipped = true;
      const hz = Math.trunc(128 * (1 + ((c.toLowerCase().charCodeAt(0) % 11) - 5) * 0.05));
      Sound.blip(hz, 0.55, false);
    }
  };

  m._resetTips = function () {
    this.tip = 'None';
    this.tipText = '';
    this.tipChars = 0; this.tipSounded = 0;
  };
}
