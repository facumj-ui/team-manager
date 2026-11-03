// MÓDULO DE ESTÍMULOS SEMANALES. Los datos viven en el equipo activo (state.training).

const TRAINING_DAYS = [
  { key: 'LUN', label: 'LUN', full: 'Lunes' },
  { key: 'MAR', label: 'MAR', full: 'Martes' },
  { key: 'MIE', label: 'MIÉ', full: 'Miércoles' },
  { key: 'JUE', label: 'JUE', full: 'Jueves' },
  { key: 'VIE', label: 'VIE', full: 'Viernes' }
];

// filterCat: 'MAIN' (plantel principal, con piso exigible), 'OTHER' (juegan en otra categoría) o 'ALL'
function cfgMin() { return (state.settings && state.settings.minTurns) || 3; }
function cfgMax() { return (state.settings && state.settings.maxTurns) || 6; }
function isMainCat(p) { return (p.cat || 'MAIN') !== 'OTHER'; }

function initTrainingData() {
  if (!state.training) state.training = {};
  if (!state.training.weeks) state.training.weeks = {};
  if (!state.training.currentWeek) state.training.currentWeek = 'Semana 1';
  if (!state.training.filterCat || ['MAIN', 'OTHER', 'ALL'].indexOf(state.training.filterCat) < 0) state.training.filterCat = 'MAIN';
  if (!state.training.weeks[state.training.currentWeek]) state.training.weeks[state.training.currentWeek] = {};
}

function saveTrainingData() {
  if (typeof saveWorkspace === 'function') saveWorkspace();
}

function getPlayerWeekEstimulos(playerId, weekKey) {
  const w = weekKey || state.training.currentWeek;
  const weekData = (state.training && state.training.weeks && state.training.weeks[w]) || {};
  const playerData = weekData[playerId] || {};
  let total = 0;
  TRAINING_DAYS.forEach(d => {
    total += (playerData[d.key] || 0);
  });
  return total;
}

function toggleDayEstimulo(playerId, dayKey) {
  const w = state.training.currentWeek;
  if (!state.training.weeks[w]) state.training.weeks[w] = {};
  if (!state.training.weeks[w][playerId]) state.training.weeks[w][playerId] = {};

  const current = state.training.weeks[w][playerId][dayKey] || 0;
  const next = (current + 1) % 4; // 0 -> 1 -> 2 -> 3 -> 0

  state.training.weeks[w][playerId][dayKey] = next;
  saveTrainingData();

  renderTrainingTable();
  if (typeof renderRosterTable === 'function') renderRosterTable();
}

function getEstimuloStatus(total) {
  if (total > cfgMax()) {
    return {
      text: `EXCESO (+${total})`,
      badge: 'bg-red-950 text-red-400 border-red-500 ring-1 ring-red-500 animate-pulse',
      icon: 'fa-triangle-exclamation text-red-400',
      statusClass: 'text-red-400 font-black'
    };
  } else if (total === cfgMax()) {
    return {
      text: 'MÁXIMO (' + cfgMax() + ')',
      badge: 'bg-purple-900/80 text-purple-200 border-purple-700',
      icon: 'fa-fire text-purple-400',
      statusClass: 'text-purple-400 font-black'
    };
  } else if (total >= cfgMin()) {
    return {
      text: 'CUMPLIDO',
      badge: 'bg-emerald-950 text-emerald-300 border-emerald-700',
      icon: 'fa-circle-check text-emerald-400',
      statusClass: 'text-emerald-400 font-bold'
    };
  } else {
    return {
      text: 'INSUFICIENTE',
      badge: 'bg-red-950/70 text-red-300 border-red-800',
      icon: 'fa-circle-xmark text-red-400',
      statusClass: 'text-red-400 font-bold'
    };
  }
}

// Pastilla en la planilla: Si es menor de formativas, no se le exige piso de 3 en U21
function getEstimulosBadgeHtml(playerId) {
  const p = state.roster.find(x => x.id === playerId);
  if (p && !isMainCat(p)) {
    return `
      <span title="Juega en otra categoría. Su asistencia se computa aparte." 
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-800 bg-blue-950/80 text-blue-300 cursor-pointer flex-shrink-0"
            onclick="event.stopPropagation(); switchTab('entrenamientos');">
        <i class="fa-solid fa-seedling text-[9px]"></i> Otra cat.
      </span>
    `;
  }

  const total = getPlayerWeekEstimulos(playerId);
  const st = getEstimuloStatus(total);
  return `
    <span title="${total} estímulos registrados esta semana (Piso: ${cfgMin()} • Alerta: >${cfgMax()})" 
          class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${st.badge} cursor-pointer hover:scale-105 transition flex-shrink-0" 
          onclick="event.stopPropagation(); switchTab('entrenamientos');">
      <i class="fa-solid ${st.icon} text-[9px]"></i> ${total}/${cfgMin()} est.
    </span>
  `;
}

function handleTrainingCatFilterChange(newFilter) {
  state.training.filterCat = newFilter;
  saveTrainingData();
  renderTrainingTable();
}

function renderTrainingTable() {
  const tbody = document.getElementById('trainingTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const select = document.getElementById('trainingWeekSelect');
  if (select) {
    select.innerHTML = '';
    const weekKeys = Object.keys(state.training.weeks);
    if (weekKeys.length === 0) weekKeys.push('Semana 1');

    weekKeys.forEach(wk => {
      const opt = document.createElement('option');
      opt.value = wk;
      opt.innerText = wk;
      if (wk === state.training.currentWeek) opt.selected = true;
      select.appendChild(opt);
    });
  }

  const filterSelect = document.getElementById('trainingCatFilterSelect');
  if (filterSelect) {
    filterSelect.value = state.training.filterCat || 'MAIN';
  }

  const currentW = state.training.currentWeek;
  const filterCat = state.training.filterCat || 'MAIN';

  // Filtrar jugadoras según la vista seleccionada
  const allPlayers = state.roster || [];
  const players = allPlayers.filter(p => {
    if (filterCat === 'MAIN') return isMainCat(p);
    if (filterCat === 'OTHER') return !isMainCat(p);
    return true; // 'ALL'
  });

  // Métricas colectivas (calculadas sobre las que se están mostrando)
  let cumplieron = 0;
  let totalEstimulosPlantel = 0;

  players.forEach(p => {
    const tot = getPlayerWeekEstimulos(p.id, currentW);
    totalEstimulosPlantel += tot;
    if (tot >= cfgMin()) cumplieron++;
  });

  const avgEst = players.length > 0 ? (totalEstimulosPlantel / players.length).toFixed(1) : 0;
  const pctCumplido = players.length > 0 ? Math.round((cumplieron / players.length) * 100) : 0;

  const statCumplieronEl = document.getElementById('trainingStatsCumplieron');
  if (statCumplieronEl) statCumplieronEl.innerText = `${cumplieron} / ${players.length} (${pctCumplido}%)`;
  
  const statAvgEl = document.getElementById('trainingStatsAvg');
  if (statAvgEl) statAvgEl.innerText = `${avgEst} turnos / jugadora`;

  if (players.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-gray-500 py-6 text-xs">No hay jugadoras en esta categoría seleccionada.</td></tr>`;
    return;
  }

  players.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-purple-900/20 transition border-b border-purple-950/60";

    const tot = getPlayerWeekEstimulos(p.id, currentW);
    const st = getEstimuloStatus(tot);
    const pData = (state.training.weeks[currentW] && state.training.weeks[currentW][p.id]) || {};
    const main = isMainCat(p);

    let daysHtml = '';
    TRAINING_DAYS.forEach(d => {
      const val = pData[d.key] || 0;
      let btnStyle = "bg-purple-950/40 text-gray-500 border border-purple-900/60 hover:border-purple-600";
      let btnText = "·";

      if (val === 1) {
        btnStyle = "bg-emerald-500 text-slate-950 font-black shadow-lg scale-105";
        btnText = "1";
      } else if (val === 2) {
        btnStyle = "bg-purple-500 text-white font-black shadow-lg scale-105 ring-1 ring-purple-300";
        btnText = "2";
      } else if (val === 3) {
        btnStyle = "bg-amber-400 text-slate-950 font-black shadow-lg scale-105 ring-2 ring-amber-300";
        btnText = "3";
      }

      daysHtml += `
        <td class="py-2 px-1 text-center">
          <button onclick="toggleDayEstimulo('${p.id}', '${d.key}')" 
                  title="${d.full}: ${val === 0 ? 'Sin práctica' : val + ' Turno(s)'} (Clic para rotar 0->1->2->3)"
                  class="w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center mx-auto ${btnStyle}">
            ${btnText}
          </button>
        </td>
      `;
    });

    tr.innerHTML = `
      <td class="py-2.5 px-3 flex items-center gap-2">
        <span class="w-6 h-6 rounded-full bg-purple-950 text-gray-300 font-black text-[11px] flex items-center justify-center border border-purple-800 flex-shrink-0">
          ${p.dorsal}
        </span>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-white text-xs">${esc(p.name)}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${main ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}">${main ? 'PRINCIPAL' : 'OTRA CAT.'}</span>
          </div>
          <span class="text-[10px] text-gray-400">${p.pos} • ${esc(state.myTeam || '')}</span>
        </div>
      </td>
      ${daysHtml}
      <td class="py-2 px-2 text-center">
        <span class="text-sm ${st.statusClass}">${tot}</span>
        <span class="text-[10px] text-gray-400">${main ? '/ ' + cfgMin() + ' mín' : 'turnos'}</span>
      </td>
      <td class="py-2 px-3 text-center">
        <span class="px-2.5 py-1 rounded-md text-[10px] font-bold border ${main ? st.badge : 'bg-blue-950/80 text-blue-300 border-blue-800'}">
          ${main ? st.text : 'OTRA CATEGORÍA'}
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function handleTrainingWeekChange(newWeek) {
  state.training.currentWeek = newWeek;
  if (!state.training.weeks[newWeek]) {
    state.training.weeks[newWeek] = {};
  }
  saveTrainingData();
  renderTrainingTable();
  if (typeof renderRosterTable === 'function') renderRosterTable();
}

function createNewTrainingWeek() {
  const currentCount = Object.keys(state.training.weeks).length;
  const nextWeekName = prompt("Nombre de la nueva semana de entrenamientos:", `Semana ${currentCount + 1}`);
  if (!nextWeekName || !nextWeekName.trim()) return;

  const cleanName = nextWeekName.trim();
  if (state.training.weeks[cleanName]) {
    alert("Ya existe una semana con ese nombre.");
    return;
  }

  state.training.weeks[cleanName] = {};
  state.training.currentWeek = cleanName;
  saveTrainingData();
  renderTrainingTable();
  if (typeof renderRosterTable === 'function') renderRosterTable();
}

function clearCurrentWeekEstimulos() {
  if (!confirm(`¿Estás seguro de reiniciar todos los estímulos registrados de '${state.training.currentWeek}'?`)) return;
  state.training.weeks[state.training.currentWeek] = {};
  saveTrainingData();
  renderTrainingTable();
  if (typeof renderRosterTable === 'function') renderRosterTable();
}