// Quality settings: Auto, Low, Medium and High, picked in the settings menu (the cog). Each level sets how often the scene is drawn,
// how sharp the canvas is on a high-density screen, and how many weather particles and light halos it carries. Auto watches how hard
// the frames are for the device and steps down when they are too heavy (and carefully back up when there is plenty of room).

export const QUALITY_MODES = ['auto', 'low', 'medium', 'high'];
export const QUALITY_LEVELS = ['low', 'medium', 'high'];

/** fps: the most frames drawn a second (0 = as often as the display asks); dprMax: the most canvas pixels per CSS pixel;
 *  fx: weather particle density; halos: the soft glows around lights. */
export const QUALITY = {
  low: { fps: 20, dprMax: 1, fx: 0.25, halos: false },
  medium: { fps: 30, dprMax: 1.5, fx: 0.6, halos: true },
  high: { fps: 0, dprMax: Infinity, fx: 1, halos: true },
};

/** Where Auto starts, before it has seen a frame: from what the device says about itself. */
export function guessLevel(isMobile) {
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (isMobile || cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

export function isLevel(x) { return QUALITY_LEVELS.indexOf(x) >= 0; }

/**
 * The Auto watcher. It is told about every drawn frame: how long since the one before, how long the frame took to run, and the gap it
 * was aiming for. Over each window of about three seconds it looks at the average work and how many frames came late. Too heavy: one
 * level down at once. Light and on time for about 25 seconds: one level up, unless the level above has already been too heavy.
 */
export class AutoQuality {
  constructor(level, onChange) {
    this.level = isLevel(level) ? level : 'high';
    this.onChange = onChange;
    this.failed = {};      // levels that were too heavy for this device
    this.good = 0;         // light windows in a row
    this.cool = 0;         // windows to sit out after a change
    this._reset();
  }

  _reset() { this.t0 = 0; this.n = 0; this.work = 0; this.late = 0; }

  /** Forget the window (the tab was hidden, a popup was up...): a stall says nothing about the device. */
  pause() { this._reset(); }

  note(now, interval, work, expected) {
    if (interval > 400) { this._reset(); return; }
    if (!this.t0) this.t0 = now;
    this.n++; this.work += work;
    if (interval > expected * 1.6) this.late++;
    if (now - this.t0 < 3000 || this.n < 30) return;
    const mean = this.work / this.n, lateFrac = this.late / this.n;
    this._reset();
    if (this.cool > 0) { this.cool--; return; }
    const i = QUALITY_LEVELS.indexOf(this.level);
    if ((mean > 11 || lateFrac > 0.2) && i > 0) {
      this.failed[this.level] = true;
      this.good = 0;
      this._set(QUALITY_LEVELS[i - 1]);
      return;
    }
    this.good = mean < 3 && lateFrac < 0.02 ? this.good + 1 : 0;
    if (this.good >= 8 && i < QUALITY_LEVELS.length - 1 && !this.failed[QUALITY_LEVELS[i + 1]]) {
      this.good = 0;
      this._set(QUALITY_LEVELS[i + 1]);
    }
  }

  _set(level) {
    this.level = level;
    this.cool = 2;
    this.onChange(level);
  }
}
