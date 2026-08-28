(function () {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  if (!items.length) return;

  const page = items[0].closest(".page-professional");
  if (!page) return;

  const accordion = items[0].closest(".accordion");
  const passedEl = accordion ? accordion.querySelector(".accordion-passed") : null;
  const passedLabelEl = passedEl ? passedEl.querySelector(".accordion-remaining-label") : null;
  const remainingEl = accordion ? accordion.querySelector(".accordion-remaining") : null;
  const remainingLabelEl = remainingEl ? remainingEl.querySelector(".accordion-remaining-label") : null;
  const progressEl = document.getElementById("scroll-progress");
  const progressFillEl = document.getElementById("scroll-progress-fill");

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
  const OVERSCROLL_THRESHOLD = 100;
  const OVERSCROLL_RESET_MS = 250;

  let joiner = ", ";

  // Cached per-section {header, full} pixel heights, as if every section
  // were expanded and stacked in one long document -- used to compute the
  // progress bar's fraction. Measured off-screen (see measureSectionHeights)
  // since collapsed sections are display:none and can't be measured live.
  let sectionHeights = [];

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

  function joinTitles(list) {
    return list.map((item) => item.querySelector(".accordion-label").textContent.trim()).join(joiner);
  }

  function updatePassed() {
    if (!passedEl || !passedLabelEl) return;
    const passed = items.slice(0, activeIndex);
    if (!passed.length) {
      passedEl.hidden = true;
      return;
    }
    passedEl.hidden = false;
    passedLabelEl.textContent = joinTitles(passed);
  }

  function updateRemaining() {
    if (!remainingEl || !remainingLabelEl) return;
    const remaining = items.slice(activeIndex + 1);
    if (!remaining.length) {
      remainingEl.hidden = true;
      return;
    }
    remainingEl.hidden = false;
    remainingLabelEl.textContent = joinTitles(remaining);
  }

  // Measures every section's full header+body height as if it were open,
  // by cloning the accordion off-screen (position: fixed, way off the left
  // edge) with every item forced open and unconstrained by the real
  // layout's flex/overflow clipping, so scrollHeight-style clipping never
  // shrinks the numbers. Re-run whenever the content's rendered size could
  // have changed: on load, on resize, and on a language switch.
  function measureSectionHeights() {
    if (!accordion) return [];
    const clone = accordion.cloneNode(true);
    clone.classList.add("accordion-measure-clone");
    clone.querySelectorAll(".accordion-passed, .accordion-remaining").forEach((el) => el.remove());
    const clonedItems = Array.from(clone.querySelectorAll(".accordion-item"));
    clonedItems.forEach((item) => {
      item.classList.remove("is-above-active", "is-below-active");
      item.classList.add("is-open");
    });
    document.body.appendChild(clone);
    const heights = clonedItems.map((item) => ({
      header: item.querySelector(".accordion-header").getBoundingClientRect().height,
      full: item.getBoundingClientRect().height,
    }));
    document.body.removeChild(clone);
    return heights;
  }

  // The progress fraction treats the whole accordion as one long document
  // with every section expanded and stacked: sections already passed count
  // in full, the active section counts its header plus however much of its
  // body has been scrolled into view, and sections not yet reached count
  // for nothing (though their full height is still part of the total).
  function updateProgress() {
    if (!progressFillEl || !sectionHeights.length) return;
    const total = sectionHeights.reduce((sum, h) => sum + h.full, 0);
    if (total <= 0) return;
    let position = 0;
    for (let i = 0; i < activeIndex; i++) position += sectionHeights[i].full;
    const activeHeader = sectionHeights[activeIndex] ? sectionHeights[activeIndex].header : 0;
    const body = bodyOf(activeIndex);
    const seen = Math.min(body.scrollTop + body.clientHeight, body.scrollHeight);
    position += activeHeader + seen;
    const fraction = Math.min(1, Math.max(0, position / total));
    progressFillEl.style.height = fraction * 100 + "%";
  }

  function remeasure() {
    sectionHeights = measureSectionHeights();
    updateProgressBounds();
    updateProgress();
  }

  // Positions the progress bar to span exactly from the accordion's own
  // top edge down to the bottom of whatever its last visible row is --
  // normally .accordion-remaining, or the accordion's own bottom once
  // that row hides itself (no sections left below the active one).
  function updateProgressBounds() {
    if (!progressEl || !accordion) return;
    const accRect = accordion.getBoundingClientRect();
    let bottom = accRect.bottom;
    if (remainingEl && !remainingEl.hidden) {
      bottom = Math.max(bottom, remainingEl.getBoundingClientRect().bottom);
    }
    progressEl.style.top = accRect.top + "px";
    progressEl.style.height = Math.max(0, bottom - accRect.top) + "px";
  }

  // Sections on either side of the active one are hidden individually and
  // summarized instead: everything above collapses into one combined row
  // (updatePassed) and everything below into another (updateRemaining),
  // rather than a stack of individual headers eating up screen space before
  // or after the section the user is actually looking at -- this matters
  // most on mobile, where that stack of untouched headers can push the
  // active section's content out of view.
  function updateVisibility() {
    items.forEach((item, i) => {
      item.classList.toggle("is-above-active", i < activeIndex);
      item.classList.toggle("is-below-active", i > activeIndex);
    });
    updatePassed();
    updateRemaining();
  }

  // flex-grow is declared as transitionable on .accordion-item, but it
  // doesn't actually interpolate in practice (confirmed: forcing a
  // multi-second transition still snaps instantly) -- a known limitation
  // of animating flex-grow, not something a duration/easing tweak fixes.
  // Instead, explicitly transition a pixel height: freeze the item at its
  // starting height, force a reflow so the browser commits that as the
  // transition's start point, then set the target height so it actually
  // animates. is-animating keeps a closing item rendered (overriding
  // is-above-active/is-below-active's display: none) for the duration,
  // since a display: none item can't be seen shrinking away.
  function animateItemHeight(item, from, to) {
    if (from === to) return;
    item.classList.add("is-animating");
    item.style.transition = "none";
    item.style.flexGrow = "0";
    item.style.flexShrink = "0";
    item.style.overflow = "hidden";
    item.style.height = `${from}px`;
    void item.offsetHeight;
    item.style.transition = `height ${TRANSITION_MS - 50}ms cubic-bezier(0.65, 0, 0.35, 1)`;
    item.style.height = `${to}px`;

    function cleanup() {
      item.style.height = "";
      item.style.flexGrow = "";
      item.style.flexShrink = "";
      item.style.overflow = "";
      item.style.transition = "";
      item.classList.remove("is-animating");
      item.removeEventListener("transitionend", onEnd);
    }
    function onEnd(e) {
      if (e.propertyName === "height" && e.target === item) cleanup();
    }
    item.addEventListener("transitionend", onEnd);
    setTimeout(cleanup, TRANSITION_MS);
  }

  function activate(index) {
    if (index < 0 || index >= items.length || index === activeIndex || transitioning) return;
    transitioning = true;

    const prevItem = items[activeIndex];
    const prevFromHeight = prevItem.getBoundingClientRect().height;
    const nextItem = items[index];

    activeIndex = index;
    items.forEach((item, i) => {
      const isActive = i === index;
      item.classList.toggle("is-open", isActive);
      item.querySelector(".accordion-header").setAttribute("aria-expanded", String(isActive));
      item.querySelector(".accordion-collapse").setAttribute("aria-hidden", String(!isActive));
    });
    updateVisibility();

    // Measure the settled, natural target height before overriding it for
    // the FLIP animation below, so the progress bar's math (which reads
    // live layout) reflects the real final state rather than a
    // mid-animation one.
    const nextToHeight = nextItem.getBoundingClientRect().height;

    // Always show a newly active section from the start of its content,
    // never wherever it happened to be scrolled to last time it was open.
    bodyOf(index).scrollTop = 0;
    resetOverscroll();
    updateProgressBounds();
    updateProgress();

    animateItemHeight(prevItem, prevFromHeight, 0);
    animateItemHeight(nextItem, 0, nextToHeight);

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
      updateProgress();
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
    if (passedEl && e.target.closest(".accordion-passed") === passedEl) {
      activate(activeIndex - 1);
      return;
    }
    if (remainingEl && e.target.closest(".accordion-remaining") === remainingEl) {
      activate(activeIndex + 1);
    }
  });

  document.addEventListener("i18n:applied", (e) => {
    if (e.detail && e.detail["common.listJoiner"]) joiner = e.detail["common.listJoiner"];
    updatePassed();
    updateRemaining();
    // Translated text can wrap differently, changing section heights.
    remeasure();
  });

  // Section heights change with viewport width (text reflow), so the
  // progress total needs recomputing after a resize settles.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(remeasure, 150);
  });

  updateVisibility();
  remeasure();
})();
