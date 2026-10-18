// Scrolls: kept apart from the bag and its hot slots. Duplicates are allowed, but each one takes a slot of its own: the party carries a limited number
// (1, plus 1 from the Paca), and they drop from the hardest monsters. A port of src\PixelScroll.cs.

import { C, CA } from './util.js';
import { Sound } from './sfx.js';
import { Sprites } from './sprites.js';
import { t } from './i18n.js';
import { enumOf, kindOfEnum } from './health.js';

export const SCROLL_IDS = ['Rereviver'];
export const SCROLL_DEFS = {
  Rereviver: { name: 'Rereviver Scroll', blurb: 'Grants Rerevive to one party member for 1 year: if they faint, they instantly revive on the spot with 50% HP. It is used up when it does.' },
};

/** The chance that a defeated Gargogryph, Wickedgryph or Toucan leaves a scroll. */
export const SCROLL_DROP_CHANCE = 0.2;
const SCROLL_FLY_SECONDS = 1.1, REREVIVE_PULSE_SECONDS = 1.3, SEASON_DAYS = 5;
/** How long Rerevive lasts: one year of playing time (four seasons of five days). */
export const REREVIVE_PLAY_DAYS = SEASON_DAYS * 4;

const HEART_ROWS = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];

export function installScroll(P) {
  const m = P.prototype;

  m._initScroll = function () {
    this.scrolls = [];               // what the party carries
    this.scrollSel = 0;             // the one the scroll button will use
    this.targetScroll = null;       // a scroll waiting for the player to pick who it is used on
    this.rerevive = {};           // who has Rerevive, and until which play day
    this.scrollPrompt = null;       // storage full: the carried items and the new one, to choose one to discard
    this.scrollPromptHasNew = false;
    this.scrollDrops = [];          // flying to the party
    this.rerevivePulses = [];
  };

  // ---- What the page can read ------------------------------------------------------------------------------

  Object.defineProperties(m, {
    /** How many scrolls the party can carry: 1, plus what the Paca adds while he is in it. */
    scrollCapacity: { get() { return 1 + this.itemStorage; } },
    scrollCount: { get() { return this.scrolls.length; } },
    scrollSelected: { get() { return this.scrolls.length === 0 ? -1 : Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel)); } },
    /** True while the storage is full and a new scroll has been found: the player picks which one to discard. */
    isScrollPrompt: { get() { return this.scrollPrompt !== null; } },
    /** The index in scrollPrompt of the item just found (the last one), or -1 when there is no new one. */
    scrollPromptNewIndex: { get() { return this.scrollPrompt === null || !this.scrollPromptHasNew ? -1 : this.scrollPrompt.length - 1; } },
  });
  m.hasRerevive = function (kind) { const until = this.rerevive[kind]; return until !== undefined && until > this.playDays; };

  // ---- Finding them ----------------------------------------------------------------------------------------

  /** A defeated hard monster may leave a scroll: it floats up and flies to the party, which picks it up by itself. */
  m._maybeDropScroll = function (r) {
    if (Math.random() >= SCROLL_DROP_CHANCE) return;
    const id = SCROLL_IDS[Math.floor(Math.random() * SCROLL_IDS.length)];
    this.scrollDrops.push({ id: id, worldX: this.scroll + r.x + r.w / 2.0, y: r.y + r.h * 0.4, age: 0 });
  };

  /** The party has the item in hand: kept if there is a free slot (a duplicate takes a slot of its own), otherwise the player decides what to give up. */
  m._offerScroll = function (id) {
    const x = this._leaderCenterX(), y = this.groundY - 26;
    const name = t(SCROLL_DEFS[id].name);
    if (this.scrolls.length < this.scrollCapacity) {
      this.scrolls.push(id);
      this.scrollSel = this.scrolls.length - 1;
      this._addItemText(t('Found {n}!', { n: name }), x, y, C(255, 226, 150));
      Sound.play('ItemBuy');
      this.raiseProgress();
      return;
    }
    this._beginScrollPrompt(this.scrolls.concat([id]), true);
  };

  m._beginScrollPrompt = function (candidates, lastIsNew) {
    this.scrollPrompt = candidates;
    this.scrollPromptHasNew = lastIsNew;
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** The player's pick of what to give up: that one is thrown away and the rest are kept (if the new one was picked, the party keeps what it had). */
  m.resolveScrollPrompt = function (index) {
    if (this.scrollPrompt === null || index < 0 || index >= this.scrollPrompt.length) return false;
    this.scrollPrompt.splice(index, 1);
    this.scrollPromptHasNew = this.scrollPromptHasNew && index !== this.scrollPrompt.length;   // (the new one was last; it is gone, or it is still there)
    if (this.scrollPrompt.length > this.scrollCapacity) { Sound.play('DiscClick'); return true; }   // still more than the storage holds: another has to go
    this.scrolls = this.scrollPrompt.slice();
    this.scrollPrompt = null; this.scrollPromptHasNew = false;
    this.scrollSel = Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel));
    Sound.play('DiscClick');
    this.raiseProgress();
    return true;
  };

  // ---- Using them ------------------------------------------------------------------------------------------

  m.selectScroll = function (index) {
    if (index < 0 || index >= this.scrolls.length || index === this.scrollSel) return;
    this.scrollSel = index;
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** Throws a carried scroll away. */
  m.discardScroll = function (index) {
    if (index < 0 || index >= this.scrolls.length || this.isWaiting || this.scrollPrompt !== null) return;
    this.scrolls.splice(index, 1);
    this.scrollSel = Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel));
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** Uses the selected scroll. The Rereviver pauses the game and asks who gets Rerevive (or cancel). False when there is nothing to use it on. */
  m.useScroll = function () {
    if (this.scrolls.length === 0 || this.isShopping || this.isWaiting || this.isGameOver || this.starting || this.scrollPrompt !== null || this.isTipActive) return false;
    const id = this.scrolls[this.scrollSelected];
    if (id === 'Rereviver') {
      if (!this.party.some(k => this.hpOf(k) > 0 && !this.hasRerevive(k))) {
        this._addItemText(t('Nobody can take it'), this._leaderCenterX(), this.groundY - 30, C(200, 226, 255));
        return false;
      }
      this.targetScroll = id; this.targetT = 0; this.targetHover = null;
      Sound.play('DiscClick');
      return true;
    }
    return false;
  };

  /** The scroll waiting for its target is given to `who`. */
  m._chooseScrollTarget = function (who) {
    if (this.targetScroll === null || this.party.indexOf(who) < 0) return false;
    const r = this._rectOf(who);
    if (this.hpOf(who) <= 0) { this._addItemText(t('Already fainted'), r.x + r.w / 2.0, r.y - 4, C(255, 190, 170)); return false; }
    if (this.hasRerevive(who)) { this._addItemText(t('Already has Rerevive'), r.x + r.w / 2.0, r.y - 4, C(200, 226, 255)); return false; }
    this.rerevive[who] = this.playDays + REREVIVE_PLAY_DAYS;
    const at = this.scrolls.indexOf(this.targetScroll);
    if (at >= 0) this.scrolls.splice(at, 1);
    this.scrollSel = Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel));
    this.targetScroll = null; this.targetHover = null;
    this.rerevivePulses.push({ kind: who, age: 0 });
    this._addItemText(t('Rerevive!'), r.x + r.w / 2.0, r.y - 8, C(150, 236, 255));
    Sound.play('ElixirUse');
    this.raiseProgress();
    return true;
  };

  /** A member about to faint who has Rerevive does not: they stay where they stand with half their HP, and the Rerevive is used up. */
  m._tryRerevive = function (kind) {
    if (!this.hasRerevive(kind)) return false;
    delete this.rerevive[kind];
    const hp = Math.max(1, Math.trunc((this.maxHpOf(kind) + 1) / 2));
    this.hp[kind] = hp;
    this.rerevivePulses.push({ kind: kind, age: 0 });
    this.heals.push({ from: kind, to: kind, amount: hp, age: 0 });
    const r = this._rectOf(kind);
    this._addItemText(t('Rerevived!'), r.x + r.w / 2.0, r.y - 8, C(150, 236, 255));
    Sound.play('Heal');
    this.raiseProgress();
    return true;
  };

  // ---- Time ------------------------------------------------------------------------------------------------

  m._advanceScroll = function (dt) {
    // Rerevive runs out at the end of its year of playing time.
    for (const k of Object.keys(this.rerevive)) if (this.rerevive[k] <= this.playDays) delete this.rerevive[k];
    for (let i = this.rerevivePulses.length - 1; i >= 0; i--) {
      this.rerevivePulses[i].age += dt;
      if (this.rerevivePulses[i].age >= REREVIVE_PULSE_SECONDS) this.rerevivePulses.splice(i, 1);
    }
    for (let i = this.scrollDrops.length - 1; i >= 0; i--) {
      const d = this.scrollDrops[i];
      d.age += dt;
      if (d.age >= SCROLL_FLY_SECONDS) { this.scrollDrops.splice(i, 1); this._offerScroll(d.id); }
    }
  };

  m._resetScroll = function () {
    this.scrolls = []; this.scrollSel = 0; this.targetScroll = null; this.rerevive = {}; this.scrollPrompt = null; this.scrollPromptHasNew = false;
    this.scrollDrops = []; this.rerevivePulses = [];
  };

  // ---- Saved: "Rereviver:Fae=12.5,Warrior=14.2" (the carried items, then who has Rerevive and until which play day) ----

  m._saveScrollFields = function () {
    const status = Object.keys(this.rerevive).filter(k => this.rerevive[k] > this.playDays && this.party.indexOf(k) >= 0).map(k => enumOf(k) + '=' + this.rerevive[k].toFixed(3)).join(',');
    return this.scrolls.join(',') + ':' + status;
  };

  m._loadScrollFields = function (field) {
    this._resetScroll();
    if (!field) return;
    const colon = field.indexOf(':');
    const items = colon < 0 ? field : field.substring(0, colon), status = colon < 0 ? '' : field.substring(colon + 1);
    for (const name of items.split(',').filter(s => s)) {
      if (SCROLL_IDS.indexOf(name) >= 0 && this.scrolls.length < this.scrollCapacity) this.scrolls.push(name);
    }
    for (const pair of status.split(',').filter(s => s)) {
      const kv = pair.split('='), kind = kv.length === 2 ? kindOfEnum(kv[0]) : null, until = kv.length === 2 ? parseFloat(kv[1]) : NaN;
      if (kind && this.party.indexOf(kind) >= 0 && !isNaN(until)) this.rerevive[kind] = until;
    }
  };

  // ---- Drawing ---------------------------------------------------------------------------------------------

  /** A scroll flying to the party, and the little heart over each member who has Rerevive (with a ring of light when it is given or used). */
  m._drawScrollEffects = function (g) {
    for (const d of this.scrollDrops) {
      const u = Math.min(1, d.age / SCROLL_FLY_SECONDS), e = u * u * (3 - 2 * u);
      const sx = d.worldX - this.scroll, sy = d.y, tx = this._leaderCenterX(), ty = this.groundY - 16;
      const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e - Math.sin(Math.PI * u) * 14;
      const icon = Sprites.scroll && Sprites.scroll[d.id];
      g.ellipse(x - 9, y - 9, 18, 18, CA(Math.trunc(70 + 50 * Math.sin(this.time * 12)), 255, 190, 80));
      if (icon) g.image(icon, Math.round(x - icon.width / 2), Math.round(y - icon.height / 2), false, undefined, icon.width, icon.height);
      for (let i = 0; i < 4; i++) {   // sparkles trailing behind it
        const ph = (u * 3 + i * 0.25) % 1.0;
        g.rect(Math.round(x - (tx - sx) * 0.06 * ph * 6 + Math.sin(i * 2.3) * 3), Math.round(y + ph * 7), 1, 1, CA(Math.trunc(220 * (1 - ph)), 255, 236, 160));
      }
    }
    const kinds = Object.keys(this.memberRects);
    for (const k of kinds) {
      if (this.party.indexOf(k) < 0 || !this.hasRerevive(k)) continue;
      const r = this.memberRects[k];
      const hx = r.x + Math.trunc(r.w / 2) - 3, hy = r.y - 13 - (this.hatLeft > 0 ? 6 : 0);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + kinds.indexOf(k));
      for (let y = 0; y < HEART_ROWS.length; y++)
        for (let x = 0; x < 7; x++) {
          if (HEART_ROWS[y][x] !== 'X') continue;
          g.rect(hx + x, hy + y, 1, 1, y <= 1 && x <= 2 ? C(236, 255, 255) : CA(Math.trunc(190 + 65 * pulse), 96, 214, 255));
        }
    }
    for (const p of this.rerevivePulses) {
      const r = this.memberRects[p.kind];
      if (!r) continue;
      const u = p.age / REREVIVE_PULSE_SECONDS;
      const cx = r.x + Math.trunc(r.w / 2), cy = r.y + Math.trunc(r.h / 2), rad = 4 + Math.trunc(16 * u), a = Math.trunc(230 * (1 - u));
      g.ellipse(cx - rad, cy - rad, rad * 2, rad * 2, CA(Math.trunc(a / 4), 150, 230, 255));
      g.ctx.save();
      g.ctx.strokeStyle = 'rgba(140,230,255,' + (a / 255).toFixed(3) + ')'; g.ctx.lineWidth = 1.5;
      g.ctx.beginPath(); g.ctx.ellipse(cx, cy, rad, rad, 0, 0, Math.PI * 2); g.ctx.stroke();
      g.ctx.restore();
    }
  };
}
