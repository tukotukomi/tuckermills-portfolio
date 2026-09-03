(function () {
  // Each entry is one collection's masonry grid. Images aren't
  // auto-discovered from the folder -- this is a static site with no
  // build step, so the browser can't list a folder's contents on its own.
  // To add a photo to a collection: drop the file into its folder below,
  // then add its filename to the images array here.
  const GALLERIES = {
    "gallery-wildflowers-grid": {
      folder: "Images/Photography/Collections/macro/",
      images: [
        "macro-01.jpg",
        "macro-02.jpg",
        "macro-03.jpg",
        "macro-04.jpg",
        "macro-05.jpg",
        "macro-06.jpg",
        "macro-07.jpg",
        "macro-08.jpg",
        "macro-09.jpg",
        "macro-10.jpg",
        "IMG_20180721_162815.jpg",
      ],
    },
    "gallery-china-bw-grid": {
      folder: "Images/Photography/Collections/china-bw/",
      images: [
        "nav-image-1.jpg",
        "1.jpg",
        "2.jpg",
        "5.jpg",
        "6.jpg",
        "8.jpg",
        "8 (2).jpg",
        "8 (3).jpg",
        "9.jpg",
        "12.jpg",
        "21.jpg",
        "23.jpg",
      ],
    },
    "gallery-china-travels-bw-grid": {
      folder: "Images/Photography/Collections/china-travels-bw/",
      images: [
        "banner-3.jpg",
        "000022.jpg",
        "000024.jpg",
        "000025.jpg",
        "000032.jpg",
        "000042.jpg",
        "000043.jpg",
        "000046.jpg",
      ],
    },
    "gallery-color-travels-grid": {
      folder: "Images/Photography/Collections/color-travels/",
      images: [
        "banner-2.jpg",
        "000293960002.jpg",
        "000293960030.jpg",
        "000294510012.jpg",
      ],
    },
  };

  const BREAKPOINTS = [
    { minWidth: 900, columns: 4 },
    { minWidth: 600, columns: 3 },
    { minWidth: 0, columns: 2 },
  ];

  function columnCountFor(width) {
    const match = BREAKPOINTS.find((b) => width >= b.minWidth);
    return match ? match.columns : 2;
  }

  function preload(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ src, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // A single shared full-screen viewer, reused across every gallery on the
  // page (there's only one right now, but this doesn't assume that) --
  // built once, on first use, and just re-pointed at whichever collection's
  // image list + index was clicked.
  let lightboxEl = null;
  let lightboxImgEl = null;
  let lightboxItems = [];
  let lightboxIndex = 0;

  function buildLightbox() {
    const el = document.createElement("div");
    el.className = "lightbox";
    el.innerHTML =
      '<button type="button" class="lightbox-close" aria-label="Close">&times;</button>' +
      '<button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous photo">&lsaquo;</button>' +
      '<button type="button" class="lightbox-nav lightbox-next" aria-label="Next photo">&rsaquo;</button>' +
      '<img class="lightbox-img" alt="">' +
      '<div class="lightbox-actions">' +
      '<button type="button" class="lightbox-visualize" aria-label="Visualize to music">' +
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M852-212 732-332l56-56 120 120-56 56ZM708-692l-56-56 120-120 56 56-120 120Zm-456 0L132-812l56-56 120 120-56 56ZM108-212l-56-56 120-120 56 56-120 120Zm246-75 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-361Z"/></svg>' +
      "</button>" +
      '<button type="button" class="lightbox-fractal" aria-label="Mandelbrot zoom">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px" fill="#e3e3e3" fill-rule="evenodd"><path d="M12 3 L21 20 L3 20 Z M7.5 11.5 L16.5 11.5 L12 20 Z"/></svg>' +
      "</button>" +
      "</div>";
    document.body.appendChild(el);

    el.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    el.querySelector(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
    el.querySelector(".lightbox-next").addEventListener("click", () => stepLightbox(1));
    el.querySelector(".lightbox-visualize").addEventListener("click", openVisualizer);
    el.querySelector(".lightbox-fractal").addEventListener("click", openFractal);
    // .lightbox-img is sized to fit its content (max-width/height, not a
    // full-bleed wrapper), so any click that isn't on the image or the
    // buttons lands directly on this backdrop element -- clicking anywhere
    // outside the photo closes it.
    el.addEventListener("click", (e) => {
      if (e.target === el) closeLightbox();
    });

    return el;
  }

  // "Visualize to music": a fullscreen, cover-fit view of the current
  // photo, warped in time with the music. There's no way to read the
  // actual audio playing in Bandcamp's cross-origin iframe -- no exposed
  // API, and Web Audio can't analyze a media element outside its own
  // document -- so where a track has a precomputed waveform (see
  // PLAYLIST.waveform in music-player.js, generated offline from a
  // legitimately owned copy), the warp intensity is driven by that
  // track's real amplitude-over-time data; tracks without one fall back
  // to a beat pulse timed to the hand-noted BPM. Either way this is
  // driven from elapsed time since the visualizer opened, not the
  // visitor's actual position in the track -- Bandcamp exposes no
  // playback-position readout either, so there's no way to know where
  // they actually are. The warp itself is a native SVG filter
  // (feTurbulence + feDisplacementMap), animated by rewriting its scale
  // each frame -- no canvas, no libraries.
  let visualizerEl = null;
  let visualizerImgEl = null;
  let visualizerDisplacementEl = null;
  let visualizerTurbulenceEl = null;
  let visualizerRAF = null;
  const waveformCache = {};
  // How long one "descend into finer fractal detail, then reset" cycle
  // takes -- independent of and layered on top of the audio-driven pulse
  // above, so the two rhythms don't lock to each other.
  const FRACTAL_CYCLE_MS = 10000;

  function loadWaveform(url) {
    if (!url) return null;
    if (!(url in waveformCache)) {
      waveformCache[url] = null; // marks "fetch in flight" so we don't refetch
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          waveformCache[url] = data;
        })
        .catch(() => {
          delete waveformCache[url];
        });
    }
    return waveformCache[url] || null;
  }

  // Optional real-time alternative to the waveform/BPM pulse below --
  // opt-in only, via a checkbox in the fractal's settings panel (see
  // buildFractal), since it needs microphone permission. Deliberately
  // NOT persisted to fractalSettings/localStorage: this always starts
  // back at "off" on every fresh open of the fractal view, never a
  // silent re-prompt. A visitor with a loopback/virtual-cable input
  // device selected (Stereo Mix, VB-Cable, BlackHole, etc.) can feed
  // their actual system/Bandcamp playback audio in this way -- the
  // browser has no way to tell "real microphone" apart from "virtual
  // cable pretending to be one," so this works with headphones plugged
  // in without ever touching Bandcamp's stream directly. Wired into
  // computePulse itself (below) rather than duplicated per-visualizer,
  // so both the fractal and the noise-warp visualizer benefit.
  let liveAudioContext = null;
  let liveAudioAnalyser = null;
  let liveAudioDataArray = null;
  let liveAudioStream = null;

  function readLiveAudioPulse() {
    if (!liveAudioAnalyser) return null;
    liveAudioAnalyser.getByteFrequencyData(liveAudioDataArray);
    let sum = 0;
    for (let i = 0; i < liveAudioDataArray.length; i++) sum += liveAudioDataArray[i];
    return sum / liveAudioDataArray.length / 255;
  }

  function stopLiveAudioStream() {
    if (liveAudioStream) liveAudioStream.getTracks().forEach((t) => t.stop());
    liveAudioStream = null;
  }

  // Only tears down the *previous* stream once the new one is confirmed
  // working (stream is fetched before stopLiveAudioStream runs) -- so a
  // failed device switch (unplugged/removed device) leaves whatever was
  // already working untouched instead of going silent.
  async function enableLiveAudio(deviceId, onDisconnect) {
    const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    stopLiveAudioStream();
    if (!liveAudioContext) liveAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (liveAudioContext.state === "suspended") await liveAudioContext.resume();
    const source = liveAudioContext.createMediaStreamSource(stream);
    const analyser = liveAudioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    liveAudioStream = stream;
    liveAudioAnalyser = analyser;
    liveAudioDataArray = new Uint8Array(analyser.frequencyBinCount);
    stream.getAudioTracks()[0].addEventListener("ended", () => {
      // Device unplugged/removed mid-session -- only react if a newer
      // enableLiveAudio call hasn't already replaced this stream.
      if (liveAudioStream !== stream) return;
      liveAudioAnalyser = null;
      liveAudioDataArray = null;
      liveAudioStream = null;
      if (onDisconnect) onDisconnect();
    });
    return stream;
  }

  function disableLiveAudio() {
    stopLiveAudioStream();
    liveAudioAnalyser = null;
    liveAudioDataArray = null;
  }

  // Shared by both visualizers: a single 0-1 "how loud/energetic right
  // now" value -- live microphone/loopback input when the visitor has
  // opted in (readLiveAudioPulse above), otherwise the track's real
  // waveform where one's available (see loadWaveform above), or a
  // BPM-timed pulse as the last resort. Elapsed time since the
  // visualizer opened, not the visitor's actual position in the track --
  // see the file-level comment above openVisualizer.
  function computePulse(elapsedSec, waveformUrl, player) {
    const live = readLiveAudioPulse();
    if (live !== null) return live;
    const waveform = waveformUrl && loadWaveform(waveformUrl);
    if (waveform) {
      const index = Math.floor((elapsedSec % waveform.duration) / waveform.step);
      const value = waveform.amplitude[Math.min(index, waveform.amplitude.length - 1)];
      // Guards against ever feeding a bad value (a malformed/truncated
      // waveform, an out-of-range index) into a CSS/SVG attribute
      // downstream, which -- unlike a plain JS NaN -- the browser logs
      // as a console error rather than silently coercing.
      if (typeof value === "number" && !Number.isNaN(value)) return value;
    }
    const bpm = (player && player.getCurrentBPM()) || 120;
    const beatPhase = (elapsedSec % (60 / bpm)) / (60 / bpm);
    // Squared sine: a sharper rise-and-fall per beat than a plain sine,
    // reading more like a pulse than a slow wobble.
    return Math.sin(beatPhase * Math.PI) ** 2;
  }

  function buildVisualizer() {
    const el = document.createElement("div");
    el.className = "image-visualizer";
    el.innerHTML =
      '<svg width="0" height="0" style="position:absolute">' +
      '<filter id="visualizer-warp" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="turb"></feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="turb" scale="0" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>' +
      "</filter>" +
      "</svg>" +
      '<img class="image-visualizer-img" alt="">' +
      '<button type="button" class="image-visualizer-close" aria-label="Close visualizer">&times;</button>';
    document.body.appendChild(el);
    el.querySelector(".image-visualizer-close").addEventListener("click", closeVisualizer);
    return el;
  }

  function isVisualizerOpen() {
    return !!visualizerEl && visualizerEl.classList.contains("is-open");
  }

  function openVisualizer() {
    if (!visualizerEl) {
      visualizerEl = buildVisualizer();
      visualizerImgEl = visualizerEl.querySelector(".image-visualizer-img");
      visualizerDisplacementEl = visualizerEl.querySelector("feDisplacementMap");
      visualizerTurbulenceEl = visualizerEl.querySelector("feTurbulence");
    }
    visualizerImgEl.src = lightboxItems[lightboxIndex].src;
    visualizerEl.classList.add("is-open");
    if (visualizerEl.requestFullscreen) visualizerEl.requestFullscreen().catch(() => {});

    const player = window.tuckerMillsMusicPlayer;
    const waveformUrl = player && player.getCurrentWaveformUrl();
    if (waveformUrl) loadWaveform(waveformUrl); // kick off the fetch now, before frame() first needs it

    // Re-seeded on open and on every cycle reset below, so the noise
    // pattern -- and so the exact shape of the warp -- differs each time,
    // per the "randomized each time" ask.
    function reseed() {
      visualizerTurbulenceEl.setAttribute("seed", String(Math.floor(Math.random() * 1000)));
    }
    reseed();
    let lastCyclePhase = 0;

    const startTime = performance.now();
    function frame(now) {
      if (!isVisualizerOpen()) return;
      const elapsedSec = (now - startTime) / 1000;

      // "Descend into fractal detail": baseFrequency and numOctaves both
      // climb across the cycle, packing in progressively finer, more
      // layered noise -- feTurbulence's own fractal octaves are what
      // make this read as "deeper" rather than just "busier" -- then
      // snap back to a shallow start and reseed for the next descent.
      const cyclePhase = (((now - startTime) % FRACTAL_CYCLE_MS) / FRACTAL_CYCLE_MS);
      if (cyclePhase < lastCyclePhase) reseed();
      lastCyclePhase = cyclePhase;
      const freq = 0.006 + cyclePhase * 0.034;
      visualizerTurbulenceEl.setAttribute("baseFrequency", `${freq.toFixed(4)} ${(freq * 1.5).toFixed(4)}`);
      visualizerTurbulenceEl.setAttribute("numOctaves", String(1 + Math.floor(cyclePhase * 4)));

      const pulse = computePulse(elapsedSec, waveformUrl, player);

      visualizerDisplacementEl.setAttribute("scale", (pulse * 45).toFixed(1));
      visualizerImgEl.style.transform = `scale(${(1 + pulse * 0.06).toFixed(3)})`;
      visualizerImgEl.style.filter =
        `url(#visualizer-warp) hue-rotate(${((elapsedSec * 12) % 360).toFixed(1)}deg) brightness(${(1 + pulse * 0.15).toFixed(3)})`;
      visualizerRAF = requestAnimationFrame(frame);
    }
    visualizerRAF = requestAnimationFrame(frame);
  }

  function closeVisualizer() {
    if (!isVisualizerOpen()) return;
    visualizerEl.classList.remove("is-open");
    cancelAnimationFrame(visualizerRAF);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  // Covers the case where the visitor exits fullscreen through the
  // browser's own UI/shortcut rather than the close button here.
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && isVisualizerOpen()) closeVisualizer();
    if (!document.fullscreenElement && isFractalOpen()) closeFractal();
  });

  // "Mandelbrot zoom": a fullscreen WebGL view of the current photo as a
  // Julia set (z = z^2 + c, fixed c, z0 = pixel position -- a Mandelbrot
  // is the same formula with c = pixel position instead, but a fixed c
  // is what lets that c be driven by the photo, see below). No canvas
  // library, no 3rd-party WebGL helper -- a small hand-written shader.
  //
  // "Closely informed by the source image": the photo is a texture the
  // shader samples using the *iterated* coordinate (not the screen
  // coordinate), so the rendered colors are the photo's own colors,
  // warped through the fractal's math rather than a generic palette. And
  // literally injected into the formula, per the ask: every few seconds,
  // a fresh pixel is sampled from the photo (via an offscreen 2D canvas,
  // read once into a plain array -- cheap, no repeated getImageData
  // calls) and mapped to a new Julia constant c, smoothly interpolated
  // into. Each injection also resets the zoom, so one "dive" = one fresh
  // sample of the photo.
  const MANDELBROT_CYCLE_MS = 6000;

  // Per-visitor settings. ogMode is read by both dive styles; every
  // other key here only affects Smooth mode (see frame() below) -- OG
  // Fractal stays deaf to all of them by design, so it keeps
  // reproducing the exact original behavior no matter how these are
  // tuned.
  const FRACTAL_DEFAULTS = {
    ogMode: false,
    // Neither of these existed in the fractal at all before this
    // panel -- computePulse was only ever wired into the noise-warp
    // visualizer, and growth's iteration-budget machinery was removed
    // in an earlier revert and never came back. Off/0 is the accurate
    // "current behavior" default for both, not a guess.
    musicReactivityPct: 0,
    growthEnabled: false,
    // 7x is the proven-safe ceiling this whole mode is built around
    // (see the "Smooth mode" comment above injectFromImage below) --
    // same default as what's hardcoded today, just now adjustable.
    zoomDepth: 7,
    cycleDurationSec: 20,
    // 2 is the classic z^2+c shape everything else here was tuned
    // around -- replaces the per-open weighted-random roll a previous
    // version used to fight repetitive shapes; this slider is direct
    // manual control instead, see its wiring in buildFractal below.
    fractalPower: 2,
    // 30%, not 100% ("current behavior") -- once detail got a real
    // saturation/vividness boost (boostDetail in FRAGMENT_SHADER), the
    // background started reading noticeably brighter/more saturated by
    // contrast next to it, even though its own color never changed.
    // Lowered again from an initial 60% after user feedback that 60%
    // still read "much too bright and overly saturated" vs. the source
    // photo -- 30% is a real fix baked into the default, not a neutral
    // starting point; the slider still runs 0-150% either direction.
    bgSaturationPct: 30,
  };
  const FRACTAL_SETTINGS_KEY = "tuckerMillsFractalSettings";

  function loadFractalSettings() {
    try {
      const raw = localStorage.getItem(FRACTAL_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return Object.assign({}, FRACTAL_DEFAULTS, parsed);
    } catch (e) {
      return Object.assign({}, FRACTAL_DEFAULTS);
    }
  }

  function saveFractalSettings(settings) {
    try {
      localStorage.setItem(FRACTAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // Private browsing / storage disabled -- settings just won't
      // persist across visits, nothing else depends on this succeeding.
    }
  }

  const VERTEX_SHADER = "attribute vec2 aPos;\n" + "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }\n";
  const FRAGMENT_SHADER =
    "precision highp float;\n" +
    "uniform vec2 uResolution;\n" +
    "uniform float uZoom;\n" +
    "uniform vec2 uC;\n" +
    "uniform vec2 uCenter;\n" +
    "uniform vec3 uBaseColor;\n" +
    "uniform sampler2D uImage;\n" +
    "uniform float uMaxIter;\n" +
    "uniform float uPower;\n" +
    "uniform float uBgSaturation;\n" +
    // Standard compact GLSL RGB<->HSV pair, used by boostDetail below to
    // boost only the photo-sampled "detail" color (texColor, both
    // branches), and separately to scale uBaseColor's own saturation via
    // the "Background saturation" slider (see the mix below) -- the two
    // never share one adjustment, so a background tweak and a detail
    // tweak stay independent levers instead of one blunt post-process.
    // Texture sampling loses real
    // vividness vs. the source photo two ways: LINEAR filtering blends
    // across neighboring pixels of very different color (the z-driven UV
    // jumps chaotically frame to frame, so "neighboring" here isn't
    // spatially coherent the way a normal texture map is), and every
    // exterior-branch pixel still has *some* uBaseColor mixed in via t<1
    // even at high iteration counts, both of which dull the actual photo
    // detail that's supposed to be showing through.
    "vec3 rgb2hsv(vec3 c) {\n" +
    "  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);\n" +
    "  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\n" +
    "  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\n" +
    "  float d = q.x - min(q.w, q.y);\n" +
    "  float e = 1.0e-10;\n" +
    "  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);\n" +
    "}\n" +
    "vec3 hsv2rgb(vec3 c) {\n" +
    "  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);\n" +
    "  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n" +
    "  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n" +
    "}\n" +
    "vec3 boostDetail(vec3 c) {\n" +
    "  vec3 hsv = rgb2hsv(c);\n" +
    "  hsv.y = clamp(hsv.y * 2.6, 0.0, 1.0);\n" +
    "  hsv.z = clamp(hsv.z * 1.4, 0.0, 1.0);\n" +
    "  return hsv2rgb(hsv);\n" +
    "}\n" +
    // Complex z^power via repeated multiplication (no atan2/log, so no
    // branch-cut seam artifact) rather than a fixed square -- driven by
    // the "Fractal shape" slider (fractalPower in buildFractal below) so
    // 2/3/4/5/6-fold rotational symmetry is a direct, live-adjustable
    // choice instead of just a different c on the same z^2+c shape every
    // time. Loop bound is a compile-time constant (uPower itself is a
    // runtime float, same pattern as uMaxIter above) capped at power=6 --
    // juliaIterations in JS must stay in lockstep, since scoring
    // validates candidates against this exact formula.
    "vec2 cplxPow(vec2 z, float power) {\n" +
    "  vec2 r = z;\n" +
    "  for (int k = 1; k < 6; k++) {\n" +
    "    if (float(k) >= power) break;\n" +
    "    r = vec2(r.x * z.x - r.y * z.y, r.x * z.y + r.y * z.x);\n" +
    "  }\n" +
    "  return r;\n" +
    "}\n" +
    "void main() {\n" +
    "  vec2 uv = gl_FragCoord.xy / uResolution;\n" +
    "  vec2 p = uv - 0.5;\n" +
    "  p.x *= uResolution.x / uResolution.y;\n" +
    "  vec2 z = p / uZoom + uCenter;\n" +
    "  float iter = 0.0;\n" +
    "  for (int i = 0; i < 150; i++) {\n" +
    "    if (float(i) >= uMaxIter) break;\n" +
    "    if (dot(z, z) > 4.0) break;\n" +
    "    z = cplxPow(z, uPower) + uC;\n" +
    "    iter += 1.0;\n" +
    "  }\n" +
    "  if (iter >= uMaxIter) {\n" +
    "    vec3 texColor = boostDetail(texture2D(uImage, fract(z * 0.5 + 0.5)).rgb);\n" +
    "    gl_FragColor = vec4(texColor, 1.0);\n" +
    "  } else {\n" +
    // A steeper curve than sqrt (which is pow(x, 0.5)) -- iter/uMaxIter
    // reaching even a moderate fraction now pushes t close to 1 quickly,
    // so pixels with real boundary detail nearby (moderate iteration
    // counts, not just ones right at the brink of uMaxIter) read as
    // close to pure texColor instead of a wash that's still 30-50%
    // uBaseColor. That baseColor bleed was diluting the *detail* itself,
    // not just the flat background regions boostDetail above was never
    // meant to touch -- this is the fix for that, boostDetail alone
    // couldn't compensate for dilution happening after it runs.
    "    float t = pow(iter / uMaxIter, 0.3);\n" +
    "    vec3 texColor = boostDetail(texture2D(uImage, fract(z * 0.2 + 0.5)).rgb);\n" +
    // uBaseColor itself stays exactly the photo-average value set once
    // in openFractal -- this only scales its *saturation* (hue/value
    // untouched), live-adjustable via the "Background saturation"
    // slider, independent from boostDetail's own fixed detail-color
    // boost above. Needed once detail got noticeably more vivid: the
    // background reads *relatively* brighter/more saturated next to it
    // now than it used to, even though uBaseColor's own value never
    // changed -- a contrast effect, not a bug in either boost.
    "    vec3 bgHsv = rgb2hsv(uBaseColor);\n" +
    "    bgHsv.y = clamp(bgHsv.y * uBgSaturation, 0.0, 1.0);\n" +
    "    vec3 bgColor = hsv2rgb(bgHsv);\n" +
    "    gl_FragColor = mix(vec4(bgColor, 1.0), vec4(texColor, 1.0), t);\n" +
    "  }\n" +
    "}\n";

  let fractalEl = null;
  let fractalCanvasEl = null;
  let fractalGl = null;
  let fractalUniforms = null;
  let fractalTexture = null;
  let fractalRAF = null;
  let fractalSamplePixel = null; // (u, v) -> {r, g, b}, built once per photo
  let fractalSettings = null; // loaded/mutated live by the settings panel
  // The active openFractal() closure's own injectFromImage, so the
  // settings panel (built once in buildFractal, reused across opens) can
  // trigger an immediate re-score/re-injection when a setting that
  // changes the fractal's actual shape (the "Fractal shape" power
  // slider) is dragged -- otherwise the currently-displayed c/center,
  // scored and chosen for the *previous* power, could read as flat under
  // the new one until the next naturally-scheduled cycle wrap. Null
  // whenever the fractal view is closed, see closeFractal.
  let activeReinject = null;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Fractal shader failed to compile: " + info);
    }
    return shader;
  }

  function buildFractal() {
    const el = document.createElement("div");
    el.className = "image-fractal";
    el.innerHTML =
      '<canvas class="image-fractal-canvas"></canvas>' +
      '<button type="button" class="image-fractal-close" aria-label="Close fractal view">&times;</button>' +
      '<button type="button" class="image-fractal-settings-toggle" aria-label="Fractal settings">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22px" height="22px" fill="none" ' +
      'stroke="#e3e3e3" stroke-width="2" stroke-linecap="round">' +
      '<line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="#e3e3e3" stroke="none"/>' +
      '<line x1="4" y1="12" x2="20" y2="12"/><circle cx="16" cy="12" r="2" fill="#e3e3e3" stroke="none"/>' +
      '<line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="#e3e3e3" stroke="none"/>' +
      "</svg>" +
      "</button>" +
      '<div class="fractal-controls">' +
      '<div class="fractal-controls-row"><label>Music reactivity <span class="fractal-controls-value" data-value-for="musicReactivityPct"></span></label>' +
      '<input type="range" data-setting="musicReactivityPct" min="0" max="100" step="5"></div>' +
      '<div class="fractal-controls-row fractal-controls-toggle-row">' +
      '<label><input type="checkbox" data-toggle="liveAudio"> Live audio input</label>' +
      "</div>" +
      '<div class="fractal-controls-row fractal-controls-audio-device" hidden>' +
      '<label>Input device</label>' +
      '<select class="fractal-controls-select" data-audio-device></select>' +
      '<p class="fractal-controls-audio-status" data-audio-status></p>' +
      "</div>" +
      '<div class="fractal-controls-row"><label>Fractal shape <span class="fractal-controls-value" data-value-for="fractalPower"></span></label>' +
      '<input type="range" data-setting="fractalPower" min="2" max="6" step="1"></div>' +
      '<div class="fractal-controls-row"><label>Background saturation <span class="fractal-controls-value" data-value-for="bgSaturationPct"></span></label>' +
      '<input type="range" data-setting="bgSaturationPct" min="0" max="150" step="5"></div>' +
      '<div class="fractal-controls-row"><label>Zoom depth <span class="fractal-controls-value" data-value-for="zoomDepth"></span></label>' +
      '<input type="range" data-setting="zoomDepth" min="1" max="15" step="0.5"></div>' +
      '<div class="fractal-controls-row"><label>Cycle duration <span class="fractal-controls-value" data-value-for="cycleDurationSec"></span></label>' +
      '<input type="range" data-setting="cycleDurationSec" min="6" max="60" step="1"></div>' +
      '<div class="fractal-controls-row fractal-controls-toggle-row">' +
      '<label><input type="checkbox" data-toggle="growthEnabled"> Fractal growth</label>' +
      "</div>" +
      '<div class="fractal-controls-row fractal-controls-toggle-row">' +
      '<label><input type="checkbox" data-toggle="ogMode"> OG Fractal</label>' +
      "</div>" +
      "</div>";
    document.body.appendChild(el);

    fractalSettings = loadFractalSettings();
    const toggleBtn = el.querySelector(".image-fractal-settings-toggle");
    const panel = el.querySelector(".fractal-controls");
    toggleBtn.addEventListener("click", () => panel.classList.toggle("is-open"));

    // Sliders that OG Fractal deliberately ignores (see its own branch
    // in frame() below) -- ogMode always reproduces the original
    // behavior verbatim regardless of what these are set to.
    const FRACTAL_CONTROL_FORMATS = {
      musicReactivityPct: (v) => v + "%",
      fractalPower: (v) => v + "-fold",
      bgSaturationPct: (v) => v + "%",
      zoomDepth: (v) => v + "x",
      cycleDurationSec: (v) => v + "s",
    };
    Object.keys(FRACTAL_CONTROL_FORMATS).forEach((key) => {
      const input = panel.querySelector('[data-setting="' + key + '"]');
      const valueEl = panel.querySelector('[data-value-for="' + key + '"]');
      input.value = fractalSettings[key];
      valueEl.textContent = FRACTAL_CONTROL_FORMATS[key](fractalSettings[key]);
      input.addEventListener("input", () => {
        fractalSettings[key] = Number(input.value);
        valueEl.textContent = FRACTAL_CONTROL_FORMATS[key](fractalSettings[key]);
        saveFractalSettings(fractalSettings);
      });
    });

    // Unlike the other sliders, changing shape changes what the
    // currently-displayed c/center actually looks like -- they were
    // scored/chosen for the *previous* power, and the same point can
    // read as flat under a different one. A short, snappy re-injection
    // (not the full cycle-length blend an ordinary wrap uses) makes the
    // slider feel directly responsive instead of leaving a stale/
    // possibly-flat view on screen until the next scheduled cycle wrap.
    panel.querySelector('[data-setting="fractalPower"]').addEventListener("input", () => {
      if (activeReinject) activeReinject(performance.now(), 1200);
    });

    ["growthEnabled", "ogMode"].forEach((key) => {
      const toggle = panel.querySelector('[data-toggle="' + key + '"]');
      toggle.checked = fractalSettings[key];
      toggle.addEventListener("change", (e) => {
        fractalSettings[key] = e.target.checked;
        saveFractalSettings(fractalSettings);
      });
    });

    // Live audio input: deliberately kept out of fractalSettings/
    // localStorage (see the comment above enableLiveAudio) -- always
    // starts unchecked here, wired up manually rather than through the
    // generic toggle loop above.
    const liveAudioToggle = panel.querySelector('[data-toggle="liveAudio"]');
    const audioDeviceRow = panel.querySelector(".fractal-controls-audio-device");
    const audioDeviceSelect = panel.querySelector("[data-audio-device]");
    const audioStatusEl = panel.querySelector("[data-audio-status]");

    function populateAudioDeviceOptions() {
      return navigator.mediaDevices.enumerateDevices().then((devices) => {
        audioDeviceSelect.textContent = "";
        devices
          .filter((d) => d.kind === "audioinput")
          .forEach((d, i) => {
            const opt = document.createElement("option");
            opt.value = d.deviceId;
            opt.textContent = d.label || "Microphone " + (i + 1);
            audioDeviceSelect.appendChild(opt);
          });
        // enableLiveAudio(null) (the checkbox's first-ever grant) picks
        // whatever the browser considers its default device, which isn't
        // necessarily this list's first entry -- read back which track
        // actually got used and select that option to match.
        if (liveAudioStream) {
          const track = liveAudioStream.getAudioTracks()[0];
          const settings = track && track.getSettings && track.getSettings();
          if (settings && settings.deviceId) audioDeviceSelect.value = settings.deviceId;
        }
      });
    }

    function handleAudioDisconnect() {
      liveAudioToggle.checked = false;
      audioDeviceRow.hidden = true;
      audioStatusEl.textContent = "Input device disconnected.";
    }

    const audioSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (!audioSupported) {
      liveAudioToggle.disabled = true;
    } else {
      liveAudioToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          audioDeviceRow.hidden = false;
          audioStatusEl.textContent = "Requesting microphone access…";
          enableLiveAudio(audioDeviceSelect.value || null, handleAudioDisconnect)
            .then(populateAudioDeviceOptions)
            .then(() => {
              const label = audioDeviceSelect.selectedOptions[0];
              audioStatusEl.textContent = "Listening" + (label ? " on " + label.textContent : "") + ".";
            })
            .catch(() => {
              disableLiveAudio();
              liveAudioToggle.checked = false;
              audioDeviceRow.hidden = true;
              audioStatusEl.textContent = "Microphone access denied or unavailable.";
            });
        } else {
          disableLiveAudio();
          audioDeviceRow.hidden = true;
          audioStatusEl.textContent = "";
        }
      });

      audioDeviceSelect.addEventListener("change", () => {
        if (!liveAudioToggle.checked) return;
        audioStatusEl.textContent = "Switching input…";
        enableLiveAudio(audioDeviceSelect.value, handleAudioDisconnect)
          .then(() => {
            audioStatusEl.textContent = "Listening on " + audioDeviceSelect.selectedOptions[0].textContent + ".";
          })
          .catch(() => {
            audioStatusEl.textContent = "Couldn't switch to that device.";
          });
      });
    }

    el.querySelector(".image-fractal-close").addEventListener("click", closeFractal);

    const canvas = el.querySelector(".image-fractal-canvas");
    const glOptions = { preserveDrawingBuffer: true };
    const gl = canvas.getContext("webgl", glOptions) || canvas.getContext("experimental-webgl", glOptions);
    let uniforms = null;
    if (gl) {
      const program = gl.createProgram();
      gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
      gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error("Fractal shader program failed to link: " + gl.getProgramInfoLog(program));
      }
      gl.useProgram(program);

      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      uniforms = {
        resolution: gl.getUniformLocation(program, "uResolution"),
        zoom: gl.getUniformLocation(program, "uZoom"),
        c: gl.getUniformLocation(program, "uC"),
        center: gl.getUniformLocation(program, "uCenter"),
        baseColor: gl.getUniformLocation(program, "uBaseColor"),
        image: gl.getUniformLocation(program, "uImage"),
        maxIter: gl.getUniformLocation(program, "uMaxIter"),
        power: gl.getUniformLocation(program, "uPower"),
        bgSaturation: gl.getUniformLocation(program, "uBgSaturation"),
      };

      fractalTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fractalTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    fractalGl = gl;
    fractalUniforms = uniforms;
    return el;
  }

  // A tiny offscreen copy of the photo, read into a plain pixel array
  // once, so repeated random sampling (every cycle) is just array math --
  // no repeated canvas readbacks. Also computes the photo's own average
  // color (sampler.average) in the same pass, for the "escaped" region's
  // base color -- see buildFractal()'s FRAGMENT_SHADER comment.
  function buildPixelSampler(imgEl) {
    const size = 48;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    ctx.drawImage(imgEl, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    let rSum = 0, gSum = 0, bSum = 0;
    const pixelCount = size * size;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }

    const sampler = function (u, v) {
      const x = Math.min(size - 1, Math.max(0, Math.floor(u * size)));
      const y = Math.min(size - 1, Math.max(0, Math.floor(v * size)));
      const i = (y * size + x) * 4;
      return { r: data[i] / 255, g: data[i + 1] / 255, b: data[i + 2] / 255 };
    };
    sampler.average = { r: rSum / pixelCount / 255, g: gSum / pixelCount / 255, b: bSum / pixelCount / 255 };
    return sampler;
  }

  function isFractalOpen() {
    return !!fractalEl && fractalEl.classList.contains("is-open");
  }

  // Cheap CPU-side echo of the shader's own iteration math, used only to
  // score candidate (c, center) pairs before committing to one (see
  // injectFromImage below) -- a handful of these per injection, every
  // few seconds, is trivial compared to doing it per-pixel on the GPU
  // every frame. power must match whatever uPower the shader is actually
  // rendering with (fractalSettings.fractalPower, or 2 for OG Fractal --
  // see frame()) -- scoring against the wrong exponent's shape would
  // validate candidates for a fractal that isn't the one on screen.
  function juliaIterations(zx, zy, cx, cy, maxIter, power) {
    let iter = 0;
    while (iter < maxIter) {
      if (zx * zx + zy * zy > 4) break;
      let rx = zx, ry = zy;
      for (let k = 1; k < power; k++) {
        const nrx = rx * zx - ry * zy;
        const nry = rx * zy + ry * zx;
        rx = nrx;
        ry = nry;
      }
      zx = rx + cx;
      zy = ry + cy;
      iter++;
    }
    return iter;
  }

  // How much escape-time varies across a small grid of sample points
  // around (centerX, centerY) -- near 0 means the whole area is one flat
  // region (all escaping immediately, or none escaping at all); higher
  // means real boundary detail is nearby. Checked at several zoom levels
  // spanning the full range either mode's zoom formula can reach (OG
  // Fractal always 1->7; Smooth mode's zoom depth is now adjustable up
  // to 15x), scored on the worst of them -- a candidate that's only
  // detailed at one zoom can still open (or drift) into an empty field
  // of color at another, which single-zoom scoring couldn't catch.
  const SCORE_ZOOMS = [1, 2, 3.5, 5.5, 8, 11, 15];
  // zooms defaults to the full validated range above; the flatness
  // watchdog in frame() instead passes a single-element array (whatever
  // zoom is actually on screen right now) for a much cheaper live check.
  // aspectRatio must match the shader's own uResolution.x/uResolution.y
  // (see FRAGMENT_SHADER's "p.x *= uResolution.x / uResolution.y") --
  // without it this grid is square regardless of the actual viewport, so
  // on any wide monitor the real rendered frame extends well past what
  // was ever validated, and the unchecked left/right edges are exactly
  // where an "empty space" complaint on a widescreen would come from.
  function scoreJuliaView(cx, cy, centerX, centerY, power, zooms, aspectRatio) {
    const GRID = 6;
    const checkZooms = zooms || SCORE_ZOOMS;
    const aspect = aspectRatio || 1;
    let worst = Infinity;
    for (let z = 0; z < checkZooms.length; z++) {
      const sampleZoom = checkZooms[z];
      let minIter = Infinity;
      let maxIter = -Infinity;
      for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
          const px = ((i / (GRID - 1) - 0.5) * aspect) / sampleZoom + centerX;
          const py = (j / (GRID - 1) - 0.5) / sampleZoom + centerY;
          const it = juliaIterations(px, py, cx, cy, 60, power);
          if (it < minIter) minIter = it;
          if (it > maxIter) maxIter = it;
        }
      }
      worst = Math.min(worst, maxIter - minIter);
    }
    return worst;
  }

  function openFractal() {
    if (!fractalEl) fractalEl = buildFractal();
    fractalCanvasEl = fractalEl.querySelector(".image-fractal-canvas");
    fractalEl.classList.add("is-open");
    if (fractalEl.requestFullscreen) fractalEl.requestFullscreen().catch(() => {});

    if (!fractalGl) {
      // WebGL unavailable (very old/restricted browser) -- nothing to
      // render; leave the close button reachable rather than a blank
      // frozen screen.
      return;
    }

    const gl = fractalGl;
    const player = window.tuckerMillsMusicPlayer;
    const waveformUrl = player && player.getCurrentWaveformUrl();
    if (waveformUrl) loadWaveform(waveformUrl); // kick off the fetch now, before frame() first needs it
    const sourceImg = lightboxImgEl;
    fractalSamplePixel = buildPixelSampler(sourceImg);
    gl.bindTexture(gl.TEXTURE_2D, fractalTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceImg);
    // The escaped region's base color (mixed with the photo near the
    // boundary) was previously a fixed purple, unrelated to whatever
    // photo was loaded -- now it's the photo's own average color,
    // darkened to keep some depth/contrast rather than a flat wash.
    // *0.4 (the original value) crushed this to under half the photo's
    // brightness and read as too dark; *0.7 (a later fix) overcorrected
    // once detail got its own saturation/brightness boost, reading as
    // "much too bright and overly saturated" by contrast -- *0.55 is a
    // middle point between those two complaints. Also compensated via
    // the live "Background saturation" slider (bgSaturationPct, applied
    // in FRAGMENT_SHADER, not here) for saturation specifically -- this
    // multiplier is the value/brightness half of that same balance.
    const avg = fractalSamplePixel.average;
    gl.uniform3f(fractalUniforms.baseColor, avg.r * 0.55, avg.g * 0.55, avg.b * 0.55);

    let cCurrent = { x: 0.3, y: 0.4 };
    let cTarget = { x: 0.3, y: 0.4 };
    let cFrom = { x: 0.3, y: 0.4 };
    let centerCurrent = { x: 0.15, y: 0.2 };
    let centerTarget = { x: 0.15, y: 0.2 };
    let centerFrom = { x: 0.15, y: 0.2 };
    let injectStart = 0;
    // Spans almost the whole cycle (not a short blend that then sits
    // frozen while only zoom keeps changing) so c/center are always
    // drifting, never static -- covering the same distance over ~3.6x
    // longer also reads as a slower, gentler drift rather than a snap.
    const INJECT_BLEND_MS = MANDELBROT_CYCLE_MS * 0.9;
    let injectBlendMs = INJECT_BLEND_MS;

    // "Smooth" mode: defaults to the same proven zoom ceiling as OG
    // Fractal (7x, now adjustable via the zoom depth slider) -- going
    // much deeper is what broke the earlier settings-panel attempt,
    // since the photo-derived c-value heuristic stops reliably finding
    // real detail well before 150x+ ever needed to worry about it --
    // but stretched across an adjustable, longer-than-OG cycle for
    // slower exploration, and the transition to a new photo-derived
    // subject is a zoom-out-and-back-in "morph" spanning the *whole*
    // cycle (see frame() below) rather than a hard reset back to
    // zoom=1: radial motion, matching how a fractal viewer naturally
    // moves, rather than the lateral pan a plain c/center drift
    // produces while still zoomed in. c/center are always blending
    // toward the target across the same span, so the fractal itself
    // keeps morphing continuously -- the moment it stops changing is
    // exactly when it starts reading as "frozen" rather than "alive."

    function injectFromImage(now, blendMs) {
      // Most (c, center) combinations give a "boring" view -- either
      // everything escapes immediately or nothing does, both flat --
      // regardless of which shell/heuristic picked them. Rather than
      // accept whatever the first random pixel gives, sample candidate
      // pixels and keep whichever actually shows escape-time variance
      // nearby (scoreJuliaView above), i.e. real boundary detail to zoom
      // into. Still entirely image-derived, just the best of several
      // tries instead of the first one -- and instead of a fixed small
      // batch, keeps trying (up to a cap) until one clears a "not flat"
      // bar, so a genuinely empty field of color takes a run of bad luck
      // across dozens of attempts to slip through, not just six.
      // Raised from 10: sampling actual gallery photos showed most random
      // candidates score 0 (completely flat) and only a small tail finds
      // real detail -- 10 let the loop settle for the first candidate to
      // barely clear a low bar instead of continuing toward one of the
      // richer candidates most photos do reach within the attempt budget.
      const MIN_SCORE = 20;
      const MAX_ATTEMPTS = 40;
      // OG Fractal always scores/renders at power 2, ignoring the
      // "Fractal shape" slider -- matches its own "exact original
      // behavior" invariant, same as every other Smooth-mode-only
      // setting.
      const scoringPower = fractalSettings.ogMode ? 2 : fractalSettings.fractalPower;
      // Widescreen/ultrawide monitors render a much wider horizontal
      // slice of the complex plane than a square viewport would (see
      // scoreJuliaView's own comment) -- read fresh each injection
      // rather than cached, since a visitor can resize the window
      // between cycles.
      const aspectRatio = window.innerWidth / window.innerHeight;
      let best = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const px = fractalSamplePixel(Math.random(), Math.random());
        // The pixel's hue angle (from R/G) picks a direction in the
        // complex plane; a shell of radius ~0.65-0.9 (nudged by
        // brightness) tends to land nearer the Mandelbrot set's own
        // boundary than a uniform random point would.
        const angle = Math.atan2(px.g - 0.5, px.r - 0.5);
        const radius = 0.65 + px.b * 0.25;
        const c = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
        // Zooming in on a fixed point (e.g. the origin) often lands on a
        // featureless stretch for an arbitrary c -- the richest boundary
        // detail tends to cluster near the value of c itself (c is the
        // orbit of the critical point z=0 after one step), so the zoom
        // target rides along with c instead of staying put.
        const center = { x: c.x * 0.5, y: c.y * 0.5 };
        const score = scoreJuliaView(c.x, c.y, center.x, center.y, scoringPower, null, aspectRatio);
        if (!best || score > best.score) best = { c, center, score };
        if (best.score >= MIN_SCORE) break;
      }
      cFrom = cCurrent;
      cTarget = best.c;
      centerFrom = centerCurrent;
      centerTarget = best.center;
      injectStart = now;
      injectBlendMs = blendMs || INJECT_BLEND_MS;
    }
    activeReinject = injectFromImage;

    const startTime = performance.now();
    injectFromImage(startTime);
    // The hardcoded {0.3, 0.4} default above isn't photo-derived or
    // scored -- it's just a starting point for cFrom/centerFrom to blend
    // away from. Blending the first cycle away from it wasted the
    // opening seconds on that unvalidated view instead of the one
    // scoring just picked, which is exactly the "empty field of color"
    // this scoring pass is meant to avoid. Only the very first cycle
    // needs this snap; every later injectFromImage call blends from
    // wherever the view already is, which is always itself a scored,
    // detailed position.
    cCurrent = cTarget;
    centerCurrent = centerTarget;
    cFrom = cTarget;
    centerFrom = centerTarget;
    let lastCyclePhase = 0;
    // Flatness watchdog state (Smooth mode only) -- see its check in
    // frame() below for why this exists alongside MIN_SCORE-validated
    // injection rather than instead of it.
    let flatSince = null;
    let lastFlatCheck = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fractalCanvasEl.width = window.innerWidth * dpr;
      fractalCanvasEl.height = window.innerHeight * dpr;
      gl.viewport(0, 0, fractalCanvasEl.width, fractalCanvasEl.height);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame(now) {
      if (!isFractalOpen()) {
        window.removeEventListener("resize", resize);
        return;
      }
      let zoom;
      let maxIter = 120;
      if (fractalSettings.ogMode) {
        // Exactly the original behavior: one 6s cycle, zoom climbs
        // 1 -> 7 across the whole thing, then wraps straight back --
        // preserved verbatim as a selectable option, deaf to every
        // slider below (they all live on fractalSettings, but nothing
        // in this branch reads them).
        const cyclePhase = ((now - startTime) % MANDELBROT_CYCLE_MS) / MANDELBROT_CYCLE_MS;
        if (cyclePhase < lastCyclePhase) injectFromImage(now);
        lastCyclePhase = cyclePhase;
        zoom = 1 + Math.pow(cyclePhase, 1.5) * 6;
      } else {
        // No static "hold" at the ceiling -- that's exactly what froze
        // for ~15s of every 20s cycle (zoom pinned at 7 *and* no
        // injection running, since the previous version only injected
        // while entering/leaving a brief dip at the seam). The whole
        // cycle is the morph now: zoom eases from 1 up to the depth
        // setting and back down to 1, symmetric around the wrap
        // (cyclePhase 0 == 1, so there's still no jump at the seam),
        // and c/center blend continuously across nearly the entire
        // cycle -- one injection per cycle, same principle as OG
        // Fractal's own "blend spans (almost) the whole cycle so
        // nothing ever sits still," just stretched across an
        // adjustable cycle length and a symmetric zoom shape instead
        // of a hard reset.
        const cycleDurationMs = fractalSettings.cycleDurationSec * 1000;
        const elapsedSec = (now - startTime) / 1000;
        const pulse = computePulse(elapsedSec, waveformUrl, player);

        const cyclePhase = ((now - startTime) % cycleDurationMs) / cycleDurationMs;
        if (cyclePhase < lastCyclePhase) injectFromImage(now, cycleDurationMs * 0.98);
        lastCyclePhase = cyclePhase;

        const distFromWrap = Math.min(cyclePhase, 1 - cyclePhase); // 0 at the wrap, 0.5 at the cycle's midpoint (peak zoom)
        const morphPhase = distFromWrap * 2; // 0 at the wrap, 1 at the midpoint
        // 1.5 is the same fixed exponent OG Fractal itself uses --
        // reactivity=0 (the default, matching "this didn't exist
        // before") leaves it exactly there; higher reactivity lets the
        // music pulse wobble it, speeding up/easing off how eagerly
        // the dive accelerates.
        const diveExponent = 1.5 + pulse * (fractalSettings.musicReactivityPct / 100) * 0.6;
        zoom = 1 + Math.pow(morphPhase, diveExponent) * (fractalSettings.zoomDepth - 1);

        if (fractalSettings.growthEnabled) maxIter = 100 + pulse * 50;
      }
      // Read live every frame (not captured once) so dragging the
      // "Fractal shape" slider takes effect immediately -- OG Fractal
      // always renders (and, via scoringPower in injectFromImage, always
      // scores candidates) at power 2, matching its own verbatim
      // invariant.
      const power = fractalSettings.ogMode ? 2 : fractalSettings.fractalPower;
      // 1.0 for OG Fractal (its own original, unadjusted background) --
      // same verbatim-invariant pattern as power above.
      const bgSaturation = fractalSettings.ogMode ? 1.0 : fractalSettings.bgSaturationPct / 100;

      const blend = Math.min(1, (now - injectStart) / injectBlendMs);
      cCurrent = { x: cFrom.x + (cTarget.x - cFrom.x) * blend, y: cFrom.y + (cTarget.y - cFrom.y) * blend };
      centerCurrent = {
        x: centerFrom.x + (centerTarget.x - centerFrom.x) * blend,
        y: centerFrom.y + (centerTarget.y - centerFrom.y) * blend,
      };

      // Flatness watchdog (Smooth mode only -- OG Fractal is untouched,
      // per its verbatim invariant): a candidate is validated only *at
      // the target* injectFromImage picked -- the straight-line blend
      // path between two individually-good c/center values isn't itself
      // validated, and complex parameter space isn't convex, so that
      // path can still cut through flat/boring territory even between
      // two good endpoints. A better-scored target (MIN_SCORE above)
      // doesn't help while still mid-blend toward it. Checked
      // periodically (not every frame -- real cost) against whatever's
      // actually on screen right now, at the current zoom; if it reads
      // flat for too long, forces an early re-injection instead of
      // waiting out the rest of the scheduled cycle -- this is what
      // actually bounds how long a flat/flashing stretch can last. The
      // blend itself is deliberately slow (WATCHDOG_REINJECT_BLEND_MS,
      // separate from the power slider's own snappy 1200ms reinject --
      // that one wants immediate feedback for a manual drag, this one
      // wants to read as the fractal continuing to melt into its next
      // subject rather than visibly snapping/resetting).
      if (!fractalSettings.ogMode) {
        if (now - lastFlatCheck > 500) {
          lastFlatCheck = now;
          const liveScore = scoreJuliaView(cCurrent.x, cCurrent.y, centerCurrent.x, centerCurrent.y, power, [zoom], window.innerWidth / window.innerHeight);
          if (liveScore < 15) {
            if (flatSince === null) flatSince = now;
            else if (now - flatSince > 2500) {
              const WATCHDOG_REINJECT_BLEND_MS = 5000;
              injectFromImage(now, WATCHDOG_REINJECT_BLEND_MS);
              flatSince = null;
            }
          } else {
            flatSince = null;
          }
        }
      }

      gl.uniform2f(fractalUniforms.resolution, fractalCanvasEl.width, fractalCanvasEl.height);
      gl.uniform1f(fractalUniforms.zoom, zoom);
      gl.uniform2f(fractalUniforms.c, cCurrent.x, cCurrent.y);
      gl.uniform2f(fractalUniforms.center, centerCurrent.x, centerCurrent.y);
      gl.uniform1f(fractalUniforms.maxIter, maxIter);
      gl.uniform1f(fractalUniforms.power, power);
      gl.uniform1f(fractalUniforms.bgSaturation, bgSaturation);
      gl.uniform1i(fractalUniforms.image, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fractalTexture);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      fractalRAF = requestAnimationFrame(frame);
    }
    fractalRAF = requestAnimationFrame(frame);
  }

  function closeFractal() {
    if (!isFractalOpen()) return;
    fractalEl.classList.remove("is-open");
    cancelAnimationFrame(fractalRAF);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    activeReinject = null;
    // Stop capturing the moment the view closes -- no stray mic indicator
    // lingering after the visitor leaves, and the panel (reused verbatim
    // on the next open, see buildFractal) shouldn't show "on" for a
    // stream that no longer exists.
    disableLiveAudio();
    const liveAudioToggle = fractalEl.querySelector('[data-toggle="liveAudio"]');
    if (liveAudioToggle) liveAudioToggle.checked = false;
    const audioDeviceRow = fractalEl.querySelector(".fractal-controls-audio-device");
    if (audioDeviceRow) audioDeviceRow.hidden = true;
    const audioStatusEl = fractalEl.querySelector("[data-audio-status]");
    if (audioStatusEl) audioStatusEl.textContent = "";
  }

  function isLightboxOpen() {
    return !!lightboxEl && lightboxEl.classList.contains("is-open");
  }

  function updateLightboxImage() {
    const item = lightboxItems[lightboxIndex];
    lightboxImgEl.src = item.src;
    const multiple = lightboxItems.length > 1;
    lightboxEl.querySelector(".lightbox-prev").hidden = !multiple;
    lightboxEl.querySelector(".lightbox-next").hidden = !multiple;
  }

  function openLightbox(items, index) {
    if (!lightboxEl) {
      lightboxEl = buildLightbox();
      lightboxImgEl = lightboxEl.querySelector(".lightbox-img");
    }
    lightboxItems = items;
    lightboxIndex = index;
    updateLightboxImage();
    lightboxEl.classList.add("is-open");
    document.body.classList.add("lightbox-open");
  }

  function closeLightbox() {
    if (!isLightboxOpen()) return;
    closeVisualizer();
    closeFractal();
    lightboxEl.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
  }

  function stepLightbox(dir) {
    if (lightboxItems.length < 2) return;
    lightboxIndex = (lightboxIndex + dir + lightboxItems.length) % lightboxItems.length;
    updateLightboxImage();
  }

  document.addEventListener("keydown", (e) => {
    if (!isLightboxOpen()) return;
    // Escape backs out one layer at a time -- out of the fractal view or
    // visualizer first if either is open, then out of the lightbox
    // itself on a following press.
    if (e.key === "Escape") {
      if (isFractalOpen()) closeFractal();
      else if (isVisualizerOpen()) closeVisualizer();
      else closeLightbox();
    } else if (isFractalOpen() || isVisualizerOpen()) {
      // no-op: arrow keys don't navigate while either overlay is open
    } else if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "ArrowRight") stepLightbox(1);
  });

  // Swipe left/right to step through photos on touch devices.
  let touchStartX = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      if (!isLightboxOpen()) return;
      touchStartX = e.touches[0].clientX;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (!isLightboxOpen() || touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) > 40) stepLightbox(dx > 0 ? -1 : 1);
    },
    { passive: true }
  );

  async function renderGallery(grid, config) {
    const loaded = (await Promise.all(config.images.map((name) => preload(config.folder + name)))).filter(Boolean);
    if (!loaded.length) return;

    // All columns share the same width, so an image's height/width ratio
    // alone is enough to compare how much column-height it'll take up --
    // the actual column pixel width cancels out and doesn't need measuring.
    function layout() {
      const columnCount = columnCountFor(grid.getBoundingClientRect().width);
      grid.innerHTML = "";
      const columns = [];
      for (let i = 0; i < columnCount; i++) {
        const col = document.createElement("div");
        col.className = "gallery-column";
        grid.appendChild(col);
        columns.push({ el: col, height: 0 });
      }
      loaded.forEach((item, index) => {
        const shortest = columns.reduce((a, b) => (b.height < a.height ? b : a));
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "gallery-item";
        btn.dataset.index = String(index);
        btn.addEventListener("click", () => openLightbox(loaded, index));
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = "";
        img.loading = "lazy";
        btn.appendChild(img);
        shortest.el.appendChild(btn);
        shortest.height += item.height / item.width;
      });
      grid.classList.add("is-loaded");
    }

    layout();

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 150);
    });
  }

  document.querySelectorAll(".gallery-grid[id]").forEach((grid) => {
    const config = GALLERIES[grid.id];
    if (config) renderGallery(grid, config);
  });
})();
