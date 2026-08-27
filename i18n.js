(function () {
  const DEFAULT_LANG = "en";

  function detectLang() {
    return new URLSearchParams(window.location.search).get("lang") || DEFAULT_LANG;
  }

  async function loadStrings(lang) {
    const res = await fetch(`strings/${lang}.json`);
    if (!res.ok) {
      if (lang === DEFAULT_LANG) throw new Error(`Missing strings/${DEFAULT_LANG}.json`);
      return loadStrings(DEFAULT_LANG);
    }
    return res.json();
  }

  function applyStrings(strings) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (strings[key] !== undefined) el.textContent = strings[key];
    });
    if (strings["site.title"]) document.title = strings["site.title"];
  }

  loadStrings(detectLang()).then(applyStrings).catch(console.error);
})();
