// Fantasy Radio Companion for the web: the page, wiring the scene, the player, the music library and the popups together.

import { PixelScene } from './scene.js';
import { Sprites, PARTY, PARTY_NAMES } from './sprites.js';
import { Visualizer, IS_MOBILE, BLURB } from './visualizer.js';
import { t, setLanguage, getLanguage, detectLanguage, applyDom, onLanguageChange } from './i18n.js';
import { logFormat, logCategory } from './advlog.js';
import { readArtist, artistFromFileName } from './tags.js';
import { readPlaylistFile, makeResolver, resolvePlaylist, missingIndexes, uniqueName, trimItem } from './playlists.js';
import { Sound } from './sfx.js';
import { Player, STATIONS, AUDIO_EXTENSIONS, parsePlaylist } from './player.js';
import { SUPPORT } from './support.js';
import { iconSvg } from './icons.js';
import { THEMES, applyTheme, themeIndexFor } from './themes.js';
import { VirtualList, fmtTime, el } from './ui.js';
import { flipImage, silhouetteImage, C } from './util.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fmc.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fmc.' + k, v); } catch (e) { /* private mode */ } },
};

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });   // (numbers in order: Track 2 before Track 10; case ignored)

async function main() {
  await Sprites.load('assets/sprites/');

  const scene = new PixelScene();
  scene.loadState(store.get('save', ''));
  scene.bestDays = parseInt(store.get('best', '0'), 10) || 0;   // the furthest travelled, kept across restarts
  scene.onBest = n => store.set('best', String(n));
  // The heroes ever used, kept across restarts (the party compendium).
  for (const k of store.get('heroes', '').split(',')) if (PARTY.indexOf(k) >= 0) scene.heroesUsed.add(k);
  scene.onHeroes = list => store.set('heroes', list.join(','));
  // The new-player tips already shown, kept across restarts (each comes up once, ever).
  for (const k of store.get('tips', '').split(',')) if (k) scene.tipsSeen.add(k);
  scene.onTips = list => store.set('tips', list.join(','));
  // The Tavern Stamps and the heroes unlocked with them belong to the player, not to an adventure: kept across restarts and new rounds.
  scene.stamps = Math.max(0, parseInt(store.get('stamps', '0'), 10) || 0);
  scene.onStamps = n => store.set('stamps', String(n));
  for (const k of store.get('unlocked', '').split(',')) if (k && PARTY.indexOf(k) >= 0) scene.unlocked.add(k);
  scene.onUnlocked = list => store.set('unlocked', list.join(','));
  scene.unlockedLoaded();   // (the pair at the fire may have been drawn before this was known)
  const player = new Player();
  const canvas = $('scene');

  // ---- Library (local folder) ---------------------------------------------------------------------------
  const library = { entries: [], sort: store.get('musicSort', ''), sortDesc: store.get('musicSortDesc', '0') === '1', view: [], viewDirty: true, playlistId: store.get('playlistId', ''), filtered: [], filteredFrom: [], folderName: '', search: '', current: -1, shuffle: store.get('shuffle', '0') === '1', repeat: parseInt(store.get('repeat', '0'), 10) || 0, cycle: new Set() };

  const isAudio = name => AUDIO_EXTENSIONS.some(x => name.toLowerCase().endsWith(x)) && !name.startsWith('._');

  async function scanHandle(dirHandle, prefix, out) {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'directory') await scanHandle(handle, prefix + name + '/', out);
      else if (isAudio(name)) out.push({ name: name, path: prefix + name, handle: handle });
    }
  }

  function setEntries(entries, folderName) {
    entries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    library.entries = entries;
    library.folderName = folderName;
    library.current = -1;
    library.cycle.clear();
    for (const e of entries) e.artist = artistFromFileName(e.name.replace(/\.[^.]+$/, ''));
    resolver = makeResolver(entries);
    library.viewDirty = true;
    applyFilter();
    startArtistScan();
    $('folderName').textContent = folderName ? t('{folder} ({n} tracks)', { folder: folderName, n: entries.length.toLocaleString() }) : '';
    $('musicEmpty').hidden = !!folderName;
    $('musicList').hidden = !folderName;
    renderTunerLocalState();
  }

  function applyFilter() {
    const words = library.search.toLowerCase().split(/\s+/).filter(Boolean);
    const playingPath = library.current >= 0 && library.filtered[library.current] ? library.filtered[library.current].path : null;
    if (library.viewDirty) buildView();
    library.filteredFrom = [];
    library.filtered = [];
    library.view.forEach((e, vi) => {
      if (words.length) { const hay = (e.path + ' ' + (e.artist || '')).toLowerCase(); if (!words.every(w => hay.indexOf(w) >= 0)) return; }
      library.filtered.push(e); library.filteredFrom.push(vi);
    });
    if (library.sort && library.filtered.length > 1) {
      // Sorted by a column: natural order of its text; empty cells always come last; ties keep their place.
      const f = library.filtered, from = library.filteredFrom, keys = f.map(e => sortKey(e, library.sort));
      const order = f.map((e, i) => i);
      order.sort((a, b) => {
        const ea = keys[a] === '', eb = keys[b] === '';
        if (ea !== eb) return ea ? 1 : -1;
        let c = COLLATOR.compare(keys[a], keys[b]);
        if (library.sortDesc) c = -c;
        return c || a - b;
      });
      library.filtered = order.map(i => f[i]);
      library.filteredFrom = order.map(i => from[i]);
    }
    library.current = playingPath ? library.filtered.findIndex(e => e.path === playingPath) : -1;
    musicList.setItems(library.filtered);
    tunerList.setItems(library.filtered);
    musicList.setPlaying(library.current);
    tunerList.setPlaying(library.current);
    $('musicCount').textContent = words.length ? t('{a} of {b} match', { a: library.filtered.length.toLocaleString(), b: library.view.length.toLocaleString() }) : '';
    const plName = currentPlaylist() ? currentPlaylist().name + ' - ' : '';
    $('tunerFoot').textContent = library.folderName ? plName + (words.length ? t('{folder} - {n} matching', { folder: library.folderName, n: library.filtered.length }) : library.folderName) : '';
    renderPlaylistBar();
  }

  async function chooseFolder() {
    Sound.unlock(); player.unlock();
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ mode: 'read' });
        $('folderName').textContent = t('Scanning...');
        const out = [];
        await scanHandle(dir, '', out);
        setEntries(out, dir.name);
        saveHandle(dir);
      } catch (e) { if (e && e.name !== 'AbortError') console.warn(e); }
    } else {
      const input = document.createElement('input');
      input.type = 'file'; input.webkitdirectory = true; input.multiple = true;
      input.onchange = () => {
        const files = Array.from(input.files).filter(f => isAudio(f.name));
        const root = files.length && files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Music';
        setEntries(files.map(f => ({ name: f.name, path: (f.webkitRelativePath || f.name).replace(/^[^/]*\//, ''), file: f })), root);
      };
      input.click();
    }
  }

  // Chrome / Edge can remember the folder; the page then asks once for permission again.
  function idb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('fmc', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function saveHandle(h) { try { const db = await idb(); db.transaction('kv', 'readwrite').objectStore('kv').put(h, 'folder'); } catch (e) { /* */ } }
  async function loadHandle() {
    try {
      const db = await idb();
      return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get('folder'); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); });
    } catch (e) { return null; }
  }
  async function reopenFolder(h) {
    Sound.unlock(); player.unlock();
    try {
      if ((await h.requestPermission({ mode: 'read' })) !== 'granted') return;
      $('folderName').textContent = t('Scanning...');
      const out = [];
      await scanHandle(h, '', out);
      setEntries(out, h.name);
      $('reopenFolder').hidden = true;
    } catch (e) { console.warn(e); }
  }

  async function fileOf(entry) { return entry.file || await entry.handle.getFile(); }

  // ---- Playing -------------------------------------------------------------------------------------------
  let radioStations = STATIONS.slice();
  function loadUserStations() {
    try { const u = JSON.parse(store.get('stations', '[]')); radioStations = STATIONS.concat(u); } catch (e) { radioStations = STATIONS.slice(); }
  }
  loadUserStations();

  async function playIndex(i) {
    if (i < 0 || i >= library.filtered.length) return;
    library.current = i;
    const entry = library.filtered[i];
    library.cycle.add(entry.path);
    player.playFile(await fileOf(entry));
    musicList.setPlaying(i); tunerList.setPlaying(i);
    showNowPlaying();
  }

  function nextIndex(step) {
    const n = library.filtered.length;
    if (n === 0) return -1;
    if (library.shuffle && step > 0) {
      let pool = [];
      for (let i = 0; i < n; i++) if (!library.cycle.has(library.filtered[i].path) && i !== library.current) pool.push(i);
      if (pool.length === 0) { library.cycle.clear(); for (let i = 0; i < n; i++) if (i !== library.current) pool.push(i); }
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : library.current;
    }
    let i = library.current + step;
    if (i < 0 || i >= n) { if (library.repeat === 1) i = (i + n) % n; else return -1; }
    return i;
  }

  player.onEnded = () => {
    if (library.repeat === 2) { playIndex(library.current); return; }
    const i = nextIndex(1);
    if (i >= 0) playIndex(i); else { player.stop(); updateTransport(); }
  };

  function playStation(i) {
    const st = radioStations[i];
    if (!st) return;
    if (st.cors === 'blocked') return;
    store.set('station', st.name);
    player.playStation(st);
    radioList.setPlaying(i); tunerStations.setPlaying(i);
    showNowPlaying();
  }

  // ---- Visualizer and scene wiring ------------------------------------------------------------------------
  let saveTimer = 0;
  scene.onProgress = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('save', scene.saveState()), 400); };
  window.addEventListener('pagehide', () => store.set('save', scene.saveState()));
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.set('save', scene.saveState()); });

  // ---- Keep device awake: a screen wake lock, held while the setting is on and the page is showing ------------------------------------------
  let wakeLock = null, wakeBusy = false, keepAwake = store.get('keepAwake', '0') === '1';
  async function applyWake() {
    if (wakeBusy) return;   // (one request at a time: a second would leave the first lock held for good)
    wakeBusy = true;
    const wanted = keepAwake;
    try {
      if (wanted && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        if (!wakeLock) { const lock = await navigator.wakeLock.request('screen'); wakeLock = lock; lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; }); }
      } else if (wakeLock) { const lock = wakeLock; wakeLock = null; await lock.release(); }
    } catch (e) { wakeLock = null; /* refused (low battery, a policy): the setting stays, and it is tried again when the page is shown or tapped */ }
    wakeBusy = false;
    if (keepAwake !== wanted) applyWake();   // the setting was changed while that was going on
  }

  const vis = new Visualizer(canvas, scene, {
    spectrum: () => player.spectrum(),
    level: () => player.level(),
    unlockAudio: () => { Sound.unlock(); player.unlock(); },
    // What the full screen now-playing pill shows: the station (gold) and its song (white italic), or just the track for local music.
    nowPlaying: () => {
      if (!player.playing) return null;
      if (player.mode === 'radio' && player.station && player.status === 'Playing') return { station: player.station.name, title: player.songTitle || '' };
      if (player.mode === 'local') {
        const e = library.filtered[library.current];
        return e ? { station: '', title: e.name.replace(/\.[^.]+$/, '') } : null;
      }
      return null;
    },    openTuner: () => openTuner(),
    openCompendium: () => openCompendium(),
    toggleFullscreen: () => toggleFullscreen(),
    restartRequested: () => restartAdventure(),
    wakeSupported: () => 'wakeLock' in navigator,   // the settings menu's "Keep device awake" row only shows where the browser can do it
    keepAwakeChanged: on => { keepAwake = on; store.set('keepAwake', on ? '1' : '0'); applyWake(); },
    qualityChanged: (mode, autoLevel) => { store.set('quality', mode); store.set('qualityAuto', autoLevel); },   // the settings menu's Quality (and the level Auto settled on)
    startOver: () => { scene.resetProgress(); store.set('save', scene.saveState()); },   // from the game-over card: no confirmation
  });
  vis.setQuality(store.get('quality', 'auto'), store.get('qualityAuto', ''));
  vis.keepAwake = keepAwake;
  applyWake();
  // The page asks for the wake lock again whenever it comes back to the front (the browser lets go of it when the page is hidden), and on the first tap
  // if the browser would not give it before the page had been touched.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyWake(); });
  document.addEventListener('pointerdown', () => { if (keepAwake && !wakeLock) applyWake(); });
  vis.start();

  // The scene reads what is playing every frame.
  setInterval(() => {
    scene.marching = player.playing || player.radioBuffering;
    scene.progressing = player.radioPlaying;
    vis.buffering = player.radioBuffering;
    vis.bufferingName = player.station ? player.station.name : '';
  }, 100);

  // ---- The Adventure Log tab ---------------------------------------------------------------------------------
  // New lines are added at the end; the box follows them only while the reader is at the bottom. A language change or a clear writes it all again.
  let logSeq = 0, logDay = '', logRewrite = true;
  let logFilter = store.get('logFilter', 'all');   // 'all', or one category
  $('logFilter').value = logFilter;
  if ($('logFilter').value !== logFilter) { logFilter = 'all'; $('logFilter').value = 'all'; }
  const pad2 = n => String(n).padStart(2, '0');
  function renderLog(show) {
    const box = $('logBox');
    if (logRewrite) { box.textContent = ''; logSeq = 0; logDay = ''; logRewrite = false; }
    else if (scene.logVersion === logSeq && !show) return;
    const stick = show || box.scrollHeight - box.scrollTop - box.clientHeight < 24;
    const entries = scene.logSince(logSeq);
    if (entries.length === 0) return;
    const frag = document.createDocumentFragment();
    for (const e of entries) {
      logSeq = e.seq;
      if (logFilter !== 'all' && logCategory(e) !== logFilter) continue;
      const day = e.year + '/' + e.day;
      if (day !== logDay) {
        logDay = day;
        frag.appendChild(el('div', 'logDay', t('\u2014 Year {0}, Day {1} \u2014').replace('{0}', e.year).replace('{1}', e.day)));
      }
      const d = new Date(e.time);
      const row = el('div', 'logRow');
      row.appendChild(el('span', 'logT', pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())));
      row.appendChild(document.createTextNode(logFormat(e)));
      frag.appendChild(row);
    }
    box.appendChild(frag);
    while (box.childElementCount > 900) box.removeChild(box.firstChild);
    if (stick) box.scrollTop = box.scrollHeight;
  }
  // The log sits in a dock under the playback controls: the button opens it from the bottom (and the scene above it makes way).
  let logOpen = store.get('logOpen', '0') === '1';
  function applyLogOpen() {
    $('logBox').hidden = !logOpen; $('logTools').hidden = !logOpen;
    $('logArrow').textContent = logOpen ? '\u25BE' : '\u25B8';
    $('logToggle').setAttribute('aria-expanded', String(logOpen));
    if (logOpen) { renderLog(true); requestAnimationFrame(() => { const box = $('logBox'); box.scrollTop = box.scrollHeight; }); }
    requestAnimationFrame(() => { if (typeof vis !== 'undefined') vis.resize(); });
  }
  $('logToggle').addEventListener('click', () => { logOpen = !logOpen; store.set('logOpen', logOpen ? '1' : '0'); applyLogOpen(); });
  setInterval(() => { if (logOpen) renderLog(false); }, 300);
  $('logFilter').addEventListener('change', () => { logFilter = $('logFilter').value; store.set('logFilter', logFilter); logRewrite = true; renderLog(true); });
  $('logClear').addEventListener('click', () => { scene.clearLog(); logRewrite = true; renderLog(true); });
  onLanguageChange(() => { logRewrite = true; if (logOpen) renderLog(true); });
  applyLogOpen();

  // ---- Tabs and layout -------------------------------------------------------------------------------------
  let tab = 'adventure';
  function setTab(name) {
    tab = name;
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === name);
    $('musicPane').hidden = name !== 'music';
    $('radioPane').hidden = name !== 'radio';
    document.body.classList.toggle('view-list', name !== 'adventure');
    vis.zoomed = name === 'adventure' || vis.fullscreen;
    requestAnimationFrame(() => vis.resize());
  }
  for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => { Sound.unlock(); player.unlock(); setTab(b.dataset.tab); });
  setTab('adventure');

  // ---- Full screen -----------------------------------------------------------------------------------------
  function toggleFullscreen() {
    const stage = $('stage');
    if (document.fullscreenElement || document.body.classList.contains('immersive')) {
      if (document.fullscreenElement) document.exitFullscreen();
      document.body.classList.remove('immersive');
      onFullscreenChange(false);
    } else if (stage.requestFullscreen) {
      stage.requestFullscreen().catch(() => { document.body.classList.add('immersive'); onFullscreenChange(true); });
    } else {
      document.body.classList.add('immersive');   // iPhone Safari has no element fullscreen: hide the chrome instead
      onFullscreenChange(true);
    }
  }
  function onFullscreenChange(on) {
    vis.fullscreen = on;
    vis.zoomed = tab === 'adventure' || on;
    requestAnimationFrame(() => vis.resize());
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('immersive'); onFullscreenChange(!!document.fullscreenElement); });
  window.addEventListener('keydown', e => {
    const typing = /input|textarea/i.test((e.target.tagName || ''));
    if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
    else if (vis.devKey(e.key)) e.preventDefault();   // the Developer Updates journal is open: the keys scroll it
    else if (e.key === 'Escape' && vis.dismissOverlay()) { /* closed the item disc or the shop */ }
    else if (e.key === 'Escape') { if (!$('tuner').hidden) closePopups(); else if (!$('compendium').hidden) closePopups(); else if (document.body.classList.contains('immersive')) toggleFullscreen(); }
    else if (e.key === ' ' && !typing && vis.fullscreen) { e.preventDefault(); player.togglePause(); updateTransport(); }
  });

  // ---- Playlists (local music) ---------------------------------------------------------------------------------
  // A playlist is what some playlist file (or the player) listed; which local file each item means is worked out against the picked folder
  // whenever the view is built (see playlists.js), so a playlist survives the folder moving and items not in the folder just wait.
  let playlists = [];
  try { playlists = JSON.parse(store.get('playlists', '[]')); if (!Array.isArray(playlists)) playlists = []; } catch (e) { playlists = []; }
  let resolver = makeResolver([]);
  let plView = { at: [], missing: 0 };
  const savePlaylists = () => store.set('playlists', JSON.stringify(playlists));
  const currentPlaylist = () => playlists.find(p => p.id === library.playlistId) || null;
  let plNoteText = '';
  function buildView() {
    library.viewDirty = false;
    const pl = currentPlaylist();
    if (!pl) { library.view = library.entries; plView = { at: [], missing: 0 }; return; }
    const r = resolvePlaylist(pl, resolver);
    library.view = r.found; plView = { at: r.at, missing: r.missing };
  }
  function renderPlaylistBar() {
    for (const id of ['plSel', 'tunerPlSel']) {
      const sel = $(id);
      sel.textContent = '';
      sel.appendChild(Object.assign(el('option', null, t('All music')), { value: '' }));
      for (const p of playlists) sel.appendChild(Object.assign(el('option', null, p.name), { value: p.id }));
      sel.value = library.playlistId;
    }
    const pl = currentPlaylist();
    $('plRename').disabled = $('plDelete').disabled = !pl;
    $('plMissingBtn').disabled = !pl || plView.missing === 0;   // (something to show only when part of the playlist is not in the folder)
    $('tunerPlBar').hidden = playlists.length === 0;
    $('plNote').textContent = (plNoteText ? plNoteText + '  ' : '') + (pl ? (library.folderName ? t('{n} tracks, {m} not in this folder', { n: library.view.length.toLocaleString(), m: plView.missing.toLocaleString() }) : t('Choose the music folder to play this playlist.')) : '');
  }
  function setPlaylistView(id) {
    library.playlistId = id; store.set('playlistId', id);
    plNoteText = '';
    library.viewDirty = true; library.current = -1;
    applyFilter();
  }
  function changedPlaylists() { savePlaylists(); library.viewDirty = true; applyFilter(); }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function makePlaylist(name, items) {
    const p = { id: newId(), name: uniqueName(playlists.map(x => x.name), name), items: items || [] };
    playlists.push(p);
    return p;
  }

  /** Reads a playlist file's bytes as text (iTunes writes its text exports as UTF-16). */
  function decodeText(buf) {
    const b = new Uint8Array(buf);
    if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);
    if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
    return new TextDecoder('utf-8').decode(buf);
  }

  /** Asks which of the playlists in a file to bring in (the library itself and iTunes' built-in lists start unticked). Resolves to the chosen ones. */
  function pickPlaylists(found) {
    return new Promise(resolve => {
      const dlg = $('plPick'), list = $('plPickList');
      list.textContent = '';
      const boxes = found.map(p => {
        const label = el('label'), box = el('input');
        box.type = 'checkbox'; box.checked = p.kind === 'user' && p.items.length > 0;
        label.append(box, el('span', null, p.name), el('span', 'muted', t('{n} tracks', { n: p.items.length.toLocaleString() })));
        list.appendChild(label);
        return box;
      });
      $('plPickAll').onclick = () => boxes.forEach(b => { b.checked = true; });
      $('plPickNone').onclick = () => boxes.forEach(b => { b.checked = false; });
      dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? found.filter((p, i) => boxes[i].checked) : []);
      dlg.returnValue = '';
      dlg.showModal();
    });
  }

  async function importPlaylistFiles(files) {
    const found = [];
    for (const f of files) {
      try { for (const p of readPlaylistFile(decodeText(await f.arrayBuffer()), f.name)) found.push(p); } catch (e) { console.warn(e); }
    }
    if (found.length === 0) { plNoteText = t('No playlists found in that file.'); renderPlaylistBar(); return; }
    const chosen = found.length === 1 ? found : await pickPlaylists(found);
    if (chosen.length === 0) return;
    let tracks = 0, last = null;
    for (const p of chosen) { last = makePlaylist(p.name, p.items.map(trimItem)); tracks += p.items.length; }
    plNoteText = t('Imported {n} playlist(s), {tracks} tracks.', { n: chosen.length, tracks: tracks.toLocaleString() });
    library.playlistId = last.id; store.set('playlistId', last.id);
    changedPlaylists();
  }

  // The "..." menu on a track: add it to a playlist, or (inside a playlist) take it out or move it.
  function openPlMenu(anchor, entry, viewIndex) {
    const menu = $('plMenu');
    menu.textContent = '';
    const add = (label, fn, disabled) => { const b = el('button', null, label); b.disabled = !!disabled; b.addEventListener('click', () => { closePlMenu(); fn(); }); menu.appendChild(b); };
    menu.appendChild(el('div', 'hdr', t('Add to playlist')));
    for (const p of playlists) add(p.name, () => addToPlaylist(p, entry));
    add(t('New playlist...'), () => { const name = (prompt(t('Name for the new playlist:'), '') || '').trim(); if (name) addToPlaylist(makePlaylist(name), entry); });
    const pl = currentPlaylist();
    if (pl) {
      const at = plView.at[viewIndex];
      const searching = library.search.trim().length > 0 || !!library.sort;   // (moving a track in a search, or in a sorted list, would not move it where it looks)
      menu.appendChild(el('div', 'sep'));
      add(t('Remove from this playlist'), () => { pl.items.splice(at, 1); changedPlaylists(); });
      add(t('Move up'), () => movePlaylistItem(pl, viewIndex, -1), searching || viewIndex <= 0);
      add(t('Move down'), () => movePlaylistItem(pl, viewIndex, 1), searching || viewIndex >= library.view.length - 1);
    }
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(window.innerWidth - menu.offsetWidth - 8, r.right - menu.offsetWidth)) + 'px';
    menu.style.top = Math.max(8, Math.min(window.innerHeight - menu.offsetHeight - 8, r.bottom + 4)) + 'px';
  }
  function closePlMenu() { $('plMenu').hidden = true; }
  document.addEventListener('click', e => { if (!$('plMenu').hidden && !e.target.closest('#plMenu')) closePlMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('plMenu').hidden) closePlMenu(); });
  window.addEventListener('resize', closePlMenu);
  $('musicList').addEventListener('scroll', closePlMenu);
  $('tunerList').addEventListener('scroll', closePlMenu);

  function addToPlaylist(pl, entry) {
    const item = trimItem({ path: entry.path });
    if (pl.items.some(i => resolver.resolve(i) === entry)) plNoteText = t('"{name}" is already in {pl}.', { name: entry.name.replace(/\.[^.]+$/, ''), pl: pl.name });
    else { pl.items.push(item); plNoteText = t('Added to {pl}.', { pl: pl.name }); }
    changedPlaylists();
  }
  function movePlaylistItem(pl, viewIndex, step) {
    const a = plView.at[viewIndex], b = plView.at[viewIndex + step];
    if (a === undefined || b === undefined) return;
    const x = pl.items[a]; pl.items[a] = pl.items[b]; pl.items[b] = x;
    changedPlaylists();
  }

  /** The tracks of the playlist showing that are not in the music folder: what the playlist says about them, so they can be looked for. */
  function showMissing() {
    const pl = currentPlaylist(); if (!pl) return;
    const idx = missingIndexes(pl, resolver);
    if (idx.length === 0) return;
    const list = $('plMissingList');
    list.textContent = '';
    const lines = [];
    for (const i of idx) {
      const it = pl.items[i];
      const title = it.title || it.path.split('/').pop().replace(/\.[^.]+$/, '');
      const name = (it.artist ? it.artist + ' - ' : '') + title;
      const row = el('div');
      row.append(el('div', 'mt', name), el('div', 'mp', it.path));
      list.appendChild(row);
      lines.push(name + '\t' + it.path);
    }
    $('plMissingNote').textContent = t('{n} track(s) in "{name}" were not found in the music folder.', { n: idx.length.toLocaleString(), name: pl.name });
    $('plMissingCopy').onclick = async () => { try { await navigator.clipboard.writeText(lines.join('\n')); $('plMissingNote').textContent = t('Copied.'); } catch (e) { console.warn(e); } };
    $('plMissingRemove').onclick = () => {
      if (!confirm(t('Remove the {n} missing track(s) from "{name}"?', { n: idx.length.toLocaleString(), name: pl.name }))) return;
      const drop = new Set(idx);
      pl.items = pl.items.filter((x, i) => !drop.has(i));
      plNoteText = '';
      $('plMissing').close();
      changedPlaylists();
    };
    $('plMissing').showModal();
  }
  $('plMissingBtn').addEventListener('click', showMissing);

  for (const id of ['plSel', 'tunerPlSel']) $(id).addEventListener('change', e => setPlaylistView(e.target.value));
  $('plImport').addEventListener('click', () => $('plFile').click());
  $('plFile').addEventListener('change', () => { const files = Array.from($('plFile').files); $('plFile').value = ''; if (files.length) importPlaylistFiles(files); });
  $('plNew').addEventListener('click', () => {
    const name = (prompt(t('Name for the new playlist:'), '') || '').trim();
    if (!name) return;
    const p = makePlaylist(name);
    plNoteText = ''; library.playlistId = p.id; store.set('playlistId', p.id);
    changedPlaylists();
  });
  $('plRename').addEventListener('click', () => {
    const pl = currentPlaylist(); if (!pl) return;
    const name = (prompt(t('New name for the playlist:'), pl.name) || '').trim();
    if (!name || name === pl.name) return;
    pl.name = uniqueName(playlists.filter(p => p !== pl).map(p => p.name), name);
    plNoteText = '';
    changedPlaylists();
  });
  $('plDelete').addEventListener('click', () => {
    const pl = currentPlaylist(); if (!pl) return;
    if (!confirm(t('Delete the playlist "{name}"?', { name: pl.name }))) return;
    playlists = playlists.filter(p => p !== pl);
    plNoteText = ''; library.playlistId = ''; store.set('playlistId', '');
    changedPlaylists();
  });

  // ---- Sorting the music list, and the artists read from the files' tags ----------------------------------------------
  function sortKey(e, by) {
    return by === 'name' ? e.name.replace(/\.[^.]+$/, '') : by === 'artist' ? (e.artist || '') : by === 'format' ? ((/\.([^.]+)$/.exec(e.name) || [])[1] || '').toLowerCase() : e.path;
  }
  function renderSortControls() {
    $('sortSel').value = library.sort;
    $('sortDir').textContent = library.sortDesc ? '\u25BC' : '\u25B2';
    $('sortDir').title = t(library.sortDesc ? 'Descending' : 'Ascending');
    $('sortDir').disabled = !library.sort;
  }
  $('sortSel').addEventListener('change', () => { library.sort = $('sortSel').value; store.set('musicSort', library.sort); renderSortControls(); applyFilter(); });
  $('sortDir').addEventListener('click', () => { library.sortDesc = !library.sortDesc; store.set('musicSortDesc', library.sortDesc ? '1' : '0'); renderSortControls(); applyFilter(); });
  renderSortControls();

  let artistSerial = 0;
  /** Reads the artist tag of every .mp3 / .aac / .m4a in the folder, in the background, and fills the artists in as they arrive; a sort by artist is redone at the end. */
  async function startArtistScan() {
    const serial = ++artistSerial;
    const todo = library.entries.filter(e => /\.(mp3|m4a|aac)$/i.test(e.name));
    if (todo.length === 0) return;
    let next = 0, sinceRefresh = 0;
    const refresh = final => {
      if (serial !== artistSerial) return;
      if (final && library.sort === 'artist') applyFilter(); else { musicList.refresh(); tunerList.refresh(); }
    };
    const worker = async () => {
      while (next < todo.length && serial === artistSerial) {
        const e = todo[next++];
        try { const a = await readArtist(await fileOf(e), e.name); if (a) e.artist = a; } catch (err) { /* skip it */ }
        if (++sinceRefresh >= 200) { sinceRefresh = 0; refresh(false); }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    refresh(true);
  }

  // ---- Lists -----------------------------------------------------------------------------------------------
  const renderTrack = (row, e, i) => {
    row.classList.add('hasMore');
    const ext = (/\.([^.]+)$/.exec(e.name) || [])[1] || '';
    row.append(el('div', 't', e.name.replace(/\.[^.]+$/, '')), el('div', 's', [e.artist, ext.toUpperCase(), e.path].filter(Boolean).join('  \u00B7  ')));
    const more = el('button', 'more', '\u22EF');
    more.title = t('Playlists'); more.setAttribute('aria-label', t('Playlists'));
    more.addEventListener('click', ev => { ev.stopPropagation(); openPlMenu(more, e, library.filteredFrom[i]); });
    row.append(more);
  };
  const renderStation = (row, s) => {
    row.append(el('div', 't', s.name), el('div', 's', s.cors === 'blocked' ? t(s.note) : s.source ? t('From playlist: {s}', { s: s.source }) : s.cors === true ? t('Plays and drives the scene') : s.cors === false ? t('Plays (no audio reactions)') : t('Plays; reactions if the station allows')));
    if (s.cors === 'blocked') row.classList.add('disabled');
    // A pill on the far right opens the station's own page, when STATIONS.md gives it one.
    const url = SUPPORT[s.name];
    if (url) {
      row.classList.add('hasSupport');
      // A real link that opens in a new tab / window, so the game keeps running behind it (an installed iPhone app would otherwise be
      // navigated away, which is what window.open does in some browsers). The click must not also tune the row in.
      const b = el('a', 'support', t('SUPPORT'));
      b.href = url;
      b.target = '_blank';
      b.rel = 'noopener noreferrer';
      b.title = url;
      b.addEventListener('click', ev => ev.stopPropagation());
      row.append(b);
    }
  };
  const musicList = new VirtualList($('musicList'), renderTrack, i => playIndex(i));
  const radioList = new VirtualList($('radioList'), renderStation, i => playStation(i));
  const tunerList = new VirtualList($('tunerList'), renderTrack, i => { playIndex(i); closePopups(); });
  const tunerStations = new VirtualList($('tunerStations'), renderStation, i => { playStation(i); closePopups(); });
  function refreshStationLists() { radioList.setItems(radioStations, true); tunerStations.setItems(radioStations, true); }
  refreshStationLists();

  $('pickFolder').addEventListener('click', chooseFolder);
  $('tunerFolder').addEventListener('click', chooseFolder);
  for (const id of ['musicSearch', 'tunerSearch']) {
    $(id).addEventListener('input', e => {
      library.search = e.target.value;
      $('musicSearch').value = e.target.value; $('tunerSearch').value = e.target.value;   // one search, shared by both views
      applyFilter();
    });
  }
  /** Keeps stations (from a file or a link) in this browser and shows them in the lists. */
  function addUserStations(found) {
    let user = [];
    try { user = JSON.parse(store.get('stations', '[]')); } catch (x) { /* */ }
    for (const s of found) if (!user.some(u => u.url === s.url)) user.push(s);
    store.set('stations', JSON.stringify(user));
    loadUserStations(); refreshStationLists();
  }

  $('addPlaylist').addEventListener('click', () => $('playlistFile').click());
  $('playlistFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    addUserStations(parsePlaylist(await f.text(), f.name));
    e.target.value = '';
  });

  // Add by link: a .pls / .m3u / .m3u8 address is read and its stations kept; anything else is taken to be the stream itself.
  // (A site that doesn't allow other pages to read its playlist can't be fetched; its stream address can still be pasted.)
  $('addLink').addEventListener('click', () => {
    const row = $('linkRow');
    row.hidden = !row.hidden;
    if (!row.hidden) $('linkUrl').focus();
  });
  async function stationsFromLink(raw) {
    let url;
    raw = raw.trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;   // a pasted address without its https:// still works
    try { url = new URL(raw); } catch (x) { throw new Error('address'); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('address');
    if (/\.(pls|m3u8?)$/i.test(url.pathname)) {
      if (location.protocol === 'https:') url.protocol = 'https:';   // a secure page can't read a plain http address
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
      let text;
      try {
        const r = await fetch(url.href, { signal: ctl.signal });
        if (!r.ok) throw new Error('unreadable');
        text = await r.text();
      } catch (x) { throw new Error('unreadable'); } finally { clearTimeout(timer); }
      const found = parsePlaylist(text, url.hostname);
      if (found.length === 0) throw new Error('empty');
      return found;
    }
    return [{ name: url.hostname, url: url.href.replace(/^http:/i, 'https:'), cors: 'unknown', source: url.hostname }];
  }
  $('linkRow').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('linkMsg'), input = $('linkUrl'), raw = input.value.trim();
    if (!raw) return;
    msg.textContent = t('Reading the link…');
    $('linkAdd').disabled = true;
    try {
      const found = await stationsFromLink(raw);
      addUserStations(found);
      msg.textContent = t('Added {n} station(s): {name}', { n: found.length, name: found[0].name });
      input.value = '';
    } catch (err) {
      msg.textContent = err.message === 'address' ? t("That doesn't look like a web address.")
        : err.message === 'empty' ? t('No stations found in that playlist.')
        : t("Couldn't read that playlist (the site may be offline or may not allow it). Download the file and use Add playlist…, or paste the station's stream address.");
    } finally { $('linkAdd').disabled = false; }
  });

  function renderTunerLocalState() {
    const has = !!library.folderName;
    $('tunerNoFolder').hidden = has;
    $('tunerList').hidden = !has;
    $('tunerSearch').hidden = !has;
    $('tunerFolder').textContent = has ? t('Change folder...') : t('Select music folder...');
  }
  renderTunerLocalState();
  $('musicList').hidden = true;

  // ---- Transport -----------------------------------------------------------------------------------------------
  /** A radio status code ('Connecting...', 'Playing', 'Error: ...') in the current language. */
  function statusText(s) {
    if (typeof s === 'string' && s.startsWith('Error: ')) return t('Error: {msg}', { msg: t(s.slice(7)) });
    return t(s || '');
  }

  function showNowPlaying() {
    if (player.mode === 'local') {
      const e = library.filtered[library.current];
      $('nowTitle').textContent = e ? e.name.replace(/\.[^.]+$/, '') : t('Playing');
      $('nowSub').textContent = e ? e.path : '';
    } else if (player.mode === 'radio') {
      $('nowTitle').textContent = player.station.name;
      $('nowSub').textContent = player.songTitle || (statusText(player.status) + (player.canAnalyse ? '' : t(' - no audio reactions')));
    } else { $('nowTitle').textContent = t('Nothing playing'); $('nowSub').textContent = ''; }
  }

  // The playback controls are SVG icons (see icons.js): glyph characters sat off-centre in their buttons and differed per platform.
  function setIcon(id, name) {
    const b = $(id);
    if (b.dataset.icon !== name) { b.innerHTML = iconSvg(name); b.dataset.icon = name; }
  }
  setIcon('btnShuffle', 'shuffle'); setIcon('btnPrev', 'prev'); setIcon('btnNext', 'next');

  function updateTransport() {
    showNowPlaying();
    setIcon('btnPlay', player.playing ? 'pause' : 'play');
    $('btnShuffle').classList.toggle('active', library.shuffle);
    $('btnRepeat').classList.toggle('active', library.repeat > 0);
    setIcon('btnRepeat', library.repeat === 2 ? 'repeatOne' : 'repeat');
    $('seek').disabled = player.mode !== 'local';
  }
  player.onStatus = updateTransport;
  updateTransport();

  $('btnPlay').addEventListener('click', () => {
    Sound.unlock(); player.unlock();
    if (player.mode === 'none') {
      if (tab === 'radio') { const name = store.get('station', ''); const i = Math.max(0, radioStations.findIndex(s => s.name === name && s.cors !== 'blocked')); playStation(i); }
      else if (library.filtered.length) playIndex(Math.max(0, library.current));
      else openTuner();
    } else player.togglePause();
    updateTransport();
  });
  $('btnNext').addEventListener('click', () => { Sound.unlock(); if (player.mode === 'radio') { stepStation(1); } else { const i = nextIndex(1); if (i >= 0) playIndex(i); } });
  $('btnPrev').addEventListener('click', () => { Sound.unlock(); if (player.mode === 'radio') { stepStation(-1); } else { const i = nextIndex(-1); if (i >= 0) playIndex(i); } });
  function stepStation(step) {
    const n = radioStations.length;
    let i = radioStations.findIndex(s => s === player.station);
    for (let k = 0; k < n; k++) { i = ((i + step) % n + n) % n; if (radioStations[i].cors !== 'blocked') break; }
    playStation(i);
  }
  $('btnShuffle').addEventListener('click', () => { library.shuffle = !library.shuffle; library.cycle.clear(); store.set('shuffle', library.shuffle ? '1' : '0'); updateTransport(); });
  $('btnRepeat').addEventListener('click', () => { library.repeat = (library.repeat + 1) % 3; store.set('repeat', String(library.repeat)); updateTransport(); });

  let seeking = false;
  $('seek').addEventListener('input', () => { seeking = true; });
  $('seek').addEventListener('change', () => { player.seek(parseFloat($('seek').value) / 1000 * player.duration); seeking = false; });
  setInterval(() => {
    if (player.mode === 'local') {
      const d = player.duration;
      $('timeNow').textContent = fmtTime(player.currentTime);
      $('timeLen').textContent = fmtTime(d);
      if (!seeking && d > 0) $('seek').value = String(Math.round(player.currentTime / d * 1000));
    } else {
      $('timeNow').textContent = '--:--'; $('timeLen').textContent = '--:--'; $('seek').value = '0';
    }
    if (player.mode === 'radio') showNowPlaying();
  }, 500);

  // Volumes: two independent faders. Music (the local player and radio) and Effects (the game's sounds); either can be zero
  // while the other plays.
  const mainVol = parseInt(store.get('vol', '100'), 10), fxVol = parseInt(store.get('fx', '70'), 10);
  $('volMain').value = mainVol; $('volFx').value = fxVol;
  const applyVolumes = () => {
    player.volume = parseInt($('volMain').value, 10) / 100;
    Sound.output = null;
    Sound.volume = parseInt($('volFx').value, 10);
    store.set('vol', $('volMain').value); store.set('fx', $('volFx').value);
  };
  $('volMain').addEventListener('input', applyVolumes);
  $('volFx').addEventListener('input', () => { applyVolumes(); Sound.unlock(); Sound.play('CoinPickup'); });
  applyVolumes();

  // ---- Popups ------------------------------------------------------------------------------------------------------
  function showPopup(id) {
    $('dim').hidden = false; $(id).hidden = false;
    vis.popupOpen = true;
  }
  function closePopups() {
    $('dim').hidden = true; $('tuner').hidden = true; $('compendium').hidden = true;
    vis.popupOpen = false;
  }
  $('dim').addEventListener('click', closePopups);
  $('tunerClose').addEventListener('click', closePopups);
  $('compClose').addEventListener('click', closePopups);

  function openTuner() {
    Sound.unlock(); player.unlock();
    closePopups();
    setTunerTab(player.mode === 'local' ? 'local' : 'radio');   // the tab for whatever is playing; Radio Stations (the first tab) otherwise
    renderTunerLocalState();
    showPopup('tuner');
    tunerList.refresh(); tunerStations.refresh();
  }
  function setTunerTab(t) {
    for (const b of document.querySelectorAll('[data-ttab]')) b.classList.toggle('on', b.dataset.ttab === t);
    $('tunerLocal').hidden = t !== 'local';
    $('tunerRadio').hidden = t !== 'radio';
  }
  for (const b of document.querySelectorAll('[data-ttab]')) b.addEventListener('click', () => { setTunerTab(b.dataset.ttab); tunerList.refresh(); tunerStations.refresh(); });

  const portraits = {};
  function portrait(kind, seen) {
    const key = kind + (seen ? '' : '#');
    if (portraits[key]) return portraits[key];
    const src = flipImage(Sprites.enemy[kind].walkA);   // the stored frames face left; cards look better facing right
    portraits[key] = seen ? src : silhouetteImage(src, C(12, 10, 30));
    return portraits[key];
  }
  // Which tab is up and whether the eye is on (everything shown, met or not): kept while the page is open.
  let compTab = 0, compReveal = false;
  function heroPortrait(kind, seen) {
    const key = 'hero:' + kind + (seen ? '' : '#');
    if (portraits[key]) return portraits[key];
    const src = Sprites.party[kind].a;   // the party faces right already
    portraits[key] = seen ? src : silhouetteImage(src, C(12, 10, 30));
    return portraits[key];
  }
  /** An item's or scroll's icon, or as a solid dark silhouette if it has not been found. */
  function itemPortrait(b, seen) {
    const key = b.icon + ':' + b.id + (seen ? '' : '#');
    if (portraits[key]) return portraits[key];
    const src = (b.icon === 'scroll' ? Sprites.scroll : Sprites.items)[b.id];
    portraits[key] = seen ? src : silhouetteImage(src, C(12, 10, 30));
    return portraits[key];
  }
  /** The card's portrait window: a bit of sky over a strip of grass, with the picture standing on it. */
  function cardCanvas(img, seen) {
    const cv = document.createElement('canvas');
    cv.width = 38; cv.height = 38;
    const cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = seen ? '#5c84d6' : '#28284a'; cx.fillRect(0, 0, 38, 38);
    cx.fillStyle = seen ? '#4ca050' : '#1e1e38'; cx.fillRect(0, 30, 38, 8);
    const f = Math.max(1, Math.min(Math.floor(34 / img.width), Math.floor(30 / img.height)));
    cx.drawImage(img, Math.round((38 - img.width * f) / 2), 34 - img.height * f, img.width * f, img.height * f);
    return cv;
  }
  const secs = n => String(Math.round(n * 10) / 10);
  function openCompendium() {
    Sound.unlock();
    closePopups();
    renderCompendium();
    showPopup('compendium');
  }
  function renderCompendium() {
    const cards = $('compCards');
    cards.textContent = '';
    for (const b of document.querySelectorAll('[data-ctab]')) b.classList.toggle('on', Number(b.dataset.ctab) === compTab);
    $('compEye').setAttribute('aria-pressed', compReveal ? 'true' : 'false');
    if (compTab === 0) {
      const book = scene.bestiary();
      let known = 0, kills = 0;
      for (const b of book) {
        if (b.seen) known++;
        kills += b.kills;
        const seen = b.seen || compReveal;
        const card = el('div', 'card' + (seen ? '' : ' unknown'));
        const mid = el('div');
        if (seen) {
          mid.append(el('div', 'nm', t(b.name).toUpperCase()));
          const st = el('div', 'st');
          st.innerHTML = '<b>' + t('HP {n}', { n: b.maxHp }) + '</b> &nbsp; <span class="hit">' + t('HIT {n}', { n: b.hit }) + '</span> &nbsp; <span class="iv">'
            + t('EVERY {n} s', { n: secs(b.interval) }) + '</span>' + (b.bloodMoon > 0 ? ' &nbsp; <span class="bm">' + t('BLOOD MOON {n}', { n: b.bloodMoon }) + '</span>' : '');
          const hab = el('div', 'st', t(b.habitat));
          const nt = el('div', 'nt'); nt.append(el('span', 'lbl', t('NOTES')), t(b.note));
          mid.append(st, hab, nt);
        } else { mid.append(el('div', 'nm', '???'), el('div', 'nt', t('Not yet encountered.'))); }
        const right = el('div', 'kills');
        if (seen) { right.append(el('div', 'n', 'x ' + b.kills), el('div', 'l', t('DEFEATED'))); }
        card.append(cardCanvas(portrait(b.kind, seen), seen), mid, right);
        cards.append(card);
      }
      $('compFoot').textContent = t('DISCOVERED {a}/{b}   DEFEATED {n}', { a: known, b: book.length, n: kills });
    } else if (compTab === 2) {
      const book = scene.itemBook();
      let found = 0;
      for (const b of book) {
        if (b.seen) found++;
        const seen = b.seen || compReveal;
        const card = el('div', 'card' + (seen ? '' : ' unknown'));
        const mid = el('div');
        if (seen) {
          mid.append(el('div', 'nm', t(b.name).toUpperCase()));
          const st = el('div', 'st');
          st.innerHTML = '<b>' + t(b.kind) + '</b>' + (b.detail ? ' &nbsp; <span class="iv">' + t(b.detail) + '</span>' : '');
          const nt = el('div', 'nt'); nt.append(el('span', 'lbl', t('NOTES')), t(b.blurb));
          mid.append(st, nt);
        } else { mid.append(el('div', 'nm', '???'), el('div', 'nt', t('Not yet found.'))); }
        const right = el('div', 'kills');
        if (seen && b.count >= 0) right.append(el('div', 'n', 'x ' + b.count), el('div', 'l', t('OWNED')));
        card.append(cardCanvas(itemPortrait(b, seen), seen), mid, right);
        cards.append(card);
      }
      $('compFoot').textContent = t('ITEMS FOUND {a}/{b}', { a: found, b: book.length });
    } else {
      const book = scene.partyBook();
      let used = 0;
      for (const b of book) {
        if (b.seen) used++;
        const seen = b.seen || compReveal;
        const card = el('div', 'card' + (seen ? '' : ' unknown'));
        const mid = el('div');
        if (seen) {
          mid.append(el('div', 'nm', t(PARTY_NAMES[b.kind]).toUpperCase()));
          const st = el('div', 'st'); st.innerHTML = '<b>' + t('HP {n}', { n: b.maxHp }) + '</b> &nbsp; <span class="iv">' + b.hpGrowth + '</span>';
          const atk = el('div', 'row atk'); atk.append(el('span', 'lbl', t('ATTACK')), b.attack);
          const skl = el('div', 'row skl'); skl.append(el('span', 'lbl', t('SKILL')), b.skill);
          const nt = el('div', 'row'); nt.append(el('span', 'lbl', t('NOTES')), t(BLURB[b.kind]));
          mid.append(st, atk, skl, nt);
        } else { mid.append(el('div', 'nm', '???'), el('div', 'nt', t('Not yet recruited.'))); }
        card.append(cardCanvas(heroPortrait(b.kind, seen), seen), mid, el('div', 'kills'));
        cards.append(card);
      }
      $('compFoot').textContent = t('HEROES USED {a}/{b}', { a: used, b: book.length });
    }
  }
  for (const b of document.querySelectorAll('[data-ctab]')) b.addEventListener('click', () => { compTab = Number(b.dataset.ctab); renderCompendium(); $('compCards').scrollTop = 0; });
  $('compEye').addEventListener('click', () => { compReveal = !compReveal; renderCompendium(); });

  // ---- Menu --------------------------------------------------------------------------------------------------------
  $('menuBtn').addEventListener('click', e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; });
  document.addEventListener('click', () => { $('menu').hidden = true; });
  $('menu').addEventListener('click', e => {
    const lang = e.target.dataset && e.target.dataset.lang;
    if (lang) { $('menu').hidden = true; setLanguage(lang); return; }
    const act = e.target.dataset.act;
    if (!act) return;
    $('menu').hidden = true;
    if (act === 'export') {
      const s = scene.saveState();
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(() => alert(t("Progress copied. Paste it into Import on another device, or into the Windows app's saved settings.")), () => prompt(t('Copy your progress:'), s));
      else prompt(t('Copy your progress:'), s);
    } else if (act === 'import') {
      const s = prompt(t('Paste a progress string:'));
      if (s) { scene.loadState(s.trim()); store.set('save', scene.saveState()); }
    } else if (act === 'restart') restartAdventure();
    else if (act === 'about') { updateSoundState(); $('about').showModal(); }
  });

  // Sound effects: any gesture on the page wakes the engine (some browsers only honour a resume() made during one), and the
  // About box can say what state it is in and play a test sound, to tell "blocked by the browser" from "muted".
  for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend'])
    window.addEventListener(ev, () => { if (Sound.state !== 'running') Sound.unlock(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.unlock(); });

  // The game waits while the tab is minimized or hidden (the browser stops drawing frames; a phone is also stopped in visualizer.js).
  // Say so when the player comes back, if the adventure was progressing and they were away long enough to have noticed nothing happening.
  let tipTimer = 0;
  function showTip(text) {
    const tip = $('tip');
    tip.textContent = text;
    tip.classList.add('show');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => tip.classList.remove('show'), 4500);
  }
  let hiddenAt = 0, wasProgressing = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); wasProgressing = !!scene.progressing; return; }
    if (hiddenAt && wasProgressing && Date.now() - hiddenAt > 1500) showTip(t('Progress was paused while tab was minimized or hidden. Please play Fantasy Radio Companion in the foreground.'));
    hiddenAt = 0;
  });
  // Where the music volume reaches: normally the slider just works. On iPhone and iPad Safari a live stream can play outside Web Audio,
  // where only muting is possible; say so instead of leaving a slider that seems broken.
  function updateVolumePath() {
    const p = player.volumePath;
    $('pathState').textContent = (p === 'graph' || p === 'element') ? t('the slider sets the level')
      : p === 'mute' ? t('this station plays outside the page: the slider only mutes it, the device volume buttons set the level')
      : t('this stream plays outside the page: the slider only mutes it, the device volume buttons set the level');
  }
  let routingTipShown = false;
  player.onRouting = () => {
    if (routingTipShown || player.volumePath !== 'device' || parseInt($('volMain').value, 10) <= 0) return;
    routingTipShown = true;
    showTip(t('This stream plays outside the page, so the Music slider can only mute it. Use the device volume buttons.'));
  };
  function updateSoundState() {
    updateVolumePath();
    const s = Sound.state;
    $('soundState').textContent = s === 'running' ? t('on (volume {n}%)', { n: Math.round(Sound.volume) })
      : s === 'none' ? t('not supported by this browser')
      : t('waiting for a click or key press ({s})', { s: s });
  }
  $('soundTest').addEventListener('click', () => {
    Sound.unlock();
    setTimeout(() => { Sound.play('CoinPickup'); updateSoundState(); }, 150);
    setTimeout(updateSoundState, 600);
  });

  function restartAdventure() {
    const word = t('RESTART');
    const typed = prompt(t('This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType {word} to confirm.', { word: word }));
    if (typed !== null && (typed.trim().toLowerCase() === word.toLowerCase() || typed.trim() === 'RESTART')) { scene.resetProgress(); store.set('save', scene.saveState()); }
  }

  // ---- Start-up: remembered folder, offline support -----------------------------------------------------------------
  if (window.showDirectoryPicker) {
    loadHandle().then(h => {
      if (!h) return;
      const b = $('reopenFolder');
      b.textContent = t('Reopen "{name}"', { name: h.name }); b.dataset.name = h.name;
      b.hidden = false;
      b.addEventListener('click', () => reopenFolder(h));
    });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

  // ---- Language ------------------------------------------------------------------------------------------------------
  // ---- Themes: the Windows app's Custom Theme looks, from the dropdown above the volume sliders ----------------------------------------
  function buildThemeOptions() {
    const sel = $('themeSel');
    const cur = sel.value;
    sel.textContent = '';
    THEMES.forEach((th, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = t('Custom Theme {n}', { n: th.n });
      sel.appendChild(o);
    });
    sel.value = cur || '0';
  }
  const themeIndex = themeIndexFor(store.get('theme', ''));
  buildThemeOptions();
  $('themeSel').value = String(themeIndex);
  applyTheme(themeIndex);
  $('themeSel').addEventListener('change', () => {
    const i = parseInt($('themeSel').value, 10) || 0;
    applyTheme(i);
    store.set('theme', THEMES[i].id);   // the id, so the list can change without moving anyone's choice
  });

  function refreshLanguage() {
    applyDom();
    buildThemeOptions();
    for (const b of document.querySelectorAll('#menu [data-lang]')) b.classList.toggle('cur', b.dataset.lang === getLanguage());
    renderTunerLocalState();
    applyFilter();
    $('folderName').textContent = library.folderName ? t('{folder} ({n} tracks)', { folder: library.folderName, n: library.entries.length.toLocaleString() }) : '';
    const rb = $('reopenFolder'); if (!rb.hidden && rb.dataset.name) rb.textContent = t('Reopen "{name}"', { name: rb.dataset.name });
    showNowPlaying();
    musicList.refresh(); tunerList.refresh(); tunerStations.refresh(); radioList.refresh(); renderSortControls();
    updateSoundState();
    if (!$('compendium').hidden) openCompendium();
  }
  onLanguageChange(code => { store.set('lang', code); refreshLanguage(); });
  setLanguage(store.get('lang', '') || detectLanguage());

  // Press-and-hold must not select the page or open a context menu (the item disc is opened with one); text boxes are left alone.
  document.addEventListener('selectstart', e => {
    const el = e.target && (e.target.nodeType === 3 ? e.target.parentElement : e.target);
    if (!(el && el.closest && el.closest('input, textarea'))) e.preventDefault();
  });
  document.addEventListener('contextmenu', e => {
    const el = e.target;
    if (!(el && el.closest && el.closest('input, textarea'))) e.preventDefault();
  });

  // For the automated checks.
  window.fmc = { scene, player, vis, library, setEntries, Sound, setTab, openTuner, openCompendium, closePopups };
}

main().catch(e => { console.error(e); document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#f88;padding:12px">' + String(e && e.stack || e) + '</pre>'); });
