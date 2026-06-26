// =====================================================================
// espn.js — API ESPN con traducción automática ES
// WC26 Nerdytics · Vanilla
// =====================================================================
//
// Wrapper sobre ESPN API (no auth, CORS open) que aplica traducción
// automática a TODOS los strings devueltos: eventos, stats, status,
// noticias, jugadores.
// =====================================================================

import {
  translate,
  translateEventType,
  translateStatName,
  translatePlayerName,
  translateStatus,
  translateRoundName,
  analyzeNews,
  STATUS_DESC_MAP,
  STATUS_SHORT_MAP,
  escapeRegex,
} from './i18n.js';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';

// Fechas completas del torneo (11 jun - 5 jul 2026) fase de grupos
// Calculadas en runtime para evitar hardcoded si cambia el año.
function buildGroupStageDates() {
  const dates = [];
  // Fase de grupos: 11 jun – 5 jul 2026 (25 días)
  const start = new Date('2026-06-11');
  const end = new Date('2026-07-05');
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    dates.push(`${y}${m}${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

const ESPN_DATES = buildGroupStageDates();

// Fechas extendidas (incluye eliminatorias hasta final 19 jul)
function buildAllDates() {
  const dates = [...ESPN_DATES];
  const extra = ['20260706','20260707','20260708','20260709','20260710',
                 '20260711','20260712','20260713','20260714','20260715',
                 '20260716','20260717','20260718','20260719'];
  return [...new Set([...dates, ...extra])];
}

const ESPN_ALL_DATES = buildAllDates();

// =====================================================================
// CACHE Y DEDUPLICACIÓN
// =====================================================================

const _cache = new Map();
const _inflight = new Map();
const CACHE_TTL_MS = 30 * 1000; // 30 s para datos en vivo
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min para news

/**
 * Fetch wrapper con cache + dedup + timeout + traducción automática.
 */
async function espnFetch(path, opts = {}) {
  const {
    timeout = 12000,
    useCache = true,
    cacheTtl = CACHE_TTL_MS,
  } = opts;
  const url = `${ESPN_BASE}${path}`;
  const cacheKey = url;
  const now = Date.now();

  if (useCache && _cache.has(cacheKey)) {
    const entry = _cache.get(cacheKey);
    if (now - entry.ts < cacheTtl) return entry.data;
  }
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);

  const promise = (async () => {
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
      const data = await res.json();
      _cache.set(cacheKey, { ts: Date.now(), data });
      return data;
    } finally {
      clearTimeout(tid);
      _inflight.delete(cacheKey);
    }
  })();

  _inflight.set(cacheKey, promise);
  return promise;
}

/**
 * Limpia la cache manualmente (util para refresh forzado).
 */
function clearEspnCache(pattern) {
  if (!pattern) {
    _cache.clear();
    return;
  }
  for (const key of _cache.keys()) {
    if (key.includes(pattern)) _cache.delete(key);
  }
}

// =====================================================================
// SCOREBOARD
// =====================================================================

async function espnScoreboard(date) {
  const qs = date ? `?dates=${date.replace(/-/g, '')}` : '';
  return espnFetch(`/scoreboard${qs}`);
}

/**
 * Carga todos los partidos del Mundial (fase de grupos)
 * con cache, dedup, batching y traducción automática.
 */
async function loadAllMatches(opts = {}) {
  const dates = opts.allPhases ? ESPN_ALL_DATES : ESPN_DATES;
  const now = Date.now();

  // Cache global de matches
  const cacheKey = `__all_matches_${opts.allPhases ? 'all' : 'groups'}`;
  if (_cache.has(cacheKey)) {
    const e = _cache.get(cacheKey);
    if (now - e.ts < CACHE_TTL_MS) return e.data;
  }
  if (_inflight.has(cacheKey)) return _inflight.get(cacheKey);

  const inflight = (async () => {
    try {
      const events = [];
      for (let i = 0; i < dates.length; i += 5) {
        const batch = dates.slice(i, i + 5);
        const results = await Promise.all(batch.map(d =>
          espnScoreboard(d).catch(() => null)
        ));
        results.forEach(r => {
          if (r?.events && Array.isArray(r.events)) {
            events.push(...r.events);
          }
        });
      }
      const unique = Array.from(new Map(events.map(e => [e.id, e])).values());
      const translated = unique.map(espnEventToMatch).filter(Boolean);
      _cache.set(cacheKey, { ts: Date.now(), data: translated });
      return translated;
    } catch (err) {
      console.warn('ESPN load error:', err);
      const existing = _cache.get(cacheKey);
      return existing ? existing.data : [];
    } finally {
      _inflight.delete(cacheKey);
    }
  })();

  _inflight.set(cacheKey, inflight);
  return inflight;
}

/**
 * Convierte evento ESPN a formato interno, aplicando traducciones.
 */
function espnEventToMatch(e) {
  const comp = e.competitions?.[0];
  if (!comp) return null;
  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  if (!home || !away) return null;

  const state = e.status?.type?.state;
  const completed = e.status?.type?.completed;

  // Mapeo de status (ES → interno)
  let status;
  if (state === 'pre') status = 'SCHEDULED';
  else if (state === 'in') status = 'LIVE';
  else if (state === 'post' || completed) status = 'FINISHED';
  else if (state === 'postponed' || state === 'delayed') status = 'POSTPONED';
  else status = 'SCHEDULED';

  const statusInfo = translateStatus({
    description: e.status?.type?.description,
    shortDetail: e.status?.type?.shortDetail,
    detail:      e.status?.detail,
    type:        e.status?.type,
    status,
  });

  // Nombre corto de ronda/etapa
  const round = comp.notes?.find?.(n => n.type === 'event')?.text
             || e.season?.type
             || comp.stage?.type
             || 'GROUP_STAGE';
  const roundEs = translateRoundName(round);

  // Score parsing
  const parseScore = v => {
    if (v === undefined || v === null || v === '') return null;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  };

  // Phase / minute
  let minute = null;
  if (state === 'in' && e.status?.period) {
    minute = Math.min(45 + (e.status.period - 1) * 15, 90 + Math.max(0, e.status.period - 2) * 15);
  }

  // Referencia a nuestros equipos (para extraer grupo)
  const TEAM_BY_CODE = window.TEAM_BY_CODE || {};
  const homeTeam = TEAM_BY_CODE[home.team?.abbreviation];

  // Venue y ciudad
  const venue = comp.venue?.fullName || '';
  const city = comp.venue?.address?.city || '';
  const country = comp.venue?.address?.country || '';

  return {
    id: parseInt(e.id, 10) || Math.floor(Math.random() * 1e9),
    espnId: e.id,
    home: home.team?.abbreviation || '',
    away: away.team?.abbreviation || '',
    homeScore: parseScore(home.score),
    awayScore: parseScore(away.score),
    status,
    statusDescription: statusInfo.description,
    statusShort:      statusInfo.shortDetail,
    statusDetail:     statusInfo.detail,
    minute,
    date: e.date,
    venue,
    venueEs: translate(venue), // Traducción del venue si existe
    city,
    country,
    group: homeTeam?.group,
    stage: 'GROUP',
    round: roundEs,
    attendance: comp.attendance || null,
    neutral: home.team?.homeAway === 'neutral' || false,
  };
}

/**
 * Carga el summary (detalle) de un partido.
 */
async function getMatchSummary(eventId) {
  try {
    const data = await espnFetch(`/summary?event=${eventId}`);
    return translateSummary(data);
  } catch (err) {
    console.warn('ESPN summary error:', err);
    return null;
  }
}

/**
 * Traduce el summary completo: boxscore, eventos, leaders, news.
 */
function translateSummary(summary) {
  if (!summary) return null;
  const out = JSON.parse(JSON.stringify(summary)); // deep clone

  // Traducir boxscore
  if (out.boxscore?.teams) {
    out.boxscore.teams.forEach(teamStat => {
      if (Array.isArray(teamStat.statistics)) {
        teamStat.statistics.forEach(s => {
          s.nameEs = translateStatName(s.name);
          if (s.label) s.labelEs = translate(s.label);
          if (s.displayName) s.displayNameEs = translate(s.displayName);
        });
      }
      // Nombre del equipo (a veces viene con traducciones de confederación)
      if (teamStat.team?.name) {
        teamStat.team.nameEs = translate(teamStat.team.name);
      }
    });
  }

  // Traducir eventos clave
  if (Array.isArray(out.keyEvents)) {
    out.keyEvents.forEach(e => {
      if (e.type?.text) {
        e.type.textEs = translateEventType(e.type.text);
      }
      // shortText a veces incluye jugadores
      if (e.shortText) {
        e.shortTextEs = e.shortText; // Mantener original (nombres jugadores)
      }
      if (e.athletesInvolved) {
        e.athletesInvolved.forEach(a => {
          if (a.athlete?.displayName) {
            a.athlete.displayNameEs = translatePlayerName(a.athlete.displayName);
          }
          if (a.athlete?.shortName) {
            a.athlete.shortNameEs = translatePlayerName(a.athlete.shortName);
          }
        });
      }
    });
  }

  // Traducir leaders (top jugadores)
  if (Array.isArray(out.leaders)) {
    out.leaders.forEach(tl => {
      if (tl.displayName) tl.displayNameEs = translate(tl.displayName);
      if (Array.isArray(tl.leaders)) {
        tl.leaders.forEach(l => {
          if (l.athlete?.displayName) {
            l.athlete.displayNameEs = translatePlayerName(l.athlete.displayName);
          }
          if (l.athlete?.shortName) {
            l.athlete.shortNameEs = translatePlayerName(l.athlete.shortName);
          }
          if (l.displayValue) l.displayValueEs = l.displayValue; // numérico
          if (l.displayName) l.displayNameEs = translate(l.displayName);
        });
      }
    });
  }

  // Traducir news del summary
  if (out.news?.articles && Array.isArray(out.news.articles)) {
    out.news.articles.forEach(a => {
      if (a.type) a.typeEs = translate(a.type);
    });
  }

  // Status
  if (out.header?.competitions?.[0]?.status) {
    const s = out.header.competitions[0].status;
    const translated = translateStatus({
      description: s.type?.description,
      shortDetail: s.type?.shortDetail,
      detail: s.detail,
      type: s.type,
    });
    out.statusDescription = translated.description;
    out.statusShort = translated.shortDetail;
    out.statusDetail = translated.detail;
  }

  // Venue
  if (out.gameInfo?.venue) {
    out.gameInfo.venue.nameEs = translate(out.gameInfo.venue.fullName || out.gameInfo.venue.name || '');
  }

  // Competition / Season
  if (out.header?.season) {
    if (out.header.season.type) out.header.season.typeEs = translate(out.header.season.type);
    if (out.header.season.name) out.header.season.nameEs = translate(out.header.season.name);
  }

  return out;
}

/**
 * Carga el feed de noticias.
 */
async function getWorldCupNews(limit = 30) {
  try {
    const data = await espnFetch(`/news?limit=${limit}`, { cacheTtl: STATIC_CACHE_TTL_MS });
    const articles = data.articles || [];
    return articles.map(translateArticle);
  } catch (err) {
    console.warn('ESPN news error:', err);
    return [];
  }
}

function translateArticle(a) {
  if (!a) return a;
  const TEAM_BY_CODE = window.TEAM_BY_CODE || {};
  const teamList = Object.values(TEAM_BY_CODE);
  const analysis = analyzeNews(a.headline + ' ' + (a.description || ''), teamList);
  return {
    ...a,
    headlineEs: a.headline, // Mantener original en inglés
    descriptionEs: a.description, // Mantener original
    typeEs: translate(a.type || ''),
    mentionedTeams: analysis.mentionedTeams,
    ageHours: (Date.now() - new Date(a.published || 0).getTime()) / 3.6e6,
  };
}

/**
 * Construye una URL del scoreboard hoy.
 * Usa la fecha local del PC para evitar mismatch de día cuando el usuario
 * está en husos horarios negativos (ej. UTC-4 al anochecer).
 */
async function loadTodaysMatches() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  try {
    const data = await espnScoreboard(dateStr);
    return (data.events || []).map(espnEventToMatch).filter(Boolean);
  } catch (err) {
    console.warn('Today matches error:', err);
    return [];
  }
}

// =====================================================================
// EXPORTS
// =====================================================================

export {
  ESPN_BASE,
  ESPN_DATES,
  ESPN_ALL_DATES,
  espnFetch,
  espnScoreboard,
  loadAllMatches,
  loadTodaysMatches,
  getMatchSummary,
  getWorldCupNews,
  espnEventToMatch,
  translateSummary,
  translateArticle,
  clearEspnCache,
  STATUS_SHORT_MAP,
  STATUS_DESC_MAP,
  translateRoundName,
};
