// Playback: the local music folder and radio, with the audio analysis that drives the scene's reactions.
//
// Two <audio> elements are used. The "analysed" one is wired into Web Audio (so we can read bass / mid / treble from it); that needs the
// stream to allow it (CORS), which local files always do. The "plain" one is never connected to Web Audio, so a station without CORS headers
// still plays; the scene then falls back to a steady beat clock, as the desktop app does when it can't analyse.

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.opus'];

/** The built-in stations. `cors`: true = https and CORS-enabled (plays and reacts); false = plays, no analysis; 'blocked' = http only. */
export const STATIONS = [
  { name: 'Final Fantasy Radio', url: 'http://finalfantasystation.com:8000/stream', cors: 'blocked', note: 'http only: needs a relay, so it only plays in the Windows app' },
  { name: 'Materia FM', url: 'https://radiohimura.ice.infomaniak.ch/radiohimura-192.aac', cors: true },
  { name: 'Folk Alley - Main', url: 'https://freshgrass.streamguys1.com/folkalley-128mp3', cors: false },
  { name: 'Folk Alley - Folk', url: 'https://freshgrass.streamguys1.com/ss1-128mp3', cors: false },
  { name: 'Folk Alley - Irish', url: 'https://freshgrass.streamguys1.com/irish-128mp3', cors: false },
  { name: 'Folk Alley - Fresh Cuts', url: 'https://freshgrass.streamguys1.com/freshcuts-128mp3', cors: false },
  { name: 'DNBRadio - Main (MP3)', url: 'https://azura.drmnbss.org/listen/dnbradio/radio.mp3', cors: true },
  { name: 'DNBRadio - Main (AAC)', url: 'https://azura.drmnbss.org/listen/dnbradio/radio.aac', cors: true },
  { name: 'DNBRadio - Plush Recordings', url: 'https://azura.drmnbss.org/listen/plushrecs/radio.mp3', cors: true },
  { name: 'DNBRadio - Section 8 Recordings', url: 'https://azura.drmnbss.org/listen/section8recs/radio.mp3', cors: true },
  { name: 'DNBRadio - Darkstep', url: 'https://azura.drmnbss.org/listen/darkstep/radio.mp3', cors: true },
  // Radio Rivendell: https with CORS, and an open now-playing feed (AzuraCast, by station id).
  { name: 'Radio Rivendell', url: 'https://play.radiorivendell.com/radio/8000/radio.mp3', cors: true, metaUrl: 'https://play.radiorivendell.com/api/nowplaying/1' },
  { name: 'Radio Rivendell - Lothl\u00f3rien', url: 'https://play.radiorivendell.com/radio/8020/radio.mp3', cors: true, metaUrl: 'https://play.radiorivendell.com/api/nowplaying/3' },
  { name: 'Radio Rivendell - The Green Dragon', url: 'https://play.radiorivendell.com/radio/8010/radio.mp3', cors: true, metaUrl: 'https://play.radiorivendell.com/api/nowplaying/5' },
];

/** Parses a .m3u / .m3u8 / .pls playlist into stations (http addresses are tried over https). */
export function parsePlaylist(text, fileName) {
  const out = [];
  const lines = text.split(/\r?\n/);
  let pendingName = null;
  const plsNames = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = /^Title(\d+)=(.*)$/i.exec(line))) { plsNames[m[1]] = m[2]; continue; }
    if ((m = /^File(\d+)=(.*)$/i.exec(line))) { out.push({ name: plsNames[m[1]] || m[2], url: m[2], idx: m[1] }); continue; }
    if (line.startsWith('#EXTINF')) { const c = line.indexOf(','); pendingName = c >= 0 ? line.substring(c + 1).trim() : null; continue; }
    if (line.startsWith('#')) continue;
    if (/^https?:\/\//i.test(line)) { out.push({ name: pendingName || line, url: line }); pendingName = null; }
  }
  for (const s of out) {
    if (plsNames[s.idx]) s.name = plsNames[s.idx];
    s.url = s.url.replace(/^http:\/\//i, 'https://');   // a secure page can't play plain http; most stations answer on both
    s.cors = 'unknown';
    s.source = fileName;
  }
  return out;
}

/** iPhone / iPad Safari (including the Home Screen app). It ignores HTMLMediaElement.volume and has to be given a gain stage. */
const IOS = typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export class Player {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.analysed = null;        // made by _newAnalysed(): a fresh element for every file or station
    this.plain = null;           // made by _makePlain(): a fresh element for every station that can't be analysed
    this._standby = null;        // a station being brought up silently behind the one that is playing: { el, kind, station }
    this._fade = null;           // the overlap while it takes over: { timer }
    this._wait = null;           // the playing station easing down while the next one buffers: { timer, start, el, level }
    this.mode = 'none';          // 'none' | 'local' | 'radio'
    this.canAnalyse = false;     // the current source is being analysed
    this.station = null;
    this.status = '';            // radio: 'Connecting...', 'Buffering...', 'Playing', 'Error: ...'
    this.onStatus = null;        // () => void: something about the state changed
    this.onEnded = null;         // () => void: a local track finished
    this._volume = 1;
    this.routing = 'unknown';     // radio: 'graph' (the stream goes through Web Audio, so the volume works) | 'outside' | 'unknown'
    this.onRouting = null;        // () => void: the stream turned out to play outside Web Audio
    this._routeTimer = 0;
    this._bands = new Float32Array(0);
    this._peaks = { bass: 0.002, mid: 0.002, treble: 0.002 };
    this._lastSpec = { live: false, bass: 0, mid: 0, treble: 0, loud: 0 };
    this._currentUrl = null;
    this.songTitle = '';          // radio: what the station says is playing, when it publishes that (else '')
    this._metaTimer = 0;

    this.plain = this._makePlain();
    this.analysed = this._newAnalysed();
    this.active = this.analysed;
  }

  _wire(a) {
    a.addEventListener('playing', () => {
      if (a !== this.active) return;
      this._setStatus('Playing');
      if (a === this.analysed && this.canAnalyse && this.mode === 'radio') this._checkRouting(a);
    });
    a.addEventListener('waiting', () => { if (a === this.active && this.mode === 'radio') this._setStatus('Buffering...'); });
    a.addEventListener('ended', () => { if (a === this.active && this.mode === 'local' && this.onEnded) this.onEnded(); });
    a.addEventListener('pause', () => { if (a === this.active && this.onStatus) this.onStatus(); });
  }

  /** A new element (and Web Audio source node) for every file or station. Safari can stop routing an element through Web Audio
   *  once its source has been replaced, which left the music slider with no effect on the second and later things played.
   *  The previous analysed element is let go of (use _makeAnalysed to leave it playing). */
  _newAnalysed() {
    const old = this.analysed;
    if (old) this._release(old);
    const a = this._makeAnalysed();
    this.analysed = a;
    this._applyMute();
    this.routing = 'unknown';
    return a;
  }

  _makeAnalysed() {
    const a = new Audio();
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';   // from the start, before the element is connected (local files are blob: URLs, same-origin anyway)
    this._wire(a);
    this._attach(a);
    return a;
  }

  /** A fresh element for a station the browser won't let us analyse (no CORS): it is never connected to Web Audio. */
  _makePlain() {
    const a = new Audio();
    a.preload = 'none';
    this._wire(a);
    a.muted = this._volume <= 0;
    a.volume = this._volume;
    return a;
  }

  /** Connects an element to the music gain stage and the analyser, once the graph exists. Each element has a gain of its own, so a
   *  station that is taking over from another can be faded in while the old one is faded out. */
  _attach(a) {
    if (!this.ctx || !this._music) { a.volume = this._volume; return; }
    try {
      const src = this.ctx.createMediaElementSource(a);
      const g = this.ctx.createGain();
      src.connect(g);
      g.connect(this._music);     // what is heard
      g.connect(this.analyser);   // what the scene reacts to (before the volume)
      a._src = src; a._gain = g;
      a.volume = 1;
    } catch (e) { a._src = null; a._gain = null; a.volume = this._volume; }
  }

  /** Lets go of an element: it stops, its source is dropped, and it leaves the graph. */
  _release(a) {
    if (!a) return;
    try { a.pause(); a.removeAttribute('src'); a.load(); } catch (e) { /* */ }
    for (const k of ['_gain', '_src']) { if (a[k]) { try { a[k].disconnect(); } catch (e) { /* */ } a[k] = null; } }
  }

  /** A few seconds into a stream: is audio actually flowing through the Web Audio graph? Some browsers play a live stream natively
   *  and bypass it, in which case neither the analysis nor the music volume can reach it. */
  _checkRouting(a) {
    clearTimeout(this._routeTimer);
    this.routing = 'unknown';
    this._routeTimer = setTimeout(() => {
      if (a !== this.active || a.paused || a.muted || !this.analyser || !this.ctx || this.ctx.state !== 'running') return;
      const td = new Uint8Array(this.analyser.fftSize);
      let peak = 0, n = 0;
      const iv = setInterval(() => {
        this.analyser.getByteTimeDomainData(td);
        for (const v of td) peak = Math.max(peak, Math.abs(v - 128));
        if (++n >= 6 || peak > 1) {
          clearInterval(iv);
          if (a !== this.active) return;
          this.routing = peak > 1 ? 'graph' : 'outside';
          if (this.routing === 'outside' && this.onRouting) this.onRouting();
          if (this.onStatus) this.onStatus();
        }
      }, 150);
    }, 2500);
  }

  /** How the music volume reaches what is playing now: 'graph' | 'element' | 'mute' (the slider only mutes) | 'device' (not at all). */
  get volumePath() {
    if (this.mode === 'radio' && !this.canAnalyse) return IOS ? 'mute' : 'element';
    if (this.routing === 'outside') return IOS ? 'device' : 'element';
    return this._music ? 'graph' : 'element';
  }

  _applyMute() {
    this.plain.muted = this._volume <= 0;
    // iOS ignores the element volume but honours muting, so a zero volume is silent even for a stream the graph does not carry.
    if (this.analysed) this.analysed.muted = IOS && this._volume <= 0;
  }

  _setStatus(s) { this.status = s; if (this.onStatus) this.onStatus(); }

  /** Browsers can't read a stream's in-band title unless the station allows it, so this asks the station's own "now playing" feed.
   *  AzuraCast stations (the DNBRadio channels) publish one with open CORS at /api/nowplaying/<shortcode>. */
  _metaUrl(station) {
    if (station.metaUrl) return station.metaUrl;
    const m = /^(https?:\/\/[^\/]+)\/listen\/([^\/]+)\//.exec(station.url || '');
    return m ? m[1] + '/api/nowplaying/' + m[2] : '';
  }

  _startMeta(station) {
    this._stopMeta();
    const url = this._metaUrl(station);
    if (!url) return;
    const poll = async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const s = j && j.now_playing && j.now_playing.song;
        const title = s ? (s.text || [s.artist, s.title].filter(Boolean).join(' - ')) : '';
        if (this.station === station && title !== this.songTitle) { this.songTitle = title || ''; if (this.onStatus) this.onStatus(); }
      } catch (e) { /* no feed, or blocked: the station name alone is shown */ }
    };
    poll();
    this._metaTimer = setInterval(poll, 15000);
  }

  _stopMeta() {
    clearInterval(this._metaTimer);
    this._metaTimer = 0;
    this.songTitle = '';
  }
  /** Builds the Web Audio graph. Must run from a user gesture (click / key) the first time. */
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.55;
        // The music's volume is a gain stage here, not the element's own volume: Safari on iPhone and iPad ignores
        // HTMLMediaElement.volume (it always reads 1), so a slider driving that did nothing there. The analysis taps the signal
        // before the gain, so a silent music volume still lets the scene follow a playing station.
        this._music = this.ctx.createGain();
        this._music.gain.value = this._volume;
        this._music.connect(this.ctx.destination);
        this._tap = this.ctx.createGain();   // keeps the analyser pulled by the graph without making a sound
        this._tap.gain.value = 0;
        this.analyser.connect(this._tap);
        this._tap.connect(this.ctx.destination);
        this._attach(this.analysed);
        this._bands = new Uint8Array(this.analyser.frequencyBinCount);
        this._time = new Uint8Array(this.analyser.fftSize);
      } catch (e) { this.ctx = null; this.analyser = null; this._music = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** The music volume, 0-1. Effects have their own (Sound.volume) and are not affected by this. */
  get volume() { return this._volume; }
  set volume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    // Through the graph once it exists (works on iOS); the element's own volume before that and for streams that can't be analysed.
    if (this._music) this._music.gain.value = this._volume; else this.analysed.volume = this._volume;
    this.plain.volume = this._volume;
    this._applyMute();
  }

  get playing() { return !this.active.paused && !this.active.ended && this.mode !== 'none'; }
  get radioPlaying() { return this.mode === 'radio' && this.playing && this.status === 'Playing'; }
  get radioBuffering() { return this.mode === 'radio' && (this.status === 'Connecting...' || this.status === 'Buffering...'); }

  _stopBoth() {
    this._dropStandby();
    this._endWait(true);
    this._endFade();
    for (const a of [this.analysed, this.plain]) { try { a.pause(); } catch (e) { /* */ } }
  }

  stop() {
    this._stopBoth();
    this.analysed.removeAttribute('src'); this.analysed.load();
    this.plain.removeAttribute('src'); this.plain.load();
    this.mode = 'none'; this.station = null; this.status = ''; this.canAnalyse = false;
    this._stopMeta();
    if (this.onStatus) this.onStatus();
  }

  /** Plays a local file. */
  playFile(file) {
    this.unlock();
    this._stopBoth();
    if (this._currentUrl) URL.revokeObjectURL(this._currentUrl);
    this._currentUrl = URL.createObjectURL(file);
    this.mode = 'local'; this.station = null; this.status = '';
    this._stopMeta();
    this._newAnalysed();
    this.active = this.analysed;
    this.canAnalyse = !!this.analyser;
    this.analysed.src = this._currentUrl;
    this.analysed.play().catch(() => { });
    if (this.onStatus) this.onStatus();
  }

  /** Brings a station up silently behind the one that is playing and swaps once it is flowing, so switching leaves no gap. */
  _switchStation(station) {
    this._dropStandby();
    this._endFade();
    this.station = station;
    this._startMeta(station);
    const kind = (station.cors === false || !this.analyser) ? 'plain' : 'analysed';
    const el = kind === 'analysed' ? this._makeAnalysed() : this._makePlain();
    const standby = { el: el, kind: kind, station: station };
    this._standby = standby;
    this._setLevel(el, 0);
    this._startWait();
    el.src = station.url;

    const ready = () => {
      el.removeEventListener('timeupdate', onTime);
      if (this._standby === standby) this._commitStandby();
    };
    const onTime = () => { if (el.currentTime >= 0.35 && !el.paused) ready(); };
    el.addEventListener('timeupdate', onTime);
    const onError = () => {
      el.removeEventListener('error', onError);
      el.removeEventListener('timeupdate', onTime);
      if (this._standby !== standby) return;
      if (kind === 'analysed') {
        // CORS refused: try the same station as a plain stream, still behind the old one
        this._standby = null;
        this._release(el);
        const plain = this._makePlain();
        const sb = { el: plain, kind: 'plain', station: station };
        this._standby = sb;
        plain.volume = 0;
        plain.src = station.url;
        const onTime2 = () => { if (plain.currentTime >= 0.35 && !plain.paused && this._standby === sb) { plain.removeEventListener('timeupdate', onTime2); this._commitStandby(); } };
        plain.addEventListener('timeupdate', onTime2);
        plain.addEventListener('error', () => { if (this._standby === sb) this._failSwitch(station, 'could not play'); });
        plain.play().catch(() => { /* an error event follows if it really failed */ });
      } else this._failSwitch(station, 'could not play');
    };
    el.addEventListener('error', onError);
    // if it never starts, give up after a while rather than leave the old station playing under a station name that is not it
    standby.timeout = setTimeout(() => { if (this._standby === standby) this._failSwitch(station, 'the station did not start playing'); }, 20000);
    el.play().catch(() => { /* an error event follows if it really failed */ });
  }

  _failSwitch(station, why) {
    this._dropStandby();
    this._stopBoth();
    this.mode = 'radio'; this.station = station; this.canAnalyse = false;
    this._setStatus('Error: ' + why);
  }

  _dropStandby() {
    const s = this._standby;
    this._standby = null;
    if (!s) return;
    clearTimeout(s.timeout);
    this._release(s.el);
  }

  /** While the next station buffers, the one playing eases down (to a fifth of its level, never to silence: a slow stream must not
   *  leave a gap). A second request keeps the same ease-down going. */
  _startWait() {
    if (this._wait || !this.active) return;
    const w = { start: performance.now(), el: this.active, level: 1, timer: 0 };
    w.timer = setInterval(() => {
      const x = Math.min(1, (performance.now() - w.start) / 3000);
      const s = x * x * (3 - 2 * x);   // smooth start and end
      w.level = 1 - 0.8 * s;
      this._setLevel(w.el, w.level);
    }, 40);
    this._wait = w;
  }

  /** Stops the ease-down and returns the level it had reached; `restore` puts the element back to full. */
  _endWait(restore) {
    const w = this._wait;
    this._wait = null;
    if (!w) return 1;
    clearInterval(w.timer);
    if (restore) this._setLevel(w.el, 1);
    return w.level;
  }

  /** Sets how loud a station element is within its own fade: through its own gain when it is on the Web Audio graph, else its element volume. */
  _setLevel(el, level) {
    if (el._gain) el._gain.gain.value = level;
    else el.volume = level * this._volume;
  }

  /** The new station is flowing: it becomes the one playing, and the old one is faded out under it. */
  _commitStandby() {
    const s = this._standby;
    this._standby = null;
    if (!s) return;
    clearTimeout(s.timeout);
    const oldEl = this.active;
    const fromLevel = this._endWait(false);   // the old station carries on from wherever its ease-down had got to
    if (s.kind === 'analysed') this.analysed = s.el; else this.plain = s.el;
    this.active = s.el;
    this.station = s.station;
    this.canAnalyse = s.kind === 'analysed';
    this.mode = 'radio';
    this.routing = 'unknown';
    this._applyMute();
    this._setStatus('Playing');
    if (s.kind === 'analysed') this._checkRouting(s.el);

    // Elements outside the graph can't be faded on iOS (it ignores the element volume), so the old one is simply stopped there.
    const canFade = !IOS || (oldEl && oldEl._gain && s.el._gain);
    if (!oldEl || oldEl === s.el || !canFade) {
      this._setLevel(s.el, 1);
      if (oldEl && oldEl !== s.el) this._retire(oldEl);
      return;
    }
    const start = performance.now(), ms = 800;
    const timer = setInterval(() => {
      const f = Math.min(1, (performance.now() - start) / ms);
      this._setLevel(s.el, f);
      this._setLevel(oldEl, fromLevel * (1 - f));
      if (f >= 1) { this._endFade(); }
    }, 30);
    this._fade = { timer: timer, from: oldEl, to: s.el };
  }

  /** Finishes any overlap at once: the new station at full level, the old one gone. */
  _endFade() {
    const f = this._fade;
    this._fade = null;
    if (!f) return;
    clearInterval(f.timer);
    this._setLevel(f.to, 1);
    this._retire(f.from);
  }

  /** Releases an element that has been replaced, giving back a fresh idle one if it was the current analysed / plain element. */
  _retire(el) {
    this._release(el);
    if (el === this.analysed) { this.analysed = this._makeAnalysed(); this._applyMute(); }
    else if (el === this.plain) { this.plain = this._makePlain(); }
  }

  /** Tunes in to a station: tries it analysed (CORS), and falls back to plain playback if the stream won't allow that. When a station
   *  is already playing, it keeps playing until the new one is ready (see _switchStation). */
  playStation(station) {
    this.unlock();
    if (this.mode === 'radio' && this.station && this.playing && this.status === 'Playing' && station.cors !== 'blocked') {
      this._switchStation(station);
      if (this.onStatus) this.onStatus();
      return;
    }
    this._stopBoth();
    this.mode = 'radio'; this.station = station; this._setStatus('Connecting...');
    this._startMeta(station);
    if (station.cors === 'blocked') { this._setStatus('Error: this station only streams over plain http'); return; }
    const tryPlain = () => {
      this.active = this.plain;
      this.canAnalyse = false;
      this.plain.removeAttribute('crossorigin');
      this.plain.src = station.url;
      this.plain.play().catch(e => this._setStatus('Error: ' + (e && e.message ? e.message : 'could not play')));
    };
    if (station.cors === false || !this.analyser) { tryPlain(); return; }
    this._newAnalysed();
    this.active = this.analysed;
    this.canAnalyse = true;
    this.analysed.src = station.url;
    let fellBack = false;
    const onError = () => {
      this.analysed.removeEventListener('error', onError);
      if (fellBack || this.station !== station) return;
      fellBack = true;
      this.analysed.pause(); this.analysed.removeAttribute('src'); this.analysed.load();
      tryPlain();
    };
    this.analysed.addEventListener('error', onError);
    this.analysed.play().catch(() => { /* an error event follows if it really failed */ });
  }

  togglePause() {
    if (this.mode === 'none') return;
    if (this.active.paused) this.active.play().catch(() => { }); else this.active.pause();
    if (this.onStatus) this.onStatus();
  }

  get currentTime() { return this.mode === 'local' ? this.active.currentTime : 0; }
  get duration() { return this.mode === 'local' && isFinite(this.active.duration) ? this.active.duration : 0; }
  seek(seconds) { if (this.mode === 'local') this.active.currentTime = seconds; }

  // ---- Audio analysis ---------------------------------------------------------------------------------------

  /** Bass / mid / treble / loudness (0..1 each) of what is playing, adaptively normalised so quiet and loud tracks both move the scene. */
  spectrum() {
    if (!this.analyser || !this.canAnalyse || !this.playing || this.active !== this.analysed) { this._lastSpec.live = false; return this._lastSpec; }
    this.analyser.getByteFrequencyData(this._bands);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    // The analyser's bytes are decibels squashed into 0..255; turn them back into amplitudes so loud and quiet passages differ.
    const minDb = this.analyser.minDecibels, maxDb = this.analyser.maxDecibels;
    const avg = (lo, hi) => {
      let sum = 0, n = 0;
      for (let i = Math.max(1, Math.floor(lo / binHz)); i <= Math.min(this._bands.length - 1, Math.floor(hi / binHz)); i++) {
        sum += Math.pow(10, (minDb + (this._bands[i] / 255) * (maxDb - minDb)) / 20);
        n++;
      }
      return n ? sum / n : 0;
    };
    const raw = { bass: avg(30, 250), mid: avg(250, 2000), treble: avg(2000, 8000) };
    const out = this._lastSpec;
    let any = 0;
    for (const k of ['bass', 'mid', 'treble']) {
      const p = this._peaks;
      p[k] = Math.max(raw[k], p[k] * 0.9985, 0.0008);   // each band is judged against its own recent peak
      out[k] = Math.min(1, Math.pow(raw[k] / p[k], 1.6));
      any += raw[k];
    }
    out.loud = Math.min(1, (out.bass * 0.5 + out.mid * 0.35 + out.treble * 0.15));
    out.live = any > 0.002;   // an analyser on a stream the browser silenced returns zeros: treat that as "no analysis"
    return out;
  }

  /** A single 0..1 level for the beat tracker, or -1 when there's nothing to analyse. */
  level() {
    const s = this._lastSpec;
    if (!s.live) return -1;
    return Math.min(1, s.bass * 0.7 + s.mid * 0.3);
  }
}
