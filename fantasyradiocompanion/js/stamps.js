// Tavern Stamps and the heroes they unlock. A port of src\PixelStamps.cs. One stamp is earned at the tavern that completes each year (its
// notification comes up as the party arrives); the stamps and the heroes unlocked with them belong to the player, not to an adventure, so the
// page keeps them (stamps, unlocked). The Tavern Shop, reachable before a hero is picked at the start of every adventure, is where they are spent.

import { Sound } from './sfx.js';
import { PARTY } from './sprites.js';

export const HERO_UNLOCK_COST = 10;
/** The heroes that have to be unlocked with Tavern Stamps; the other seven are always there. */
export const UNLOCKABLE_HEROES = ['paladin', 'shadowknight'];
export const STAMP_TOAST_SECONDS = 4.5;
const SEASON_DAYS = 5;

export function installStamps(P) {
  const m = P.prototype;

  m._initStamps = function () {
    this.stamps = 0;                 // the Tavern Stamps the player has (the page keeps them)
    this.unlocked = new Set();       // the heroes unlocked with them (the page keeps them too)
    this.stampedYear = -1;           // the latest year this adventure has paid out a stamp for (saved, so a reload at the tavern doesn't pay twice)
    this.stampToast = 0;             // seconds left of "You received a Tavern Stamp!"
    this.startShopBought = false;    // something was bought at the Tavern Shop since the pair at the fire was drawn
    this.startOfferFromSave = false; // the pair at the fire came from a save (so it is left as it was)
    this.onStamps = null;            // callback: the stamps changed
    this.onUnlocked = null;          // callback: a hero was unlocked
  };

  /** The seven heroes everyone starts with are always there; the Paladin and the Shadow Knight once unlocked. */
  m.isUnlocked = function (kind) { return UNLOCKABLE_HEROES.indexOf(kind) < 0 || this.unlocked.has(kind); };
  Object.defineProperty(m, 'canAffordHero', { get() { return this.stamps >= HERO_UNLOCK_COST; } });

  /** The tavern that completes a year pays out one stamp, once. */
  m._awardYearStamp = function () {
    const year = Math.trunc(this.daysCompleted / (SEASON_DAYS * 4));
    if (year <= this.stampedYear) return;
    this.stampedYear = year;
    this.stamps++;
    this.stampToast = STAMP_TOAST_SECONDS;
    Sound.play('ItemBuy');
    if (this.onStamps) this.onStamps(this.stamps);
    this.raiseProgress();
  };

  /** Spends the stamps to unlock a hero at the Tavern Shop (only before the adventure's first hero is picked). */
  m.buyHero = function (kind) {
    if (!this.starting || UNLOCKABLE_HEROES.indexOf(kind) < 0 || this.unlocked.has(kind) || this.stamps < HERO_UNLOCK_COST) return false;
    this.stamps -= HERO_UNLOCK_COST;
    this.unlocked.add(kind);
    this.startShopBought = true;
    Sound.play('ItemBuy');
    if (this.onStamps) this.onStamps(this.stamps);
    if (this.onUnlocked) this.onUnlocked(Array.from(this.unlocked));
    return true;
  };

  /** The pair at the fire, drawn again from the heroes unlocked now (so a new hero can be among them). */
  m._redrawStartOffer = function () {
    const all = PARTY.filter(k => this.isUnlocked(k)), picks = [];
    while (picks.length < 2) { const k = all[Math.floor(Math.random() * all.length)]; if (picks.indexOf(k) < 0) picks.push(k); }
    this.offer = picks;
    this.startHover = -1;
    this.raiseProgress();
  };

  /** The Tavern Shop was closed: if anything was bought, the two at the fire are drawn again. */
  m.leaveTavernShop = function () {
    if (!this.startShopBought) return;
    this.startShopBought = false;
    if (this.starting) this._redrawStartOffer();
  };

  /** The page has just told the scene which heroes are unlocked: a pair drawn before that (not one from a save) is drawn again. */
  m.unlockedLoaded = function () {
    if (this.starting && this.offer && !this.startCampActive && !this.startOfferFromSave) this._redrawStartOffer();
  };

  m._advanceStamps = function (dt) { if (this.stampToast > 0) this.stampToast = Math.max(0, this.stampToast - dt); };
  m._resetStamps = function () { this.stampedYear = -1; this.stampToast = 0; this.startShopBought = false; this.startOfferFromSave = false; };
  m._saveStampFields = function () { return String(this.stampedYear); };
  m._loadStampFields = function (field) {
    const y = parseInt(field, 10);
    this.stampedYear = isNaN(y) ? -1 : y;
    this.stampToast = 0;
  };
}
