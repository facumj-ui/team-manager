// Lectura de planillas CABB (estadísticas de partido) y cálculo de promedios por jugadora.
// No usa el DOM: se puede probar en Node y se carga en el navegador como CABB.*
(function (root) {
  'use strict';

  const stripAccents = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const collapse = s => String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  const toNum = v => {
    const x = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(x) ? x : 0;
  };
  const toMin = v => {
    const s = String(v == null ? '' : v).trim();
    if (s.indexOf(':') >= 0) {
      const p = s.split(':');
      return toNum(p[0]) + toNum(p[1]) / 60;
    }
    return toNum(s);
  };
  const toAI = v => {
    const m = String(v == null ? '' : v).match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0];
  };

  // Clave para reconocer a la misma jugadora en distintas planillas (sin acentos ni espacios de más).
  function normName(s) { return stripAccents(collapse(s)).toUpperCase(); }

  // Nombre de equipo normalizado: "JUVENTUD LP - U21 F" -> "JUVENTUD LP"; "Reconquista - U21F" -> "RECONQUISTA".
  function normTeam(label) {
    let n = collapse(label).replace(/\([^)]*\)/g, ' ');
    n = n.replace(/(\s*[-–]\s*U\s?\d{2}\s?[FMfm]?)+\s*$/i, '');
    return collapse(n).toUpperCase();
  }

  // Sugerencias para el nombre del torneo a partir del título de la planilla.
  function titleMeta(title) {
    const after = String(title || '').split(/\s+vs\s+/i)[1] || '';
    const parts = after.split(/\s+-\s+/).map(s => s.trim()).filter(Boolean);
    let ci = -1;
    parts.forEach((p, i) => { if (/^U\s?\d{2}\s?[FM]$/i.test(p)) ci = i; });
    let category = '';
    let tournament = '';
    if (ci >= 0) {
      const m = parts[ci].replace(/\s+/g, '').toUpperCase().match(/^U(\d{2})([FM])$/);
      if (m) category = 'U' + m[1] + ' ' + (m[2] === 'F' ? 'Femenino' : 'Masculino');
      tournament = parts.slice(ci + 1).filter(p => !/^CABB$/i.test(p) && !/^\d{4}$/.test(p)).join(' - ');
    }
    return { category: category, tournament: tournament };
  }

  // rows: matriz de filas (XLSX.utils.sheet_to_json con header:1). Devuelve un partido o lanza Error con el motivo.
  function parseCabbRows(rows) {
    const cell = (r, c) => (rows[r] && rows[r][c] != null) ? rows[r][c] : '';
    let title = '';
    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const c = String(cell(r, 0));
      if (/estad[ií]sticas/i.test(c) && / vs /i.test(c)) { title = c; break; }
    }

    const blocks = [];
    const warnings = [];
    for (let r = 0; r < rows.length; r++) {
      if (String(cell(r, 0)).trim() !== 'Num.' || !/^nombre$/i.test(String(cell(r, 1)).trim())) continue;

      let label = '';
      for (let k = r - 1; k >= Math.max(0, r - 4); k--) {
        const t = String(cell(k, 0)).trim();
        if (t && t !== 'Num.') { label = t; break; }
      }
      const hdr = (rows[r] || []).map(x => String(x == null ? '' : x).trim());
      const idx = (name, nth) => {
        let seen = -1;
        for (let i = 0; i < hdr.length; i++) {
          if (hdr[i] === name) { seen++; if (seen === (nth || 0)) return i; }
        }
        return -1;
      };
      const col = {
        min: idx('MIN'), pts: idx('PTS'), t2: idx('A/I', 0), t3: idx('A/I', 1), t1: idx('A/I', 2),
        def: idx('DEF'), of: idx('OF'), reb: idx('Tot.'), ast: idx('AST'), per: idx('PER'), val: idx('VAL')
      };
      const faltan = ['min', 'pts', 't2', 't3', 't1', 'reb', 'ast', 'per', 'val'].filter(k => col[k] < 0);
      if (faltan.length) throw new Error('No reconozco las columnas de la planilla (faltan: ' + faltan.join(', ') + ')');

      const players = [];
      let totalPts = null;
      for (let q = r + 1; q < rows.length; q++) {
        const c0 = String(cell(q, 0)).trim();
        const c1 = String(cell(q, 1)).trim();
        if (c0 === 'Num.') break;
        if (c0.toUpperCase() === 'TOTALES' || c1.toUpperCase() === 'TOTALES') { totalPts = toNum(cell(q, col.pts)); break; }
        if (!c1) continue;
        const t2 = toAI(cell(q, col.t2)), t3 = toAI(cell(q, col.t3)), t1 = toAI(cell(q, col.t1));
        players.push({
          name: collapse(c1), num: c0, min: toMin(cell(q, col.min)), pts: toNum(cell(q, col.pts)),
          t2m: t2[0], t2a: t2[1], t3m: t3[0], t3a: t3[1], t1m: t1[0], t1a: t1[1],
          rd: col.def >= 0 ? toNum(cell(q, col.def)) : 0, ro: col.of >= 0 ? toNum(cell(q, col.of)) : 0,
          reb: toNum(cell(q, col.reb)), ast: toNum(cell(q, col.ast)), to: toNum(cell(q, col.per)), val: toNum(cell(q, col.val))
        });
      }
      const sum = players.reduce((a, p) => a + p.pts, 0);
      if (totalPts === null) totalPts = sum;
      else if (Math.abs(totalPts - sum) > 0.5) warnings.push('Los puntos de las jugadoras de ' + label + ' no suman el total del equipo.');
      blocks.push({ label: label, team: normTeam(label), pts: totalPts, players: players });
    }

    if (blocks.length !== 2) throw new Error('No parece una planilla CABB (encontré ' + blocks.length + ' equipos en lugar de 2)');
    if (!blocks[0].team || !blocks[1].team) throw new Error('No pude leer el nombre de los equipos');
    if (blocks[0].team === blocks[1].team) throw new Error('Los dos equipos tienen el mismo nombre');

    const meta = titleMeta(title);
    return {
      home: blocks[0].team, away: blocks[1].team, homePts: blocks[0].pts, awayPts: blocks[1].pts,
      players: blocks[0].players.filter(p => p.min > 0).map(p => Object.assign({ team: blocks[0].team }, p))
        .concat(blocks[1].players.filter(p => p.min > 0).map(p => Object.assign({ team: blocks[1].team }, p))),
      category: meta.category, tournament: meta.tournament, warnings: warnings
    };
  }

  // Formato compacto para guardar en el navegador.
  const FIELDS = ['team', 'name', 'num', 'min', 'pts', 't2m', 't2a', 't3m', 't3a', 't1m', 't1a', 'rd', 'ro', 'reb', 'ast', 'to', 'val'];
  const packPlayer = p => FIELDS.map(f => p[f]);
  const unpackPlayer = a => { const o = {}; FIELDS.forEach((f, i) => { o[f] = a[i]; }); return o; };

  const matchKey = m => [m.home, m.away, m.homePts, m.awayPts].join('|');

  // Promedios por partido jugado de cada jugadora, con las mismas fórmulas del scouting original:
  // PLAYS = TC intentados + 0,44 x TL intentados + pérdidas; PPP = PTS / PLAYS; TO% = pérdidas / PLAYS; TC% = TC convertidos / intentados.
  function aggregatePlayers(matches) {
    const map = new Map();
    matches.forEach(m => {
      (m.players || []).forEach(p => {
        if (!(p.min > 0)) return;
        const k = p.team + '||' + normName(p.name);
        let a = map.get(k);
        if (!a) {
          a = { team: p.team, name: collapse(p.name), key: normName(p.name), pj: 0, nums: {},
            min: 0, pts: 0, t2m: 0, t2a: 0, t3m: 0, t3a: 0, t1m: 0, t1a: 0, rd: 0, ro: 0, reb: 0, ast: 0, to: 0, val: 0 };
          map.set(k, a);
        }
        a.pj++;
        ['min', 'pts', 't2m', 't2a', 't3m', 't3a', 't1m', 't1a', 'rd', 'ro', 'reb', 'ast', 'to', 'val'].forEach(f => { a[f] += (+p[f] || 0); });
        if (p.num !== '' && p.num != null) a.nums[p.num] = (a.nums[p.num] || 0) + 1;
      });
    });
    const div = (x, y) => (y ? x / y : 0);
    const out = [];
    map.forEach(a => {
      const fga = a.t2a + a.t3a, fgm = a.t2m + a.t3m;
      const plays = fga + 0.44 * a.t1a + a.to;
      let num = '', best = 0;
      Object.keys(a.nums).forEach(n => { if (a.nums[n] > best) { best = a.nums[n]; num = n; } });
      out.push({
        EQUIPO: a.team, Nombre: a.name, KEY: a.key, NUM: num, PJ: a.pj,
        MIN: a.min / a.pj, PTS: a.pts / a.pj,
        'T2%': div(a.t2m, a.t2a), 'T3%': div(a.t3m, a.t3a), 'T1%': div(a.t1m, a.t1a), 'TC%': div(fgm, fga),
        PLAYS: plays / a.pj, PPP: div(a.pts, plays), 'TO%': div(a.to, plays),
        RT: a.reb / a.pj, AST: a.ast / a.pj, VAL: a.val / a.pj,
        T2C: a.t2m, T2I: a.t2a, T3C: a.t3m, T3I: a.t3a, T1C: a.t1m, T1I: a.t1a, RO: a.ro, RD: a.rd
      });
    });
    return out;
  }

  const api = { normName: normName, normTeam: normTeam, collapse: collapse, titleMeta: titleMeta, parseCabbRows: parseCabbRows,
    packPlayer: packPlayer, unpackPlayer: unpackPlayer, matchKey: matchKey, aggregatePlayers: aggregatePlayers };
  root.CABB = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
