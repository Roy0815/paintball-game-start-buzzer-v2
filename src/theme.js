// Light/dark mode. The choice lives in localStorage rather than IndexedDB
// because the inline script in index.html has to read it synchronously before
// the first paint; otherwise a forced theme would flash the other one.
// Losing it (e.g. Safari's storage eviction) just falls back to "system".

const KEY = 'theme';
// Must match the background tokens in style.css.
const STATUS_BAR = { dark: '#161826', light: '#e4e7f5' };
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

/** @type {'system' | 'light' | 'dark'} */
let pref = readStored();

function readStored() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function getThemePref() {
  return pref;
}

export function setThemePref(value) {
  pref = value === 'light' || value === 'dark' ? value : 'system';
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Storage blocked: the choice still holds until the app is closed.
  }
  applyTheme();
}

function applyTheme() {
  const theme =
    pref === 'system' ? (systemLight.matches ? 'light' : 'dark') : pref;
  document.documentElement.dataset.theme = theme;
  // Both theme-color metas carry a media query for the system setting; a
  // forced theme has to override whichever of them is currently active.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.content = STATUS_BAR[theme];
  }
}

export function initTheme() {
  applyTheme();
  systemLight.addEventListener('change', applyTheme);
}
