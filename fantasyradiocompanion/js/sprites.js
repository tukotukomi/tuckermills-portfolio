// The game's art: PNGs exported from the exe's own sprite code (web\tools\export-sprites.ps1), so both look identical.

import { flipImage, brightenImage } from './util.js';

export const PARTY = ['paca', 'thief', 'warrior', 'lightmage', 'firemage', 'fae'];
export const PARTY_NAMES = { paca: 'Paca', thief: 'Thief', warrior: 'Warrior', lightmage: 'Light Mage', firemage: 'Fire Mage', fae: 'Fae' };

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

export const Sprites = {
  ready: false,
  tavernDoorX: 25,

  async load(base) {
    base = base || 'assets/sprites/';
    const manifest = await (await fetch(base + 'manifest.json')).json();
    this.tavernDoorX = manifest._tavernDoorX;
    const names = Object.keys(manifest).filter(n => n[0] !== '_');
    const images = await Promise.all(names.map(n => load(base + n + '.png')));
    this.img = {};
    names.forEach((n, i) => { this.img[n] = images[i]; });

    // Party members: two walk frames, plus mirrored copies for the campfire.
    this.party = {};
    for (const k of PARTY) {
      const a = this.img['party_' + k + '_a'], b = this.img['party_' + k + '_b'];
      this.party[k] = { a: a, b: b, fa: flipImage(a), fb: flipImage(b), w: a.width, h: a.height };
    }
    this.oldMan = {
      a: this.img.oldman_a, b: this.img.oldman_b, la: this.img.oldman_left_a, lb: this.img.oldman_left_b,
      w: this.img.oldman_a.width, h: this.img.oldman_a.height
    };
    this.crystal = this.img.crystal;
    this.crystalBright = brightenImage(this.crystal, 0.55);
    this.coin = this.img.coin;
    this.tavern = this.img.tavern;
    this.tavernOpen = this.img.tavern_open;

    // Enemies already face left, towards the party.
    this.enemy = {};
    for (const k of ['sheller', 'orc', 'nightmare', 'gargogryph', 'spikedsheller', 'bassorc', 'slasher', 'wickedgryph', 'toucan']) {
      const g = n => this.img['enemy_' + k + '_' + n];
      this.enemy[k] = { walkA: g('walk_a'), walkB: g('walk_b'), attackA: g('attack_a'), attackB: g('attack_b'), hurt: g('hurt'), w: g('walk_a').width, h: g('walk_a').height };
    }
    this.merchant = [this.img.merchant_a, this.img.merchant_b];   // already facing left, towards the party
    this.items = {};
    for (const id of ['SynergyElixir', 'PotionRed', 'PotionBlue', 'PotionGreen']) this.items[id] = this.img['item_' + id.toLowerCase()];
    this.dragon = [this.img.dragon_0, this.img.dragon_1, flipImage(this.img.dragon_0), flipImage(this.img.dragon_1)];
    this.ready = true;
  }
};
