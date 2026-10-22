// The skill trees. A port of src\PixelSkills.cs. A hero reaching a tree's level is offered two paths at the moment they level up and keeps the
// one they pick for good. A hero who is already past a tree's level (an adventure from before the tree existed, or one saved at the choice) has the
// choice waiting: the "New skills available" button lets them make it later. So far the Warrior and the Light Mage have trees (at level 5: Stalwart or Rager, Paralyze or Diminish; Stalwart takes 25%
// less damage, Rager deals 25% more); the rest will follow in the same shape.

import { C } from './util.js';
import { Sound } from './sfx.js';
import { enumOf, kindOfEnum } from './health.js';

const TREES = {
  warrior: {
    5: [
      { id: 'Stalwart', name: 'Stalwart', description: 'Reduce incoming physical damage by 25%.' },
      { id: 'Rager', name: 'Rager', description: 'Increase damage dealt to enemies by 25%.' },
    ],
  },
  lightmage: {
    5: [
      { id: 'Paralyze', name: 'Paralyze', description: '20% chance to stop the enemy from attacking for 15 s. Recast 40 s, range 30 blocks.' },
      { id: 'Diminish', name: 'Diminish', description: 'The enemy takes 10% more damage for 20 s. Recast 40 s, range 30 blocks.' },
    ],
  },
};

/** The levels at which a hero is offered a choice. */
export function skillChoiceLevels(kind) { return TREES[kind] ? Object.keys(TREES[kind]).map(Number) : []; }

/** The two paths offered at a level, or null when there is no choice there. */
export function skillChoiceAt(kind, level) { return TREES[kind] && TREES[kind][level] ? TREES[kind][level] : null; }

/** The tree in a line, for the compendium. */
export function skillSummary(kind) {
  return skillChoiceLevels(kind).map(lv => 'Lv. ' + lv + ': ' + skillChoiceAt(kind, lv).map(o => o.name + ' (' + o.description.replace(/\.$/, '') + ')').join(' or ')).join('; ');
}

export function installSkills(P) {
  const m = P.prototype;

  m._sk = function () { if (!this.skills) this.skills = {}; return this.skills; };   // hero -> { level: path id }

  /** Whether a hero has taken a path (at any level). */
  m.hasSkill = function (kind, id) { const d = this._sk()[kind]; return !!d && Object.values(d).indexOf(id) >= 0; };
  m._skillTaken = function (kind, level) { const d = this._sk()[kind]; return !!d && !!d[level]; };

  /** The first tree level a hero has reached without choosing yet (0 if none). */
  m._pendingSkillLevel = function (kind) {
    for (const lv of skillChoiceLevels(kind)) if (this.levelOf(kind) >= lv && !this._skillTaken(kind, lv)) return lv;
    return 0;
  };

  /** The heroes in the party who have a path waiting to be chosen. */
  Object.defineProperty(m, 'skillsWaiting', { get() { return this.party.filter(k => this._pendingSkillLevel(k) > 0); } });

  /** Whether the "New skills available" button shows: someone has a path waiting and nothing else has the screen. */
  Object.defineProperty(m, 'skillsAvailable', { get() { return !this.starting && this.enc === 'None' && this.story === 'None' && !this.isGameOver && this.skillsWaiting.length > 0; } });

  /** True while the screen for choosing a path (or the hero to choose it for) is up. */
  Object.defineProperty(m, 'isSkillChoice', { get() { return this.enc === 'Story' && this.story === 'SkillChoice'; } });
  Object.defineProperty(m, 'isSkillPick', { get() { return this.isSkillChoice && !!this.skillPick; } });
  Object.defineProperty(m, 'skillPickHeroes', { get() { return this.skillPick || []; } });
  /** The screen may be closed (it came from the button, not straight from a level-up). */
  Object.defineProperty(m, 'canCancelSkill', { get() { return this.isSkillChoice && !this.skillFromLevelUp; } });

  /** A hero has just levelled up to a tree's level: their choice comes up at once. True if it did. */
  m._beginSkillChoiceAfterLevelUp = function (who, level) {
    if (!skillChoiceAt(who, level) || this._skillTaken(who, level)) return false;
    this._showSkillChoice(who, level, true);
    return true;
  };

  m._showSkillChoice = function (who, level, fromLevelUp) {
    this.skillWho = who; this.skillLevel = level; this.skillOptions = skillChoiceAt(who, level); this.skillPick = null;
    this.skillFromLevelUp = fromLevelUp;
    this.enc = 'Story';
    this.story = 'SkillChoice';
    this.storyT = 0;
    this.storyFromOldMan = fromLevelUp && this.storyFromOldMan;
    this.selected = -1;
    Sound.play('LevelUp');
    this.raiseProgress();
  };

  /** The "New skills available" button: straight to the choice when one hero is waiting, otherwise to a list of the heroes to pick from. */
  m.openSkills = function () {
    if (!this.skillsAvailable) return;
    const waiting = this.skillsWaiting;
    if (waiting.length === 1) { this._showSkillChoice(waiting[0], this._pendingSkillLevel(waiting[0]), false); return; }
    this.skillPick = waiting; this.skillOptions = null; this.skillFromLevelUp = false;
    this.enc = 'Story';
    this.story = 'SkillChoice';
    this.storyT = 0;
    this.storyFromOldMan = false;
    this.selected = -1;
    Sound.play('DiscClick');
    this.raiseProgress();
  };

  /** From the list of heroes: the player picked one, and their choice comes up. */
  m.pickSkillHero = function (index) {
    if (!this.isSkillPick || index < 0 || index >= this.skillPick.length) return false;
    const who = this.skillPick[index];
    this.skillWho = who; this.skillLevel = this._pendingSkillLevel(who); this.skillOptions = skillChoiceAt(who, this.skillLevel); this.skillPick = null;
    Sound.play('DiscClick');
    return true;
  };

  /** Closes the screen without choosing (only when it came from the button): the button stays until every choice is made. */
  m.cancelSkill = function () {
    if (!this.canCancelSkill) return;
    this.skillPick = null; this.skillOptions = null;
    this.enc = 'None';
    this.story = 'None';
    this.selected = -1;
    this.raiseProgress();
  };

  /** The player picked one of the two paths: it is kept; if more heroes are waiting the list comes back, otherwise the adventure goes on. */
  m.chooseSkill = function (index) {
    if (!this.isSkillChoice || this.skillPick || !this.skillOptions || index < 0 || index >= this.skillOptions.length) return false;
    const option = this.skillOptions[index];
    const d = this._sk()[this.skillWho] || (this._sk()[this.skillWho] = {});
    d[this.skillLevel] = option.id;
    this._say('{0} chose {1}.', this._h(this.skillWho), option.name);
    const r = this._rectOf(this.skillWho);
    this._addItemText(option.name + '!', r.x + r.w / 2.0, r.y - 12, C(255, 226, 150));
    Sound.play('Huzzah');
    this.skillOptions = null;
    if (this.skillFromLevelUp) { this.skillFromLevelUp = false; this._afterLevelFx(); }   // the level-up screens carry on (the Old Man leaves, time moves on)
    else {
      this.enc = 'None';
      this.story = 'None';
      this.selected = -1;
      this.raiseProgress();
      if (this.skillsWaiting.length > 0) this.openSkills();   // someone else is waiting: back to the list (or straight to their choice)
    }
    return true;
  };

  /** A hero's Stalwart path takes a quarter off every hit (never below 1). */
  m._skillIncoming = function (kind, amount) { return this.hasSkill(kind, 'Stalwart') ? Math.max(1, Math.floor(amount * 0.75)) : amount; };

  /** A hero's Rager path adds a quarter to the damage they deal. */
  m._skillOutgoing = function (kind, amount) { return this.hasSkill(kind, 'Rager') ? Math.round(amount * 1.25) : amount; };

  // ---- Saved: "Warrior=5:Stalwart;Fae=5:X" ---------------------------------------------------------------------

  m._saveSkillFields = function () {
    return Object.keys(this._sk()).filter(k => Object.keys(this.skills[k]).length > 0)
      .map(k => enumOf(k) + '=' + Object.keys(this.skills[k]).map(lv => lv + ':' + this.skills[k][lv]).join(',')).join(';');
  };

  m._loadSkillFields = function (field) {
    this.skills = {};
    if (!field) return;
    for (const hero of field.split(';')) {
      const kv = hero.split('=');
      const kind = kv.length === 2 ? kindOfEnum(kv[0]) : undefined;
      if (!kind || !TREES[kind]) continue;
      const d = {};
      for (const pair of kv[1].split(',')) {
        const lp = pair.split(':'), level = parseInt(lp[0], 10), options = skillChoiceAt(kind, level);
        if (lp.length === 2 && options && options.some(o => o.id === lp[1])) d[level] = lp[1];
      }
      if (Object.keys(d).length > 0) this.skills[kind] = d;
    }
  };
}
