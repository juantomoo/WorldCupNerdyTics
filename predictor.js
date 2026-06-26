// =====================================================================
// predictor.js — Modelo de predicción Poisson + Dixon-Coles + Elo
// WC26 Nerdytics · Vanilla
// =====================================================================
//
// Mejoras vs versión anterior:
//   - Memoización de predicciones
//   - Mercados extendidos (BTTS, O/U 2.5, primer gol, handicap asiático)
//   - Derivación dinámica de attackStrength/defenseStrength desde Elo
//   - Forma dinámica
//   - Sin globals (ES module)
// =====================================================================

// =====================================================================
// FUNCIONES BASE (puras)
// =====================================================================

/** Esperanza matemática Elo */
function eloExpected(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/** Probabilidad Poisson (P(X=k)) */
function poissonProb(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  if (k === 0) return Math.exp(-lambda);
  // log P(X=k) = -lambda + k*log(lambda) - log(k!)
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

/** Factor de corrección Dixon-Coles */
function dixonColesTau(x, y, lH, lA, rho = -0.1) {
  if (x === 0 && y === 0) return 1 - lH * lA * rho;
  if (x === 0 && y === 1) return 1 + lH * rho;
  if (x === 1 && y === 0) return 1 + lA * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/** Multiplicador por forma (0..1 → 0.85..1.15) */
function formMult(form) {
  return 0.85 + form * 0.30;
}

// =====================================================================
// DERIVACIÓN DINÁMICA DE STATS DESDE ELO + FIFA RANK
// =====================================================================

/**
 * Si un equipo no tiene attackStrength/defenseStrength, los derivamos
 * de su Elo + FIFA rank usando heurísticas:
 *   - Elo 1900 → attack 2.0, defense 0.7
 *   - Elo 1500 → attack 1.0, defense 1.5
 *   - Lineal en el medio
 *
 * Esto evita tener valores 100% hardcoded.
 */
function deriveTeamStrengths(team) {
  if (typeof team.attackStrength === 'number' && typeof team.defenseStrength === 'number') {
    return {
      attackStrength: team.attackStrength,
      defenseStrength: team.defenseStrength,
    };
  }
  const elo = team.elo || 1500;
  const rank = team.fifaRank || 50;
  // Mapeo suave: Elo 1900+ → attack 2.0, defense 0.7
  //              Elo 1500  → attack 1.0, defense 1.5
  const attack  = clamp(0.7 + (elo - 1300) / 600, 0.5, 2.2);
  const defense = clamp(2.2 - (elo - 1300) / 600, 0.7, 2.0);
  // Modulador por FIFA rank (top 10 → -10% defense penalty)
  const rankMod = 1 - Math.max(0, 1 - rank / 50) * 0.10;
  return {
    attackStrength:  +(attack * rankMod).toFixed(2),
    defenseStrength: +(defense * (1 / rankMod)).toFixed(2),
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Enriquece un equipo con stats derivadas si faltan. */
function enrichTeam(team) {
  const strengths = deriveTeamStrengths(team);
  return {
    ...team,
    attackStrength: strengths.attackStrength,
    defenseStrength: strengths.defenseStrength,
    form: typeof team.form === 'number' ? team.form : 0.55,
  };
}

// =====================================================================
// PREDICCIÓN PRINCIPAL
// =====================================================================

const _predCache = new Map();

function cacheKey(teamA, teamB, isHome) {
  return `${teamA.fifaCode}-${teamB.fifaCode}-${isHome ? 'H' : 'N'}`;
}

/**
 * Predicción completa de un partido.
 *
 * @param {object} teamA
 * @param {object} teamB
 * @param {boolean} isHome - Si A juega en casa
 * @returns {object} prediction
 */
function predictMatch(teamA, teamB, isHome = false) {
  const a = enrichTeam(teamA);
  const b = enrichTeam(teamB);
  const key = cacheKey(a, b, isHome);
  if (_predCache.has(key)) return _predCache.get(key);

  // Lambdas (goles esperados)
  const lambdaA = (a.attackStrength * b.defenseStrength / 1.35) * (isHome ? 1.10 : 1) * formMult(a.form);
  const lambdaB = (b.attackStrength * a.defenseStrength / 1.35) * formMult(b.form);

  // Matriz de probabilidades Poisson + Dixon-Coles
  const MAX = 7;
  const matrix = Array.from({ length: MAX + 1 }, () => Array(MAX + 1).fill(0));
  let total = 0;
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poissonProb(i, lambdaA) * poissonProb(j, lambdaB)
              * dixonColesTau(i, j, lambdaA, lambdaB);
      matrix[i][j] = p;
      total += p;
    }
  }
  if (total > 0 && Math.abs(total - 1) > 1e-6) {
    for (let i = 0; i <= MAX; i++) {
      for (let j = 0; j <= MAX; j++) matrix[i][j] /= total;
    }
  }

  // 1X2
  let pH = 0, pD = 0, pA = 0;
  let over15 = 0, over25 = 0, over35 = 0;
  let bttsYes = 0, bttsNo = 0;
  let firstGoalA = 0, firstGoalB = 0, firstGoalNone = 0;
  const scores = [];
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = matrix[i][j];
      if (i > j) pH += p;
      else if (i === j) pD += p;
      else pA += p;

      const totalGoals = i + j;
      if (totalGoals > 1.5) over15 += p;
      if (totalGoals > 2.5) over25 += p;
      if (totalGoals > 3.5) over35 += p;

      if (i > 0 && j > 0) bttsYes += p;
      else bttsNo += p;

      // Primer gol: P(A primero) = λA / (λA+λB) * P(no 0-0)
      // Simplificación: distribución independiente
      if (i + j > 0) {
        const pNoGoal = poissonProb(0, lambdaA) * poissonProb(0, lambdaB);
        const pAnyGoal = 1 - pNoGoal;
        if (i + j > 0) {
          // P(A marca primero | hay goles) ≈ λA / (λA+λB)
          const wA = lambdaA / (lambdaA + lambdaB);
          const wB = lambdaB / (lambdaA + lambdaB);
          firstGoalA += p * wA;
          firstGoalB += p * wB;
        }
      } else {
        firstGoalNone += p;
      }

      scores.push({ home: i, away: j, prob: p });
    }
  }
  // Normalizar primer gol (excluyendo 0-0)
  const pNoGoal = poissonProb(0, lambdaA) * poissonProb(0, lambdaB);
  firstGoalNone = pNoGoal;
  const firstGoalScale = firstGoalA + firstGoalB;
  if (firstGoalScale > 0) {
    firstGoalA = firstGoalA / firstGoalScale * (1 - pNoGoal);
    firstGoalB = firstGoalB / firstGoalScale * (1 - pNoGoal);
  }

  // Elo blend (70% Poisson, 30% Elo)
  const eloPA     = eloExpected(a.elo + (isHome ? 60 : 0), b.elo);
  const eloDraw   = 0.27;
  const eloPH     = eloPA * (1 - eloDraw);
  const eloPAway  = (1 - eloPA) * (1 - eloDraw);

  const finalH = 0.7 * pH + 0.3 * eloPH;
  const finalA = 0.7 * pA + 0.3 * eloPAway;
  const finalD = Math.max(0, 1 - finalH - finalA);

  // Top marcadores
  const top = scores.sort((x, y) => y.prob - x.prob).slice(0, 10).map(s => ({
    home: s.home,
    away: s.away,
    prob: s.prob,
    probPct: +(s.prob * 100).toFixed(2),
  }));

  // Handicap asiático -1.5
  let asianHomeMinus15 = 0, asianAwayPlus15 = 0;
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const diff = i - j;
      if (diff > 1.5) asianHomeMinus15 += matrix[i][j];
      else asianAwayPlus15 += matrix[i][j];
    }
  }

  const result = {
    probabilities: {
      homeWin: +(finalH * 100).toFixed(2),
      draw:    +(finalD * 100).toFixed(2),
      awayWin: +(finalA * 100).toFixed(2),
    },
    expectedGoals: {
      home: +lambdaA.toFixed(2),
      away: +lambdaB.toFixed(2),
      total: +(lambdaA + lambdaB).toFixed(2),
    },
    markets: {
      over15: +(over15 * 100).toFixed(2),
      under15: +((1 - over15) * 100).toFixed(2),
      over25: +(over25 * 100).toFixed(2),
      under25: +((1 - over25) * 100).toFixed(2),
      over35: +(over35 * 100).toFixed(2),
      under35: +((1 - over35) * 100).toFixed(2),
      bttsYes: +(bttsYes * 100).toFixed(2),
      bttsNo:  +(bttsNo  * 100).toFixed(2),
      firstGoalHome: +(firstGoalA * 100).toFixed(2),
      firstGoalAway: +(firstGoalB * 100).toFixed(2),
      firstGoalNone: +(firstGoalNone * 100).toFixed(2),
      asianHomeMinus15: +(asianHomeMinus15 * 100).toFixed(2),
      asianAwayPlus15: +(asianAwayPlus15 * 100).toFixed(2),
    },
    topScores: top,
    modalScore: { home: top[0].home, away: top[0].away },
    scoreMatrix: matrix,
    components: {
      poisson: {
        homeWin: +(pH * 100).toFixed(2),
        draw:    +(pD * 100).toFixed(2),
        awayWin: +(pA * 100).toFixed(2),
      },
      elo: {
        homeWin: +(eloPH * 100).toFixed(2),
        draw:    +(eloDraw * 100).toFixed(2),
        awayWin: +(eloPAway * 100).toFixed(2),
      },
    },
    homeTeam: { fifaCode: a.fifaCode, name: a.name, flag: a.flag },
    awayTeam: { fifaCode: b.fifaCode, name: b.name, flag: b.flag },
    isHome,
  };

  _predCache.set(key, result);
  return result;
}

/** Limpia cache de predicciones */
function clearPredictorCache() {
  _predCache.clear();
}

/**
 * Compara dos equipos y devuelve análisis lado a lado.
 */
function compareTeams(teamA, teamB) {
  const a = enrichTeam(teamA);
  const b = enrichTeam(teamB);
  const stat = (label, key, format = v => v.toFixed(2), reverse = false) => ({
    label,
    a: typeof a[key] === 'number' ? a[key] : 0,
    b: typeof b[key] === 'number' ? b[key] : 0,
    format,
    reverse,
    winner: (typeof a[key] === 'number' && typeof b[key] === 'number')
      ? (a[key] > b[key] ? (reverse ? 'b' : 'a') : (a[key] < b[key] ? (reverse ? 'a' : 'b') : 'tie'))
      : 'tie',
  });
  const stats = [
    stat('FIFA Rank', 'fifaRank', v => '#' + v, true),
    stat('Elo', 'elo'),
    stat('Forma', 'form', v => (v * 100).toFixed(0) + '%'),
    stat('Ataque', 'attackStrength'),
    stat('Defensa', 'defenseStrength', v => v.toFixed(2), true),
  ];
  const prediction = predictMatch(a, b, false);
  return { stats, prediction, a, b };
}

// =====================================================================
// EXPORTS
// =====================================================================

export {
  eloExpected,
  poissonProb,
  dixonColesTau,
  formMult,
  deriveTeamStrengths,
  enrichTeam,
  predictMatch,
  compareTeams,
  clearPredictorCache,
  clamp,
};
