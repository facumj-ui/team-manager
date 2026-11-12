// IMPORTACIÓN DE PLANILLAS, BIENVENIDA, CAMBIO DE EQUIPO, AJUSTES Y RESPALDO

let pendingImport = null; // { matches, meta } mientras se arma un equipo nuevo

function toast(msg, ms) {
  let el = document.getElementById('toastBox');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastBox';
    el.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-md bg-[#1b0d30] border border-emerald-500/60 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl whitespace-pre-line';
    document.body.appendChild(el);
  }
  el.innerText = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms || 6000);
}

// Lee un archivo como ArrayBuffer (con alternativa para navegadores viejos de tablet)
function readBuf(f) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('No pude leer el archivo ' + f.name));
    r.readAsArrayBuffer(f);
  });
}

const naturalSort = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

// Lee una lista de archivos (.xlsx/.xls sueltos o .zip con planillas) y devuelve [{name, buf}]
async function collectSheetFiles(fileList) {
  const out = [];
  for (const f of Array.from(fileList)) {
    const lower = f.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      if (typeof JSZip === 'undefined') throw new Error('No se pudo cargar el lector de ZIP (revisá la conexión a internet).');
      const zip = await JSZip.loadAsync(await readBuf(f));
      const entries = [];
      zip.forEach((path, entry) => {
        const base = path.split('/').pop();
        if (entry.dir || path.indexOf('__MACOSX') >= 0 || base.startsWith('~$') || base.startsWith('.')) return;
        if (/\.xlsx?$/i.test(base)) entries.push({ name: path, entry: entry });
      });
      for (const e of entries) out.push({ name: e.name, buf: await e.entry.async('arraybuffer') });
    } else if (/\.xlsx?$/i.test(lower)) {
      out.push({ name: f.name, buf: await readBuf(f) });
    }
  }
  return out.sort(naturalSort);
}

// Convierte archivos en partidos. existing = partidos ya cargados (para no duplicar).
async function parseFilesToMatches(fileList, existing) {
  const files = await collectSheetFiles(fileList);
  const seen = new Set((existing || []).map(CABB.matchKey));
  const res = { matches: [], errors: [], dupes: 0, total: files.length, meta: { category: '', tournament: '' }, warnings: [] };
  for (const f of files) {
    try {
      const wb = XLSX.read(new Uint8Array(f.buf), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const m = CABB.parseCabbRows(rows);
      const key = CABB.matchKey(m);
      if (seen.has(key)) { res.dupes++; continue; }
      seen.add(key);
      if (!res.meta.category && m.category) { res.meta.category = m.category; res.meta.tournament = m.tournament; }
      m.warnings.forEach(w => res.warnings.push(f.name + ': ' + w));
      m.id = 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      m.round = '';
      m.date = '';
      res.matches.push(m);
    } catch (err) {
      res.errors.push(f.name.split('/').pop() + ': ' + err.message);
    }
  }
  return res;
}

function summarizeImport(res) {
  let msg = `Planillas leídas: ${res.total}\nPartidos nuevos: ${res.matches.length}`;
  if (res.dupes) msg += `\nYa estaban cargados: ${res.dupes}`;
  if (res.errors.length) msg += `\nNo se pudieron leer (${res.errors.length}):\n- ` + res.errors.slice(0, 4).join('\n- ') + (res.errors.length > 4 ? '\n...' : '');
  if (res.warnings.length) msg += `\nAvisos: ${res.warnings.length} (puntos que no suman)`;
  return msg;
}

// ---------- agregar planillas al equipo activo ----------
async function handleBatchMatches(e) {
  const input = e.target;
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;
  if (!state.wsId) { toast('Primero creá un equipo con "Nuevo".', 8000); return; }
  toast('Leyendo ' + files.length + ' archivo(s)...', 20000);
  try {
    const res = await parseFilesToMatches(files, state.matches);
    if (res.matches.length) {
      state.matches = state.matches.concat(res.matches);
      rebuildDerived();
      saveWorkspace();
      refreshAll();
    }
    toast(summarizeImport(res), 12000);
  } catch (err) {
    toast('Error: ' + err.message, 9000);
  }
}

// ---------- pantalla de bienvenida / equipo nuevo ----------
function showWelcome() {
  pendingImport = null;
  document.getElementById('view-welcome').classList.remove('hidden');
  document.getElementById('appViews').classList.add('hidden');
  document.getElementById('appNav').classList.add('hidden');
  document.getElementById('appActions').classList.add('hidden');
  document.getElementById('welcomeStep2').classList.add('hidden');
  document.getElementById('welcomeStatus').innerText = '';
  const f = document.getElementById('welcomeFileInput');
  if (f) f.value = '';
  const back = document.getElementById('welcomeBack');
  if (back) back.classList.toggle('hidden', !state.wsId && listWorkspaces().length === 0);
  const list = document.getElementById('welcomeExisting');
  if (list) {
    const idx = listWorkspaces();
    list.innerHTML = idx.length
      ? '<div class="text-[11px] text-gray-400 mb-1.5 uppercase font-bold">Tus equipos guardados en este dispositivo</div>' + idx.map(r =>
        `<button onclick="switchWorkspace('${r.id}')" class="w-full text-left px-3 py-2 rounded-lg bg-[#110620] border border-purple-900/60 hover:border-emerald-500 mb-1.5 text-xs"><b class="text-white">${esc(r.name)}</b> <span class="text-gray-400">· ${esc(r.myTeam || 'sin equipo')}</span></button>`).join('')
      : '';
  }
  updateHeader();
}

function showApp() {
  document.getElementById('view-welcome').classList.add('hidden');
  document.getElementById('appViews').classList.remove('hidden');
  document.getElementById('appNav').classList.remove('hidden');
  document.getElementById('appActions').classList.remove('hidden');
  refreshAll();
}

async function handleWelcomeFiles(e) {
  const input = e.target;
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;
  const status = document.getElementById('welcomeStatus');
  status.innerText = 'Leyendo ' + files.length + ' archivo(s)...';
  try {
    const res = await parseFilesToMatches(files, []);
    if (!res.matches.length) {
      status.innerText = 'No encontré partidos válidos.\n' + (res.errors.slice(0, 4).join('\n') || 'Subí planillas .xlsx de CABB o un .zip que las contenga.');
      return;
    }
    pendingImport = res;
    status.innerText = summarizeImport(res);
    renderWelcomeStep2(res);
  } catch (err) {
    status.innerText = 'Error: ' + err.message;
  }
}

function renderWelcomeStep2(res) {
  const counts = {};
  res.matches.forEach(m => { counts[m.home] = (counts[m.home] || 0) + 1; counts[m.away] = (counts[m.away] || 0) + 1; });
  const teams = Object.keys(counts).sort();
  document.getElementById('wCategory').value = res.meta.category || '';
  document.getElementById('wName').value = [res.meta.category, res.meta.tournament].filter(Boolean).join(' · ') || 'Mi torneo';
  document.getElementById('wTeams').innerHTML = teams.map((t, i) => `
    <label class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#110620] border border-purple-900/60 hover:border-emerald-500 cursor-pointer text-xs">
      <input type="radio" name="wTeam" value="${esc(t)}" ${i === 0 ? '' : ''} class="accent-emerald-500">
      <span class="font-bold text-white flex-1">${esc(t)}</span><span class="text-gray-400">${counts[t]} PJ</span>
    </label>`).join('');
  document.getElementById('welcomeStep2').classList.remove('hidden');
}

function createFromWelcome() {
  if (!pendingImport) return;
  const picked = document.querySelector('input[name="wTeam"]:checked');
  if (!picked) { alert('Elegí cuál es tu equipo.'); return; }
  const name = document.getElementById('wName').value.trim() || 'Mi equipo';
  const category = document.getElementById('wCategory').value.trim();
  createWorkspace({ name: name, category: category, myTeam: picked.value, matches: pendingImport.matches });
  pendingImport = null;
  showApp();
  switchTab('torneo');
  toast('Listo. Armé un plantel inicial con tus jugadoras: ajustá puestos, titulares y citadas en "Planilla & Pizarra".', 9000);
}

function cancelWelcome() {
  pendingImport = null;
  if (listWorkspaces().length) {
    const id = lsGet(LS_ACTIVE) || listWorkspaces()[0].id;
    if (loadWorkspace(id)) { showApp(); return; }
  }
  showWelcome();
}

// ---------- cambio de equipo / torneo ----------
function switchWorkspace(id) {
  if (!id) return;
  if (loadWorkspace(id)) { showApp(); switchTab('torneo'); }
}

function updateHeader() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  set('headerTeamName', state.myTeam || 'Team Manager');
  set('headerCategory', (state.category || 'SIN CATEGORÍA').toUpperCase());
  set('headerLogo', (state.myTeam || 'T').charAt(0).toUpperCase());
  set('torneoNameDisplay', state.wsName || '-');
  const ps = document.getElementById('torneoRules');
  if (ps) ps.innerHTML = `<span class="text-gray-400">Sistema:</span> <b class="text-emerald-400">${state.settings.ptsWin} pts victoria / ${state.settings.ptsLoss} pts derrota</b> · <span class="text-blue-400 font-bold">Top ${state.settings.playoffSpots}</span> a playoffs`;
  const lg = document.getElementById('playoffLegend');
  if (lg) lg.innerText = `1° - ${state.settings.playoffSpots}° a Playoffs`;
  const sw = document.getElementById('wsSwitcher');
  if (sw) {
    const idx = listWorkspaces();
    sw.innerHTML = idx.map(r => `<option value="${r.id}" ${r.id === state.wsId ? 'selected' : ''}>${esc(r.name)}${r.myTeam ? ' — ' + esc(r.myTeam) : ''}</option>`).join('');
  }
  document.title = (state.myTeam ? state.myTeam + ' · ' : '') + 'Team Manager';
}

// ---------- ajustes ----------
function openSettings() {
  if (!state.wsId) return;
  document.getElementById('sName').value = state.wsName;
  document.getElementById('sCategory').value = state.category;
  const sel = document.getElementById('sTeam');
  sel.innerHTML = state.teams.map(t => `<option value="${esc(t)}" ${t === state.myTeam ? 'selected' : ''}>${esc(t)}</option>`).join('');
  document.getElementById('sWin').value = state.settings.ptsWin;
  document.getElementById('sEvalMode').value = state.settings.evalAvgMode || 'all';
  document.getElementById('sLoss').value = state.settings.ptsLoss;
  document.getElementById('sPlayoff').value = state.settings.playoffSpots;
    document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }

function saveSettings() {
  const num = (id, d, lo, hi) => { const v = parseInt(document.getElementById(id).value, 10); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
  state.wsName = document.getElementById('sName').value.trim() || state.wsName;
  state.category = document.getElementById('sCategory').value.trim();
  const newTeam = document.getElementById('sTeam').value;
  state.settings = {
    ptsWin: num('sWin', 2, 0, 9), ptsLoss: num('sLoss', 1, 0, 9), playoffSpots: num('sPlayoff', 8, 1, 32),
    evalAvgMode: document.getElementById('sEvalMode').value === 'blocks' ? 'blocks' : 'all'
  };
  const teamChanged = newTeam && newTeam !== state.myTeam;
  if (teamChanged) state.myTeam = newTeam;
  rebuildDerived();
  saveWorkspace();
  closeSettings();
  refreshAll();
  if (teamChanged) toast('Cambiaste de equipo. Armé un plantel inicial para ' + state.myTeam + '.');
}

function deleteCurrentWorkspace() {
  if (!confirm(`¿Borrar "${state.wsName}" de este dispositivo? Se pierden sus partidos, plantel y estímulos (podés hacer un respaldo antes).`)) return;
  const id = state.wsId;
  deleteWorkspace(id);
  closeSettings();
  const rest = listWorkspaces();
  if (rest.length && loadWorkspace(rest[0].id)) { showApp(); switchTab('torneo'); } else {
    state.wsId = null; state.myTeam = ''; state.matches = []; state.roster = [];
    showWelcome();
  }
}

function clearAllMatches() {
  if (!confirm('¿Quitar TODOS los partidos de este torneo? El plantel y los estímulos se conservan.')) return;
  state.matches = [];
  rebuildDerived();
  saveWorkspace();
  closeSettings();
  refreshAll();
}

// ---------- respaldo ----------
function exportBackup() {
  if (!state.wsId) return;
  syncRosterMeta();
  const blob = new Blob([JSON.stringify(serializeWorkspace())], { type: 'application/json' });
  const a = document.createElement('a');
  const safe = (state.wsName || 'equipo').replace(/[^\w\-]+/g, '_');
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo_${safe}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function exportData() { exportBackup(); }

async function importBackupFile(e) {
  const input = e.target;
  const f = input.files && input.files[0];
  if (!f) return;
  try {
    const ws = JSON.parse(await f.text());
    if (!ws || ws.v !== 2 || !Array.isArray(ws.matches)) throw new Error('El archivo no es un respaldo de Team Manager.');
    if (listWorkspaces().some(r => r.id === ws.id)) ws.id = newWorkspaceId();
    ws.name = ws.name || 'Equipo importado';
    applyWorkspace(ws);
    saveWorkspace();
    lsSet(LS_ACTIVE, ws.id);
    showApp();
    switchTab('torneo');
    toast('Respaldo restaurado: ' + ws.name);
  } catch (err) {
    toast('No pude importar el respaldo: ' + err.message, 8000);
  }
  input.value = '';
}
