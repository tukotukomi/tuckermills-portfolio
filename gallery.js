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
        "000538810019.jpg",
        "000538810034.jpg",
        "000849230010.jpg",
        "000849240033.jpg",
        "000849260001.jpg",
        "000849260002.jpg",
        "000849260017.jpg",
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
        "img007.jpg",
        "img009-1.jpg",
        "img010.jpg",
        "img013.jpg",
        "img014.jpg",
        "img016.jpg",
        "img018-1.jpg",
        "img018-2.jpg",
        "img019-1.jpg",
        "img019-2.jpg",
        "img020.jpg",
        "img022.jpg",
        "img023.jpg",
        "img024.jpg",
        "img026.jpg",
        "img033.jpg",
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
        "000056.jpg",
        "img007.jpg",
        "img022.jpg",
        "img023.jpg",
      ],
    },
    "gallery-color-travels-grid": {
      folder: "Images/Photography/Collections/color-travels/",
      images: [
        "banner-2.jpg",
        "000293960002.jpg",
        "000293960030.jpg",
        "000294510012.jpg",
        "000538800009.jpg",
        "000538800015.jpg",
        "000849220005.jpg",
        "000849220009.jpg",
        "000849220026.jpg",
        "000849240018.jpg",
        "000849250020.jpg",
        "000849250021.jpg",
        "000849260012.jpg",
        "img015.jpg",
        "img018.jpg",
        "img026.jpg",
        "img027.jpg",
        "img063.jpg",
      ],
    },
    "gallery-colors-lights-grid": {
      folder: "Images/Photography/Collections/Colors & Lights/",
      images: [
        "000483810015.jpg",
        "000483810017.jpg",
        "000483810020.jpg",
        "000483810028.jpg",
        "img011.jpg",
        "img012.jpg",
      ],
    },
    "gallery-unsorted-grid": {
      folder: "Images/Photography/Collections/unsorted/",
      images: [
        "000294300017.jpg",
        "000294300022.jpg",
        "000294300024.jpg",
        "000294300027.jpg",
        "000294300028.jpg",
        "000294350008.jpg",
        "000294350013.jpg",
        "000294420002.jpg",
        "000294420003.jpg",
        "000294420008.jpg",
        "000294420010.jpg",
        "000294420023.jpg",
        "000294420028.jpg",
        "000294470023.jpg",
        "000294470028.jpg",
        "000294510002.jpg",
        "000294510009.jpg",
        "000294530007.jpg",
        "000294530034.jpg",
        "000294560006.jpg",
        "000294560018.jpg",
        "000294560025.jpg",
        "000294570025.jpg",
        "img005.jpg",
        "img007.jpg",
        "img021.jpg",
        "img025.jpg",
        "img028.jpg",
        "img031.jpg",
        "img034.jpg",
        "img044.jpg",
        "img074.jpg",
        "img085.jpg",
        "img090.jpg",
        "img095.jpg",
        "img101.jpg",
        "img111.jpg",
        "img123.jpg",
        "img126.jpg",
        "img128.jpg",
        "img132.jpg",
      ],
    },
  };

  // Display names for the fractal's camera roll (below) -- matches the
  // titles used elsewhere (nav banners, i18n) for the same collections.
  const GALLERY_LABELS = {
    "gallery-wildflowers-grid": "Macro",
    "gallery-china-bw-grid": "China",
    "gallery-china-travels-bw-grid": "China Travels",
    "gallery-color-travels-grid": "Travels in Color",
    "gallery-colors-lights-grid": "Colors & Lights",
    "gallery-unsorted-grid": "Unsorted",
  };

  // Flattened, cross-collection photo list for the fractal's camera
  // roll -- nothing else in this file aggregates across GALLERIES
  // (every other consumer works one collection/grid at a time). Each
  // photo carries both `src` (the full-resolution original -- used for
  // the queue, the "now playing" match against currentImageSrc, and the
  // actual GL texture once a photo is selected) and `thumbSrc` (a
  // pre-generated small copy in a `thumbs/` subfolder next to the
  // original, used ONLY for the camera-roll grid's own <img> tags).
  // Source photos here run 400KB-4MB+ at up to 3400px -- decoding and
  // laying out 30+ of those at once every time the camera roll opens
  // was real, measurable overhead; thumbs/ are ~300px/10-20KB each
  // (~500KB total across every collection combined, generated via
  // `ffmpeg -vf scale=300:300:force_original_aspect_ratio=decrease`).
  // These are real static files checked into the repo, not a runtime
  // canvas trick -- regenerate them by hand (same ffmpeg command) if a
  // photo in GALLERIES above is ever added, replaced, or removed.
  //
  // opts.excludePrivate skips any filename listed in its collection's
  // own `portfolioPrivate` array (a plain string array, e.g.
  // `portfolioPrivate: ["macro-07.jpg"]`, absent on collections with
  // nothing to exclude) -- for photos that should stay on this site's
  // own public gallery but not be shipped to fractalize.studio's catalog
  // export. Unused by this file's own call (below, feeding the embedded
  // fractal's camera roll, which shows everything) -- `images` itself is
  // untouched either way, so this option can't affect tuckermills.com's
  // own gallery grid (renderGallery never sees or filters on this flag).
  function getAllPhotos(opts) {
    const options = opts || {};
    const groups = [];
    Object.keys(GALLERIES).forEach((gridId) => {
      const config = GALLERIES[gridId];
      const privateSet = options.excludePrivate ? config.portfolioPrivate || [] : [];
      groups.push({
        label: GALLERY_LABELS[gridId] || gridId,
        photos: config.images
          .filter((filename) => privateSet.indexOf(filename) === -1)
          .map((filename) => ({
            src: config.folder + filename,
            thumbSrc: config.folder + "thumbs/" + filename,
          })),
      });
    });
    return groups;
  }

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
    el.querySelector(".lightbox-visualize").addEventListener("click", () => window.FractalizeCore.openVisualizer(lightboxImgEl));
    el.querySelector(".lightbox-fractal").addEventListener("click", () => window.FractalizeCore.openFractal(lightboxImgEl));
    // .lightbox-img is sized to fit its content (max-width/height, not a
    // full-bleed wrapper), so any click that isn't on the image or the
    // buttons lands directly on this backdrop element -- clicking anywhere
    // outside the photo closes it.
    el.addEventListener("click", (e) => {
      if (e.target === el) closeLightbox();
    });

    return el;
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
    window.FractalizeCore.closeVisualizer();
    window.FractalizeCore.closeFractal();
    lightboxEl.classList.remove("is-open");
    document.body.classList.remove("lightbox-open");
  }

  function stepLightbox(dir) {
    if (lightboxItems.length < 2) return;
    lightboxIndex = (lightboxIndex + dir + lightboxItems.length) % lightboxItems.length;
    updateLightboxImage();
  }

  // Escape backs out one layer at a time -- out of the fractal view or
  // visualizer first if either is open, then out of the lightbox itself
  // on a following press. fractalize-core.js registers its own Escape
  // listener (bubble phase, the default) that closes whichever of the
  // fractal/visualizer is open -- this listener runs in the CAPTURE
  // phase specifically so it reads isFractalOpen()/isVisualizerOpen()
  // *before* that other listener can change them, otherwise both
  // listeners would fire on the same keypress and this one would see
  // post-close state and immediately close the lightbox too.
  document.addEventListener(
    "keydown",
    (e) => {
      if (!isLightboxOpen()) return;
      const engineOpen = window.FractalizeCore.isFractalOpen() || window.FractalizeCore.isVisualizerOpen();
      if (e.key === "Escape") {
        if (!engineOpen) closeLightbox();
      } else if (engineOpen) {
        // no-op: arrow keys don't navigate while either overlay is open
      } else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    },
    true
  );

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

  // Gives the fractal's camera-roll panel its photo data by injection --
  // this site's own instance shows every photo (no excludePrivate), see
  // getAllPhotos's own comment for the option fractalize.studio's future
  // catalog export will use instead.
  window.FractalizeCore.setPhotoCatalog(getAllPhotos());
})();
