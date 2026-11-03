// ESTADO, ALMACENAMIENTO Y ARMADO DEL PLANTEL
// Cada "equipo/torneo" es un espacio de trabajo (workspace) guardado en el navegador de este dispositivo.
// Todo se calcula a partir de las planillas CABB cargadas (CABB.aggregatePlayers).

const LS_INDEX = 'rm2_index';
const LS_ACTIVE = 'rm2_active';
const LS_WS = 'rm2_ws_';
const DEFAULT_SETTINGS = { ptsWin: 2, ptsLoss: 1, playoffSpots: 8, minTurns: 3, maxTurns: 6 };
const DEFAULT_COLS = ['EQUIPO', 'Nombre', 'PJ', 'MIN', 'PTS', 'T2%', 'T3%', 'T1%', 'TC%', 'PLAYS', 'PPP', 'TO%', 'RT', 'AST', 'VAL'];

let state = {
  wsId: null, wsName: '', category: '', myTeam: '', settings: Object.assign({}, DEFAULT_SETTINGS),
  matches: [], rosterMeta: {}, training: { currentWeek: 'Semana 1', filterCat: 'MAIN', weeks: {} }, nextOpponent: '',
  // derivados
  roster: [], scoutingData: [], teams: [], standings: [],
  // interfaz
  selectedColumns: DEFAULT_COLS.slice(), sortCol: 'PTS', sortAsc: false,
  activeModalPlayerId: null, showReserves: true, selectedSwapId: null
};

// ---------- utilidades ----------
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cleanTeamName(name) { return name || ''; } // los nombres ya vienen normalizados por CABB.normTeam
function isMine(team) { return !!state.myTeam && team === state.myTeam; }
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) {
  try { localStorage.setItem(k, v); return true; } catch (e) {
    alert('No pude guardar en este navegador (¿memoria llena o modo privado?). Hacé un respaldo con "Respaldo" para no perder datos.');
    return false;
  }
}
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }

// ---------- índice de equipos/torneos ----------
function listWorkspaces() {
  try { return JSON.parse(lsGet(LS_INDEX) || '[]') || []; } catch (e) { return []; }
}
function writeIndex(list) { lsSet(LS_INDEX, JSON.stringify(list)); }

// ---------- serialización ----------
function serializeWorkspace() {
  return {
    v: 2, id: state.wsId, name: state.wsName, category: state.category, myTeam: state.myTeam,
    settings: state.settings, nextOpponent: state.nextOpponent,
    matches: state.matches.map(m => ({
      id: m.id, home: m.home, away: m.away, homePts: m.homePts, awayPts: m.awayPts, round: m.round || '', date: m.date || '',
      players: (m.players || []).map(CABB.packPlayer)
    })),
    roster: state.rosterMeta, training: state.training
  };
}

function saveWorkspace() {
  if (!state.wsId) return;
  if (lsSet(LS_WS + state.wsId, JSON.stringify(serializeWorkspace()))) {
    const idx = listWorkspaces();
    const row = idx.find(r => r.id === state.wsId);
    const info = { id: state.wsId, name: state.wsName, category: state.category, myTeam: state.myTeam, updated: Date.now() };
    if (row) Object.assign(row, info); else idx.push(info);
    writeIndex(idx);
  }
}

function applyWorkspace(ws) {
  state.wsId = ws.id;
  state.wsName = ws.name || 'Mi equipo';
  state.category = ws.category || '';
  state.myTeam = ws.myTeam || '';
  state.settings = Object.assign({}, DEFAULT_SETTINGS, ws.settings || {});
  state.nextOpponent = ws.nextOpponent || '';
  state.matches = (ws.matches || []).map(m => ({
    id: m.id, home: m.home, away: m.away, homePts: m.homePts, awayPts: m.awayPts, round: m.round || '', date: m.date || '',
    players: (m.players || []).map(CABB.unpackPlayer)
  }));
  state.rosterMeta = ws.roster || {};
  state.training = ws.training || {};
  state.selectedSwapId = null;
  state.activeModalPlayerId = null;
  if (typeof initTrainingData === 'function') initTrainingData();
  rebuildDerived();
}

function loadWorkspace(id) {
  let ws = null;
  try { ws = JSON.parse(lsGet(LS_WS + id) || 'null'); } catch (e) { ws = null; }
  if (!ws) return false;
  applyWorkspace(ws);
  lsSet(LS_ACTIVE, id);
  return true;
}

function newWorkspaceId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Crea un equipo/torneo a partir de {name, category, myTeam, matches, settings?}
function createWorkspace(opts) {
  const ws = {
    v: 2, id: newWorkspaceId(), name: opts.name || 'Mi equipo', category: opts.category || '', myTeam: opts.myTeam || '',
    settings: Object.assign({}, DEFAULT_SETTINGS, opts.settings || {}), nextOpponent: '',
    matches: (opts.matches || []).map((m, i) => ({
      id: 'm_' + (i + 1), home: m.home, away: m.away, homePts: m.homePts, awayPts: m.awayPts, round: m.round || '', date: m.date || '',
      players: (m.players || []).map(CABB.packPlayer)
    })),
    roster: opts.roster || {}, training: opts.training || {}
  };
  applyWorkspace(ws);
  saveWorkspace();
  lsSet(LS_ACTIVE, ws.id);
  return ws;
}

function deleteWorkspace(id) {
  lsDel(LS_WS + id);
  writeIndex(listWorkspaces().filter(r => r.id !== id));
  if (lsGet(LS_ACTIVE) === id) lsDel(LS_ACTIVE);
}

// ---------- cálculo de todo lo derivado ----------
function rebuildDerived() {
  state.scoutingData = CABB.aggregatePlayers(state.matches);
  const teams = new Set();
  state.matches.forEach(m => { teams.add(m.home); teams.add(m.away); });
  state.teams = Array.from(teams).sort();
  buildRoster();
  computeStandings();
}

function defaultPositions(list) {
  // Perfil de juego: más rebotes que pases -> más cerca del aro. Se reparte en 5 grupos del mismo tamaño.
  const sorted = list.slice().sort((a, b) => ((a.stats.RT || 0) - 2 * (a.stats.AST || 0)) - ((b.stats.RT || 0) - 2 * (b.stats.AST || 0)));
  const order = ['PG', 'SG', 'SF', 'PF', 'C'];
  const out = {};
  sorted.forEach((p, i) => { out[p.key] = order[Math.min(4, Math.floor(i * 5 / sorted.length))]; });
  return out;
}

function buildRoster() {
  const mine = state.scoutingData.filter(p => p.EQUIPO === state.myTeam);
  const fresh = !Object.keys(state.rosterMeta).some(k => mine.some(p => p.KEY === k)); // primera vez con este equipo
  const wrapped = mine.map(p => ({ key: p.KEY, stats: p, p: p }));
  const posGuess = defaultPositions(wrapped);
  const byMin = mine.slice().sort((a, b) => (b.MIN || 0) - (a.MIN || 0));

  state.roster = mine.map(p => {
    let meta = state.rosterMeta[p.KEY];
    if (!meta) {
      const rank = byMin.indexOf(p);
      meta = {
        pos: posGuess[p.KEY], cat: 'MAIN', dorsal: parseInt(p.NUM, 10) || 0,
        isStarter: fresh && rank < 5, courtSlot: null, isConvocada: fresh && rank < 12, depth: 99, status: 'ACT'
      };
      state.rosterMeta[p.KEY] = meta;
    }
    return {
      id: 'p_' + hashStr(p.KEY), key: p.KEY, name: p.Nombre, pos: meta.pos, roleLabel: meta.pos, cat: meta.cat || 'MAIN',
      dorsal: meta.dorsal, isStarter: !!meta.isStarter, courtSlot: meta.courtSlot || null, isConvocada: !!meta.isConvocada,
      depth: meta.depth || 99, status: meta.status || 'ACT', stats: p
    };
  });

  // Profundidad: dentro de cada puesto, ordenar por minutos (solo a las que todavía no tienen orden asignado)
  ['PG', 'SG', 'SF', 'PF', 'C'].forEach(pos => {
    const col = state.roster.filter(p => p.pos === pos);
    if (!col.some(p => p.depth === 99)) return;
    col.sort((a, b) => (a.depth === 99 ? 1000 - (a.stats.MIN || 0) : a.depth) - (b.depth === 99 ? 1000 - (b.stats.MIN || 0) : b.depth));
    col.forEach((p, i) => { p.depth = i + 1; });
  });

  // Puestos de cancha de los titulares
  if (typeof assignCourtSlot === 'function') {
    state.roster.filter(p => p.isStarter && !p.courtSlot).forEach(p => assignCourtSlot(p));
  }
  syncRosterMeta();
}

function syncRosterMeta() {
  state.roster.forEach(p => {
    state.rosterMeta[p.key] = {
      pos: p.pos, cat: p.cat || 'MAIN', dorsal: p.dorsal, isStarter: p.isStarter, courtSlot: p.courtSlot,
      isConvocada: p.isConvocada, depth: p.depth, status: p.status
    };
  });
}

// Auto-guardado (lo llaman los módulos de plantel, profundidad y cancha)
function saveRosterState() {
  syncRosterMeta();
  saveWorkspace();
}

// Rearma el plantel desde cero con las reglas por defecto (12 con más minutos citadas, 5 titulares)
function autoSetupRoster() {
  state.roster.forEach(p => { delete state.rosterMeta[p.key]; });
  buildRoster();
  saveWorkspace();
  refreshAll();
}

// ---------- arranque ----------
function refreshAll() {
  updateHeader();
  renderStandings();
  renderMatchesHistory();
  renderTopPerformers();
  renderLeagueTiles();
  renderRosterTable();
  updateCourtPositions();
  renderColumnTags();
  fillTeamFilter();
  initOpponentSelect();
  const active = document.querySelector('[id^="view-"]:not(.hidden):not(#view-welcome)');
  const name = active ? active.id.replace('view-', '') : 'torneo';
  if (typeof switchTab === 'function') switchTab(name);
}

function fillTeamFilter() {
  const teamSelect = document.getElementById('scoutTeamFilter');
  if (!teamSelect) return;
  teamSelect.innerHTML = `<option value="ALL">TODOS LOS EQUIPOS (${state.teams.length})</option>`;
  state.teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.innerText = t;
    teamSelect.appendChild(opt);
  });
  const sub = document.getElementById('scoutingSubtitle');
  if (sub) sub.innerText = `Base consolidada de jugadoras de los ${state.teams.length} equipos de ${state.wsName}`;
}

function initData() {
  const idx = listWorkspaces();
  const active = lsGet(LS_ACTIVE);
  if (active && idx.some(r => r.id === active) && loadWorkspace(active)) {
    showApp();
  } else if (idx.length && loadWorkspace(idx[0].id)) {
    showApp();
  } else {
    showWelcome();
  }
}
