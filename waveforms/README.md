# Waveform data

Precomputed amplitude-over-time data for the gallery's "visualize to music"
warp effect (see `openVisualizer()` in `gallery.js`). Generated entirely
offline, ahead of time -- never in the browser, never by reading Bandcamp's
stream. The raw audio file is never hosted or committed; only the derived
numbers (a normalized loudness curve) are published here.

Only build this from a copy of the track you legitimately own (e.g. a
Bandcamp purchase download) -- never by scraping or bypassing Bandcamp's
stream protection, same principle as everywhere else in this project.

## Format

```json
{
  "step": 0.05,          // seconds between samples
  "duration": 214,       // seconds, last sample's timestamp
  "floorDb": -50,        // RMS dB mapped to amplitude 0
  "ceilDb": -5,          // RMS dB mapped to amplitude 1
  "amplitude": [0.43, 0.43, ...]   // one value per `step`, 0-1
}
```

`floorDb`/`ceilDb` are fixed conventions (not this track's own min/max,
which gets skewed by near-silent outliers like a track's cold open or
fade-out) -- keep them the same for every track so the numbers stay
comparable and future code doesn't need to special-case a lower- or
higher-level track.

## Generating one (requires ffmpeg)

```bash
ffmpeg -i "track.mp3" -ac 1 -ar 22050 \
  -af "asetnsamples=n=2205,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=rms.txt" \
  -f null -
```

This produced ~0.05s between samples in practice (not the 0.1s a naive
2205-samples-at-22050Hz calculation suggests -- don't assume the math
checks out). Read the actual step from consecutive `pts_time` values in
`rms.txt` and use that in the JSON's `step` field, rather than trusting
whatever `n` you passed in.

Then parse `rms.txt` (alternating `frame:N pts:N pts_time:T` /
`lavfi.astats.Overall.RMS_level=X` line pairs), map each dB value through
`clamp((db - floorDb) / (ceilDb - floorDb), 0, 1)` (treating `-inf`/`nan`
as silence, i.e. 0), and write out the JSON shape above.

## Wiring a track up

Add a `waveform: "waveforms/your-file.json"` field to that track's entry
in `PLAYLIST` in `music-player.js`. Tracks without one (`waveform: null`)
fall back to a BPM-timed pulse in the visualizer instead.
