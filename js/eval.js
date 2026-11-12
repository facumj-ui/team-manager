// EVALUACIÓN DE CRITERIOS DEL PLANTEL
// - El plantel de evaluación (state.squad) es independiente de las planillas de partido: se puede evaluar a
//   jugadoras que todavía no jugaron. Si una jugadora aparece en las planillas, se vincula por nombre.
// - Cada evaluación es de un período (cuatrimestre): state.evalPeriods. Las notas de cada jugadora por período
//   están en entry.evals[periodId] (lista alineada con los criterios, null = sin nota).
// - Las sugerencias salen de las estadísticas de partido y nunca se aplican solas.

const EVAL_COLORS = ['#60a5fa', '#fb7185', '#34d399', '#fbbf24', '#c084fc', '#22d3ee'];

function evalDefaultCriteria() {
  return {
    blocks: [
      { name: 'TALENTO', items: ['Visión periférica', 'Uso de las manos', 'Lectura de situaciones de juego', 'Entendimiento del juego', 'Capacidad de improvisación', 'Comprensión de las indicaciones del entrenador', 'Ejecución de las indicaciones del entrenador', 'Rango de tiro', 'Versatilidad (puede jugar en más de 1 posición)'] },
      { name: 'BIOTIPO', items: ['Aspectos antropométricos - morfológicos', 'Potencial de desarrollo de cualidades físicas y coordinativas', 'Agilidad', 'Explosividad (1er paso)', 'Dominio del espacio', 'Capacidad de cambio de movimiento', 'Sentido de la anticipación', 'Flexibilidad', 'Resistencia', 'Coordinación óculo-manual'] },
      { name: 'TÉCNICO - TÁCTICA', items: ['Cómo defiende (todo el campo)', 'Tiene agresividad', 'Tiene buena mecánica de piernas', 'Utiliza los brazos', 'Tiene buen tiro de media distancia', 'Cómo es su mecánica de tiro', 'Cómo es pasando la pelota', 'Tiene variabilidad de recursos al momento del pase', 'Pasa bien en movimiento', 'Maneja distintos tipos de salidas'] }
    ]
  };
}

// ---------- criterios y promedios ----------
function evalFlat() {
  const out = [];
  state.criteria.blocks.forEach((b, bi) => b.items.forEach(name => out.push({ name: name, block: bi })));
  return out;
}

function evalPad(arr) {
  const n = evalFlat().length;
  const a = Array.isArray(arr) ? arr.slice(0, n) : [];
  while (a.length < n) a.push(null);
  return a;
}

// Promedio por bloque y general (todos los criterios, o promedio de bloques, según Ajustes)
function evalStats(vals) {
  const v = evalPad(vals);
  const flat = evalFlat();
  const blocks = state.criteria.blocks.map(b => ({ name: b.name, sum: 0, n: 0, total: b.items.length, avg: null }));
  let sum = 0, n = 0;
  flat.forEach((c, i) => {
    if (v[i] == null) return;
    blocks[c.block].sum += v[i]; blocks[c.block].n++;
    sum += v[i]; n++;
  });
  blocks.forEach(b => { b.avg = b.n ? b.sum / b.n : null; });
  let general = null;
  if (n) {
    if (state.settings.evalAvgMode === 'blocks') {
      const w = blocks.filter(b => b.avg != null);
      general = w.reduce((a, b) => a + b.avg, 0) / w.length;
    } else general = sum / n;
  }
  return { general: general, filled: n, total: flat.length, blocks: blocks };
}

// Rojo por debajo de 4, naranja de 4 a 7, verde desde 7
function evalTone(v) {
  if (v == null) return { text: 'text-gray-400', bg: 'bg-[#110620] border-purple-900/60' };
  if (v < 4) return { text: 'text-red-300', bg: 'bg-red-950/70 border-red-800' };
  if (v < 7) return { text: 'text-amber-300', bg: 'bg-amber-950/60 border-amber-700' };
  return { text: 'text-emerald-300', bg: 'bg-emerald-950/60 border-emerald-600' };
}
const evalFmt = v => (v == null ? '–' : v.toFixed(2));
const evalFmt1 = v => (v == null ? '–' : v.toFixed(1));

function evalSetCriteria(newCrit) {
  const key = s => CABB.normName(s);
  const oldFlat = evalFlat().map(c => key(c.name));
  const newFlat = [];
  newCrit.blocks.forEach(b => b.items.forEach(n => newFlat.push(key(n))));
  const remap = arr => newFlat.map(k => { const i = oldFlat.indexOf(k); return (i >= 0 && Array.isArray(arr) && arr[i] != null) ? arr[i] : null; });
  state.squad.forEach(e => { Object.keys(e.evals || {}).forEach(pid => { e.evals[pid] = remap(e.evals[pid]); }); });
  state.criteria = newCrit;
}

// ---------- períodos (cuatrimestres) ----------
function evalPeriodLabel(date) {
  const d = date || new Date();
  const n = d.getMonth() < 4 ? 1 : (d.getMonth() < 8 ? 2 : 3);
  return n + '° cuatrimestre ' + d.getFullYear();
}
function evalEnsurePeriod() {
  if (!state.evalPeriods.length) {
    const id = 'ev' + Date.now().toString(36);
    state.evalPeriods.push({ id: id, label: evalPeriodLabel(), created: Date.now() });
    state.evalCurrent = id;
  }
  if (!state.evalPeriods.some(p => p.id === state.evalCurrent)) state.evalCurrent = state.evalPeriods[state.evalPeriods.length - 1].id;
}
function evalPeriodIdx(pid) { return state.evalPeriods.findIndex(p => p.id === pid); }
function evalPrevPeriodId(pid) { const i = evalPeriodIdx(pid); return i > 0 ? state.evalPeriods[i - 1].id : null; }
const evalSave = () => { if (typeof saveWorkspace === 'function') saveWorkspace(); };

// ---------- vínculo con las jugadoras de las planillas ----------
function evalNameScore(ap, nm, fullName) {
  const i = String(fullName).indexOf(',');
  const qa = CABB.normName(i >= 0 ? fullName.slice(0, i) : fullName);
  const qn = CABB.normName(i >= 0 ? fullName.slice(i + 1) : '');
  const a = CABB.normName(ap), n = CABB.normName(nm);
  let sa = 0;
  if (a === qa) sa = 2;
  else if (a.length >= 4 && qa.length >= 4 && (a.startsWith(qa) || qa.startsWith(a))) sa = 1;
  else {
    const at = a.split(' '), qt = qa.split(' ');
    const small = at.length <= qt.length ? at : qt, big = small === at ? qt : at;
    if (small.length && small.every(t => t.length >= 3 && big.indexOf(t) >= 0)) sa = 1;
  }
  if (!sa) return 0;
  const n1 = n.split(' ')[0], m1 = qn.split(' ')[0];
  let sn = 0;
  if (n1 && n1 === m1) sn = 2;
  else if (n1.length >= 3 && m1.length >= 3 && (n1.startsWith(m1) || m1.startsWith(n1))) sn = 1;
  return sn ? sa + sn : 0;
}

// jugadora de las planillas que corresponde a una jugadora del plantel de evaluación (o null)
function evalLinkedPlayer(entry) {
  let best = 0, hits = [];
  state.roster.forEach(p => {
    const sc = evalNameScore(entry.apellido, entry.nombre, p.name);
    if (sc > best) { best = sc; hits = [p]; } else if (sc === best && sc > 0) hits.push(p);
  });
  return hits.length === 1 ? hits[0] : null;
}

// jugadora del plantel de evaluación que corresponde a una jugadora de las planillas (o null)
function evalEntryForPlayer(p) {
  let best = 0, hits = [];
  state.squad.forEach(e => {
    const sc = evalNameScore(e.apellido, e.nombre, p.name);
    if (sc > best) { best = sc; hits = [e]; } else if (sc === best && sc > 0) hits.push(e);
  });
  return hits.length === 1 ? hits[0] : null;
}

// ---------- sugerencias a partir de las estadísticas ----------
// Solo para criterios donde las estadísticas dicen algo. Se comparan con las demás jugadoras del torneo.
let evalPeerCache = null;
function evalPeers() {
  const key = state.scoutingData.length + '|' + state.matches.length;
  if (evalPeerCache && evalPeerCache.key === key) return evalPeerCache;
  const peers = state.scoutingData.filter(s => s.PJ >= 3 && (s.MINT || 0) >= 60);
  const sum = f => peers.reduce((a, s) => a + (s[f] || 0), 0);
  const per36 = (s, tot) => (s.MINT ? tot / s.MINT * 36 : 0);
  const ext = peers.filter(s => s.EXTPJ >= 3);
  evalPeerCache = {
    key: key, peers: peers, ext: ext,
    lg3: sum('T3I') ? sum('T3C') / sum('T3I') : 0.3,
    lg1: sum('T1I') ? sum('T1C') / sum('T1I') : 0.6,
    per36: per36
  };
  return evalPeerCache;
}
function evalPct(x, arr) {
  if (!arr.length) return 0.5;
  let below = 0, eq = 0;
  arr.forEach(v => { if (v < x) below++; else if (v === x) eq++; });
  return (below + eq / 2) / arr.length;
}
const evalToScore = pct => Math.max(2, Math.min(9, Math.round(2 + 7 * pct)));

function evalShrink(made, att, lg, k) { return (made + k * lg) / (att + k); }

// Devuelve { [índice de criterio]: { value, basis } } para una jugadora de las planillas
function evalSuggestions(s) {
  const out = {};
  if (!s || (s.MINT || 0) < 30 || s.PJ < 2) return out;
  const P = evalPeers();
  if (P.peers.length < 8) return out;
  const flat = evalFlat();
  const find = re => flat.findIndex(c => re.test(CABB.normName(c.name)));
  const r1 = x => x.toFixed(1);

  // Rango de tiro: porcentaje de triples (ajustado por intentos) y volumen de triples
  let i = find(/RANGO DE TIRO/);
  if (i >= 0 && s.T3I >= 10) {
    const mine = evalShrink(s.T3C, s.T3I, P.lg3, 20);
    const pctA = evalPct(mine, P.peers.map(o => evalShrink(o.T3C, o.T3I, P.lg3, 20)));
    const vol = P.per36(s, s.T3I);
    const pctB = evalPct(vol, P.peers.map(o => P.per36(o, o.T3I)));
    out[i] = { value: evalToScore(0.7 * pctA + 0.3 * pctB), basis: `Triples ${Math.round(s.T3C / s.T3I * 100)}% (${s.T3C}/${s.T3I}), ${r1(vol)} intentos cada 36'` };
  }
  // Mecánica de tiro: efectividad en tiros libres
  i = find(/MECANICA DE TIRO/);
  if (i >= 0 && s.T1I >= 10) {
    const mine = evalShrink(s.T1C, s.T1I, P.lg1, 15);
    const pct = evalPct(mine, P.peers.map(o => evalShrink(o.T1C, o.T1I, P.lg1, 15)));
    out[i] = { value: evalToScore(pct), basis: `Tiros libres ${Math.round(s.T1C / s.T1I * 100)}% (${s.T1C}/${s.T1I})` };
  }
  // Cómo pasa la pelota: asistencias cada 36' y asistencias por pérdida
  i = find(/PASANDO LA PELOTA/);
  if (i >= 0) {
    const a36 = P.per36(s, s.AST * s.PJ);
    const ratio = (s.AST * s.PJ) / (s.TO + 1);
    const pctA = evalPct(a36, P.peers.map(o => P.per36(o, o.AST * o.PJ)));
    const pctB = evalPct(ratio, P.peers.map(o => (o.AST * o.PJ) / (o.TO + 1)));
    out[i] = { value: evalToScore(0.6 * pctA + 0.4 * pctB), basis: `${r1(a36)} asistencias cada 36', ${r1(ratio)} asistencias por pérdida` };
  }
  // Las siguientes usan recuperos, tapones y faltas: solo hay datos en planillas cargadas con esta versión
  if (s.EXTPJ >= 3 && P.ext.length >= 8) {
    const rate = (o, f) => P.per36(o, f(o));
    i = find(/COMO DEFIENDE/);
    if (i >= 0) {
      const f = o => o.REC_T + o.BLK_T + 0.5 * (o.RD || 0);
      out[i] = { value: evalToScore(evalPct(rate(s, f), P.ext.map(o => rate(o, f)))), basis: `${r1(P.per36(s, s.REC_T))} recuperos, ${r1(P.per36(s, s.BLK_T))} tapones, ${r1(P.per36(s, s.RD || 0))} rebotes def. cada 36'` };
    }
    i = find(/AGRESIVIDAD/);
    if (i >= 0) {
      const pf = evalPct(rate(s, o => o.FR_T), P.ext.map(o => rate(o, x => x.FR_T)));
      const po = evalPct(rate(s, o => o.RO || 0), P.ext.map(o => rate(o, x => x.RO || 0)));
      out[i] = { value: evalToScore(0.5 * pf + 0.5 * po), basis: `${r1(P.per36(s, s.FR_T))} faltas recibidas, ${r1(P.per36(s, s.RO || 0))} rebotes of. cada 36'` };
    }
  }
  return out;
}

// ---------- plantel de evaluación ----------
function evalNewEntryId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function evalFindEntry(id) { return state.squad.find(e => e.id === id); }
function evalSortSquad() {
  const catKey = c => { const m = String(c).match(/(\d+)/); return m ? parseInt(m[1], 10) : 99; };
  state.squad.sort((a, b) => catKey(a.cat) - catKey(b.cat) || a.apellido.localeCompare(b.apellido));
}
function evalCurrentVals(e, pid) { return evalPad((e.evals || {})[pid || state.evalCurrent]); }

// ---------- vista del plantel (sub-pestaña de Planilla & Pizarra) ----------
function setTacticaView(v) {
  const main = document.getElementById('tacticaMain'), ev = document.getElementById('tacticaEval');
  if (!main || !ev) return;
  main.classList.toggle('hidden', v !== 'main');
  ev.classList.toggle('hidden', v !== 'eval');
  const on = 'px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 transition';
  const off = 'px-4 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:text-white transition';
  document.getElementById('tvMain').className = v === 'main' ? on : off;
  document.getElementById('tvEval').className = v === 'eval' ? on : off;
  if (v === 'eval') renderEvalPanel();
}

function sparkline(points) {
  if (points.length < 2) return points.length ? '<span class="text-[10px] text-gray-500">1 evaluación</span>' : '';
  const w = 70, h = 22, pad = 3;
  const xs = i => pad + i * (w - 2 * pad) / (points.length - 1);
  const ys = v => h - pad - (v / 10) * (h - 2 * pad);
  const pts = points.map((v, i) => xs(i).toFixed(1) + ',' + ys(v).toFixed(1)).join(' ');
  const last = points[points.length - 1], prev = points[points.length - 2];
  const col = last >= prev ? '#34d399' : '#fb7185';
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="inline-block align-middle"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${xs(points.length - 1).toFixed(1)}" cy="${ys(last).toFixed(1)}" r="2.4" fill="${col}"/></svg>`;
}

function renderEvalPanel() {
  const box = document.getElementById('evalPanel');
  if (!box || !state.wsId) return;
  evalEnsurePeriod();
  evalSortSquad();
  const cur = state.evalCurrent;
  const prev = evalPrevPeriodId(cur);
  const periodOpts = state.evalPeriods.map(p => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const blocks = state.criteria.blocks;

  let rowsHtml = '';
  let lastCat = null;
  const colSpan = 6 + blocks.length;
  state.squad.forEach(e => {
    if (e.cat !== lastCat) {
      lastCat = e.cat;
      rowsHtml += `<tr><td colspan="${colSpan}" class="pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">${esc(e.cat || 'Sin categoría')}</td></tr>`;
    }
    const st = evalStats(e.evals && e.evals[cur]);
    const ps = prev ? evalStats(e.evals && e.evals[prev]) : null;
    const delta = (st.general != null && ps && ps.general != null) ? st.general - ps.general : null;
    const hist = state.evalPeriods.map(p => evalStats(e.evals && e.evals[p.id]).general).filter(v => v != null);
    const link = evalLinkedPlayer(e);
    const tone = evalTone(st.general);
    rowsHtml += `<tr class="border-b border-purple-950/60 hover:bg-purple-900/20 cursor-pointer" onclick="openEvalEditor('${e.id}')">
      <td class="py-2 pr-2"><div class="font-bold text-white text-xs">${esc(e.apellido)}, ${esc(e.nombre)}</div>
        <div class="text-[10px] ${link ? 'text-emerald-400' : 'text-gray-500'}">${link ? link.stats.PJ + ' PJ · ' + (link.stats.MIN || 0).toFixed(0) + "' por partido" : 'Sin partidos cargados'}</div></td>
      ${st.blocks.map((b, bi) => `<td class="py-2 text-center text-xs font-semibold" style="color:${EVAL_COLORS[bi % EVAL_COLORS.length]}">${evalFmt1(b.avg)}</td>`).join('')}
      <td class="py-2 text-center"><span class="px-2 py-0.5 rounded border ${tone.bg} ${tone.text} text-xs font-black">${st.general == null ? 'Sin evaluar' : evalFmt(st.general)}</span></td>
      <td class="py-2 text-center text-xs font-bold ${delta == null ? 'text-gray-600' : (delta >= 0 ? 'text-emerald-400' : 'text-rose-400')}">${delta == null ? '–' : (delta >= 0 ? '▲ +' : '▼ ') + delta.toFixed(2)}</td>
      <td class="py-2 text-center">${sparkline(hist)}</td>
      <td class="py-2 text-right"><button class="px-2.5 py-1 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-800 text-[11px] font-bold text-purple-200">Evaluar</button></td>
    </tr>`;
  });

  const done = state.squad.filter(e => evalStats(e.evals && e.evals[cur]).filled > 0).length;
  box.innerHTML = `
    <div class="fm-card rounded-2xl p-4 shadow space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-purple-900/60 pb-3">
        <div>
          <h2 class="text-base font-bold text-white uppercase tracking-wider">Evaluación del plantel</h2>
          <p class="text-xs text-gray-400">Notas de 1 a 10 por criterio, jugadora por jugadora. Una evaluación nueva cada 4 meses para ver quién mejora.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select onchange="evalSelectPeriod(this.value)" class="bg-[#110620] border-2 border-emerald-500 rounded-xl px-3 py-1.5 text-xs font-bold text-emerald-400 focus:outline-none cursor-pointer">${periodOpts}</select>
          <button onclick="openEvalPeriod('new')" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950"><i class="fa-solid fa-plus mr-1"></i> Nueva evaluación</button>
          <button onclick="openEvalPeriod('edit')" title="Cambiar nombre o borrar este período" class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#22123d] hover:bg-[#2e1952] text-gray-200 border border-purple-800/80"><i class="fa-solid fa-pen"></i></button>
          <button onclick="openEvalImport()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#22123d] hover:bg-[#2e1952] text-gray-200 border border-purple-800/80"><i class="fa-solid fa-file-excel mr-1"></i> Importar Excel</button>
          <button onclick="openEvalPlayer()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#22123d] hover:bg-[#2e1952] text-gray-200 border border-purple-800/80"><i class="fa-solid fa-user-plus mr-1"></i> Jugadora</button>
        </div>
      </div>
      ${state.squad.length ? `
      <div class="text-[11px] text-gray-400">${done} de ${state.squad.length} jugadoras evaluadas en <b class="text-white">${esc(state.evalPeriods[evalPeriodIdx(cur)].label)}</b>${prev ? ' · la variación se compara con ' + esc(state.evalPeriods[evalPeriodIdx(prev)].label) : ''}.</div>
      <div class="overflow-x-auto">
        <table class="w-full text-left min-w-[640px]">
          <thead><tr class="text-[10px] uppercase text-gray-400">
            <th class="pb-1">Jugadora</th>${blocks.map((b, bi) => `<th class="pb-1 text-center" style="color:${EVAL_COLORS[bi % EVAL_COLORS.length]}">${esc(b.name.length > 10 ? b.name.split(/[\s-]+/)[0] : b.name)}</th>`).join('')}
            <th class="pb-1 text-center">Promedio</th><th class="pb-1 text-center">Variación</th><th class="pb-1 text-center">Evolución</th><th></th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : `
      <div class="text-center border-2 border-dashed border-purple-900/60 rounded-xl p-8 space-y-2">
        <div class="text-sm font-bold text-white">Todavía no cargaste jugadoras para evaluar</div>
        <p class="text-xs text-gray-400">Importá tu Excel de criterios (trae a todas las jugadoras de tus categorías) o agregalas de a una.</p>
        <button onclick="openEvalImport()" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black">Importar Excel de criterios</button>
      </div>`}
    </div>`;
}

function evalSelectPeriod(pid) { state.evalCurrent = pid; evalSave(); renderEvalPanel(); }

// ---------- editor de una jugadora ----------
let evalEditId = null;

function openEvalEditor(id) {
  const e = evalFindEntry(id);
  if (!e) return;
  evalEditId = id;
  renderEvalEditor();
  document.getElementById('evalEditModal').classList.remove('hidden');
}
function closeEvalEditor() {
  document.getElementById('evalEditModal').classList.add('hidden');
  evalEditId = null;
  renderEvalPanel();
  if (typeof renderRosterTable === 'function') renderRosterTable();
}

function renderEvalEditor() {
  const e = evalFindEntry(evalEditId);
  if (!e) return;
  const cur = state.evalCurrent;
  const prevId = evalPrevPeriodId(cur);
  const prevVals = prevId ? evalPad((e.evals || {})[prevId]) : null;
  const vals = evalCurrentVals(e);
  const link = evalLinkedPlayer(e);
  const sug = link ? evalSuggestions(link.stats) : {};
  let idx = 0;
  const body = state.criteria.blocks.map((b, bi) => `
    <div class="mb-3">
      <div class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color:${EVAL_COLORS[bi % EVAL_COLORS.length]}">${esc(b.name)}</div>
      ${b.items.map(name => {
        const i = idx++;
        const s = sug[i];
        return `<div class="py-1.5 border-b border-purple-950/60">
          <div class="flex items-center justify-between gap-2">
            <label for="ev_${i}" class="text-[11px] text-gray-200 leading-tight flex-1 min-w-0">${esc(name)}</label>
            ${prevVals && prevVals[i] != null ? `<span title="Nota del período anterior" class="text-[10px] text-gray-500 flex-shrink-0">antes ${prevVals[i]}</span>` : ''}
            <input id="ev_${i}" type="number" inputmode="numeric" min="1" max="10" step="1" value="${vals[i] == null ? '' : vals[i]}" onchange="setEvalValue(${i}, this.value)" class="w-14 flex-shrink-0 bg-[#110620] border border-purple-800 rounded px-1.5 py-1 text-xs text-white font-bold text-center focus:outline-none focus:border-emerald-400">
          </div>
          ${s ? `<button onclick="applyEvalSuggestion(${i})" class="mt-1 text-left text-[10px] px-2 py-1 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-200 hover:bg-blue-900/60 w-full"><b>Sugerencia ${s.value}</b> · ${esc(s.basis)} <span class="text-blue-300">(tocá para usar)</span></button>` : ''}
        </div>`;
      }).join('')}
    </div>`).join('');

  const hist = state.evalPeriods.map(p => ({ p: p, st: evalStats(e.evals && e.evals[p.id]) })).filter(x => x.st.filled);
  const histHtml = hist.length ? `
    <div class="mb-3">
      <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Evolución</div>
      <table class="w-full text-xs"><thead><tr class="text-[10px] text-gray-400 text-left"><th>Período</th>${state.criteria.blocks.map(b => `<th class="text-center">${esc(b.name.split(/[\s-]+/)[0].slice(0, 5))}</th>`).join('')}<th class="text-center">Prom.</th><th class="text-center">Var.</th></tr></thead><tbody>
      ${hist.map((x, k) => { const d = k > 0 && hist[k - 1].st.general != null ? x.st.general - hist[k - 1].st.general : null; return `<tr class="border-t border-purple-950/60"><td class="py-1 text-gray-200">${esc(x.p.label)}</td>${x.st.blocks.map(b => `<td class="text-center text-gray-300">${evalFmt1(b.avg)}</td>`).join('')}<td class="text-center font-black ${evalTone(x.st.general).text}">${evalFmt(x.st.general)}</td><td class="text-center font-bold ${d == null ? 'text-gray-600' : (d >= 0 ? 'text-emerald-400' : 'text-rose-400')}">${d == null ? '–' : (d >= 0 ? '+' : '') + d.toFixed(2)}</td></tr>`; }).join('')}
      </tbody></table>
    </div>` : '';

  const sugCount = Object.keys(sug).length;
  document.getElementById('evalEditBody').innerHTML = `
    <div class="flex items-start justify-between gap-3 border-b border-purple-900 pb-3">
      <div class="min-w-0">
        <h3 class="text-base font-bold text-white tracking-wide">${esc(e.apellido)}, ${esc(e.nombre)}</h3>
        <div class="text-[11px] text-gray-400 mt-0.5">${esc(e.cat || 'Sin categoría')} · <span class="text-emerald-400 font-semibold">${esc(state.evalPeriods[evalPeriodIdx(cur)].label)}</span></div>
        <div class="text-[10px] mt-0.5 ${link ? 'text-emerald-400' : 'text-gray-500'}">${link ? 'Estadísticas: ' + link.stats.PJ + ' partidos, ' + (link.stats.PTS || 0).toFixed(1) + ' pts y ' + (link.stats.MIN || 0).toFixed(0) + " min por partido" : 'No aparece en las planillas de partido cargadas: no hay sugerencias.'}</div>
      </div>
      <button onclick="closeEvalEditor()" class="text-gray-400 hover:text-white text-xl flex-shrink-0">✕</button>
    </div>
    <div id="evalEditSummary"></div>
    ${sugCount ? `<div class="flex flex-wrap items-center justify-between gap-2 bg-blue-950/30 border border-blue-900/60 rounded-xl p-2.5">
      <span class="text-[11px] text-blue-200">Hay ${sugCount} sugerencia${sugCount > 1 ? 's' : ''} según sus estadísticas, comparada con las demás jugadoras del torneo. Vos decidís la nota.</span>
      <button onclick="applyAllEvalSuggestions()" class="px-3 py-1.5 rounded-lg bg-blue-900/70 hover:bg-blue-800 border border-blue-700 text-[11px] font-bold text-blue-100">Usar en los criterios vacíos</button>
    </div>` : ''}
    ${histHtml}
    ${body}
    <div>
      <label for="evNote" class="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Comentario del entrenador</label>
      <textarea id="evNote" rows="3" onchange="setEvalNote(this.value)" class="w-full bg-[#110620] border border-purple-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400" placeholder="Qué trabajar hasta la próxima evaluación...">${esc((e.notes || {})[cur] || '')}</textarea>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-900/60">
      <div class="flex gap-3 text-[11px]">
        <button onclick="clearEvalPeriod()" class="text-amber-300 hover:text-amber-200 font-semibold">Borrar notas de este período</button>
        <button onclick="deleteEvalEntry()" class="text-red-300 hover:text-red-200 font-semibold">Quitar del plantel</button>
      </div>
      <button onclick="closeEvalEditor()" class="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">Listo</button>
    </div>`;
  renderEvalEditorSummary();
}

function renderEvalEditorSummary() {
  const e = evalFindEntry(evalEditId);
  const el = document.getElementById('evalEditSummary');
  if (!e || !el) return;
  const st = evalStats(e.evals && e.evals[state.evalCurrent]);
  const tone = evalTone(st.general);
  el.innerHTML = `
    <div class="flex items-stretch gap-2">
      <div class="px-3 py-2 rounded-xl border ${tone.bg} text-center flex-shrink-0">
        <div class="text-[10px] text-gray-300 font-semibold uppercase">Promedio</div>
        <div class="text-xl font-black ${tone.text}">${evalFmt(st.general)}</div>
        <div class="text-[9px] text-gray-400">${st.filled}/${st.total} criterios</div>
      </div>
      <div class="flex-1 min-w-0 space-y-1.5 flex flex-col justify-center">
        ${st.blocks.map((b, bi) => `<div><div class="flex justify-between text-[10px] text-gray-300"><span class="truncate">${esc(b.name)}</span><b class="text-white">${evalFmt(b.avg)}</b></div>
          <div class="h-1.5 rounded bg-[#110620] overflow-hidden"><div class="h-full rounded" style="width:${b.avg == null ? 0 : b.avg * 10}%;background:${EVAL_COLORS[bi % EVAL_COLORS.length]}"></div></div></div>`).join('')}
      </div>
    </div>`;
}

function evalSetValue(e, i, v) {
  if (!e.evals) e.evals = {};
  const arr = evalPad(e.evals[state.evalCurrent]);
  arr[i] = v;
  e.evals[state.evalCurrent] = arr;
}

function setEvalValue(i, raw) {
  const e = evalFindEntry(evalEditId);
  if (!e) return;
  const t = String(raw).trim().replace(',', '.');
  let v = t === '' ? null : parseFloat(t);
  if (v != null && !isFinite(v)) v = null;
  if (v != null) v = Math.min(10, Math.max(1, Math.round(v * 10) / 10));
  evalSetValue(e, i, v);
  const input = document.getElementById('ev_' + i);
  if (input) input.value = v == null ? '' : v;
  evalSave();
  renderEvalEditorSummary();
}

function applyEvalSuggestion(i) {
  const e = evalFindEntry(evalEditId);
  const link = e && evalLinkedPlayer(e);
  if (!link) return;
  const s = evalSuggestions(link.stats)[i];
  if (s) setEvalValue(i, s.value);
}
function applyAllEvalSuggestions() {
  const e = evalFindEntry(evalEditId);
  const link = e && evalLinkedPlayer(e);
  if (!link) return;
  const sug = evalSuggestions(link.stats);
  const vals = evalCurrentVals(e);
  Object.keys(sug).forEach(k => { if (vals[k] == null) evalSetValue(e, +k, sug[k].value); });
  evalSave();
  renderEvalEditor();
}

function setEvalNote(txt) {
  const e = evalFindEntry(evalEditId);
  if (!e) return;
  if (!e.notes) e.notes = {};
  e.notes[state.evalCurrent] = txt.trim();
  evalSave();
}

function clearEvalPeriod() {
  const e = evalFindEntry(evalEditId);
  if (!e || !confirm('¿Borrar las notas de ' + e.apellido + ' en este período?')) return;
  if (e.evals) delete e.evals[state.evalCurrent];
  if (e.notes) delete e.notes[state.evalCurrent];
  evalSave();
  renderEvalEditor();
}

function deleteEvalEntry() {
  const e = evalFindEntry(evalEditId);
  if (!e || !confirm('¿Quitar a ' + e.apellido + ', ' + e.nombre + ' del plantel de evaluación? Se pierden todas sus evaluaciones.')) return;
  state.squad = state.squad.filter(x => x.id !== e.id);
  evalSave();
  closeEvalEditor();
}

// ---------- agregar jugadora ----------
function openEvalPlayer() {
  ['epApe', 'epNom', 'epCat'].forEach(id => { document.getElementById(id).value = ''; });
  const cats = Array.from(new Set(state.squad.map(e => e.cat).filter(Boolean)));
  document.getElementById('epCats').innerHTML = cats.map(c => `<option value="${esc(c)}">`).join('');
  document.getElementById('evalPlayerModal').classList.remove('hidden');
}
function closeEvalPlayer() { document.getElementById('evalPlayerModal').classList.add('hidden'); }
function saveEvalPlayer() {
  const ap = CABB.collapse(document.getElementById('epApe').value);
  const nm = CABB.collapse(document.getElementById('epNom').value);
  if (!ap || !nm) { alert('Poné apellido y nombre.'); return; }
  if (state.squad.some(e => CABB.normName(e.apellido) === CABB.normName(ap) && CABB.normName(e.nombre) === CABB.normName(nm))) { alert('Esa jugadora ya está en el plantel.'); return; }
  state.squad.push({ id: evalNewEntryId(), apellido: ap.toUpperCase(), nombre: nm, cat: CABB.collapse(document.getElementById('epCat').value), evals: {}, notes: {} });
  evalSave();
  closeEvalPlayer();
  renderEvalPanel();
}

// ---------- períodos ----------
let evalPeriodMode = 'new';
function openEvalPeriod(mode) {
  evalEnsurePeriod();
  evalPeriodMode = mode;
  const cur = state.evalPeriods[evalPeriodIdx(state.evalCurrent)];
  document.getElementById('epTitle').innerText = mode === 'new' ? 'Nueva evaluación' : 'Editar período';
  document.getElementById('epLabel').value = mode === 'new' ? evalPeriodLabel() : cur.label;
  document.getElementById('epCopyBox').classList.toggle('hidden', mode !== 'new');
  document.getElementById('epCopy').checked = false;
  document.getElementById('epDelete').classList.toggle('hidden', mode === 'new' || state.evalPeriods.length < 2);
  document.getElementById('evalPeriodModal').classList.remove('hidden');
}
function closeEvalPeriod() { document.getElementById('evalPeriodModal').classList.add('hidden'); }
function saveEvalPeriod() {
  const label = CABB.collapse(document.getElementById('epLabel').value);
  if (!label) { alert('Poné un nombre para la evaluación.'); return; }
  if (evalPeriodMode === 'new') {
    const prevId = state.evalCurrent;
    const id = 'ev' + Date.now().toString(36);
    state.evalPeriods.push({ id: id, label: label, created: Date.now() });
    if (document.getElementById('epCopy').checked) {
      state.squad.forEach(e => { const a = e.evals && e.evals[prevId]; if (a) { e.evals[id] = a.slice(); } });
    }
    state.evalCurrent = id;
  } else {
    state.evalPeriods[evalPeriodIdx(state.evalCurrent)].label = label;
  }
  evalSave();
  closeEvalPeriod();
  renderEvalPanel();
}
function deleteEvalPeriod() {
  const cur = state.evalCurrent;
  const p = state.evalPeriods[evalPeriodIdx(cur)];
  if (state.evalPeriods.length < 2 || !confirm('¿Borrar "' + p.label + '" con todas sus notas?')) return;
  state.squad.forEach(e => { if (e.evals) delete e.evals[cur]; if (e.notes) delete e.notes[cur]; });
  state.evalPeriods = state.evalPeriods.filter(x => x.id !== cur);
  state.evalCurrent = state.evalPeriods[state.evalPeriods.length - 1].id;
  evalSave();
  closeEvalPeriod();
  renderEvalPanel();
}

// ---------- ficha de la jugadora de las planillas (resumen de solo lectura) ----------
function renderModalEval(p) {
  const box = document.getElementById('modalEvalBox');
  if (!box) return;
  const e = evalEntryForPlayer(p);
  const head = '<h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2"><i class="fa-solid fa-clipboard-check mr-1"></i> Evaluación de criterios</h4>';
  if (!e) { box.innerHTML = head + '<div class="text-[11px] text-gray-500 border border-dashed border-purple-900/60 rounded-xl p-3 text-center">No está en el plantel de evaluación. Se agrega desde "Planilla & Pizarra" → Evaluaciones.</div>'; return; }
  evalEnsurePeriod();
  const cur = state.evalCurrent;
  const st = evalStats(e.evals && e.evals[cur]);
  const prev = evalPrevPeriodId(cur);
  const ps = prev ? evalStats(e.evals && e.evals[prev]) : null;
  const delta = (st.general != null && ps && ps.general != null) ? st.general - ps.general : null;
  const tone = evalTone(st.general);
  const hist = state.evalPeriods.map(x => evalStats(e.evals && e.evals[x.id]).general).filter(v => v != null);
  box.innerHTML = head + (st.filled ? `
    <div class="flex items-stretch gap-2">
      <div class="px-3 py-2 rounded-xl border ${tone.bg} text-center flex-shrink-0">
        <div class="text-[10px] text-gray-300 font-semibold uppercase">Promedio</div>
        <div class="text-xl font-black ${tone.text}">${evalFmt(st.general)}</div>
        ${delta == null ? '' : `<div class="text-[10px] font-bold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${delta >= 0 ? '▲ +' : '▼ '}${delta.toFixed(2)}</div>`}
      </div>
      <div class="flex-1 min-w-0 space-y-1.5 flex flex-col justify-center">
        ${st.blocks.map((b, bi) => `<div><div class="flex justify-between text-[10px] text-gray-300"><span class="truncate">${esc(b.name)}</span><b class="text-white">${evalFmt(b.avg)}</b></div>
          <div class="h-1.5 rounded bg-[#110620] overflow-hidden"><div class="h-full rounded" style="width:${b.avg == null ? 0 : b.avg * 10}%;background:${EVAL_COLORS[bi % EVAL_COLORS.length]}"></div></div></div>`).join('')}
      </div>
      <div class="flex-shrink-0 self-center">${sparkline(hist)}</div>
    </div>
    <div class="text-[10px] text-gray-500 mt-1">${esc(state.evalPeriods[evalPeriodIdx(cur)].label)} · ${st.filled}/${st.total} criterios</div>` :
    '<div class="text-[11px] text-gray-500 border border-dashed border-purple-900/60 rounded-xl p-3 text-center">Sin evaluar en este período.</div>') + `
    <button onclick="closePlayerModal();setTacticaView('eval');openEvalEditor('${e.id}')" class="mt-2 w-full px-3 py-2 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-bold"><i class="fa-solid fa-pen mr-1"></i> Abrir evaluación</button>`;
}

// Chip con el promedio actual, para la lista del plantel
function evalBadgeHtml(p) {
  if (!state.squad.length) return '';
  const e = evalEntryForPlayer(p);
  if (!e) return '';
  evalEnsurePeriod();
  const g = evalStats(e.evals && e.evals[state.evalCurrent]).general;
  if (g == null) return '';
  const tone = evalTone(g);
  return `<span title="Promedio de criterios" class="px-1.5 py-0.5 rounded border ${tone.bg} ${tone.text} text-[9px] font-black flex-shrink-0">${g.toFixed(1)}</span>`;
}

// ---------- lectura de la hoja "Criterios" ----------
const EVAL_TYPOS = [[/antrometric/i, 'antropométric'], [/esplisiv/i, 'Explosiv'], [/agilida\b/i, 'Agilidad'], [/oculo/i, 'óculo']];
function evalCleanName(s) {
  let t = CABB.collapse(s);
  EVAL_TYPOS.forEach(([re, to]) => { t = t.replace(re, to); });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// rows: matriz de la hoja. Devuelve { criteria, rows:[{apellido, nombre, cat, vals[]}], cats[] } o lanza Error.
function parseCriteriaRows(rows) {
  const norm = v => CABB.normName(v);
  const cell = (r, c) => (rows[r] && rows[r][c] != null) ? rows[r][c] : '';
  let hr = -1, apC = -1, nmC = -1, catC = -1;
  for (let r = 0; r < Math.min(rows.length, 40) && hr < 0; r++) {
    const row = rows[r] || [];
    const a = row.findIndex(v => norm(v) === 'APELLIDO');
    const n = row.findIndex(v => norm(v) === 'NOMBRE');
    if (a >= 0 && n >= 0) { hr = r; apC = a; nmC = n; catC = row.findIndex(v => /^CATEGORIA$/.test(norm(v))); }
  }
  if (hr < 0) throw new Error('No encontré las columnas "Apellido" y "Nombre" en la hoja.');
  const first = Math.max(apC, nmC) + 1;
  const countText = r => (rows[r] || []).filter((v, c) => c >= first && String(v).trim() !== '' && isNaN(parseFloat(v))).length;
  let nr = -1;
  for (let r = hr - 1; r >= 0; r--) { if (countText(r) >= 5) { nr = r; break; } }
  if (nr < 0) throw new Error('No encontré los nombres de los criterios encima de la lista de jugadoras.');
  let br = -1;
  for (let r = nr - 1; r >= 0; r--) { const k = countText(r); if (k >= 1 && k <= 8) { br = r; break; } }

  const cols = [];
  (rows[nr] || []).forEach((v, c) => {
    const t = CABB.collapse(v);
    if (c >= first && t && !/^promedio/i.test(t)) cols.push({ c: c, name: evalCleanName(t) });
  });
  if (!cols.length) throw new Error('No encontré criterios en la hoja.');
  const starts = [];
  if (br >= 0) (rows[br] || []).forEach((v, c) => { const t = CABB.collapse(v); if (c >= first && t) starts.push({ c: c, name: t.toUpperCase() }); });
  const blocks = [];
  cols.forEach(col => {
    let bn = 'CRITERIOS';
    starts.forEach(s => { if (s.c <= col.c) bn = s.name; });
    let b = blocks.find(x => x.name === bn);
    if (!b) { b = { name: bn, items: [], cols: [] }; blocks.push(b); }
    b.items.push(col.name);
    b.cols.push(col.c);
  });
  const order = [];
  blocks.forEach(b => b.cols.forEach(c => order.push(c)));

  const out = [];
  const cats = [];
  let cat = '';
  for (let r = hr + 1; r < rows.length; r++) {
    const ap = CABB.collapse(cell(r, apC));
    const nm = CABB.collapse(cell(r, nmC));
    if (catC >= 0) { const ct = CABB.collapse(cell(r, catC)); if (ct) cat = ct; }
    if (!ap || !nm) continue;
    const vals = order.map(c => {
      const t = String(cell(r, c)).trim().replace(',', '.');
      const v = t === '' ? NaN : parseFloat(t);
      return (isFinite(v) && v >= 1 && v <= 10) ? v : null;
    });
    if (cat && cats.indexOf(cat) < 0) cats.push(cat);
    out.push({ apellido: ap, nombre: nm, cat: cat || '', vals: vals });
  }
  if (!out.length) throw new Error('La hoja no tiene jugadoras debajo de los criterios.');
  return { criteria: { blocks: blocks.map(b => ({ name: b.name, items: b.items })) }, rows: out, cats: cats };
}

// ---------- importar el Excel al plantel de evaluación ----------
let evalImport = null; // { parsed, sheetName }

function openEvalImport() {
  if (!state.wsId) return;
  evalImport = null;
  document.getElementById('eiFile').value = '';
  document.getElementById('eiStatus').innerText = '';
  document.getElementById('eiStep2').classList.add('hidden');
  document.getElementById('evalImportModal').classList.remove('hidden');
}
function closeEvalImport() { document.getElementById('evalImportModal').classList.add('hidden'); evalImport = null; }

async function handleEvalFile(e) {
  const input = e.target;
  const f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  const status = document.getElementById('eiStatus');
  status.innerText = 'Leyendo ' + f.name + '...';
  try {
    const wb = XLSX.read(new Uint8Array(await readBuf(f)), { type: 'array' });
    const names = wb.SheetNames.slice().sort((a, b) => (/criterio/i.test(b) ? 1 : 0) - (/criterio/i.test(a) ? 1 : 0));
    let parsed = null, used = '', lastErr = null;
    for (const n of names) {
      try { parsed = parseCriteriaRows(XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' })); used = n; break; } catch (err) { lastErr = err; }
    }
    if (!parsed) throw lastErr || new Error('No encontré una hoja de criterios.');
    // por defecto: las categorías que ya están en el plantel de este equipo; si no hay plantel, ninguna
    parsed.sel = {};
    const known = new Set(state.squad.map(x => x.cat));
    parsed.cats.forEach(c => { parsed.sel[c] = known.has(c); });
    if (!parsed.cats.length) { parsed.cats = ['']; parsed.sel[''] = true; }
    evalImport = { parsed: parsed, sheetName: used };
    status.innerText = `Hoja "${used}": ${parsed.rows.length} jugadoras y ${parsed.criteria.blocks.reduce((a, b) => a + b.items.length, 0)} criterios.`;
    renderEvalImport();
  } catch (err) {
    status.innerText = 'No pude leer el archivo: ' + err.message;
  }
}

function evalExistingEntry(r) {
  return state.squad.find(e => CABB.normName(e.apellido) === CABB.normName(r.apellido) && CABB.normName(e.nombre) === CABB.normName(r.nombre));
}

function renderEvalImport() {
  const par = evalImport.parsed;
  evalEnsurePeriod();
  const sameCrit = JSON.stringify(par.criteria) === JSON.stringify(state.criteria);
  document.getElementById('eiCats').innerHTML = par.cats.map((c, i) => `
    <label class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#110620] border border-purple-900/60 text-xs cursor-pointer">
      <input type="checkbox" ${par.sel[c] ? 'checked' : ''} onchange="evalToggleCat(${i}, this.checked)" class="accent-emerald-500">
      <b class="text-white">${esc(c || 'Todas')}</b> <span class="text-gray-400">${par.rows.filter(r => r.cat === c).length}</span>
    </label>`).join('');
  const sel = par.rows.filter(r => par.sel[r.cat]);
  document.getElementById('eiRows').innerHTML = sel.map(r => {
    const n = r.vals.filter(v => v != null).length;
    const ex = evalExistingEntry(r);
    return `<tr class="border-b border-purple-950/60">
      <td class="py-1 pr-2 text-xs text-white">${esc(r.apellido)}, ${esc(r.nombre)}</td>
      <td class="py-1 pr-2 text-[11px] text-gray-400">${esc(r.cat)}</td>
      <td class="py-1 pr-2 text-[11px] ${n ? 'text-emerald-300' : 'text-gray-500'}">${n ? n + ' notas' : 'sin notas'}</td>
      <td class="py-1 text-[11px] ${ex ? 'text-amber-300' : 'text-blue-300'}">${ex ? 'Ya está (se actualiza)' : 'Nueva'}</td></tr>`;
  }).join('') || '<tr><td class="py-3 text-center text-xs text-gray-500">Tildá la categoría que corresponde a este plantel.</td></tr>';
  document.getElementById('eiCount').innerText = sel.length;
  document.getElementById('eiPeriod').innerText = state.evalPeriods[evalPeriodIdx(state.evalCurrent)].label;
  document.getElementById('eiUseCrit').checked = !sameCrit;
  document.getElementById('eiCritBox').classList.toggle('hidden', sameCrit);
  document.getElementById('eiCritInfo').innerText = par.criteria.blocks.map(b => `${b.name} (${b.items.length})`).join(' · ');
  document.getElementById('eiStep2').classList.remove('hidden');
}

function evalToggleCat(i, on) {
  const par = evalImport.parsed;
  par.sel[par.cats[i]] = on;
  renderEvalImport();
}

function doEvalImport() {
  if (!evalImport) return;
  const par = evalImport.parsed;
  const chosen = par.rows.filter(r => par.sel[r.cat]);
  if (!chosen.length) { alert('Tildá al menos una categoría.'); return; }
  evalEnsurePeriod();
  if (document.getElementById('eiUseCrit').checked) evalSetCriteria(par.criteria);
  const xl = [];
  par.criteria.blocks.forEach(b => b.items.forEach(n => xl.push(CABB.normName(n))));
  const mine = evalFlat().map(c => CABB.normName(c.name));
  let created = 0, updated = 0;
  chosen.forEach(r => {
    let e = evalExistingEntry(r);
    if (!e) {
      e = { id: evalNewEntryId(), apellido: r.apellido.toUpperCase(), nombre: r.nombre, cat: r.cat, evals: {}, notes: {} };
      state.squad.push(e);
      created++;
    } else { if (r.cat) e.cat = r.cat; updated++; }
    if (r.vals.some(v => v != null)) {
      const arr = evalPad((e.evals || (e.evals = {}))[state.evalCurrent]);
      xl.forEach((k, j) => { const i = mine.indexOf(k); if (i >= 0 && r.vals[j] != null) arr[i] = r.vals[j]; });
      e.evals[state.evalCurrent] = arr;
    }
  });
  evalSave();
  closeEvalImport();
  renderEvalPanel();
  if (typeof renderRosterTable === 'function') renderRosterTable();
  toast(`Plantel de evaluación: ${created} jugadoras nuevas, ${updated} actualizadas.`, 8000);
}
