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

/** A line in the current language. */
export function logFormat(entry) {
  const s = t(entry.template).replace(/\{(\d+)\}/g, (_, i) => t(entry.args[+i] === undefined ? '' : entry.args[+i]));
  return s.replace('!.', '!').replace('！。', '！');   // (a skill that ends in its own "!" does not need the sentence's full stop too)
}
