// Scrolls: kept apart from the bag and its hot slots. Duplicates are allowed, but each one takes a slot of its own: the party carries a limited number
// (1, plus 1 from the Paca), and they drop from the hardest monsters. A port of src\PixelScroll.cs.

import { C, CA } from './util.js';
import { Sound } from './sfx.js';
import { Sprites } from './sprites.js';
import { t } from './i18n.js';
import { enumOf, kindOfEnum } from './health.js';

export const SCROLL_IDS = ['Rereviver', 'Fang'];
/** The scrolls a monster can leave behind (Fang's Magnetic Field is every adventurer's own, and is never found on the road). */
const DROPPABLE = ['Rereviver'];
export const SCROLL_DEFS = {
  Fang: { name: "Fang's Magnetic Field", permanent: true, blurb: 'Every adventurer carries one, and it never runs out. Switched on, it lasts 15 minutes, and while it does it zaps in every Gold Coin the party meets. It can be switched on again 30 minutes after it was last.' },
  Rereviver: { name: 'Rereviver Scroll', blurb: 'Grants Rerevive to one party member for 1 year: if they faint, they instantly revive on the spot with 50% HP. It is used up when it does.' },
};

/** The chance that a defeated Gargogryph, Wickedgryph or Toucan leaves a scroll. */
export const SCROLL_DROP_CHANCE = 0.2;
/** Fang's Magnetic Field: how long it lasts once switched on, and how long after that switching it can be switched on again (adventuring time). */
export const FANG_ACTIVE_SECONDS = 15 * 60, FANG_COOLDOWN_SECONDS = 30 * 60;
const FANG_PULL_SECONDS = 0.2, FANG_PULL_RANGE = 18;   // a coin that passes within this many pixels of the orb is pulled into it, taking this long
/** A time left as m:ss. */
export function fangClock(seconds) { const n = Math.ceil(Math.max(0, seconds)); return Math.trunc(n / 60) + ':' + String(n % 60).padStart(2, '0'); }
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
    this.fangActiveLeft = 0; this.fangCooldownLeft = 0; this.fangPulls = []; this.fangFlash = 0;   // Fang's Magnetic Field: the time left on, and the wait left before it can be switched on again
  };

  /** Every item and scroll the party has ever held (ids), for the compendium's Items tab: it keeps them once they are used up. */
  m._seen = function () { if (!this.itemsSeen) this.itemsSeen = new Set(); return this.itemsSeen; };

  // ---- What the page can read ------------------------------------------------------------------------------

  Object.defineProperties(m, {
    /** How many scrolls the party can carry: 2 (one of them Fang's Magnetic Field, which keeps its slot), plus what the Paca adds while he is in it. */
    scrollCapacity: { get() { return 2 + this.itemStorage; } },
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
    const id = DROPPABLE[Math.floor(Math.random() * DROPPABLE.length)];
    this.scrollDrops.push({ id: id, worldX: this.scroll + r.x + r.w / 2.0, y: r.y + r.h * 0.4, age: 0 });
  };

  /** The party has the item in hand: kept if there is a free slot (a duplicate takes a slot of its own), otherwise the player decides what to give up. */
  m._offerScroll = function (id) {
    const x = this._leaderCenterX(), y = this.groundY - 26;
    const name = t(SCROLL_DEFS[id].name);
    this._seen().add(id);   // (for the compendium's Items tab)
    if (this.scrolls.length < this.scrollCapacity) {
      this.scrolls.push(id);
      this.scrollSel = this.scrolls.length - 1;
      this._addItemText(t('Found {n}!', { n: name }), x, y, C(255, 226, 150));
      Sound.play('ItemBuy');
      this.raiseProgress();
      return;
    }
    this._beginScrollPrompt(this.scrolls.filter(s => !SCROLL_DEFS[s].permanent).concat([id]), true);   // (Fang's Magnetic Field is never offered to be thrown away)
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
    const kept = this.scrolls.filter(s => SCROLL_DEFS[s].permanent);
    if (this.scrollPrompt.length > this.scrollCapacity - kept.length) { Sound.play('DiscClick'); return true; }   // still more than the storage holds: another has to go
    this.scrolls = kept.concat(this.scrollPrompt);
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
    if (index < 0 || index >= this.scrolls.length || this.isWaiting || this.scrollPrompt !== null || SCROLL_DEFS[this.scrolls[index]].permanent) return;
    this.scrolls.splice(index, 1);
    this.scrollSel = Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel));
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** Uses the selected scroll. The Rereviver pauses the game and asks who gets Rerevive (or cancel). False when there is nothing to use it on. */
  m.useScroll = function () {
    if (this.scrolls.length === 0 || this.isShopping || this.isWaiting || this.isGameOver || this.starting || this.scrollPrompt !== null || this.isTipActive) return false;
    const id = this.scrolls[this.scrollSelected];
    if (id === 'Fang') {
      const fx = this._leaderCenterX(), fy = this.groundY - 30;
      if (this.fangActiveLeft > 0) { this._addItemText(t('Already active'), fx, fy, C(200, 226, 255)); return false; }
      if (this.fangCooldownLeft > 0) { this._addItemText(t('Recharging: {n}', { n: fangClock(this.fangCooldownLeft) }), fx, fy, C(200, 226, 255)); return false; }
      this.fangActiveLeft = FANG_ACTIVE_SECONDS;
      this.fangCooldownLeft = FANG_COOLDOWN_SECONDS;   // (counted from now: it is ready again 30 minutes after it was switched on)
      this._addItemText(t('Magnetic Field!'), fx, fy, C(150, 226, 255));
      this._say('The party used {0}.', SCROLL_DEFS[id].name);
      Sound.play('Zap');
      this.raiseProgress();
      return true;
    }
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
    this._say('{0} was revived.', this._h(kind));
    this._addItemText(t('Rerevived!'), r.x + r.w / 2.0, r.y - 8, C(150, 236, 255));
    Sound.play('Heal');
    this.raiseProgress();
    return true;
  };

  // ---- Time ------------------------------------------------------------------------------------------------

  /** Where the orb floats: just behind the party, out of the way of the fighting at the front. A coin has to pass the whole party to reach it. */
  m._fangOrbPosition = function () {
    let rear = null;
    for (const k of Object.keys(this.memberRects)) {
      if (this.party.indexOf(k) < 0) continue;
      const r = this.memberRects[k];
      if (rear === null || r.x < rear.x) rear = r;
    }
    if (rear === null) rear = this._rectOf(this._frontKind());
    return { x: Math.max(6, rear.x - 8), y: rear.y + rear.h * 0.4 + Math.sin(this.time * 3) * 0.8 };
  };

  /** Fang's Magnetic Field, in adventuring time: both clocks run, and while it is on a Gold Coin that passes the orb behind the party is pulled into it. */
  m._advanceFang = function (dt, paused) {
    if (paused) return;
    if (this.fangCooldownLeft > 0) this.fangCooldownLeft = Math.max(0, this.fangCooldownLeft - dt);
    if (this.fangActiveLeft <= 0) return;
    this.fangActiveLeft = Math.max(0, this.fangActiveLeft - dt);
    if (this.coins.length === 0 || this.party.length === 0 || this.isGameOver) return;
    const reach = this._fangOrbPosition().x + FANG_PULL_RANGE;
    let pulled = false;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (this._coinX(c) > reach) continue;
      this.fangPulls.push({ x: this._coinX(c), y: this._coinY(c), age: 0 });
      this.coins.splice(i, 1);
      this.gold++;   // (counted at once; the coin's trip into the orb, and on to the counter, is for show)
      pulled = true;
    }
    if (pulled) { Sound.play('Zap'); this.raiseProgress(); }
  };

  m._advanceScroll = function (dt) {
    if (this.fangFlash > 0) this.fangFlash = Math.max(0, this.fangFlash - dt / 0.25);
    for (let i = this.fangPulls.length - 1; i >= 0; i--) {
      this.fangPulls[i].age += dt;
      if (this.fangPulls[i].age < FANG_PULL_SECONDS) continue;
      this.fangPulls.splice(i, 1);
      if (this.party.length > 0) { const orb = this._fangOrbPosition(); this.flying.push({ x: orb.x, y: orb.y, age: 0 }); }   // the coin goes on from the orb to the counter
      this.fangFlash = 1;
    }
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
    this.fangActiveLeft = 0; this.fangCooldownLeft = 0; this.fangPulls = []; this.fangFlash = 0;
    this._ensureFang();
  };

  /** Everyone carries Fang's Magnetic Field, in the first slot, from the start (and an older save gets one too). */
  m._ensureFang = function () {
    if (this.scrolls.indexOf('Fang') < 0) this.scrolls.unshift('Fang');
    this._seen().add('Fang');
    while (this.scrolls.length > this.scrollCapacity) {
      let drop = -1;
      for (let i = this.scrolls.length - 1; i >= 0; i--) if (!SCROLL_DEFS[this.scrolls[i]].permanent) { drop = i; break; }
      if (drop < 0) break;
      this.scrolls.splice(drop, 1);
    }
    this.scrollSel = Math.max(0, Math.min(this.scrolls.length - 1, this.scrollSel));
  };

  // ---- Saved: "Rereviver:Fae=12.5,Warrior=14.2" (the carried items, then who has Rerevive and until which play day) ----

  m._saveScrollFields = function () {
    const status = Object.keys(this.rerevive).filter(k => this.rerevive[k] > this.playDays && this.party.indexOf(k) >= 0).map(k => enumOf(k) + '=' + this.rerevive[k].toFixed(3)).join(',');
    return this.scrolls.join(',') + ':' + status + ':' + this.fangActiveLeft.toFixed(1) + ',' + this.fangCooldownLeft.toFixed(1);
  };

  m._loadScrollFields = function (field) {
    this._resetScroll();
    if (!field) return;
    const segments = field.split(':');   // the carried items : who has Rerevive : Fang's clocks (an older save has the first two, or the first)
    const items = segments[0], status = segments.length > 1 ? segments[1] : '';
    if (segments.length > 2) {
      const clocks = segments[2].split(','), on = parseFloat(clocks[0]), wait = parseFloat(clocks[1]);
      if (clocks.length === 2 && !isNaN(on) && !isNaN(wait)) { this.fangActiveLeft = Math.max(0, Math.min(FANG_ACTIVE_SECONDS, on)); this.fangCooldownLeft = Math.max(0, Math.min(FANG_COOLDOWN_SECONDS, wait)); }
    }
    for (const name of items.split(',').filter(s => s)) {
      if (SCROLL_IDS.indexOf(name) >= 0 && this.scrolls.length < this.scrollCapacity && !(SCROLL_DEFS[name].permanent && this.scrolls.indexOf(name) >= 0)) this.scrolls.push(name);
    }
    for (const pair of status.split(',').filter(s => s)) {
      const kv = pair.split('='), kind = kv.length === 2 ? kindOfEnum(kv[0]) : null, until = kv.length === 2 ? parseFloat(kv[1]) : NaN;
      if (kind && this.party.indexOf(kind) >= 0 && !isNaN(until)) this.rerevive[kind] = until;
    }
    this._ensureFang();
  };

  // ---- Drawing ---------------------------------------------------------------------------------------------

  /** A scroll flying to the party, and the little heart over each member who has Rerevive (with a ring of light when it is given or used). */
  /** The magnetic orb while Fang's Magnetic Field is on: a small glowing ball of blue light, with two sparks circling it, floating behind the party; and the
   *  coins being drawn into it. */
  m._drawFangField = function (g) {
    if (this.party.length === 0) return;
    const ctx = g.ctx, orb = this._fangOrbPosition();
    if (this.fangActiveLeft > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5), flash = this.fangFlash, cx = orb.x, cy = orb.y;
      ctx.save();
      const disc = (r, rgba) => { ctx.fillStyle = rgba; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); };
      disc(7, 'rgba(120,210,255,' + ((34 + 26 * pulse + 60 * flash) / 255).toFixed(3) + ')');
      disc(4, 'rgba(140,222,255,' + ((110 + 50 * pulse) / 255).toFixed(3) + ')');
      disc(2, 'rgb(236,252,255)');
      if (flash > 0) {
        ctx.strokeStyle = 'rgba(200,240,255,' + (0.78 * flash).toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 8 + 3 * (1 - flash), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,244,150,0.94)';
      for (let i = 0; i < 2; i++) { const a = this.time * 4.5 + i * Math.PI; ctx.fillRect(Math.round(cx + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 3), 1, 1); }
      ctx.restore();
    }
    const coin = Sprites.coin;
    for (const p of this.fangPulls) {
      const u = Math.min(1, p.age / FANG_PULL_SECONDS), e = u * u;   // it starts slowly and is snatched in at the end
      const x = p.x + (orb.x - p.x) * e, y = p.y + (orb.y - p.y) * e;
      for (let k = 1; k <= 2; k++) {   // a short faint trail behind it
        const ue = Math.max(0, u - 0.08 * k), ee = ue * ue;
        g.rect(Math.round(p.x + (orb.x - p.x) * ee), Math.round(p.y + (orb.y - p.y) * ee), 1, 1, CA(Math.trunc(120 / k), 160, 226, 255));
      }
      const s = 1 - 0.55 * u, w = Math.max(2, Math.round(coin.width * s)), h = Math.max(2, Math.round(coin.height * s));
      g.image(coin, Math.round(x - w / 2), Math.round(y - h / 2), false, undefined, w, h);
    }
  };

  m._drawScrollEffects = function (g) {
    this._drawFangField(g);
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
