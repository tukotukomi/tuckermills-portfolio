// Page widgets: a windowed list (a music folder can hold tens of thousands of files, so only the visible rows exist), and small helpers.

export class VirtualList {
  /**
   * @param el       the scrolling container (.vlist)
   * @param render   (rowEl, item, index) fills a row element
   * @param onPick   (index) called when a row is tapped / clicked
   */
  constructor(el, render, onPick) {
    this.el = el;
    this.render = render;
    this.onPick = onPick;
    this.items = [];
    this.rowHeight = 44;
    this.playingIndex = -1;
    this.spacer = document.createElement('div');
    this.spacer.className = 'spacer';
    el.appendChild(this.spacer);
    this.rows = new Map();
    el.addEventListener('scroll', () => this._paint());
    el.addEventListener('click', e => {
      const row = e.target.closest('.row');
      if (row && row.dataset.i !== undefined) this.onPick(parseInt(row.dataset.i, 10));
    });
    new ResizeObserver(() => this._paint()).observe(el);
  }

  setItems(items, keepScroll) {
    this.items = items;
    this.spacer.style.height = items.length * this.rowHeight + 'px';
    if (!keepScroll) this.el.scrollTop = 0;
    this.rows.forEach(r => r.remove());
    this.rows.clear();
    this._paint();
  }

  refresh() {
    this.rows.forEach(r => r.remove());
    this.rows.clear();
    this._paint();
  }

  scrollTo(index) {
    const top = index * this.rowHeight, view = this.el.clientHeight;
    if (top < this.el.scrollTop || top + this.rowHeight > this.el.scrollTop + view) this.el.scrollTop = Math.max(0, top - view / 2);
  }

  _paint() {
    const h = this.el.clientHeight || 300;
    const first = Math.max(0, Math.floor(this.el.scrollTop / this.rowHeight) - 3);
    const last = Math.min(this.items.length - 1, Math.ceil((this.el.scrollTop + h) / this.rowHeight) + 3);
    this.rows.forEach((row, i) => { if (i < first || i > last) { row.remove(); this.rows.delete(i); } });
    for (let i = first; i <= last; i++) {
      let row = this.rows.get(i);
      if (!row) {
        row = document.createElement('div');
        row.className = 'row';
        row.dataset.i = String(i);
        row.style.top = i * this.rowHeight + 'px';
        this.render(row, this.items[i], i);
        this.spacer.appendChild(row);
        this.rows.set(i, row);
      }
      row.classList.toggle('playing', i === this.playingIndex);
    }
  }

  setPlaying(index) {
    this.playingIndex = index;
    this.rows.forEach((row, i) => row.classList.toggle('playing', i === index));
  }
}

export function fmtTime(s) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
