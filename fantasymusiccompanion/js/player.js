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

export class Player {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.analysed = new Audio();
    this.analysed.preload = 'auto';
    this.plain = new Audio();
    this.plain.preload = 'none';
    this.active = this.analysed;
    this.mode = 'none';          // 'none' | 'local' | 'radio'
    this.canAnalyse = false;     // the current source is being analysed
    this.station = null;
    this.status = '';            // radio: 'Connecting...', 'Buffering...', 'Playing', 'Error: ...'
    this.onStatus = null;        // () => void: something about the state changed
    this.onEnded = null;         // () => void: a local track finished
    this._volume = 1;
    this._bands = new Float32Array(0);
    this._peaks = { bass: 0.002, mid: 0.002, treble: 0.002 };
    this._lastSpec = { live: false, bass: 0, mid: 0, treble: 0, loud: 0 };
    this._currentUrl = null;
    this.songTitle = '';          // radio: what the station says is playing, when it publishes that (else '')
    this._metaTimer = 0;

    for (const a of [this.analysed, this.plain]) {
      a.addEventListener('playing', () => { if (a === this.active) { this._setStatus('Playing'); } });
      a.addEventListener('waiting', () => { if (a === this.active && this.mode === 'radio') this._setStatus('Buffering...'); });
      a.addEventListener('ended', () => { if (a === this.active && this.mode === 'local' && this.onEnded) this.onEnded(); });
      a.addEventListener('pause', () => { if (a === this.active && this.onStatus) this.onStatus(); });
    }
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
        const src = this.ctx.createMediaElementSource(this.analysed);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.analyser.smoothingTimeConstant = 0.55;
        src.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
        this._bands = new Uint8Array(this.analyser.frequencyBinCount);
        this._time = new Uint8Array(this.analyser.fftSize);
      } catch (e) { this.ctx = null; this.analyser = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  get volume() { return this._volume; }
  set volume(v) { this._volume = Math.max(0, Math.min(1, v)); this.analysed.volume = this._volume; this.plain.volume = this._volume; }

  get playing() { return !this.active.paused && !this.active.ended && this.mode !== 'none'; }
  get radioPlaying() { return this.mode === 'radio' && this.playing && this.status === 'Playing'; }
  get radioBuffering() { return this.mode === 'radio' && (this.status === 'Connecting...' || this.status === 'Buffering...'); }

  _stopBoth() {
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
    this.active = this.analysed;
    this.canAnalyse = !!this.analyser;
    this.analysed.removeAttribute('crossorigin');
    this.analysed.src = this._currentUrl;
    this.analysed.play().catch(() => { });
    if (this.onStatus) this.onStatus();
  }

  /** Tunes in to a station: tries it analysed (CORS), and falls back to plain playback if the stream won't allow that. */
  playStation(station) {
    this.unlock();
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
    this.active = this.analysed;
    this.canAnalyse = true;
    this.analysed.crossOrigin = 'anonymous';
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
