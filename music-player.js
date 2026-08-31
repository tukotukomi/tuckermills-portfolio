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
  const PLAYLIST = [
    {
      artist: "Cruel Buddhist",
      title: "The Innumerable Benefits of High Speed Rail",
      trackId: 299601388,
      duration: 214,
      bpm: 120,
      url: "https://cruelbuddhist.bandcamp.com/track/the-innumerable-benefits-of-high-speed-rail",
    },
    {
      artist: "I'mdifficult 我是機車少女",
      title: "Hard to Say",
      trackId: 190151794,
      duration: 224,
      bpm: 120,
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

  // Below the mobile breakpoint, the controls row physically moves into
  // #site-header itself (between the hamburger and language buttons)
  // rather than just being visually repositioned to look like it's there
  // -- as a real flex child of the same row it gets correct alignment and
  // spacing for free (including around the language button, whose label
  // width varies by locale) instead of reimplementing that math. Moving
  // it back on desktop relies on #music-player only ever having the embed
  // and this row as children, so appending is enough to restore order.
  function placeControls(isMobile) {
    if (isMobile) header.insertBefore(controlsRow, langSwitcher);
    else musicPlayer.appendChild(controlsRow);
  }
  const mobileQuery = window.matchMedia("(max-width: 700px)");
  placeControls(mobileQuery.matches);
  mobileQuery.addEventListener("change", function (e) {
    placeControls(e.matches);
  });

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
      iframe.setAttribute("allow", "autoplay");
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
})();
