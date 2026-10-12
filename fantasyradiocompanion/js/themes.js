// The Windows app's "Custom Theme 1-8" looks, for the web app. Each has a tint (the average colour of its texture, from src/Theming.cs) and
// a texture tile exported from the app's own generator (web/tools/export-themes.ps1 -> assets/themes/t1..t8.png). Index 0 is the plain
// look the web app always had.
export const THEMES = [
  { id: 'default' },
  { id: 't1', n: 1, tint: [14, 20, 72] },
  { id: 't2', n: 2, tint: [78, 86, 106] },
  { id: 't3', n: 3, tint: [28, 40, 118] },
  { id: 't4', n: 4, tint: [38, 46, 58] },
  { id: 't5', n: 5, tint: [86, 62, 142] },
  { id: 't6', n: 6, tint: [12, 18, 66] },
  { id: 't7', n: 7, tint: [124, 72, 60] },
  { id: 't8', n: 8, tint: [14, 22, 68] },
];

const shade = (c, f) => c.map(v => Math.max(0, Math.min(255, Math.round(v * f))));
const rgb = c => 'rgb(' + c.join(',') + ')';
const VARS = ['--bg', '--panel', '--panel2', '--line', '--list', '--bar-bg', '--foot-bg', '--pane-bg', '--play', '--text', '--muted', '--tex', '--bar-line'];

/** Applies a theme (an index into THEMES) to the page. 0 puts everything back to the stylesheet's own values. */
export function applyTheme(index) {
  const root = document.documentElement;
  const th = THEMES[index] || THEMES[0];
  const meta = document.querySelector('meta[name=theme-color]');
  if (!th.tint) {
    for (const v of VARS) root.style.removeProperty(v);
    root.classList.remove('themed');
    root.removeAttribute('data-theme');
    if (meta) meta.setAttribute('content', '#14123a');
    return;
  }
  const T = th.tint;
  const set = (k, v) => root.style.setProperty(k, v);
  const tex = 'url("' + new URL('assets/themes/' + th.id + '.png', document.baseURI).href + '")';
  const veil = a => 'linear-gradient(rgba(6,8,30,' + a[0] + '), rgba(6,8,30,' + a[1] + '))';   // keeps text readable over a bright texture
  set('--tex', tex);
  set('--bg', rgb(shade(T, 0.55)));
  set('--panel', rgb(shade(T, 0.70)));
  set('--panel2', rgb(shade(T, 1.15)));
  set('--list', rgb(shade(T, 0.38)));
  set('--line', 'rgb(140,164,236)');
  set('--bar-line', rgb(shade(T, 1.5)));
  set('--bar-bg', veil([0.25, 0.5]) + ', ' + tex + ', ' + rgb(shade(T, 0.85)));
  set('--foot-bg', veil([0.4, 0.62]) + ', ' + tex + ', ' + rgb(shade(T, 0.6)));
  set('--pane-bg', veil([0.5, 0.5]) + ', ' + tex + ', ' + rgb(shade(T, 0.7)));
  set('--play', 'rgb(50,84,190)');
  set('--text', 'rgb(242,244,255)');
  set('--muted', 'rgb(178,192,232)');
  root.classList.add('themed');
  root.setAttribute('data-theme', th.id);
  if (meta) meta.setAttribute('content', rgb(shade(T, 0.85)));
}
