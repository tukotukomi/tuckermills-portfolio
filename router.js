(function () {
  const ROUTES = ["home", "professional", "photography", "side-projects", "about-me"];
  const PATHS = {
    home: "/",
    professional: "/professional",
    photography: "/photography",
    "side-projects": "/side-projects",
    "about-me": "/about-me",
  };
  const TRANSITION = "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)";

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

    let finished = 0;
    function done() {
      finished++;
      if (finished < 2) return;
      clone.remove();
      sourceLabel.style.visibility = "";
      titleEl.style.visibility = "";
      onDone();
    }
    clone.addEventListener("transitionend", done, { once: true });
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
