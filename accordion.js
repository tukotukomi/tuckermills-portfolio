(function () {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  if (!items.length) return;
  const headers = items.map((item) => item.querySelector(".accordion-header"));

  const root = items[0].closest(".slide");
  if (!root) return;

  function openItem(item) {
    items.forEach((el) => {
      const isTarget = el === item;
      el.classList.toggle("is-open", isTarget);
      el.querySelector(".accordion-header").setAttribute("aria-expanded", String(isTarget));
      el.querySelector(".accordion-collapse").setAttribute("aria-hidden", String(!isTarget));
    });
  }

  const headerHpx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 110;

  // IntersectionObserver reacts to *any* layout change, including the ones
  // our own accordion-open/close CSS transition causes as it reflows every
  // header below it -- that self-triggering is what turns into a feedback
  // loop or a wrong multi-step cascade. A plain `scroll` event only fires
  // when scrollTop itself changes, which our transitions never do (they
  // reflow content under a fixed scroll position), so listening for scroll
  // instead sidesteps the problem instead of patching around it. Pick
  // whichever header sits topmost within a band just below the fixed page
  // header.
  function evaluate() {
    const bandTop = headerHpx - 20;
    const bandBottom = root.clientHeight * 0.75;
    const candidate = headers
      .map((h) => ({ h, top: h.getBoundingClientRect().top }))
      .filter((c) => c.top >= bandTop && c.top <= bandBottom)
      .sort((a, b) => a.top - b.top)[0];
    if (!candidate) return;
    const target = candidate.h.closest(".accordion-item");
    if (!target.classList.contains("is-open")) openItem(target);
  }

  // Clicking a header already makes an explicit, unambiguous choice -- but
  // the scrollIntoView it triggers fires its own run of scroll events
  // while the section is simultaneously growing, and letting evaluate()
  // react to that mid-flight geometry can override the click with a
  // different section entirely. Suppress scroll-driven re-evaluation for
  // a moment after a click so the deliberate choice sticks.
  let suppressUntil = 0;

  document.addEventListener("click", (e) => {
    const header = e.target.closest(".accordion-header");
    if (!header) return;
    const item = header.closest(".accordion-item");
    openItem(item);
    suppressUntil = Date.now() + 1650;
    // scrollIntoView computes its target position once, up front -- calling
    // it immediately targets where the item is *before* its own height
    // transition finishes growing/collapsing everything around it. Wait
    // for that to settle first so it scrolls to the real final position.
    setTimeout(() => item.scrollIntoView({ behavior: "smooth", block: "start" }), 650);
  });

  let scrollTimer = null;
  root.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (Date.now() < suppressUntil) return;
      evaluate();
    }, 120);
  });

  // In case the browser restores a non-zero scroll position on reload.
  evaluate();
})();
