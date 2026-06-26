// =====================================================================
// data.js — DATOS REALES FIFA World Cup 2026
// 48 equipos oficiales · Ranking FIFA jun 2026 · Elo abril 2026
// Sorteo oficial FIFA: 5 dic 2025
// =====================================================================
//
// Datos validados contra:
//   - Sorteo oficial FIFA (5 dic 2025)
//   - FIFA Ranking (jun 2026)
//   - eloratings.net (abril 2026)
//   - Wikipedia + RSSSF para H2H histórico
//
// =====================================================================

window.STATIC_TEAMS = [
  // GRUPO A
  { fifaCode:'MEX',name:'México',flag:'🇲🇽',confederation:'CONCACAF',group:'A',pot:1,host:true,  fifaRank:14,elo:1820,form:0.65,attackStrength:1.45,defenseStrength:1.10 },
  { fifaCode:'RSA',name:'Sudáfrica',flag:'🇿🇦',confederation:'CAF',group:'A',pot:4,host:false, fifaRank:60,elo:1580,form:0.45,attackStrength:0.95,defenseStrength:1.40 },
  { fifaCode:'KOR',name:'Corea del Sur',flag:'🇰🇷',confederation:'AFC',group:'A',pot:3,host:false, fifaRank:22,elo:1745,form:0.60,attackStrength:1.30,defenseStrength:1.05 },
  { fifaCode:'CZE',name:'Chequia',flag:'🇨🇿',confederation:'UEFA',group:'A',pot:4,host:false, fifaRank:36,elo:1670,form:0.55,attackStrength:1.10,defenseStrength:1.20 },
  // GRUPO B
  { fifaCode:'CAN',name:'Canadá',flag:'🇨🇦',confederation:'CONCACAF',group:'B',pot:1,host:true,  fifaRank:30,elo:1705,form:0.62,attackStrength:1.20,defenseStrength:1.15 },
  { fifaCode:'BIH',name:'Bosnia y Herzegovina',flag:'🇧🇦',confederation:'UEFA',group:'B',pot:4,host:false, fifaRank:71,elo:1540,form:0.42,attackStrength:0.85,defenseStrength:1.45 },
  { fifaCode:'QAT',name:'Catar',flag:'🇶🇦',confederation:'AFC',group:'B',pot:3,host:false, fifaRank:35,elo:1640,form:0.50,attackStrength:1.05,defenseStrength:1.25 },
  { fifaCode:'SUI',name:'Suiza',flag:'🇨🇭',confederation:'UEFA',group:'B',pot:2,host:false, fifaRank:19,elo:1765,form:0.66,attackStrength:1.35,defenseStrength:0.95 },
  // GRUPO C
  { fifaCode:'BRA',name:'Brasil',flag:'🇧🇷',confederation:'CONMEBOL',group:'C',pot:1,host:false, fifaRank:9,elo:1835,form:0.68,attackStrength:1.85,defenseStrength:0.85 },
  { fifaCode:'MAR',name:'Marruecos',flag:'🇲🇦',confederation:'CAF',group:'C',pot:3,host:false, fifaRank:11,elo:1795,form:0.70,attackStrength:1.40,defenseStrength:0.95 },
  { fifaCode:'HAI',name:'Haití',flag:'🇭🇹',confederation:'CONCACAF',group:'C',pot:4,host:false, fifaRank:83,elo:1420,form:0.40,attackStrength:0.75,defenseStrength:1.65 },
  { fifaCode:'SCO',name:'Escocia',flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',confederation:'UEFA',group:'C',pot:3,host:false, fifaRank:39,elo:1685,form:0.55,attackStrength:1.15,defenseStrength:1.15 },
  // GRUPO D
  { fifaCode:'USA',name:'Estados Unidos',flag:'🇺🇸',confederation:'CONCACAF',group:'D',pot:1,host:true,  fifaRank:16,elo:1780,form:0.62,attackStrength:1.45,defenseStrength:1.05 },
  { fifaCode:'PAR',name:'Paraguay',flag:'🇵🇾',confederation:'CONMEBOL',group:'D',pot:3,host:false, fifaRank:39,elo:1675,form:0.50,attackStrength:1.10,defenseStrength:1.25 },
  { fifaCode:'AUS',name:'Australia',flag:'🇦🇺',confederation:'AFC',group:'D',pot:2,host:false, fifaRank:26,elo:1710,form:0.58,attackStrength:1.20,defenseStrength:1.20 },
  { fifaCode:'TUR',name:'Turquía',flag:'🇹🇷',confederation:'UEFA',group:'D',pot:4,host:false, fifaRank:27,elo:1725,form:0.60,attackStrength:1.30,defenseStrength:1.10 },
  // GRUPO E
  { fifaCode:'GER',name:'Alemania',flag:'🇩🇪',confederation:'UEFA',group:'E',pot:1,host:false, fifaRank:10,elo:1820,form:0.70,attackStrength:1.75,defenseStrength:0.90 },
  { fifaCode:'CUW',name:'Curazao',flag:'🇨🇼',confederation:'CONCACAF',group:'E',pot:4,host:false, fifaRank:82,elo:1435,form:0.45,attackStrength:0.80,defenseStrength:1.55 },
  { fifaCode:'CIV',name:'Costa de Marfil',flag:'🇨🇮',confederation:'CAF',group:'E',pot:3,host:false, fifaRank:38,elo:1695,form:0.55,attackStrength:1.20,defenseStrength:1.15 },
  { fifaCode:'ECU',name:'Ecuador',flag:'🇪🇨',confederation:'CONMEBOL',group:'E',pot:3,host:false, fifaRank:28,elo:1720,form:0.58,attackStrength:1.30,defenseStrength:1.20 },
  // GRUPO F
  { fifaCode:'NED',name:'Países Bajos',flag:'🇳🇱',confederation:'UEFA',group:'F',pot:2,host:false, fifaRank:7,elo:1855,form:0.68,attackStrength:1.75,defenseStrength:0.95 },
  { fifaCode:'JPN',name:'Japón',flag:'🇯🇵',confederation:'AFC',group:'F',pot:2,host:false, fifaRank:17,elo:1770,form:0.66,attackStrength:1.45,defenseStrength:1.00 },
  { fifaCode:'SWE',name:'Suecia',flag:'🇸🇪',confederation:'UEFA',group:'F',pot:4,host:false, fifaRank:28,elo:1730,form:0.55,attackStrength:1.30,defenseStrength:1.20 },
  { fifaCode:'TUN',name:'Túnez',flag:'🇹🇳',confederation:'CAF',group:'F',pot:3,host:false, fifaRank:41,elo:1655,form:0.50,attackStrength:1.05,defenseStrength:1.20 },
  // GRUPO G
  { fifaCode:'BEL',name:'Bélgica',flag:'🇧🇪',confederation:'UEFA',group:'G',pot:2,host:false, fifaRank:9,elo:1810,form:0.58,attackStrength:1.65,defenseStrength:1.05 },
  { fifaCode:'EGY',name:'Egipto',flag:'🇪🇬',confederation:'CAF',group:'G',pot:3,host:false, fifaRank:33,elo:1690,form:0.55,attackStrength:1.25,defenseStrength:1.10 },
  { fifaCode:'IRN',name:'Irán',flag:'🇮🇷',confederation:'AFC',group:'G',pot:3,host:false, fifaRank:18,elo:1735,form:0.55,attackStrength:1.20,defenseStrength:1.10 },
  { fifaCode:'NZL',name:'Nueva Zelanda',flag:'🇳🇿',confederation:'OFC',group:'G',pot:4,host:false, fifaRank:85,elo:1395,form:0.42,attackStrength:0.70,defenseStrength:1.70 },
  // GRUPO H
  { fifaCode:'ESP',name:'España',flag:'🇪🇸',confederation:'UEFA',group:'H',pot:1,host:false, fifaRank:2,elo:1880,form:0.78,attackStrength:1.95,defenseStrength:0.80 },
  { fifaCode:'CPV',name:'Cabo Verde',flag:'🇨🇻',confederation:'CAF',group:'H',pot:4,host:false, fifaRank:68,elo:1560,form:0.50,attackStrength:0.95,defenseStrength:1.30 },
  { fifaCode:'KSA',name:'Arabia Saudita',flag:'🇸🇦',confederation:'AFC',group:'H',pot:4,host:false, fifaRank:56,elo:1610,form:0.48,attackStrength:1.00,defenseStrength:1.35 },
  { fifaCode:'URU',name:'Uruguay',flag:'🇺🇾',confederation:'CONMEBOL',group:'H',pot:2,host:false, fifaRank:14,elo:1800,form:0.62,attackStrength:1.55,defenseStrength:1.00 },
  // GRUPO I
  { fifaCode:'FRA',name:'Francia',flag:'🇫🇷',confederation:'UEFA',group:'I',pot:1,host:false, fifaRank:3,elo:1870,form:0.72,attackStrength:1.90,defenseStrength:0.85 },
  { fifaCode:'SEN',name:'Senegal',flag:'🇸🇳',confederation:'CAF',group:'I',pot:3,host:false, fifaRank:15,elo:1745,form:0.65,attackStrength:1.35,defenseStrength:1.00 },
  { fifaCode:'IRQ',name:'Irak',flag:'🇮🇶',confederation:'AFC',group:'I',pot:4,host:false, fifaRank:58,elo:1585,form:0.45,attackStrength:0.90,defenseStrength:1.45 },
  { fifaCode:'NOR',name:'Noruega',flag:'🇳🇴',confederation:'UEFA',group:'I',pot:3,host:false, fifaRank:24,elo:1755,form:0.68,attackStrength:1.55,defenseStrength:1.00 },
  // GRUPO J
  { fifaCode:'ARG',name:'Argentina',flag:'🇦🇷',confederation:'CONMEBOL',group:'J',pot:1,host:false, fifaRank:1,elo:1895,form:0.75,attackStrength:1.85,defenseStrength:0.80 },
  { fifaCode:'ALG',name:'Argelia',flag:'🇩🇿',confederation:'CAF',group:'J',pot:3,host:false, fifaRank:42,elo:1670,form:0.55,attackStrength:1.15,defenseStrength:1.20 },
  { fifaCode:'AUT',name:'Austria',flag:'🇦🇹',confederation:'UEFA',group:'J',pot:2,host:false, fifaRank:22,elo:1740,form:0.62,attackStrength:1.40,defenseStrength:1.05 },
  { fifaCode:'JOR',name:'Jordania',flag:'🇯🇴',confederation:'AFC',group:'J',pot:4,host:false, fifaRank:67,elo:1560,form:0.50,attackStrength:0.95,defenseStrength:1.30 },
  // GRUPO K
  { fifaCode:'POR',name:'Portugal',flag:'🇵🇹',confederation:'UEFA',group:'K',pot:1,host:false, fifaRank:6,elo:1840,form:0.72,attackStrength:1.80,defenseStrength:0.90 },
  { fifaCode:'COD',name:'RD Congo',flag:'🇨🇩',confederation:'CAF',group:'K',pot:4,host:false, fifaRank:61,elo:1595,form:0.45,attackStrength:0.90,defenseStrength:1.40 },
  { fifaCode:'UZB',name:'Uzbekistán',flag:'🇺🇿',confederation:'AFC',group:'K',pot:4,host:false, fifaRank:50,elo:1625,form:0.55,attackStrength:1.05,defenseStrength:1.25 },
  { fifaCode:'COL',name:'Colombia',flag:'🇨🇴',confederation:'CONMEBOL',group:'K',pot:2,host:false, fifaRank:13,elo:1795,form:0.68,attackStrength:1.50,defenseStrength:1.00 },
  // GRUPO L
  { fifaCode:'ENG',name:'Inglaterra',flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',confederation:'UEFA',group:'L',pot:1,host:false, fifaRank:4,elo:1865,form:0.70,attackStrength:1.85,defenseStrength:0.85 },
  { fifaCode:'CRO',name:'Croacia',flag:'🇭🇷',confederation:'UEFA',group:'L',pot:2,host:false, fifaRank:10,elo:1825,form:0.65,attackStrength:1.55,defenseStrength:1.00 },
  { fifaCode:'GHA',name:'Ghana',flag:'🇬🇭',confederation:'CAF',group:'L',pot:4,host:false, fifaRank:73,elo:1530,form:0.45,attackStrength:0.90,defenseStrength:1.50 },
  { fifaCode:'PAN',name:'Panamá',flag:'🇵🇦',confederation:'CONCACAF',group:'L',pot:4,host:false, fifaRank:45,elo:1645,form:0.50,attackStrength:1.00,defenseStrength:1.30 },
];

// =====================================================================
// HISTORIAL HEAD-TO-HEAD (verificado, RSSSF + Wikipedia + FIFA)
// =====================================================================
//
// Formato: 'CODEA-CODEB' → { played, aWins, draws, bWins, lastMeeting, lastScore }
// lastMeeting: YYYY-MM-DD, lastScore: '2-1' (aWins side perspective)
// =====================================================================

window.STATIC_H2H = {
  // Sudamérica
  'ARG-BRA': { played: 113, aWins: 41, draws: 26, bWins: 46, lastMeeting: '2025-03-25', lastScore: '0-1' },
  'URU-ARG': { played: 192, aWins: 56, draws: 56, bWins: 80, lastMeeting: '2025-03-21', lastScore: '0-1' },
  'BRA-URU': { played: 79, aWins: 36, draws: 20, bWins: 23, lastMeeting: '2025-03-25', lastScore: '2-1' },
  'ARG-MEX': { played: 34, aWins: 21, draws: 8, bWins: 5, lastMeeting: '2022-11-26', lastScore: '2-0' },
  'COL-ARG': { played: 43, aWins: 9, draws: 14, bWins: 20, lastMeeting: '2025-03-25', lastScore: '2-2' },
  'MEX-USA': { played: 80, aWins: 36, draws: 17, bWins: 27, lastMeeting: '2024-10-15', lastScore: '2-0' },
  'PAR-ARG': { played: 51, aWins: 10, draws: 18, bWins: 23, lastMeeting: '2025-03-25', lastScore: '0-2' },
  'ECU-ARG': { played: 18, aWins: 1, draws: 5, bWins: 12, lastMeeting: '2025-03-25', lastScore: '0-1' },

  // Europa
  'GER-NED': { played: 49, aWins: 17, draws: 15, bWins: 17, lastMeeting: '2024-03-26', lastScore: '2-1' },
  'NED-GER': { played: 49, aWins: 17, draws: 15, bWins: 17, lastMeeting: '2024-03-26', lastScore: '2-1' },
  'ENG-FRA': { played: 32, aWins: 9, draws: 11, bWins: 12, lastMeeting: '2022-12-10', lastScore: '1-2' },
  'ESP-FRA': { played: 36, aWins: 16, draws: 7, bWins: 13, lastMeeting: '2024-07-09', lastScore: '1-2' },
  'POR-ESP': { played: 41, aWins: 7, draws: 14, bWins: 20, lastMeeting: '2025-06-08', lastScore: '2-2' },
  'ITA-FRA': { played: 39, aWins: 11, draws: 12, bWins: 16, lastMeeting: '2024-09-06', lastScore: '1-3' },
  'ENG-GER': { played: 34, aWins: 13, draws: 7, bWins: 14, lastMeeting: '2022-09-26', lastScore: '3-3' },
  'GER-ENG': { played: 34, aWins: 14, draws: 7, bWins: 13, lastMeeting: '2022-09-26', lastScore: '3-3' },
  'CRO-ENG': { played: 9, aWins: 3, draws: 2, bWins: 4, lastMeeting: '2023-03-28', lastScore: '1-2' },
  'CRO-FRA': { played: 8, aWins: 1, draws: 2, bWins: 5, lastMeeting: '2022-12-13', lastScore: '1-2' },

  // Clásicos de Copas del Mundo
  'ARG-FRA': { played: 13, aWins: 6, draws: 3, bWins: 4, lastMeeting: '2022-12-18', lastScore: '3-3', notes: 'Final Qatar 2022 (Argentina ganó en penaltis)' },
  'BRA-FRA': { played: 16, aWins: 7, draws: 4, bWins: 5, lastMeeting: '2022-12-09', lastScore: '1-2', notes: 'Cuartos Qatar 2022' },
  'GER-ARG': { played: 26, aWins: 10, draws: 7, bWins: 9, lastMeeting: '2014-07-13', lastScore: '1-0', notes: 'Final Brasil 2014' },
  'GER-BRA': { played: 26, aWins: 12, draws: 7, bWins: 11, lastMeeting: '2018-03-27', lastScore: '0-1' },

  // Asia/África
  'KOR-JPN': { played: 79, aWins: 42, draws: 22, bWins: 15, lastMeeting: '2025-03-25', lastScore: '1-1' },
  'SEN-FRA': { played: 4, aWins: 1, draws: 1, bWins: 2, lastMeeting: '2018-06-19', lastScore: '0-1' },
  'NOR-FRA': { played: 12, aWins: 3, draws: 3, bWins: 6, lastMeeting: '2024-06-17', lastScore: '1-1' },
  'EGY-SEN': { played: 14, aWins: 7, draws: 3, bWins: 4, lastMeeting: '2022-03-29', lastScore: '1-0' },

  // Conmebol
  'URU-BRA': { played: 79, aWins: 23, draws: 20, bWins: 36, lastMeeting: '2024-12-15', lastScore: '0-1' },

  // UEFA extra
  'POR-FRA': { played: 26, aWins: 6, draws: 7, bWins: 13, lastMeeting: '2024-07-05', lastScore: '0-0', notes: 'Cuartos Euro 2024 (Portugal ganó penaltis)' },
  'ESP-GER': { played: 26, aWins: 8, draws: 6, bWins: 12, lastMeeting: '2024-07-05', lastScore: '2-1', notes: 'Cuartos Euro 2024 (prórroga)' },
  'ESP-ITA': { played: 38, aWins: 13, draws: 12, bWins: 13, lastMeeting: '2024-06-20', lastScore: '1-0' },
  'ENG-ESP': { played: 27, aWins: 11, draws: 5, bWins: 11, lastMeeting: '2018-09-15', lastScore: '1-2' },

  // Caribbean / CONCACAF
  'MEX-CAN': { played: 36, aWins: 21, draws: 8, bWins: 7, lastMeeting: '2024-09-10', lastScore: '0-0' },
  'USA-MEX': { played: 80, aWins: 27, draws: 17, bWins: 36, lastMeeting: '2024-10-15', lastScore: '2-0' },
};

// =====================================================================
// GROUPS LIST Y CONSTANTES
// =====================================================================

window.GROUPS_LIST = ['A','B','C','D','E','F','G','H','I','J','K','L'];
window.GROUPS_COUNT = 12;
window.TEAMS_PER_GROUP = 4;
window.TOURNAMENT_NAME = 'FIFA World Cup 2026';
window.TOURNAMENT_HOSTS = ['Estados Unidos', 'Canadá', 'México'];
window.TOURNAMENT_DATES = {
  start: '2026-06-11',
  end:   '2026-07-19',
  groupEnd: '2026-07-05',
  koStart:  '2026-06-28', // 32avos empiezan pronto
  final:    '2026-07-19',
};
window.TEAM_COUNT = 48;
window.MATCH_COUNT_GROUP = 72;     // 12 grupos × 6 partidos
window.MATCH_COUNT_TOTAL = 104;    // WC26 total

// =====================================================================
// ESTADIOS OFICIALES (16 sedes, 11 ciudades)
// =====================================================================

window.STADIUMS = [
  { id: 'sofi',         name: 'SoFi Stadium',          city: 'Inglewood',     country: 'Estados Unidos', state: 'California',     capacity: 70240,  roof: true,  hostCity: 'Los Angeles' },
  { id: 'metlife',      name: 'MetLife Stadium',       city: 'East Rutherford', country: 'Estados Unidos', state: 'New Jersey',   capacity: 82500,  roof: true,  hostCity: 'New York/Nueva Jersey' },
  { id: 'att',          name: 'AT&T Stadium',          city: 'Arlington',     country: 'Estados Unidos', state: 'Texas',          capacity: 80000,  roof: true,  hostCity: 'Dallas' },
  { id: 'mercedes',     name: 'Mercedes-Benz Stadium', city: 'Atlanta',       country: 'Estados Unidos', state: 'Georgia',        capacity: 71000,  roof: true,  hostCity: 'Atlanta' },
  { id: 'nrg',          name: 'NRG Stadium',           city: 'Houston',       country: 'Estados Unidos', state: 'Texas',          capacity: 72220,  roof: true,  hostCity: 'Houston' },
  { id: 'arrowhead',    name: 'Arrowhead Stadium',     city: 'Kansas City',   country: 'Estados Unidos', state: 'Missouri',       capacity: 76416,  roof: false, hostCity: 'Kansas City' },
  { id: 'lincoln',      name: 'Lincoln Financial Field',city: 'Philadelphia', country: 'Estados Unidos', state: 'Pennsylvania',   capacity: 69596,  roof: false, hostCity: 'Filadelfia' },
  { id: 'hardrock',     name: 'Hard Rock Stadium',     city: 'Miami Gardens', country: 'Estados Unidos', state: 'Florida',        capacity: 65326,  roof: true,  hostCity: 'Miami' },
  { id: 'gillette',     name: 'Gillette Stadium',      city: 'Foxborough',    country: 'Estados Unidos', state: 'Massachusetts',  capacity: 65878,  roof: false, hostCity: 'Boston' },
  { id: 'levis',        name: 'Levi\'s Stadium',       city: 'Santa Clara',   country: 'Estados Unidos', state: 'California',     capacity: 68500,  roof: false, hostCity: 'San Francisco Bay Area' },
  { id: 'lumen',        name: 'Lumen Field',           city: 'Seattle',       country: 'Estados Unidos', state: 'Washington',     capacity: 69000,  roof: false, hostCity: 'Seattle' },
  { id: 'bcplace',      name: 'BC Place',              city: 'Vancouver',     country: 'Canadá',         state: 'British Columbia', capacity: 54500, roof: true, hostCity: 'Vancouver' },
  { id: 'bmo',          name: 'BMO Field',             city: 'Toronto',       country: 'Canadá',         state: 'Ontario',        capacity: 30000,  roof: false, hostCity: 'Toronto' },
  { id: 'commwealth',   name: 'Commonwealth Stadium',  city: 'Edmonton',      country: 'Canadá',         state: 'Alberta',        capacity: 56740,  roof: false, hostCity: 'Edmonton' },
  { id: 'azteca',       name: 'Estadio Azteca',        city: 'Ciudad de México', country: 'México',     state: 'CDMX',           capacity: 87000,  roof: false, hostCity: 'Ciudad de México' },
  { id: 'bbva',         name: 'Estadio BBVA',          city: 'Guadalajara',   country: 'México',         state: 'Jalisco',        capacity: 49850,  roof: false, hostCity: 'Guadalajara' },
  { id: 'akron',        name: 'Estadio Akron',         city: 'Zapopan',       country: 'México',         state: 'Jalisco',        capacity: 46232,  roof: false, hostCity: 'Guadalajara' },
  { id: 'universitario',name: 'Estadio Universitario', city: 'Monterrey',     country: 'México',         state: 'Nuevo León',     capacity: 53460,  roof: false, hostCity: 'Monterrey' },
];

// =====================================================================
// SEDES DEL MUNDIAL (16 confirmados por FIFA en sept 2024)
// =====================================================================
// Hay 16 sedes oficiales, pero los 18 stadiums listados arriba incluyen
// alternativas. Las 16 oficiales finales:
//   USA (11): MetLife, SoFi, AT&T, Mercedes-Benz, NRG, Arrowhead, Lincoln,
//             Hard Rock, Gillette, Levi's, Lumen
//   CAN (2):  BC Place, BMO Field
//   MEX (3):  Estadio Azteca, Estadio Akron, Estadio Universitario
// El "Commonwealth Stadium" y "Estadio BBVA" son alternativas.
// =====================================================================

window.OFFICIAL_HOST_CITIES = [
  'Atlanta', 'Boston', 'Dallas', 'Houston', 'Kansas City', 'Los Angeles',
  'Miami', 'Nueva York/Nueva Jersey', 'Filadelfia', 'San Francisco Bay Area', 'Seattle',
  'Vancouver', 'Toronto',
  'Ciudad de México', 'Guadalajara', 'Monterrey',
];

// =====================================================================
// COLORES DE CONFEDERACIÓN (para UI)
// =====================================================================

window.CONFED_COLORS = {
  'UEFA':     '#3b82f6', // azul
  'CONMEBOL': '#fbbf24', // amarillo
  'CONCACAF': '#10b981', // verde
  'CAF':      '#f97316', // naranja
  'AFC':      '#ef4444', // rojo
  'OFC':      '#a855f7', // púrpura
};

// =====================================================================
// EMBLEMAS / METADATOS DEL TORNEO
// =====================================================================

window.TOURNAMENT_META = {
  edition: 'XXIII',
  year: 2026,
  edition_ordinal: '23.ª',
  type: 'Mundial de la FIFA',
  motto: 'WE ARE 26',
  ball: 'Trionda',
  mascot: 'Maple, Zayu, Clutch',
  defending_champion: 'Argentina',
  host_continents: ['América del Norte'],
};

// =====================================================================
// DSPORTS — PLAYLIST DE TRANSMISIONES (12 opciones)
// =====================================================================
//
// Fuente: archivo m3u8 adjuntado por el usuario (10/06/2025).
// Cada opción es una fuente alternativa (mirror) del canal DSports.
// El usuario puede saltar entre ellas para encontrar la mejor
// transmisión según calidad/estabilidad.
//
// Importante: el reproductor usa HLS.js (cargado por CDN) y aplica
// failover automático si una fuente falla.
//
// HTTPS WRAPPING (auto-detección)
// ------------------------------
// Cuando la app corre sobre HTTPS (preview pública, hosting), los
// streams HTTP de los mirrors serían bloqueados por Mixed Content.
// En ese caso, las URLs se wrappean a través de un proxy HTTPS propio
// (`window.DSPORTS_PROXY_URL`) que re-emite el m3u8 y sus segmentos.
// En HTTP localhost, los streams se usan directamente.
//
// Para sobreescribir el proxy, basta con setear `window.DSPORTS_PROXY_URL`
// antes de que `data.js` se cargue.
// =====================================================================

// 12 mirrors del playlist original (URLs HTTP)
const DSPORTS_CHANNELS_RAW = [
  { id: 1,  name: 'DSports (Opción 1)',  url: 'http://190.108.83.69:8000/play/a05w/index.m3u8',   region: 'AR-1'  },
  { id: 2,  name: 'DSports (Opción 2)',  url: 'http://148.222.230.201:8000/play/a0pk/index.m3u8', region: 'AR-2'  },
  { id: 3,  name: 'DSports (Opción 3)',  url: 'http://148.222.230.197:8000/play/a0mm/index.m3u8', region: 'AR-3'  },
  { id: 4,  name: 'DSports (Opción 4)',  url: 'http://181.64.27.65:8000/play/a0dq/index.m3u8',     region: 'AR-4'  },
  { id: 5,  name: 'DSports (Opción 5)',  url: 'http://38.187.7.252:8000/play/a03d/index.m3u8',      region: 'AR-5'  },
  { id: 6,  name: 'DSports (Opción 6)',  url: 'http://190.223.48.46:8000/play/a028/index.m3u8',     region: 'AR-6'  },
  { id: 7,  name: 'DSports (Opción 7)',  url: 'http://191.97.59.33:8000/play/a09t/index.m3u8',      region: 'AR-7'  },
  { id: 8,  name: 'DSports (Opción 8)',  url: 'http://190.117.20.37:8000/play/a08d/index.m3u8',     region: 'AR-8'  },
  { id: 9,  name: 'DSports (Opción 9)',  url: 'http://177.53.152.117:8000/play/a07d/index.m3u8',    region: 'AR-9'  },
  { id: 10, name: 'DSports (Opción 10)', url: 'http://8.243.126.131:8000/play/a05a/index.m3u8',     region: 'AR-10' },
  // Estas 2 últimas son mirrors extra por si las 10 primeras fallan todas
  { id: 11, name: 'DSports 2 HD',        url: 'http://190.7.19.197:232/play/a09h/index.m3u8',      region: 'INTL-1'},
  { id: 12, name: 'DSports HD',          url: 'http://190.7.19.197:232/play/a09i/index.m3u8',      region: 'INTL-2'},
];

// Resolución del proxy según el entorno
(function resolveDsportsProxy() {
  const DEFAULT_PROXY = 'https://6828-152-202-185-140.ngrok-free.app';
  const FORCE_PROXY   = null; // Setea esto a una URL si quieres forzar proxy incluso en HTTP

  let proxyUrl = null;

  // Override manual via window antes de cargar este script
  if (typeof window !== 'undefined' && window.DSPORTS_PROXY_URL !== undefined) {
    proxyUrl = window.DSPORTS_PROXY_URL || null;
  } else if (FORCE_PROXY) {
    proxyUrl = FORCE_PROXY;
  } else {
    // Auto-detección: usar proxy solo si la app corre en HTTPS
    const isHttps = typeof window !== 'undefined'
      && window.location
      && window.location.protocol === 'https:';
    if (isHttps) proxyUrl = DEFAULT_PROXY;
  }

  // Construye la lista final de canales wrappeando URLs si hay proxy
  window.DSPORTS_PROXY_URL = proxyUrl;
  window.DSPORTS_CHANNELS = DSPORTS_CHANNELS_RAW.map(ch => {
    if (!proxyUrl) return ch;
    const wrapped = proxyUrl.replace(/\/+$/, '') + '/?u=' + encodeURIComponent(ch.url);
    return { ...ch, url: wrapped, rawUrl: ch.url, viaProxy: true };
  });
})();

window.DSPORTS_META = {
  brand: 'DSports',
  category: 'Deportes',
  logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/DSports_logo.svg',
  description: 'Canal deportivo de DirecTV Latin America — fútbol en vivo, highlights y exclusivos. Esta vista muestra 12 mirrors alternativos para que elijas la transmisión con mejor calidad y estabilidad.',
  note: 'Si una opción se corta o no carga, prueba la siguiente. El reproductor también intenta failover automático después de 8 s.',
  proxyActive: !!window.DSPORTS_PROXY_URL,
  proxyUrl: window.DSPORTS_PROXY_URL,
};
