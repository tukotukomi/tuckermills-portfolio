(function () {
  const items = Array.from(document.querySelectorAll(".accordion-item"));
  if (!items.length) return;
  const headers = items.map((item) => item.querySelector(".accordion-header"));
  const headings = items.map((item) => item.querySelector(".accordion-heading"));

  const root = items[0].closest(".slide");
  const bottomStack = document.getElementById("bottom-stack");
  if (!root || !bottomStack) return;

  const headerHpx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 110;

  function openItem(item) {
    items.forEach((el) => {
      const isTarget = el === item;
      el.classList.toggle("is-open", isTarget);
      el.querySelector(".accordion-header").setAttribute("aria-expanded", String(isTarget));
      el.querySelector(".accordion-collapse").setAttribute("aria-hidden", String(!isTarget));
    });
    updateStack();
  }

  function scrollHeadingIntoView(heading) {
    // scrollIntoView computes its target position once, up front -- calling
    // it immediately targets where the item is *before* its own height
    // transition finishes growing/collapsing everything around it. Wait
    // for that to settle first so it scrolls to the real final position.
    setTimeout(() => heading.scrollIntoView({ behavior: "smooth", block: "start" }), 650);
  }

  // Sections up to and including the active one stay in normal flow and
  // stick to the top (their natural position is always trying to scroll
  // past the threshold during ordinary downward scrolling, so sticky
  // reliably holds them in place). Sections after the active one are
  // hidden in place and instead represented in the fixed bottom-stack
  // overlay -- see the .bottom-stack rule in styles.css for why sticky
  // `bottom` doesn't work for these.
  function updateStack() {
    const rowH = headings[0].offsetHeight;
    const activeIndex = items.findIndex((item) => item.classList.contains("is-open"));

    items.forEach((item, index) => {
      const heading = headings[index];
      if (index <= activeIndex) {
        heading.style.visibility = "";
        heading.style.top = `${headerHpx + index * rowH}px`;
      } else {
        heading.style.visibility = "hidden";
      }
    });

    bottomStack.innerHTML = "";
    items.slice(activeIndex + 1).forEach((item) => {
      const label = item.querySelector(".accordion-label").textContent;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bottom-stack-btn";
      btn.innerHTML = '<img src="Images/Icons/expand-circle.svg" alt="" class="accordion-icon">';
      btn.append(label);
      btn.addEventListener("click", () => {
        openItem(item);
        suppressUntil = Date.now() + 1650;
        scrollHeadingIntoView(item.querySelector(".accordion-heading"));
      });
      bottomStack.appendChild(btn);
    });
  }

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
    const bandTop = headerHpx - 60;
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
    scrollHeadingIntoView(item.querySelector(".accordion-heading"));
  });

  let scrollTimer = null;
  root.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (Date.now() < suppressUntil) return;
      evaluate();
    }, 120);
  });

  // String loading is async, so the initial call below can run before the
  // real translated label text is in the DOM; and switching languages
  // later needs the already-built bottom-stack buttons refreshed too.
  document.addEventListener("i18n:applied", updateStack);

  updateStack();
  // In case the browser restores a non-zero scroll position on reload.
  evaluate();
})();
