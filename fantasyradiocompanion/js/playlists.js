// Playlists for local music: reading the playlist files other programs write (iTunes / Apple Music, Traktor, and plain .m3u / .m3u8 / .pls), and
// matching what they list to the files in the music folder that was picked. A port of src\Playlists.cs.
//
// A playlist is { id, name, items: [{ path, artist, title }] }. An item is what the playlist said: the path on whatever machine wrote it, and the
// artist and title when it gave them. Which local file an item means is decided when the playlist is shown (see makeResolver), so the same
// playlist keeps working if the music folder moves, and an item that is not in the folder just stays in the playlist, waiting.

// ---- a small XML reader (no DOM: the files can be tens of megabytes, and this can be tested without a browser) -----------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescapeXml(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(n); } catch (err) { return m; }
    }
    return ENTITIES[e] !== undefined ? ENTITIES[e] : m;
  });
}

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Walks the tags of an XML text: open(name, attrs), close(name) and chars(text). */
function sax(text, open, close, chars) {
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(text))) {
    if (m[3] !== undefined) {
      if (m[2]) { close(m[3]); continue; }
      const attrs = {};
      if (m[4]) { ATTR.lastIndex = 0; let a; while ((a = ATTR.exec(m[4]))) attrs[a[1]] = unescapeXml(a[2] !== undefined ? a[2] : a[3]); }
      open(m[3], attrs);
      if (m[5]) close(m[3]);
    } else if (m[6] !== undefined) { if (chars) chars(m[6]); }
    else if (m[1] !== undefined) { if (chars) chars(m[1]); }
  }
}

// ---- small helpers -----------------------------------------------------------------------------------------------------------------------

const baseName = p => p.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop();
const stripExt = n => n.replace(/\.[A-Za-z0-9]{1,5}$/, '');

/** "Artist - Title" split in two when it has that shape; otherwise it is all title. */
function splitHint(text) {
  const i = text ? text.indexOf(' - ') : -1;
  return i > 0 ? { artist: text.slice(0, i).trim(), title: text.slice(i + 3).trim() } : { artist: '', title: (text || '').trim() };
}

/** A file:// address (as iTunes writes locations) as a path: file://localhost/C:/Music/a%20b.mp3 becomes C:/Music/a b.mp3. */
function fileUrlToPath(url) {
  let s = url.replace(/^file:\/\/(localhost)?/i, '');
  try { s = decodeURIComponent(s); } catch (e) { /* leave it as it was */ }
  if (/^\/[A-Za-z]:/.test(s)) s = s.slice(1);
  return s;
}

// ---- iTunes / Apple Music: Library.xml (or one exported playlist, in the same format) --------------------------------------------

const KEEP_TRACK = { 'Name': 1, 'Artist': 1, 'Location': 1 };   // all the track records have to be read, so keep only what is used

/** The playlists in an iTunes / Apple Music library file. `kind` is 'system' for the library itself and the built-in lists (Music, Movies...). */
export function parseITunes(text) {
  let root = null;
  const stack = [];
  let leaf = null, buf = '';
  const top = () => stack[stack.length - 1];
  function attach(value) {
    const f = top();
    if (!f) return;
    if (f.kind === 'array') f.obj.push(value);
    else if (f.key !== null) {
      if (!(f.prune && !KEEP_TRACK[f.key])) f.obj[f.key] = value;
      f.key = null;
    }
  }
  sax(text, (name) => {
    if (name === 'dict' || name === 'array') {
      const parent = top();
      const v = name === 'dict' ? {} : [];
      const asKey = parent && parent.kind === 'dict' ? parent.key : null;
      attach(v);
      if (!root) root = v;
      stack.push({ kind: name, obj: v, key: null, name: asKey, prune: name === 'dict' && !!parent && parent.name === 'Tracks' && stack.length === 2 });
    } else if (name === 'true') attach(true);
    else if (name === 'false') attach(false);
    else if (name === 'key' || name === 'string' || name === 'integer' || name === 'real' || name === 'date' || name === 'data') { leaf = name; buf = ''; }
  }, (name) => {
    if (name === 'dict' || name === 'array') { stack.pop(); return; }
    if (leaf !== name) return;
    leaf = null;
    const f = top();
    if (name === 'key') { if (f) f.key = unescapeXml(buf); }
    else if (name === 'integer') attach(parseInt(buf, 10));
    else if (name === 'string') attach(unescapeXml(buf));
    else attach(buf);
  }, (s) => { if (leaf) buf += s; });

  const out = [];
  if (!root || !root.Playlists) return out;
  const tracks = root.Tracks || {};
  for (const pl of root.Playlists) {
    if (!pl || pl.Folder === true) continue;
    const items = [];
    for (const it of pl['Playlist Items'] || []) {
      const tr = tracks[it['Track ID']];
      if (!tr || !tr.Location || !/^file:/i.test(tr.Location)) continue;   // (a stream or a podcast that is not on this disk)
      items.push({ path: fileUrlToPath(tr.Location), artist: tr.Artist || '', title: tr.Name || '' });
    }
    out.push({ name: pl.Name || 'Playlist', items: items, kind: pl.Master === true || pl['Distinguished Kind'] !== undefined ? 'system' : 'user' });
  }
  return out;
}

// ---- Traktor: collection.nml -------------------------------------------------------------------------------------------------------

/** Traktor writes a path as VOLUME + DIR + FILE, with "/:" between the folders: C: + /:Users/:me/:Music/: + a.mp3. */
const nmlPath = s => s.replace(/\/:/g, '/');

/** The playlists in a Traktor collection (its folders are flattened; smart lists have no tracks written in the file and are skipped). */
export function parseTraktor(text) {
  const collection = {};   // PRIMARYKEY-style key -> { path, artist, title }
  let inCollection = false, entry = null;
  const nodes = [];        // the NODE stack: { type, name, items }
  const out = [];
  let inPlaylist = null, plEntry = false;
  sax(text, (name, a) => {
    if (name === 'COLLECTION') inCollection = true;
    else if (name === 'ENTRY' && inCollection) entry = { artist: a.ARTIST || '', title: a.TITLE || '' };
    else if (name === 'LOCATION' && entry) {
      const key = (a.VOLUME || '') + (a.DIR || '') + (a.FILE || '');
      entry.path = nmlPath(key);
      collection[key] = entry;
    } else if (name === 'NODE') nodes.push({ type: a.TYPE || '', name: a.NAME || '', items: null });
    else if (name === 'PLAYLIST') { const n = nodes[nodes.length - 1]; if (n && n.type === 'PLAYLIST') { n.items = []; inPlaylist = n; } }
    else if (name === 'ENTRY' && inPlaylist) plEntry = true;
    else if (name === 'PRIMARYKEY' && inPlaylist && plEntry && a.KEY) {
      const known = collection[a.KEY];
      if (known) inPlaylist.items.push({ path: known.path, artist: known.artist, title: known.title });
      else { const p = nmlPath(a.KEY); const h = splitHint(stripExt(baseName(p))); inPlaylist.items.push({ path: p, artist: h.artist, title: h.title }); }
    }
  }, (name) => {
    if (name === 'COLLECTION') inCollection = false;
    else if (name === 'ENTRY') { if (inCollection) entry = null; else plEntry = false; }
    else if (name === 'PLAYLIST') inPlaylist = null;
    else if (name === 'NODE') {
      const n = nodes.pop();
      if (n && n.type === 'PLAYLIST' && n.items) out.push({ name: n.name || 'Playlist', items: n.items, kind: 'user' });
    }
  });
  return out;
}

// ---- plain playlist files ----------------------------------------------------------------------------------------------------------

/** .m3u / .m3u8: one path to a line, with an #EXTINF line before it giving "Artist - Title". Streams are left out. */
export function parseM3u(text, fileName) {
  const items = [];
  let hint = null;
  for (let raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) { const c = line.indexOf(','); hint = c >= 0 ? line.slice(c + 1).trim() : null; continue; }
    if (line.startsWith('#') || /^https?:\/\//i.test(line)) continue;
    const h = splitHint(hint);
    items.push({ path: /^file:/i.test(line) ? fileUrlToPath(line) : line, artist: h.artist, title: h.title });
    hint = null;
  }
  return [{ name: stripExt(baseName(fileName || 'Playlist')) || 'Playlist', items: items, kind: 'user' }];
}

/** .pls: File1=..., Title1=... */
export function parsePls(text, fileName) {
  const files = {}, titles = {};
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    let m;
    if ((m = /^File(\d+)=(.*)$/i.exec(raw.trim()))) files[m[1]] = m[2];
    else if ((m = /^Title(\d+)=(.*)$/i.exec(raw.trim()))) titles[m[1]] = m[2];
  }
  const items = Object.keys(files).sort((a, b) => a - b).filter(k => !/^https?:\/\//i.test(files[k])).map(k => {
    const h = splitHint(titles[k] || '');
    return { path: /^file:/i.test(files[k]) ? fileUrlToPath(files[k]) : files[k], artist: h.artist, title: h.title };
  });
  return [{ name: stripExt(baseName(fileName || 'Playlist')) || 'Playlist', items: items, kind: 'user' }];
}

/** An iTunes "export playlist as text" file: tab-separated, with a header row (Name, Artist, ..., Location). */
export function parseTabbed(text, fileName) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.length);
  if (lines.length === 0) return [];
  const head = lines[0].split('\t').map(h => h.trim().toLowerCase());
  const iName = head.indexOf('name'), iArtist = head.indexOf('artist'), iLoc = head.indexOf('location');
  const items = [];
  for (const l of lines.slice(1)) {
    const c = l.split('\t');
    let p = iLoc >= 0 ? (c[iLoc] || '').trim() : '';
    if (!p) continue;
    if (p.indexOf('/') < 0 && p.indexOf('\\') < 0 && (p.match(/:/g) || []).length >= 2) p = p.replace(/:/g, '/');   // a Mac path: Macintosh HD:Users:me:a.mp3
    items.push({ path: p, artist: iArtist >= 0 ? (c[iArtist] || '').trim() : '', title: iName >= 0 ? (c[iName] || '').trim() : '' });
  }
  return [{ name: stripExt(baseName(fileName || 'Playlist')) || 'Playlist', items: items, kind: 'user' }];
}

/** Reads a playlist file of any of those kinds: the list of playlists in it ([{ name, items, kind }]); empty if it was none of them. */
export function readPlaylistFile(text, fileName) {
  const ext = (/\.([A-Za-z0-9]+)$/.exec(fileName || '') || [])[1] || '';
  const e = ext.toLowerCase();
  const isNml = /<NML[\s>]/.test(text.slice(0, 2000)), isPlist = /<plist[\s>]/.test(text.slice(0, 2000));
  if (isNml || e === 'nml') return parseTraktor(text);
  if (isPlist || e === 'xml') return parseITunes(text);
  if (e === 'pls' || /^\s*\[playlist\]/i.test(text.slice(0, 200))) return parsePls(text, fileName);
  if (e === 'txt' || e === 'tsv') return parseTabbed(text, fileName);
  return parseM3u(text, fileName);
}

// ---- matching a playlist to the files in the folder --------------------------------------------------------------------------------

const slash = p => p.replace(/\\/g, '/').toLowerCase();
/** A file name without its extension, lower-cased and with everything but letters and digits dropped: "01 - Daft Punk - One More Time" -> a key. */
const stemKey = n => stripExt(n).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Something that finds the local file an item means. `entries` are the files in the folder, each with a `path` (use '/' or '\\') and a `name`.
 * An item matches when the end of its path is the end of a local path (the longest such end wins, so it works even though the playlist was
 * written on another machine, or with the music somewhere else); failing that, when "artist title" or just the title is the name of exactly
 * one local file.
 */
export function makeResolver(entries) {
  const bySuffix = new Map();   // "a/b/c.mp3", "b/c.mp3", "c.mp3" (up to 6 parts) -> the entries that end that way
  const byStem = new Map();     // the name's stem key -> the entries
  for (const e of entries) {
    const parts = slash(e.path).split('/');
    for (let n = 1; n <= Math.min(6, parts.length); n++) {
      const k = parts.slice(-n).join('/');
      const l = bySuffix.get(k);
      if (l) l.push(e); else bySuffix.set(k, [e]);
    }
    const sk = stemKey(e.name || baseName(e.path));
    const l = byStem.get(sk);
    if (l) l.push(e); else byStem.set(sk, [e]);
  }
  return {
    resolve(item) {
      if (item.path) {
        const parts = slash(item.path).split('/').filter(Boolean);
        for (let n = Math.min(6, parts.length); n >= 1; n--) {
          const l = bySuffix.get(parts.slice(-n).join('/'));
          if (!l) continue;
          if (n >= 2 || l.length === 1) return l[0];   // (a bare file name is only trusted when only one local file has it)
        }
      }
      for (const k of [stemKey((item.artist || '') + (item.title || '')), stemKey(item.title || '')]) {
        if (!k) continue;
        const l = byStem.get(k);
        if (l && l.length === 1) return l[0];
      }
      return null;
    },
  };
}

/** The local files for a playlist's items, in the playlist's order (an item with no local file is left out), and how many were not found. */
export function resolvePlaylist(playlist, resolver) {
  const found = [], at = [];   // at[i]: which item of the playlist found[i] came from
  let missing = 0;
  for (let i = 0; i < playlist.items.length; i++) {
    const e = resolver.resolve(playlist.items[i]);
    if (e) { found.push(e); at.push(i); } else missing++;
  }
  return { found: found, at: at, missing: missing };
}

/** The places in a playlist of the items that have no local file. */
export function missingIndexes(playlist, resolver) {
  const out = [];
  playlist.items.forEach((it, i) => { if (!resolver.resolve(it)) out.push(i); });
  return out;
}

/** `name`, or `name (2)`, `name (3)`... so that it is not one of `taken`. */
export function uniqueName(taken, name) {
  const lower = new Set(taken.map(n => n.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) { const n = name + ' (' + i + ')'; if (!lower.has(n.toLowerCase())) return n; }
}

/** What is kept of an item (the end of its path is all that matching needs, and a playlist of thousands should stay small). */
export function itemFor(entry) { return { path: entry.path, artist: '', title: '' }; }
export function trimItem(it) { return { path: it.path.replace(/\\/g, '/').split('/').slice(-6).join('/'), artist: it.artist || '', title: it.title || '' }; }
