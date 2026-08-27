(function () {
  const ROUTES = ["home", "professional", "side-projects", "photography", "about-me"];
  const PATHS = {
    home: "/",
    professional: "/professional",
    "side-projects": "/side-projects",
    photography: "/photography",
    "about-me": "/about-me",
  };
  const TRANSITION_MS = 600;
  const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
  const TRANSITION = `transform ${TRANSITION_MS}ms ${EASING}`;

  const track = document.getElementById("track");
  let currentIndex = indexFromPath(location.pathname);
  let animating = false;

  function indexFromPath(pathname) {
    const clean = pathname.replace(/\/$/, "") || "/";
    const route = Object.keys(PATHS).find((r) => PATHS[r] === clean);
    return route ? ROUTES.indexOf(route) : 0;
  }

  function setActiveNav(route) {
    document.body.classList.toggle("on-home", route === "home");
    document.body.dataset.route = route;
    document.querySelectorAll(".page-nav-link").forEach((link) => {
      if (link.getAttribute("data-route") === route) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function slideTo(index) {
    track.style.transition = TRANSITION;
    track.style.transform = `translateX(-${index * 100}vw)`;
  }

  // Briefly jump the (untransitioned) track to `index` to measure the real
  // on-screen position of that slide's title, then jump back before the
  // browser paints, so nothing visibly flashes.
  function measureTitleRectAt(index) {
    const prevTransition = track.style.transition;
    track.style.transition = "none";
    track.style.transform = `translateX(-${index * 100}vw)`;
    void track.offsetHeight;
    const titleEl = track.children[index].querySelector(".page-title");
    const rect = titleEl.getBoundingClientRect();
    track.style.transform = `translateX(-${currentIndex * 100}vw)`;
    void track.offsetHeight;
    track.style.transition = prevTransition;
    return { rect, titleEl };
  }

  function runMorph(sourceLabel, index, onDone) {
    const sourceRect = sourceLabel.getBoundingClientRect();
    const sourceStyle = getComputedStyle(sourceLabel);
    const { rect: targetRect, titleEl } = measureTitleRectAt(index);
    const targetStyle = getComputedStyle(titleEl);

    const clone = document.createElement("div");
    clone.className = "morph-clone";
    clone.textContent = sourceLabel.textContent;
    Object.assign(clone.style, {
      left: `${sourceRect.left}px`,
      top: `${sourceRect.top}px`,
      width: `${sourceRect.width}px`,
      height: `${sourceRect.height}px`,
      fontSize: sourceStyle.fontSize,
      fontWeight: sourceStyle.fontWeight,
      color: sourceStyle.color,
    });
    document.body.appendChild(clone);

    sourceLabel.style.visibility = "hidden";
    titleEl.style.visibility = "hidden";

    slideTo(index);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        Object.assign(clone.style, {
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          fontSize: targetStyle.fontSize,
          fontWeight: targetStyle.fontWeight,
          color: targetStyle.color,
        });
      });
    });

    // The clone transitions several properties (left/top/width/height/
    // font-size) at once, and each fires its own separate `transitionend`
    // event -- reacting to just the first one to arrive would swap back to
    // the real title before the others (e.g. left/top) actually finished,
    // producing a visible jump. A fixed timeout matching the declared
    // duration is what both the clone and the track transition use, so
    // wait for that instead.
    let finished = 0;
    function done() {
      finished++;
      if (finished < 2) return;
      clone.remove();
      sourceLabel.style.visibility = "";
      titleEl.style.visibility = "";
      onDone();
    }
    setTimeout(done, TRANSITION_MS);
    track.addEventListener("transitionend", done, { once: true });
  }

  function goToRoute(route, { push = true, morphFrom = null } = {}) {
    const index = ROUTES.indexOf(route);
    if (index === -1 || animating || index === currentIndex) return;
    animating = true;

    const finish = () => {
      currentIndex = index;
      animating = false;
      setActiveNav(route);
    };

    if (morphFrom) {
      runMorph(morphFrom, index, finish);
    } else {
      slideTo(index);
      track.addEventListener("transitionend", finish, { once: true });
    }

    if (push) history.pushState({ route }, "", PATHS[route]);
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".route-link");
    if (!link) return;
    e.preventDefault();
    const route = link.getAttribute("data-route");
    const morphFrom = link.classList.contains("start-btn") ? link.querySelector(".btn-label") : null;
    goToRoute(route, { push: true, morphFrom });
  });

  window.addEventListener("popstate", () => {
    goToRoute(ROUTES[indexFromPath(location.pathname)], { push: false });
  });

  setActiveNav(ROUTES[currentIndex]);
})();
