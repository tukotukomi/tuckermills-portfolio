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
      '<button type="button" class="lightbox-visualize" aria-label="Visualize to music">' +
      '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M852-212 732-332l56-56 120 120-56 56ZM708-692l-56-56 120-120 56 56-120 120Zm-456 0L132-812l56-56 120 120-56 56ZM108-212l-56-56 120-120 56 56-120 120Zm246-75 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-361Z"/></svg>' +
      "</button>";
    document.body.appendChild(el);

    el.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    el.querySelector(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
    el.querySelector(".lightbox-next").addEventListener("click", () => stepLightbox(1));
    el.querySelector(".lightbox-visualize").addEventListener("click", openVisualizer);
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
      const waveform = waveformUrl && loadWaveform(waveformUrl);

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

      let pulse;
      if (waveform) {
        const index = Math.floor((elapsedSec % waveform.duration) / waveform.step);
        pulse = waveform.amplitude[Math.min(index, waveform.amplitude.length - 1)];
      } else {
        const bpm = (player && player.getCurrentBPM()) || 120;
        const beatPhase = (elapsedSec % (60 / bpm)) / (60 / bpm);
        // Squared sine: a sharper rise-and-fall per beat than a plain
        // sine, reading more like a pulse than a slow wobble.
        pulse = Math.sin(beatPhase * Math.PI) ** 2;
      }

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
  });

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
    // Escape backs out one layer at a time -- out of the visualizer first
    // if it's open, then out of the lightbox itself on a second press.
    if (e.key === "Escape") {
      if (isVisualizerOpen()) closeVisualizer();
      else closeLightbox();
    } else if (isVisualizerOpen()) {
      // no-op: arrow keys don't navigate while the visualizer is open
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
