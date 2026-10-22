// Reads the artist out of an audio file's own tags: ID3 (v2.2, v2.3, v2.4 and v1) for .mp3 / .aac, and the MP4 "©ART" / "aART" items for .m4a. Only the
// pieces of the file that are needed are read (a tag can hold several megabytes of cover art, and a folder can hold thousands of files). A port of
// src\AudioTags.cs.

/** A window onto a File that reads in chunks, so walking a tag frame by frame does not make a read per frame. */
class Reader {
  constructor(file) { this.file = file; this.size = file.size; this.start = 0; this.bytes = new Uint8Array(0); }
  /** `len` bytes at `off` (fewer at the end of the file). */
  async get(off, len) {
    if (off < 0 || off >= this.size) return new Uint8Array(0);
    const end = Math.min(this.size, off + len);
    if (off < this.start || end > this.start + this.bytes.length) {
      const want = Math.min(this.size, off + Math.max(len, 8192));
      this.bytes = new Uint8Array(await this.file.slice(off, want).arrayBuffer());
      this.start = off;
    }
    return this.bytes.subarray(off - this.start, end - this.start);
  }
}

const latin1 = (b, s, e) => { let r = ''; for (let i = s; i < e; i++) r += String.fromCharCode(b[i]); return r; };
const syncsafe = (b, o) => ((b[o] & 0x7F) << 21) | ((b[o + 1] & 0x7F) << 14) | ((b[o + 2] & 0x7F) << 7) | (b[o + 3] & 0x7F);
const be32 = (b, o) => ((b[o] * 16777216) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3]);
const clean = s => { if (s == null) return null; s = s.replace(/\0/g, ' ').trim(); return s.length ? s : null; };

/** An ID3 text frame's content: an encoding byte, then the text (several values are separated by nulls: they are joined with a comma). */
function decodeId3Text(b) {
  if (b.length < 2) return null;
  const enc = b[0];
  let s;
  if (enc === 1) {
    const be = b.length >= 3 && b[1] === 0xFE && b[2] === 0xFF;
    const start = b.length >= 3 && (b[1] === 0xFF || b[1] === 0xFE) ? 3 : 1;
    s = new TextDecoder(be ? 'utf-16be' : 'utf-16le').decode(b.subarray(start));
  } else if (enc === 2) s = new TextDecoder('utf-16be').decode(b.subarray(1));
  else if (enc === 3) s = new TextDecoder('utf-8').decode(b.subarray(1));
  else s = new TextDecoder('iso-8859-1').decode(b.subarray(1));
  return s.split('\0').filter(Boolean).join(', ');
}

async function id3Artist(file) {
  const r = new Reader(file);
  const head = await r.get(0, 10);
  if (head.length === 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
    const ver = head[3];
    const end = 10 + syncsafe(head, 6);
    let pos = 10;
    if ((head[5] & 0x40) && ver >= 3) {
      const eh = await r.get(10, 4);
      if (eh.length === 4) pos += ver === 4 ? syncsafe(eh, 0) : be32(eh, 0) + 4;
    }
    const idLen = ver === 2 ? 3 : 4, hdrLen = ver === 2 ? 6 : 10;
    let artist = null, albumArtist = null;
    while (pos + hdrLen <= end) {
      const fh = await r.get(pos, hdrLen);
      if (fh.length < hdrLen || fh[0] === 0) break;
      const id = latin1(fh, 0, idLen);
      const size = ver === 2 ? (fh[3] << 16) | (fh[4] << 8) | fh[5] : ver === 4 ? syncsafe(fh, 4) : be32(fh, 4);
      if (size <= 0 || pos + hdrLen + size > end) break;
      const lead = id === 'TPE1' || id === 'TP1', album = id === 'TPE2' || id === 'TP2';
      if (lead || album) {
        const text = decodeId3Text(await r.get(pos + hdrLen, Math.min(size, 2048)));
        if (lead) { artist = text; break; }
        albumArtist = text;
      }
      pos += hdrLen + size;
    }
    return artist || albumArtist;
  }
  if (file.size >= 128) {   // ID3v1: the last 128 bytes
    const v1 = new Uint8Array(await file.slice(file.size - 128).arrayBuffer());
    if (v1[0] === 0x54 && v1[1] === 0x41 && v1[2] === 0x47) return latin1(v1, 33, 63);
  }
  return null;
}

function findBox(b, start, end, type) {
  let p = start;
  while (p + 8 <= end) {
    const size = be32(b, p);
    if (size < 8 || p + size > end) return null;
    if (latin1(b, p + 4, p + 8) === type) return { start: p + 8, end: p + size };
    p += size;
  }
  return null;
}

function artistFromMoov(b) {
  let x = findBox(b, 0, b.length, 'udta'); if (!x) return null;
  x = findBox(b, x.start, x.end, 'meta'); if (!x) return null;
  x = findBox(b, x.start + 4, x.end, 'ilst'); if (!x) return null;   // (meta is a "full" box: a version and flags come before its children)
  let artist = null, albumArtist = null;
  let p = x.start;
  while (p + 8 <= x.end) {
    const size = be32(b, p);
    if (size < 8 || p + size > x.end) break;
    const type = latin1(b, p + 4, p + 8);
    if (type === '©ART' || type === 'aART') {
      const d = findBox(b, p + 8, p + size, 'data');
      if (d && d.end - d.start > 8) {
        const text = new TextDecoder('utf-8').decode(b.subarray(d.start + 8, d.end));
        if (type === 'aART') albumArtist = text; else artist = text;
      }
    }
    p += size;
  }
  return artist || albumArtist;
}

async function mp4Artist(file) {
  const r = new Reader(file);
  let pos = 0;
  while (pos + 8 <= file.size) {
    const h = await r.get(pos, 16);
    if (h.length < 8) break;
    let size = be32(h, 0), hdr = 8;
    const type = latin1(h, 4, 8);
    if (size === 1 && h.length >= 16) { size = be32(h, 8) * 4294967296 + be32(h, 12); hdr = 16; }
    else if (size === 0) size = file.size - pos;
    if (size < hdr) break;
    if (type === 'moov') {
      if (size - hdr > 16 * 1024 * 1024) return null;
      return artistFromMoov(new Uint8Array(await file.slice(pos + hdr, pos + size).arrayBuffer()));
    }
    pos += size;
  }
  return null;
}

/** The artist from a File's tags, or null when it has none (or its format is not one with tags we read). */
export async function readArtist(file, name) {
  try {
    const ext = (/\.([^.]+)$/.exec(name || file.name) || [])[1] || '';
    const e = ext.toLowerCase();
    if (e === 'mp3' || e === 'aac') return clean(await id3Artist(file));
    if (e === 'm4a') return clean(await mp4Artist(file));
  } catch (err) { /* unreadable: no artist */ }
  return null;
}

/** A guess from the file name: "Artist - Title", or "01 - Artist - Title" (leading track numbers are skipped). Null when it has no such shape. */
export function artistFromFileName(stem) {
  const parts = stem.split(' - ');
  let i = 0;
  while (i < parts.length - 1 && /^\d{1,3}\.?$/.test(parts[i].trim())) i++;
  if (parts.length - i < 2) return null;
  return clean(parts[i].trim().replace(/^\d{1,3}[.)]\s+/, ''));   // ("07. Someone" is Someone)
}
