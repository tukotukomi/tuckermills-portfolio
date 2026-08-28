(function () {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  if (!items.length) return;

  const page = items[0].closest(".page-professional");
  if (!page) return;

  const TRANSITION_MS = 650; // matches the accordion-item flex-grow transition (0.6s) plus a buffer

  let activeIndex = items.findIndex((item) => item.classList.contains("is-open"));
  if (activeIndex === -1) activeIndex = 0;
  let transitioning = false;

  function bodyOf(index) {
    return items[index].querySelector(".accordion-body");
  }

  // Only the single most recently collapsed section stays visible above
  // the active one; anything passed further back is hidden entirely so
  // scrolling down doesn't accumulate a long, ever-growing list of headers.
  function updateVisibility() {
    items.forEach((item, i) => {
      item.classList.toggle("is-far-passed", i < activeIndex - 1);
    });
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
  // gesture collapse the current section and expand the next/previous one.
  function handleDelta(deltaY) {
    if (transitioning || deltaY === 0) return;
    const body = bodyOf(activeIndex);
    if (deltaY > 0) {
      if (!isAtBottom(body)) {
        body.scrollTop += deltaY;
        return;
      }
      activate(activeIndex + 1);
    } else {
      if (!isAtTop(body)) {
        body.scrollTop += deltaY;
        return;
      }
      activate(activeIndex - 1);
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

  // Touch: let the browser's own native touch scrolling handle the common
  // case (dragging within a section that isn't yet at its edge) so it
  // keeps its normal momentum/inertia feel. Only step in -- preventDefault
  // and drive the transition ourselves -- once the active section is
  // already at the edge the drag is pulling past, since native scrolling
  // has nothing to do there but rubber-band.
  let touchY = null;
  page.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  page.addEventListener(
    "touchmove",
    (e) => {
      if (touchY === null || transitioning) return;
      const y = e.touches[0].clientY;
      const deltaY = touchY - y;
      const body = bodyOf(activeIndex);
      if (deltaY > 0 && isAtBottom(body)) {
        e.preventDefault();
        touchY = y;
        activate(activeIndex + 1);
      } else if (deltaY < 0 && isAtTop(body)) {
        e.preventDefault();
        touchY = y;
        activate(activeIndex - 1);
      } else {
        touchY = y;
      }
    },
    { passive: false }
  );
  page.addEventListener(
    "touchend",
    () => {
      touchY = null;
    },
    { passive: true }
  );

  document.addEventListener("click", (e) => {
    const header = e.target.closest(".accordion-header");
    if (!header) return;
    activate(items.indexOf(header.closest(".accordion-item")));
  });

  updateVisibility();
})();
