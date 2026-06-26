// =====================================================================
// montecarlo.js — Simulación Monte Carlo del torneo completo
// WC26 Nerdytics · Vanilla
// =====================================================================
//
// Mejoras vs versión anterior:
//   - Web Worker para no bloquear UI
//   - Memoización de predictMatch
//   - Callbacks de progreso
//   - Modo sync fallback (sin workers)
//   - Soporta cancel
// =====================================================================

import { predictMatch } from './predictor.js';

// =====================================================================
// HELPERS INTERNOS
// =====================================================================

const _teams = window.STATIC_TEAMS || [];
const _groups = window.GROUPS_LIST || ['A','B','C','D','E','F','G','H','I','J','K','L'];
const _teamByCode = Object.fromEntries(_teams.map(t => [t.fifaCode, t]));

/**
 * Simula los partidos de un grupo y devuelve clasificación ordenada.
 */
function simulateGroup(gTeams, rng) {
  const stats = {};
  gTeams.forEach(t => { stats[t.fifaCode] = { pts: 0, gf: 0, ga: 0, gd: 0, t }; });

  for (let i = 0; i < gTeams.length; i++) {
    for (let j = i + 1; j < gTeams.length; j++) {
      const flip = rng() < 0.5;
      const home = flip ? gTeams[i] : gTeams[j];
      const away = flip ? gTeams[j] : gTeams[i];
      const pred = predictMatch(home, away, true);

      const r = rng();
      let sH = 0, sA = 0;
      if (r < pred.probabilities.homeWin / 100) {
        sH = 1 + Math.floor(rng() * 3);
        sA = Math.floor(rng() * 2);
      } else if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) {
        const g = Math.floor(rng() * 3);
        sH = g; sA = g;
      } else {
        sA = 1 + Math.floor(rng() * 3);
        sH = Math.floor(rng() * 2);
      }

      stats[home.fifaCode].gf += sH;
      stats[home.fifaCode].ga += sA;
      stats[away.fifaCode].gf += sA;
      stats[away.fifaCode].ga += sH;
      if (sH > sA) stats[home.fifaCode].pts += 3;
      else if (sH < sA) stats[away.fifaCode].pts += 3;
      else { stats[home.fifaCode].pts++; stats[away.fifaCode].pts++; }
    }
  }

  Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
  return Object.values(stats).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.t.fifaRank - b.t.fifaRank
  );
}

/**
 * Construye el cuadro de octavos según reglas FIFA 2026:
 * - 1A vs 2C, 1C vs 2A
 * - 1B vs 2E, 1E vs 2B
 * - ... etc (12 cruces de grupos) + 4 cruces de terceros
 */
function buildRoundOf32(winners, runners, thirds) {
  // winners[g], runners[g], thirds ya está top 8
  const used = new Set();
  const pairs = [];

  // Parejas predefinidas 1º vs 2º (FIFA WC26)
  const groupPairs = [
    ['A','C'],['C','A'],['B','E'],['E','B'],['D','F'],['F','D'],
    ['G','I'],['I','G'],['H','J'],['J','H'],['K','L'],['L','K'],
  ];
  groupPairs.forEach(([wG, rG]) => {
    const a = _teamByCode[winners[wG]];
    const b = _teamByCode[runners[rG]];
    if (a && b && a.fifaCode !== b.fifaCode && !used.has(a.fifaCode) && !used.has(b.fifaCode)) {
      pairs.push({ a, b });
      used.add(a.fifaCode); used.add(b.fifaCode);
    }
  });

  // 4 cruces de terceros (best 8 vs 8 terceros restantes)
  // Simplificación: emparejar en orden
  for (let i = 0; i < thirds.length && pairs.length < 16; i += 2) {
    const a = thirds[i], b = thirds[i + 1];
    if (a && b && !used.has(a.fifaCode) && !used.has(b.fifaCode)) {
      pairs.push({ a, b });
      used.add(a.fifaCode); used.add(b.fifaCode);
    }
  }

  return pairs;
}

/**
 * Simula eliminación directa con predictMatch.
 */
function simulateKnockout(matches, rng, label) {
  if (matches.length <= 1) return matches;
  const next = [];
  for (let i = 0; i < matches.length; i += 2) {
    const teamA = matches[i];
    const teamB = matches[i + 1] || matches[i];
    if (!teamA || !teamB) continue;
    const pred = predictMatch(teamA, teamB, false);
    const r = rng();
    let winner;
    if (r < pred.probabilities.homeWin / 100) winner = teamA;
    else if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) {
      winner = rng() < 0.5 ? teamA : teamB;
    } else {
      winner = teamB;
    }
    next.push(winner);
  }
  return next;
}

/**
 * Una simulación completa del torneo. Devuelve contadores para cada equipo.
 */
function runOneSimulation(rng) {
  const counts = {};
  _teams.forEach(t => {
    counts[t.fifaCode] = {
      qualified: 0, roundOf16: 0, roundOf32: 0,
      quarterfinal: 0, semifinal: 0, finalist: 0, champion: 0,
    };
  });

  // Fase de grupos
  const winners = {}, runners = {}, thirdTeams = [];
  _groups.forEach(g => {
    const gTeams = _teams.filter(t => t.group === g);
    const sorted = simulateGroup(gTeams, rng);
    winners[g] = sorted[0].t.fifaCode;
    runners[g] = sorted[1].t.fifaCode;
    thirdTeams.push(sorted[2].t);
  });

  // Top 8 terceros
  const bestThirds = [...thirdTeams]
    .sort((a, b) => {
      // Orden FIFA oficial: pts, GD, GF, GF away, won, draw
      // Simplificado:
      return b.attackStrength - a.attackStrength || b.fifaRank - a.fifaRank;
    })
    .slice(0, 8);

  // Conteo clasificados
  Object.values(winners).forEach(c => counts[c].qualified++);
  Object.values(runners).forEach(c => counts[c].qualified++);
  bestThirds.forEach(t => counts[t.fifaCode].qualified++);

  // R32 (32avos en WC26 - hay 32 partidos de fase eliminatoria inicial)
  const r32Pairs = buildRoundOf32(winners, runners, bestThirds);
  r32Pairs.forEach(p => counts[p.a.fifaCode].roundOf32++);

  // R16 (octavos)
  const r32Teams = r32Pairs.map(p => {
    const pred = predictMatch(p.a, p.b, false);
    const r = rng();
    if (r < pred.probabilities.homeWin / 100) return p.a;
    if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) return rng() < 0.5 ? p.a : p.b;
    return p.b;
  });
  r32Teams.forEach(t => counts[t.fifaCode].roundOf16++);

  // R8, R4, R2, R1
  let current = r32Teams;
  const stages = [
    { key: 'quarterfinal', label: 'Cuartos' },
    { key: 'semifinal',    label: 'Semis' },
    { key: 'finalist',     label: 'Final' },
    { key: 'champion',     label: 'Campeón' },
  ];
  for (const stage of stages) {
    current = simulateKnockout(current, rng, stage.label);
    current.forEach(t => counts[t.fifaCode][stage.key]++);
    if (current.length === 1) break;
  }

  return counts;
}

// =====================================================================
// SIMULACIÓN PRINCIPAL
// =====================================================================

let _cancelRequested = false;

function cancelSimulation() {
  _cancelRequested = true;
}

/**
 * Simulación síncrona (bloquea UI pero más simple).
 */
function simulateTournamentSync(simulations, onProgress) {
  const seed = Date.now() + Math.floor(Math.random() * 1e6);
  let s = seed;
  const rng = () => {
    // Mulberry32
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const counts = {};
  _teams.forEach(t => {
    counts[t.fifaCode] = {
      qualified: 0, roundOf16: 0, roundOf32: 0,
      quarterfinal: 0, semifinal: 0, finalist: 0, champion: 0,
    };
  });

  _cancelRequested = false;
  for (let sim = 0; sim < simulations; sim++) {
    if (_cancelRequested) break;
    if (onProgress && sim % 50 === 0) onProgress(sim / simulations);
    const r = runOneSimulation(rng);
    for (const code of Object.keys(r)) {
      counts[code].qualified    += r[code].qualified;
      counts[code].roundOf32    += r[code].roundOf32;
      counts[code].roundOf16    += r[code].roundOf16;
      counts[code].quarterfinal += r[code].quarterfinal;
      counts[code].semifinal    += r[code].semifinal;
      counts[code].finalist     += r[code].finalist;
      counts[code].champion     += r[code].champion;
    }
  }

  if (onProgress) onProgress(1);

  return Object.entries(counts).map(([code, c]) => ({
    fifaCode: code,
    team: _teamByCode[code],
    probabilities: {
      qualifyFromGroup: +(c.qualified / simulations * 100).toFixed(2),
      roundOf32:        +(c.roundOf32 / simulations * 100).toFixed(2),
      roundOf16:        +(c.roundOf16 / simulations * 100).toFixed(2),
      quarterfinal:     +(c.quarterfinal / simulations * 100).toFixed(2),
      semifinal:        +(c.semifinal / simulations * 100).toFixed(2),
      finalist:         +(c.finalist / simulations * 100).toFixed(2),
      champion:         +(c.champion / simulations * 100).toFixed(2),
    },
  })).sort((a, b) => b.probabilities.champion - a.probabilities.champion);
}

/**
 * Simulación asíncrona usando Web Worker si está disponible.
 * Fallback a sync si el worker no se puede crear.
 */
async function simulateTournament(simulations, onProgress) {
  if (typeof Worker === 'undefined') {
    return simulateTournamentSync(simulations, onProgress);
  }

  return new Promise((resolve, reject) => {
    try {
      const workerSrc = buildWorkerSource();
      const blob = new Blob([workerSrc], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      worker.onmessage = (e) => {
        const { type, progress, result, error } = e.data;
        if (type === 'progress' && onProgress) onProgress(progress);
        else if (type === 'done') {
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(result);
        } else if (type === 'error') {
          worker.terminate();
          URL.revokeObjectURL(url);
          // Fallback a sync
          try {
            const r = simulateTournamentSync(simulations, onProgress);
            resolve(r);
          } catch (err) {
            reject(err);
          }
        }
      };
      worker.onerror = (err) => {
        worker.terminate();
        URL.revokeObjectURL(url);
        const r = simulateTournamentSync(simulations, onProgress);
        resolve(r);
      };

      worker.postMessage({ type: 'simulate', simulations });
    } catch (err) {
      // Fallback sync
      const r = simulateTournamentSync(simulations, onProgress);
      resolve(r);
    }
  });
}

/**
 * Construye el código fuente del Web Worker (self-contained).
 * Replica las funciones puras pero sin dependencias externas.
 */
function buildWorkerSource() {
  return `
    let _cancelRequested = false;

    function eloExpected(rA, rB) {
      return 1 / (1 + Math.pow(10, (rB - rA) / 400));
    }
    function poissonProb(k, lambda) {
      if (lambda <= 0) return k === 0 ? 1 : 0;
      if (k === 0) return Math.exp(-lambda);
      let logP = -lambda + k * Math.log(lambda);
      for (let i = 2; i <= k; i++) logP -= Math.log(i);
      return Math.exp(logP);
    }
    function dixonColesTau(x, y, lH, lA, rho = -0.1) {
      if (x === 0 && y === 0) return 1 - lH * lA * rho;
      if (x === 0 && y === 1) return 1 + lH * rho;
      if (x === 1 && y === 0) return 1 + lA * rho;
      if (x === 1 && y === 1) return 1 - rho;
      return 1;
    }
    function formMult(form) { return 0.85 + form * 0.30; }

    function enrichTeam(t) {
      const elo = t.elo || 1500;
      const rank = t.fifaRank || 50;
      let attack = t.attackStrength;
      let defense = t.defenseStrength;
      if (typeof attack !== 'number' || typeof defense !== 'number') {
        attack  = Math.max(0.5, Math.min(2.2, 0.7 + (elo - 1300) / 600));
        defense = Math.max(0.7, Math.min(2.0, 2.2 - (elo - 1300) / 600));
      }
      return { ...t, attackStrength: attack, defenseStrength: defense,
               form: typeof t.form === 'number' ? t.form : 0.55 };
    }

    function predictMatch(a, b, isHome) {
      const ea = enrichTeam(a);
      const eb = enrichTeam(b);
      const lambdaA = (ea.attackStrength * eb.defenseStrength / 1.35) * (isHome ? 1.10 : 1) * formMult(ea.form);
      const lambdaB = (eb.attackStrength * ea.defenseStrength / 1.35) * formMult(eb.form);
      const MAX = 7;
      const matrix = Array.from({ length: MAX + 1 }, () => Array(MAX + 1).fill(0));
      for (let i = 0; i <= MAX; i++) {
        for (let j = 0; j <= MAX; j++) {
          matrix[i][j] = poissonProb(i, lambdaA) * poissonProb(j, lambdaB)
                        * dixonColesTau(i, j, lambdaA, lambdaB);
        }
      }
      let pH = 0, pD = 0, pA = 0;
      const scores = [];
      for (let i = 0; i <= MAX; i++) {
        for (let j = 0; j <= MAX; j++) {
          const p = matrix[i][j];
          if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
          scores.push({ home: i, away: j, prob: p });
        }
      }
      const eloPA = eloExpected(ea.elo + (isHome ? 60 : 0), eb.elo);
      const eloDraw = 0.27;
      const eloPH = eloPA * (1 - eloDraw);
      const eloPAway = (1 - eloPA) * (1 - eloDraw);
      const finalH = 0.7 * pH + 0.3 * eloPH;
      const finalA = 0.7 * pA + 0.3 * eloPAway;
      const finalD = Math.max(0, 1 - finalH - finalA);
      const top = scores.sort((x, y) => y.prob - x.prob).slice(0, 5);
      return {
        probabilities: {
          homeWin: +(finalH * 100).toFixed(2),
          draw:    +(finalD * 100).toFixed(2),
          awayWin: +(finalA * 100).toFixed(2),
        },
        topScores: top.map(s => ({ ...s, probPct: +(s.prob * 100).toFixed(2) })),
      };
    }

    function simulateGroup(gTeams, rng) {
      const stats = {};
      gTeams.forEach(t => { stats[t.fifaCode] = { pts: 0, gf: 0, ga: 0, gd: 0, t }; });
      for (let i = 0; i < gTeams.length; i++) {
        for (let j = i + 1; j < gTeams.length; j++) {
          const flip = rng() < 0.5;
          const home = flip ? gTeams[i] : gTeams[j];
          const away = flip ? gTeams[j] : gTeams[i];
          const pred = predictMatch(home, away, true);
          const r = rng();
          let sH = 0, sA = 0;
          if (r < pred.probabilities.homeWin / 100) {
            sH = 1 + Math.floor(rng() * 3);
            sA = Math.floor(rng() * 2);
          } else if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) {
            const g = Math.floor(rng() * 3);
            sH = g; sA = g;
          } else {
            sA = 1 + Math.floor(rng() * 3);
            sH = Math.floor(rng() * 2);
          }
          stats[home.fifaCode].gf += sH; stats[home.fifaCode].ga += sA;
          stats[away.fifaCode].gf += sA; stats[away.fifaCode].ga += sH;
          if (sH > sA) stats[home.fifaCode].pts += 3;
          else if (sH < sA) stats[away.fifaCode].pts += 3;
          else { stats[home.fifaCode].pts++; stats[away.fifaCode].pts++; }
        }
      }
      Object.values(stats).forEach(s => s.gd = s.gf - s.ga);
      return Object.values(stats).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.t.fifaRank - b.t.fifaRank);
    }

    function buildR32(winners, runners, thirds) {
      const used = new Set();
      const pairs = [];
      const groupPairs = [
        ['A','C'],['C','A'],['B','E'],['E','B'],['D','F'],['F','D'],
        ['G','I'],['I','G'],['H','J'],['J','H'],['K','L'],['L','K'],
      ];
      groupPairs.forEach(([wG, rG]) => {
        const a = window.TEAM_BY_CODE_?.[winners[wG]];
        const b = window.TEAM_BY_CODE_?.[runners[rG]];
        if (a && b && !used.has(a.fifaCode) && !used.has(b.fifaCode)) {
          pairs.push({ a, b });
          used.add(a.fifaCode); used.add(b.fifaCode);
        }
      });
      for (let i = 0; i < thirds.length && pairs.length < 16; i += 2) {
        const a = thirds[i], b = thirds[i + 1];
        if (a && b && !used.has(a.fifaCode) && !used.has(b.fifaCode)) {
          pairs.push({ a, b });
          used.add(a.fifaCode); used.add(b.fifaCode);
        }
      }
      return pairs;
    }

    function runSim(teams, groups, teamByCode, rng) {
      const counts = {};
      teams.forEach(t => {
        counts[t.fifaCode] = {
          qualified: 0, roundOf16: 0, roundOf32: 0,
          quarterfinal: 0, semifinal: 0, finalist: 0, champion: 0,
        };
      });
      const winners = {}, runners = {}, thirdTeams = [];
      groups.forEach(g => {
        const gTeams = teams.filter(t => t.group === g);
        const sorted = simulateGroup(gTeams, rng);
        winners[g] = sorted[0].t.fifaCode;
        runners[g] = sorted[1].t.fifaCode;
        thirdTeams.push(sorted[2].t);
      });
      const bestThirds = [...thirdTeams].slice(0, 8);
      Object.values(winners).forEach(c => counts[c].qualified++);
      Object.values(runners).forEach(c => counts[c].qualified++);
      bestThirds.forEach(t => counts[t.fifaCode].qualified++);

      const r32Pairs = buildR32(winners, runners, bestThirds);
      r32Pairs.forEach(p => counts[p.a.fifaCode].roundOf32++);

      const r32Teams = r32Pairs.map(p => {
        const pred = predictMatch(p.a, p.b, false);
        const r = rng();
        if (r < pred.probabilities.homeWin / 100) return p.a;
        if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) return rng() < 0.5 ? p.a : p.b;
        return p.b;
      });
      r32Teams.forEach(t => counts[t.fifaCode].roundOf16++);

      let current = r32Teams;
      const stages = [
        { key: 'quarterfinal' }, { key: 'semifinal' },
        { key: 'finalist' }, { key: 'champion' },
      ];
      for (const stage of stages) {
        const next = [];
        for (let i = 0; i < current.length; i += 2) {
          const a = current[i], b = current[i + 1] || current[i];
          if (!a || !b) continue;
          const pred = predictMatch(a, b, false);
          const r = rng();
          let winner;
          if (r < pred.probabilities.homeWin / 100) winner = a;
          else if (r < (pred.probabilities.homeWin + pred.probabilities.draw) / 100) winner = rng() < 0.5 ? a : b;
          else winner = b;
          next.push(winner);
          if (next.length >= Math.ceil(current.length / 2)) break;
        }
        current = next;
        current.forEach(t => counts[t.fifaCode][stage.key]++);
        if (current.length === 1) break;
      }
      return counts;
    }

    self.onmessage = (e) => {
      const { type, simulations } = e.data;
      if (type !== 'simulate') return;
      try {
        const teams = e.data.teams;
        const groups = e.data.groups;
        const teamByCode = {};
        teams.forEach(t => teamByCode[t.fifaCode] = t);
        const seed = Date.now() + Math.floor(Math.random() * 1e6);
        let s = seed;
        const rng = () => {
          s = (s + 0x6D2B79F5) | 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        const counts = {};
        teams.forEach(t => {
          counts[t.fifaCode] = {
            qualified: 0, roundOf16: 0, roundOf32: 0,
            quarterfinal: 0, semifinal: 0, finalist: 0, champion: 0,
          };
        });

        for (let sim = 0; sim < simulations; sim++) {
          if (_cancelRequested) break;
          if (sim % 100 === 0) {
            self.postMessage({ type: 'progress', progress: sim / simulations });
          }
          const r = runSim(teams, groups, teamByCode, rng);
          for (const code of Object.keys(r)) {
            counts[code].qualified    += r[code].qualified;
            counts[code].roundOf32    += r[code].roundOf32;
            counts[code].roundOf16    += r[code].roundOf16;
            counts[code].quarterfinal += r[code].quarterfinal;
            counts[code].semifinal    += r[code].semifinal;
            counts[code].finalist     += r[code].finalist;
            counts[code].champion     += r[code].champion;
          }
        }
        const result = Object.entries(counts).map(([code, c]) => ({
          fifaCode: code,
          team: teamByCode[code],
          probabilities: {
            qualifyFromGroup: +(c.qualified / simulations * 100).toFixed(2),
            roundOf32:        +(c.roundOf32 / simulations * 100).toFixed(2),
            roundOf16:        +(c.roundOf16 / simulations * 100).toFixed(2),
            quarterfinal:     +(c.quarterfinal / simulations * 100).toFixed(2),
            semifinal:        +(c.semifinal / simulations * 100).toFixed(2),
            finalist:         +(c.finalist / simulations * 100).toFixed(2),
            champion:         +(c.champion / simulations * 100).toFixed(2),
          },
        })).sort((a, b) => b.probabilities.champion - a.probabilities.champion);
        self.postMessage({ type: 'done', result });
      } catch (err) {
        self.postMessage({ type: 'error', error: err.message });
      }
    };
  `;
}

// =====================================================================
// EXPORTS
// =====================================================================

export {
  simulateTournament,
  simulateTournamentSync,
  runOneSimulation,
  cancelSimulation,
  buildRoundOf32,
};
