(function () {
  document.addEventListener("click", (e) => {
    const header = e.target.closest(".accordion-header");
    if (!header) return;

    const expanded = header.getAttribute("aria-expanded") === "true";
    const panel = document.getElementById(header.getAttribute("aria-controls"));

    header.setAttribute("aria-expanded", String(!expanded));
    header.closest(".accordion-item").classList.toggle("is-open", !expanded);
    if (panel) panel.setAttribute("aria-hidden", String(expanded));
  });
})();
