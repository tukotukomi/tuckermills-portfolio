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
  //   - bpm has no public source for most indie tracks -- tap it out (a
  //     tap-tempo app/site, or a DAW if you have one) and note it here.
  //     Drives the note icon's bounce animation; not audio-derived (see
  //     setPlaying below), so it's only as accurate as this number is.
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

  const toggle = document.getElementById("music-player-toggle");
  const panel = document.getElementById("music-player-panel");
  const embedHost = document.getElementById("music-player-embed");
  const prevBtn = document.getElementById("music-player-prev");
  const nextBtn = document.getElementById("music-player-next");
  const playPauseBtn = document.getElementById("music-player-playpause");
  const playPauseIcon = document.getElementById("music-player-playpause-icon");
  const noteIcon = document.getElementById("music-player-note-icon");
  if (!toggle || !panel || !embedHost || !prevBtn || !nextBtn || !playPauseBtn || !playPauseIcon || !noteIcon) return;

  const PLAY_ICON = "M8 5 L19 12 L8 19 Z";
  const PAUSE_ICON = "M6 5 H10 V19 H6 Z M14 5 H18 V19 H14 Z";

  let currentIndex = 0;
  let isPlaying = false;
  let advanceTimer = null;
  let iframe = null;

  function embedSrc(track, autoplay) {
    // size=small is Bandcamp's own compact layout (a thin bar, no big
    // cover art) rather than a CSS-shrunk version of the large one --
    // real controls at real size, just a smaller footprint, since our own
    // play/pause and prev/next already cover the large embed's job.
    return (
      "https://bandcamp.com/EmbeddedPlayer/track=" + track.trackId +
      "/size=small/bgcol=141414/linkcol=ffffff/tracklist=false/transparent=true/" +
      (autoplay ? "autoplay=1/" : "")
    );
  }

  function setPlaying(playing) {
    isPlaying = playing;
    playPauseBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    playPauseIcon.setAttribute("d", playing ? PAUSE_ICON : PLAY_ICON);

    // No access to the actual audio (see the file-level comment), so this
    // bounces in time with the current track's hand-noted BPM rather than
    // real beat detection -- a timed approximation, not analysis.
    if (playing) {
      const beatSeconds = 60 / PLAYLIST[currentIndex].bpm;
      noteIcon.style.setProperty("--beat-duration", beatSeconds + "s");
      noteIcon.classList.add("is-beating");
    } else {
      noteIcon.classList.remove("is-beating");
    }
  }

  // Bandcamp has no exposed pause/resume call -- the only lever we have is
  // the iframe's own src. "Pause" here means tearing the iframe down
  // entirely (stopping its audio) while remembering which playlist index
  // was playing; "resume" reloads that same track from 0:00 rather than
  // its real mid-track position, since that position was never observable
  // from outside the embed in the first place.
  function playTrack(index, autoplay) {
    currentIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    const track = PLAYLIST[currentIndex];

    if (!iframe) {
      embedHost.textContent = "";
      iframe = document.createElement("iframe");
      iframe.className = "music-player-iframe";
      iframe.width = "100%";
      iframe.height = "42";
      iframe.title = "Bandcamp player";
      // Cross-origin autoplay is only honored by the browser if the
      // top-level page already has a user gesture -- true here, since
      // playTrack() only ever runs in response to a click.
      iframe.setAttribute("allow", "autoplay");
      iframe.setAttribute("seamless", "");
      embedHost.appendChild(iframe);
    }
    iframe.src = embedSrc(track, autoplay);
    setPlaying(autoplay);

    clearTimeout(advanceTimer);
    if (autoplay) {
      advanceTimer = setTimeout(function () {
        playTrack(currentIndex + 1, true);
      }, track.duration * 1000);
    }
  }

  function stopPlayback() {
    clearTimeout(advanceTimer);
    if (iframe) {
      iframe.remove();
      iframe = null;
    }
    setPlaying(false);
  }

  playPauseBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (isPlaying) stopPlayback();
    else playTrack(currentIndex, true);
  });

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    panel.hidden = expanded;
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
