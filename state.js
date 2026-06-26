// =====================================================================
// state.js — Estado global con persistencia localStorage
// WC26 Nerdytics · Vanilla
// =====================================================================
//
// Maneja:
//   - Favoritos de equipos (localStorage)
//   - Historial de predicciones (localStorage)
//   - Settings (tema, idioma, auto-refresh, densidad)
//   - Suscriptores para reactividad básica
// =====================================================================

const LS_PREFIX = 'wc26_';
const LS_KEYS = {
  favorites:        LS_PREFIX + 'favorites',
  predictions:      LS_PREFIX + 'predictions',
  settings:         LS_PREFIX + 'settings',
  recentSearches:   LS_PREFIX + 'recent_searches',
  history:          LS_PREFIX + 'history_v1',
  customBracket:    LS_PREFIX + 'custom_bracket_v1',
};

// =====================================================================
// STORAGE HELPERS
// =====================================================================

function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`LS load error [${key}]`, err);
    return fallback;
  }
}

function saveLS(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`LS save error [${key}]`, err);
  }
}

// =====================================================================
// FAVORITOS
// =====================================================================

let favorites = new Set(loadLS(LS_KEYS.favorites, []));
const favSubs = new Set();

function getFavorites() {
  return Array.from(favorites);
}

function isFavorite(code) {
  return favorites.has(code);
}

function toggleFavorite(code) {
  if (favorites.has(code)) {
    favorites.delete(code);
  } else {
    favorites.add(code);
  }
  saveLS(LS_KEYS.favorites, Array.from(favorites));
  favSubs.forEach(fn => {
    try { fn(getFavorites()); } catch (e) { console.warn(e); }
  });
}

function subscribeFavorites(fn) {
  favSubs.add(fn);
  return () => favSubs.delete(fn);
}

// =====================================================================
// HISTORIAL DE PREDICCIONES
// =====================================================================

let predictions = loadLS(LS_KEYS.predictions, []);
const predSubs = new Set();

/**
 * Registra una predicción.
 * @param {object} p - { id, ts, teamA, teamB, predicted, actual?, correct? }
 */
function addPrediction(p) {
  const entry = {
    id: `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    ...p,
  };
  predictions.unshift(entry);
  // Limitar a 200
  if (predictions.length > 200) predictions = predictions.slice(0, 200);
  saveLS(LS_KEYS.predictions, predictions);
  predSubs.forEach(fn => {
    try { fn(predictions); } catch (e) { console.warn(e); }
  });
  return entry;
}

function getPredictions() { return [...predictions]; }

function clearPredictions() {
  predictions = [];
  saveLS(LS_KEYS.predictions, predictions);
  predSubs.forEach(fn => fn(predictions));
}

function subscribePredictions(fn) {
  predSubs.add(fn);
  return () => predSubs.delete(fn);
}

function getPredictionStats() {
  const total = predictions.length;
  const resolved = predictions.filter(p => p.correct !== null && p.correct !== undefined);
  const correct = resolved.filter(p => p.correct === true).length;
  const accuracy = resolved.length > 0 ? (correct / resolved.length * 100) : null;
  let currentStreak = 0;
  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i].correct) currentStreak++;
    else break;
  }
  let bestStreak = 0, runStreak = 0;
  for (const p of resolved) {
    if (p.correct) { runStreak++; bestStreak = Math.max(bestStreak, runStreak); }
    else runStreak = 0;
  }
  return { total, resolved: resolved.length, correct, accuracy, currentStreak, bestStreak };
}

// =====================================================================
// SETTINGS
// =====================================================================

const DEFAULT_SETTINGS = {
  theme: 'dark',           // 'dark' | 'light' | 'auto'
  language: 'es',          // 'es' | 'en' (siempre traducimos API, pero UI puede ser inglés)
  autoRefreshMs: 30000,    // 15s/30s/1min/5min/off
  timezone: 'local',       // 'local' | 'utc'
  density: 'comfortable',  // 'compact' | 'comfortable'
  showOriginalNews: false, // mostrar texto original de ESPN
  notifications: false,
  reducedMotion: false,
};

let settings = { ...DEFAULT_SETTINGS, ...loadLS(LS_KEYS.settings, {}) };
const setSubs = new Set();

function getSettings() { return { ...settings }; }

function updateSettings(patch) {
  settings = { ...settings, ...patch };
  saveLS(LS_KEYS.settings, settings);
  applyTheme();
  applyDensity();
  applyReducedMotion();
  setSubs.forEach(fn => {
    try { fn(settings); } catch (e) { console.warn(e); }
  });
}

function subscribeSettings(fn) {
  setSubs.add(fn);
  return () => setSubs.delete(fn);
}

function applyTheme() {
  const html = document.documentElement;
  const theme = settings.theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : settings.theme;
  html.dataset.theme = theme;
}

function applyDensity() {
  document.documentElement.dataset.density = settings.density;
}

function applyReducedMotion() {
  if (settings.reducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  } else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.classList.remove('reduce-motion');
  }
}

// =====================================================================
// RECENT SEARCHES
// =====================================================================

let recentSearches = loadLS(LS_KEYS.recentSearches, []);

function addRecentSearch(query) {
  if (!query || !query.trim()) return;
  recentSearches = recentSearches.filter(q => q !== query);
  recentSearches.unshift(query);
  if (recentSearches.length > 10) recentSearches = recentSearches.slice(0, 10);
  saveLS(LS_KEYS.recentSearches, recentSearches);
}

function getRecentSearches() { return [...recentSearches]; }

// =====================================================================
// CUSTOM BRACKET (Eliminatorias)
// =====================================================================

let customBracket = loadLS(LS_KEYS.customBracket, {});

function setBracketPick(matchId, winnerCode) {
  customBracket[matchId] = winnerCode;
  saveLS(LS_KEYS.customBracket, customBracket);
}

function getBracketPicks() { return { ...customBracket }; }

function clearBracket() {
  customBracket = {};
  saveLS(LS_KEYS.customBracket, customBracket);
}

// =====================================================================
// BRACKET AUTO-SIMULATE (El usuario hace sus picks manuales)
// =====================================================================

// =====================================================================
// EXPORTS
// =====================================================================

export {
  LS_KEYS,
  DEFAULT_SETTINGS,
  getFavorites,
  isFavorite,
  toggleFavorite,
  subscribeFavorites,
  addPrediction,
  getPredictions,
  clearPredictions,
  subscribePredictions,
  getPredictionStats,
  getSettings,
  updateSettings,
  subscribeSettings,
  applyTheme,
  applyDensity,
  applyReducedMotion,
  addRecentSearch,
  getRecentSearches,
  setBracketPick,
  getBracketPicks,
  clearBracket,
};
