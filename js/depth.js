function renderDepthChart() {
  const grid = document.getElementById('depthChartGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const positions = [
    { key: 'PG', title: 'PG (Base)' },
    { key: 'SG', title: 'SG (Escolta)' },
    { key: 'SF', title: 'SF (Alero)' },
    { key: 'PF', title: 'PF (Ala-Pívot)' },
    { key: 'C',  title: 'C (Pívot)' }
  ];

  positions.forEach(colInfo => {
    const col = document.createElement('div');
    col.className = "bg-[#110620] rounded-2xl border border-purple-900/60 p-3 flex flex-col min-h-[480px] transition";
    col.setAttribute('data-pos', colInfo.key);

    col.innerHTML = `
      <div class="text-center pb-2.5 mb-2.5 border-b border-purple-900/60 font-black text-emerald-400 text-sm tracking-wider flex items-center justify-between px-1">
        <span>${colInfo.title}</span>
        <span class="text-[10px] bg-purple-950/80 px-2 py-0.5 rounded text-purple-300 font-bold border border-purple-800" id="count-${colInfo.key}">0</span>
      </div>
      <div class="space-y-2 flex-1 flex flex-col min-h-[380px]" id="depth-list-${colInfo.key}"></div>
    `;

    const dropList = col.querySelector(`#depth-list-${colInfo.key}`);

    // Arrastre sobre la columna
    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add('ring-2', 'ring-emerald-400', 'bg-purple-950/40');
    };
    col.ondragleave = () => {
      col.classList.remove('ring-2', 'ring-emerald-400', 'bg-purple-950/40');
    };
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove('ring-2', 'ring-emerald-400', 'bg-purple-950/40');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId) {
        handleDropOnDepthColumn(draggedId, colInfo.key);
      }
    };

    grid.appendChild(col);

    // Filtrar jugadoras por puesto
    const colPlayers = state.roster
      .filter(p => p.pos === colInfo.key)
      .sort((a, b) => (a.depth || 1) - (b.depth || 1));

    const countEl = col.querySelector(`#count-${colInfo.key}`);
    if (countEl) countEl.innerText = colPlayers.length;

    if (colPlayers.length === 0) {
      dropList.innerHTML = `<div class="p-6 text-center text-gray-500 border-2 border-dashed border-purple-900/40 rounded-xl text-xs flex-1 flex items-center justify-center">Arrastrá una jugadora aquí para moverla a ${colInfo.key}</div>`;
    }

    colPlayers.forEach((p, idx) => {
      p.depth = idx + 1; // Jerarquía estricta 1, 2, 3...
      const item = document.createElement('div');
      item.draggable = true;
      item.setAttribute('data-id', p.id);

      item.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', p.id);
        item.classList.add('opacity-40');
      };
      item.ondragend = () => {
        item.classList.remove('opacity-40');
        document.querySelectorAll('.border-t-4, .border-b-4').forEach(el => {
          el.classList.remove('border-t-4', 'border-b-4', 'border-emerald-400');
        });
      };

      // Indicadores visuales al arrastrar arriba o abajo
      item.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = item.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        if (relY < rect.height / 2) {
          item.classList.add('border-t-4', 'border-emerald-400');
          item.classList.remove('border-b-4');
        } else {
          item.classList.add('border-b-4', 'border-emerald-400');
          item.classList.remove('border-t-4');
        }
      };

      item.ondragleave = (e) => {
        e.stopPropagation();
        item.classList.remove('border-t-4', 'border-b-4', 'border-emerald-400');
      };

      item.ondrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.classList.remove('border-t-4', 'border-b-4', 'border-emerald-400');
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== p.id) {
          const rect = item.getBoundingClientRect();
          const insertBefore = (e.clientY - rect.top) < (rect.height / 2);
          handleReorderDepth(draggedId, p.id, colInfo.key, insertBefore);
        }
      };

      const isTitular = p.isStarter;
      const statusBadge = p.status === 'LES' 
        ? '<span class="text-red-400 font-bold text-[10px]">+ LES</span>' 
        : (isTitular 
            ? '<span class="text-emerald-400 font-bold text-[10px]">TITULAR</span>' 
            : (p.isConvocada ? '<span class="text-gray-400 font-semibold text-[10px]">BANCO</span>' : '<span class="text-purple-400/60 font-semibold text-[10px]">RESERVA</span>'));

      item.className = `p-2.5 rounded-xl border cursor-grab active:cursor-grabbing transition shadow ${isTitular ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/50' : (p.isConvocada ? 'bg-[#180c2e] border-purple-800/80 hover:border-purple-600' : 'bg-[#10061e] border-purple-950/60 opacity-60 hover:opacity-100')}`;
      
      item.innerHTML = `
        <div class="flex items-center justify-between text-xs font-bold text-white mb-1">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-gray-500 font-mono">#${idx + 1}</span>
            <span class="truncate max-w-[110px]">${p.name.split(',')[0]}</span>
          </div>
          ${statusBadge}
        </div>
        <div class="flex items-center justify-between text-[10px] text-gray-400">
          <span class="font-semibold text-gray-300">Camiseta #${p.dorsal}</span>
          <span>${(p.stats.PTS || 0).toFixed(1)} pts • ${(p.stats.MIN || 0).toFixed(0)}'</span>
        </div>
        <div class="flex justify-end gap-1 mt-1.5">
          <button onclick="event.stopPropagation();movePlayerPos('${p.id}',-1)" title="Puesto anterior" class="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-gray-300 text-[11px]">◀</button>
          <button onclick="event.stopPropagation();shiftDepthPlayer('${p.id}',-1)" title="Subir" class="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-gray-300 text-[11px]">▲</button>
          <button onclick="event.stopPropagation();shiftDepthPlayer('${p.id}',1)" title="Bajar" class="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-gray-300 text-[11px]">▼</button>
          <button onclick="event.stopPropagation();movePlayerPos('${p.id}',1)" title="Puesto siguiente" class="px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-gray-300 text-[11px]">▶</button>
        </div>
      `;

      item.onclick = (e) => {
        e.stopPropagation();
        openPlayerModal(p.id);
      };

      dropList.appendChild(item);
    });
  });
}

function handleReorderDepth(draggedId, targetId, targetPos, insertBefore) {
  const dragged = state.roster.find(x => x.id === draggedId);
  const target = state.roster.find(x => x.id === targetId);
  if (!dragged || !target) return;

  dragged.pos = targetPos;

  let colPlayers = state.roster
    .filter(p => p.pos === targetPos && p.id !== dragged.id)
    .sort((a, b) => (a.depth || 1) - (b.depth || 1));

  const targetIdx = colPlayers.findIndex(p => p.id === target.id);
  const insertIdx = insertBefore ? targetIdx : targetIdx + 1;

  colPlayers.splice(insertIdx, 0, dragged);

  colPlayers.forEach((p, idx) => {
    p.depth = idx + 1;
  });

  // Si pasa al puesto #1 y está activa, toma la titularidad del puesto
  if (colPlayers[0].id === dragged.id && dragged.status === 'ACT') {
    colPlayers.slice(1).forEach(other => {
      if (other.isStarter && other.pos === targetPos) {
        other.isStarter = false;
      }
    });
    dragged.isStarter = true;
    dragged.isConvocada = true;
    dragged.courtSlot = targetPos;
  }

  // AUTO GUARDADO PERMANENTE
  if (typeof saveRosterState === 'function') {
    saveRosterState();
  }

  renderDepthChart();
  if (typeof renderRosterTable === 'function') renderRosterTable();
  if (typeof updateCourtPositions === 'function') updateCourtPositions();
}

function handleDropOnDepthColumn(draggedId, targetPos) {
  const dragged = state.roster.find(x => x.id === draggedId);
  if (!dragged) return;

  if (dragged.pos !== targetPos) {
    dragged.pos = targetPos;
    const targetCol = state.roster
      .filter(x => x.pos === targetPos && x.id !== dragged.id)
      .sort((a, b) => (a.depth || 1) - (b.depth || 1));
    dragged.depth = targetCol.length + 1;
  }

  // AUTO GUARDADO PERMANENTE
  if (typeof saveRosterState === 'function') {
    saveRosterState();
  }

  renderDepthChart();
  if (typeof renderRosterTable === 'function') renderRosterTable();
  if (typeof updateCourtPositions === 'function') updateCourtPositions();
}

const DEPTH_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];
function shiftDepthPlayer(id, d) {
  const p = state.roster.find(x => x.id === id);
  if (!p) return;
  const col = state.roster.filter(x => x.pos === p.pos).sort((a, b) => (a.depth || 1) - (b.depth || 1));
  const i = col.indexOf(p), j = i + d;
  if (j < 0 || j >= col.length) return;
  [col[i], col[j]] = [col[j], col[i]];
  col.forEach((x, k) => x.depth = k + 1);
  saveRosterState();
  renderDepthChart();
  renderRosterTable();
  updateCourtPositions();
}
function movePlayerPos(id, d) {
  const p = state.roster.find(x => x.id === id);
  if (!p) return;
  const k = DEPTH_ORDER.indexOf(p.pos) + d;
  if (k < 0 || k >= DEPTH_ORDER.length) return;
  handleDropOnDepthColumn(id, DEPTH_ORDER[k]);
}
