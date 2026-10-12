// Items: the party's bag, the four hot item slots, the Synergy Elixir, and the Merchant who comes down the road. A port of
// src\PixelItems.cs; the same numbers, so a change made to the C# can be made here the same way.

import { C, CA } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';
import { TRAIT_OWNER } from './traits.js';
import { t } from './i18n.js';

export const ITEM_IDS = ['SynergyElixir', 'PotionRed', 'PotionBlue', 'PotionGreen'];
export const HOT_SLOT_COUNT = 4;

/** Name, blurb and price (0 = the Merchant doesn't sell it). The three potions are placeholders to prove the item UI. */
export const ITEM_DEFS = {
  SynergyElixir: { name: 'Synergy Elixir', price: 20, blurb: "Resets every party member's skills so they all fire together within a second, Huzzah! first so the damage skills get its full benefit." },
  PotionRed: { name: 'Red Potion', price: 0, blurb: 'A placeholder potion. It does nothing yet.' },
  PotionBlue: { name: 'Blue Potion', price: 0, blurb: 'A placeholder potion. It does nothing yet.' },
  PotionGreen: { name: 'Green Potion', price: 0, blurb: 'A placeholder potion. It does nothing yet.' },
};

const TIMED_TRAITS = ['Heal', 'Fireball', 'Huzzah', 'StarHat'];
const SEASON_DAYS = 5;
const TAVERN_SPAWN_PHASE = 0.88;

export function installItems(P) {
  const m = P.prototype;

  m._initItems = function () {
    this.items = {};
    this.hot = ['SynergyElixir', 'PotionRed', 'PotionBlue', 'PotionGreen'];
    this.hotSel = 0;
    this.merchantActive = false;      // on the road, drifting in with it
    this.merchantWorldX = 0;
    this.merchantMet = false;         // the party has reached him this visit
    this.merchantDay = -1;            // the day (days finished) he last came on, so he comes once on each of his days
    this.shopT = 0;
    this.itemTexts = [];
    this.synergyFlash = 0;
    this.buyFlash = 0;
    this._giveStarterItems();
  };

  m._giveStarterItems = function () {
    this.items = {};
    for (const id of ITEM_IDS) if (ITEM_DEFS[id].price <= 0) this.items[id] = 5;   // the placeholder potions start in the bag
  };

  // ---- What the page can read ------------------------------------------------------------------------------

  Object.defineProperties(m, {
    isShopping: { get() { return this.enc === 'Shop'; } },
    hotSelected: { get() { return this.hotSel; } },
    hotItem: { get() { return this.hot[this.hotSel]; } },
  });
  m.itemCount = function (id) { return this.items[id] || 0; };
  m.hotItems = function () { return this.hot.slice(); };

  /** The Merchant comes on the second and fourth day of each season. */
  m._isMerchantDay = function () { return (this.daysCompleted % SEASON_DAYS) % 2 === 1; };

  // ---- Items -----------------------------------------------------------------------------------------------

  m._addItem = function (id, n) { this.items[id] = Math.max(0, this.itemCount(id) + n); };

  /** Buys one at the Merchant. False when there isn't the gold (or it isn't for sale). */
  m.buyItem = function (id) {
    const price = ITEM_DEFS[id].price;
    if (!this.isShopping || price <= 0 || this.gold < price) return false;
    this.gold -= price;
    this._addItem(id, 1);
    this.goldPulse = 1;
    this.buyFlash = 0.5;
    Sound.play('ItemBuy');
    this._addItemText(t('Bought {name}', { name: t(ITEM_DEFS[id].name) }), this._merchantScreenX() + 8, this.groundY - 28, C(255, 226, 150));
    this.raiseProgress();
    return true;
  };

  m.leaveShop = function () {
    if (!this.isShopping) return;
    this.enc = 'None';
    Sound.play('DiscClick');
    this._addItemText(t('Safe travels!'), this._merchantScreenX() + 8, this.groundY - 28, C(200, 226, 255));
  };

  m.selectHot = function (slot) {
    if (slot < 0 || slot >= HOT_SLOT_COUNT || slot === this.hotSel) return;
    this.hotSel = slot;
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** Uses the item in the selected hot slot. False when there is none left. */
  m.useHotItem = function () {
    const id = this.hot[this.hotSel];
    if (this.itemCount(id) <= 0 || this.isShopping) return false;
    this._addItem(id, -1);
    const x = this._leaderCenterX(), y = this.groundY - 30;
    if (id === 'SynergyElixir') {
      this._applySynergy();
      this._addItemText(t('Synergy!'), x, y, C(255, 226, 120));
    } else {
      Sound.play('PotionUse');
      this._addItemText(t('{name}: nothing happens yet', { name: t(ITEM_DEFS[id].name) }), x, y, C(200, 226, 255));
    }
    this.raiseProgress();
    return true;
  };

  /**
   * The Synergy Elixir: every skill is reset to fire in the next second, all together. Huzzah! goes first (a tenth of a second
   * away) so everything that follows, the other skills and the basic attacks, lands inside its inspiration.
   */
  m._applySynergy = function () {
    for (const trait of TIMED_TRAITS) {
      if (this.party.indexOf(TRAIT_OWNER[trait]) < 0) continue;
      this.traitTimer[trait] = trait === 'Huzzah' ? 0.1 : 0.55;
    }
    const e = this.enemy;
    if (e !== null && e.engaged && e.deathT < 0) {
      e.peckTimer = 0.6;   // the Paca's attack and the Warrior's axe follow Huzzah! as well
      e.axeTimer = 0.6;
    }
    this.synergyFlash = 1;
    Sound.play('ElixirUse');
  };

  m._addItemText = function (text, x, y, color) {
    this.itemTexts.push({ text: text, x: x, y: y, age: 0, color: color });
  };

  // ---- The Merchant on the road ----------------------------------------------------------------------------

  m._merchantScreenX = function () { return this.merchantWorldX - this.scroll; };

  /** Brings him in on his days, and opens the shop when the party reaches him. */
  m._updateMerchant = function () {
    if (!this.merchantActive) {
      const quiet = this.enemy === null && !this.crystalActive && this.story === 'None' && this.camp < 0.01;
      const early = this.dayPhase >= 0.12 && this.dayPhase < TAVERN_SPAWN_PHASE - 0.1;
      if (this._isMerchantDay() && this.merchantDay !== this.daysCompleted && early && quiet) {
        this.merchantActive = true;
        this.merchantMet = false;
        this.merchantDay = this.daysCompleted;
        this.merchantWorldX = this.scroll + this.lastLw + 14;
        Sound.play('ShopBell');
      }
      return;
    }
    const front = this._rectOf(this.party[0]);
    if (!this.merchantMet && this.enc === 'None' && this._merchantScreenX() <= front.x + front.w + 6) {
      this.merchantMet = true;
      this.enc = 'Shop';
      this.shopT = 0;
      Sound.play('ShopBell');
      this.raiseProgress();
    }
    if (this._merchantScreenX() < -30) this.merchantActive = false;   // left behind on the road
  };

  m._advanceItemEffects = function (dt) {
    if (this.isShopping) this.shopT += dt;
    if (this.synergyFlash > 0) this.synergyFlash = Math.max(0, this.synergyFlash - dt);
    if (this.buyFlash > 0) this.buyFlash = Math.max(0, this.buyFlash - dt);
    for (let i = this.itemTexts.length - 1; i >= 0; i--) {
      this.itemTexts[i].age += dt / 1.8;
      if (this.itemTexts[i].age >= 1) this.itemTexts.splice(i, 1);
    }
  };

  m._resetItems = function () {
    this._giveStarterItems();
    this.hot = ['SynergyElixir', 'PotionRed', 'PotionBlue', 'PotionGreen'];
    this.hotSel = 0;
    this.merchantActive = false; this.merchantMet = false; this.merchantDay = -1;
    this.itemTexts.length = 0;
    this.synergyFlash = 0; this.buyFlash = 0;
  };

  // ---- Saved: "SynergyElixir=1;PotionRed=5" | "SynergyElixir,PotionRed,PotionBlue,PotionGreen,0" | merchant day ----------------

  m._saveItemFields = function () {
    const bag = ITEM_IDS.filter(i => this.itemCount(i) > 0).map(i => i + '=' + this.itemCount(i)).join(';');
    const hot = this.hot.join(',') + ',' + this.hotSel;
    // If he is on the road unmet (or the shop is open) the visit isn't counted, so he is there again after a reload.
    const day = (this.merchantActive && !this.merchantMet) || this.isShopping ? -1 : this.merchantDay;
    return [bag, hot, String(day)];
  };

  m._loadItemFields = function (bag, hot, day) {
    this._resetItems();
    if (bag !== null && bag !== undefined) {
      this.items = {};
      for (const pair of bag.split(';').filter(s => s)) {
        const kv = pair.split('=');
        const n = parseInt(kv[1], 10);
        if (kv.length === 2 && ITEM_DEFS[kv[0]] && n > 0) this.items[kv[0]] = Math.min(n, 999);
      }
    }
    if (hot) {
      const parts = hot.split(',');
      for (let i = 0; i < HOT_SLOT_COUNT && i < parts.length; i++) if (ITEM_DEFS[parts[i]]) this.hot[i] = parts[i];
      const sel = parseInt(parts[HOT_SLOT_COUNT], 10);
      if (sel >= 0 && sel < HOT_SLOT_COUNT) this.hotSel = sel;
    }
    const d = parseInt(day, 10);
    if (!isNaN(d)) this.merchantDay = d;
  };

  // ---- Drawing ---------------------------------------------------------------------------------------------

  m._drawMerchant = function (g, lw) {
    if (!this.merchantActive) return;
    const frames = Sprites.merchant;
    if (!frames) return;
    const frame = (Math.trunc(this.time * 1.5)) % 2 === 0 ? frames[0] : frames[1];
    const x = Math.round(this._merchantScreenX());
    if (x > lw + 4 || x + frame.width < -4) return;
    const y = this.groundY + 1 - frame.height;
    g.ellipse(x + 2, this.groundY, frame.width - 4, 2, CA(90, 20, 30, 20));
    if (this.isShopping) g.ellipse(x - 4, y - 4, frame.width + 8, frame.height + 6, CA(60 + Math.trunc(30 * Math.sin(this.time * 4)), 255, 226, 120));
    g.image(frame, x, y);
  };

  /** The Synergy Elixir's light: a gold ring and sparks spreading out from every member of the party. */
  m._drawItemEffects = function (g) {
    if (this.synergyFlash <= 0) return;
    const u = 1 - this.synergyFlash;
    for (const k in this.memberRects) {
      const r = this.memberRects[k];
      const cx = r.x + Math.trunc(r.w / 2), cy = r.y + Math.trunc(r.h / 2);
      const rad = 3 + Math.trunc(14 * u);
      const a = Math.trunc(230 * (1 - u));
      g.ellipse(cx - rad, cy - rad, rad * 2, rad * 2, CA(Math.trunc(a / 4), 255, 226, 120));
      g.ring(cx - rad, cy - rad, rad * 2, rad * 2, CA(a, 255, 230, 140));
      for (let i = 0; i < 6; i++) {
        const ang = i * Math.PI / 3 + u * 2;
        g.rect(cx + Math.round(Math.cos(ang) * (rad + 2)), cy + Math.round(Math.sin(ang) * (rad + 2)), 2, 2, i % 2 === 0 ? CA(a, 255, 252, 214) : CA(a, 190, 130, 240));
      }
    }
  };

  m._appendItemText = function (list) {
    for (const t of this.itemTexts) {
      const u = t.age;
      list.push({ text: t.text, x: t.x * this.lastScale, y: this.lastTop + (t.y - u * 10) * this.lastScale, alpha: Math.max(0, Math.min(1, 1.6 * (1 - u * u))), bubble: false, color: t.color });
    }
  };
}
