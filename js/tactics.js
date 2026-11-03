const COURT_PRESETS = {
  "4out1in": {
    "PG": { x: 30, y: 78, label: "Base (PG)" },
    "SG": { x: 70, y: 78, label: "Escolta (SG)" },
    "SF": { x: 16, y: 55, label: "Alero (SF)" },
    "PF": { x: 84, y: 55, label: "Ala-Pívot (PF)" },
    "C":  { x: 50, y: 35, label: "Pívot (C)" }
  },
  "4outHigh": {
    "PG": { x: 50, y: 82, label: "Base (PG)" },
    "SG": { x: 82, y: 65, label: "Escolta (SG)" },
    "SF": { x: 18, y: 65, label: "Alero (SF)" },
    "PF": { x: 85, y: 30, label: "Ala-Pívot (PF)" },
    "C":  { x: 50, y: 46, label: "Pívot (C)" }
  },
  "5out": {
    "PG": { x: 50, y: 80, label: "PG" },
    "SG": { x: 82, y: 65, label: "SG" },
    "SF": { x: 18, y: 65, label: "SF" },
    "PF": { x: 86, y: 28, label: "PF" },
    "C":  { x: 14, y: 28, label: "C" }
  },
  "horns": {
    "PG": { x: 50, y: 84, label: "PG" },
    "SG": { x: 86, y: 55, label: "SG" },
    "SF": { x: 14, y: 55, label: "SF" },
    "PF": { x: 62, y: 45, label: "PF" },
    "C":  { x: 38, y: 45, label: "C" }
  }
};

// Insignia compacta de estado actual (ACT, INA, + LES)
function getStatusBadgeHtml(status) {
  if (status === 'LES') {
    return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-950 text-red-300 border border-red-700">+ LES</span>`;
  } else if (status === 'INA') {
    return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-gray-300 border border-gray-600">INA</span>`;
  }
  return `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">ACT</span>`;
}

function renderRosterTable() {
  updateRecAverages();
  const tbody = document.getElementById('rosterTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const convocadas = state.roster.filter(p => p.isConvocada);
  const starters = convocadas.filter(p => p.isStarter);
  const bench = convocadas.filter(p => !p.isStarter);

  const squadCountEl = document.getElementById('matchSquadCount');
  if (squadCountEl) squadCountEl.innerText = convocadas.length;
  const starterCountEl = document.getElementById('starterCount');
  if (starterCountEl) starterCountEl.innerText = starters.length;

  const matchSquad = [...starters, ...bench];

  matchSquad.forEach(p => {
    const tr = document.createElement('tr');
    const isSelected = state.selectedSwapId === p.id;
    tr.className = `hover:bg-purple-900/30 transition cursor-pointer ${p.isStarter ? 'bg-emerald-950/25' : ''} ${p.status !== 'ACT' ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-yellow-400 bg-yellow-950/30' : ''}`;
    
    tr.onclick = () => handleSwapSelection(p.id);

    tr.innerHTML = `
      <td class="py-2 flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full ${p.isStarter ? 'bg-emerald-500 text-slate-950' : 'bg-purple-900 text-purple-200'} font-black text-[10px] flex items-center justify-center flex-shrink-0">
          ${p.dorsal}
        </span>
        <span class="font-bold text-white truncate max-w-[105px]">${esc(p.name)}</span>
        ${typeof getEstimulosBadgeHtml === 'function' ? getEstimulosBadgeHtml(p.id) : ''}
      </td>
      <td class="py-2 text-center font-bold ${p.pos === 'C' ? 'text-amber-400' : 'text-blue-400'}">${p.pos}</td>
      <td class="py-2 text-center text-gray-300 font-semibold">${(p.stats.MIN || 0).toFixed(1)}'</td>
      <td class="py-2 text-center font-black text-emerald-400">${(p.stats.PTS || 0).toFixed(1)}</td>
      <td class="py-2 text-center font-semibold text-blue-300">${(p.stats.PLAYS || 0).toFixed(1)}</td>
      <td class="py-2 text-center font-semibold text-amber-300">${(((p.stats['TO%'] || 0) * 100)).toFixed(0)}%</td>
      <td class="py-2 text-center">
        ${getStatusBadgeHtml(p.status)}
      </td>
      <td class="py-2 text-right">
        <div class="inline-flex items-center gap-1">
          <button onclick="event.stopPropagation(); openPlayerModal('${p.id}')" title="Ver ficha de jugadora" class="p-1 rounded text-purple-300 hover:text-white">
            <i class="fa-solid fa-address-card text-xs"></i>
          </button>
          <button onclick="event.stopPropagation(); toggleStarter('${p.id}')" title="${p.isStarter ? 'Mandar al banco' : 'Poner de titular'}" class="p-1 rounded ${p.isStarter ? 'text-emerald-400 hover:bg-emerald-950' : 'text-gray-400 hover:text-white'}">
            <i class="fa-solid ${p.isStarter ? 'fa-arrow-down' : 'fa-arrow-up'}"></i>
          </button>
          <button onclick="event.stopPropagation(); desconvocarPlayer('${p.id}')" title="Enviar a reserva" class="p-1 rounded text-red-400 hover:text-red-300">
            <i class="fa-solid fa-user-minus text-[11px]"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderReserves();
}

function renderReserves() {
  const reserves = state.roster.filter(p => !p.isConvocada);
  const countEl = document.getElementById('reserveCount');
  if (countEl) countEl.innerText = reserves.length;
  const tbody = document.getElementById('reserveTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (reserves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-3 text-[11px]">Todo el plantel está convocado en la planilla.</td></tr>`;
    return;
  }

  const statusWeights = { 'ACT': 0, 'LES': 1, 'INA': 2 };

  reserves.sort((a, b) => {
    const weightA = statusWeights[a.status] !== undefined ? statusWeights[a.status] : 0;
    const weightB = statusWeights[b.status] !== undefined ? statusWeights[b.status] : 0;

    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return (b.stats.MIN || 0) - (a.stats.MIN || 0);
  });

  reserves.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = `hover:bg-purple-900/30 transition cursor-pointer ${p.status !== 'ACT' ? 'opacity-50 bg-[#0d0517]' : ''}`;
    
    tr.onclick = () => openPlayerModal(p.id);

    tr.innerHTML = `
      <td class="py-2 flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full bg-purple-950 text-gray-300 font-bold text-[10px] flex items-center justify-center flex-shrink-0 border border-purple-800">
          ${p.dorsal}
        </span>
        <span class="font-bold text-gray-200 truncate max-w-[105px]">${esc(p.name)}</span>
        ${typeof getEstimulosBadgeHtml === 'function' ? getEstimulosBadgeHtml(p.id) : ''}
      </td>
      <td class="py-2 text-center font-bold ${p.pos === 'C' ? 'text-amber-400' : 'text-blue-400'}">${p.pos}</td>
      <td class="py-2 text-center text-gray-300 font-semibold">${(p.stats.MIN || 0).toFixed(1)}'</td>
      <td class="py-2 text-center font-black text-emerald-400">${(p.stats.PTS || 0).toFixed(1)}</td>
      <td class="py-2 text-center font-semibold text-blue-300">${(p.stats.PLAYS || 0).toFixed(1)}</td>
      <td class="py-2 text-center font-semibold text-amber-300">${(((p.stats['TO%'] || 0) * 100)).toFixed(0)}%</td>
      <td class="py-2 text-center">
        ${getStatusBadgeHtml(p.status)}
      </td>
      <td class="py-2 text-right">
        <div class="inline-flex items-center gap-1">
          <button onclick="event.stopPropagation(); openPlayerModal('${p.id}')" title="Ver ficha" class="p-1 rounded text-purple-300 hover:text-white">
            <i class="fa-solid fa-address-card text-xs"></i>
          </button>
          <button onclick="event.stopPropagation(); convocarPlayer('${p.id}')" title="Convocar a las 12" class="px-2 py-0.5 rounded text-[10px] font-bold ${p.status !== 'ACT' ? 'bg-gray-800 text-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'} transition">
            + Convocar
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function toggleReserves() {
  state.showReserves = !state.showReserves;
  const container = document.getElementById('reserveListContainer');
  const chev = document.getElementById('reserveChevron');
  if (!container || !chev) return;
  if (state.showReserves) {
    container.classList.remove('hidden');
    chev.style.transform = "rotate(0deg)";
  } else {
    container.classList.add('hidden');
    chev.style.transform = "rotate(-90deg)";
  }
}

function convocarPlayer(id) {
  const currentConvocadas = state.roster.filter(p => p.isConvocada);
  if (currentConvocadas.length >= 12) {
    alert("La planilla ya tiene el límite de 12 jugadoras convocadas. Desconvocá a una jugadora primero haciéndole clic al botón rojo con el menos (-).");
    return;
  }
  const p = state.roster.find(x => x.id === id);
  if (p) {
    p.isConvocada = true;
    if (typeof saveRosterState === 'function') saveRosterState();
    renderRosterTable();
    updateCourtPositions();
    if (typeof renderDepthChart === 'function') renderDepthChart();
  }
}

function desconvocarPlayer(id) {
  const p = state.roster.find(x => x.id === id);
  if (p) {
    p.isConvocada = false;
    p.isStarter = false;
    p.courtSlot = null;
    if (typeof saveRosterState === 'function') saveRosterState();
    renderRosterTable();
    updateCourtPositions();
    if (typeof renderDepthChart === 'function') renderDepthChart();
  }
}

function toggleStarter(id) {
  const p = state.roster.find(x => x.id === id);
  if (!p) return;
  if (!p.isStarter) {
    const starters = state.roster.filter(x => x.isStarter && x.isConvocada);
    if (starters.length >= 5) {
      alert("Ya tenés 5 titulares en cancha. Hacé clic en la que querés reemplazar o mandala al banco.");
      return;
    }
    if (p.status !== 'ACT') {
      alert("No podés poner de titular a una jugadora inactiva o lesionada.");
      return;
    }
    p.isStarter = true;
    assignCourtSlot(p);
  } else {
    p.isStarter = false;
    p.courtSlot = null;
  }
  if (typeof saveRosterState === 'function') saveRosterState();
  renderRosterTable();
  updateCourtPositions();
  if (typeof renderDepthChart === 'function') renderDepthChart();
}

function assignCourtSlot(p) {
  const slots = ['PG', 'SG', 'SF', 'PF', 'C'];
  const takenSlots = state.roster.filter(x => x.isStarter && x.id !== p.id).map(x => x.courtSlot);
  if (!takenSlots.includes(p.pos)) {
    p.courtSlot = p.pos;
  } else {
    const freeSlot = slots.find(s => !takenSlots.includes(s)) || 'PG';
    p.courtSlot = freeSlot;
  }
}

function updateCourtPositions() {
  const styleEl = document.getElementById('tacticalStyle');
  const scheme = styleEl ? styleEl.value || '4out1in' : '4out1in';
  const positions = COURT_PRESETS[scheme];
  const container = document.getElementById('courtTokens');
  if (!container) return;
  container.innerHTML = '';

  const slotKeys = ['PG', 'SG', 'SF', 'PF', 'C'];
  let starters = state.roster.filter(p => p.isStarter && p.isConvocada && p.status === 'ACT');

  slotKeys.forEach(slot => {
    let p = starters.find(x => x.courtSlot === slot);
    if (!p) {
      p = starters.find(x => !x.courtSlot || !slotKeys.includes(x.courtSlot));
      if (p) p.courtSlot = slot;
    }
  });

  slotKeys.forEach(slot => {
    const p = starters.find(x => x.courtSlot === slot);
    const coord = positions[slot];

    const slotWrapper = document.createElement('div');
    const isSelected = p && state.selectedSwapId === p.id;

    slotWrapper.className = `court-slot absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer select-none ${isSelected ? 'selected-swap' : ''}`;
    slotWrapper.style.left = coord.x + "%";
    slotWrapper.style.top = coord.y + "%";
    slotWrapper.setAttribute('data-slot', slot);

    slotWrapper.ondragover = (e) => {
      e.preventDefault();
      slotWrapper.classList.add('drag-over');
    };
    slotWrapper.ondragleave = () => {
      slotWrapper.classList.remove('drag-over');
    };
    slotWrapper.ondrop = (e) => {
      e.preventDefault();
      slotWrapper.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId) {
        handleDropOnSlot(draggedId, slot);
      }
    };

    if (p) {
      slotWrapper.draggable = true;
      slotWrapper.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', p.id);
      };

      const isC = p.pos === 'C' || slot === 'C';
      const badgeCol = isC ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950';

      slotWrapper.innerHTML = `
        <div class="relative group">
          <div class="w-11 h-11 rounded-full ${badgeCol} font-black flex items-center justify-center shadow-2xl border-2 border-slate-950 text-sm transform group-hover:scale-110 transition">
            ${p.dorsal}
          </div>
          <span class="absolute -top-1 -right-2 bg-[#12071f] text-[9px] font-bold px-1 rounded border ${isC ? 'border-amber-400 text-amber-300' : 'border-emerald-400 text-emerald-300'}">
            ${slot}
          </span>
        </div>
        <div class="bg-[#110620]/95 border border-purple-800/90 px-2 py-0.5 rounded text-[10px] font-bold text-white mt-1 shadow-lg truncate max-w-[90px] text-center">
          ${esc(p.name.split(',')[0])}
        </div>
      `;

      slotWrapper.onclick = (e) => {
        e.stopPropagation();
        handleSwapSelection(p.id);
      };
    } else {
      slotWrapper.innerHTML = `
        <div class="w-10 h-10 rounded-full border-2 border-dashed border-purple-500/60 bg-purple-950/30 flex items-center justify-center text-purple-300 font-bold text-xs hover:border-emerald-400 hover:text-emerald-400 transition">
          +
        </div>
        <span class="text-[9px] text-gray-400 font-semibold mt-1">${coord.label}</span>
      `;
      slotWrapper.onclick = () => {
        if (state.selectedSwapId) {
          const moving = state.roster.find(x => x.id === state.selectedSwapId);
          if (moving) {
            moving.isStarter = true;
            moving.courtSlot = slot;
            state.selectedSwapId = null;
            document.getElementById('selectedActionHint').innerText = "Arrastrá o hacé clic en 2 fichas para intercambiar";
            if (typeof saveRosterState === 'function') saveRosterState();
            renderRosterTable();
            updateCourtPositions();
          }
        }
      };
    }

    container.appendChild(slotWrapper);
  });
}

function handleSwapSelection(id) {
  const hintEl = document.getElementById('selectedActionHint');
  if (!state.selectedSwapId) {
    state.selectedSwapId = id;
    const p1 = state.roster.find(x => x.id === id);
    if (hintEl) hintEl.innerHTML = `<span class="text-yellow-300 font-bold">1/2: ${p1.name.split(',')[0]} seleccionada.</span> Toca otra jugadora o puesto para cambiar.`;
    renderRosterTable();
    updateCourtPositions();
  } else if (state.selectedSwapId === id) {
    state.selectedSwapId = null;
    if (hintEl) hintEl.innerText = "Arrastrá o hacé clic en 2 fichas para intercambiar";
    renderRosterTable();
    updateCourtPositions();
  } else {
    const p1 = state.roster.find(x => x.id === state.selectedSwapId);
    const p2 = state.roster.find(x => x.id === id);
    if (p1 && p2) {
      const tempStarter = p1.isStarter;
      const tempSlot = p1.courtSlot;

      p1.isStarter = p2.isStarter;
      p1.courtSlot = p2.courtSlot;

      p2.isStarter = tempStarter;
      p2.courtSlot = tempSlot;

      state.selectedSwapId = null;
      if (hintEl) {
        hintEl.innerText = `¡Cambio realizado entre ${p1.name.split(',')[0]} y ${p2.name.split(',')[0]}!`;
        setTimeout(() => {
          hintEl.innerText = "Arrastrá o hacé clic en 2 fichas para intercambiar";
        }, 3000);
      }
      if (typeof saveRosterState === 'function') saveRosterState();
      renderRosterTable();
      updateCourtPositions();
    }
  }
}

function handleDropOnSlot(draggedId, targetSlot) {
  const draggedPlayer = state.roster.find(x => x.id === draggedId);
  if (!draggedPlayer) return;

  const occupyingPlayer = state.roster.find(x => x.isStarter && x.courtSlot === targetSlot && x.id !== draggedId);

  if (occupyingPlayer) {
    const prevSlot = draggedPlayer.courtSlot;
    draggedPlayer.courtSlot = targetSlot;
    draggedPlayer.isStarter = true;
    occupyingPlayer.courtSlot = prevSlot;
    if (!prevSlot) occupyingPlayer.isStarter = false;
  } else {
    draggedPlayer.isStarter = true;
    draggedPlayer.courtSlot = targetSlot;
  }

  state.selectedSwapId = null;
  if (typeof saveRosterState === 'function') saveRosterState();
  renderRosterTable();
  updateCourtPositions();
}

function setPlayerStatus(id, newStatus) {
  const p = state.roster.find(x => x.id === id);
  if (!p) return;
  p.status = newStatus;
  if (newStatus !== 'ACT' && p.isStarter) {
    p.isStarter = false;
    p.courtSlot = null;
    const backup = state.roster.find(b => b.isConvocada && !b.isStarter && b.status === 'ACT');
    if (backup) {
      backup.isStarter = true;
      assignCourtSlot(backup);
    }
  }
  if (typeof saveRosterState === 'function') saveRosterState();
  renderRosterTable();
  updateCourtPositions();
  if (state.activeModalPlayerId === id) updateModalStatusButtons(newStatus);
}

function setPlayerStatusFromModal(newStatus) {
  if (state.activeModalPlayerId) setPlayerStatus(state.activeModalPlayerId, newStatus);
}

function updateModalStatusButtons(status) {
  ['ACT', 'INA', 'LES'].forEach(s => {
    const el = document.getElementById('modalStatus' + s);
    if (el) el.className = "px-2.5 py-1 rounded text-xs font-bold text-gray-400";
  });
  const b = document.getElementById('modalStatus' + status);
  if (!b) return;
  if (status === 'ACT') b.className = "px-2.5 py-1 rounded text-xs font-bold bg-emerald-500 text-slate-950";
  if (status === 'INA') b.className = "px-2.5 py-1 rounded text-xs font-bold bg-gray-600 text-white";
  if (status === 'LES') b.className = "px-2.5 py-1 rounded text-xs font-bold bg-red-600 text-white";
}

function openPlayerModal(id) {
  const p = state.roster.find(x => x.id === id);
  if (!p) return;
  state.activeModalPlayerId = id;

  document.getElementById('modalPlayerName').innerText = p.name;
  document.getElementById('modalDorsalCircle').innerText = '#' + p.dorsal;
  document.getElementById('modalEditPos').value = p.pos;
  if (document.getElementById('modalEditCat')) {
    document.getElementById('modalEditCat').value = (p.cat === 'OTHER') ? 'OTHER' : 'MAIN';
  }
  document.getElementById('modalEditDorsal').value = p.dorsal;
  updateModalStatusButtons(p.status);

  const s = p.stats;
  const pj = s.PJ || 1;
  document.getElementById('modalPJDisplay').innerText = `${pj} Partidos Jugados`;

  const t2PctVal = (typeof s['T2%'] === 'number') ? (s['T2%'] * 100).toFixed(0) : '0';
  document.getElementById('modalT2Pct').innerText = t2PctVal + '%';
  document.getElementById('modalT2Detail').innerText = s.T2C ? `${(s.T2C / pj).toFixed(1)} / ${(s.T2I / pj).toFixed(1)}` : 'Acierto';

  const t3PctVal = (typeof s['T3%'] === 'number') ? (s['T3%'] * 100).toFixed(0) : '0';
  document.getElementById('modalT3Pct').innerText = t3PctVal + '%';
  document.getElementById('modalT3Detail').innerText = s.T3C ? `${(s.T3C / pj).toFixed(1)} / ${(s.T3I / pj).toFixed(1)}` : 'Acierto';

  const t1PctVal = (typeof s['T1%'] === 'number') ? (s['T1%'] * 100).toFixed(0) : '0';
  document.getElementById('modalT1Pct').innerText = t1PctVal + '%';
  document.getElementById('modalT1Detail').innerText = s.T1C ? `${(s.T1C / pj).toFixed(1)} / ${(s.T1I / pj).toFixed(1)}` : 'Acierto';

  const rtVal = (s.RT || 0).toFixed(1);
  const roVal = s.RO ? (s.RO / pj).toFixed(1) : (s.RT ? (s.RT * 0.35).toFixed(1) : '0.0');
  const rdVal = s.RD ? (s.RD / pj).toFixed(1) : (s.RT ? (s.RT * 0.65).toFixed(1) : '0.0');
  document.getElementById('modalRebTot').innerText = rtVal;
  document.getElementById('modalRebDetail').innerText = `${roVal} OF • ${rdVal} DEF`;

  document.getElementById('modalMin').innerText = `${(s.MIN || 0).toFixed(1)}'`;
  document.getElementById('modalPlays').innerText = (s.PLAYS || 0).toFixed(1);
  document.getElementById('modalPPP').innerText = (s.PPP || 0).toFixed(2);
  const toPctVal = (typeof s['TO%'] === 'number') ? (s['TO%'] * 100).toFixed(0) : '0';
  document.getElementById('modalTO').innerText = toPctVal + '%';

  document.getElementById('playerModal').classList.remove('hidden');
}

function updatePlayerPosFromModal(newPos) {
  if (!state.activeModalPlayerId) return;
  const p = state.roster.find(x => x.id === state.activeModalPlayerId);
  if (!p || p.pos === newPos) return;

  p.pos = newPos;
  const targetCount = state.roster.filter(x => x.pos === newPos && x.id !== p.id).length;
  p.depth = targetCount + 1;

  if (typeof saveRosterState === 'function') saveRosterState();
  renderRosterTable();
  updateCourtPositions();
  if (typeof renderDepthChart === 'function') renderDepthChart();
}

function updatePlayerDorsalFromModal(newDorsal) {
  if (!state.activeModalPlayerId) return;
  const p = state.roster.find(x => x.id === state.activeModalPlayerId);
  if (!p) return;
  const num = parseInt(newDorsal) || 0;
  p.dorsal = num;
  document.getElementById('modalDorsalCircle').innerText = '#' + num;

  if (typeof saveRosterState === 'function') saveRosterState();
  renderRosterTable();
  updateCourtPositions();
  if (typeof renderDepthChart === 'function') renderDepthChart();
}

function closePlayerModal() {
  const modal = document.getElementById('playerModal');
  if (modal) modal.classList.add('hidden');
  state.activeModalPlayerId = null;
}
function updatePlayerCatFromModal(newCat) {
  if (!state.activeModalPlayerId) return;
  const p = state.roster.find(x => x.id === state.activeModalPlayerId);
  if (!p) return;
  
  p.cat = newCat;
  if (typeof saveRosterState === 'function') saveRosterState();
  
  renderRosterTable();
  if (typeof renderTrainingTable === 'function') renderTrainingTable();
}

function updateRecAverages() {
  const ps = state.roster.map(p => p.stats).filter(s => s && s.PJ);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  const label = document.getElementById('teamAvgTitle');
  if (label) label.innerText = 'Promedios ' + (state.myTeam || 'del equipo');
  if (!ps.length) { ['recPtsDisplay','recPlaysDisplay','recToDisplay','recRebDisplay'].forEach(id => set(id, '-')); set('recPjDisplay', '0 PJ'); return; }
  const games = state.matches.filter(m => isMine(m.home) || isMine(m.away)).length;
  const gp = games || Math.max(...ps.map(s => s.PJ));
  const per = k => ps.reduce((a, s) => a + (s[k] || 0) * s.PJ, 0) / gp;
  const plays = ps.reduce((a, s) => a + (s.PLAYS || 0) * s.PJ, 0);
  const tov = ps.reduce((a, s) => a + (s['TO%'] || 0) * (s.PLAYS || 0) * s.PJ, 0);
  set('recPjDisplay', gp + ' PJ');
  set('recPtsDisplay', per('PTS').toFixed(1));
  set('recPlaysDisplay', (plays / gp).toFixed(1));
  set('recToDisplay', (plays ? tov / plays * 100 : 0).toFixed(1) + '%');
  set('recRebDisplay', per('RT').toFixed(1));
}
