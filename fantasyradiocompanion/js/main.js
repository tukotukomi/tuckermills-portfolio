// Fantasy Radio Companion for the web: the page, wiring the scene, the player, the music library and the popups together.

import { PixelScene } from './scene.js';
import { Sprites } from './sprites.js';
import { Visualizer, IS_MOBILE } from './visualizer.js';
import { Sound } from './sfx.js';
import { Player, STATIONS, AUDIO_EXTENSIONS, parsePlaylist } from './player.js';
import { VirtualList, fmtTime, el } from './ui.js';
import { flipImage, silhouetteImage, C } from './util.js';

const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fmc.' + k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fmc.' + k, v); } catch (e) { /* private mode */ } },
};

async function main() {
  await Sprites.load('assets/sprites/');

  const scene = new PixelScene();
  scene.loadState(store.get('save', ''));
  const player = new Player();
  const canvas = $('scene');

  // ---- Library (local folder) ---------------------------------------------------------------------------
  const library = { entries: [], filtered: [], folderName: '', search: '', current: -1, shuffle: store.get('shuffle', '0') === '1', repeat: parseInt(store.get('repeat', '0'), 10) || 0, cycle: new Set() };

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
    applyFilter();
    $('folderName').textContent = folderName ? folderName + ' (' + entries.length.toLocaleString() + ' tracks)' : '';
    $('musicEmpty').hidden = !!folderName;
    $('musicList').hidden = !folderName;
    renderTunerLocalState();
  }

  function applyFilter() {
    const words = library.search.toLowerCase().split(/\s+/).filter(Boolean);
    const playingPath = library.current >= 0 && library.filtered[library.current] ? library.filtered[library.current].path : null;
    library.filtered = words.length === 0 ? library.entries : library.entries.filter(e => {
      const hay = e.path.toLowerCase();
      return words.every(w => hay.indexOf(w) >= 0);
    });
    library.current = playingPath ? library.filtered.findIndex(e => e.path === playingPath) : -1;
    musicList.setItems(library.filtered);
    tunerList.setItems(library.filtered);
    musicList.setPlaying(library.current);
    tunerList.setPlaying(library.current);
    $('musicCount').textContent = words.length ? library.filtered.length.toLocaleString() + ' of ' + library.entries.length.toLocaleString() + ' match' : '';
    $('tunerFoot').textContent = library.folderName ? library.folderName + (words.length ? ' - ' + library.filtered.length + ' matching' : '') : '';
  }

  async function chooseFolder() {
    Sound.unlock(); player.unlock();
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker({ mode: 'read' });
        $('folderName').textContent = 'Scanning...';
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
      $('folderName').textContent = 'Scanning...';
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
  });
  vis.start();

  // The scene reads what is playing every frame.
  setInterval(() => {
    scene.marching = player.playing || player.radioBuffering;
    scene.progressing = player.radioPlaying;
    vis.buffering = player.radioBuffering;
    vis.bufferingName = player.station ? player.station.name : '';
  }, 100);

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
    else if (e.key === 'Escape' && vis.dismissOverlay()) { /* closed the item disc or the shop */ }
    else if (e.key === 'Escape') { if (!$('tuner').hidden) closePopups(); else if (!$('compendium').hidden) closePopups(); else if (document.body.classList.contains('immersive')) toggleFullscreen(); }
    else if (e.key === ' ' && !typing && vis.fullscreen) { e.preventDefault(); player.togglePause(); updateTransport(); }
  });

  // ---- Lists -----------------------------------------------------------------------------------------------
  const renderTrack = (row, e) => { row.append(el('div', 't', e.name.replace(/\.[^.]+$/, '')), el('div', 's', e.path)); };
  const renderStation = (row, s) => {
    row.append(el('div', 't', s.name), el('div', 's', s.cors === 'blocked' ? s.note : s.source ? 'From playlist: ' + s.source : s.cors === true ? 'Plays and drives the scene' : s.cors === false ? 'Plays (no audio reactions)' : 'Plays; reactions if the station allows'));
    if (s.cors === 'blocked') row.classList.add('disabled');
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
  $('addPlaylist').addEventListener('click', () => $('playlistFile').click());
  $('playlistFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const found = parsePlaylist(await f.text(), f.name);
    let user = [];
    try { user = JSON.parse(store.get('stations', '[]')); } catch (x) { /* */ }
    for (const s of found) if (!user.some(u => u.url === s.url)) user.push(s);
    store.set('stations', JSON.stringify(user));
    loadUserStations(); refreshStationLists();
    e.target.value = '';
  });

  function renderTunerLocalState() {
    const has = !!library.folderName;
    $('tunerNoFolder').hidden = has;
    $('tunerList').hidden = !has;
    $('tunerSearch').hidden = !has;
    $('tunerFolder').textContent = has ? 'Change folder...' : 'Select music folder...';
  }
  renderTunerLocalState();
  $('musicList').hidden = true;

  // ---- Transport -----------------------------------------------------------------------------------------------
  function showNowPlaying() {
    if (player.mode === 'local') {
      const e = library.filtered[library.current];
      $('nowTitle').textContent = e ? e.name.replace(/\.[^.]+$/, '') : 'Playing';
      $('nowSub').textContent = e ? e.path : '';
    } else if (player.mode === 'radio') {
      $('nowTitle').textContent = player.station.name;
      $('nowSub').textContent = player.songTitle || (player.status + (player.canAnalyse ? '' : ' - no audio reactions'));
    } else { $('nowTitle').textContent = 'Nothing playing'; $('nowSub').textContent = ''; }
  }

  function updateTransport() {
    showNowPlaying();
    $('btnPlay').innerHTML = player.playing ? '&#9208;&#xFE0E;' : '&#9654;&#xFE0E;';
    $('btnShuffle').classList.toggle('active', library.shuffle);
    $('btnRepeat').classList.toggle('active', library.repeat > 0);
    $('btnRepeat').textContent = library.repeat === 2 ? '↻1' : '↻';
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

  // Volumes: the main one scales everything the page plays; the effects fader sits relative to it.
  const mainVol = parseInt(store.get('vol', '100'), 10), fxVol = parseInt(store.get('fx', '70'), 10);
  $('volMain').value = mainVol; $('volFx').value = fxVol;
  const applyVolumes = () => {
    const main = parseInt($('volMain').value, 10) / 100;
    player.volume = main;
    Sound.output = null;
    Sound.volume = parseInt($('volFx').value, 10) * main;   // effects scale with the main fader too
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
    setTunerTab('radio');   // it always opens on the Radio Stations tab
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
  function openCompendium() {
    Sound.unlock();
    closePopups();
    const cards = $('compCards');
    cards.textContent = '';
    let known = 0, kills = 0;
    for (const b of scene.bestiary()) {
      if (b.seen) known++;
      kills += b.kills;
      const card = el('div', 'card' + (b.seen ? '' : ' unknown'));
      const cv = document.createElement('canvas');
      cv.width = 38; cv.height = 38;
      const cx = cv.getContext('2d');
      cx.imageSmoothingEnabled = false;
      const img = portrait(b.kind, b.seen);
      // Sky over a strip of grass, with the portrait standing on it.
      cx.fillStyle = b.seen ? '#5c84d6' : '#28284a'; cx.fillRect(0, 0, 38, 38);
      cx.fillStyle = b.seen ? '#4ca050' : '#1e1e38'; cx.fillRect(0, 30, 38, 8);
      const f = Math.max(1, Math.min(Math.floor(34 / img.width), Math.floor(30 / img.height)));
      cx.drawImage(img, Math.round((38 - img.width * f) / 2), 34 - img.height * f, img.width * f, img.height * f);
      const mid = el('div');
      if (b.seen) {
        mid.append(el('div', 'nm', b.name.toUpperCase()));
        const st = el('div', 'st'); st.innerHTML = '<b>HP ' + b.maxHp + '</b> &nbsp; ' + b.habitat;
        mid.append(st, el('div', 'nt', b.note));
      } else { mid.append(el('div', 'nm', '???'), el('div', 'nt', 'Not yet encountered.')); }
      const right = el('div', 'kills');
      if (b.seen) { right.append(el('div', 'n', 'x ' + b.kills), el('div', 'l', 'DEFEATED')); }
      card.append(cv, mid, right);
      cards.append(card);
    }
    $('compFoot').textContent = 'DISCOVERED ' + known + '/' + scene.bestiary().length + '   DEFEATED ' + kills;
    showPopup('compendium');
  }

  // ---- Menu --------------------------------------------------------------------------------------------------------
  $('menuBtn').addEventListener('click', e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; });
  document.addEventListener('click', () => { $('menu').hidden = true; });
  $('menu').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (!act) return;
    $('menu').hidden = true;
    if (act === 'export') {
      const s = scene.saveState();
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(() => alert('Progress copied. Paste it into Import on another device, or into the Windows app\'s saved settings.'), () => prompt('Copy your progress:', s));
      else prompt('Copy your progress:', s);
    } else if (act === 'import') {
      const s = prompt('Paste a progress string:');
      if (s) { scene.loadState(s.trim()); store.set('save', scene.saveState()); }
    } else if (act === 'restart') restartAdventure();
    else if (act === 'about') { updateSoundState(); $('about').showModal(); }
  });

  // Sound effects: any gesture on the page wakes the engine (some browsers only honour a resume() made during one), and the
  // About box can say what state it is in and play a test sound, to tell "blocked by the browser" from "muted".
  for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchend'])
    window.addEventListener(ev, () => { if (Sound.state !== 'running') Sound.unlock(); }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Sound.unlock(); });

  // On a phone or tablet the game waits while it is minimized (see visualizer.js). Say so when the player comes back, if the
  // adventure was progressing and they were away long enough to have noticed nothing happening.
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
    if (IS_MOBILE && hiddenAt && wasProgressing && Date.now() - hiddenAt > 1500) showTip('Progress paused while game minimized.');
    hiddenAt = 0;
  });
  function updateSoundState() {
    const s = Sound.state;
    $('soundState').textContent = s === 'running' ? 'on (volume ' + Math.round(Sound.volume) + '%)'
      : s === 'none' ? 'not supported by this browser'
      : 'waiting for a click or key press (' + s + ')';
  }
  $('soundTest').addEventListener('click', () => {
    Sound.unlock();
    setTimeout(() => { Sound.play('CoinPickup'); updateSoundState(); }, 150);
    setTimeout(updateSoundState, 600);
  });

  function restartAdventure() {
    const typed = prompt('This resets your adventure: your party goes back to just the Paca, levels, gold and the compendium are cleared, and the day and season start over.\n\nType RESTART to confirm.');
    if (typed === 'RESTART') { scene.resetProgress(); store.set('save', scene.saveState()); }
  }

  // ---- Start-up: remembered folder, offline support -----------------------------------------------------------------
  if (window.showDirectoryPicker) {
    loadHandle().then(h => {
      if (!h) return;
      const b = $('reopenFolder');
      b.textContent = 'Reopen "' + h.name + '"';
      b.hidden = false;
      b.addEventListener('click', () => reopenFolder(h));
    });
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });

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
  window.fmc = { scene, player, vis, library, Sound, setTab, openTuner, openCompendium, closePopups };
}

main().catch(e => { console.error(e); document.body.insertAdjacentHTML('afterbegin', '<pre style="color:#f88;padding:12px">' + String(e && e.stack || e) + '</pre>'); });
