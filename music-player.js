(function () {
  // Hand-curated, cross-artist playlist. Bandcamp has no official iframe
  // API (no postMessage "ended" event, no way to read playback state from
  // outside the embed), so each track's duration is recorded here once and
  // used to *estimate* when it's finished, driving auto-advance with a
  // plain timer instead of a real playback event. It's not frame-accurate
  // (a track could buffer and drift a couple seconds off), which is a
  // non-issue for background listening.
  //
  // To add a track: open its Bandcamp page, "view source", and find:
  //   - <meta name="bc-page-properties" content='{"item_id":NNNNNN,...}'>
  //     -- that NNNNNN is trackId below.
  //   - the <script type="application/ld+json"> block's "duration" value,
  //     formatted like "P00H03M34S" (3 min 34 sec = 214) -- convert to
  //     whole seconds.
  const PLAYLIST = [
    {
      artist: "Cruel Buddhist",
      title: "The Innumerable Benefits of High Speed Rail",
      trackId: 299601388,
      duration: 214,
      url: "https://cruelbuddhist.bandcamp.com/track/the-innumerable-benefits-of-high-speed-rail",
    },
    {
      artist: "I'mdifficult 我是機車少女",
      title: "Hard to Say",
      trackId: 190151794,
      duration: 224,
      url: "https://imdifficult.bandcamp.com/track/hard-to-say-2",
    },
  ];

  const toggle = document.getElementById("music-player-toggle");
  const panel = document.getElementById("music-player-panel");
  const embedHost = document.getElementById("music-player-embed");
  const prevBtn = document.getElementById("music-player-prev");
  const nextBtn = document.getElementById("music-player-next");
  if (!toggle || !panel || !embedHost || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let initialized = false;
  let advanceTimer = null;
  let iframe = null;

  function embedSrc(track, autoplay) {
    return (
      "https://bandcamp.com/EmbeddedPlayer/track=" + track.trackId +
      "/size=large/bgcol=141414/linkcol=ffffff/tracklist=false/transparent=true/" +
      (autoplay ? "autoplay=1/" : "")
    );
  }

  function playTrack(index, autoplay) {
    currentIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    const track = PLAYLIST[currentIndex];

    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "music-player-iframe";
      iframe.width = "100%";
      iframe.height = "470";
      iframe.title = "Bandcamp player";
      // Cross-origin autoplay is only honored by the browser if the
      // top-level page already has a user gesture -- true here, since
      // playTrack() only ever runs in response to a click.
      iframe.setAttribute("allow", "autoplay");
      iframe.setAttribute("seamless", "");
      embedHost.appendChild(iframe);
    }
    iframe.src = embedSrc(track, autoplay);

    clearTimeout(advanceTimer);
    if (autoplay) {
      advanceTimer = setTimeout(function () {
        playTrack(currentIndex + 1, true);
      }, track.duration * 1000);
    }
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;

    // First-ever expand: lazily create the iframe and start the playlist.
    // The click that opened the panel is itself the user gesture browsers
    // require before audio can autoplay (including inside the embed's
    // cross-origin iframe, via allow="autoplay" above). Collapsing the
    // panel afterwards only hides this UI -- playback and the auto-advance
    // timer keep running in the background, so the music persists as the
    // visitor navigates the rest of the site.
    if (!expanded && !initialized) {
      initialized = true;
      playTrack(0, true);
    }
  });

  panel.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", function () {
    toggle.setAttribute("aria-expanded", "false");
    panel.hidden = true;
  });

  prevBtn.addEventListener("click", function () {
    playTrack(currentIndex - 1, true);
  });

  nextBtn.addEventListener("click", function () {
    playTrack(currentIndex + 1, true);
  });
})();
