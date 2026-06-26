// =====================================================================
// i18n.js — Sistema de traducción EN → ES
// WC26 Nerdytics · Vanilla
// =====================================================================
//
// Diseño:
//   - Diccionario centralizado I18N
//   - Funciones puras: translate(), translateNews(), translatePlayerName()
//   - Fallback automático al original si no hay traducción
//   - Carga perezosa (lazy lookup, sin re-compilación)
//   - Sin dependencias externas
//
// =====================================================================

const I18N = {
  // ===== ESTADOS DE PARTIDO (status.type.description) =====
  statusDescriptions: {
    'Scheduled':           'Programado',
    'In Progress':         'En juego',
    'Full Time':           'Finalizado',
    'Halftime':            'Descanso',
    'Postponed':           'Aplazado',
    'Cancelled':           'Cancelado',
    'Suspended':           'Suspendido',
    'Awarded':             'Adjudicado',
    'Delayed':             'Retrasado',
    'Pre-Game':            'Pre-partido',
    'Postponed (Rain)':    'Aplazado (Lluvia)',
    'Postponed (Snow)':    'Aplazado (Nieve)',
    'Canceled':            'Cancelado',
    'TBD':                 'Por definir',
    'End of Period':       'Fin del período',
    'Penalty Shootout':    'Tanda de penaltis',
    'Extra Time':          'Prórroga',
    'After Extra Time':    'Tras prórroga',
  },

  // ===== STATUS DETAIL (abreviatura) =====
  statusDetails: {
    'FT':         'Final',
    'HT':         'Descanso',
    'LIVE':       'EN VIVO',
    'ET':         'Prórroga',
    'PST':        'Aplazado',
    'Postp.':     'Aplaz.',
    'Canceled':   'Cancelado',
    'Cancelled':  'Cancelado',
    'Suspended':  'Suspendido',
    'Awarded':    'Adjudicado',
    'TBD':        'Por definir',
    'NS':         'Por comenzar',
    '1H':         '1T',
    '2H':         '2T',
    'P':          'Prórroga',
    'PEN':        'Pen.',
  },

  // ===== TIPOS DE EVENTOS (keyEvents[].type.text) =====
  // ESPN devuelve strings en inglés como "Goal", "Yellow Card", "Penalty - Missed".
  eventTypes: {
    'Goal':                       'Gol',
    'Penalty - Scored':           'Penalti (anotado)',
    'Penalty - Missed':           'Penalti fallado',
    'Penalty - Saved':            'Penalti atajado',
    'Penalty - Post':            'Penalti al poste',
    'Yellow Card':                'Tarjeta amarilla',
    'Red Card':                   'Tarjeta roja',
    'Yellow Red Card':            'Doble amarilla',
    'Substitution':               'Sustitución',
    'Kickoff':                    'Inicio',
    'Halftime':                   'Descanso',
    'End of Half':                'Fin del primer tiempo',
    'End of Regulation':          'Fin del tiempo regular',
    'Start of 2nd Half':          'Inicio del 2.º tiempo',
    'Start Delay':                'Inicio de demora',
    'End Delay':                  'Fin de demora',
    'Offside':                    'Fuera de juego',
    'Foul':                       'Falta',
    'Corner Kick':                'Tiro de esquina',
    'Free Kick':                  'Tiro libre',
    'Shot on Target':             'Tiro a puerta',
    'Shot off Target':            'Tiro fuera',
    'Save':                       'Atajada',
    'Shot':                       'Tiro',
    'Ball Possession':            'Posesión de balón',
    'Goal Kick':                  'Saque de meta',
    'Throw-in':                   'Saque de banda',
    'Penalty Goal':               'Gol de penalti',
    'Own Goal':                   'Gol en propia meta',
    'Video Review':               'Revisión VAR',
    'VAR':                        'VAR',
    'VAR - Goal Disallowed':      'VAR — Gol anulado',
    'VAR - Goal Confirmed':       'VAR — Gol confirmado',
    'VAR - Penalty Awarded':      'VAR — Penalti concedido',
    'VAR - Penalty Overturned':   'VAR — Penalti anulado',
    'VAR - Red Card':             'VAR — Tarjeta roja',
    'VAR - Yellow Card':          'VAR — Tarjeta amarilla',
    'Red card':                   'Tarjeta roja',
    'Yellow card':                'Tarjeta amarilla',
    'Substitution (red card)':    'Sustitución (expulsión)',
    'Match End':                  'Fin del partido',
    'Injury':                     'Lesión',
    'Injury Time':                'Tiempo añadido',
    'Injury Time Shown':          'Tiempo añadido mostrado',
    'Race to X':                  '',
    'Injury Return':              'Regresa de lesión',
  },

  // ===== ESTADÍSTICAS (boxscore.statistics[].name) =====
  // ESPN devuelve nombres como "possessionPct", "totalShots" (camelCase keys).
  statNames: {
    'possessionPct':         'Posesión',
    'totalShots':            'Tiros totales',
    'shotsOnTarget':         'Tiros a puerta',
    'shotsOffTarget':        'Tiros fuera',
    'shotsBlocked':          'Tiros bloqueados',
    'shotsFromInsideBox':    'Tiros desde el área',
    'shotsFromOutsideBox':   'Tiros desde fuera del área',
    'foulsCommitted':        'Faltas cometidas',
    'foulsSuffered':         'Faltas recibidas',
    'yellowCards':           'Tarjetas amarillas',
    'redCards':              'Tarjetas rojas',
    'cornerKicks':           'Tiros de esquina',
    'saves':                 'Atajadas',
    'offsides':              'Fuera de juego',
    'totalPasses':           'Pases totales',
    'accuratePasses':        'Pases completados',
    'passAccuracyPct':       'Precisión de pase %',
    'expectedGoals':         'Goles esperados (xG)',
    'interceptions':         'Intercepciones',
    'tackles':               'Entradas',
    'clearances':            'Despejes',
    'dispossessed':          'Pérdidas de balón',
    'longBalls':             'Balones largos',
    'longBallsPercentage':   'Pases largos %',
    'totalCrosses':          'Centros totales',
    'crossesSuccessful':     'Centros completados',
    'crossAccuracyPct':      'Precisión de centros %',
    'aerialDuelsWon':        'Duelos aéreos ganados',
    'aerialDuelsLost':       'Duelos aéreos perdidos',
    'groundDuelsWon':        'Duelos en tierra ganados',
    'sprints':               'Sprints',
    'distanceCovered':       'Distancia recorrida (km)',
    'possessionLost':        'Pérdidas de posesión',
    'possessionWon':         'Posesiones ganadas',
    'penaltiesAwarded':      'Penaltis concedidos',
    'penaltiesScored':       'Penaltis anotados',
    'penaltiesMissed':       'Penaltis fallados',
    'penaltiesSaved':        'Penaltis atajados',
    'bigChances':            'Ocasiones claras',
    'bigChancesCreated':     'Ocasiones claras creadas',
    'bigChancesMissed':      'Ocasiones claras falladas',
    'goalKicks':             'Saques de meta',
    'throwIns':              'Saques de banda',
    'goalAssists':           'Asistencias de gol',
    'freeKicks':             'Tiros libres',
    'freeKicksOnTarget':     'Tiros libres a puerta',
    'freeKicksConceded':     'Tiros libres concedidos',
    'successfulDribbles':    'Regates exitosos',
    'dribbleSuccessRate':    'Tasa de regate %',
    'hitWoodwork':           'Tiros al palo',
    'passesInOwnHalf':      'Pases en campo propio',
    'passesInOppositionHalf':'Pases en campo rival',
    'throughBalls':          'Pases en profundidad',
    'yellowRed':             'Doble amarilla',
  },

  // ===== HEADERS DE LÍDERES (leaders.displayName) =====
  leaderCategories: {
    'Goals':                  'Goles',
    'Assists':                'Asistencias',
    'Shots':                  'Tiros',
    'Shots on Target':        'Tiros a puerta',
    'Passes':                 'Pases',
    'Pass Accuracy':          'Precisión de pase',
    'Tackles':                'Entradas',
    'Saves':                  'Atajadas',
    'Interceptions':          'Intercepciones',
    'Clearances':             'Despejes',
    'Accurate Passes':        'Pases completados',
    'Chances Created':        'Ocasiones creadas',
    'Yellow Cards':           'Tarjetas amarillas',
    'Red Cards':              'Tarjetas rojas',
    'Distance':               'Distancia recorrida',
    'Possession Won':         'Posesión ganada',
    'Possession Lost':        'Posesión perdida',
    'Successful Dribbles':    'Regates exitosos',
    'Aerials Won':            'Duelos aéreos ganados',
    'Dispossessed':           'Pérdidas',
    'Fouls Won':              'Faltas recibidas',
    'Fouls Committed':        'Faltas cometidas',
    'Offsides':               'Fuera de juego',
    'Hit Woodwork':           'Tiros al palo',
    'Total Attempts':         'Tiros totales',
    'Top Scorer':             'Máximo goleador',
    'Player of the Match':    'Jugador del partido',
  },

  // ===== FASES / RONDAS / TEMPORADAS =====
  seasonTypes: {
    'Regular Season':     'Temporada Regular',
    'Preseason':          'Pretemporada',
    'Postseason':         'Postemporada',
    'Off Season':         'Fuera de temporada',
    'Friendlies':         'Amistosos',
    'Qualifier':          'Eliminatorias',
    'World Cup Qualifying':'Eliminatorias Mundialistas',
  },

  slugTypes: {
    'regular-season':     'regular',
    'preseason':          'pretemporada',
    'postseason':         'postemporada',
    'friendlies':         'amistosos',
  },

  // Traductor de slugs a nombre legible
  stageNames: {
    'GROUP_STAGE':        'Fase de Grupos',
    'GROUP':              'Fase de Grupos',
    'KNOCKOUT':           'Eliminatorias',
    'ROUND_OF_16':        'Octavos de final',
    'R16':                'Octavos de final',
    'QUARTERFINAL':       'Cuartos de final',
    'QF':                 'Cuartos de final',
    'SEMIFINAL':          'Semifinal',
    'SF':                 'Semifinal',
    'FINAL':              'Final',
    'THIRD_PLACE':        'Tercer puesto',
    '3RD':                'Tercer puesto',
    'QUALIFICATION':      'Eliminatorias',
  },

  // ===== SEDES / VENUES (mejoras contextuales) =====
  venues: {
    'SoFi Stadium':           'SoFi Stadium',
    'MetLife Stadium':        'MetLife Stadium',
    'AT&T Stadium':           'AT&T Stadium',
    'Mercedes-Benz Stadium':  'Mercedes-Benz Stadium',
    'NRG Stadium':            'NRG Stadium',
    'Arrowhead Stadium':      'Arrowhead Stadium',
    'Lincoln Financial Field':'Lincoln Financial Field',
    'Hard Rock Stadium':      'Hard Rock Stadium',
    'Gillette Stadium':       'Gillette Stadium',
    'Levi\'s Stadium':        'Levi\'s Stadium',
    'CenturyLink Field':      'Lumen Field',
    'Lumen Field':            'Lumen Field',
    'BC Place':               'BC Place',
    'BMO Field':              'BMO Field',
    'Commonwealth Stadium':   'Commonwealth Stadium',
    'Olympic Stadium':        'Estadio Olímpico',
    'Estadio Azteca':         'Estadio Azteca',
    'Estadio BBVA':           'Estadio BBVA',
    'Estadio Akron':          'Estadio Akron',
    'Estadio de Guadalajara':'Estadio Akron',
    'Estadio Universitario':  'Estadio Universitario',
  },

  // ===== CONFEDERACIONES =====
  confederations: {
    'UEFA':      'UEFA',
    'CONMEBOL':  'CONMEBOL',
    'CONCACAF':  'CONCACAF',
    'CAF':       'CAF',
    'AFC':       'AFC',
    'OFC':       'OFC',
  },

  // ===== TIPOS DE NOTICIAS =====
  newsTypes: {
    'Story':          'Reportaje',
    'HeadlineNews':   'Titular',
    'Recap':          'Resumen',
    'Preview':        'Previa',
    'Feature':        'Análisis',
    'Video':          'Vídeo',
    'Media':          'Multimedia',
  },

  // ===== POSICIONES DE JUGADORES =====
  positions: {
    'G':  'Portero',
    'D':  'Defensa',
    'M':  'Mediocampista',
    'F':  'Delantero',
    'GK': 'Portero',
    'DF': 'Defensa',
    'MF': 'Mediocampista',
    'FW': 'Delantero',
    'Goalkeeper':       'Portero',
    'Defender':         'Defensa',
    'Midfielder':       'Mediocampista',
    'Forward':          'Delantero',
    'Right Back':       'Lateral derecho',
    'Left Back':        'Lateral izquierdo',
    'Centre Back':      'Defensa central',
    'Central Defender': 'Defensa central',
    'Defensive Mid':    'Mediocampista defensivo',
    'Central Mid':      'Mediocampista central',
    'Attacking Mid':    'Mediocampista ofensivo',
    'Right Wing':       'Extremo derecho',
    'Left Wing':        'Extremo izquierdo',
    'Striker':          'Delantero centro',
    'Centre Forward':   'Delantero centro',
  },

  // ===== COMPETICIÓN =====
  competition: {
    'FIFA World Cup': 'Copa Mundial de la FIFA',
    'World Cup':      'Copa Mundial',
    'Friendly':       'Amistoso',
  },
};

// =====================================================================
// MAPEOS RUNTIME (no en diccionario literal, derivados)
// =====================================================================

// Texto corto "FT" / "HT" / "LIVE" / etc. que aparece en e.status.type.shortDetail
// o detail.
const STATUS_SHORT_MAP = I18N.statusDetails;

// Texto largo que aparece en e.status.type.description
const STATUS_DESC_MAP = I18N.statusDescriptions;

// Mapa de tipos de ronda → nombre en español
function translateStage(stage) {
  if (!stage) return '';
  if (I18N.stageNames[stage]) return I18N.stageNames[stage];
  // Heurísticas
  const s = String(stage).toUpperCase();
  if (s.includes('GROUP')) return 'Fase de Grupos';
  if (s.includes('QUARTER')) return 'Cuartos de final';
  if (s.includes('SEMI')) return 'Semifinal';
  if (s.includes('FINAL')) return 'Final';
  if (s.includes('ROUND') && s.includes('16')) return 'Octavos de final';
  if (s.includes('THIRD')) return 'Tercer puesto';
  return stage;
}

// =====================================================================
// FUNCIONES DE TRADUCCIÓN
// =====================================================================

/**
 * Traduce una cadena de manera general. Acepta claves en inglés.
 * Devuelve la traducción si existe; si no, devuelve el original.
 *
 * @param {string} s - String a traducir
 * @returns {string}
 */
function translate(s) {
  if (!s || typeof s !== 'string') return s || '';
  const trimmed = s.trim();
  if (!trimmed) return s;

  // Lookup directo en cada diccionario
  if (I18N.eventTypes[trimmed] !== undefined) return I18N.eventTypes[trimmed];
  if (I18N.statNames[trimmed] !== undefined)   return I18N.statNames[trimmed];
  if (I18N.leaderCategories[trimmed] !== undefined) return I18N.leaderCategories[trimmed];
  if (I18N.statusDescriptions[trimmed] !== undefined) return I18N.statusDescriptions[trimmed];
  if (I18N.statusDetails[trimmed] !== undefined) return I18N.statusDetails[trimmed];
  if (I18N.seasonTypes[trimmed] !== undefined)  return I18N.seasonTypes[trimmed];
  if (I18N.newsTypes[trimmed] !== undefined)    return I18N.newsTypes[trimmed];
  if (I18N.positions[trimmed] !== undefined)    return I18N.positions[trimmed];
  if (I18N.venues[trimmed] !== undefined)       return I18N.venues[trimmed];

  // Match case-insensitive
  const lower = trimmed.toLowerCase();
  for (const dict of [I18N.eventTypes, I18N.statNames, I18N.leaderCategories,
                      I18N.statusDescriptions, I18N.statusDetails, I18N.seasonTypes,
                      I18N.newsTypes, I18N.positions]) {
    if (dict[lower] !== undefined) return dict[lower];
  }

  // Frases compuestas: "Regular Season - Matchday X" → "Temporada Regular - Jornada X"
  if (/Regular Season/i.test(trimmed)) {
    return trimmed.replace(/Regular Season/gi, 'Temporada Regular');
  }

  // Etapas con sufijos
  if (/Group Stage/i.test(trimmed)) {
    return trimmed.replace(/Group Stage/gi, 'Fase de Grupos');
  }
  if (/Round of 16/i.test(trimmed)) {
    return trimmed.replace(/Round of 16/gi, 'Octavos de final');
  }
  if (/Quarterfinal/i.test(trimmed) || /Quarter-final/i.test(trimmed)) {
    return trimmed.replace(/Quarterfinal/gi, 'Cuartos de final')
                  .replace(/Quarter-final/gi, 'Cuartos de final');
  }
  if (/Semifinal/i.test(trimmed)) {
    return trimmed.replace(/Semifinal/gi, 'Semifinal');
  }
  if (/Knockout Stage/i.test(trimmed)) {
    return trimmed.replace(/Knockout Stage/gi, 'Fase eliminatoria');
  }

  // Números con sufijos: "Matchday 1" → "Jornada 1", "Match Day 1"
  if (/Match\s*Day\s*(\d+)/i.test(trimmed)) {
    return trimmed.replace(/Match\s*Day\s*(\d+)/gi, 'Jornada $1');
  }
  if (/Matchday\s*(\d+)/i.test(trimmed)) {
    return trimmed.replace(/Matchday\s*(\d+)/gi, 'Jornada $1');
  }
  if (/Gameweek\s*(\d+)/i.test(trimmed)) {
    return trimmed.replace(/Gameweek\s*(\d+)/gi, 'Semana $1');
  }

  // Resultado en corto: "W 2-0" → "G 2-0" (ganó)
  if (/^[WDL]\s+\d+-\d+$/i.test(trimmed)) {
    return trimmed.replace(/^W/i, 'G').replace(/^D/i, 'E').replace(/^L/i, 'P');
  }

  // Caer al original
  return s;
}

/**
 * Traduce el nombre de un evento, manejando casos compuestos
 * como "Penalty - Missed" o "Yellow Red Card".
 *
 * @param {string} t - Texto del evento
 * @returns {string}
 */
function translateEventType(t) {
  if (!t) return '';
  return I18N.eventTypes[t] !== undefined ? I18N.eventTypes[t] : translate(t);
}

/**
 * Traduce el nombre de una estadística, con fallback inteligente.
 *
 * @param {string} k - Clave CamelCase o nombre legible
 * @returns {string}
 */
function translateStatName(k) {
  if (!k) return '';
  if (I18N.statNames[k] !== undefined) return I18N.statNames[k];
  // Convertir camelCase a "Title Case"
  const title = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  return translate(title);
}

/**
 * Traduce el nombre de un jugador aplicando transliteraciones
 * (Š → S, Č → C, etc.) y manteniendo nombres en español.
 *
 * @param {string} name - Nombre del jugador
 * @returns {string}
 */
function translatePlayerName(name) {
  if (!name || typeof name !== 'string') return name || '';

  // Reemplazos comunes de diacríticos (Š → S, etc.)
  // En español los nombres Šeško, Čech, Žižek se escriben Sesko, Cech, Zizek
  const replacements = [
    [/š/g, 's'], [/Š/g, 'S'],
    [/č/g, 'c'], [/Č/g, 'C'],
    [/ć/g, 'c'], [/Ć/g, 'C'],
    [/ž/g, 'z'], [/Ž/g, 'Z'],
    [/đ/g, 'd'], [/Đ/g, 'D'],
    [/ñ/g, 'ñ'], // se mantiene
    [/á/g, 'á'], [/é/g, 'é'], [/í/g, 'í'], [/ó/g, 'ó'], [/ú/g, 'ú'],
  ];
  let out = name;
  for (const [pat, rep] of replacements) {
    out = out.replace(pat, rep);
  }
  return out;
}

/**
 * Traduce estado (status) completo de un partido desde ESPN.
 *
 * @param {object} statusObj - { description, shortDetail, detail, type: {state, completed} }
 * @returns {object} - { description, shortDetail, detail, status }
 */
function translateStatus(statusObj) {
  if (!statusObj) return { description: '', shortDetail: '', detail: '', status: 'SCHEDULED' };
  const out = {
    description: translate(statusObj.description || ''),
    shortDetail: translate(statusObj.shortDetail || ''),
    detail:      translate(statusObj.detail || ''),
    type:        statusObj.type,
    status:      statusObj.status || '',
  };
  return out;
}

/**
 * Traduce un nombre de fase/round/leg.
 *
 * @param {string} slug - Slug o nombre de la fase
 * @returns {string}
 */
function translateRoundName(slug) {
  if (!slug) return '';
  return translateStage(slug);
}

/**
 * Procesa texto de noticia para:
 *  - Mantener el texto original en inglés (no traducimos word-by-word)
 *  - Devolver metadatos: si contiene nombres de equipos, edad, etc.
 *
 * @param {string} text - Texto de la noticia
 * @param {Array} teamList - Lista de equipos para detectar menciones
 * @returns {object} - { mentionedTeams, originalText, isRecent }
 */
function analyzeNews(text, teamList) {
  if (!text) return { mentionedTeams: [], originalText: '', isRecent: false };
  const mentionedTeams = [];
  if (Array.isArray(teamList)) {
    for (const t of teamList) {
      const nameRegex = new RegExp(`\\b${escapeRegex(t.name)}\\b`, 'i');
      const codeRegex = new RegExp(`\\b${t.fifaCode}\\b`);
      if (nameRegex.test(text) || codeRegex.test(text)) {
        mentionedTeams.push(t);
      }
    }
  }
  return { mentionedTeams, originalText: text, isRecent: false };
}

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =====================================================================
// EXPORTS (ES Modules)
// =====================================================================

export {
  I18N,
  translate,
  translateEventType,
  translateStatName,
  translatePlayerName,
  translateStatus,
  translateRoundName,
  analyzeNews,
  translateStage,
  STATUS_SHORT_MAP,
  STATUS_DESC_MAP,
  escapeRegex,
};
