// Items: the party's bag, the four hot item slots, the Synergy Elixir, and the Merchant who comes down the road. A port of
// src\PixelItems.cs; the same numbers, so a change made to the C# can be made here the same way.

import { C, CA, silhouetteImage } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';
import { TRAIT_OWNER } from './traits.js';
import { t } from './i18n.js';

export const ITEM_IDS = ['SynergyElixir', 'PotionRed', 'PotionBlue', 'PotionGreen'];
export const HOT_SLOT_COUNT = 4;
export const BERSERK_SECONDS = 120;

/** Name, blurb and price (0 = the Merchant doesn't sell it). `heal` is the HP an item restores to the member it is used on. The red and blue
 *  potions are placeholders to prove the item UI; the green one is the Healing Potion I (its id stays PotionGreen so saved bags keep working). */
export const ITEM_DEFS = {
  SynergyElixir: { name: 'Synergy Elixir', price: 20, start: 0, blurb: "Resets every party member's skills so they all fire together within a second, Huzzah! first so the damage skills get its full benefit." },
  PotionRed: { name: 'Monster Berserker', price: 0, infinite: true, picks: true, blurb: 'A dev tool: multiplies the damage monsters deal, from 1X to 5X, for 2 minutes. Pick the multiplier after using it; a new use replaces the old one. Never runs out.' },
  PotionBlue: { name: 'Blue Potion', price: 0, blurb: 'A placeholder potion. It does nothing yet.' },
  PotionGreen: { name: 'Healing Potion I', price: 5, heal: 10, blurb: 'Heals one party member for 10 HP. After using it, tap the member to heal.' },
};

const TIMED_TRAITS = ['Heal', 'Fireball', 'Huzzah', 'StarHat', 'NaturalToxin'];
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
    this.merchantDay = -1;            // the day (days finished) he last came on, so he comes once on his day
    this.shopT = 0;
    this.itemTexts = [];
    this.synergyFlash = 0;
    this.buyFlash = 0;
    this.berserkMult = 1;             // the Monster Berserker's multiplier on monster damage...
    this.berserkLeft = 0;             // ...and the adventuring seconds it has left
    this.targetItem = null;           // a healing item waiting for the player to pick who it is used on (the game is paused meanwhile)
    this.targetT = 0;
    this.targetHover = null;
    this.memberFrames = {};           // what each member was drawn with last frame
    this._giveStarterItems();
  };

  m._giveStarterItems = function () {
    this.items = {};
    for (const id of ITEM_IDS) { const n = ITEM_DEFS[id].start === undefined ? 5 : ITEM_DEFS[id].start; if (n > 0) this.items[id] = n; }   // the starter potions
  };

  // ---- What the page can read ------------------------------------------------------------------------------

  Object.defineProperties(m, {
    isShopping: { get() { return this.enc === 'Shop'; } },
    /** True while a healing item is waiting for its target: the adventure is paused and the page asks for a tap on a member. */
    isTargeting: { get() { return this.targetItem !== null && ITEM_DEFS[this.targetItem].heal > 0; } },
    /** True while the Monster Berserker waits for its multiplier: the game is paused and the page shows 1X to 5X. */
    isPicking: { get() { return this.targetItem !== null && !!ITEM_DEFS[this.targetItem].picks; } },
    /** Either kind of wait: something was used and needs a choice (or a cancel) before the game goes on. */
    isWaiting: { get() { return this.targetItem !== null; } },
    /** What monster damage is multiplied by right now (1 when no Berserker is running). */
    monsterDamageMultiplier: { get() { return this.berserkLeft > 0 ? this.berserkMult : 1; } },
    hotSelected: { get() { return this.hotSel; } },
    hotItem: { get() { return this.hot[this.hotSel]; } },
  });
  m.itemCount = function (id) { return ITEM_DEFS[id].infinite ? 99 : (this.items[id] || 0); };
  m.isInfinite = function (id) { return !!ITEM_DEFS[id].infinite; };
  m.hotItems = function () { return this.hot.slice(); };

  /** The Merchant comes on the second day of each season, and only that one. */
  m._isMerchantDay = function () { return this.daysCompleted % SEASON_DAYS === 1; };

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
    if (this.itemCount(id) <= 0 || this.isShopping || this.isWaiting || this.isGameOver || this.starting) return false;
    if (ITEM_DEFS[id].picks) {
      this.targetItem = id; this.targetT = 0; this.targetHover = null;   // nothing is spent: the game pauses and 1X to 5X are offered
      Sound.play('DiscClick');
      return true;
    }
    if (ITEM_DEFS[id].heal > 0 && this.party.length > 0) {
      // Nothing is spent yet: the game pauses and the player taps who to heal (or cancels).
      this.targetItem = id; this.targetT = 0; this.targetHover = null;
      Sound.play('DiscClick');
      return true;
    }
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

  /** Uses the waiting healing item on `who`. False when nothing is waiting or the member isn't in the party. */
  m.chooseTarget = function (who) {
    if (!this.isTargeting || this.party.indexOf(who) < 0) return false;
    const id = this.targetItem;
    if (this.itemCount(id) <= 0) { this.targetItem = null; this.targetHover = null; return false; }
    if (this.hpOf(who) >= this.maxHpOf(who)) {
      // A potion isn't wasted on someone in full health: say so and keep waiting for another choice (or a cancel).
      const r = this._rectOf(who);
      this._addItemText(t('HP full'), r.x + r.w / 2.0, r.y - 4, C(200, 226, 255));
      return false;
    }
    this.targetItem = null; this.targetHover = null;
    this._addItem(id, -1);
    const amount = Math.min(ITEM_DEFS[id].heal, this.maxHpOf(who) - this.hpOf(who));   // what it actually restores
    this._applyHeal(who, amount);
    this.heals.push({ from: who, to: who, amount: amount, age: 0 });
    Sound.play('Heal');
    this.raiseProgress();
    return true;
  };

  /** Applies the chosen multiplier (1 to 5) for two minutes, replacing any Berserker already running, and resumes the game. */
  m.chooseMultiplier = function (multiplier) {
    if (!this.isPicking) return false;
    this.berserkMult = Math.max(1, Math.min(5, multiplier));
    this.berserkLeft = BERSERK_SECONDS;
    this.targetItem = null; this.targetHover = null;
    Sound.play('PotionUse');
    const r = this._rectOf(this._frontKind());
    this._addItemText(t('Monsters x{n} for 2 minutes', { n: this.berserkMult }), r.x + r.w / 2.0, r.y - 6, C(255, 170, 90));
    this.raiseProgress();
    return true;
  };

  // ---- Saved: "3:95.2" (multiplier : seconds left), empty when no Berserker is running ---------------------------

  m._saveBerserkFields = function () {
    return this.berserkLeft > 0 ? this.berserkMult + ':' + this.berserkLeft.toFixed(1) : '';
  };

  m._loadBerserkFields = function (field) {
    this.berserkMult = 1; this.berserkLeft = 0;
    if (!field) return;
    const p = field.split(':');
    const mult = parseInt(p[0], 10), left = parseFloat(p[1]);
    if (p.length === 2 && mult >= 1 && mult <= 5 && left > 0 && left <= BERSERK_SECONDS) { this.berserkMult = mult; this.berserkLeft = left; }
  };

  /** Puts the waiting item back (nothing was spent) and resumes the game. */
  m.cancelTargeting = function () {
    if (this.targetItem === null) return;
    this.targetItem = null; this.targetHover = null;
    Sound.play('DiscClick');
  };

  /** The party member under a point in control pixels (a little forgiving, as the members are small), or null. */
  m.memberAt = function (x, y) {
    const sx = x / this.lastScale, sy = (y - this.lastTop) / this.lastScale;
    let best = null, bestD = Infinity;
    for (const kind of this.party) {
      const r = this.memberRects[kind];
      if (!r) continue;
      if (sx < r.x - 3 || sx > r.x + r.w + 3 || sy < r.y - 4 || sy > r.y + r.h + 3) continue;
      const dx = sx - (r.x + r.w / 2), dy = sy - (r.y + r.h / 2), d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = kind; }
    }
    return best;
  };

  /** While a healing item waits for its target: most of the scene goes dark, and the members glow so they read as the thing to tap. */
  m._drawTargetOverlay = function (g, lw) {
    g.rect(0, 0, lw, this.lh, CA(170, 0, 0, 0));
    if (!this.isTargeting && !this.isSwapping) return;   // picking a multiplier: just the dark, the page draws the buttons
    const pulse = 0.5 + 0.5 * Math.sin(this.targetT * 5);
    if (!this._glowCache) this._glowCache = new WeakMap();
    for (const kind of this.party) {
      const r = this.memberRects[kind], frame = this.memberFrames[kind];
      if (!r || !frame) continue;
      const hover = this.targetHover === kind || (this.isSwapping && this.swapFirstKind === kind);   // (the first hero picked while swapping stays lit)
      const k = hover ? 1.0 : 0.65 + 0.35 * pulse;
      const cx = r.x + Math.trunc(r.w / 2), cy = r.y + Math.trunc(r.h / 2);
      for (let i = 3; i >= 0; i--) {   // a soft halo behind
        const rx = Math.trunc(r.w / 2) + 2 + i * 2, ry = Math.trunc(r.h / 2) + 2 + i * 2;
        g.ellipse(cx - rx, cy - ry, rx * 2, ry * 2, CA(Math.trunc((hover ? 46 : 30) * k), 140, 255, 190));
      }
      let sil = this._glowCache.get(frame);
      if (!sil) { sil = silhouetteImage(frame, C(200, 255, 220)); this._glowCache.set(frame, sil); }
      for (const d of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.image(sil, r.x + d[0], r.y + d[1], false, k, r.w, r.h);   // and a bright outline
      const clip = this.memberClip[kind];   // a member in the cart: only the part above the board
      if (clip !== undefined) {
        g.ctx.save();
        g.ctx.beginPath(); g.ctx.rect(r.x - 3, r.y - 4, r.w + 6, clip - (r.y - 4)); g.ctx.clip();
      }
      g.image(frame, r.x, r.y, false, undefined, r.w, r.h);
      if (this.hatLeft > 0 && clip === undefined) this._drawStarHat(g, frame, r.x, r.y, kind);
      if (clip !== undefined) g.ctx.restore();
    }
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
    const front = this._rectOf(this._frontKind());
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
    this.targetItem = null; this.targetHover = null;
    this.berserkMult = 1; this.berserkLeft = 0;
  };

  // ---- Saved: "SynergyElixir=1;PotionRed=5" | "SynergyElixir,PotionRed,PotionBlue,PotionGreen,0" | merchant day ----------------

  m._saveItemFields = function () {
    const bag = ITEM_IDS.filter(i => (this.items[i] || 0) > 0).map(i => i + '=' + this.items[i]).join(';');
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
