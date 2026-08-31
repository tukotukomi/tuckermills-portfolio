(function () {
  const DEFAULT_LANG = "en";
  const LANGUAGES = {
    en: { label: "English", file: "en.json" },
    "zh-cn": { label: "中文（简体）", file: "zh-cn.json" },
  };
  const STORAGE_KEY = "lang";

  function detectLang() {
    const param = new URLSearchParams(window.location.search).get("lang");
    if (param && LANGUAGES[param]) return param;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES[stored]) return stored;
    return DEFAULT_LANG;
  }

  async function loadStrings(lang) {
    const file = (LANGUAGES[lang] || LANGUAGES[DEFAULT_LANG]).file;
    const res = await fetch(`strings/${file}`);
    if (!res.ok) {
      if (lang === DEFAULT_LANG) throw new Error(`Missing strings/${file}`);
      return loadStrings(DEFAULT_LANG);
    }
    return res.json();
  }

  function applyStrings(strings) {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (strings[key] === undefined) return;
      // Opt-in only: plain textContent is the safe default everywhere
      // else. data-i18n-html is for the rare string that genuinely needs
      // embedded markup (e.g. an inline link in a paragraph) -- every
      // string using it is static site copy the site owner authors
      // directly in strings/*.json, never user input, so innerHTML here
      // isn't an XSS concern the way it would be for untrusted content.
      if (el.hasAttribute("data-i18n-html")) el.innerHTML = strings[key];
      else el.textContent = strings[key];
    });
    if (strings["site.title"]) document.title = strings["site.title"];
    document.dispatchEvent(new CustomEvent("i18n:applied", { detail: strings }));
  }

  function renderMenu(currentLang) {
    const menu = document.getElementById("lang-menu");
    const currentLabel = document.getElementById("lang-current");
    if (!menu || !currentLabel) return;

    menu.innerHTML = "";
    Object.entries(LANGUAGES).forEach(([code, { label }]) => {
      const li = document.createElement("li");
      li.textContent = label;
      li.setAttribute("role", "option");
      li.setAttribute("data-lang", code);
      li.setAttribute("aria-selected", String(code === currentLang));
      if (code === currentLang) li.classList.add("selected");
      li.addEventListener("click", () => selectLang(code));
      menu.appendChild(li);
    });

    currentLabel.textContent = LANGUAGES[currentLang].label;
  }

  function initSwitcherToggle() {
    const toggle = document.getElementById("lang-toggle");
    const menu = document.getElementById("lang-menu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      menu.hidden = expanded;
    });

    document.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    });
  }

  async function selectLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    const strings = await loadStrings(lang);
    applyStrings(strings);
    renderMenu(lang);
  }

  const lang = detectLang();
  loadStrings(lang)
    .then((strings) => {
      applyStrings(strings);
      renderMenu(lang);
      initSwitcherToggle();
    })
    .catch(console.error);
})();
