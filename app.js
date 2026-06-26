// =====================================================================
// app.js — FIFA World Cup 2026 · Nerdytics · Vanilla
// Refactor completo: i18n, comparador, favoritos, historial, PWA, a11y
// =====================================================================

import {
  translate, translateEventType, translateStatName, translatePlayerName,
  translateStatus, translateRoundName, translateStage,
} from './i18n.js';

import {
  loadAllMatches, loadTodaysMatches, getMatchSummary, getWorldCupNews,
  espnEventToMatch, clearEspnCache, STATUS_SHORT_MAP, STATUS_DESC_MAP,
} from './espn.js';

import {
  predictMatch, compareTeams, enrichTeam, clamp,
} from './predictor.js';

import {
  simulateTournament, simulateTournamentSync, cancelSimulation,
} from './montecarlo.js';

import {
  getFavorites, isFavorite, toggleFavorite, subscribeFavorites,
  addPrediction, getPredictions, clearPredictions, subscribePredictions,
  getPredictionStats,
  getSettings, updateSettings, subscribeSettings,
  applyTheme, applyDensity, applyReducedMotion,
  addRecentSearch, getRecentSearches,
  setBracketPick, getBracketPicks, clearBracket,
  DEFAULT_SETTINGS,
} from './state.js';

// =====================================================================
// REFERENCIAS GLOBALES (necesarias porque algunos módulos esperan window)
// =====================================================================

window.TEAM_BY_CODE = window.TEAM_BY_CODE || Object.fromEntries(
  (window.STATIC_TEAMS || []).map(t => [t.fifaCode, t])
);

// =====================================================================
// ESTADO RUNTIME (en memoria, no persistido)
// =====================================================================

const runtime = {
  activeTab: 'dashboard',
  matches: [],
  standings: null,
  news: [],
  tourneySim: null,        // Resultado de última simulación MC
  tourneySimLoading: false,
  refreshTimer: null,
  lastUpdate: Date.now(),
  currentMatchDetail: null,
  currentDetailSummary: null,
};

// =====================================================================
// CONSTANTES UI
// =====================================================================

const STATUS_LABEL = {
  SCHEDULED: 'Programado',
  LIVE:      'EN JUEGO',
  FINISHED:  'Final',
  POSTPONED: 'Aplazado',
};

const TABS = [
  { id: 'dashboard', label: 'Centro de Mando', icon: '📊' },
  { id: 'groups',    label: 'Fase de Grupos',  icon: '🗂️' },
  { id: 'teams',     label: 'Equipos',         icon: '👥', badge: '48' },
  { id: 'compare',   label: 'Comparador',      icon: '⚖️', badge: 'NEW' },
  { id: 'matches',   label: 'Calendario',      icon: '📅' },
  { id: 'news',      label: 'Noticias',        icon: '📰', badge: 'LIVE' },
  { id: 'favorites', label: 'Mis favoritos',   icon: '⭐', badge: '0' },
  { id: 'predictor', label: 'Oráculo IA',      icon: '🧠', badge: 'IA' },
  { id: 'predictions',label:'Mis predicciones', icon: '🎯', badge: '0' },
  { id: 'knockouts', label: 'Eliminatorias',   icon: '🌐' },
  { id: 'simulator', label: 'Monte Carlo',     icon: '⚡', badge: '10k' },
  { id: 'dsports',   label: 'DSports TV',      icon: '📺', badge: '12' },
  { id: 'settings',  label: 'Ajustes',         icon: '⚙️' },
  { id: 'tester',    label: 'API Tester',      icon: '🖥️', badge: 'DEV' },
];

// =====================================================================
// HELPERS DE FORMATO
// =====================================================================

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtTimeLocal(iso, useUtc = false) {
  if (!iso) return '—:—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—:—';
    if (useUtc || getSettings().timezone === 'utc') {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    }
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—:—'; }
}

function fmtDate(iso, opts = {}) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-ES', {
      weekday: opts.weekday || 'short',
      day: '2-digit',
      month: opts.month || 'short',
      year: opts.year,
    });
  } catch { return '—'; }
}

/**
 * Devuelve la fecha local en formato YYYY-MM-DD usando la zona horaria del PC.
 * Corrige el bug de usar toISOString() (UTC) que omitía partidos del día local
 * cuando el usuario está en husos negativos (ej. America/New_York UTC-4).
 */
function fmtLocalDateKey(input) {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtRelative(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const diffH = diffMs / 3.6e6;
    if (diffH < -24) return `en ${Math.round(-diffH / 24)}d`;
    if (diffH < 0) return `en ${Math.round(-diffH)}h`;
    if (diffH < 1) return 'hace <1h';
    if (diffH < 24) return `hace ${Math.round(diffH)}h`;
    return `hace ${Math.round(diffH / 24)}d`;
  } catch { return '—'; }
}

function fmtPct(n, decimals = 1) {
  return `${(+n).toFixed(decimals)}%`;
}

function rankColorClass(rank) {
  // Clases CSS reales (no Tailwind)
  if (rank <= 5)  return 'rank-elite';
  if (rank <= 15) return 'rank-top';
  if (rank <= 30) return 'rank-strong';
  return 'rank-normal';
}

function tierLabel(rank) {
  if (rank <= 5)  return { label: 'Élite',  cls: 'tier-elite' };
  if (rank <= 15) return { label: 'Top',    cls: 'tier-top' };
  if (rank <= 30) return { label: 'Fuerte', cls: 'tier-strong' };
  if (rank <= 50) return { label: 'Medio',  cls: 'tier-medio' };
  return            { label: 'Bajo',   cls: 'tier-low' };
}

// =====================================================================
// STANDINGS
// =====================================================================

function computeStandings(matches) {
  const standings = {};
  const groups = window.GROUPS_LIST || ['A','B','C','D','E','F','G','H','I','J','K','L'];

  groups.forEach(g => {
    const gTeams = (window.STATIC_TEAMS || []).filter(t => t.group === g);
    const stats = {};
    gTeams.forEach(t => {
      stats[t.fifaCode] = {
        ...t, pld: 0, w: 0, d: 0, l: 0,
        gf: 0, ga: 0, gd: 0, pts: 0,
      };
    });
    matches.filter(m => m.group === g && m.status === 'FINISHED').forEach(m => {
      const h = stats[m.home], a = stats[m.away];
      if (!h || !a) return;
      // ✅ FIX CRÍTICO: era `|=`, debe ser `+=`
      h.pld++; a.pld++;
      h.gf += m.homeScore || 0;
      h.ga += m.awayScore || 0;
      a.gf += m.awayScore || 0;
      a.ga += m.homeScore || 0;
      h.gd = h.gf - h.ga;
      a.gd = a.gf - a.ga;
      if (m.homeScore > m.awayScore)      { h.w++; h.pts += 3; a.l++; }
      else if (m.homeScore < m.awayScore) { a.w++; a.pts += 3; h.l++; }
      else                                { h.d++; a.d++; h.pts++; a.pts++; }
    });
    standings[g] = Object.values(stats).sort((a, b) =>
      b.pts - a.pts ||
      b.gd  - a.gd  ||
      b.gf  - a.gf  ||
      a.fifaRank - b.fifaRank
    );
  });
  return standings;
}

// =====================================================================
// ROUTER + RENDER
// =====================================================================

function render() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = TABS.map(t => `
    <button class="nav-btn ${runtime.activeTab === t.id ? 'active' : ''}"
            data-tab="${t.id}"
            aria-current="${runtime.activeTab === t.id ? 'page' : 'false'}"
            role="tab">
      <span class="left">
        <span class="nav-icon">${t.icon}</span>
        <span class="nav-label">${escapeHtml(t.label)}</span>
      </span>
      ${t.badge ? `<span class="nav-badge">${escapeHtml(t.badge)}</span>` : ''}
    </button>
  `).join('');
  nav.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => {
    const prev = runtime.activeTab;
    runtime.activeTab = b.dataset.tab;
    // Limpia recursos pesados al salir del tab DSports
    if (prev === 'dsports' && runtime.activeTab !== 'dsports') {
      try { cleanupDSports(); } catch {}
    }
    render();
    updateActiveBadge();
    updateUrlHash();
  }));

  const panel = document.querySelector('main.content .panel') || document.getElementById('panel');
  if (!panel) return;

  // Hide panel updates while modal is open to avoid destroying modal content
  if (document.body.classList.contains('modal-open')) return;

  // Lazy loading: cargar vista solo cuando se pide
  const renderers = {
    dashboard: () => renderDashboard(),
    groups:    () => renderGroups(),
    teams:     () => renderTeams(),
    compare:   () => renderCompare(),
    matches:   () => renderMatches(),
    news:      () => renderNews(),
    favorites: () => renderFavorites(),
    predictor: () => renderPredictor(),
    predictions:()=> renderPredictions(),
    knockouts: () => renderKnockouts(),
    simulator: () => renderSimulator(),
    dsports:   () => renderDSports(),
    settings:  () => renderSettings(),
    tester:    () => renderTester(),
  };
  const fn = renderers[runtime.activeTab] || renderDashboard;
  panel.innerHTML = fn();
  // Init
  const inits = {
    dashboard: initDashboard, groups: initGroups, teams: initTeams,
    compare: initCompare, matches: initMatches, news: initNews,
    favorites: initFavorites, predictor: initPredictor,
    predictions: initPredictions, knockouts: initKnockouts,
    simulator: initSimulator, dsports: initDSports, settings: initSettings, tester: initTester,
  };
  const init = inits[runtime.activeTab];
  if (init) {
    try { init(); } catch (err) { console.error('Init error:', err); }
  }
}

function updateActiveBadge() {
  // Update favorites badge
  const favBtn = document.querySelector('.nav-btn[data-tab="favorites"] .nav-badge');
  if (favBtn) {
    const count = getFavorites().length;
    favBtn.textContent = count > 0 ? String(count) : '0';
  }
  // Update predictions badge
  const predBtn = document.querySelector('.nav-btn[data-tab="predictions"] .nav-badge');
  if (predBtn) {
    const count = getPredictions().length;
    predBtn.textContent = count > 0 ? String(count) : '0';
  }
}

function updateUrlHash() {
  try { history.replaceState(null, '', `#${runtime.activeTab}`); } catch {}
}

// =====================================================================
// VIEWS
// =====================================================================

// ---- DASHBOARD ----
function renderDashboard() {
  const settings = getSettings();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsetMin = new Date().getTimezoneOffset();
  const offsetH = -offsetMin / 60;
  const offsetStr = `UTC${offsetH >= 0 ? '+' : ''}${offsetH}h`;

  return `
    <div class="fade-in view-dashboard" style="display: flex; flex-direction: column; gap: 1.5rem;">
      <!-- Tournament phase banner -->
      <div class="phase-banner" id="phaseBanner">
        <span class="dot dot-emerald pulse"></span>
        <span class="phase-label">Fase de Grupos · Jornada 1</span>
        <span class="phase-divider">·</span>
        <span class="phase-sub" id="phaseSubtitle">Cargando partidos…</span>
      </div>

      <!-- Hero -->
      <div class="hero">
        <div class="hero-grid-bg"></div>
        <div class="hero-content">
          <div class="hero-badges">
            <span class="badge badge-cyan">⚡ Mundial 2026 · Datos en tiempo real</span>
            <span class="badge badge-slate" id="lastUpdateBadge">—</span>
            ${settings.theme === 'dark' ? '<span class="badge badge-amber">🌙 Modo oscuro</span>' : '<span class="badge badge-amber">☀️ Modo claro</span>'}
          </div>
          <h1>La nerd-cup de los datos</h1>
          <p>48 equipos · 104 partidos · 16 sedes. Predicciones con IA Poisson + Dixon-Coles + Elo · simulación Monte Carlo con 50.000 escenarios.</p>
          <div class="hero-cta">
            <button class="btn btn-primary" data-jump="predictor">
              <span>🧠</span> Probar el Oráculo IA
            </button>
            <button class="btn btn-secondary" data-jump="simulator">
              <span>⚡</span> Simular torneo
            </button>
            <button class="btn btn-ghost" data-jump="compare">
              <span>⚖️</span> Comparar equipos
            </button>
          </div>
        </div>
      </div>

      <!-- KPI cards -->
      <div class="grid grid-4" id="dashStats">
        ${[1,2,3,4].map(() => '<div class="skeleton" style="height: 90px;"></div>').join('')}
      </div>

      <!-- Favoritos + highlights -->
      <div class="grid grid-2" id="dashMid">
        <div class="card" id="dashFavorites">
          <div class="card-header">
            <h3>🏆 Top favoritos al título</h3>
            <span class="meta-tag">Monte Carlo 2k</span>
          </div>
          <div class="skeleton" style="height: 200px;"></div>
        </div>
        <div class="card" id="dashHighlights">
          <div class="card-header">
            <h3>📈 Datos destacados</h3>
          </div>
          <div class="skeleton" style="height: 200px;"></div>
        </div>
      </div>

      <!-- Today + top FIFA -->
      <div class="grid grid-2" id="dashBottom">
        <div class="card">
          <div class="card-header">
            <h3>📅 Partidos de hoy</h3>
            <button class="btn btn-ghost btn-sm" data-jump="matches">Ver todos →</button>
          </div>
          <div id="dashToday" class="dash-today-list">
            <div class="skeleton" style="height: 60px;"></div>
            <div class="skeleton" style="height: 60px;"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>🌟 Top 5 FIFA Ranking</h3>
            <button class="btn btn-ghost btn-sm" data-jump="teams">Ver todos →</button>
          </div>
          <div id="dashTop5"></div>
        </div>
      </div>

      <!-- Momentum -->
      <div class="card">
        <div class="card-header">
          <h3>🔥 Momentum — mejor racha reciente</h3>
          <span class="meta-tag">Forma ≥ 65%</span>
        </div>
        <div class="grid grid-4" id="dashMomentum">
          ${[1,2,3,4].map(() => '<div class="skeleton" style="height: 80px;"></div>').join('')}
        </div>
      </div>
    </div>
  `;
}

async function initDashboard() {
  try {
    const matches = await loadAllMatches();
    runtime.matches = matches;
    runtime.standings = computeStandings(matches);
    const finished = matches.filter(m => m.status === 'FINISHED');
    const liveNow = matches.filter(m => m.status === 'LIVE');

    // Phase banner
    const phaseSub = document.getElementById('phaseSubtitle');
    if (phaseSub) {
      phaseSub.textContent = `${finished.length} partidos jugados · ${liveNow.length} en vivo ahora`;
    }

    const totalGoals = finished.reduce((s, m) => s + (m.homeScore || 0) + (m.awayScore || 0), 0);
    const avgElo = Math.round((window.STATIC_TEAMS || []).reduce((s, t) => s + t.elo, 0) / 48);
    const highestElo = (window.STATIC_TEAMS || []).reduce((a, b) => a.elo > b.elo ? a : b);
    const lowestElo = (window.STATIC_TEAMS || []).reduce((a, b) => a.elo < b.elo ? a : b);

    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card cyan">
        <div class="stat-value">48</div>
        <div class="stat-label">Equipos</div>
        <div class="stat-sublabel">12 grupos</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-value">${matches.length}</div>
        <div class="stat-label">Partidos cargados</div>
        <div class="stat-sublabel">${finished.length} finalizados · ${liveNow.length} en vivo</div>
      </div>
      <div class="stat-card amber">
        <div class="stat-value">${totalGoals}</div>
        <div class="stat-label">Goles totales</div>
        <div class="stat-sublabel">${finished.length > 0 ? (totalGoals / finished.length).toFixed(2) : 0} por partido</div>
      </div>
      <div class="stat-card emerald">
        <div class="stat-value">${avgElo}</div>
        <div class="stat-label">Elo promedio</div>
        <div class="stat-sublabel">${highestElo.flag} ${highestElo.name} (${highestElo.elo})</div>
      </div>
    `;

    // Top 3 favoritos (rápido)
    const tourney = simulateTournamentSync(2000);
    runtime.tourneySim = tourney;
    document.getElementById('dashFavorites').innerHTML = `
      <div class="card-header">
        <h3>🏆 Top favoritos al título</h3>
        <span class="meta-tag">Monte Carlo 2k</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${tourney.slice(0, 5).map((r, i) => `
          <button class="favorite-row" data-jump-team="${r.team.fifaCode}" title="Ver equipo">
            <div class="medal">${['🥇','🥈','🥉','4','5'][i]}</div>
            <div class="team-flag">${r.team.flag}</div>
            <div class="team-info">
              <div class="team-name">${escapeHtml(r.team.name)}</div>
              <div class="team-meta">FIFA #${r.team.fifaRank} · Elo ${r.team.elo} · Grupo ${r.team.group}</div>
            </div>
            <div class="pct">${r.probabilities.champion.toFixed(1)}%</div>
          </button>
        `).join('')}
      </div>
    `;

    // Highlights
    document.getElementById('dashHighlights').innerHTML = `
      <div class="card-header">
        <h3>📈 Datos destacados</h3>
      </div>
      <div class="highlight-row">
        <div class="highlight-label">Más fuerte (Elo)</div>
        <div class="highlight-value">
          <span class="team-flag-mini">${highestElo.flag}</span>
          <div>
            <div class="team-name-sm">${escapeHtml(highestElo.name)}</div>
            <div class="team-meta-sm">Elo ${highestElo.elo}</div>
          </div>
        </div>
      </div>
      <div class="highlight-row">
        <div class="highlight-label">Debutante / más bajo</div>
        <div class="highlight-value">
          <span class="team-flag-mini">${lowestElo.flag}</span>
          <div>
            <div class="team-name-sm">${escapeHtml(lowestElo.name)}</div>
            <div class="team-meta-sm">Elo ${lowestElo.elo}</div>
          </div>
        </div>
      </div>
      <div class="highlight-row death-group">
        <div class="highlight-label">🔥 Grupo de la muerte</div>
        <div class="highlight-value">
          <span class="team-flag-mini">💀</span>
          <div>
            <div class="team-name-sm">${(() => {
              const groups = {};
              (window.STATIC_TEAMS || []).forEach(t => {
                if (!groups[t.group]) groups[t.group] = [];
                groups[t.group].push(t.fifaRank);
              });
              let worst = { g: 'A', avg: Infinity };
              Object.entries(groups).forEach(([g, ranks]) => {
                const avg = ranks.reduce((s, r) => s + r, 0) / ranks.length;
                if (avg < worst.avg) worst = { g, avg };
              });
              return `Grupo ${worst.g} · avg FIFA #${worst.avg.toFixed(1)}`;
            })()}</div>
            <div class="team-meta-sm">Ranking FIFA más bajo en promedio</div>
          </div>
        </div>
      </div>
    `;

    // Today — usa la zona horaria LOCAL del PC (no UTC) para tomar todos
    // los partidos del día según el reloj del usuario.
    const today = fmtLocalDateKey(new Date());
    const todays = matches.filter(m => m.date && fmtLocalDateKey(m.date) === today);
    document.getElementById('dashToday').innerHTML = todays.length === 0
      ? '<div class="empty-state-sm">No hay partidos programados hoy.</div>'
      : todays.slice(0, 4).map(m => {
          const home = window.TEAM_BY_CODE[m.home];
          const away = window.TEAM_BY_CODE[m.away];
          if (!home || !away) return '';
          return `<button class="today-row" data-match-id="${m.id}" title="Ver detalle">
            <span class="team-flag-sm">${home.flag}</span>
            <span class="today-team">${escapeHtml(home.name)}</span>
            <span class="vs-mini">vs</span>
            <span class="today-team">${escapeHtml(away.name)}</span>
            <span class="team-flag-sm">${away.flag}</span>
            <span class="today-status">${m.status === 'LIVE' ? `<span class="badge-live">EN JUEGO</span>` : m.status === 'FINISHED' ? `<span class="mono">${m.homeScore}-${m.awayScore}</span>` : `<span class="mono">${fmtTimeLocal(m.date)}</span>`}</span>
          </button>`;
        }).join('');

    // Top 5 FIFA
    const top5 = [...(window.STATIC_TEAMS || [])].sort((a, b) => a.fifaRank - b.fifaRank).slice(0, 5);
    document.getElementById('dashTop5').innerHTML = top5.map((t, i) => `
      <button class="rank-row" data-jump-team="${t.fifaCode}" title="Ver equipo">
        <span class="rank-num ${rankColorClass(t.fifaRank)}">${i + 1}</span>
        <span class="team-flag-sm">${t.flag}</span>
        <div class="rank-info">
          <div class="team-name-sm">${escapeHtml(t.name)}</div>
          <div class="team-meta-sm">Elo ${t.elo} · G${t.group}</div>
        </div>
        <span class="${rankColorClass(t.fifaRank)} rank-value">#${t.fifaRank}</span>
      </button>
    `).join('');

    // Momentum (forma ≥ 0.65)
    const momentum = [...(window.STATIC_TEAMS || [])]
      .filter(t => (t.form || 0) >= 0.65)
      .sort((a, b) => b.form - a.form)
      .slice(0, 8);
    document.getElementById('dashMomentum').innerHTML = momentum.map(t => `
      <button class="momentum-card" data-jump-team="${t.fifaCode}" title="Ver equipo">
        <div class="momentum-flag">${t.flag}</div>
        <div class="momentum-info">
          <div class="team-name-sm">${escapeHtml(t.name)}</div>
          <div class="momentum-bar"><div class="momentum-fill" style="width:${(t.form*100).toFixed(0)}%"></div></div>
          <div class="momentum-meta">Forma ${(t.form*100).toFixed(0)}% · G${t.group}</div>
        </div>
      </button>
    `).join('');

    // Wire up jump buttons
    wireUpJumps();
  } catch (err) {
    console.error('Dashboard init error:', err);
    document.getElementById('dashStats').innerHTML = '<div class="error-state">Error cargando datos. <button class="btn btn-secondary" onclick="window.location.reload()">Reintentar</button></div>';
  }
}

function wireUpJumps() {
  document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', (e) => {
    const tab = b.dataset.jump;
    const nav = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
    if (nav) nav.click();
  }));
  document.querySelectorAll('[data-jump-team]').forEach(b => b.addEventListener('click', () => {
    const code = b.dataset.jumpTeam;
    runtime.activeTab = 'teams';
    render();
    setTimeout(() => {
      const input = document.getElementById('teamSearch');
      if (input) {
        input.value = code;
        input.dispatchEvent(new Event('input'));
      }
    }, 50);
  }));
  document.querySelectorAll('[data-match-id]').forEach(b => b.addEventListener('click', () => {
    const id = parseInt(b.dataset.matchId, 10);
    const m = runtime.matches.find(x => x.id === id);
    if (m) openMatchDetail(m);
  }));
}

// ---- GROUPS ----
function renderGroups() {
  return `
    <div class="fade-in view-groups" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>🗂️ Fase de Grupos</h2>
          <p class="subtitle">12 grupos · 4 equipos · Clasifican 1.º, 2.º y los 8 mejores 3.º</p>
        </div>
        <div class="flex gap-1" style="font-size: 11px; flex-wrap: wrap;">
          <span class="badge badge-cyan">1.º clasifica</span>
          <span class="badge badge-blue">2.º clasifica</span>
          <span class="badge badge-amber">3.º (top 8)</span>
        </div>
      </div>
      <div class="grid grid-3" id="groupsGrid">
        ${(window.GROUPS_LIST || []).map(() => '<div class="skeleton" style="height: 250px;"></div>').join('')}
      </div>
    </div>
  `;
}

async function initGroups() {
  const matches = await loadAllMatches();
  const standings = computeStandings(matches);
  const grid = document.getElementById('groupsGrid');
  if (!grid) return;
  grid.innerHTML = (window.GROUPS_LIST || []).map(g => {
    const teams = standings[g] || [];
    const avgRank = teams.reduce((s, t) => s + t.fifaRank, 0) / Math.max(1, teams.length);
    const diff = avgRank < 18 ? '🔥 Muerte' : avgRank > 35 ? 'Accesible' : 'Parejo';
    return `
      <div class="group-card">
        <div class="group-card-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="group-letter">${g}</span>
            <div>
              <h3>Grupo ${g}</h3>
              <div class="group-diff">${diff}</div>
            </div>
          </div>
          <span class="badge ${avgRank < 18 ? 'badge-rose' : 'badge-slate'}">avg #${avgRank.toFixed(0)}</span>
        </div>
        <table>
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>GF</th><th style="color: white;">Pts</th></tr></thead>
          <tbody>
            ${teams.map((t, idx) => {
              const cls = idx < 1 ? 'pos-1' : idx < 2 ? 'pos-2' : idx < 3 ? 'pos-3' : 'pos-other';
              return `
                <tr class="${cls}">
                  <td><span class="pos-num">${idx + 1}</span></td>
                  <td>
                    <button class="team-cell-btn" data-jump-team="${t.fifaCode}">
                      <span class="team-flag-sm">${t.flag}</span>
                      <div class="team-cell-info">
                        <div class="team-name-cell">${escapeHtml(t.name)}</div>
                        <div class="team-meta-cell">FIFA #${t.fifaRank}</div>
                      </div>
                    </button>
                  </td>
                  <td class="center mono">${t.pld}</td>
                  <td class="center mono ${t.gd > 0 ? 'gd-pos' : t.gd < 0 ? 'gd-neg' : 'gd-zero'}">${t.gd > 0 ? '+' : ''}${t.gd}</td>
                  <td class="center mono">${t.gf}</td>
                  <td class="center mono pts">${t.pts}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
  wireUpJumps();
}

// ---- TEAMS ----
function renderTeams() {
  const teams = window.STATIC_TEAMS || [];
  return `
    <div class="fade-in view-teams" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>👥 Los 48 equipos del Mundial</h2>
          <p class="subtitle">Sorteo oficial FIFA 5-dic-2025 · Ranking FIFA jun-2026</p>
        </div>
      </div>
      <div class="card filter-bar">
        <input type="search" id="teamSearch" placeholder="🔍 Buscar equipo..." class="input" aria-label="Buscar equipo" />
        <select id="teamConf" class="select" aria-label="Filtrar por confederación">
          <option value="ALL">Todas confederaciones</option>
          <option value="UEFA">UEFA</option>
          <option value="CONMEBOL">CONMEBOL</option>
          <option value="CAF">CAF</option>
          <option value="AFC">AFC</option>
          <option value="CONCACAF">CONCACAF</option>
          <option value="OFC">OFC</option>
        </select>
        <select id="teamGroup" class="select" aria-label="Filtrar por grupo">
          <option value="ALL">Todos los grupos</option>
          ${(window.GROUPS_LIST || []).map(g => `<option value="${g}">Grupo ${g}</option>`).join('')}
        </select>
        <select id="teamSort" class="select" aria-label="Ordenar">
          <option value="fifaRank">FIFA Rank ↑</option>
          <option value="elo">Elo ↑</option>
          <option value="attackStrength">Ataque ↑</option>
          <option value="defenseStrength">Defensa ↓</option>
          <option value="form">Forma ↑</option>
        </select>
        <label class="check-pill">
          <input type="checkbox" id="onlyFavorites" /> ⭐ Solo favoritos
        </label>
      </div>
      <div class="grid grid-4" id="teamsGrid"></div>
      <div id="teamsCount" class="text-center meta-tag"></div>
    </div>
  `;
}

function initTeams() {
  const search = document.getElementById('teamSearch');
  const conf = document.getElementById('teamConf');
  const group = document.getElementById('teamGroup');
  const sort = document.getElementById('teamSort');
  const onlyFav = document.getElementById('onlyFavorites');
  if (!search) return;

  function refresh() {
    let arr = window.STATIC_TEAMS || [];
    const q = search.value.toLowerCase();
    if (q) arr = arr.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.fifaCode.toLowerCase().includes(q) ||
      (t.confederation || '').toLowerCase().includes(q)
    );
    if (conf.value !== 'ALL') arr = arr.filter(t => t.confederation === conf.value);
    if (group.value !== 'ALL') arr = arr.filter(t => t.group === group.value);
    if (onlyFav.checked) arr = arr.filter(t => isFavorite(t.fifaCode));
    const sortKey = sort.value;
    const reverse = sortKey === 'defenseStrength';
    arr = [...arr].sort((a, b) => reverse ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]);

    document.getElementById('teamsGrid').innerHTML = arr.map(teamCardHTML).join('');
    document.getElementById('teamsCount').textContent = `Mostrando ${arr.length} de ${(window.STATIC_TEAMS || []).length} equipos`;
    wireUpJumps();
    document.querySelectorAll('[data-fav-toggle]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = b.dataset.favToggle;
      toggleFavorite(code);
      refresh();
    }));
  }
  search.addEventListener('input', refresh);
  conf.addEventListener('change', refresh);
  group.addEventListener('change', refresh);
  sort.addEventListener('change', refresh);
  onlyFav.addEventListener('change', refresh);
  refresh();
}

function teamCardHTML(t) {
  const tier = tierLabel(t.fifaRank);
  const fav = isFavorite(t.fifaCode);
  return `
    <div class="team-card">
      ${t.host ? '<div class="host-badge">🏠 sede</div>' : ''}
      <button class="fav-btn ${fav ? 'active' : ''}" data-fav-toggle="${t.fifaCode}" aria-label="${fav ? 'Quitar de favoritos' : 'Marcar como favorito'}">
        ${fav ? '⭐' : '☆'}
      </button>
      <div class="team-card-head">
        <div class="flag-xl">${t.flag}</div>
        <div class="team-card-name-block">
          <div class="team-name-lg">${escapeHtml(t.name)}</div>
          <div class="team-code">${t.fifaCode} · Grupo ${t.group}</div>
        </div>
      </div>
      <div class="flex gap-1 mt-2" style="flex-wrap: wrap;">
        <span class="tier ${tier.cls}">${tier.label}</span>
        <span class="tier tier-strong">Bombo ${t.pot}</span>
        <span class="conf-pill" style="--conf-color: ${window.CONFED_COLORS[t.confederation] || '#64748b'}">${t.confederation}</span>
      </div>
      <div class="stat-row-4">
        <div class="mini-stat"><div class="label">FIFA</div><div class="value ${rankColorClass(t.fifaRank)}">#${t.fifaRank}</div></div>
        <div class="mini-stat"><div class="label">Elo</div><div class="value mono">${t.elo}</div></div>
        <div class="mini-stat"><div class="label">ATQ</div><div class="value mono atk-color">${(+t.attackStrength).toFixed(2)}</div></div>
        <div class="mini-stat"><div class="label">DEF</div><div class="value mono def-color">${(+t.defenseStrength).toFixed(2)}</div></div>
      </div>
      <div class="form-row">
        <div class="form-label-row">
          <span class="form-label">Forma</span>
          <span class="mono form-value">${(t.form * 100).toFixed(0)}%</span>
        </div>
        <div class="form-bar"><div class="form-fill" style="width: ${t.form * 100}%"></div></div>
      </div>
    </div>
  `;
}

// ---- COMPARADOR (NUEVA VISTA) ----
function renderCompare() {
  const teamOptions = (window.GROUPS_LIST || []).map(g => {
    const ts = (window.STATIC_TEAMS || []).filter(t => t.group === g);
    return `<optgroup label="Grupo ${g}">${ts.map(t => `<option value="${t.fifaCode}">${t.fifaCode} · ${escapeHtml(t.name)}</option>`).join('')}</optgroup>`;
  }).join('');

  return `
    <div class="fade-in view-compare" style="display: flex; flex-direction: column; gap: 1rem; max-width: 1000px; margin: 0 auto;">
      <div class="section-header">
        <div>
          <h2>⚖️ Comparador de equipos</h2>
          <p class="subtitle">Análisis lado a lado con predicción integrada</p>
        </div>
      </div>

      <div class="card compare-selectors">
        <div class="compare-team-block">
          <span class="compare-label">Equipo A</span>
          <select id="cmpSelA" class="select" aria-label="Equipo A">${teamOptions}</select>
        </div>
        <div class="compare-vs">
          <div class="vs-icon">⚖️</div>
          <div class="vs-text">VS</div>
        </div>
        <div class="compare-team-block">
          <span class="compare-label">Equipo B</span>
          <select id="cmpSelB" class="select" aria-label="Equipo B">${teamOptions.replace('value="ARG"', 'value="FRA"')}</select>
        </div>
        <label class="check-pill">
          <input type="checkbox" id="cmpNeutral" checked /> 🏟️ Cancha neutral
        </label>
      </div>

      <div id="cmpResult"></div>
    </div>
  `;
}

function initCompare() {
  const selA = document.getElementById('cmpSelA');
  const selB = document.getElementById('cmpSelB');
  const neutral = document.getElementById('cmpNeutral');
  if (!selA) return;
  function refresh() {
    const a = window.TEAM_BY_CODE[selA.value];
    const b = window.TEAM_BY_CODE[selB.value];
    if (!a || !b || a.fifaCode === b.fifaCode) {
      document.getElementById('cmpResult').innerHTML = '<div class="empty-state">Selecciona dos equipos diferentes.</div>';
      return;
    }
    const cmp = compareTeams(a, b);
    const prediction = predictMatch(a, b, !neutral.checked);
    const aWins = (window.STATIC_H2H || {})[`${a.fifaCode}-${b.fifaCode}`];
    const bWins = (window.STATIC_H2H || {})[`${b.fifaCode}-${a.fifaCode}`];
    const h2h = aWins || bWins;
    const aH2HWins = aWins ? aWins.aWins : (bWins ? bWins.bWins : 0);
    const bH2HWins = aWins ? aWins.bWins : (bWins ? bWins.aWins : 0);
    const drawsH2H = aWins ? aWins.draws : (bWins ? bWins.draws : 0);

    document.getElementById('cmpResult').innerHTML = `
      <!-- Header -->
      <div class="card compare-header">
        <div class="compare-side">
          <div class="compare-flag-xl">${cmp.a.flag}</div>
          <div class="compare-team-name">${escapeHtml(cmp.a.name)}</div>
          <div class="compare-team-meta">${cmp.a.confederation} · Grupo ${cmp.a.group}</div>
        </div>
        <div class="compare-vs-center">
          <div class="compare-pred-big">
            <span class="${cmp.a.fifaCode === prediction.homeTeam.fifaCode ? 'win' : ''}">${prediction.probabilities.homeWin.toFixed(1)}%</span>
            <span class="dim">/</span>
            <span>${prediction.probabilities.draw.toFixed(1)}%</span>
            <span class="dim">/</span>
            <span class="${cmp.b.fifaCode === prediction.homeTeam.fifaCode ? 'win' : ''}">${prediction.probabilities.awayWin.toFixed(1)}%</span>
          </div>
          <div class="compare-pred-labels">
            <span>Gana A</span><span>Empate</span><span>Gana B</span>
          </div>
        </div>
        <div class="compare-side">
          <div class="compare-flag-xl">${cmp.b.flag}</div>
          <div class="compare-team-name">${escapeHtml(cmp.b.name)}</div>
          <div class="compare-team-meta">${cmp.b.confederation} · Grupo ${cmp.b.group}</div>
        </div>
      </div>

      <!-- Stats side by side -->
      <div class="card">
        <h3>📊 Comparación de estadísticas</h3>
        <div class="cmp-stats">
          ${cmp.stats.map(s => `
            <div class="cmp-stat-row">
              <div class="cmp-stat-a ${s.winner === 'a' ? 'winner' : ''}">${s.format(s.a)}</div>
              <div class="cmp-stat-label">${escapeHtml(s.label)}</div>
              <div class="cmp-stat-b ${s.winner === 'b' ? 'winner' : ''}">${s.format(s.b)}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Markets -->
      <div class="grid grid-2">
        <div class="card">
          <h3>📈 Mercados extendidos</h3>
          <div class="market-row">
            <div class="market-name">Más de 2.5 goles</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.over25}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.over25.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">Menos de 2.5 goles</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.under25}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.under25.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">Ambos equipos marcan</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.bttsYes}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.bttsYes.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">Ninguno marca</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.bttsNo}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.bttsNo.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">A marca primero</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.firstGoalHome}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.firstGoalHome.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">B marca primero</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.firstGoalAway}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.firstGoalAway.toFixed(1)}%</div>
          </div>
          <div class="market-row">
            <div class="market-name">Handicap asiático -1.5 A</div>
            <div class="market-bars">
              <div class="market-bar" style="width: ${prediction.markets.asianHomeMinus15}%"></div>
            </div>
            <div class="market-pct">${prediction.markets.asianHomeMinus15.toFixed(1)}%</div>
          </div>
        </div>

        <div class="card">
          <h3>🎯 Marcadores más probables</h3>
          <div class="cmp-score-list">
            ${prediction.topScores.slice(0, 8).map((s, i) => `
              <div class="cmp-score-row ${i === 0 ? 'top' : ''}">
                <div class="cmp-score-num">${s.home}-${s.away}</div>
                <div class="cmp-score-bar"><div class="cmp-score-fill" style="width: ${(s.probPct / prediction.topScores[0].probPct * 100)}%"></div></div>
                <div class="cmp-score-pct">${s.probPct}%</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      ${h2h ? `
      <div class="card">
        <h3>📜 Historial directo · ${h2h.played} partidos</h3>
        <div class="h2h-summary">
          <div class="h2h-side">
            <div class="h2h-num">${aH2HWins}</div>
            <div class="h2h-label">${escapeHtml(cmp.a.fifaCode)}</div>
          </div>
          <div class="h2h-side">
            <div class="h2h-num">${drawsH2H}</div>
            <div class="h2h-label">Empates</div>
          </div>
          <div class="h2h-side">
            <div class="h2h-num">${bH2HWins}</div>
            <div class="h2h-label">${escapeHtml(cmp.b.fifaCode)}</div>
          </div>
        </div>
        <div class="h2h-bar">
          <div class="h2h-bar-a" style="width: ${aH2HWins / h2h.played * 100}%"></div>
          <div class="h2h-bar-d" style="width: ${drawsH2H / h2h.played * 100}%"></div>
          <div class="h2h-bar-b" style="width: ${bH2HWins / h2h.played * 100}%"></div>
        </div>
        ${h2h.lastMeeting ? `<div class="h2h-last">Último enfrentamiento: ${h2h.lastMeeting} · ${h2h.lastScore}${h2h.notes ? ` · <em>${escapeHtml(h2h.notes)}</em>` : ''}</div>` : ''}
      </div>
      ` : ''}
    `;
  }
  selA.addEventListener('change', refresh);
  selB.addEventListener('change', refresh);
  neutral.addEventListener('change', refresh);
  refresh();
}

// ---- MATCHES ----
function renderMatches() {
  return `
    <div class="fade-in view-matches" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>📅 Calendario completo</h2>
          <p class="subtitle" id="matchesSub">Cargando partidos desde ESPN…</p>
        </div>
      </div>
      <div class="card filter-bar">
        <input type="search" id="mSearch" placeholder="🔍 Buscar equipo..." class="input" aria-label="Buscar equipo en partidos" />
        <select id="mStage" class="select" aria-label="Filtrar por fase">
          <option value="ALL">Todas las fases</option>
          <option value="GROUP">Fase de grupos</option>
        </select>
        <select id="mGroup" class="select" aria-label="Filtrar por grupo">
          <option value="ALL">Todos los grupos</option>
          ${(window.GROUPS_LIST || []).map(g => `<option value="${g}">Grupo ${g}</option>`).join('')}
        </select>
        <select id="mStatus" class="select" aria-label="Filtrar por estado">
          <option value="ALL">Todos</option>
          <option value="LIVE">En vivo</option>
          <option value="SCHEDULED">Programados</option>
          <option value="FINISHED">Finalizados</option>
        </select>
      </div>
      <div id="matchesList"><div class="skeleton" style="height: 400px;"></div></div>
    </div>
  `;
}

async function initMatches() {
  const matches = await loadAllMatches();
  runtime.matches = matches;
  const sub = document.getElementById('matchesSub');
  if (sub) sub.textContent = `${matches.length} partidos · click para ver detalles`;

  const search = document.getElementById('mSearch');
  const stage = document.getElementById('mStage');
  const group = document.getElementById('mGroup');
  const status = document.getElementById('mStatus');
  if (!search) return;

  function refresh() {
    let arr = matches;
    const q = search.value.toLowerCase();
    if (q) arr = arr.filter(m => {
      const home = window.TEAM_BY_CODE[m.home];
      const away = window.TEAM_BY_CODE[m.away];
      return (home && home.name.toLowerCase().includes(q)) ||
             (away && away.name.toLowerCase().includes(q)) ||
             (home && home.fifaCode.toLowerCase().includes(q)) ||
             (away && away.fifaCode.toLowerCase().includes(q));
    });
    if (stage.value !== 'ALL') arr = arr.filter(m => m.stage === stage.value);
    if (group.value !== 'ALL') arr = arr.filter(m => m.group === group.value);
    if (status.value !== 'ALL') arr = arr.filter(m => m.status === status.value);
    const byDate = {};
    arr.forEach(m => {
      if (!m.date) return;
      const k = m.date.slice(0, 10);
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push(m);
    });
    const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
    document.getElementById('matchesList').innerHTML = sorted.length === 0
      ? '<div class="empty-state">No hay partidos con esos filtros.</div>'
      : sorted.map(([date, ms]) => `
        <div class="match-day-block">
          <div class="match-day-header">
            <div class="match-day-label">${fmtDate(date + 'T12:00:00Z')}</div>
            <div class="match-day-line"></div>
            <div class="match-day-count">${ms.length} partido${ms.length === 1 ? '' : 's'}</div>
          </div>
          <div class="grid grid-2">${ms.map(matchCardHTML).join('')}</div>
        </div>
      `).join('');
    document.querySelectorAll('[data-match-id]').forEach(el => {
      el.addEventListener('click', () => {
        const m = matches.find(x => x.id === parseInt(el.dataset.matchId, 10));
        if (m) openMatchDetail(m);
      });
    });
  }
  search.addEventListener('input', debounce(refresh, 150));
  stage.addEventListener('change', refresh);
  group.addEventListener('change', refresh);
  status.addEventListener('change', refresh);
  refresh();
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function matchCardHTML(m) {
  const home = window.TEAM_BY_CODE[m.home];
  const away = window.TEAM_BY_CODE[m.away];
  if (!home || !away) return '';
  const isFinished = m.status === 'FINISHED';
  const isLive = m.status === 'LIVE';
  const isUpcoming = m.status === 'SCHEDULED';
  return `
    <div class="match-card" data-match-id="${m.id}" tabindex="0" role="button" aria-label="Ver detalle del partido ${escapeHtml(home.name)} vs ${escapeHtml(away.name)}">
      <div class="click-hint">Ver detalle →</div>
      <div class="match-card-top">
        <div class="flex gap-1" style="flex-wrap: wrap;">
          ${m.stage === 'GROUP' ? `<span class="stage-badge">G${m.group}</span>` : `<span class="stage-badge">${escapeHtml(m.round || m.stage)}</span>`}
          ${isFinished ? `<span class="status-ft">${escapeHtml(m.statusShort || 'FT')}</span>` : ''}
          ${isLive ? '<span class="status-live">● EN JUEGO</span>' : ''}
          ${m.status === 'POSTPONED' ? '<span class="status-ft" style="color:#fcd34d;">⏸ APLAZADO</span>' : ''}
        </div>
        <div class="match-card-times">
          <div class="time-local">${fmtTimeLocal(m.date)}<span class="time-local-label"> local</span></div>
          <div class="time-utc">${fmtTimeLocal(m.date, true)} UTC</div>
        </div>
      </div>
      <div class="match-card-body">
        <div class="team-side team-home">
          <span class="team-flag-sm">${home.flag}</span>
          <div class="team-cell-info">
            <div class="team-name-cell">${escapeHtml(home.name)}</div>
            <div class="team-meta-cell">FIFA #${home.fifaRank} · Elo ${home.elo}</div>
          </div>
        </div>
        <div class="match-score-block">
          ${(isFinished || isLive)
            ? `<div class="score-big">${m.homeScore ?? 0} - ${m.awayScore ?? 0}</div>${isLive && m.minute ? `<div class="match-minute">${m.minute}'</div>` : ''}`
            : `<div class="vs-text">VS</div>`}
        </div>
        <div class="team-side team-away">
          <span class="team-flag-sm">${away.flag}</span>
          <div class="team-cell-info">
            <div class="team-name-cell">${escapeHtml(away.name)}</div>
            <div class="team-meta-cell">FIFA #${away.fifaRank} · Elo ${away.elo}</div>
          </div>
        </div>
      </div>
      <div class="match-card-bottom">
        <span class="venue-text">📍 ${escapeHtml(m.venue || '—')}</span>
        <span class="city-text">🌐 ${escapeHtml(m.city || '—')}</span>
      </div>
    </div>
  `;
}

// ---- MATCH DETAIL MODAL ----
async function openMatchDetail(match) {
  runtime.currentMatchDetail = match;
  document.body.classList.add('modal-open');

  const home = window.TEAM_BY_CODE[match.home];
  const away = window.TEAM_BY_CODE[match.away];
  if (!home || !away) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  const statusLabel = STATUS_LABEL[match.status] || match.statusDescription || match.status;
  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'LIVE';

  overlay.innerHTML = `
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <button class="modal-close" aria-label="Cerrar modal">✕</button>
        <div class="modal-badges">
          ${match.stage === 'GROUP' ? `<span class="stage-badge">Grupo ${match.group}</span>` : `<span class="stage-badge">${escapeHtml(match.round || match.stage)}</span>`}
          ${isFinished ? `<span class="status-ft">${escapeHtml(match.statusShort || 'Final')}</span>` : ''}
          ${isLive ? '<span class="status-live">● EN JUEGO</span>' : ''}
          ${match.status === 'POSTPONED' ? '<span class="status-ft" style="color:#fcd34d;">⏸ Aplazado</span>' : ''}
        </div>
        <div class="modal-score-row" id="modal-title">
          <div class="modal-team">
            <span class="modal-flag">${home.flag}</span>
            <span class="modal-team-name">${escapeHtml(home.name)}</span>
            <span class="modal-team-meta">FIFA #${home.fifaRank} · Elo ${home.elo}</span>
          </div>
          <div class="modal-score-center">
            ${(isFinished || isLive)
              ? `<div class="modal-score-big"><span>${match.homeScore ?? 0}</span><span class="dim">-</span><span>${match.awayScore ?? 0}</span></div>${isLive && match.minute ? `<div class="modal-minute">${match.minute}'</div>` : ''}`
              : `<div class="modal-vs">VS</div><div class="modal-when">${fmtDate(match.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>`}
            <div class="modal-status-text">${escapeHtml(statusLabel)}</div>
          </div>
          <div class="modal-team">
            <span class="modal-flag">${away.flag}</span>
            <span class="modal-team-name">${escapeHtml(away.name)}</span>
            <span class="modal-team-meta">FIFA #${away.fifaRank} · Elo ${away.elo}</span>
          </div>
        </div>
        <div class="modal-times-row">
          <span>🕒 ${fmtTimeLocal(match.date)} local</span>
          <span>🌐 ${fmtTimeLocal(match.date, true)} UTC</span>
          <span>📍 ${escapeHtml(match.venue || '—')}</span>
          <span>${escapeHtml(match.city || '—')}${match.country ? ', ' + escapeHtml(match.country) : ''}</span>
        </div>
      </div>
      <div class="tabs" role="tablist">
        <button class="tab-btn active" data-tab="stats" role="tab">📊 Estadísticas</button>
        <button class="tab-btn" data-tab="events" role="tab">⚽ Eventos</button>
        <button class="tab-btn" data-tab="leaders" role="tab">🏆 Jugadores</button>
        <button class="tab-btn" data-tab="h2h" role="tab">📜 H2H</button>
        <button class="tab-btn" data-tab="predict" role="tab">🧠 Predicción</button>
        <button class="tab-btn" data-tab="news" role="tab">📰 Noticias</button>
      </div>
      <div class="modal-body" id="modalBody">
        <div class="loading-state">
          <div class="spin">⚙️</div>
          <p>Cargando datos de ESPN…</p>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMatchDetail();
  });
  overlay.querySelector('.modal-close').addEventListener('click', closeMatchDetail);

  overlay.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    overlay.querySelectorAll('.tab-btn').forEach(x => {
      x.classList.remove('active');
      x.setAttribute('aria-selected', 'false');
    });
    b.classList.add('active');
    b.setAttribute('aria-selected', 'true');
    renderModalTab(b.dataset.tab, match);
  }));

  // Focus management
  overlay.querySelector('.modal-close').focus();
  document.addEventListener('keydown', trapFocus);

  // Load summary in background
  if (match.espnId) {
    try {
      const summary = await getMatchSummary(match.espnId);
      runtime.currentDetailSummary = summary;
      renderModalTab('stats', match, summary);
    } catch (err) {
      console.warn('Summary error:', err);
      const body = document.getElementById('modalBody');
      if (body) body.innerHTML = '<div class="error-state">No se pudieron cargar los detalles.</div>';
    }
  } else {
    const body = document.getElementById('modalBody');
    if (body) body.innerHTML = '<div class="empty-state">ID de ESPN no disponible para este partido.</div>';
  }
}

function closeMatchDetail() {
  document.body.classList.remove('modal-open');
  document.removeEventListener('keydown', trapFocus);
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  runtime.currentMatchDetail = null;
  runtime.currentDetailSummary = null;
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const overlay = document.querySelector('.modal-overlay');
  if (!overlay) return;
  const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function renderModalTab(tab, match, summary) {
  summary = summary || runtime.currentDetailSummary;
  const body = document.getElementById('modalBody');
  if (!body) return;

  if (tab === 'stats') {
    if (!summary) {
      body.innerHTML = '<div class="loading-state"><div class="spin">⚙️</div><p>Cargando…</p></div>';
      return;
    }
    const homeStats = summary.boxscore?.teams?.find(t => t.team.abbreviation === match.home);
    const awayStats = summary.boxscore?.teams?.find(t => t.team.abbreviation === match.away);
    if (!homeStats || !awayStats) {
      body.innerHTML = '<div class="empty-state">📊 Las estadísticas estarán disponibles cuando el partido termine.</div>';
      return;
    }
    const hMap = Object.fromEntries(homeStats.statistics.map(s => [s.name, s]));
    const aMap = Object.fromEntries(awayStats.statistics.map(s => [s.name, s]));
    // Use ALL keys (already translated by i18n)
    const allKeys = [...new Set([...Object.keys(hMap), ...Object.keys(aMap)])];
    body.innerHTML = `
      <h3 class="mb-2">📊 Estadísticas del partido</h3>
      <div class="modal-stats">
        ${allKeys.map(k => {
          const h = hMap[k], a = aMap[k];
          const label = translateStatName(k);
          const hVal = h?.displayValue || '0';
          const aVal = a?.displayValue || '0';
          const hNum = parseFloat(hVal) || 0;
          const aNum = parseFloat(aVal) || 0;
          const total = hNum + aNum;
          const hp = total > 0 ? (hNum / total * 100) : 50;
          return `<div class="modal-stat-row">
            <div class="modal-stat-val modal-stat-h">${escapeHtml(hVal)}</div>
            <div class="modal-stat-label">
              <div class="modal-stat-bar">
                <div class="modal-stat-fill-h" style="width: ${hp}%"></div>
                <div class="modal-stat-fill-a" style="width: ${100 - hp}%"></div>
              </div>
              <div class="modal-stat-name">${escapeHtml(label)}</div>
            </div>
            <div class="modal-stat-val modal-stat-a">${escapeHtml(aVal)}</div>
          </div>`;
        }).join('')}
      </div>
    `;
  } else if (tab === 'events') {
    if (!summary) {
      body.innerHTML = '<div class="loading-state"><div class="spin">⚙️</div><p>Cargando…</p></div>';
      return;
    }
    const events = (summary.keyEvents || []).filter(e => e.type?.text && !e.type.text.toLowerCase().includes('delay'));
    if (events.length === 0) {
      body.innerHTML = '<div class="empty-state">⚽ No hay eventos registrados todavía.</div>';
      return;
    }
    body.innerHTML = `
      <h3 class="mb-2">⚽ Incidencias del partido</h3>
      <div class="modal-events">
        ${events.map(e => {
          const evText = e.type.textEs || translateEventType(e.type.text);
          const t = evText.toLowerCase();
          const isGoal = t.includes('gol');
          const isCard = t.includes('tarjeta') || t.includes('amarilla') || t.includes('roja');
          const isSub = t.includes('sustituci');
          const color = isGoal ? 'event-goal' : isCard ? 'event-card' : isSub ? 'event-sub' : 'event-info';
          const icon = isGoal ? '⚽' : isCard ? '🟨' : isSub ? '🔄' : '•';
          const playerText = e.shortText || e.athletesInvolved?.[0]?.athlete?.shortNameEs || e.athletesInvolved?.[0]?.athlete?.displayName || '';
          return `<div class="modal-event-row">
            <div class="modal-event-time">${e.clock?.displayValue || "?"}'</div>
            <div class="modal-event-icon ${color}">${icon}</div>
            <div class="modal-event-content">
              <div class="modal-event-type ${color}">${escapeHtml(evText)}</div>
              <div class="modal-event-player">${escapeHtml(playerText)}</div>
            </div>
            ${e.homeScore !== undefined && e.homeScore !== null ? `<div class="modal-event-score mono">${e.homeScore} - ${e.awayScore}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
  } else if (tab === 'leaders') {
    if (!summary) {
      body.innerHTML = '<div class="loading-state"><div class="spin">⚙️</div><p>Cargando…</p></div>';
      return;
    }
    const leaders = summary.leaders || [];
    if (leaders.length === 0) {
      body.innerHTML = '<div class="empty-state">🏆 Los jugadores destacados aparecerán después del partido.</div>';
      return;
    }
    body.innerHTML = `
      <h3 class="mb-2">🏆 Jugadores destacados</h3>
      <div class="grid grid-2">
        ${leaders.map(tl => {
          const isHome = tl.team?.abbreviation === match.home;
          const t = window.TEAM_BY_CODE[match[isHome ? 'home' : 'away']];
          return `<div class="card leaders-card">
            <div class="leaders-team">${t?.flag || '🏳️'} ${escapeHtml(tl.team?.abbreviation || '')}</div>
            ${(tl.leaders || []).map(l => {
              const cat = l.displayNameEs || translate(l.displayName || '');
              const top = l.leaders?.[0];
              if (!top) return '';
              const playerName = top.athlete?.shortNameEs || top.athlete?.displayNameEs || top.athlete?.shortName || top.athlete?.displayName || '—';
              return `<div class="leader-row">
                <span class="leader-cat">${escapeHtml(cat)}</span>
                <span class="leader-val mono">${escapeHtml(playerName)} <span class="dim">(${escapeHtml(top.displayValue || '0')})</span></span>
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    `;
  } else if (tab === 'h2h') {
    const a = window.TEAM_BY_CODE[match.home];
    const b = window.TEAM_BY_CODE[match.away];
    const aH2H = (window.STATIC_H2H || {})[`${a.fifaCode}-${b.fifaCode}`];
    const bH2H = (window.STATIC_H2H || {})[`${b.fifaCode}-${a.fifaCode}`];
    const h2h = aH2H || bH2H;
    if (!h2h) {
      body.innerHTML = `<div class="empty-state">📜 No hay historial directo verificado entre ${escapeHtml(a.name)} y ${escapeHtml(b.name)}.</div>`;
      return;
    }
    const aWins = aH2H ? aH2H.aWins : bH2H.bWins;
    const bWins = aH2H ? aH2H.bWins : bH2H.aWins;
    const draws = h2h.draws;
    body.innerHTML = `
      <h3 class="mb-2">📜 Historial directo · ${h2h.played} partidos</h3>
      <div class="h2h-summary">
        <div class="h2h-side">
          <div class="h2h-num">${aWins}</div>
          <div class="h2h-label">${escapeHtml(a.name)}</div>
        </div>
        <div class="h2h-side">
          <div class="h2h-num">${draws}</div>
          <div class="h2h-label">Empates</div>
        </div>
        <div class="h2h-side">
          <div class="h2h-num">${bWins}</div>
          <div class="h2h-label">${escapeHtml(b.name)}</div>
        </div>
      </div>
      <div class="h2h-bar">
        <div class="h2h-bar-a" style="width: ${aWins / h2h.played * 100}%"></div>
        <div class="h2h-bar-d" style="width: ${draws / h2h.played * 100}%"></div>
        <div class="h2h-bar-b" style="width: ${bWins / h2h.played * 100}%"></div>
      </div>
      <div class="h2h-meta">
        <div><strong>Último encuentro:</strong> ${h2h.lastMeeting || '—'}</div>
        <div><strong>Resultado:</strong> ${h2h.lastScore || '—'}</div>
        ${h2h.notes ? `<div class="h2h-notes"><em>${escapeHtml(h2h.notes)}</em></div>` : ''}
      </div>
    `;
  } else if (tab === 'predict') {
    const a = window.TEAM_BY_CODE[match.home];
    const b = window.TEAM_BY_CODE[match.away];
    const prediction = predictMatch(a, b, false);
    body.innerHTML = `
      <h3 class="mb-2">🧠 Predicción del modelo</h3>
      <div class="card predict-result">
        <div class="prob-row">
          <div class="label"><span>Gana ${escapeHtml(a.name)}</span><span class="pct" style="color:#22d3ee;">${prediction.probabilities.homeWin.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill cyan" style="width: ${prediction.probabilities.homeWin}%"></div></div>
        </div>
        <div class="prob-row">
          <div class="label"><span>Empate</span><span class="pct" style="color:#94a3b8;">${prediction.probabilities.draw.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill slate" style="width: ${prediction.probabilities.draw}%"></div></div>
        </div>
        <div class="prob-row">
          <div class="label"><span>Gana ${escapeHtml(b.name)}</span><span class="pct" style="color:#a855f7;">${prediction.probabilities.awayWin.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill purple" style="width: ${prediction.probabilities.awayWin}%"></div></div>
        </div>
        <div class="grid grid-3 mt-3">
          <div class="mini-stat"><div class="label">xG ${escapeHtml(a.fifaCode)}</div><div class="value mono">${prediction.expectedGoals.home}</div></div>
          <div class="mini-stat"><div class="label">Marcador modal</div><div class="value mono">${prediction.modalScore.home}-${prediction.modalScore.away}</div></div>
          <div class="mini-stat"><div class="label">xG ${escapeHtml(b.fifaCode)}</div><div class="value mono">${prediction.expectedGoals.away}</div></div>
        </div>
        <div class="grid grid-3 mt-3">
          <div class="mini-stat"><div class="label">+2.5 goles</div><div class="value mono">${prediction.markets.over25.toFixed(1)}%</div></div>
          <div class="mini-stat"><div class="label">Ambos marcan</div><div class="value mono">${prediction.markets.bttsYes.toFixed(1)}%</div></div>
          <div class="mini-stat"><div class="label">${escapeHtml(a.fifaCode)} marca primero</div><div class="value mono">${prediction.markets.firstGoalHome.toFixed(1)}%</div></div>
        </div>
        <button class="btn btn-primary mt-3" id="savePredBtn">💾 Guardar predicción</button>
      </div>
    `;
    const saveBtn = document.getElementById('savePredBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      addPrediction({
        matchId: match.id,
        teamA: a.fifaCode,
        teamB: b.fifaCode,
        predicted: { home: prediction.modalScore.home, away: prediction.modalScore.away },
        homeWin: prediction.probabilities.homeWin,
        draw: prediction.probabilities.draw,
        awayWin: prediction.probabilities.awayWin,
        correct: null,
      });
      saveBtn.textContent = '✓ Predicción guardada';
      saveBtn.disabled = true;
    });
  } else if (tab === 'news') {
    const news = (summary?.news?.articles || runtime.news).slice(0, 10);
    if (news.length === 0) {
      body.innerHTML = '<div class="empty-state">📰 No hay noticias disponibles.</div>';
      return;
    }
    body.innerHTML = `
      <h3 class="mb-2">📰 Cobertura mediática</h3>
      <div class="modal-news-list">
        ${news.map(n => {
          const isNew = n.ageHours !== undefined ? n.ageHours < 3 : (Date.now() - new Date(n.published || 0).getTime() < 3.6e6);
          const headline = n.headlineEs || n.headline || '';
          const desc = n.descriptionEs || n.description || '';
          const mentionedHtml = (n.mentionedTeams || []).slice(0, 2).map(t =>
            `<span class="badge badge-slate">${t.flag} ${escapeHtml(t.name)}</span>`
          ).join(' ');
          return `<a href="${escapeHtml(n.links?.web?.href || '#')}" target="_blank" rel="noopener" class="news-card">
            <div class="flex gap-2 items-start">
              <div class="flex-1">
                <div class="flex gap-1 mb-1" style="flex-wrap: wrap;">
                  ${n.typeEs ? `<span class="tier tier-cyan" style="font-size: 9px;">${escapeHtml(n.typeEs)}</span>` : ''}
                  ${isNew ? '<span class="badge badge-emerald" style="font-size: 9px; padding: 1px 6px; animation: pulse 2s infinite;">NUEVO</span>' : ''}
                  <span class="meta-tag">${escapeHtml(fmtRelative(n.published))}</span>
                  ${mentionedHtml}
                </div>
                <div class="news-headline">${escapeHtml(headline)}</div>
                ${desc ? `<div class="news-desc">${escapeHtml(desc)}</div>` : ''}
              </div>
              <span class="dim">↗</span>
            </div>
          </a>`;
        }).join('')}
      </div>
    `;
  }
}

// ---- NEWS ----
function renderNews() {
  return `
    <div class="fade-in view-news" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>📰 Noticias del Mundial</h2>
          <p class="subtitle" id="newsSub">Cargando feed de ESPN…</p>
        </div>
        <span class="badge badge-cyan">
          <span class="dot dot-emerald pulse"></span> ESPN LIVE
        </span>
      </div>
      <div class="card filter-bar">
        <input type="search" id="newsSearch" placeholder="🔍 Buscar en noticias..." class="input" style="flex:1;" aria-label="Buscar en noticias" />
        <select id="newsType" class="select" aria-label="Tipo de noticia"><option value="ALL">Todos los tipos</option></select>
        <select id="newsTeam" class="select" aria-label="Filtrar por equipo">
          <option value="ALL">Todos los equipos</option>
          ${(window.STATIC_TEAMS || []).map(t => `<option value="${t.fifaCode}">${t.flag} ${escapeHtml(t.name)}</option>`).join('')}
        </select>
      </div>
      <div class="grid grid-4">
        <div class="stat-card cyan"><div class="stat-value" id="newsCountTotal">0</div><div class="stat-label">Total</div></div>
        <div class="stat-card emerald"><div class="stat-value" id="newsCountHour">0</div><div class="stat-label">Última hora</div></div>
        <div class="stat-card purple"><div class="stat-value" id="newsCountStory">0</div><div class="stat-label">Reportajes</div></div>
        <div class="stat-card amber"><div class="stat-value" id="newsCountHead">0</div><div class="stat-label">Titulares</div></div>
      </div>
      <div id="newsList" class="news-list">
        ${[1,2,3,4].map(() => '<div class="skeleton" style="height: 100px;"></div>').join('')}
      </div>
    </div>
  `;
}

async function initNews() {
  try {
    const news = await getWorldCupNews(50);
    runtime.news = news;
    const sub = document.getElementById('newsSub');
    if (sub) sub.textContent = `${news.length} artículos · auto-refresh 60s`;

    const search = document.getElementById('newsSearch');
    const type = document.getElementById('newsType');
    const teamFilter = document.getElementById('newsTeam');
    if (!search) return;

    const types = ['ALL', ...new Set(news.map(n => n.type).filter(Boolean))];
    type.innerHTML = types.map(t => {
      const es = translate(t);
      return `<option value="${t}">${t === 'ALL' ? 'Todos los tipos' : escapeHtml(es + ' / ' + t)}</option>`;
    }).join('');

    document.getElementById('newsCountTotal').textContent = news.length;
    document.getElementById('newsCountHour').textContent = news.filter(n => (n.ageHours || 99) < 1).length;
    document.getElementById('newsCountStory').textContent = news.filter(n => n.type === 'Story').length;
    document.getElementById('newsCountHead').textContent = news.filter(n => n.type === 'HeadlineNews').length;

    function refresh() {
      const q = search.value.toLowerCase();
      const t = type.value;
      const tf = teamFilter.value;
      let arr = news.filter(n => {
        if (t !== 'ALL' && n.type !== t) return false;
        if (tf !== 'ALL') {
          const mentioned = n.mentionedTeams || [];
          if (!mentioned.some(team => team.fifaCode === tf)) return false;
        }
        if (q) {
          const hay = ((n.headline || '') + ' ' + (n.description || '')).toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }).sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));

      document.getElementById('newsList').innerHTML = arr.length === 0
        ? '<div class="empty-state">📰 No hay noticias con esos filtros.</div>'
        : arr.map(n => {
            const isNew = (n.ageHours || 99) < 1;
            const headline = n.headlineEs || n.headline || '';
            const desc = n.descriptionEs || n.description || '';
            const thumb = n.images?.[0]?.url;
            const mentionedHtml = (n.mentionedTeams || []).slice(0, 3).map(t =>
              `<span class="badge badge-slate">${t.flag} ${escapeHtml(t.name)}</span>`
            ).join(' ');
            return `<a href="${escapeHtml(n.links?.web?.href || '#')}" target="_blank" rel="noopener" class="news-card">
              <div class="flex gap-3">
                <div class="news-thumb">
                  ${thumb ? `<img src="${escapeHtml(thumb)}" loading="lazy" onerror="this.style.display='none'" alt="">` : '<span class="news-thumb-icon">📰</span>'}
                </div>
                <div class="flex-1">
                  <div class="flex gap-1 mb-1" style="flex-wrap: wrap; align-items: center;">
                    ${n.typeEs ? `<span class="tier tier-cyan" style="font-size: 9px;">${escapeHtml(n.typeEs)}</span>` : ''}
                    ${isNew ? '<span class="badge badge-emerald" style="font-size: 9px; padding: 1px 6px; animation: pulse 2s infinite;">NUEVO</span>' : ''}
                    <span class="meta-tag">${escapeHtml(fmtRelative(n.published))}</span>
                    ${mentionedHtml}
                  </div>
                  <h3 class="news-headline">${escapeHtml(headline)}</h3>
                  ${desc ? `<div class="news-desc">${escapeHtml(desc)}</div>` : ''}
                </div>
                <span class="dim news-arrow">↗</span>
              </div>
            </a>`;
          }).join('');
    }
    search.addEventListener('input', debounce(refresh, 150));
    type.addEventListener('change', refresh);
    teamFilter.addEventListener('change', refresh);
    refresh();
  } catch (err) {
    console.error('News init error:', err);
    document.getElementById('newsList').innerHTML = '<div class="error-state">Error cargando noticias.</div>';
  }
}

// ---- FAVORITES (NEW VIEW) ----
function renderFavorites() {
  const favs = getFavorites();
  return `
    <div class="fade-in view-favorites" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>⭐ Mis favoritos</h2>
          <p class="subtitle">${favs.length === 0 ? 'Marca equipos como favoritos en la vista de equipos.' : `${favs.length} equipos marcados`}</p>
        </div>
      </div>
      ${favs.length === 0
        ? `<div class="empty-state-lg">
            <div class="empty-icon">⭐</div>
            <h3>No tienes favoritos aún</h3>
            <p>Ve a la sección <a href="#" data-jump="teams">Equipos</a> y marca los que quieras seguir.</p>
          </div>`
        : `<div class="grid grid-4" id="favoritesGrid">${favs.map(teamCardHTML).join('')}</div>`}
    </div>
  `;
}

function initFavorites() {
  wireUpJumps();
  document.querySelectorAll('[data-fav-toggle]').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFavorite(b.dataset.favToggle);
    runtime.activeTab = 'favorites';
    render();
  }));
}

// ---- PREDICTOR ----
function renderPredictor() {
  const groups = {};
  (window.STATIC_TEAMS || []).forEach(t => { if (!groups[t.group]) groups[t.group] = []; groups[t.group].push(t); });
  const teamOptions = Object.entries(groups).map(([g, ts]) =>
    `<optgroup label="Grupo ${g}">${ts.map(t => `<option value="${t.fifaCode}">${t.fifaCode} · ${escapeHtml(t.name)}</option>`).join('')}</optgroup>`
  ).join('');

  return `
    <div class="fade-in view-predictor" style="display: flex; flex-direction: column; gap: 1.25rem; max-width: 900px; margin: 0 auto;">
      <div style="text-align: center;">
        <div class="predictor-icon-big">🧠</div>
        <h2>Oráculo IA · Nerdytics</h2>
        <p class="subtitle" style="max-width: 600px; margin: 0 auto;">
          Modelo Poisson bivariado + Dixon-Coles τ + sistema Elo ponderado (70/30). Ingresa cualquier enfrentamiento.
        </p>
      </div>

      <div class="card predictor-input">
        <div class="predictor-selectors">
          <div class="predictor-team-block team-a">
            <span class="predictor-label">Equipo A</span>
            <div id="predTeamA" class="predictor-team-display"></div>
            <select id="predSelA" class="select" aria-label="Equipo A">${teamOptions}</select>
          </div>
          <div class="predictor-vs">
            <div class="predictor-vs-icon">⚔️</div>
            <span class="predictor-vs-text">VS</span>
          </div>
          <div class="predictor-team-block team-b">
            <span class="predictor-label">Equipo B</span>
            <div id="predTeamB" class="predictor-team-display"></div>
            <select id="predSelB" class="select" aria-label="Equipo B">${teamOptions.replace('value="ARG"', 'value="FRA"')}</select>
          </div>
        </div>
        <div class="predictor-controls">
          <label class="check-pill">
            <input type="checkbox" id="predNeutral" checked /> 🏟️ Cancha neutral
          </label>
          <button class="btn btn-primary" id="predBtn">⚡ Calcular predicción</button>
        </div>
      </div>

      <div id="predResult"></div>
    </div>
  `;
}

function initPredictor() {
  const selA = document.getElementById('predSelA');
  const selB = document.getElementById('predSelB');
  if (!selA) return;
  function updateTeamDisplay() {
    const a = window.TEAM_BY_CODE[selA.value];
    const b = window.TEAM_BY_CODE[selB.value];
    document.getElementById('predTeamA').innerHTML = `
      <span class="team-flag-xl">${a.flag}</span>
      <div>
        <div class="team-name-lg">${escapeHtml(a.name)}</div>
        <div class="team-meta-cell">FIFA #${a.fifaRank} · Elo ${a.elo}</div>
      </div>
    `;
    document.getElementById('predTeamB').innerHTML = `
      <span class="team-flag-xl">${b.flag}</span>
      <div>
        <div class="team-name-lg">${escapeHtml(b.name)}</div>
        <div class="team-meta-cell">FIFA #${b.fifaRank} · Elo ${b.elo}</div>
      </div>
    `;
  }
  selA.addEventListener('change', updateTeamDisplay);
  selB.addEventListener('change', updateTeamDisplay);
  document.getElementById('predNeutral').addEventListener('change', () => calc());
  document.getElementById('predBtn').addEventListener('click', () => calc());
  updateTeamDisplay();
  calc();
}

function calc() {
  const selA = document.getElementById('predSelA');
  const selB = document.getElementById('predSelB');
  const neutral = document.getElementById('predNeutral');
  if (!selA) return;
  const a = window.TEAM_BY_CODE[selA.value];
  const b = window.TEAM_BY_CODE[selB.value];
  if (!a || !b || a.fifaCode === b.fifaCode) {
    document.getElementById('predResult').innerHTML = '<div class="empty-state">Selecciona dos equipos diferentes.</div>';
    return;
  }
  const isHome = !neutral.checked;
  const p = predictMatch(a, b, isHome);
  const aH2H = (window.STATIC_H2H || {})[`${a.fifaCode}-${b.fifaCode}`];
  const bH2H = (window.STATIC_H2H || {})[`${b.fifaCode}-${a.fifaCode}`];
  const h2h = aH2H || bH2H;
  const aWins = aH2H ? aH2H.aWins : (bH2H ? bH2H.bWins : 0);
  const bWins = aH2H ? aH2H.bWins : (bH2H ? bH2H.aWins : 0);
  const draws = h2h ? h2h.draws : 0;

  document.getElementById('predResult').innerHTML = `
    <div class="card predictor-result-card">
      <h3 style="text-align: center;">📊 Distribución de probabilidades</h3>
      <div class="prob-rows">
        <div class="prob-row">
          <div class="label"><span>Gana ${escapeHtml(a.fifaCode)}</span><span class="pct" style="color:#22d3ee;">${p.probabilities.homeWin.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill cyan" style="width: ${p.probabilities.homeWin}%"></div></div>
        </div>
        <div class="prob-row">
          <div class="label"><span>Empate</span><span class="pct" style="color:#94a3b8; font-size: 1.25rem;">${p.probabilities.draw.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill slate" style="width: ${p.probabilities.draw}%"></div></div>
        </div>
        <div class="prob-row">
          <div class="label"><span>Gana ${escapeHtml(b.fifaCode)}</span><span class="pct" style="color:#a855f7;">${p.probabilities.awayWin.toFixed(1)}%</span></div>
          <div class="bar"><div class="fill purple" style="width: ${p.probabilities.awayWin}%"></div></div>
        </div>
      </div>
      <div class="grid grid-3 mt-3">
        <div class="mini-stat"><div class="label">xG ${escapeHtml(a.fifaCode)}</div><div class="value mono">${p.expectedGoals.home}</div></div>
        <div class="mini-stat"><div class="label">Marcador modal</div><div class="value mono">${p.modalScore.home}-${p.modalScore.away}</div></div>
        <div class="mini-stat"><div class="label">xG ${escapeHtml(b.fifaCode)}</div><div class="value mono">${p.expectedGoals.away}</div></div>
      </div>
      <div class="flex gap-2 mt-3">
        <button class="btn btn-secondary" id="predSaveBtn">💾 Guardar predicción</button>
        <button class="btn btn-ghost" id="predShareBtn">📤 Compartir</button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>🎯 Marcadores más probables</h3>
        <div class="score-list">
          ${p.topScores.slice(0, 5).map((s, i) => `
            <div class="score-row ${i === 0 ? 'top' : ''}">
              <div class="score-num mono">${s.home}-${s.away}</div>
              <div class="score-bar"><div class="fill cyan" style="width: ${(s.probPct / p.topScores[0].probPct * 100)}%"></div></div>
              <div class="score-pct mono">${s.probPct}%</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <h3>📊 Descomposición del modelo</h3>
        <div class="mb-3">
          <div class="model-row-label">Solo Poisson</div>
          <div class="model-bar">
            <div class="model-fill-cyan" style="width: ${p.components.poisson.homeWin}%">${p.components.poisson.homeWin.toFixed(0)}%</div>
            <div class="model-fill-slate" style="width: ${p.components.poisson.draw}%">${p.components.poisson.draw.toFixed(0)}%</div>
            <div class="model-fill-purple" style="width: ${p.components.poisson.awayWin}%">${p.components.poisson.awayWin.toFixed(0)}%</div>
          </div>
        </div>
        <div>
          <div class="model-row-label">Solo Elo</div>
          <div class="model-bar">
            <div class="model-fill-cyan" style="width: ${p.components.elo.homeWin}%">${p.components.elo.homeWin.toFixed(0)}%</div>
            <div class="model-fill-slate" style="width: ${p.components.elo.draw}%">${p.components.elo.draw.toFixed(0)}%</div>
            <div class="model-fill-purple" style="width: ${p.components.elo.awayWin}%">${p.components.elo.awayWin.toFixed(0)}%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>📈 Mercados extendidos</h3>
      <div class="markets-grid">
        <div class="market-mini"><div class="market-name">Más 1.5</div><div class="market-pct">${p.markets.over15.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">Más 2.5</div><div class="market-pct">${p.markets.over25.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">Más 3.5</div><div class="market-pct">${p.markets.over35.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">Ambos marcan</div><div class="market-pct">${p.markets.bttsYes.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">${escapeHtml(a.fifaCode)} 1.er gol</div><div class="market-pct">${p.markets.firstGoalHome.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">${escapeHtml(b.fifaCode)} 1.er gol</div><div class="market-pct">${p.markets.firstGoalAway.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">HA -1.5 ${escapeHtml(a.fifaCode)}</div><div class="market-pct">${p.markets.asianHomeMinus15.toFixed(1)}%</div></div>
        <div class="market-mini"><div class="market-name">HA +1.5 ${escapeHtml(b.fifaCode)}</div><div class="market-pct">${p.markets.asianAwayPlus15.toFixed(1)}%</div></div>
      </div>
    </div>

    ${h2h ? `
    <div class="card">
      <h3>📜 Historial directo · ${h2h.played} partidos</h3>
      <div class="h2h-summary">
        <div class="h2h-side"><div class="h2h-num">${aWins}</div><div class="h2h-label">${escapeHtml(a.fifaCode)}</div></div>
        <div class="h2h-side"><div class="h2h-num">${draws}</div><div class="h2h-label">Empates</div></div>
        <div class="h2h-side"><div class="h2h-num">${bWins}</div><div class="h2h-label">${escapeHtml(b.fifaCode)}</div></div>
      </div>
      <div class="h2h-bar">
        <div class="h2h-bar-a" style="width: ${aWins / h2h.played * 100}%"></div>
        <div class="h2h-bar-d" style="width: ${draws / h2h.played * 100}%"></div>
        <div class="h2h-bar-b" style="width: ${bWins / h2h.played * 100}%"></div>
      </div>
      ${h2h.lastMeeting ? `<div class="h2h-meta"><strong>Último:</strong> ${h2h.lastMeeting} · ${h2h.lastScore}${h2h.notes ? ` · <em>${escapeHtml(h2h.notes)}</em>` : ''}</div>` : ''}
    </div>
    ` : ''}
  `;
  // Save button
  const saveBtn = document.getElementById('predSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    addPrediction({
      teamA: a.fifaCode,
      teamB: b.fifaCode,
      predicted: { home: p.modalScore.home, away: p.modalScore.away },
      homeWin: p.probabilities.homeWin,
      draw: p.probabilities.draw,
      awayWin: p.probabilities.awayWin,
      correct: null,
    });
    saveBtn.textContent = '✓ Guardada';
    saveBtn.disabled = true;
  });
  // Share button
  const shareBtn = document.getElementById('predShareBtn');
  if (shareBtn) shareBtn.addEventListener('click', async () => {
    const text = `⚽ ${a.flag} ${a.name} vs ${b.flag} ${b.name}\n🏆 ${p.probabilities.homeWin.toFixed(1)}% / ${p.probabilities.draw.toFixed(1)}% / ${p.probabilities.awayWin.toFixed(1)}%\n📊 Marcador modal: ${p.modalScore.home}-${p.modalScore.away}\n🧠 Nerdytics WC26`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Predicción WC26', text }); } catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      shareBtn.textContent = '✓ Copiado';
      setTimeout(() => { shareBtn.textContent = '📤 Compartir'; }, 2000);
    }
  });
}

// ---- PREDICTIONS HISTORY ----
function renderPredictions() {
  const preds = getPredictions();
  const stats = getPredictionStats();
  return `
    <div class="fade-in view-predictions" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>🎯 Mis predicciones</h2>
          <p class="subtitle">${preds.length === 0 ? 'Aún no has guardado ninguna predicción.' : `${preds.length} predicciones guardadas · ${stats.accuracy !== null ? stats.accuracy.toFixed(0) + '%' : '—'} de acierto`}</p>
        </div>
        ${preds.length > 0 ? '<button class="btn btn-ghost" id="clearPreds">🗑️ Limpiar historial</button>' : ''}
      </div>

      ${stats.total > 0 ? `
      <div class="grid grid-4">
        <div class="stat-card cyan"><div class="stat-value">${stats.total}</div><div class="stat-label">Predicciones</div></div>
        <div class="stat-card emerald"><div class="stat-value">${stats.resolved}</div><div class="stat-label">Resueltas</div></div>
        <div class="stat-card amber"><div class="stat-value">${stats.accuracy !== null ? stats.accuracy.toFixed(0) + '%' : '—'}</div><div class="stat-label">Aciertos</div></div>
        <div class="stat-card purple"><div class="stat-value">${stats.bestStreak}</div><div class="stat-label">Mejor racha</div></div>
      </div>
      ` : ''}

      <div class="card">
        <h3>📜 Historial</h3>
        ${preds.length === 0 ? '<div class="empty-state">Usa el Oráculo IA y guarda tus predicciones para verlas aquí.</div>' : `
        <table class="predictions-table">
          <thead>
            <tr><th>Fecha</th><th>Partido</th><th>Predicho</th><th>%</th><th>Resultado</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${preds.map(p => {
              const a = window.TEAM_BY_CODE[p.teamA];
              const b = window.TEAM_BY_CODE[p.teamB];
              if (!a || !b) return '';
              const dt = new Date(p.ts);
              const status = p.correct === null ? '<span class="badge badge-slate">Pendiente</span>'
                : p.correct ? '<span class="badge badge-emerald">✓ Acierto</span>'
                : '<span class="badge badge-rose">✗ Fallo</span>';
              return `<tr>
                <td class="meta-cell">${dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</td>
                <td><span class="team-flag-sm">${a.flag}</span> <strong>${escapeHtml(a.name)}</strong> vs <strong>${escapeHtml(b.name)}</strong> <span class="team-flag-sm">${b.flag}</span></td>
                <td class="mono">${p.predicted.home}-${p.predicted.away}</td>
                <td class="meta-cell mono">${(p.homeWin || 0).toFixed(0)}/${(p.draw || 0).toFixed(0)}/${(p.awayWin || 0).toFixed(0)}</td>
                <td class="mono">${p.actual ? `${p.actual.home}-${p.actual.away}` : '—'}</td>
                <td>${status}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`}
      </div>
    </div>
  `;
}

function initPredictions() {
  const btn = document.getElementById('clearPreds');
  if (btn) btn.addEventListener('click', () => {
    if (confirm('¿Borrar todas las predicciones guardadas?')) {
      clearPredictions();
      render();
    }
  });
}

// ---- KNOCKOUTS ----
function renderKnockouts() {
  return `<div class="fade-in" id="knockoutsView" style="display: flex; flex-direction: column; gap: 1rem;"><div class="skeleton" style="height: 400px;"></div></div>`;
}

/**
 * Construye el cuadro de 32avos desde standings reales.
 * - Si todos los grupos están completos (≥6 PJ por equipo): genera cruces reales
 * - Si están incompletos: usa proyección Monte Carlo para completar
 * - Aplica picks manuales del usuario (setBracketPick) sobre los cruces
 */
function buildKnockoutBracket(standings, mcProjection) {
  const groups = window.GROUPS_LIST || [];
  const firsts = {}, seconds = {}, thirds = [];
  const isComplete = (g) => standings[g] && standings[g].every(t => t.pld >= 6);

  const allComplete = groups.every(isComplete);

  groups.forEach(g => {
    const s = standings[g] || [];
    if (s[0]) firsts[g] = s[0].fifaCode;
    if (s[1]) seconds[g] = s[1].fifaCode;
    if (s[2]) thirds.push(s[2]);
  });

  // Si grupos incompletos: complementar con proyección MC
  if (!allComplete && mcProjection) {
    const mcByCode = Object.fromEntries(mcProjection.map(t => [t.team.fifaCode, t]));
    const known = new Set([...Object.values(firsts), ...Object.values(seconds)]);
    groups.forEach(g => {
      if (!firsts[g]) {
        const candidates = (window.STATIC_TEAMS || []).filter(t => t.group === g)
          .sort((a, b) => (mcByCode[b.fifaCode]?.probabilities.qualifyFromGroup || 0)
                        - (mcByCode[a.fifaCode]?.probabilities.qualifyFromGroup || 0));
        if (candidates[0]) firsts[g] = candidates[0].fifaCode;
      }
      if (!seconds[g]) {
        const candidates = (window.STATIC_TEAMS || []).filter(t => t.group === g && t.fifaCode !== firsts[g])
          .sort((a, b) => (mcByCode[b.fifaCode]?.probabilities.qualifyFromGroup || 0)
                        - (mcByCode[a.fifaCode]?.probabilities.qualifyFromGroup || 0));
        if (candidates[0]) seconds[g] = candidates[0].fifaCode;
      }
      if (!standings[g] || !standings[g][2]) {
        const candidates = (window.STATIC_TEAMS || []).filter(t => t.group === g && t.fifaCode !== firsts[g] && t.fifaCode !== seconds[g]);
        if (candidates[0]) thirds.push(candidates[0]);
      }
    });
  }

  // Top 8 terceros (ya viene ordenado por standings; si no, usar puntos)
  const sortedThirds = [...thirds].sort((a, b) => (b.pts || 0) - (a.pts || 0) || (b.gd || 0) - (a.gd || 0) || (b.gf || 0) - (a.gf || 0));
  const bestThirds = sortedThirds.slice(0, 8);

  // Cruces 1º vs 2º (reglas FIFA WC26: 1A-2C, 1C-2A, etc.)
  const groupPairs = [
    ['A','C'],['C','A'],['B','E'],['E','B'],['D','F'],['F','D'],
    ['G','I'],['I','G'],['H','J'],['J','H'],['K','L'],['L','K'],
  ];
  const usedInMain = new Set();
  const mainPairs = [];
  groupPairs.forEach(([wG, rG]) => {
    const aCode = firsts[wG], bCode = seconds[rG];
    if (aCode && bCode && !usedInMain.has(aCode) && !usedInMain.has(bCode)) {
      mainPairs.push({ a: aCode, b: bCode, group: `${wG}1-${rG}2` });
      usedInMain.add(aCode); usedInMain.add(bCode);
    }
  });

  // 4 cruces de terceros: emparejar con los grupos cuyos 1º/2º NO han sido usados
  const thirdPairs = [];
  for (let i = 0; i < bestThirds.length && thirdPairs.length < 4; i += 2) {
    const tA = bestThirds[i]?.fifaCode;
    const tB = bestThirds[i + 1]?.fifaCode;
    if (tA && tB && !usedInMain.has(tA) && !usedInMain.has(tB)) {
      thirdPairs.push({ a: tA, b: tB, group: `3.ᵉʳ${i/2 + 1}` });
      usedInMain.add(tA); usedInMain.add(tB);
    }
  }

  // Total: hasta 16 cruces de 32avos
  const r32 = [...mainPairs, ...thirdPairs];
  return {
    firsts, seconds, bestThirds, isComplete,
    r32,             // 16 cruces iniciales
    thirdPairsCount: thirdPairs.length,
    mainPairsCount: mainPairs.length,
  };
}

/**
 * Simula eliminatorias usando predictMatch, aplicando picks manuales si existen.
 */
function simulateBracket(r32Pairs) {
  const userPicks = getBracketPicks();
  const r32Teams = r32Pairs.map((p, i) => {
    const key = `r32_${i}`;
    if (userPicks[key]) {
      const winner = window.TEAM_BY_CODE[userPicks[key]];
      if (winner) return winner;
    }
    // Auto: simular con predictMatch
    const a = window.TEAM_BY_CODE[p.a], b = window.TEAM_BY_CODE[p.b];
    if (!a || !b) return null;
    const pred = predictMatch(a, b, false);
    return pickWinner(a, b, pred.probabilities);
  }).filter(Boolean);

  // R16, QF, SF, Final
  const stages = [
    { name: 'Octavos', matches: 8, picksKey: 'r16' },
    { name: 'Cuartos', matches: 4, picksKey: 'qf' },
    { name: 'Semis',   matches: 2, picksKey: 'sf' },
    { name: 'Final',   matches: 1, picksKey: 'final' },
  ];

  const results = { r32Teams, stages: [] };
  let current = r32Teams;

  stages.forEach((stage, stageIdx) => {
    const winners = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i], b = current[i + 1];
      if (!a || !b) continue;
      const pickKey = `${stage.picksKey}_${Math.floor(i / 2)}`;
      let winner;
      if (userPicks[pickKey]) {
        const w = window.TEAM_BY_CODE[userPicks[pickKey]];
        if (w) winner = w;
      }
      if (!winner) {
        const pred = predictMatch(a, b, false);
        winner = pickWinner(a, b, pred.probabilities);
      }
      winners.push(winner);
    }
    results.stages.push({ name: stage.name, winners, prev: current });
    current = winners;
    if (current.length === 1) results.champion = current[0];
  });

  return results;
}

function pickWinner(a, b, probs) {
  const r = Math.random();
  if (r < probs.homeWin / 100) return a;
  if (r < (probs.homeWin + probs.draw) / 100) return Math.random() < 0.5 ? a : b;
  return b;
}

function initKnockouts() {
  const view = document.getElementById('knockoutsView');
  if (!view) return;

  const renderAsync = async () => {
    const matches = await loadAllMatches();
    const standings = computeStandings(matches);

    const tourney = runtime.tourneySim || simulateTournamentSync(2000);
    runtime.tourneySim = tourney;
    const top8 = tourney.slice(0, 8);
    const darkHorses = tourney.filter(t => t.team.fifaRank > 20 && t.probabilities.qualifyFromGroup > 50).slice(0, 6);

    const bracket = buildKnockoutBracket(standings, tourney);
    const sim = simulateBracket(bracket.r32);
    const userPicks = getBracketPicks();
    const totalPicks = Object.keys(userPicks).length;

    const flagsRow = (teams) => teams.length === 0
      ? '<span class="meta-tag">Pendiente</span>'
      : teams.map(t => `<div class="flag-tile" title="${escapeHtml(t.name)}">${t.flag}</div>`).join('');

    view.innerHTML = `
      <div class="section-header">
        <div>
          <h2>🌐 Cuadro de eliminatorias</h2>
          <p class="subtitle">
            ${bracket.isComplete
              ? '✅ Grupos completos — cruces automáticos según reglas FIFA'
              : '⏳ Grupos en curso — cruces parciales + proyección Monte Carlo'}
          </p>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-ghost" id="bracketSimBtn">🎲 Simular cuadro</button>
          <button class="btn btn-ghost" id="bracketPickBtn">✋ Hacer mis picks</button>
          <button class="btn btn-ghost" id="bracketClearBtn">🗑️ Limpiar picks</button>
        </div>
      </div>

      <!-- Status badges -->
      <div class="grid grid-3">
        <div class="stat-card cyan">
          <div class="flex justify-between items-center mb-2"><h3 style="margin: 0;">Líderes (1.º)</h3><span class="stat-num">${Object.keys(bracket.firsts).length}/12</span></div>
          <div class="flags-row">${flagsRow(Object.values(bracket.firsts).map(c => window.TEAM_BY_CODE[c]).filter(Boolean))}</div>
        </div>
        <div class="stat-card blue">
          <div class="flex justify-between items-center mb-2"><h3 style="margin: 0;">Segundos (2.º)</h3><span class="stat-num">${Object.keys(bracket.seconds).length}/12</span></div>
          <div class="flags-row">${flagsRow(Object.values(bracket.seconds).map(c => window.TEAM_BY_CODE[c]).filter(Boolean))}</div>
        </div>
        <div class="stat-card amber">
          <div class="flex justify-between items-center mb-2"><h3 style="margin: 0;">Mejores 3.º (top 8)</h3><span class="stat-num">${bracket.bestThirds.length}/8</span></div>
          <div class="flags-row">${flagsRow(bracket.bestThirds)}</div>
        </div>
      </div>

      <!-- Status banner -->
      <div class="phase-banner" id="bracketStatus">
        <span class="dot ${bracket.isComplete ? 'dot-emerald' : 'dot-cyan'} ${bracket.isComplete ? '' : 'pulse'}"></span>
        <span class="phase-label">${bracket.isComplete ? 'Cuadro completo' : 'Cuadro parcial'}</span>
        <span class="phase-divider">·</span>
        <span class="phase-sub">${bracket.r32.length}/16 cruces definidos · ${totalPicks}/22 picks manuales</span>
      </div>

      <!-- Interactive bracket -->
      <div class="card bracket-card" id="bracketInteractive">
        <h3>🏆 Cuadro interactivo · click para elegir ganador</h3>
        <div class="bracket-wrapper">
          ${renderBracketColumns(bracket.r32, sim)}
        </div>
        <p class="bracket-note">💡 Tip: haz click en cualquier partido para elegir tu ganador (se guarda en localStorage)</p>
      </div>

      <!-- Top favoritos + caballos oscuros -->
      <div class="grid grid-2">
        <div class="card">
          <h3>👑 Top 8 favoritos al título</h3>
          <div class="fav-list">
            ${top8.map((r, i) => `<button class="favorite-row" data-jump-team="${r.team.fifaCode}">
              <div class="rank-num-mini">#${i + 1}</div>
              <span class="team-flag-mini">${r.team.flag}</span>
              <div class="team-info">
                <div class="team-name-sm">${escapeHtml(r.team.name)}</div>
                <div class="team-meta-sm">FIFA #${r.team.fifaRank} · Elo ${r.team.elo}</div>
              </div>
              <div class="pct">${r.probabilities.champion.toFixed(1)}%</div>
            </button>`).join('')}
          </div>
        </div>
        <div class="card">
          <h3>🎯 Caballos oscuros</h3>
          <div class="fav-list">
            ${darkHorses.length === 0 ? '<div class="empty-state">Sin sorpresas destacadas.</div>' : darkHorses.map(r => `<button class="favorite-row" data-jump-team="${r.team.fifaCode}">
              <span class="team-flag-mini">${r.team.flag}</span>
              <div class="team-info">
                <div class="team-name-sm">${escapeHtml(r.team.name)}</div>
                <div class="team-meta-sm">FIFA #${r.team.fifaRank} · Elo ${r.team.elo}</div>
              </div>
              <div class="pct">${r.probabilities.qualifyFromGroup.toFixed(0)}%</div>
            </button>`).join('')}
          </div>
        </div>
      </div>

      ${sim.champion ? `
      <div class="card champion-banner">
        <div style="text-align: center; padding: 1.5rem;">
          <div style="font-size: 10px; color: var(--accent-amber); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700;">🏆 Campeón proyectado</div>
          <div style="font-size: 4rem; line-height: 1; margin: 0.5rem 0;">${sim.champion.flag}</div>
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--fg);">${escapeHtml(sim.champion.name)}</div>
          <div style="font-size: 11px; color: var(--fg-dim); margin-top: 0.25rem;">FIFA #${sim.champion.fifaRank} · Elo ${sim.champion.elo}</div>
        </div>
      </div>
      ` : ''}
    `;

    wireUpJumps();

    // Wire up bracket interactions
    document.querySelectorAll('.bracket-match[data-match-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        const matchId = el.dataset.matchId;
        const side = e.target.closest('.bracket-team-row')?.dataset.side;
        if (!side) {
          // Click anywhere in the match: toggle to show "select winner" UI
          el.classList.toggle('selecting');
          return;
        }
        const pairKey = el.dataset.pairKey;
        const teamCode = side === 'a' ? el.dataset.teamA : el.dataset.teamB;
        setBracketPick(matchId, teamCode);
        renderAsync(); // re-render
      });
    });

    document.getElementById('bracketSimBtn')?.addEventListener('click', () => {
      clearBracket();
      renderAsync();
    });
    document.getElementById('bracketClearBtn')?.addEventListener('click', () => {
      if (confirm('¿Borrar todos tus picks manuales?')) {
        clearBracket();
        renderAsync();
      }
    });
    document.getElementById('bracketPickBtn')?.addEventListener('click', () => {
      document.querySelector('.bracket-card')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  renderAsync();
}

/**
 * Renderiza las columnas del bracket con cruces reales desde standings.
 */
function renderBracketColumns(r32Pairs, sim) {
  const userPicks = getBracketPicks();

  // Columna 1: 32avos (16 partidos)
  const r32Col = r32Pairs.map((pair, i) => {
    const a = window.TEAM_BY_CODE[pair.a];
    const b = window.TEAM_BY_CODE[pair.b];
    if (!a || !b) return '';
    const matchId = `r32_${i}`;
    const userPick = userPicks[matchId];
    const winner = sim.r32Teams[i];
    return renderBracketMatch(a, b, matchId, userPick, winner, pair.group);
  }).join('');

  // Columnas siguientes: octavos, cuartos, semis, final
  const stageCols = [
    { name: 'Octavos', key: 'r16', matches: 8, prev: sim.r32Teams, picksKey: 'r16' },
    { name: 'Cuartos', key: 'qf',  matches: 4, prev: sim.stages[0]?.winners || [], picksKey: 'qf' },
    { name: 'Semis',   key: 'sf',  matches: 2, prev: sim.stages[1]?.winners || [], picksKey: 'sf' },
    { name: 'Final',   key: 'final', matches: 1, prev: sim.stages[2]?.winners || [], picksKey: 'final' },
  ];

  let prevWinners = sim.r32Teams;
  const otherCols = stageCols.map((stage, sIdx) => {
    const winners = sim.stages[sIdx]?.winners || [];
    const cols = [];
    for (let i = 0; i < winners.length; i++) {
      const matchId = `${stage.picksKey}_${i}`;
      const userPick = userPicks[matchId];
      const a = prevWinners[i * 2];
      const b = prevWinners[i * 2 + 1];
      if (!a || !b) continue;
      const w = winners[i];
      cols.push(renderBracketMatch(a, b, matchId, userPick, w, stage.name));
    }
    prevWinners = winners;
    return `
      <div class="bracket-col">
        <h4>${stage.name}</h4>
        ${cols.join('')}
      </div>
    `;
  }).join('');

  return `
    <div class="bracket-col">
      <h4>32avos</h4>
      ${r32Col}
    </div>
    ${otherCols}
  `;
}

function renderBracketMatch(a, b, matchId, userPick, winner, label) {
  const pickA = userPick === a.fifaCode;
  const pickB = userPick === b.fifaCode;
  const winnerA = winner === a;
  const winnerB = winner === b;
  const isDecided = !!winner;
  return `
    <div class="bracket-match" data-match-id="${matchId}" title="Click para elegir ganador">
      ${label ? `<div class="bracket-label">${escapeHtml(label)}</div>` : ''}
      <div class="bracket-team-row ${pickA ? 'user-pick' : ''} ${winnerA ? 'winner' : ''} ${isDecided && !winnerA ? 'loser' : ''}"
           data-side="a" data-team-a="${a.fifaCode}" data-pair-key="${matchId}">
        <span class="bracket-flag">${a.flag}</span>
        <span class="bracket-team-name">${escapeHtml(a.name)}</span>
        <span class="bracket-team-meta">#${a.fifaRank}</span>
      </div>
      <div class="bracket-divider"></div>
      <div class="bracket-team-row ${pickB ? 'user-pick' : ''} ${winnerB ? 'winner' : ''} ${isDecided && !winnerB ? 'loser' : ''}"
           data-side="b" data-team-b="${b.fifaCode}" data-pair-key="${matchId}">
        <span class="bracket-flag">${b.flag}</span>
        <span class="bracket-team-name">${escapeHtml(b.name)}</span>
        <span class="bracket-team-meta">#${b.fifaRank}</span>
      </div>
    </div>
  `;
}

// ---- MONTE CARLO SIMULATOR ----
function renderSimulator() {
  return `
    <div class="fade-in view-simulator" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>⚡ Simulación Monte Carlo</h2>
          <p class="subtitle" id="simSub">Simulación completa del torneo · 100% en tu navegador</p>
        </div>
        <div class="flex gap-1" style="flex-wrap: wrap;">
          <button class="btn btn-ghost sim-btn" data-sims="1000">1k</button>
          <button class="btn btn-ghost sim-btn" data-sims="5000">5k</button>
          <button class="btn btn-primary sim-btn" data-sims="10000">10k</button>
          <button class="btn btn-ghost sim-btn" data-sims="25000">25k</button>
          <button class="btn btn-ghost sim-btn" data-sims="50000">50k</button>
          <button class="btn btn-ghost" id="simCancel">⏹ Cancelar</button>
        </div>
      </div>
      <div class="progress-bar-wrapper" id="simProgressWrap" style="display:none;">
        <div class="progress-bar"><div class="progress-fill" id="simProgressFill"></div></div>
        <div class="progress-text mono" id="simProgressText">0%</div>
      </div>
      <div id="simResults">
        <div class="card empty-state-lg">
          <div class="empty-icon">⚡</div>
          <h3>Selecciona simulaciones</h3>
          <p>Elige 1k, 5k, 10k, 25k o 50k simulaciones. 10k toma ~2-3 segundos en dispositivos modernos.</p>
        </div>
      </div>
    </div>
  `;
}

function initSimulator() {
  document.querySelectorAll('.sim-btn').forEach(btn => btn.addEventListener('click', () => runSim(parseInt(btn.dataset.sims))));
  document.getElementById('simCancel')?.addEventListener('click', () => {
    cancelSimulation();
    const sub = document.getElementById('simSub');
    if (sub) sub.textContent = '⏹ Simulación cancelada';
  });
}

async function runSim(n) {
  const out = document.getElementById('simResults');
  const sub = document.getElementById('simSub');
  const wrap = document.getElementById('simProgressWrap');
  const fill = document.getElementById('simProgressFill');
  const text = document.getElementById('simProgressText');
  out.innerHTML = `<div class="card empty-state-lg"><div class="spin empty-icon">⚙️</div><h3>Corriendo ${n.toLocaleString()} simulaciones…</h3><p>Paciencia, esto puede tomar hasta 30 segundos para 50k.</p></div>`;
  if (wrap) wrap.style.display = 'flex';

  const t0 = performance.now();
  try {
    const results = await simulateTournament(n, (p) => {
      if (fill) fill.style.width = `${p * 100}%`;
      if (text) text.textContent = `${(p * 100).toFixed(0)}%`;
      if (sub) sub.textContent = `${n.toLocaleString()} sims · ${(p * 100).toFixed(0)}% · ${((performance.now() - t0) / 1000).toFixed(1)}s`;
    });
    const ms = Math.round(performance.now() - t0);
    if (sub) sub.textContent = `${n.toLocaleString()} simulaciones completadas en ${ms}ms`;
    if (wrap) wrap.style.display = 'none';
    runtime.tourneySim = results;

    out.innerHTML = `
      <div class="grid grid-4">
        <div class="stat-card cyan"><div class="stat-value">${n.toLocaleString()}</div><div class="stat-label">Simulaciones</div></div>
        <div class="stat-card purple"><div class="stat-value">${ms}ms</div><div class="stat-label">Tiempo</div></div>
        <div class="stat-card emerald"><div class="stat-value">48</div><div class="stat-label">Equipos</div></div>
        <div class="stat-card amber"><div class="stat-value">${(n * 56).toLocaleString()}</div><div class="stat-label">Partidos simulados</div></div>
      </div>
      <div class="card sim-results-card">
        <h3>👑 Probabilidades finales (Top 20)</h3>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Equipo</th><th>Grupo</th>
                <th style="color: #67e8f9;">Pasa grupos</th>
                <th>Octavos</th><th>Cuartos</th><th>Semis</th><th>Final</th>
                <th style="color: #fcd34d;">🏆 CAMPEÓN</th>
              </tr>
            </thead>
            <tbody>
              ${results.slice(0, 20).map((r, i) => `<tr class="${i < 1 ? 'pos-1' : i < 3 ? 'pos-2' : 'pos-other'}">
                <td><span class="pos-num">${i + 1}</span></td>
                <td>
                  <button class="team-cell-btn" data-jump-team="${r.team.fifaCode}">
                    <span class="team-flag-sm">${r.team.flag}</span>
                    <div class="team-cell-info">
                      <div class="team-name-cell">${escapeHtml(r.team.name)}</div>
                      <div class="team-meta-cell">FIFA #${r.team.fifaRank} · Elo ${r.team.elo}</div>
                    </div>
                  </button>
                </td>
                <td class="center"><span class="group-badge">${r.team.group}</span></td>
                <td class="center mono accent-cyan">${r.probabilities.qualifyFromGroup.toFixed(1)}%</td>
                <td class="center mono">${r.probabilities.roundOf16.toFixed(1)}%</td>
                <td class="center mono">${r.probabilities.quarterfinal.toFixed(1)}%</td>
                <td class="center mono">${r.probabilities.semifinal.toFixed(1)}%</td>
                <td class="center mono">${r.probabilities.finalist.toFixed(1)}%</td>
                <td class="center mono champion-pct">${r.probabilities.champion.toFixed(2)}%</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn btn-secondary" id="exportSimBtn">📥 Exportar JSON</button>
          <button class="btn btn-secondary" id="exportCsvBtn">📊 Exportar CSV</button>
        </div>
      </div>
    `;
    wireUpJumps();
    document.getElementById('exportSimBtn')?.addEventListener('click', () => {
      exportData(JSON.stringify(results, null, 2), `wc26-sim-${n}-${Date.now()}.json`, 'application/json');
    });
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
      const csv = ['code,name,group,qualify,r16,qf,sf,final,champion'];
      results.forEach(r => {
        csv.push(`${r.team.fifaCode},"${r.team.name}",${r.team.group},${r.probabilities.qualifyFromGroup},${r.probabilities.roundOf16},${r.probabilities.quarterfinal},${r.probabilities.semifinal},${r.probabilities.finalist},${r.probabilities.champion}`);
      });
      exportData(csv.join('\n'), `wc26-sim-${n}-${Date.now()}.csv`, 'text/csv');
    });
  } catch (err) {
    console.error('Sim error:', err);
    if (sub) sub.textContent = '❌ Error en simulación';
    if (wrap) wrap.style.display = 'none';
    out.innerHTML = '<div class="error-state">Error durante la simulación. Intenta con menos simulaciones.</div>';
  }
}

function exportData(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- SETTINGS ----
function renderSettings() {
  const s = getSettings();
  return `
    <div class="fade-in view-settings" style="display: flex; flex-direction: column; gap: 1rem; max-width: 700px; margin: 0 auto;">
      <div class="section-header">
        <div>
          <h2>⚙️ Ajustes</h2>
          <p class="subtitle">Personaliza tu experiencia de Nerdytics</p>
        </div>
      </div>

      <div class="card">
        <h3>🎨 Apariencia</h3>
        <div class="setting-row">
          <label class="setting-label">Tema</label>
          <select id="setTheme" class="select">
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>🌙 Oscuro</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>☀️ Claro</option>
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>🔄 Automático (sistema)</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Densidad</label>
          <select id="setDensity" class="select">
            <option value="comfortable" ${s.density === 'comfortable' ? 'selected' : ''}>Cómoda</option>
            <option value="compact" ${s.density === 'compact' ? 'selected' : ''}>Compacta</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Zona horaria</label>
          <select id="setTz" class="select">
            <option value="local" ${s.timezone === 'local' ? 'selected' : ''}>Local del navegador</option>
            <option value="utc" ${s.timezone === 'utc' ? 'selected' : ''}>UTC</option>
          </select>
        </div>
      </div>

      <div class="card">
        <h3>⚡ Rendimiento</h3>
        <div class="setting-row">
          <label class="setting-label">Auto-refresh</label>
          <select id="setRefresh" class="select">
            <option value="15000" ${s.autoRefreshMs === 15000 ? 'selected' : ''}>15 segundos</option>
            <option value="30000" ${s.autoRefreshMs === 30000 ? 'selected' : ''}>30 segundos</option>
            <option value="60000" ${s.autoRefreshMs === 60000 ? 'selected' : ''}>1 minuto</option>
            <option value="300000" ${s.autoRefreshMs === 300000 ? 'selected' : ''}>5 minutos</option>
            <option value="0" ${s.autoRefreshMs === 0 ? 'selected' : ''}>Desactivado</option>
          </select>
        </div>
        <div class="setting-row">
          <label class="setting-label">Reducir movimiento</label>
          <label class="switch">
            <input type="checkbox" id="setReducedMotion" ${s.reducedMotion ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="card">
        <h3>🔔 Notificaciones</h3>
        <div class="setting-row">
          <label class="setting-label">Notificaciones de partidos</label>
          <label class="switch">
            <input type="checkbox" id="setNotif" ${s.notifications ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>
        <p class="setting-hint">Te avisaremos cuando empiece o termine un partido de tus equipos favoritos.</p>
      </div>

      <div class="card">
        <h3>📦 Datos</h3>
        <div class="flex gap-2" style="flex-wrap: wrap;">
          <button class="btn btn-secondary" id="exportAll">📥 Exportar todos mis datos</button>
          <button class="btn btn-ghost" id="clearAll">🗑️ Borrar todo (favoritos, predicciones)</button>
        </div>
      </div>

      <div class="card">
        <h3>ℹ️ Acerca de</h3>
        <div class="meta-row"><span>Versión</span><span class="mono">v2.0</span></div>
        <div class="meta-row"><span>Build</span><span class="mono">${new Date().toISOString().slice(0, 10)}</span></div>
        <div class="meta-row"><span>Datos</span><span><a href="https://www.espn.com/soccer/" target="_blank" rel="noopener">ESPN API</a> (sin auth)</span></div>
        <div class="meta-row"><span>Sorteo</span><span>5 dic 2025</span></div>
      </div>
    </div>
  `;
}

function initSettings() {
  document.getElementById('setTheme')?.addEventListener('change', (e) => {
    updateSettings({ theme: e.target.value });
  });
  document.getElementById('setDensity')?.addEventListener('change', (e) => {
    updateSettings({ density: e.target.value });
  });
  document.getElementById('setTz')?.addEventListener('change', (e) => {
    updateSettings({ timezone: e.target.value });
  });
  document.getElementById('setRefresh')?.addEventListener('change', (e) => {
    updateSettings({ autoRefreshMs: parseInt(e.target.value, 10) });
    restartAutoRefresh();
  });
  document.getElementById('setReducedMotion')?.addEventListener('change', (e) => {
    updateSettings({ reducedMotion: e.target.checked });
  });
  document.getElementById('setNotif')?.addEventListener('change', (e) => {
    if (e.target.checked && 'Notification' in window) {
      Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
          alert('Permiso de notificaciones denegado');
          e.target.checked = false;
          return;
        }
        updateSettings({ notifications: true });
      });
    } else {
      updateSettings({ notifications: false });
    }
  });
  document.getElementById('exportAll')?.addEventListener('click', () => {
    const data = {
      favorites: getFavorites(),
      predictions: getPredictions(),
      settings: getSettings(),
      recentSearches: getRecentSearches(),
      exportedAt: new Date().toISOString(),
    };
    exportData(JSON.stringify(data, null, 2), `wc26-export-${Date.now()}.json`, 'application/json');
  });
  document.getElementById('clearAll')?.addEventListener('click', () => {
    if (confirm('¿Borrar todos tus datos locales? Esta acción no se puede deshacer.')) {
      clearPredictions();
      clearBracket();
      updateSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('wc26_favorites');
      localStorage.removeItem('wc26_recent_searches');
      location.reload();
    }
  });
}

// ---- TESTER ----
const _testerLogs = [];
let _logId = 0;
function renderTester() {
  return `
    <div class="fade-in view-tester" style="display: flex; flex-direction: column; gap: 1rem;">
      <div class="section-header">
        <div>
          <h2>🖥️ API Tester</h2>
          <p class="subtitle">Verifica el estado de las APIs en vivo</p>
        </div>
        <div class="flex gap-1" style="flex-wrap: wrap;">
          <label class="check-pill">
            <input type="checkbox" id="autoTest" /> ⏱ Auto-test 30s
          </label>
          <button class="btn btn-ghost" id="clearLog">🗑️ Limpiar</button>
          <button class="btn btn-primary" id="testAll">▶ Test todo</button>
        </div>
      </div>
      <div class="card">
        <div class="grid grid-3">
          <button class="btn btn-secondary test-btn" data-test="espn">📡 ESPN live</button>
          <button class="btn btn-secondary test-btn" data-test="standings">🗂️ Standings</button>
          <button class="btn btn-secondary test-btn" data-test="predictor">🧠 Predictor</button>
          <button class="btn btn-secondary test-btn" data-test="monte">⚡ Monte Carlo</button>
          <button class="btn btn-secondary test-btn" data-test="news">📰 News</button>
          <button class="btn btn-secondary test-btn" data-test="network">🌐 Network</button>
        </div>
      </div>
      <div class="terminal">
        <div class="terminal-header">
          <div class="flex items-center gap-2">
            <div class="terminal-dots"><span></span><span></span><span></span></div>
            <span class="terminal-prompt">nerdytics@api-tester:~$</span>
          </div>
          <span id="logCount" class="mono terminal-count">0 entradas</span>
        </div>
        <div class="terminal-body" id="terminal"></div>
      </div>
    </div>
  `;
}

function addLog(type, source, message, data, duration) {
  const log = { id: ++_logId, ts: new Date().toLocaleTimeString('es-ES', { hour12: false }), type, source, message, data, duration };
  _testerLogs.push(log);
  renderLog();
}

function renderLog() {
  const term = document.getElementById('terminal');
  if (!term) return;
  const logCount = document.getElementById('logCount');
  if (logCount) logCount.textContent = `${_testerLogs.length} entradas`;
  term.innerHTML = _testerLogs.slice(-200).map(l => {
    const colors = { info: 'log-info', success: 'log-success', error: 'log-error', warning: 'log-warning', request: 'log-request', response: 'log-response' };
    const labels = { info: 'INFO', success: ' OK', error: 'ERR', warning: 'WARN', request: 'REQ', response: 'RES' };
    let dataStr = '';
    if (l.data !== undefined && l.data !== null) {
      const json = JSON.stringify(l.data);
      dataStr = `<div class="log-data">${escapeHtml(json.slice(0, 400))}${json.length > 400 ? '...' : ''}</div>`;
    }
    return `<div class="log-line">
      <div class="flex gap-2 items-center">
        <span class="log-time">[${l.ts}]</span>
        <span class="${colors[l.type]}" style="font-weight: 700; min-width: 40px;">${labels[l.type]}</span>
        <span class="log-source">${escapeHtml(l.source)}</span>
        ${l.duration !== undefined ? `<span class="log-duration">(${l.duration}ms)</span>` : ''}
      </div>
      <div class="log-message ${colors[l.type]}">${escapeHtml(l.message)}</div>
      ${dataStr}
    </div>`;
  }).join('');
  term.scrollTop = term.scrollHeight;
}

async function runTest(name, fn) {
  addLog('request', 'TEST', `▶ ${name}`);
  const t0 = performance.now();
  try {
    const r = await fn();
    addLog('success', 'TEST', `✓ ${name} OK`, r, Math.round(performance.now() - t0));
  } catch (e) {
    addLog('error', 'TEST', `✗ ${name}: ${e.message}`, null, Math.round(performance.now() - t0));
  }
}

function initTester() {
  addLog('info', 'SYSTEM', `Nerdytics API Tester · Zona: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  document.getElementById('clearLog').addEventListener('click', () => { _testerLogs.length = 0; addLog('info', 'SYSTEM', 'Limpiado'); });
  document.getElementById('testAll').addEventListener('click', async () => {
    _testerLogs.length = 0;
    addLog('info', 'SYSTEM', 'Suite completa');
    await runTest('ESPN Scoreboard hoy', async () => {
      const ms = await loadTodaysMatches();
      addLog('response', 'ESPN', `${ms.length} partidos hoy`);
      return { count: ms.length };
    });
    await runTest('Standings', async () => {
      const m = await loadAllMatches();
      const s = computeStandings(m);
      const played = Object.values(s).flat().filter(t => t.pld > 0).length;
      addLog('response', 'STANDINGS', `${played} equipos con partidos jugados`);
      return { played, total: 48 };
    });
    await runTest('Predictor ARG vs FRA', async () => {
      const p = predictMatch(window.TEAM_BY_CODE.ARG, window.TEAM_BY_CODE.FRA);
      return { probs: p.probabilities, modal: p.modalScore };
    });
    await runTest('Monte Carlo (1k sims)', async () => {
      const t0 = performance.now();
      const r = simulateTournamentSync(1000);
      const ms = Math.round(performance.now() - t0);
      addLog('response', 'MONTE_CARLO', `Top: ${r[0].team.name} (${r[0].probabilities.champion.toFixed(2)}%)`);
      return { top3: r.slice(0, 3).map(x => ({ team: x.team.name, prob: x.probabilities.champion })), elapsed: ms };
    });
    await runTest('News feed', async () => {
      const news = await getWorldCupNews(10);
      addLog('response', 'ESPN', `${news.length} artículos`);
      return { count: news.length, first: news[0]?.headline };
    });
    addLog('success', 'SYSTEM', 'Suite completada');
  });

  document.querySelectorAll('.test-btn').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.dataset.test;
    if (t === 'espn') runTest('ESPN Scoreboard hoy', async () => {
      const ms = await loadTodaysMatches();
      addLog('response', 'ESPN', `${ms.length} partidos hoy`);
      return { count: ms.length };
    });
    if (t === 'standings') runTest('Standings', async () => {
      const m = await loadAllMatches();
      const s = computeStandings(m);
      const played = Object.values(s).flat().filter(t => t.pld > 0).length;
      return { played };
    });
    if (t === 'predictor') runTest('Predictor ARG vs FRA', async () => {
      const p = predictMatch(window.TEAM_BY_CODE.ARG, window.TEAM_BY_CODE.FRA);
      return { probs: p.probabilities };
    });
    if (t === 'monte') runTest('Monte Carlo 1k', async () => {
      const r = simulateTournamentSync(1000);
      return { top: r[0].team.name, prob: r[0].probabilities.champion };
    });
    if (t === 'news') runTest('News feed', async () => {
      const news = await getWorldCupNews(10);
      addLog('response', 'ESPN', `${news.length} artículos`);
      return { count: news.length, first: news[0]?.headline };
    });
    if (t === 'network') runTest('Network ping ESPN', async () => {
      const t0 = performance.now();
      await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard', { method: 'HEAD', mode: 'no-cors' });
      return { latency: Math.round(performance.now() - t0) };
    });
  }));

  let autoTest = false;
  let autoTimer = null;
  document.getElementById('autoTest').addEventListener('change', (e) => {
    autoTest = e.target.checked;
    if (autoTest) {
      addLog('info', 'SYSTEM', 'Auto-test cada 30s');
      autoTimer = setInterval(() => {
        if (!autoTest) return;
        runTest('ESPN live (auto)', async () => {
          const ms = await loadTodaysMatches();
          return { count: ms.length };
        });
      }, 30000);
    } else {
      addLog('info', 'SYSTEM', 'Auto-test desactivado');
      clearInterval(autoTimer);
    }
  });
}

// =====================================================================
// BÚSQUEDA GLOBAL (Cmd+K / Ctrl+K)
// =====================================================================

function openGlobalSearch() {
  let overlay = document.getElementById('globalSearchOverlay');
  if (overlay) {
    overlay.remove();
  }
  overlay = document.createElement('div');
  overlay.id = 'globalSearchOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="global-search" onclick="event.stopPropagation()">
      <div class="global-search-header">
        <span class="global-search-icon">🔍</span>
        <input type="text" id="globalSearchInput" placeholder="Buscar equipos, partidos, grupos, vistas..." class="global-search-input" autocomplete="off" />
        <kbd class="kbd">Esc</kbd>
      </div>
      <div class="global-search-results" id="globalSearchResults"></div>
      <div class="global-search-footer">
        <span><kbd class="kbd">↑↓</kbd> navegar</span>
        <span><kbd class="kbd">Enter</kbd> seleccionar</span>
        <span><kbd class="kbd">Esc</kbd> cerrar</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');

  const input = document.getElementById('globalSearchInput');
  const results = document.getElementById('globalSearchResults');
  input.focus();

  let activeIdx = -1;
  let currentResults = [];

  function search(q) {
    if (!q || !q.trim()) {
      // Show recent + all tabs
      const recent = getRecentSearches();
      const tabResults = TABS.map(t => ({
        type: 'tab', id: t.id, icon: t.icon, title: t.label, subtitle: 'Ir a la sección',
      }));
      results.innerHTML = `
        ${recent.length > 0 ? `
        <div class="global-search-section">
          <div class="global-search-section-title">Búsquedas recientes</div>
          ${recent.slice(0, 5).map(r => `<button class="global-search-item" data-q="${escapeHtml(r)}"><span class="gs-icon">🕐</span><span>${escapeHtml(r)}</span></button>`).join('')}
        </div>` : ''}
        <div class="global-search-section">
          <div class="global-search-section-title">Secciones</div>
          ${tabResults.map(r => `<button class="global-search-item" data-tab="${r.id}"><span class="gs-icon">${r.icon}</span><span>${escapeHtml(r.title)}</span></button>`).join('')}
        </div>
      `;
      currentResults = Array.from(results.querySelectorAll('.global-search-item'));
      activeIdx = -1;
      bindResults();
      return;
    }
    addRecentSearch(q);
    const lower = q.toLowerCase();
    const teams = (window.STATIC_TEAMS || []).filter(t =>
      t.name.toLowerCase().includes(lower) ||
      t.fifaCode.toLowerCase().includes(lower) ||
      t.confederation.toLowerCase().includes(lower) ||
      t.group.toLowerCase() === lower
    ).slice(0, 8);
    const tabs = TABS.filter(t => t.label.toLowerCase().includes(lower)).slice(0, 4);
    const groups = (window.GROUPS_LIST || []).filter(g => g.toLowerCase() === lower).slice(0, 1);

    const matches = (runtime.matches || []).filter(m => {
      const home = window.TEAM_BY_CODE[m.home];
      const away = window.TEAM_BY_CODE[m.away];
      return (home && home.name.toLowerCase().includes(lower)) ||
             (away && away.name.toLowerCase().includes(lower));
    }).slice(0, 5);

    results.innerHTML = `
      ${teams.length > 0 ? `
        <div class="global-search-section">
          <div class="global-search-section-title">Equipos</div>
          ${teams.map(t => `<button class="global-search-item" data-team="${t.fifaCode}">
            <span class="gs-flag">${t.flag}</span>
            <div class="gs-info">
              <div class="gs-title">${escapeHtml(t.name)} <span class="gs-meta">${t.fifaCode}</span></div>
              <div class="gs-sub">${t.confederation} · Grupo ${t.group} · FIFA #${t.fifaRank}</div>
            </div>
          </button>`).join('')}
        </div>` : ''}

      ${groups.length > 0 ? `
        <div class="global-search-section">
          <div class="global-search-section-title">Grupos</div>
          ${groups.map(g => `<button class="global-search-item" data-tab="groups" data-extra="${g}">
            <span class="gs-icon">🗂️</span>
            <div class="gs-info"><div class="gs-title">Grupo ${g}</div></div>
          </button>`).join('')}
        </div>` : ''}

      ${matches.length > 0 ? `
        <div class="global-search-section">
          <div class="global-search-section-title">Partidos</div>
          ${matches.map(m => {
            const home = window.TEAM_BY_CODE[m.home];
            const away = window.TEAM_BY_CODE[m.away];
            if (!home || !away) return '';
            return `<button class="global-search-item" data-match="${m.id}">
              <span class="gs-flag">${home.flag}</span>
              <div class="gs-info">
                <div class="gs-title">${escapeHtml(home.name)} vs ${escapeHtml(away.name)} <span class="gs-meta">${home.flag} ${away.flag}</span></div>
                <div class="gs-sub">${fmtDate(m.date)} · ${fmtTimeLocal(m.date)} · ${escapeHtml(m.venue || '')}</div>
              </div>
            </button>`;
          }).join('')}
        </div>` : ''}

      ${tabs.length > 0 ? `
        <div class="global-search-section">
          <div class="global-search-section-title">Secciones</div>
          ${tabs.map(t => `<button class="global-search-item" data-tab="${t.id}">
            <span class="gs-icon">${t.icon}</span>
            <span class="gs-title-inline">${escapeHtml(t.label)}</span>
          </button>`).join('')}
        </div>` : ''}

      ${teams.length === 0 && matches.length === 0 && tabs.length === 0 ? '<div class="global-search-empty">Sin resultados para "' + escapeHtml(q) + '"</div>' : ''}
    `;
    currentResults = Array.from(results.querySelectorAll('.global-search-item'));
    activeIdx = currentResults.length > 0 ? 0 : -1;
    updateActiveResult();
    bindResults();
  }

  function bindResults() {
    currentResults.forEach((r, i) => r.addEventListener('click', () => selectResult(i)));
  }

  function updateActiveResult() {
    currentResults.forEach((r, i) => {
      r.classList.toggle('active', i === activeIdx);
      if (i === activeIdx) r.scrollIntoView({ block: 'nearest' });
    });
  }

  function selectResult(i) {
    const r = currentResults[i];
    if (!r) return;
    if (r.dataset.tab) {
      runtime.activeTab = r.dataset.tab;
      closeGlobalSearch();
      render();
      setTimeout(() => wireUpJumps(), 100);
    } else if (r.dataset.team) {
      runtime.activeTab = 'teams';
      closeGlobalSearch();
      render();
      setTimeout(() => {
        const input = document.getElementById('teamSearch');
        if (input) {
          input.value = r.dataset.team;
          input.dispatchEvent(new Event('input'));
        }
      }, 50);
    } else if (r.dataset.match) {
      const m = runtime.matches.find(x => x.id === parseInt(r.dataset.match, 10));
      if (m) {
        closeGlobalSearch();
        openMatchDetail(m);
      }
    } else if (r.dataset.q) {
      input.value = r.dataset.q;
      search(r.dataset.q);
    }
  }

  function closeGlobalSearch() {
    document.body.classList.remove('modal-open');
    overlay.remove();
  }

  input.addEventListener('input', (e) => search(e.target.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(currentResults.length - 1, activeIdx + 1);
      updateActiveResult();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
      updateActiveResult();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectResult(activeIdx);
    } else if (e.key === 'Escape') {
      closeGlobalSearch();
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeGlobalSearch();
  });

  search('');
}

// =====================================================================
// DSPORTS TV — REPRODUCTOR CON SELECTOR DE 12 CANALES
// =====================================================================
//
// Vista totalmente aislada del resto de la app:
//   - Reproductor HLS.js (CDN) con fallback a HLS nativo en Safari.
//   - 12 opciones (mirrors) del canal DSports, click para cambiar.
//   - Auto-failover si una fuente no entrega datos en 8 s.
//   - Controles: play/pause, volumen, mute, fullscreen, Picture-in-Picture.
//   - Responsive: lista de canales al costado en desktop, debajo en móvil.
// =====================================================================

// Estado runtime del reproductor (vive en window para sobrevivir a re-renders)
window.__DSPORTS__ = window.__DSPORTS__ || {
  current: 0,
  hls: null,
  failoverTimer: null,
  failedIds: new Set(),
  lastError: null,
};

function renderDSports() {
  const channels = window.DSPORTS_CHANNELS || [];
  const meta = window.DSPORTS_META || {};
  const cur = window.__DSPORTS__.current || 0;
  const currentCh = channels[cur] || channels[0];

  return `
    <div class="fade-in view-dsports" style="display: flex; flex-direction: column; gap: 1rem;">
      <!-- Header -->
      <div class="section-header">
        <div>
          <h2>📺 ${escapeHtml(meta.brand || 'DSports')} TV · Nerdytics</h2>
          <p class="subtitle">${escapeHtml(meta.description || '')}</p>
        </div>
        <div class="flex gap-1" style="font-size: 11px; flex-wrap: wrap;">
          <span class="badge badge-cyan">
            <span class="dot dot-emerald pulse"></span> EN VIVO
          </span>
          <span class="badge badge-slate" id="dsportsCountBadge">${channels.length} mirrors</span>
        </div>
      </div>

      <!-- Layout principal: player + lista de canales -->
      <div class="dsports-layout">
        <!-- Reproductor -->
        <div class="dsports-player-wrap">
          <div class="dsports-player" id="dsportsPlayer">
            <video id="dsportsVideo"
                   class="dsports-video"
                   playsinline
                   controls
                   preload="metadata"
                   crossorigin="anonymous"
                   aria-label="Reproductor DSports en vivo"></video>

            <!-- Overlay superior: logo + estado -->
            <div class="dsports-overlay-top">
              <div class="dsports-brand">
                <span class="dsports-logo-dot"></span>
                <span class="dsports-brand-text">DSports</span>
                <span class="dsports-brand-tag">EN VIVO</span>
              </div>
              <div class="dsports-current-info">
                <div class="dsports-current-name" id="dsportsCurrentName">${escapeHtml(currentCh?.name || '')}</div>
                <div class="dsports-current-region mono" id="dsportsCurrentRegion">${escapeHtml(currentCh?.region || '')}</div>
              </div>
            </div>

            <!-- Overlay central: loading / error -->
            <div class="dsports-overlay-center" id="dsportsOverlayCenter">
              <div class="dsports-loading" id="dsportsLoading">
                <div class="dsports-spin"></div>
                <div class="dsports-loading-text">Cargando transmisión…</div>
              </div>
              <div class="dsports-error" id="dsportsError" style="display:none;">
                <div class="dsports-error-icon">⚠️</div>
                <div class="dsports-error-text" id="dsportsErrorText">No se pudo cargar la transmisión.</div>
                <div class="dsports-error-actions">
                  <button class="btn btn-primary btn-sm" id="dsportsRetryBtn">🔄 Reintentar</button>
                  <button class="btn btn-secondary btn-sm" id="dsportsNextBtn">⏭ Siguiente mirror</button>
                </div>
              </div>
            </div>

            <!-- Hint: click para mostrar controles -->
            <div class="dsports-tap-hint" id="dsportsTapHint">Toca para mostrar controles</div>
          </div>

          <!-- Info bar debajo del reproductor -->
          <div class="dsports-info-bar">
            <div class="dsports-info-stat">
              <div class="dsports-info-label">Mirror activo</div>
              <div class="dsports-info-value mono" id="dsportsActiveId">${currentCh?.id ?? '—'}/12</div>
            </div>
            <div class="dsports-info-stat">
              <div class="dsports-info-label">Estado</div>
              <div class="dsports-info-value" id="dsportsStatus">—</div>
            </div>
            <div class="dsports-info-stat">
              <div class="dsports-info-label">Resolución</div>
              <div class="dsports-info-value mono" id="dsportsResolution">—</div>
            </div>
            <div class="dsports-info-stat">
              <div class="dsports-info-label">Bitrate</div>
              <div class="dsports-info-value mono" id="dsportsBitrate">—</div>
            </div>
             <div class="dsports-info-stat dsports-info-stat--actions">
              <button class="btn btn-primary btn-sm" id="dsportsExternalBtn" title="Abrir en VLC / reproductor externo">
                ▶ Abrir
              </button>
              <button class="btn btn-ghost btn-sm" id="dsportsMuteBtn" title="Silenciar/Activar (M)">🔊</button>
              <button class="btn btn-ghost btn-sm" id="dsportsPipBtn" title="Picture-in-Picture (P)">🪟 PiP</button>
              <button class="btn btn-ghost btn-sm" id="dsportsFsBtn" title="Pantalla completa (F)">⛶ Full</button>
            </div>
          </div>
        </div>

        <!-- Lista de canales -->
        <aside class="dsports-channels" aria-label="Lista de mirrors DSports">
          <div class="dsports-channels-header">
            <div>
              <h3 style="margin: 0;">Canales disponibles</h3>
              <div class="meta-tag" style="margin-top: 4px;">Click para cambiar · sin recargar</div>
            </div>
            <button class="btn btn-ghost btn-sm" id="dsportsAutoBtn" title="Probar mirrors automáticamente">🔁 Auto</button>
          </div>
          <div class="dsports-channels-list" id="dsportsChannelsList">
            ${channels.map((ch, idx) => `
              <button class="dsports-channel ${idx === cur ? 'active' : ''} ${window.__DSPORTS__.failedIds.has(ch.id) ? 'failed' : ''}"
                      data-channel-id="${ch.id}"
                      aria-pressed="${idx === cur}"
                      title="${escapeHtml(ch.url)}">
                <div class="dsports-channel-num">${ch.id}</div>
                <div class="dsports-channel-info">
                  <div class="dsports-channel-name">${escapeHtml(ch.name)}</div>
                  <div class="dsports-channel-region mono">${escapeHtml(ch.region)}</div>
                </div>
                <div class="dsports-channel-status">
                  <span class="dsports-status-dot" id="dsDot${ch.id}"></span>
                </div>
              </button>
            `).join('')}
          </div>
        </aside>
      </div>

      <!-- Tips -->
      <div class="card">
        <h3>💡 Tips para una mejor experiencia</h3>
        <div class="grid grid-2" style="gap: 0.75rem;">
          <div class="dsports-tip">
            <div class="dsports-tip-icon">📡</div>
            <div class="dsports-tip-title">Si un mirror se corta</div>
            <div class="dsports-tip-text">Prueba el siguiente mirror de la lista. Cada uno es un servidor distinto.</div>
          </div>
          <div class="dsports-tip">
            <div class="dsports-tip-icon">🔁</div>
            <div class="dsports-tip-title">Botón Auto</div>
            <div class="dsports-tip-text">Recorre todos los mirrors y elige el primero que cargue correctamente.</div>
          </div>
          <div class="dsports-tip">
            <div class="dsports-tip-icon">📺</div>
            <div class="dsports-tip-title">Abrir en VLC</div>
            <div class="dsports-tip-text">Toca <strong>▶ Abrir</strong> para compartir el enlace. Abre VLC → "Abrir URL" y pega el enlace. En iOS Safari se abre solo.</div>
          </div>
          <div class="dsports-tip">
            <div class="dsports-tip-icon">📋</div>
            <div class="dsports-tip-title">Copiar enlace</div>
            <div class="dsports-tip-text">También puedes copiar la URL del mirror activo (panel de info) y abrirla directamente en VLC → "Abrir red" (Ctrl+N / Cmd+N).</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Carga HLS.js dinámicamente desde CDN si hace falta.
let _hlsLibPromise = null;
function loadHlsLib() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (_hlsLibPromise) return _hlsLibPromise;
  _hlsLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
    s.async = true;
    s.onload = () => resolve(window.Hls);
    s.onerror = () => reject(new Error('No se pudo cargar HLS.js'));
    document.head.appendChild(s);
  });
  return _hlsLibPromise;
}

async function initDSports() {
  const video = document.getElementById('dsportsVideo');
  if (!video) return;

  // Cargar primer canal (o el que esté activo en estado)
  const startId = (window.__DSPORTS__.current || 0);
  await switchDSportsChannel(startId, { autoPlay: true });

  // Wire channel list
  const channelButtons = document.querySelectorAll('.dsports-channel');
  channelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        // data-channel-id = 1..12 (id humano), necesitamos índice 0..11
        const id = parseInt(btn.dataset.channelId, 10);
        const idx = (id || 1) - 1;
        switchDSportsChannel(idx, { autoPlay: true }).catch(err => {
          console.warn('[DSports] switch error:', err);
        });
      } catch (err) {
        console.warn('[DSports] handler error:', err);
      }
    });
  });

  // Custom control buttons
  const muteBtn = document.getElementById('dsportsMuteBtn');
  if (muteBtn) muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.textContent = video.muted ? '🔇' : '🔊';
  });

  const fsBtn = document.getElementById('dsportsFsBtn');
  if (fsBtn) fsBtn.addEventListener('click', () => {
    const wrap = document.getElementById('dsportsPlayer');
    if (!document.fullscreenElement) {
      (wrap.requestFullscreen || wrap.webkitRequestFullscreen || wrap.mozRequestFullScreen || wrap.msRequestFullscreen)?.call(wrap);
    } else {
      document.exitFullscreen?.();
    }
  });

  const pipBtn = document.getElementById('dsportsPipBtn');
  if (pipBtn) pipBtn.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  });

  // External player
  const extBtn = document.getElementById('dsportsExternalBtn');
  if (extBtn) extBtn.addEventListener('click', openExternalPlayer);

  // Retry / next
  const retry = document.getElementById('dsportsRetryBtn');
  if (retry) retry.addEventListener('click', () => {
    switchDSportsChannel(window.__DSPORTS__.current, { autoPlay: true, force: true });
  });
  const next = document.getElementById('dsportsNextBtn');
  if (next) next.addEventListener('click', () => {
    const total = (window.DSPORTS_CHANNELS || []).length;
    switchDSportsChannel((window.__DSPORTS__.current + 1) % total, { autoPlay: true });
  });

  // Auto mode: probar mirrors en orden
  const auto = document.getElementById('dsportsAutoBtn');
  if (auto) auto.addEventListener('click', async () => {
    const channels = window.DSPORTS_CHANNELS || [];
    window.__DSPORTS__.failedIds.clear();
    for (let i = 0; i < channels.length; i++) {
      const ok = await tryDSportsChannel(i, { silent: true, timeoutMs: 6000 });
      if (ok) {
        switchDSportsChannel(i, { autoPlay: true, force: true });
        auto.textContent = '✓ Encontrado #' + channels[i].id;
        setTimeout(() => { auto.textContent = '🔁 Auto'; }, 2500);
        return;
      }
    }
    auto.textContent = '✗ Ninguno carga';
    setTimeout(() => { auto.textContent = '🔁 Auto'; }, 2500);
  });

  // Keyboard shortcuts (M, F, P) cuando el player tiene foco o estamos en esta tab
  document.addEventListener('keydown', _dsportsKeys);

  // Actualización periódica de stats
  if (window.__DSPORTS__._statsTimer) clearInterval(window.__DSPORTS__._statsTimer);
  window.__DSPORTS__._statsTimer = setInterval(() => {
    if (runtime.activeTab !== 'dsports') return;
    const res = document.getElementById('dsportsResolution');
    const br  = document.getElementById('dsportsBitrate');
    if (res && video.videoWidth) res.textContent = `${video.videoWidth}×${video.videoHeight || '?'}`;
    if (br && window.__DSPORTS__.hls && window.__DSPORTS__.hls.levels?.length) {
      const lvl = window.__DSPORTS__.hls.levels[window.__DSPORTS__.hls.currentLevel];
      if (lvl?.bitrate) br.textContent = (lvl.bitrate / 1000).toFixed(0) + ' kbps';
    }
  }, 2000);
}

async function openExternalPlayer() {
  const url = this?.dataset?.url;
  if (!url) return;

  // 1. Mobile: Web Share API (compartir URL para VLC/MX Player)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'DSports - Ver en vivo',
        text: 'Abrir este enlace en VLC o MX Player:\n' + url,
      });
      return;
    } catch {}
  }

  // 2. Desktop: abrir en nueva pestaña (Safari lo reproduce; Firefox ofrece VLC)
  window.open(url, '_blank');
}

function _dsportsKeys(e) {
  if (runtime.activeTab !== 'dsports') return;
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const v = document.getElementById('dsportsVideo');
  if (!v) return;
  if (e.key.toLowerCase() === 'm') {
    v.muted = !v.muted;
    const b = document.getElementById('dsportsMuteBtn');
    if (b) b.textContent = v.muted ? '🔇' : '🔊';
  } else if (e.key.toLowerCase() === 'f') {
    const wrap = document.getElementById('dsportsPlayer');
    if (!document.fullscreenElement) wrap?.requestFullscreen?.();
    else document.exitFullscreen?.();
  } else if (e.key.toLowerCase() === 'p') {
    if (document.pictureInPictureElement) document.exitPictureInPicture?.();
    else v.requestPictureInPicture?.().catch(()=>{});
  }
}

function setDSportsStatus(text, kind = '') {
  const el = document.getElementById('dsportsStatus');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

/**
 * Cambia al canal DSports N. Maneja HLS.js, Safari nativo, failover.
 *   options.autoPlay: iniciar reproducción al cargar
 *   options.force:    recargar aunque ya esté activo
 *   options.silent:   no actualiza UI (usado por Auto)
 */
async function switchDSportsChannel(idx, options = {}) {
  const channels = window.DSPORTS_CHANNELS || [];
  if (!channels[idx]) return false;
  const ch = channels[idx];
  window.__DSPORTS__.current = idx;

  // Update active state in list
  document.querySelectorAll('.dsports-channel').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
    b.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
  });

  // Update header info
  const nameEl = document.getElementById('dsportsCurrentName');
  const regionEl = document.getElementById('dsportsCurrentRegion');
  const idEl = document.getElementById('dsportsActiveId');
  if (nameEl) nameEl.textContent = ch.name;
  if (regionEl) regionEl.textContent = ch.region;
  if (idEl) idEl.textContent = `${ch.id}/${channels.length}`;

  // Update external player button
  const extBtn = document.getElementById('dsportsExternalBtn');
  if (extBtn) extBtn.dataset.url = ch.url;

  // Update dot
  document.querySelectorAll('.dsports-status-dot').forEach(d => d.className = 'dsports-status-dot');
  const dot = document.getElementById('dsDot' + ch.id);
  if (dot) dot.className = 'dsports-status-dot loading';

  // Mostrar overlay de carga, ocultar error
  showDSportsLoading();
  setDSportsStatus('Conectando…', 'loading');

  // Limpiar HLS anterior
  if (window.__DSPORTS__.hls) {
    try { window.__DSPORTS__.hls.destroy(); } catch {}
    window.__DSPORTS__.hls = null;
  }
  if (window.__DSPORTS__.failoverTimer) {
    clearTimeout(window.__DSPORTS__.failoverTimer);
    window.__DSPORTS__.failoverTimer = null;
  }

  const video = document.getElementById('dsportsVideo');
  if (!video) return false;

  try {
    // Safari y iOS: HLS nativo (mejor rendimiento).
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = ch.url;
    } else {
      // Otros navegadores: HLS.js
      const Hls = await loadHlsLib();
      if (Hls && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 10,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 6,
        });
        window.__DSPORTS__.hls = hls;
        hls.loadSource(ch.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (options.autoPlay !== false) video.play().catch(() => {});
        });
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          if (dot) dot.className = 'dsports-status-dot live';
          setDSportsStatus('En vivo', 'live');
          if (window.__DSPORTS__.failoverTimer) {
            clearTimeout(window.__DSPORTS__.failoverTimer);
            window.__DSPORTS__.failoverTimer = null;
          }
          window.__DSPORTS__.failedIds.delete(ch.id);
        });
        hls.on(Hls.Events.ERROR, (ev, data) => {
          console.warn('HLS error:', data);
          if (data.fatal) {
            window.__DSPORTS__.failedIds.add(ch.id);
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                showDSportsError('Error de red. Probando siguiente mirror…', ch.id);
                scheduleDSportsFailover();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                // Recuperable: intenta recovery
                try { hls.recoverMediaError(); } catch { scheduleDSportsFailover(); }
                break;
              default:
                showDSportsError('No se pudo reproducir esta fuente.', ch.id);
                scheduleDSportsFailover();
            }
          }
        });
      } else {
        // Muy raro: sin soporte HLS, intentar nativo de todos modos
        video.src = ch.url;
      }
    }

    // Eventos del <video> para estado
    video.onplaying = () => {
      if (dot) dot.className = 'dsports-status-dot live';
      setDSportsStatus('En vivo', 'live');
      hideDSportsLoading();
      hideDSportsError();
      if (window.__DSPORTS__.failoverTimer) {
        clearTimeout(window.__DSPORTS__.failoverTimer);
        window.__DSPORTS__.failoverTimer = null;
      }
      window.__DSPORTS__.failedIds.delete(ch.id);
    };
    video.onwaiting = () => {
      if (dot) dot.className = 'dsports-status-dot loading';
      setDSportsStatus('Buffering…', 'loading');
    };
    video.onerror = () => {
      if (dot) dot.className = 'dsports-status-dot error';
      window.__DSPORTS__.failedIds.add(ch.id);
      showDSportsError('Esta fuente no responde.', ch.id);
      scheduleDSportsFailover();
    };

    // Failover timer: si en 8 s no hay primer frame, salta al siguiente
    if (window.__DSPORTS__.failoverTimer) clearTimeout(window.__DSPORTS__.failoverTimer);
    window.__DSPORTS__.failoverTimer = setTimeout(() => {
      if (video.readyState < 2) { // HAVE_CURRENT_DATA
        window.__DSPORTS__.failedIds.add(ch.id);
        if (dot) dot.className = 'dsports-status-dot error';
        showDSportsError(`Timeout en ${ch.name}. Probando siguiente…`, ch.id);
        const total = channels.length;
        const next = (idx + 1) % total;
        // Evitar bucle si todos fallan
        if (window.__DSPORTS__.failedIds.size < total) {
          setTimeout(() => switchDSportsChannel(next, { autoPlay: true }), 600);
        } else {
          showDSportsError('Ningún mirror responde. Intenta más tarde.', ch.id, true);
        }
      }
    }, 8000);

    if (options.autoPlay !== false && video.canPlayType('application/vnd.apple.mpegurl')) {
      try { await video.play(); } catch {}
    }
    return true;
  } catch (err) {
    console.error('switchDSportsChannel error:', err);
    window.__DSPORTS__.failedIds.add(ch.id);
    showDSportsError('Error iniciando el reproductor.', ch.id);
    scheduleDSportsFailover();
    return false;
  }
}

/**
 * Intenta un canal sin cambiar UI. Devuelve true si carga en `timeoutMs`.
 */
function tryDSportsChannel(idx, { silent = true, timeoutMs = 6000 } = {}) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    let resolved = false;
    const finish = (ok) => {
      if (resolved) return;
      resolved = true;
      v.remove();
      resolve(ok);
    };
    v.onplaying = () => finish(true);
    v.onerror = () => finish(false);
    setTimeout(() => finish(false), timeoutMs);
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = (window.DSPORTS_CHANNELS || [])[idx]?.url || '';
    } else {
      // HLS.js fallback simple
      loadHlsLib().then(Hls => {
        if (!Hls || !Hls.isSupported()) return finish(false);
        const hls = new Hls();
        hls.loadSource((window.DSPORTS_CHANNELS || [])[idx]?.url || '');
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) finish(false); });
      }).catch(() => finish(false));
    }
  });
}

function scheduleDSportsFailover() {
  // Programado también desde onerror / LEVEL_LOADED fail
  if (window.__DSPORTS__.failoverTimer) return;
  window.__DSPORTS__.failoverTimer = setTimeout(() => {
    const channels = window.DSPORTS_CHANNELS || [];
    const total = channels.length;
    if (window.__DSPORTS__.failedIds.size >= total) {
      showDSportsError('Todos los mirrors fallan. Reintenta en unos minutos.', null, true);
      return;
    }
    let next = (window.__DSPORTS__.current + 1) % total;
    // Buscar uno que no haya fallado
    let guard = 0;
    while (window.__DSPORTS__.failedIds.has(channels[next].id) && guard < total) {
      next = (next + 1) % total;
      guard++;
    }
    switchDSportsChannel(next, { autoPlay: true });
  }, 1500);
}

function showDSportsLoading() {
  const l = document.getElementById('dsportsLoading');
  const e = document.getElementById('dsportsError');
  if (l) l.style.display = 'flex';
  if (e) e.style.display = 'none';
}
function hideDSportsLoading() {
  const l = document.getElementById('dsportsLoading');
  if (l) l.style.display = 'none';
}
function showDSportsError(text, failedId, persistent = false) {
  const l = document.getElementById('dsportsLoading');
  const e = document.getElementById('dsportsError');
  const t = document.getElementById('dsportsErrorText');
  if (l) l.style.display = 'none';
  if (e) e.style.display = 'flex';
  if (t) t.textContent = text;
  if (failedId) {
    const dot = document.getElementById('dsDot' + failedId);
    if (dot) dot.className = 'dsports-status-dot error';
    const card = document.querySelector(`.dsports-channel[data-channel-id="${failedId}"]`);
    if (card) card.classList.add('failed');
  }
  if (persistent) {
    const next = document.getElementById('dsportsNextBtn');
    if (next) next.style.display = 'none';
  }
}
function hideDSportsError() {
  const e = document.getElementById('dsportsError');
  if (e) e.style.display = 'none';
}

// Pausa y libera el reproductor cuando el usuario sale del tab DSports.
// Llamada desde el handler de cambio de tab en render().
function cleanupDSports() {
  const v = document.getElementById('dsportsVideo');
  if (v && !v.paused) {
    try { v.pause(); } catch {}
  }
  if (window.__DSPORTS__?.hls) {
    try { window.__DSPORTS__.hls.destroy(); } catch {}
    window.__DSPORTS__.hls = null;
  }
  if (window.__DSPORTS__?.failoverTimer) {
    clearTimeout(window.__DSPORTS__.failoverTimer);
    window.__DSPORTS__.failoverTimer = null;
  }
}


function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl+K → global search
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openGlobalSearch();
      return;
    }
    // ? → show shortcuts
    if (e.key === '?' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      showShortcuts();
      return;
    }
    // Number keys 1-9 → switch tabs
    if (/^[1-9]$/.test(e.key) && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) && !document.body.classList.contains('modal-open')) {
      const idx = parseInt(e.key, 10) - 1;
      if (TABS[idx]) {
        runtime.activeTab = TABS[idx].id;
        render();
      }
      return;
    }
    // R → refresh
    if (e.key.toLowerCase() === 'r' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      clearEspnCache();
      runtime.lastUpdate = Date.now();
      render();
    }
  });
}

function showShortcuts() {
  let overlay = document.getElementById('shortcutsOverlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'shortcutsOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="shortcuts-modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h2>⌨️ Atajos de teclado</h2>
        <button class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="shortcuts-grid">
          <div class="shortcut-row"><kbd class="kbd">⌘ K</kbd><span>Búsqueda global</span></div>
          <div class="shortcut-row"><kbd class="kbd">Ctrl K</kbd><span>Búsqueda global (Win/Linux)</span></div>
          <div class="shortcut-row"><kbd class="kbd">?</kbd><span>Mostrar atajos</span></div>
          <div class="shortcut-row"><kbd class="kbd">1-9</kbd><span>Cambiar a tab N</span></div>
          <div class="shortcut-row"><kbd class="kbd">R</kbd><span>Refrescar datos</span></div>
          <div class="shortcut-row"><kbd class="kbd">Esc</kbd><span>Cerrar modal</span></div>
        </div>
        <h3 class="mt-3">Tabs</h3>
        <div class="shortcuts-grid">
          ${TABS.map((t, i) => `<div class="shortcut-row"><kbd class="kbd">${i + 1}</kbd><span>${t.icon} ${escapeHtml(t.label)}</span></div>`).join('')}
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add('modal-open');
  const close = () => { overlay.remove(); document.body.classList.remove('modal-open'); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.modal-close').addEventListener('click', close);
}

// =====================================================================
// AUTO-REFRESH
// =====================================================================

function restartAutoRefresh() {
  if (runtime.refreshTimer) {
    clearInterval(runtime.refreshTimer);
    runtime.refreshTimer = null;
  }
  const ms = getSettings().autoRefreshMs;
  if (ms > 0) {
    runtime.refreshTimer = setInterval(() => {
      if (document.body.classList.contains('modal-open')) return;
      runtime.lastUpdate = Date.now();
      clearEspnCache();
      if (['dashboard', 'groups', 'teams', 'matches', 'news', 'knockouts'].includes(runtime.activeTab)) {
        render();
      }
    }, ms);
  }
}

function startClockUpdater() {
  setInterval(() => {
    const badge = document.getElementById('lastUpdateBadge');
    if (!badge) return;
    const elapsed = Math.floor((Date.now() - runtime.lastUpdate) / 1000);
    badge.innerHTML = elapsed < 60
      ? `<span class="dot dot-cyan"></span> hace ${elapsed}s`
      : `<span class="dot dot-slate"></span> hace ${Math.floor(elapsed / 60)}m`;
  }, 1000);
}

// =====================================================================
// INIT
// =====================================================================

function init() {
  // Apply settings
  applyTheme();
  applyDensity();
  applyReducedMotion();

  // Subscribe to state changes
  subscribeFavorites(() => updateActiveBadge());
  subscribePredictions(() => updateActiveBadge());
  subscribeSettings(() => {
    applyTheme();
    applyDensity();
  });

  // Init router from URL hash
  const hash = window.location.hash.replace('#', '');
  if (hash && TABS.some(t => t.id === hash)) {
    runtime.activeTab = hash;
  }

  // Initial render
  render();
  updateActiveBadge();

  // Auto-refresh
  restartAutoRefresh();
  startClockUpdater();

  // Keyboard shortcuts
  initKeyboardShortcuts();

  // Manual refresh button
  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    runtime.lastUpdate = Date.now();
    clearEspnCache();
    render();
  });

  // ESC to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const gs = document.getElementById('globalSearchOverlay');
      if (gs) { gs.remove(); document.body.classList.remove('modal-open'); return; }
      const sc = document.getElementById('shortcutsOverlay');
      if (sc) { sc.remove(); document.body.classList.remove('modal-open'); return; }
      if (document.body.classList.contains('modal-open')) closeMatchDetail();
    }
  });

  // Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW error:', err));
    });
  }
}

init();
