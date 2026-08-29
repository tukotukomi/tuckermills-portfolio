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
      '<img class="lightbox-img" alt="">';
    document.body.appendChild(el);

    el.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
    el.querySelector(".lightbox-prev").addEventListener("click", () => stepLightbox(-1));
    el.querySelector(".lightbox-next").addEventListener("click", () => stepLightbox(1));
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
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") stepLightbox(-1);
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
