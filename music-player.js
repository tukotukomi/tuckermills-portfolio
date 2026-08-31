(function () {
  // Hand-curated, cross-artist playlist. Only PLAYLIST[0] is shown for now
  // (see the widget in index.html) -- prev/next and other custom controls
  // come later, reading from this same list.
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

  const embedHost = document.getElementById("music-player-embed");
  if (!embedHost) return;

  const track = PLAYLIST[0];
  const iframe = document.createElement("iframe");
  iframe.className = "music-player-iframe";
  iframe.width = "100%";
  iframe.height = "42";
  iframe.title = "Bandcamp player";
  iframe.setAttribute("allow", "autoplay");
  iframe.setAttribute("seamless", "");
  // size=small is Bandcamp's own compact layout (a thin bar, no big cover
  // art). No autoplay param -- nothing here has earned the user gesture
  // browsers require for that yet, so this loads paused and Bandcamp's own
  // play button is how playback starts, for now.
  iframe.src =
    "https://bandcamp.com/EmbeddedPlayer/track=" + track.trackId +
    "/size=small/bgcol=141414/linkcol=ffffff/tracklist=false/transparent=true/";
  embedHost.appendChild(iframe);
})();
