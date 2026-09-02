(function () {
  // Hand-curated, cross-artist playlist.
  //
  // To add a track: open its Bandcamp page, "view source", and find:
  //   - <meta name="bc-page-properties" content='{"item_id":NNNNNN,...}'>
  //     -- that NNNNNN is trackId below.
  //   - the <script type="application/ld+json"> block's "duration" value,
  //     formatted like "P00H03M34S" (3 min 34 sec = 214) -- convert to
  //     whole seconds.
  //   - bpm has no public source for most indie tracks -- tap it out (a
  //     tap-tempo app/site, or a DAW if you have one) and note it here.
  //   - waveform (optional) points to a precomputed amplitude-over-time
  //     JSON for the gallery's image visualizer -- see waveforms/README
  //     (generated offline via ffmpeg's astats filter from a legitimately
  //     owned copy of the track, never from scraping Bandcamp's stream;
  //     the raw audio file itself is never hosted, only the derived
  //     numbers). Tracks without one fall back to a BPM-timed pulse.
  const PLAYLIST = [
    {
      artist: "Cruel Buddhist",
      title: "The Innumerable Benefits of High Speed Rail",
      trackId: 299601388,
      duration: 214,
      bpm: 120,
      waveform: "waveforms/cruel-buddhist-innumerable-benefits.json",
      url: "https://cruelbuddhist.bandcamp.com/track/the-innumerable-benefits-of-high-speed-rail",
    },
    {
      artist: "I'mdifficult 我是機車少女",
      title: "Hard to Say",
      trackId: 190151794,
      duration: 224,
      bpm: 120,
      waveform: null,
      url: "https://imdifficult.bandcamp.com/track/hard-to-say-2",
    },
  ];

  const musicPlayer = document.getElementById("music-player");
  const embedHost = document.getElementById("music-player-embed");
  const controlsRow = document.getElementById("music-player-controls");
  const prevBtn = document.getElementById("music-player-prev");
  const nextBtn = document.getElementById("music-player-next");
  const listBtn = document.getElementById("music-player-list-toggle");
  const listPopup = document.getElementById("music-player-list");
  const expandBtn = document.getElementById("music-player-expand-toggle");
  const expandIcon = document.getElementById("music-player-expand-icon");
  const header = document.getElementById("site-header");
  const langSwitcher = document.querySelector(".lang-switcher");
  if (
    !musicPlayer || !embedHost || !controlsRow || !prevBtn || !nextBtn ||
    !listBtn || !listPopup || !expandBtn || !expandIcon || !header || !langSwitcher
  ) return;

  // Buttons stay a fixed 32px (CONTROL_SIZE) -- only the gap between them
  // flexes, from 8px down to a 2px floor, shrinking just enough to keep
  // the hamburger, controls, and language button on one line. Driven by
  // measurement rather than a fixed breakpoint since the deciding factor
  // is the language button's rendered width, which changes with the
  // locale (e.g. "English" vs. "中文（简体）") independently of viewport
  // width.
  const CONTROL_SIZE = 32;
  const CONTROL_COUNT = 4;
  const GAP_MAX = 8;
  const GAP_MIN = 2;

  function updateControlsGap() {
    if (controlsRow.parentElement !== header) return;
    const headerStyle = getComputedStyle(header);
    const headerPaddingX = parseFloat(headerStyle.paddingLeft) + parseFloat(headerStyle.paddingRight);
    const headerGap = parseFloat(headerStyle.gap) || 0;
    const hamburgerWidth = header.querySelector(".nav-hamburger").getBoundingClientRect().width;
    const langWidth = langSwitcher.getBoundingClientRect().width;

    const available = header.getBoundingClientRect().width - headerPaddingX - headerGap * 2 - hamburgerWidth - langWidth;
    const gap = (available - CONTROL_SIZE * CONTROL_COUNT) / (CONTROL_COUNT - 1);
    controlsRow.style.setProperty("--controls-gap", Math.max(GAP_MIN, Math.min(GAP_MAX, gap)) + "px");
  }

  // Below the mobile breakpoint, the controls row physically moves into
  // #site-header itself (between the hamburger and language buttons)
  // rather than just being visually repositioned to look like it's there
  // -- as a real flex child of the same row it gets correct alignment for
  // free instead of reimplementing that math. Moving it back on desktop
  // relies on #music-player only ever having the embed and this row as
  // children, so appending is enough to restore order.
  function placeControls(isMobile) {
    if (isMobile) {
      header.insertBefore(controlsRow, langSwitcher);
    } else {
      musicPlayer.appendChild(controlsRow);
      // Desktop always has room -- clear any leftover mobile value so it
      // doesn't linger (inline styles move with the node, not the
      // breakpoint) and fall through to the default 8px gap in CSS.
      controlsRow.style.removeProperty("--controls-gap");
    }
    updateControlsGap();
  }
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  placeControls(mobileQuery.matches);
  // First placement + gap are done -- safe to reveal (see the
  // visibility: hidden default on .music-player-controls in styles.css).
  controlsRow.classList.add("is-ready");
  mobileQuery.addEventListener("change", function (e) {
    placeControls(e.matches);
  });

  // The header's own width tracks the viewport (left:0;right:0), so
  // observing it catches window resizes; the language button's width
  // only changes when its label does (locale switch), independent of the
  // header's own size, so it needs its own observation too.
  new ResizeObserver(updateControlsGap).observe(header);
  new ResizeObserver(updateControlsGap).observe(langSwitcher);

  const EXPAND_ICON = "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5";
  const COLLAPSE_ICON = "M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5";

  let currentIndex = 0;
  let isExpanded = false;
  let iframe = null;

  function embedSrc(track, autoplay) {
    return (
      "https://bandcamp.com/EmbeddedPlayer/track=" + track.trackId +
      "/size=" + (isExpanded ? "large" : "small") +
      "/bgcol=141414/linkcol=ffffff/tracklist=false/transparent=true/" +
      (autoplay ? "autoplay=1/" : "")
    );
  }

  // Bandcamp has no exposed API to switch tracks/sizes in place, so every
  // change here means reloading the iframe from scratch -- always starts
  // the new track (or the same track at the new size) from 0:00.
  function loadTrack(index, autoplay) {
    currentIndex = index;
    const track = PLAYLIST[currentIndex];

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "music-player-iframe";
      iframe.width = "100%";
      iframe.title = "Bandcamp player";
      iframe.setAttribute("allow", "autoplay; encrypted-media");
      iframe.setAttribute("seamless", "");
      embedHost.appendChild(iframe);
    }
    iframe.height = isExpanded ? "470" : "42";
    iframe.src = embedSrc(track, autoplay);
    embedHost.classList.toggle("is-expanded", isExpanded);

    renderList();
  }

  function renderList() {
    listPopup.textContent = "";
    PLAYLIST.forEach(function (track, index) {
      const li = document.createElement("li");
      li.textContent = track.title + " — " + track.artist;
      if (index === currentIndex) li.classList.add("selected");
      li.addEventListener("click", function () {
        loadTrack(index, true);
        listPopup.hidden = true;
      });
      listPopup.appendChild(li);
    });
  }

  // "Rewind to start / previous song": clamps at the first track instead
  // of wrapping around to the last one -- landing back on the first track
  // is itself "rewind to start", since every reload restarts at 0:00 (see
  // loadTrack above), so no separate rewind-only path is needed.
  prevBtn.addEventListener("click", function () {
    loadTrack(Math.max(currentIndex - 1, 0), true);
  });

  // "Skip to next song": wraps back to the first track after the last,
  // keeping the playlist going.
  nextBtn.addEventListener("click", function () {
    loadTrack((currentIndex + 1) % PLAYLIST.length, true);
  });

  listBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    listPopup.hidden = !listPopup.hidden;
  });

  listPopup.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", function () {
    listPopup.hidden = true;
  });

  expandBtn.addEventListener("click", function () {
    isExpanded = !isExpanded;
    expandIcon.setAttribute("d", isExpanded ? COLLAPSE_ICON : EXPAND_ICON);
    expandBtn.setAttribute("aria-label", isExpanded ? "Show compact player" : "Show full player");
    loadTrack(currentIndex, true);
  });

  // Initial load: no autoplay -- nothing has earned the user gesture
  // browsers require for that yet, so this loads paused and Bandcamp's
  // own play button is how playback starts.
  loadTrack(0, false);

  // Minimal read-only handle for other features (the gallery's BPM-timed
  // image warp) that need to know the current track's tempo. There's no
  // way to observe actual playback state through Bandcamp's iframe (see
  // the file-level comments above), so this is just the hand-noted BPM
  // for whichever track is currently loaded -- not a signal that it's
  // actually playing.
  window.tuckerMillsMusicPlayer = {
    getCurrentBPM: function () {
      return PLAYLIST[currentIndex].bpm;
    },
    getCurrentWaveformUrl: function () {
      return PLAYLIST[currentIndex].waveform || null;
    },
  };
})();
