// Gold coins. A port of src\PixelCoins.cs: one turns up on the road at a random moment every 20 seconds to 3 minutes of play and hops
// along as the road scrolls past; the player has to click each one before it drifts off the left of the screen.

import { CA } from './util.js';
import { Sprites } from './sprites.js';
import { Sound } from './sfx.js';
import { luckyCoinChance, luckyCoinCount } from './traits.js';

export const MIN_COIN_SECONDS = 20, MAX_COIN_SECONDS = 180;

export function installCoins(P) {
  const m = P.prototype;

  m._initCoins = function () {
    this.coins = [];
    this.flying = [];
    this.coinTimer = 0;
    this.gold = 0;
    this.goldPulse = 0;
  };

  m._nextCoinDelay = function () { return MIN_COIN_SECONDS + Math.random() * (MAX_COIN_SECONDS - MIN_COIN_SECONDS); };

  /** Counts down to the next coin. Runs only while the party is on the move, like the day does. */
  m._advanceCoins = function (dt, frozen) {
    if (!frozen) {
      if (this.coinTimer <= 0) this.coinTimer = this._nextCoinDelay();
      this.coinTimer -= dt;
      if (this.coinTimer <= 0 && this.coins.length < 3) {
        const phase = Math.random() * 6;
        this.coins.push({ worldX: this.scroll + this.lastLw + 8, phase: phase });
        // The Thief's trait: now and then the coin comes with a twin (more, as it levels), hopping along side by side.
        if (this.party.indexOf('thief') >= 0 && Math.random() < luckyCoinChance(this.levelOf('thief'))) {
          for (let extra = 1; extra < luckyCoinCount(this.levelOf('thief')); extra++)
            this.coins.push({ worldX: this.scroll + this.lastLw + 8 + extra * 10, phase: phase });
          this.luckyFlash = 1.2;
          Sound.play('LuckyCoins');
        }
        this.coinTimer = this._nextCoinDelay();
      }
    }
    for (let i = this.coins.length - 1; i >= 0; i--)
      if (this.coins[i].worldX - this.scroll < -12) this.coins.splice(i, 1);
  };

  /** Real-time bits that also run while the music is paused: the coin in flight and the counter's pulse. */
  m._advanceCoinEffects = function (dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      this.flying[i].age += dt / 0.6;
      if (this.flying[i].age >= 1) { this.flying.splice(i, 1); this.goldPulse = 1; }
    }
    if (this.goldPulse > 0) this.goldPulse = Math.max(0, this.goldPulse - dt * 2.5);
  };

  m._coinX = function (c) { return c.worldX - this.scroll; };
  m._coinY = function (c) { return this.groundY - 6 - Math.abs(Math.sin(this.time * 4 + c.phase)) * 6; };

  m._coinIndexAt = function (px, py) {
    if (!this.marching || !this.progressing) return -1;   // like any time-progress mechanic: only while a radio stream plays (local music just camps)
    const lx = px / this.lastScale, ly = (py - this.lastTop) / this.lastScale;
    for (let i = 0; i < this.coins.length; i++)
      if (Math.abs(lx - this._coinX(this.coins[i])) <= 8 && Math.abs(ly - (this.groundY - 8)) <= 12) return i;
    return -1;
  };

  m.isCoinAt = function (px, py) { return this._coinIndexAt(px, py) >= 0; };

  /** The player clicked at (px, py) on the scene: true if that picked up a coin. */
  m.collectCoinAt = function (px, py) {
    const i = this._coinIndexAt(px, py);
    if (i < 0) return false;
    const c = this.coins[i];
    this.flying.push({ x: this._coinX(c), y: this._coinY(c), age: 0 });
    this.coins.splice(i, 1);
    Sound.play('CoinPickup');
    this.gold++;
    this.raiseProgress();
    return true;
  };

  m._resetCoins = function () {
    this.coins.length = 0; this.flying.length = 0;
    this.gold = 0; this.goldPulse = 0;
    this.coinTimer = this._nextCoinDelay();
  };

  m._drawCoins = function (g) {
    const img = Sprites.coin;
    for (const c of this.coins) {
      const x = this._coinX(c), y = this._coinY(c);
      g.ellipse(x - 4, this.groundY, 8, 2, CA(70, 20, 30, 20));
      g.ellipse(x - 8, y - 8, 16, 16, CA(54, 255, 220, 90));
      const spin = Math.abs(Math.cos(this.time * 3.2 + c.phase));
      const w = Math.max(2, Math.round(img.width * (0.25 + 0.75 * spin)));
      g.image(img, Math.round(x - w / 2), Math.round(y - img.height / 2), false, undefined, w, img.height);
      const tw = Math.sin(this.time * 5 + c.phase * 2);
      if (tw > 0.6) {
        const sx = Math.round(x + 4), sy = Math.round(y - 5), s = CA(230, 255, 255, 230);
        g.rect(sx, sy, 1, 1, s); g.rect(sx - 1, sy, 1, 1, s); g.rect(sx + 1, sy, 1, 1, s); g.rect(sx, sy - 1, 1, 1, s); g.rect(sx, sy + 1, 1, 1, s);
      }
    }
    // Coins in flight to the counter (top-left): the target is where the counter's icon sits on screen, in scene pixels.
    const tx = 20 / this.lastScale, ty = (21 - this.lastTop) / this.lastScale;
    for (const f of this.flying) {
      const u = f.age * f.age * (3 - 2 * f.age);
      const x = f.x + (tx - f.x) * u, y = f.y + (ty - f.y) * u - Math.sin(Math.PI * u) * 8;
      g.ellipse(x - 5, y - 5, 10, 10, CA(Math.trunc(120 * (1 - f.age)), 255, 226, 110));
      g.image(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
    }
  };
}
