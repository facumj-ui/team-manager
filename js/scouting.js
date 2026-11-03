const ALL_AVAILABLE_COLS = [
  { id: 'EQUIPO', label: 'Equipo' },
  { id: 'Nombre', label: 'Nombre' },
  { id: 'PJ', label: 'PJ' },
  { id: 'MIN', label: 'MIN' },
  { id: 'PTS', label: 'PTS' },
  { id: 'T2%', label: 'T2%' },
  { id: 'T3%', label: 'T3%' },
  { id: 'T1%', label: 'T1%' },
  { id: 'TC%', label: 'TC%' },
  { id: 'PLAYS', label: 'PLAYS' },
  { id: 'PPP', label: 'PPP' },
  { id: 'TO%', label: 'TO%' },
  { id: 'RT', label: 'RT' },
  { id: 'AST', label: 'AST' },
  { id: 'VAL', label: 'VAL' }
];

function renderColumnTags() {
  const container = document.getElementById('columnTagsContainer');
  if (!container) return;
  container.innerHTML = '';

  ALL_AVAILABLE_COLS.forEach(col => {
    const isSel = state.selectedColumns.includes(col.id);
    const tag = document.createElement('button');
    tag.className = `px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${isSel ? 'tag-active' : 'tag-inactive'}`;
    tag.innerHTML = `<span>${col.label}</span> <i class="fa-solid ${isSel ? 'fa-xmark text-[10px]' : 'fa-plus text-[10px]'}"></i>`;
    tag.onclick = () => toggleColumn(col.id);
    container.appendChild(tag);
  });

  const resetBtn = document.createElement('button');
  resetBtn.className = "px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-400 hover:text-white ml-auto";
  resetBtn.innerHTML = `<i class="fa-solid fa-rotate-left mr-1"></i> Restablecer`;
  resetBtn.onclick = () => {
    state.selectedColumns = ['EQUIPO', 'Nombre', 'PJ', 'MIN', 'PTS', 'T2%', 'T3%', 'T1%', 'TC%', 'PLAYS', 'PPP', 'TO%', 'RT', 'AST', 'VAL'];
    renderColumnTags();
    renderScoutingTable();
  };
  container.appendChild(resetBtn);
}

function toggleColumn(colId) {
  if (state.selectedColumns.includes(colId)) {
    if (state.selectedColumns.length <= 2) {
      alert("Debe haber al menos 2 columnas seleccionadas.");
      return;
    }
    state.selectedColumns = state.selectedColumns.filter(c => c !== colId);
  } else {
    state.selectedColumns.push(colId);
  }
  renderColumnTags();
  renderScoutingTable();
}

function setScoutSort(colId) {
  if (state.sortCol === colId) {
    state.sortAsc = !state.sortAsc;
  } else {
    state.sortCol = colId;
    state.sortAsc = false;
  }
  renderScoutingTable();
}

function renderScoutingTable() {
  const teamFilterEl = document.getElementById('scoutTeamFilter');
  const searchEl = document.getElementById('scoutSearch');
  const selectedTeam = teamFilterEl ? teamFilterEl.value : 'ALL';
  const search = searchEl ? (searchEl.value || '').toLowerCase().trim() : '';

  let filtered = state.scoutingData.filter(p => {
    const matchTeam = selectedTeam === 'ALL' || (p.EQUIPO || '').toString() === selectedTeam;
    const matchSearch = !search || (p.Nombre || '').toLowerCase().includes(search) || (p.EQUIPO || '').toLowerCase().includes(search);
    return matchTeam && matchSearch;
  });

  filtered.sort((a, b) => {
    let vA = a[state.sortCol] ?? '';
    let vB = b[state.sortCol] ?? '';
    if (typeof vA === 'string') {
      return state.sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return state.sortAsc ? (vA - vB) : (vB - vA);
  });

  const recCountEl = document.getElementById('scoutingRecordCount');
  if (recCountEl) recCountEl.innerText = filtered.length;
  const colCountEl = document.getElementById('scoutingColCount');
  if (colCountEl) colCountEl.innerText = state.selectedColumns.length;

  const thead = document.getElementById('scoutingThead');
  if (thead) {
    let thHtml = `<tr class="border-b border-purple-900 bg-[#160a29]">`;
    thHtml += `<th class="py-3 px-3 text-center text-gray-500 font-semibold w-12">#</th>`;
    state.selectedColumns.forEach(c => {
      const isSort = state.sortCol === c;
      const sortIcon = isSort ? (state.sortAsc ? '▲' : '▼') : '';
      thHtml += `
        <th class="py-3 px-3 cursor-pointer select-none hover:text-white transition ${c === 'Nombre' || c === 'EQUIPO' ? 'text-left' : 'text-center'}" onclick="setScoutSort('${c}')">
          <span class="${isSort ? 'text-blue-400 font-bold' : ''}">${c} ${sortIcon}</span>
        </th>
      `;
    });
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;
  }

  const tbody = document.getElementById('scoutingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.selectedColumns.length + 1}" class="py-8 text-center text-gray-400">No se encontraron jugadoras.</td></tr>`;
    return;
  }

  filtered.forEach((p, idx) => {
    const isRec = isMine(p.EQUIPO);
    const tr = document.createElement('tr');
    tr.className = `hover:bg-purple-900/30 transition text-xs ${isRec ? 'bg-emerald-950/20' : ''}`;

    let rowHtml = `<td class="py-2.5 px-3 text-center text-gray-500 font-bold">${idx + 1}</td>`;

    state.selectedColumns.forEach(c => {
      let val = p[c] ?? '-';
      if (c === 'EQUIPO') {
        rowHtml += `<td class="py-2.5 px-3 font-semibold text-gray-300 truncate max-w-[140px]">${esc(val || '')}</td>`;
      } else if (c === 'Nombre') {
        rowHtml += `<td class="py-2.5 px-3 font-bold ${isRec ? 'text-emerald-400' : 'text-white'} truncate max-w-[160px]">${esc(val)}</td>`;
      } else if (c.includes('%')) {
        const pct = (typeof val === 'number') ? (val * 100).toFixed(0) + '%' : val;
        rowHtml += `<td class="py-2.5 px-3 text-center text-gray-300">${pct}</td>`;
      } else if (['MIN', 'PTS', 'PLAYS', 'PPP', 'RT', 'AST', 'VAL', 'T2C', 'T2I', 'T3C', 'T3I'].includes(c)) {
        const num = (typeof val === 'number') ? val.toFixed(c === 'PPP' ? 2 : 1) : val;
        let colClass = "text-gray-300";
        if (c === 'PTS') colClass = "text-emerald-400 font-bold";
        if (c === 'VAL') colClass = "text-purple-300 font-bold";
        if (c === 'PLAYS') colClass = "text-blue-300";
        rowHtml += `<td class="py-2.5 px-3 text-center ${colClass}">${num}</td>`;
      } else {
        rowHtml += `<td class="py-2.5 px-3 text-center text-gray-400">${val}</td>`;
      }
    });

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });
}

// 1. MOTOR DE REGLAS DEFENSIVAS BASADO EN PLAYS (DECISIONES POR POSESIÓN)
function getDefensiveMatchupAdvice(p) {
  const plays = p.PLAYS || 0;
  const ppp = p.PPP || 0;
  const toPct = p['TO%'] || 0;
  const t3Pct = p['T3%'] || 0;
  const min = p.MIN || 0;

  // Jugadora de rotación marginal
  if (min < 7 && plays < 3.5) {
    return {
      badge: "ROTACIÓN (BAJO USO)",
      badgeColor: "bg-gray-800 text-gray-400 border-gray-700",
      rule: "Muy pocas decisiones por posesión. Mantener emparejamiento 1v1 sin comprometer ayudas."
    };
  }

  // GENERADORA PRIMARIA / MONOPOLIZADORA DEL BALÓN (Alto PLAYS)
  if (plays >= 14.0) {
    if (toPct >= 0.25) {
      return {
        badge: "★ GENERADORA PRINCIPAL (ALTO ERROR)",
        badgeColor: "bg-rose-950 text-rose-300 border-rose-800",
        rule: `Centraliza el juego rival (${plays.toFixed(1)} posesiones/p) pero pierde mucho (${(toPct*100).toFixed(0)}% TO). Presión en todo el campo, atrapar en Pick & Roll (Trap/Blitz) para forzar pase impreciso.`
      };
    } else if (ppp >= 0.70) {
      return {
        badge: "★ GENERADORA ELITE (ALTA EFICIENCIA)",
        badgeColor: "bg-amber-950 text-amber-300 border-amber-800",
        rule: `Principal foco de peligro (${plays.toFixed(1)} posesiones/p, ${ppp.toFixed(2)} PPP). Negar recepción (Deny), fintas de ayuda agresivas en su penetración y obligarla a soltar la pelota a jugadoras de rol.`
      };
    } else {
      return {
        badge: "★ DECISORA PRIMARIA (VOLUMEN)",
        badgeColor: "bg-purple-950 text-purple-300 border-purple-800",
        rule: `Máxima tomadora de decisiones del rival (${plays.toFixed(1)} PLAYS/p). Desafiar sus tiros con mano arriba y contestar tiros sin cometer faltas.`
      };
    }
  }

  // SEGUNDA OPCIÓN / GENERACIÓN MEDIA (PLAYS 9.5 a 13.9)
  if (plays >= 9.5) {
    if (t3Pct >= 0.22) {
      return {
        badge: "SEGUNDA OPCIÓN / TIRADORA",
        badgeColor: "bg-red-950 text-red-300 border-red-800",
        rule: `Toma muchas decisiones desde el triple (${(t3Pct*100).toFixed(0)}% T3). Pasar bloqueos por ARRIBA (Over), puntear tiro a pie firme (Closeout rápido).`
      };
    } else {
      return {
        badge: "SEGUNDA OPCIÓN / PENETRADORA",
        badgeColor: "bg-blue-950 text-blue-300 border-blue-800",
        rule: `Foco secundario (${plays.toFixed(1)} PLAYS/p). Pasar bloqueos por DETRÁS (Under), cerrar línea de fondo y obligarla a lanzar de media distancia.`
      };
    }
  }

  // EJECUTORA / RECEPTORA DE DESCARGAS (Bajo PLAYS, define puntual)
  if (p.RT >= 5.0) {
    return {
      badge: "FINALIZADORA / REBOTEADORA",
      badgeColor: "bg-amber-950 text-amber-200 border-amber-800",
      rule: "No crea con balón, pero castiga en el tablero. Bloqueo de rebote (Box out) estricto y evitar segundas oportunidades."
    };
  }

  return {
    badge: "ROL SECUNDARIO (DESCARGA)",
    badgeColor: "bg-emerald-950 text-emerald-300 border-emerald-800",
    rule: "Uso ofensivo bajo. Ayudar sobre las generadoras primarias recuperando si el balón viaja hacia ella."
  };
}

// 2. RENDERIZADO DEL INFORME (ORDENADO POR PLAYS + FICHA ESTADÍSTICA COMPLETA)
function renderOpponentScouting(selectedTeam) {
  if (selectedTeam && state.nextOpponent !== selectedTeam) { state.nextOpponent = selectedTeam; if (typeof saveWorkspace === 'function') saveWorkspace(); }
  const container = document.getElementById('opponentScoutingReportContainer');
  if (!container) return;

  const rival = selectedTeam || (document.getElementById('scoutNextOpponentSelect') ? document.getElementById('scoutNextOpponentSelect').value : "");

  // Ordenamos por PLAYS (volumen de decisiones) para poner arriba a las que más influyen
  const oppPlayers = state.scoutingData
    .filter(p => p.EQUIPO === rival)
    .sort((a, b) => (b.PLAYS || 0) - (a.PLAYS || 0));

  if (oppPlayers.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-gray-500 text-xs">${rival ? 'No hay datos registrados aún para ' + esc(rival) + '.' : 'Cargá planillas para ver el informe de un rival.'}</div>`;
    return;
  }

  const primaryDecisionMaker = oppPlayers[0];
  const teamTotalPlays = oppPlayers.reduce((acc, p) => acc + (p.PLAYS || 0), 0).toFixed(1);
  const teamAvgPPP = (oppPlayers.reduce((acc, p) => acc + (p.PPP || 0), 0) / oppPlayers.length).toFixed(2);
  const teamAvgTO = ((oppPlayers.reduce((acc, p) => acc + (p['TO%'] || 0), 0) / oppPlayers.length) * 100).toFixed(0);

  let html = `
    <!-- RESUMEN GENERAL DEL RIVAL -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#110620] p-3 rounded-xl border border-purple-900/60 text-xs">
      <div class="space-y-1">
        <span class="text-amber-400 font-bold uppercase text-[10px] tracking-wider">★ Eje Ofensivo (Más Decisiones)</span>
        <div class="text-white font-black text-sm">${esc(primaryDecisionMaker.Nombre.split(',')[0])}</div>
        <div class="text-emerald-400 font-bold">${primaryDecisionMaker.PLAYS.toFixed(1)} PLAYS/p <span class="text-gray-400 text-[11px] font-normal">(${primaryDecisionMaker.PTS.toFixed(1)} pts • ${primaryDecisionMaker.PPP.toFixed(2)} PPP)</span></div>
      </div>
      <div class="space-y-1">
        <span class="text-blue-400 font-bold uppercase text-[10px] tracking-wider">Volumen Ofensivo Colectivo</span>
        <div class="text-white font-black text-sm">~${teamTotalPlays} Posesiones/P terminadas</div>
        <div class="text-gray-300 font-semibold">${teamAvgPPP} Pts por posesión (PPP global)</div>
      </div>
      <div class="space-y-1">
        <span class="text-rose-400 font-bold uppercase text-[10px] tracking-wider">Pérdidas del Rival</span>
        <div class="text-rose-400 font-black text-sm">${teamAvgTO}% Pérdidas (TO% Promedio)</div>
        <div class="text-gray-400 text-[11px]">Subir líneas sobre las jugadoras con alto PLAYS y alto TO%.</div>
      </div>
    </div>

    <!-- LISTADO DE JUGADORAS (FICHA COMPLETA) -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
          <i class="fa-solid fa-brain text-amber-400"></i> Plan Defensivo (Ordenado por PLAYS / Posesiones)
        </h3>
        <span class="text-[10px] text-gray-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
          Prioridad según absorción de balón
        </span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
  `;

  oppPlayers.forEach((p, idx) => {
    const advice = getDefensiveMatchupAdvice(p);
    const playsVal = (p.PLAYS || 0).toFixed(1);
    const pppVal = (p.PPP || 0).toFixed(2);
    const toPctVal = (((p['TO%'] || 0) * 100)).toFixed(0) + '%';
    const t2Val = (p['T2%'] ? (p['T2%'] * 100).toFixed(0) : 0) + '%';
    const t3Val = (p['T3%'] ? (p['T3%'] * 100).toFixed(0) : 0) + '%';
    const isPrimary = (p.PLAYS || 0) >= 14.0;

    html += `
      <div class="bg-[#120722] p-3 rounded-xl border ${isPrimary ? 'border-amber-500/60 ring-1 ring-amber-500/30' : 'border-purple-900/50'} flex flex-col justify-between space-y-2 hover:border-purple-600 transition">
        
        <!-- CABECERA: NOMBRE, MINUTOS Y ROL TÁCTICO -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-md ${isPrimary ? 'bg-amber-500 text-slate-950' : 'bg-purple-950 text-gray-300'} font-mono font-black text-[11px] flex items-center justify-center border border-purple-800 flex-shrink-0">
              #${idx + 1}
            </span>
            <div>
              <span class="font-bold text-white text-xs block truncate max-w-[150px]">${esc(p.Nombre)}</span>
              <span class="text-[10px] text-gray-400 font-semibold">${(p.MIN || 0).toFixed(1)} min/p • ${(p.PJ || 0)} PJ</span>
            </div>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${advice.badgeColor}">
            ${advice.badge}
          </span>
        </div>

        <!-- REGLA DEFENSIVA EXACTA -->
        <div class="text-[11px] text-gray-200 font-medium leading-relaxed bg-[#0b0416] p-2 rounded-lg border border-purple-950">
          <b class="text-emerald-400 mr-1">Regla defensiva:</b>${advice.rule}
        </div>

        <!-- FILA 1: DECISIÓN Y EFICIENCIA (PLAYS, PPP, TO%, PTS) -->
        <div class="grid grid-cols-4 gap-1 text-center bg-[#170a2c] p-1.5 rounded-lg border border-purple-900/40 text-[10px]">
          <div>
            <span class="text-gray-400 block text-[9px]">PLAYS</span>
            <b class="text-amber-400 font-black">${playsVal}</b>
          </div>
          <div>
            <span class="text-gray-400 block text-[9px]">PPP</span>
            <b class="text-emerald-400 font-black">${pppVal}</b>
          </div>
          <div>
            <span class="text-gray-400 block text-[9px]">TO%</span>
            <b class="text-rose-400 font-black">${toPctVal}</b>
          </div>
          <div>
            <span class="text-gray-400 block text-[9px]">PUNTOS</span>
            <b class="text-white font-black">${(p.PTS || 0).toFixed(1)}</b>
          </div>
        </div>

        <!-- FILA 2: PERFIL DE TIRO Y REBOTE (2PT%, 3PT%, REB/P) -->
        <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 pt-0.5">
          <span>Acierto 2PT: <b class="text-gray-200">${t2Val}</b></span>
          <span>Acierto 3PT: <b class="text-gray-200">${t3Val}</b></span>
          <span>Rebotes: <b class="text-amber-300 font-bold">${(p.RT || 0).toFixed(1)} /p</b></span>
        </div>

      </div>
    `;
  });

  html += `</div></div>`;
  container.innerHTML = html;
}

// Inicialización del select de rivales (todos los equipos del torneo menos el propio)
function initOpponentSelect() {
  const oppSelect = document.getElementById('scoutNextOpponentSelect');
  if (!oppSelect) return;
  const prev = oppSelect.value || state.nextOpponent || '';
  oppSelect.innerHTML = '';
  const rivals = (state.teams || []).filter(t => !isMine(t));

  rivals.forEach(rival => {
    const opt = document.createElement('option');
    opt.value = rival;
    opt.innerText = rival;
    oppSelect.appendChild(opt);
  });

  if (rivals.length > 0) {
    oppSelect.value = rivals.indexOf(prev) >= 0 ? prev : rivals[0];
  }
  renderOpponentScouting(oppSelect.value || '');
}
