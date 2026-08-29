(function () {
  const ROUTES = ["home", "professional", "side-projects", "photography", "about-me", "gallery-wildflowers"];
  const PATHS = {
    home: "/",
    professional: "/professional",
    "side-projects": "/side-projects",
    photography: "/photography",
    "about-me": "/about-me",
    "gallery-wildflowers": "/photography/wildflowers",
  };
  // Sub-pages (gallery collections) highlight their parent's nav pill
  // rather than none at all -- add future collections' routes here too.
  const NAV_HIGHLIGHT = {
    "gallery-wildflowers": "photography",
  };
  const TRANSITION_MS = 600; // matches .slide's opacity transition in styles.css

  const track = document.getElementById("track");
  const slides = Array.from(track.children);
  let currentIndex = indexFromPath(location.pathname);
  let animating = false;

  function indexFromPath(pathname) {
    const clean = pathname.replace(/\/$/, "") || "/";
    const route = Object.keys(PATHS).find((r) => PATHS[r] === clean);
    return route ? ROUTES.indexOf(route) : 0;
  }

  function setActiveNav(route) {
    document.body.classList.toggle("on-home", route === "home");
    document.body.classList.toggle("on-professional", route === "professional");
    const highlightRoute = NAV_HIGHLIGHT[route] || route;
    document.querySelectorAll(".page-nav-link").forEach((link) => {
      if (link.getAttribute("data-route") === highlightRoute) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function activateSlide(index) {
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
  }

  // The header morph: a floating clone of the clicked button's label tweens
  // from the button's on-screen rect to the destination page's title rect,
  // while the real source label and destination title are hidden so there's
  // no double image underneath. Every slide is an absolutely positioned,
  // full-viewport box stacked in the same spot (see .slide in styles.css),
  // so the destination title's rect is already correct to measure even
  // while its slide is still inactive -- no need to briefly jump anything
  // into view first the way the old horizontal-strip layout required.
  // .page-title is a block element, so its rect always spans the full
  // width of its container regardless of text-align -- that's fine for a
  // centered title (the text already sits centered within that width,
  // matching .morph-clone's own centered content), but a left-aligned
  // title (Professional's, via .page-professional-inner) would have its
  // clone visibly centered in that same wide box while tweening, then
  // jump to the left the instant the real title is revealed. Matching
  // the clone's own alignment to the destination's avoids that: the
  // clone starts sized to the source text (so alignment is invisible at
  // first regardless), then stays pinned to the correct edge as it grows
  // into the destination's full width.
  function alignToJustify(align) {
    if (align === "left" || align === "start") return "flex-start";
    if (align === "right" || align === "end") return "flex-end";
    return "center";
  }

  function runMorph(sourceLabel, index, onDone) {
    const sourceRect = sourceLabel.getBoundingClientRect();
    const sourceStyle = getComputedStyle(sourceLabel);
    const titleEl = slides[index].querySelector(".page-title");
    const targetRect = titleEl.getBoundingClientRect();
    const targetStyle = getComputedStyle(titleEl);

    const clone = document.createElement("div");
    clone.className = "morph-clone";
    clone.textContent = sourceLabel.textContent;
    clone.style.textAlign = targetStyle.textAlign;
    clone.style.justifyContent = alignToJustify(targetStyle.textAlign);
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

    activateSlide(index);

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

    setTimeout(() => {
      clone.remove();
      sourceLabel.style.visibility = "";
      titleEl.style.visibility = "";
      onDone();
    }, TRANSITION_MS);
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
      activateSlide(index);
      setTimeout(finish, TRANSITION_MS);
    }

    if (push) history.pushState({ route }, "", PATHS[route]);
  }

  const navToggle = document.getElementById("nav-hamburger-toggle");
  const navMenu = document.getElementById("nav-hamburger-menu");

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".route-link");
    if (!link) return;
    e.preventDefault();
    const route = link.getAttribute("data-route");
    const morphFrom = link.classList.contains("start-btn") ? link.querySelector(".btn-label") : null;
    goToRoute(route, { push: true, morphFrom });
    if (navMenu && !navMenu.hidden) {
      navToggle.setAttribute("aria-expanded", "false");
      navMenu.hidden = true;
    }
  });

  window.addEventListener("popstate", () => {
    goToRoute(ROUTES[indexFromPath(location.pathname)], { push: false });
  });

  // Mobile hamburger dropdown: same open/close-on-outside-click pattern as
  // the language switcher.
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!expanded));
      navMenu.hidden = expanded;
    });
    document.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      navMenu.hidden = true;
    });
  }

  activateSlide(currentIndex);
  setActiveNav(ROUTES[currentIndex]);
})();
