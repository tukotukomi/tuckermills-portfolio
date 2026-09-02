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

  // Shared by both visualizers: a single 0-1 "how loud/energetic right
  // now" value, from the track's real waveform where one's available
  // (see loadWaveform above), or a BPM-timed pulse otherwise. Elapsed
  // time since the visualizer opened, not the visitor's actual position
  // in the track -- see the file-level comment above openVisualizer.
  function computePulse(elapsedSec, waveformUrl, player) {
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
  // literally injected into the formula, per the ask: a fresh pixel is
  // sampled from the photo (via an offscreen 2D canvas, read once into a
  // plain array -- cheap, no repeated getImageData calls) and mapped to
  // a new Julia constant c, smoothly interpolated into. Rather than one
  // dive = one fresh sample, the view now dives continuously deeper
  // across a much longer arc (see FRACTAL_DEFAULTS.diveDurationSec
  // below) and re-samples the photo periodically *at whatever depth it's
  // currently at*, without resetting zoom -- new structure keeps
  // surfacing without the view ever visually retreating, until the arc's
  // own scheduled (and smooth) retreat back to the start. See
  // openFractal() for the full state machine, and buildFractalControls()
  // for the public settings panel that exposes these as live sliders.
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
    "void main() {\n" +
    "  vec2 uv = gl_FragCoord.xy / uResolution;\n" +
    "  vec2 p = uv - 0.5;\n" +
    "  p.x *= uResolution.x / uResolution.y;\n" +
    "  vec2 z = p / uZoom + uCenter;\n" +
    "  float iter = 0.0;\n" +
    "  for (int i = 0; i < 150; i++) {\n" +
    "    if (float(i) >= uMaxIter) break;\n" +
    "    if (dot(z, z) > 4.0) break;\n" +
    "    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uC;\n" +
    "    iter += 1.0;\n" +
    "  }\n" +
    "  if (iter >= uMaxIter) {\n" +
    "    gl_FragColor = texture2D(uImage, fract(z * 0.5 + 0.5));\n" +
    "  } else {\n" +
    "    float t = sqrt(iter / uMaxIter);\n" +
    "    vec4 texColor = texture2D(uImage, fract(z * 0.2 + 0.5));\n" +
    "    gl_FragColor = mix(vec4(uBaseColor, 1.0), texColor, t);\n" +
    "  }\n" +
    "}\n";

  // Public, per-visitor tunable settings for the fractal visualizer,
  // exposed via the settings panel built in buildFractalControls() and
  // persisted in localStorage -- a pure per-viewer convenience, so every
  // read/write is defensive and just falls back to defaults on failure.
  const FRACTAL_DEFAULTS = {
    diveDurationSec: 45,
    // The random shell-heuristic c-value picker (see injectFromImage
    // below) reliably finds boundary detail that stays rich up to
    // roughly 400-600x -- past that it's increasingly likely to have
    // zoomed past whatever local complexity that particular c actually
    // has, into a smooth/flat stretch, regardless of how well the
    // candidate scored at injection time. True "infinite" deep zoom
    // needs a much more deliberate c-search than a random heuristic can
    // give (real deep-zoom fractal tools use iterative refinement, well
    // beyond scope here) -- so the range stays bounded to where this
    // heuristic is reliable rather than promising a depth it can't back
    // up. Confirmed by direct comparison in the browser: 100-400 stayed
    // consistently rich, 600 started showing visible grain, 800 was a
    // flat, featureless field.
    maxDepth: 150,
    reinjectIntervalSec: 6,
    musicReactivityPct: 50,
    resetStyle: "smooth", // "smooth" | "sawtooth"
    growthEnabled: false,
    zoomBumpEnabled: false,
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

  let fractalEl = null;
  let fractalCanvasEl = null;
  let fractalGl = null;
  let fractalUniforms = null;
  let fractalTexture = null;
  let fractalRAF = null;
  let fractalSamplePixel = null; // (u, v) -> {r, g, b}, built once per photo
  let fractalSettings = null; // loaded/mutated live by buildFractalControls()

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

  // Every range control's slider value maps directly to its settings
  // key (no separate 0-1/percent conversions to juggle in the UI layer)
  // -- keyed here once and reused for both populating and formatting.
  const FRACTAL_CONTROL_FORMATS = {
    diveDurationSec: (v) => v + "s",
    maxDepth: (v) => v + "x",
    reinjectIntervalSec: (v) => v + "s",
    musicReactivityPct: (v) => v + "%",
  };

  function buildFractalControls(el, settings) {
    const toggleBtn = el.querySelector(".image-fractal-settings-toggle");
    const panel = el.querySelector(".fractal-controls");
    toggleBtn.addEventListener("click", () => panel.classList.toggle("is-open"));

    function refreshInputs() {
      Object.keys(FRACTAL_CONTROL_FORMATS).forEach((key) => {
        const input = panel.querySelector('[data-setting="' + key + '"]');
        const valueEl = panel.querySelector('[data-value-for="' + key + '"]');
        input.value = settings[key];
        valueEl.textContent = FRACTAL_CONTROL_FORMATS[key](settings[key]);
      });
      panel.querySelector('[data-select="resetStyle"]').value = settings.resetStyle;
      panel.querySelector('[data-toggle="growthEnabled"]').checked = settings.growthEnabled;
      panel.querySelector('[data-toggle="zoomBumpEnabled"]').checked = settings.zoomBumpEnabled;
    }
    refreshInputs();

    Object.keys(FRACTAL_CONTROL_FORMATS).forEach((key) => {
      const input = panel.querySelector('[data-setting="' + key + '"]');
      input.addEventListener("input", () => {
        settings[key] = Number(input.value);
        panel.querySelector('[data-value-for="' + key + '"]').textContent = FRACTAL_CONTROL_FORMATS[key](settings[key]);
        saveFractalSettings(settings);
      });
    });

    panel.querySelector('[data-select="resetStyle"]').addEventListener("change", (e) => {
      settings.resetStyle = e.target.value;
      if (settings.resetStyle === "classic") {
        // "Classic" is the exact pre-panel experience, not just this
        // dive-style's curve shape -- snapping duration/depth back to
        // their original values too (6s cycle, 7x zoom ceiling) is
        // what makes this a true one-click restore rather than one
        // more thing to hand-tune. Still adjustable afterward, same as
        // any other setting, for anyone who wants the classic *shape*
        // at a different pace or depth.
        settings.diveDurationSec = 6;
        settings.maxDepth = 7;
        settings.growthEnabled = false;
        settings.zoomBumpEnabled = false;
        refreshInputs();
      }
      saveFractalSettings(settings);
    });
    panel.querySelector('[data-toggle="growthEnabled"]').addEventListener("change", (e) => {
      settings.growthEnabled = e.target.checked;
      saveFractalSettings(settings);
    });
    panel.querySelector('[data-toggle="zoomBumpEnabled"]').addEventListener("change", (e) => {
      settings.zoomBumpEnabled = e.target.checked;
      saveFractalSettings(settings);
    });

    el.querySelector(".fractal-controls-reset").addEventListener("click", () => {
      Object.assign(settings, FRACTAL_DEFAULTS);
      refreshInputs();
      saveFractalSettings(settings);
    });
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
      '<div class="fractal-controls-row"><label>Dive duration <span class="fractal-controls-value" data-value-for="diveDurationSec"></span></label>' +
      '<input type="range" data-setting="diveDurationSec" min="5" max="90" step="1"></div>' +
      '<div class="fractal-controls-row"><label>Max depth <span class="fractal-controls-value" data-value-for="maxDepth"></span></label>' +
      '<input type="range" data-setting="maxDepth" min="5" max="500" step="1"></div>' +
      '<div class="fractal-controls-row"><label>Detail refresh rate <span class="fractal-controls-value" data-value-for="reinjectIntervalSec"></span></label>' +
      '<input type="range" data-setting="reinjectIntervalSec" min="3" max="15" step="1"></div>' +
      '<div class="fractal-controls-row"><label>Music reactivity <span class="fractal-controls-value" data-value-for="musicReactivityPct"></span></label>' +
      '<input type="range" data-setting="musicReactivityPct" min="0" max="100" step="5"></div>' +
      '<div class="fractal-controls-row"><label>Dive style</label>' +
      '<select class="fractal-controls-select" data-select="resetStyle">' +
      '<option value="smooth">Smooth (continuous dive)</option>' +
      '<option value="sawtooth">Sawtooth (hard reset)</option>' +
      '<option value="classic">Classic (original)</option>' +
      "</select></div>" +
      '<div class="fractal-controls-row fractal-controls-toggle-row"><label><input type="checkbox" data-toggle="growthEnabled"> Iteration growth</label></div>' +
      '<div class="fractal-controls-row fractal-controls-toggle-row"><label><input type="checkbox" data-toggle="zoomBumpEnabled"> Zoom bump</label></div>' +
      '<button type="button" class="fractal-controls-reset">Reset to defaults</button>' +
      "</div>";
    document.body.appendChild(el);
    el.querySelector(".image-fractal-close").addEventListener("click", closeFractal);

    fractalSettings = loadFractalSettings();
    buildFractalControls(el, fractalSettings);

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
  // every frame.
  function juliaIterations(zx, zy, cx, cy, maxIter) {
    let iter = 0;
    while (iter < maxIter) {
      if (zx * zx + zy * zy > 4) break;
      const nzx = zx * zx - zy * zy + cx;
      const nzy = 2 * zx * zy + cy;
      zx = nzx;
      zy = nzy;
      iter++;
    }
    return iter;
  }

  // How much escape-time varies across a small grid of sample points
  // around (centerX, centerY) -- near 0 means the whole area is one flat
  // region (all escaping immediately, or none escaping at all); higher
  // means real boundary detail is nearby. Checked at several zoom levels
  // spanning the range the render will actually pass through before the
  // next injection -- scored on the worst of them, since a candidate
  // that's only detailed at one zoom can still open (or drift) into an
  // empty field of color at another. Zoom now climbs continuously and
  // re-injection happens at whatever depth the dive has reached (see
  // openFractal()), so the caller passes in the zoom range to validate
  // rather than a fixed one.
  function scoreJuliaView(cx, cy, centerX, centerY, sampleZooms) {
    const GRID = 6;
    let worst = Infinity;
    for (let z = 0; z < sampleZooms.length; z++) {
      const sampleZoom = sampleZooms[z];
      let minIter = Infinity;
      let maxIter = -Infinity;
      for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
          const px = (i / (GRID - 1) - 0.5) / sampleZoom + centerX;
          const py = (j / (GRID - 1) - 0.5) / sampleZoom + centerY;
          const it = juliaIterations(px, py, cx, cy, 60);
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
    const avg = fractalSamplePixel.average;
    gl.uniform3f(fractalUniforms.baseColor, avg.r * 0.4, avg.g * 0.4, avg.b * 0.4);

    let cCurrent = { x: 0.3, y: 0.4 };
    let cTarget = { x: 0.3, y: 0.4 };
    let cFrom = { x: 0.3, y: 0.4 };
    let centerCurrent = { x: 0.15, y: 0.2 };
    let centerTarget = { x: 0.15, y: 0.2 };
    let centerFrom = { x: 0.15, y: 0.2 };
    let injectStart = 0;
    // How long the current blend spans -- set per-injection (see
    // injectFromImage's blendMs param below), not a fixed constant.
    // Blending quickly and then sitting still for the rest of the
    // interval between injections is exactly the "static for most of
    // the time, only zoom moving" bug fixed earlier this session (by
    // spanning ~90% of the cycle instead of a short fixed blend) --
    // reproduced here at first because this became a fixed 2000ms
    // regardless of mode, which is far shorter than a 6s classic-mode
    // cycle or even a default 6s reinjectIntervalSec in smooth mode.
    // c/center need to keep drifting for nearly the whole interval
    // between injections, whatever that interval currently is, for the
    // fractals to read as continuously melting into each other rather
    // than blend-then-freeze.
    let injectBlendMs = 2000;

    // Most (c, center) combinations give a "boring" view -- either
    // everything escapes immediately or nothing does, both flat --
    // regardless of which shell/heuristic picked them. Rather than
    // accept whatever the first random pixel gives, sample candidate
    // pixels and keep whichever actually shows escape-time variance
    // nearby (scoreJuliaView above) across sampleZooms, i.e. real
    // boundary detail to zoom into over the range this injection will
    // actually be on screen for. snap=true sets cFrom/centerFrom to the
    // new target too, so the blend below immediately reads as "already
    // there" -- used for the very first injection (nothing to blend
    // from yet) and sawtooth mode's instant resets; every other
    // injection blends smoothly from wherever the view currently is,
    // over blendMs (see injectBlendMs above).
    function injectFromImage(now, sampleZooms, snap, blendMs) {
      const MIN_SCORE = 10;
      const MAX_ATTEMPTS = 40;
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
        const score = scoreJuliaView(c.x, c.y, center.x, center.y, sampleZooms);
        if (!best || score > best.score) best = { c, center, score };
        if (best.score >= MIN_SCORE) break;
      }
      cTarget = best.c;
      centerTarget = best.center;
      cFrom = snap ? best.c : cCurrent;
      centerFrom = snap ? best.center : centerCurrent;
      injectStart = now;
      injectBlendMs = blendMs;
    }

    // The zoom range a fresh dive starts in -- used for the very first
    // injection and every arc-boundary injection, before the dive has
    // climbed to any real depth yet.
    const START_SCORE_ZOOMS = [1, 2, 3.5, 5.5];

    const startTime = performance.now();
    let diveStartTime = startTime;
    let lastReinjectTime = startTime;
    let lastCyclePhase = 0;
    let retreatInjected = false;
    // Snapping (rather than blending away from the hardcoded {0.3, 0.4}
    // default above, which isn't photo-derived or scored) means the
    // opening frame shows the scored view directly instead of that
    // unvalidated default -- exactly the "empty field of color" this
    // scoring pass exists to avoid.
    injectFromImage(startTime, START_SCORE_ZOOMS, true, fractalSettings.diveDurationSec * 1000 * 0.9);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fractalCanvasEl.width = window.innerWidth * dpr;
      fractalCanvasEl.height = window.innerHeight * dpr;
      gl.viewport(0, 0, fractalCanvasEl.width, fractalCanvasEl.height);
    }
    resize();
    window.addEventListener("resize", resize);

    // The last stretch of a smooth-mode dive eases back down to zoom=1
    // (see computeZoom below) so the next dive can start exactly where
    // this one lands -- no re-injection during that stretch, since the
    // view is already settling toward the arc-start candidate, not
    // somewhere a mid-dive sample should be blending it away from.
    const RETREAT_FRACTION = 0.15;

    function computeZoom(phase, exponent, maxDepth) {
      if (phase < 1 - RETREAT_FRACTION) {
        const diveProgress = phase / (1 - RETREAT_FRACTION);
        return 1 + Math.pow(diveProgress, exponent) * (maxDepth - 1);
      }
      const retreatProgress = (phase - (1 - RETREAT_FRACTION)) / RETREAT_FRACTION;
      return 1 + Math.pow(1 - retreatProgress, exponent) * (maxDepth - 1);
    }

    function frame(now) {
      if (!isFractalOpen()) {
        window.removeEventListener("resize", resize);
        return;
      }
      const settings = fractalSettings;
      const diveDurationMs = settings.diveDurationSec * 1000;
      const reinjectIntervalMs = settings.reinjectIntervalSec * 1000;

      const elapsedSec = (now - startTime) / 1000;
      const pulse = computePulse(elapsedSec, waveformUrl, player);
      const diveExponent = 1.2 + pulse * (settings.musicReactivityPct / 100) * 1.2;

      let zoom;
      if (settings.resetStyle === "sawtooth") {
        // Zoom climbs once per cycle and wraps straight back to 1, with
        // c/center snapping to a fresh candidate at that same instant --
        // rather than smooth mode's continuous re-injection at depth.
        const cyclePhase = ((now - diveStartTime) % diveDurationMs) / diveDurationMs;
        if (cyclePhase < lastCyclePhase) injectFromImage(now, START_SCORE_ZOOMS, true, diveDurationMs * 0.9);
        lastCyclePhase = cyclePhase;
        zoom = 1 + Math.pow(cyclePhase, diveExponent) * (settings.maxDepth - 1);
      } else if (settings.resetStyle === "classic") {
        // Faithfully reproduces the pre-panel behavior this whole
        // settings panel grew out of: a symmetric triangle -- equal
        // time diving in and easing back out -- with exactly one
        // photo injection per cycle (blended, never snapped after the
        // very first) and no mid-dive re-injection at all. Smooth
        // mode's 85/15 split and continuous re-injection is a
        // deliberately different rhythm, not a superset of this one,
        // so it needed its own branch rather than being reachable via
        // slider values alone.
        const cyclePhase = ((now - diveStartTime) % diveDurationMs) / diveDurationMs;
        // Spans ~90% of the cycle -- not a short blend that then sits
        // frozen while only zoom keeps changing -- so c/center are
        // always drifting, never static, and the fractals read as
        // continuously melting into each other rather than a series of
        // freeze-frames with zoom moving between them.
        if (cyclePhase < lastCyclePhase) injectFromImage(now, START_SCORE_ZOOMS, false, diveDurationMs * 0.9);
        lastCyclePhase = cyclePhase;
        const triPhase = cyclePhase < 0.5 ? cyclePhase * 2 : (1 - cyclePhase) * 2;
        zoom = 1 + Math.pow(triPhase, diveExponent) * (settings.maxDepth - 1);
      } else {
        let arcElapsed = now - diveStartTime;
        if (arcElapsed >= diveDurationMs) {
          diveStartTime = now;
          arcElapsed = 0;
          retreatInjected = false;
          injectFromImage(now, START_SCORE_ZOOMS, false, reinjectIntervalMs * 0.9);
        }
        const arcPhase = arcElapsed / diveDurationMs;
        zoom = computeZoom(arcPhase, diveExponent, settings.maxDepth);

        const inRetreat = arcPhase >= 1 - RETREAT_FRACTION;
        if (!inRetreat && now - lastReinjectTime >= reinjectIntervalMs) {
          // Re-inject at the CURRENT depth, not a reset -- new detail
          // surfaces without the dive ever visually retreating. Scored
          // against where zoom actually will be by the *next* injection
          // (dive duration and refresh rate are both user-tunable now,
          // so a fixed multiplier could undershoot under an aggressive
          // combination -- e.g. a short refresh rate paired with a fast
          // dive) rather than a fixed multiplier guessed from the old
          // static cycle.
          const nextPhase = Math.min(1 - RETREAT_FRACTION, (arcElapsed + reinjectIntervalMs) / diveDurationMs);
          const zoomAtNextReinject = computeZoom(nextPhase, diveExponent, settings.maxDepth);
          // Spans ~90% of the interval until the *next* re-injection
          // (not a short fixed blend) so c/center keep drifting the
          // whole time between injections, rather than arriving quickly
          // and then sitting static while only zoom keeps changing.
          injectFromImage(
            now,
            [zoom, (zoom + zoomAtNextReinject) / 2, zoomAtNextReinject * 1.3],
            false,
            reinjectIntervalMs * 0.9
          );
          lastReinjectTime = now;
        } else if (inRetreat && !retreatInjected) {
          // The moment retreat begins, c/center are still blending
          // toward whatever the last mid-dive re-injection targeted --
          // validated only at that deep zoom, not the much lower zoom
          // the retreat is about to descend through. Without this, the
          // retreat could glide zoom back down over a c/center that was
          // never scored for what it now shows -- the same "empty field"
          // problem the scoring pass exists to prevent, just reappearing
          // at the tail of the arc. One blended (not snapped) injection
          // scored for the low-zoom range fixes it, timed close enough
          // to the retreat's own descent that both land around the same
          // time. Blend spans ~90% of the retreat's own duration, same
          // reasoning as every other injection -- keep drifting for
          // (almost) the whole stretch it's on screen for.
          injectFromImage(now, START_SCORE_ZOOMS, false, RETREAT_FRACTION * diveDurationMs * 0.9);
          retreatInjected = true;
        }
      }
      if (settings.zoomBumpEnabled) zoom *= 1 + pulse * 0.08;

      const blend = Math.min(1, (now - injectStart) / injectBlendMs);
      cCurrent = { x: cFrom.x + (cTarget.x - cFrom.x) * blend, y: cFrom.y + (cTarget.y - cFrom.y) * blend };
      centerCurrent = {
        x: centerFrom.x + (centerTarget.x - centerFrom.x) * blend,
        y: centerFrom.y + (centerTarget.y - centerFrom.y) * blend,
      };

      const maxIter = settings.growthEnabled ? 100 + pulse * 50 : 120;

      gl.uniform2f(fractalUniforms.resolution, fractalCanvasEl.width, fractalCanvasEl.height);
      gl.uniform1f(fractalUniforms.zoom, zoom);
      gl.uniform2f(fractalUniforms.c, cCurrent.x, cCurrent.y);
      gl.uniform2f(fractalUniforms.center, centerCurrent.x, centerCurrent.y);
      gl.uniform1f(fractalUniforms.maxIter, maxIter);
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
