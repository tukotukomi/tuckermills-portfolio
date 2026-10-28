// The Adventure Log. A port of src\PixelLog.cs: the timeline of what happens in the party scene (hits, skills, status effects, level-ups). Each
// line is kept as an English template plus its values (not as finished text) so it can be shown in whatever language is current, even if the
// language is changed after the event: the values are translated one by one (a hero's name, a monster's, a skill's) and then put into the
// translated template.

import { t } from './i18n.js';
import { PARTY_NAMES } from './sprites.js';
import { enemyDef } from './enemies.js';

const LOG_MAX = 600;   // older lines drop off the front

export function installLog(P) {
  const m = P.prototype;

  m._logs = function () { if (!this.advLog) { this.advLog = []; this.logSeq = 0; } return this.advLog; };

  /** Changes whenever a line is added. */
  Object.defineProperty(m, 'logVersion', { get() { return this.logSeq || 0; } });

  /** The lines after `afterSeq` (all of them for 0), oldest first. */
  m.logSince = function (afterSeq) { return this._logs().filter(e => e.seq > afterSeq); };

  m.clearLog = function () { this._logs().length = 0; };

  /** English names for the values of a line: a hero, or a monster. */
  m._h = function (kind) { return PARTY_NAMES[kind] || kind; };
  m._e = function (kind) { return enemyDef(kind).name; };

  /** Writes one line: `template` is English text with {0}, {1}... for the values (heroes, monsters, numbers, skill names). */
  m._say = function (template) {
    const log = this._logs();
    const args = Array.prototype.slice.call(arguments, 1).map(String);
    log.push({ seq: ++this.logSeq, time: Date.now(), year: this.year, day: this.dayOfYear, template: template, args: args });
    if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  };
}

// What each line is, for the filter: everything not listed is an event.
export const LOG_CATEGORIES = ['attacks', 'monsters', 'skills', 'status', 'events'];
const CATEGORY_OF = {
  '{0} hit the {1} for {2} damage.': 'attacks', "{0}'s {1} hit the {2} for {3} damage.": 'attacks',
  'The {0} hit {1} for {2} damage.': 'monsters', "The {0}'s {1} hit {2} for {3} damage.": 'monsters', 'The {0} used {1}!': 'monsters',
  '{0} used {1}.': 'skills', '{0} used {1} on {2}.': 'skills', '{0} used {1} on the {2}.': 'skills', 'The party used {0}.': 'skills',
  '{0} used {1} on {2}, restoring {3} HP.': 'skills', '{0} used {1}, restoring {2} HP to {3}.': 'skills',
  '{0} was poisoned: {1} damage a second for {2} s.': 'status', '{0} was blinded by sand: the next attack will miss.': 'status',
  "{0}'s attack missed: blinded by sand.": 'status', "The {0}'s attack was stopped by Paralyze!": 'status', '{0} fainted.': 'status',
};
export function logCategory(entry) { return CATEGORY_OF[entry.template] || 'events'; }

/** A line in the current language. */
export function logFormat(entry) {
  const s = t(entry.template).replace(/\{(\d+)\}/g, (_, i) => t(entry.args[+i] === undefined ? '' : entry.args[+i]));
  return s.replace('!.', '!').replace('！。', '！');   // (a skill that ends in its own "!" does not need the sentence's full stop too)
}
