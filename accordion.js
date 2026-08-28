(function () {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  if (!items.length) return;

  const page = items[0].closest(".page-professional");
  if (!page) return;

  const accordion = items[0].closest(".accordion");
  const remainingEl = accordion ? accordion.querySelector(".accordion-remaining") : null;
  const remainingLabelEl = remainingEl ? remainingEl.querySelector(".accordion-remaining-label") : null;

  const TRANSITION_MS = 650; // matches the accordion-item flex-grow transition (0.6s) plus a buffer

  // Minimum extra scroll distance required, once the active section's
  // content edge is reached, before that counts as "let go, move to the
  // next section." Without this, a single leftover tick of touch inertia
  // (or a trackpad's own momentum-scroll, which keeps firing wheel events
  // for a while after the fingers have already left the pad) is enough to
  // immediately flip sections the instant it crosses the edge. Requiring a
  // sustained push past the edge -- and resetting that if too much time
  // passes between ticks -- means only a deliberate continued scroll can
  // trigger it, while momentum harmlessly dies at the edge.
  const OVERSCROLL_THRESHOLD = 80;
  const OVERSCROLL_RESET_MS = 250;

  let joiner = ", ";

  let activeIndex = items.findIndex((item) => item.classList.contains("is-open"));
  if (activeIndex === -1) activeIndex = 0;
  let transitioning = false;
  let overscroll = 0;
  let overscrollDir = 0;
  let lastOverscrollTime = 0;

  function bodyOf(index) {
    return items[index].querySelector(".accordion-body");
  }

  function resetOverscroll() {
    overscroll = 0;
    overscrollDir = 0;
  }

  function updateRemaining() {
    if (!remainingEl || !remainingLabelEl) return;
    const remaining = items.slice(activeIndex + 1);
    if (!remaining.length) {
      remainingEl.hidden = true;
      return;
    }
    remainingEl.hidden = false;
    remainingLabelEl.textContent = remaining
      .map((item) => item.querySelector(".accordion-label").textContent.trim())
      .join(joiner);
  }

  // Only the single most recently collapsed section stays visible above the
  // active one; anything passed further back is hidden entirely so
  // scrolling up doesn't accumulate a long, ever-growing list of headers.
  // Everything below the active section collapses into one combined row
  // (built by updateRemaining) listing their titles, rather than a stack of
  // individual headers eating up screen space before the user has scrolled
  // anywhere near them -- this matters most on mobile, where that stack of
  // untouched headers can push the active section's content out of view.
  function updateVisibility() {
    items.forEach((item, i) => {
      item.classList.toggle("is-far-passed", i < activeIndex - 1);
      item.classList.toggle("is-below-active", i > activeIndex);
    });
    updateRemaining();
  }

  function activate(index) {
    if (index < 0 || index >= items.length || index === activeIndex || transitioning) return;
    transitioning = true;
    activeIndex = index;
    items.forEach((item, i) => {
      const isActive = i === index;
      item.classList.toggle("is-open", isActive);
      item.querySelector(".accordion-header").setAttribute("aria-expanded", String(isActive));
      item.querySelector(".accordion-collapse").setAttribute("aria-hidden", String(!isActive));
    });
    updateVisibility();
    // Always show a newly active section from the start of its content,
    // never wherever it happened to be scrolled to last time it was open.
    bodyOf(index).scrollTop = 0;
    resetOverscroll();
    setTimeout(() => {
      transitioning = false;
    }, TRANSITION_MS);
  }

  function isAtTop(body) {
    return body.scrollTop <= 1;
  }

  function isAtBottom(body) {
    return body.scrollTop + body.clientHeight >= body.scrollHeight - 1;
  }

  // A scroll gesture in either direction first scrolls the active
  // section's own content, if it doesn't already fully fit; only once
  // that content is scrolled all the way to the edge (or it fits within
  // the viewport already, i.e. is trivially "at both edges") does the
  // gesture start counting toward collapsing the current section and
  // expanding the next/previous one -- see OVERSCROLL_THRESHOLD above.
  function handleDelta(deltaY) {
    if (transitioning || deltaY === 0) return;
    const body = bodyOf(activeIndex);
    const dir = deltaY > 0 ? 1 : -1;
    const atBoundary = dir > 0 ? isAtBottom(body) : isAtTop(body);

    if (!atBoundary) {
      body.scrollTop += deltaY;
      resetOverscroll();
      return;
    }

    const now = performance.now();
    if (overscrollDir !== dir || now - lastOverscrollTime > OVERSCROLL_RESET_MS) {
      overscroll = 0;
      overscrollDir = dir;
    }
    overscroll += Math.abs(deltaY);
    lastOverscrollTime = now;

    if (overscroll >= OVERSCROLL_THRESHOLD) {
      resetOverscroll();
      activate(activeIndex + dir);
    }
  }

  page.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      handleDelta(e.deltaY);
    },
    { passive: false }
  );

  // Touch: driven manually (like wheel) rather than deferring to native
  // scroll, because native scroll only ever engages when the finger is
  // directly over the actual scrollable .accordion-body element -- drag
  // anywhere else on the page (the title, a collapsed header, blank
  // space) and native scrolling has nothing to grab, so nothing would
  // happen. Manual handling works the same regardless of where on the
  // page the touch starts. To keep it from feeling stiff without native
  // momentum, a short decaying "coast" is applied after the finger lifts.
  let touchY = null;
  let touchVelocity = 0;
  let lastTouchTime = 0;
  let momentumFrame = null;

  function stopMomentum() {
    if (momentumFrame !== null) {
      cancelAnimationFrame(momentumFrame);
      momentumFrame = null;
    }
  }

  page.addEventListener(
    "touchstart",
    (e) => {
      stopMomentum();
      touchY = e.touches[0].clientY;
      lastTouchTime = performance.now();
      touchVelocity = 0;
    },
    { passive: true }
  );
  page.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null) return;
      const y = e.touches[0].clientY;
      const now = performance.now();
      const deltaY = touchY - y;
      const dt = Math.max(now - lastTouchTime, 1);
      touchVelocity = deltaY / dt; // px per ms, used for the post-release coast
      touchY = y;
      lastTouchTime = now;
      e.preventDefault();
      handleDelta(deltaY);
    },
    { passive: false }
  );
  page.addEventListener(
    "touchend",
    () => {
      touchY = null;
      let v = touchVelocity * 16; // px per ~frame
      function coast() {
        if (Math.abs(v) < 0.5 || transitioning) {
          momentumFrame = null;
          return;
        }
        handleDelta(v);
        v *= 0.94;
        momentumFrame = requestAnimationFrame(coast);
      }
      if (Math.abs(v) > 0.5) momentumFrame = requestAnimationFrame(coast);
    },
    { passive: true }
  );

  document.addEventListener("click", (e) => {
    const header = e.target.closest(".accordion-header");
    if (header) {
      activate(items.indexOf(header.closest(".accordion-item")));
      return;
    }
    if (remainingEl && e.target.closest(".accordion-remaining") === remainingEl) {
      activate(activeIndex + 1);
    }
  });

  document.addEventListener("i18n:applied", (e) => {
    if (e.detail && e.detail["common.listJoiner"]) joiner = e.detail["common.listJoiner"];
    updateRemaining();
  });

  updateVisibility();
})();
