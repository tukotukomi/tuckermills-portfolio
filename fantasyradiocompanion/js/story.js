// The Old Man, the Fantasy Crystals, dialogue and levelling up. A port of src\PixelStory.cs.

import { t } from './i18n.js';
import { C, CA, withAlpha, ease } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';

const OLD_MAN_WALK_SECONDS = 1.6, TOSS_SECONDS = 1.3, PICKUP_SECONDS = 0.9, LEVEL_FX_SECONDS = 2.2;
const CHARS_PER_SECOND = 34;
const IDLE_BREATH_SECONDS = 3.6;
const SPACING = 25;

export function installStory(P) {
  const m = P.prototype;

  m._initStory = function () {
    this.story = 'None';
    this.storyT = 0;
    this.lines = [];
    this.line = 0;
    this.storyFromOldMan = false;
    this.oldManMet = false;
    this.oldManVisible = false;
    this.levels = {};
    this.selected = -1;
    this.fxMember = -1; this.fxFrom = 0; this.fxTo = 0;
    this.crystalActive = false; this.crystalWorldX = 0; this.crystalFromX = 0;
    this.nextCrystalDay = 0;
    this.dlgChars = 0; this.dlgSounded = 0; this.dlgTrackedLine = -1; this.tossSounded = false;
  };

  // ---- What the UI reads and does --------------------------------------------------------------

  Object.defineProperties(m, {
    isDialogue: { get() { return this.enc === 'Story' && this.story === 'Say' && this.line < this.lines.length; } },
    dialogueWho: { get() { return this.isDialogue ? this.lines[this.line].who : null; } },
    dialogueText: { get() { return this.isDialogue ? t(this.lines[this.line].text) : ''; } },
    dialogueShownText: {
      get() {
        if (!this.isDialogue) return '';
        const text = t(this.lines[this.line].text);
        return text.substring(0, Math.max(0, Math.min(text.length, Math.trunc(this.dlgChars))));
      }
    },
    dialogueTyping: { get() { return this.isDialogue && Math.trunc(this.dlgChars) < t(this.lines[this.line].text).length; } },
    dialogueReady: { get() { return this.isDialogue && !this.dialogueTyping && (!this.lines[this.line].toss || this.storyT >= TOSS_SECONDS); } },
    isLevelSelect: { get() { return this.enc === 'Story' && this.story === 'Select'; } },
    isLevelFx: { get() { return this.enc === 'Story' && this.story === 'LevelFx'; } },
    levelFxText: {
      get() {
        return this.fxMember >= 0 && this.fxMember < this.party.length
          ? t('{name} reached Lv. {n}!', { name: displayName(this.party[this.fxMember]), n: this.fxTo }) : '';
      }
    },
  });

  m.levelOf = function (kind) { return this.levels[kind] || 1; };

  m.advanceDialogue = function () {
    if (this.dialogueTyping) {   // the first click completes the line, the next reads on
      this.dlgChars = t(this.lines[this.line].text).length;
      this.dlgSounded = t(this.lines[this.line].text).length;
      return;
    }
    if (!this.dialogueReady) return;
    this.line++;
    this.storyT = 0;
    this.dlgChars = 0; this.dlgSounded = 0; this.dlgTrackedLine = -1; this.tossSounded = false;
    if (this.line >= this.lines.length) { this.story = 'Select'; this.selected = -1; this.raiseProgress(); }
  };

  m.selectMember = function (partyIndex) {
    if (this.isLevelSelect && partyIndex >= 0 && partyIndex < this.party.length) this.selected = partyIndex;
  };

  /** The LEVEL UP button: the highlighted member goes up a level and time can move on once the celebration ends. */
  m.confirmLevelUp = function () {
    if (!this.isLevelSelect || this.selected < 0 || this.selected >= this.party.length) return false;
    const kind = this.party[this.selected];
    this.fxMember = this.selected;
    this.fxFrom = this.levelOf(kind);
    this.fxTo = this.fxFrom + 1;
    this.levels[kind] = this.fxTo;
    this.story = 'LevelFx';
    this.storyT = 0;
    Sound.play('LevelUp');
    this.raiseProgress();
    return true;
  };

  m.skipLevelFx = function () { if (this.isLevelFx && this.storyT > 0.8) this._finishLevelFx(); };

  // ---- The story engine ----------------------------------------------------------------------------

  m._startOldMan = function () {
    this.enc = 'Story';
    this.story = 'OldManExit';
    this.storyT = 0;
    this.storyFromOldMan = true;
    this.oldManVisible = true;
    this.selected = -1;
    this.line = 0;
    this.lines = [
      { who: 'Old Man', text: "Quite the journey you've been on.", toss: false },
      { who: 'Old Man', text: 'Are you prepared to level up your adventure?', toss: false },
      { who: 'Old Man', text: 'It matters not, for that is your destiny.', toss: false },
      { who: 'Old Man', text: 'It so happens I have what you need.', toss: false },
      { who: null, text: 'The Old Man throws you a blue crystal.', toss: true },
      { who: 'Old Man', text: 'Give this to someone in your party.', toss: false },
    ];
    this.raiseProgress();
  };

  m._spawnCrystal = function () {
    this.crystalActive = true;
    this.crystalWorldX = this.scroll + this.lastLw + 10;
    Sound.startLoop('crystal', 'CrystalHum', 0);
  };

  m._crystalScreenX = function () { return this.crystalWorldX - this.scroll; };

  /** Lets a Fantasy Crystal on the road be heard: faint when far off the right of the screen, loud when the party is nearly on it. */
  m._updateCrystalHum = function (audible) {
    if (!this.crystalActive) return;
    const lw = Math.max(60, this.lastLw);
    const distance = Math.abs(this._crystalScreenX() - this._leaderCenterX());
    const near = Math.max(0, Math.min(1, 1 - distance / (lw * 1.2)));
    Sound.setLoopGain('crystal', audible ? 0.18 + 0.82 * near * near : 0);
  };

  m._beginCrystalPickup = function () {
    this.crystalFromX = this._crystalScreenX();
    Sound.stopLoop('crystal');
    Sound.play('CrystalCollect');
    this.enc = 'Story';
    this.story = 'CrystalPickup';
    this.storyT = 0;
    this.storyFromOldMan = false;
    this.selected = -1;
    this.line = 0;
    this.lines = [{ who: null, text: 'You found a Fantasy Crystal! Give it to someone in your party.', toss: false }];
    this.raiseProgress();
  };

  m._advanceStory = function (dt) {
    this.storyT += dt;
    if (this.story === 'Say' && this.line < this.lines.length) {
      const line = this.lines[this.line];
      if (this.dlgTrackedLine !== this.line) { this.dlgTrackedLine = this.line; this.dlgChars = 0; this.dlgSounded = 0; this.tossSounded = false; }
      if (this.dlgChars < t(line.text).length) this.dlgChars = Math.min(t(line.text).length, this.dlgChars + dt * CHARS_PER_SECOND);
      const shown = Math.min(t(line.text).length, Math.trunc(this.dlgChars));
      let blipped = false;
      while (this.dlgSounded < shown) {
        const c = t(line.text)[this.dlgSounded++];
        if (blipped || !/[\p{L}\p{N}]/u.test(c)) continue;
        blipped = true;
        // Each voice has its own pitch; the letter nudges it up or down, which is what makes it sound like mumbling.
        const basePitch = line.who === 'Old Man' ? 128 : line.who === null ? 330 : 220;
        const hz = Math.trunc(basePitch * (1 + ((c.toLowerCase().charCodeAt(0) % 11) - 5) * 0.05));
        Sound.blip(hz, line.who === 'Old Man' ? 0.55 : 0.4, line.who === null);
      }
      if (line.toss && !this.tossSounded && this.storyT >= TOSS_SECONDS) { this.tossSounded = true; Sound.play('CrystalCollect'); }
    } else if (this.story !== 'Say') this.dlgTrackedLine = -1;

    switch (this.story) {
      case 'OldManExit':
        if (this.storyT >= OLD_MAN_WALK_SECONDS) { this.story = 'Say'; this.storyT = 0; this.line = 0; }
        break;
      case 'CrystalPickup':
        if (this.storyT >= PICKUP_SECONDS) { this.story = 'Say'; this.storyT = 0; this.line = 0; }
        break;
      case 'LevelFx':
        if (this.storyT >= LEVEL_FX_SECONDS) this._finishLevelFx();
        break;
      case 'OldManLeave':
        if (this.storyT >= OLD_MAN_WALK_SECONDS) this._finishEncounter();
        break;
    }
  };

  m._finishLevelFx = function () {
    if (this.storyFromOldMan && this.oldManVisible) {
      this.oldManMet = true;
      this.story = 'OldManLeave';
      this.storyT = 0;
      this.raiseProgress();
    } else this._finishEncounter();
  };

  m._finishEncounter = function () {
    const fromTavern = this.storyFromOldMan;
    if (fromTavern) this.oldManMet = true;
    this.oldManVisible = false;
    this.crystalActive = false;
    Sound.stopLoop('crystal');
    this.story = 'None';
    this.selected = -1;
    this.fxMember = -1;
    if (fromTavern) {
      // The Old Man's visit ends the tavern's business, but not the visit: the inn comes last, and finishing there completes the day.
      this.innAfterOldMan = true;
      this._beginInn();
      return;
    }
    this.enc = 'None';
    this.arrived = false;
    this.nextCrystalDay = (Math.trunc(this.daysCompleted / 2) + 1) * 2;
    this.raiseProgress();
  };

  m._resetStory = function () {
    this.story = 'None';
    this.storyT = 0;
    this.lines = [];
    this.line = 0;
    this.storyFromOldMan = false;
    this.oldManMet = false;
    this.oldManVisible = false;
    this.levels = {};
    this.selected = -1;
    this.fxMember = -1;
    this.crystalActive = false;
    Sound.stopLoop('crystal');
    this.dlgChars = 0; this.dlgSounded = 0; this.dlgTrackedLine = -1; this.tossSounded = false;
    this.nextCrystalDay = 0;
  };

  // ---- Saved fields ------------------------------------------------------------------------------------

  m._saveStoryFields = function () {
    const levels = this.party.map(k => ENUM[k] + ':' + this.levelOf(k)).join(',');
    const pending = this.enc === 'Story' && (this.story === 'Say' || this.story === 'Select' || this.story === 'CrystalPickup');
    return levels + '|' + (this.oldManMet ? 1 : 0) + '|' + this.nextCrystalDay + '|' + (pending ? (this.storyFromOldMan ? 2 : 1) : 0);
  };

  m._loadStoryFields = function (p, at) {
    this._resetStory();
    if (p.length <= at + 3) return;
    for (const pair of p[at].split(',').filter(s => s)) {
      const kv = pair.split(':');
      const lv = parseInt(kv[1], 10);
      if (kv.length === 2 && FROM_ENUM[kv[0]] && lv >= 1) this.levels[FROM_ENUM[kv[0]]] = Math.min(lv, 999);
    }
    this.oldManMet = p[at + 1] === '1';
    const next = parseInt(p[at + 2], 10);
    this.nextCrystalDay = isNaN(next) ? 0 : Math.max(0, next);
    const pending = p[at + 3];
    if (pending === '1' || pending === '2') {
      this.enc = 'Story'; this.story = 'Select'; this.storyFromOldMan = pending === '2'; this.selected = -1;
    }
  };

  // ---- Drawing: the Old Man ------------------------------------------------------------------------------

  m._oldManStandX = function () { return this._leaderX() + Sprites.party[this._frontKind()].w + 16; };
  m._oldManDoorLeft = function () { return this.tavernWorldX - this.scroll + Sprites.tavernDoorX - Sprites.oldMan.w / 2.0; };

  m._drawOldMan = function (g) {
    if (!this.oldManVisible || !this.tavernVisible) return;
    const sp = Sprites.oldMan;
    const stand = this._oldManStandX(), door = this._oldManDoorLeft();
    let x = stand, walking = false, faceLeft = true;
    if (this.enc === 'Story' && this.story === 'OldManExit') {
      const u = ease(this.storyT / OLD_MAN_WALK_SECONDS);
      x = door + (stand - door) * u; walking = u < 1; faceLeft = false;
    } else if (this.enc === 'Story' && this.story === 'OldManLeave') {
      const u = ease(this.storyT / OLD_MAN_WALK_SECONDS);
      x = stand + (door - stand) * u; walking = u < 1;
      if (u > 0.96) return;
    }
    const stepB = walking && (Math.trunc(this.time * 4)) % 2 === 1;
    const frame = faceLeft ? (stepB ? sp.lb : sp.la) : (stepB ? sp.b : sp.a);
    const breath = (!walking && Math.sin(this.time * 2 * Math.PI / IDLE_BREATH_SECONDS + 1.3) > 0) ? 1 : 0;
    const xi = Math.round(x), y = this.groundY + 1 - sp.h - breath;
    g.ellipse(xi + Math.trunc((sp.w - 12) / 2), this.groundY, 12, 2, CA(90, 20, 30, 20));
    g.image(frame, xi, y, false, undefined, sp.w, sp.h + breath);
  };

  // ---- Drawing: the Fantasy Crystal ------------------------------------------------------------------------

  m._drawCrystalLayer = function (g, lw) {
    const pose = this._crystalPose(lw);
    if (pose) this._drawCrystalGlow(g, pose.x, pose.y);
    this._drawLevelBurst(g);
    this._drawPickupFlash(g, lw);
  };

  m._crystalPose = function (lw) {
    const bob = Math.sin(this.time * 3.0) * 1.4;
    const hoverX = this._leaderCenterX(), hoverY = this.groundY - 20 + bob, roadY = this.groundY - 9 + bob;
    if (this.crystalActive && this.enc === 'None') {
      const x = this._crystalScreenX();
      return x > -14 && x < lw + 14 ? { x: x, y: roadY } : null;
    }
    if (this.enc !== 'Story') return null;
    switch (this.story) {
      case 'CrystalPickup': {
        const u = ease(this.storyT / PICKUP_SECONDS);
        return { x: this.crystalFromX + (hoverX - this.crystalFromX) * u, y: (this.groundY - 9) + (hoverY - (this.groundY - 9)) * u };
      }
      case 'Say': {
        if (!this.storyFromOldMan) return { x: hoverX, y: hoverY };
        const tossAt = this.lines.findIndex(l => l.toss);
        if (this.line < tossAt) return null;
        if (this.line === tossAt) {
          const u = Math.min(1, this.storyT / TOSS_SECONDS);
          const sx = this._oldManStandX() + 2, sy = this.groundY - 12;
          return { x: sx + (hoverX - sx) * u, y: sy + (hoverY - sy) * u - Math.sin(Math.PI * u) * 12 };
        }
        return { x: hoverX, y: hoverY };
      }
      case 'Select':
        return { x: hoverX, y: hoverY };
      case 'LevelFx': {
        if (this.storyT > 0.7 || this.fxMember < 0) return null;
        const u = ease(this.storyT / 0.7);
        const fr = this._rectOf(this.party[this.fxMember]);   // where they stand now, in the line or in the cart
        const tx = fr.x + fr.w / 2.0, ty = fr.y + fr.h / 2.0;
        return { x: hoverX + (tx - hoverX) * u, y: hoverY + (ty - hoverY) * u };
      }
    }
    return null;
  };

  m._drawCrystalGlow = function (g, cx, cy) {
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4);
    const onRoad = this.crystalActive && this.enc === 'None';
    const bottom = onRoad ? this.groundY : cy;
    for (let yy = 0; yy < Math.trunc(bottom); yy++) {
      const f = yy / Math.max(1, bottom);
      const shimmer = 0.75 + 0.25 * Math.sin(this.time * 4 + yy * 0.7);
      const a = Math.trunc((34 + 150 * f) * shimmer);
      g.rect(Math.round(cx - 4), yy, 9, 1, CA(Math.min(255, Math.max(0, Math.trunc(a * 2 / 5))), 150, 205, 255));
      g.rect(Math.round(cx - 1), yy, 3, 1, CA(Math.min(255, Math.max(0, a)), 225, 242, 255));
    }
    if (onRoad) g.ellipse(cx - 8, this.groundY - 1, 16, 4, CA(Math.trunc(80 + 40 * pulse), 170, 215, 255));
    const r = 15 + 3 * pulse;
    for (const layer of [{ R: r, A: 34 }, { R: r * 0.72, A: 56 }, { R: r * 0.48, A: 92 }, { R: r * 0.3, A: 140 }])
      g.ellipse(cx - layer.R, cy - layer.R, layer.R * 2, layer.R * 2, CA(layer.A, 140, 200, 255));

    const img = Sprites.crystal;
    const dx = Math.round(cx - img.width / 2), dy = Math.round(cy - img.height / 2);
    g.image(img, dx, dy);
    g.image(Sprites.crystalBright, dx, dy, false, 0.15 + 0.45 * pulse);   // a brighter copy blended over it on each pulse

    for (let i = 0; i < 6; i++) {
      const ang = this.time * (1.1 + 0.15 * (i % 3)) + i * Math.PI / 3;
      const rad = 9 + 2.5 * Math.sin(this.time * 2 + i);
      const sx = cx + Math.cos(ang) * rad, sy = cy + Math.sin(ang) * rad * 0.8;
      const tw = 0.5 + 0.5 * Math.sin(this.time * 7 + i * 2.1);
      const col = CA(Math.trunc(110 + 145 * tw), i % 2 === 0 ? 255 : 190, 255, 255);
      px(g, col, sx, sy);
      if (tw > 0.55) { px(g, col, sx - 1, sy); px(g, col, sx + 1, sy); px(g, col, sx, sy - 1); px(g, col, sx, sy + 1); }
    }
    for (let i = 0; i < 7; i++) {
      const ph = (this.time * 0.55 + i * 0.143) % 1.0;
      px(g, CA(Math.trunc(210 * (1 - ph)), 220, 242, 255), cx + Math.sin(i * 2.7 + this.time * 0.8) * 6, cy + 6 - ph * 22);
    }
  };

  m._drawPickupFlash = function (g, lw) {
    if (!(this.enc === 'Story' && this.story === 'CrystalPickup') || this.storyT > 0.6) return;
    const t = this.storyT / 0.6;
    g.rect(0, 0, lw, this.lh, CA(Math.trunc(110 * (1 - t)), 235, 246, 255));
    const cx = this.crystalFromX, cy = this.groundY - 9, rad = 4 + 30 * t;
    g.ring(cx - rad, cy - rad * 0.7, rad * 2, rad * 1.4, CA(Math.trunc(220 * (1 - t)), 230, 244, 255));
  };

  m._drawLevelBurst = function (g) {
    if (!(this.enc === 'Story' && this.story === 'LevelFx') || this.fxMember < 0 || this.fxMember >= this.party.length || this.storyT < 0.6) return;
    const t = (this.storyT - 0.6) / (LEVEL_FX_SECONDS - 0.6);
    const sp = Sprites.party[this.party[this.fxMember]];
    const fr = this._rectOf(this.party[this.fxMember]);
    const cx = fr.x + fr.w / 2.0, baseY = fr.y + fr.h;
    g.ellipse(cx - sp.w, baseY - sp.h - 4, sp.w * 2, sp.h + 8, CA(Math.trunc(120 * (1 - t)), 190, 225, 255));
    for (let i = 0; i < 18; i++) {
      const ph = (t * 1.6 + i / 18.0) % 1.0;
      const sx = cx + Math.sin(i * 2.4) * (sp.w * 0.6), sy = baseY - ph * (sp.h + 14);
      const col = CA(Math.trunc(255 * (1 - ph) * (1 - t * 0.5)), i % 3 === 0 ? 255 : 190, i % 3 === 1 ? 255 : 240, 255);
      px(g, col, sx, sy);
      if (i % 2 === 0) { px(g, col, sx - 1, sy); px(g, col, sx + 1, sy); px(g, col, sx, sy - 1); px(g, col, sx, sy + 1); }
    }
  };
}

function px(g, c, x, y) { g.rect(Math.round(x), Math.round(y), 1, 1, c); }

export const ENUM = { paca: 'Paca', thief: 'Thief', warrior: 'Warrior', lightmage: 'LightMage', firemage: 'FireMage', fae: 'Fae' };
export const FROM_ENUM = {};
for (const k of Object.keys(ENUM)) FROM_ENUM[ENUM[k]] = k;
// Saves written before the art rework used the old names; they still load.
Object.assign(FROM_ENUM, { Chocobo: 'paca', MithraThief: 'thief', WhiteMage: 'lightmage', BlackMage: 'firemage', Moogle: 'fae' });
const NAMES = { paca: 'Paca', thief: 'Thief', warrior: 'Warrior', lightmage: 'Light Mage', firemage: 'Fire Mage', fae: 'Fae' };
export function displayName(kind) { return t(NAMES[kind] || kind); }
