// Encaixe real sobre os polígonos do molde: preenchimento inferior-esquerdo numa grade de 2 cm,
// testando algumas estratégias e ficando com o risco mais curto. Heurística gulosa sozinha erra:
// girar um painel pode encostá-lo na ourela e estragar o resto do risco.
// X = comprimento do risco, Y = largura do tecido. Pontos [x,y] em mm; posições e comp em mm.
(function (g) {
  const ENC_RES = 20;

  // giro em quartos de volta: 0=0°, 1=90°, 2=180°, 3=270°
  function rasterPol(pts, giro) {
    let p = pts; for (let k = 0; k < (giro || 0); k++) p = p.map(([x, y]) => [-y, x]);
    let x0 = 1 / 0, y0 = 1 / 0, x1 = -1 / 0, y1 = -1 / 0;
    for (const q of p) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
    p = p.map(([x, y]) => [x - x0, y - y0]);
    const cw = Math.max(1, Math.ceil((x1 - x0) / ENC_RES)), ch = Math.max(1, Math.ceil((y1 - y0) / ENC_RES)), m = new Uint8Array(cw * ch);
    const dentro = (px, py) => {
      let d = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i], [xj, yj] = p[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) d = !d;
      }
      return d;
    };
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) if (dentro((cx + .5) * ENC_RES, (cy + .5) * ENC_RES)) m[cy * cw + cx] = 1;
    return { cw, ch, m };
  }

  // variantes de giro permitidas pela peça: sem `rot` (produto antigo) vale '180';
  // `espelhar` acrescenta, depois das normais, as mesmas espelhadas em Y; `escala` entra antes de rasterizar
  function variantes(pts, o) {
    o = o || {};
    const sx = o.escala ? +o.escala.x || 1 : 1, sy = o.escala ? +o.escala.y || 1 : 1;
    const p = sx === 1 && sy === 1 ? pts : pts.map(([x, y]) => [Math.round(x * sx * 1e3) / 1e3, Math.round(y * sy * 1e3) / 1e3]); // arredonda: 200·1,1 não pode virar 12 células
    const giros = o.rot === 'nenhuma' ? [0] : o.rot === 'livre' ? [0, 1, 2, 3] : [0, 2];
    const formas = o.espelhar ? [p, p.map(([x, y]) => [x, -y])] : [p];
    return formas.flatMap(f => giros.map(k => rasterPol(f, k)));
  }
  const rasterRot = (pts, rot) => variantes(pts, { rot });

  // lista: [{rot:[{r,v}], b0}] já ordenada; devolve {maxX, pos:[{ox,oy,v}]} em células
  function encaixaBLF(lista, largCel, maxCel, custo) {
    const occ = new Uint8Array(maxCel * largCel); let maxX = 0;
    const livre = (r, ox, oy) => {
      if (oy + r.ch > largCel || ox + r.cw > maxCel) return false;
      for (let cy = 0; cy < r.ch; cy++) for (let cx = 0; cx < r.cw; cx++) if (r.m[cy * r.cw + cx] && occ[(ox + cx) * largCel + oy + cy]) return false;
      return true;
    };
    const pos = [];
    for (const pc of lista) {
      let b = null;
      for (let ox = 0; ox <= maxX && !b; ox++) {
        const cand = [];
        pc.rot.forEach(({ r, v }) => { for (let oy = 0; oy + r.ch <= largCel && (oy === 0 || !pc.b0); oy++) if (livre(r, ox, oy)) { cand.push({ r, ox, oy, i: v }); break; } });
        if (cand.length) { cand.sort((x, y) => custo(x) - custo(y)); b = cand[0]; }
      }
      if (!b) b = { r: pc.rot[0].r, ox: maxX, oy: 0, i: pc.rot[0].v };
      for (let cy = 0; cy < b.r.ch; cy++) for (let cx = 0; cx < b.r.cw; cx++) if (b.r.m[cy * b.r.cw + cx]) occ[(b.ox + cx) * largCel + b.oy + cy] = 1;
      maxX = Math.max(maxX, b.ox + b.r.cw);
      pos.push({ i: pc.i, ox: b.ox, oy: b.oy, var: b.i });
    }
    return { maxX, pos };
  }

  // itens: um por peça a colocar, {pecaIdx, rasters, borda0, a?} (a = área para ordenar; sem ela, a do raster)
  // -> {comp, posicoes:[{i, ox, oy, var}]} em mm (i = índice em itens, var = índice em rasters) | null
  function encaixar(itens, largMm, opts) {
    const largCel = Math.floor(largMm / ENC_RES);
    if (!(largCel > 0) || !itens || !itens.length) return null;
    const todos0 = !!(opts && opts.borda0);
    const lista = [];
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      const rot = (it.rasters || []).map((r, v) => ({ r, v })).filter(x => x.r.ch <= largCel);
      if (!rot.length) return null;
      lista.push({ i, rot, b0: todos0 || !!it.borda0, a: it.a != null ? +it.a || 0 : rot[0].r.cw * rot[0].r.ch * ENC_RES * ENC_RES });
    }
    const maxCel = lista.reduce((a, x) => a + x.rot[0].r.cw, 0) + 4;
    let melhor = null;
    for (const ord of [(a, b) => b.a - a.a, (a, b) => b.rot[0].r.ch - a.rot[0].r.ch || b.a - a.a])
      for (const custo of [c => c.oy * 1e4 + c.ox + c.r.cw, c => (c.ox + c.r.cw) * 1e4 + c.oy, c => c.i * 1e4 + c.oy]) {
        const n = encaixaBLF(lista.slice().sort(ord), largCel, maxCel, custo);
        if (melhor == null || n.maxX < melhor.maxX) melhor = n;
      }
    return {
      comp: melhor.maxX * ENC_RES,
      posicoes: melhor.pos.sort((a, b) => a.i - b.i).map(p => ({ i: p.i, ox: p.ox * ENC_RES, oy: p.oy * ENC_RES, var: p.var }))
    };
  }

  // peças do risco: a de cada tamanho (porTam, senão a base), só do tecido principal
  function pecasDoRisco(p, tams) {
    const m = p && p.mol; if (!m) return [];
    return (tams || []).flatMap(t => (m.porTam && m.porTam[t] && m.porTam[t].length ? m.porTam[t] : m.pecas) || []).filter(q => !q.tecido);
  }

  // comprimento do risco, em metros, para a lista de peças (já com os tamanhos do risco) no tecido de `largMm` de largura útil
  function encaixeMol(pecas, largMm) {
    const largCel = Math.floor(largMm / ENC_RES);
    if (!(largCel > 0)) return null;
    const itens = [], ras = new Map();
    for (const [k, q] of (pecas || []).entries()) {
      if (!(q.pts && q.pts.length > 2)) return null;
      if (!ras.has(q)) ras.set(q, rasterRot(q.pts, q.rot));
      const rasters = ras.get(q);
      if (!rasters.some(r => r.ch <= largCel)) return null;
      const n = Math.max(0, Math.round(+q.qtd || 0));
      for (let c = 0; c < n; c++) itens.push({ pecaIdx: k, rasters, a: (+q.w || 0) * (+q.h || 0) });
    }
    const r = encaixar(itens, largMm);
    return r && r.comp / 1000;
  }

  const MoldeEncaixe = { ENC_RES, rasterPol, rasterRot, variantes, encaixar, pecasDoRisco, encaixeMol };
  g.MoldeEncaixe = MoldeEncaixe;
  if (typeof module !== 'undefined') module.exports = MoldeEncaixe;
})(typeof window !== 'undefined' ? window : globalThis);
