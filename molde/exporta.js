// Saídas 1:1 do risco (lógica pura): formas posicionadas, PLT (HP-GL), DXF R12, folhas A4 e um plano neutro
// de desenho para o PDF (a página entrega ao jsPDF; o Node testa sem ele). Tudo em mm.
// Coordenadas do risco: X = comprimento (0 = início, com a cabeceira), Y = largura (0 = ourela esquerda), Y para baixo como na tela.
(function (g) {
  const E = g.MoldeEncaixe || (typeof require !== 'undefined' ? require('./encaixe.js') : null);
  const num = v => Number.isFinite(+v) ? +v : 0;
  const r3 = v => Math.round(v * 1e3) / 1e3;
  const bbox = pts => {
    let x0 = 1 / 0, y0 = 1 / 0, x1 = -1 / 0, y1 = -1 / 0;
    for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1 };
  };

  // calc = MoldeOrdem.calcularEnfesto; opts: {cabeceira, ourelaE (mm; passe 0 no tubular, que não tem ourela),
  // pedido (ex. 'Ped. 12', antes da ref), nome (ref do produto no texto), textos (peça e tamanho), fio (seta ao longo de X), margem}.
  // Cada posição volta ao polígono real com E.poses (mesma escala/giro/espelho do raster) + (ox, oy) + deslocamentos.
  // costura sempre null: p.mol só guarda a linha de corte (molde/modelo.js pecaProduto), não há costura para desenhar
  function formas(calc, produtos, opts) {
    const o = opts || {}, dx = num(o.cabeceira), dy = num(o.ourelaE), cache = new Map();
    if (!calc || !calc.posicoes) return [];
    return calc.posicoes.map(p => {
      const it = calc.itens[p.i];
      if (!cache.has(it.rasters)) cache.set(it.rasters, E.poses(it.pts, { rot: it.rot, espelhar: it.espelhar, escala: it.escala }));
      const pts = cache.get(it.rasters)[p.var].map(([x, y]) => [r3(x + p.ox + dx), r3(y + p.oy + dy)]);
      const b = bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
      const prod = (produtos || []).find(x => x.id === it.produtoId);
      const s = [o.pedido, o.nome && prod && (prod.ref || prod.nome), o.textos && [it.nome, it.tam].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
      const meio = (b.x1 - b.x0) * 0.3; // seta do fio: 60% da peça, no centro
      return { pts, texto: s ? { s, x: r3(cx), y: r3(cy) } : null, fio: o.fio ? [[r3(cx - meio), r3(cy)], [r3(cx + meio), r3(cy)]] : null, costura: null, cor: it.cor || '' };
    });
  }

  // traços de uma forma: contorno fechado, costura e fio (com as duas pontas da seta)
  function tracos(f) {
    const t = [f.pts.concat([f.pts[0]])];
    if (f.costura) t.push(f.costura.concat([f.costura[0]]));
    if (f.fio) {
      const [[x0, y], [x1]] = f.fio, k = Math.min(10, (x1 - x0) / 4);
      t.push(f.fio, [[x1 - k, y - k / 2], [x1, y], [x1 - k, y + k / 2]]);
    }
    return t;
  }

  // rótulo em ASCII para LB/TEXT (plotter e leitores R12 não entendem acento): NFD tira o acento, · vira -
  const ascii = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/·/g, '-').replace(/[^\x20-\x7e]/g, ' ');
  // Y do arquivo = L − y; peça além de L (larg errada, p.ex. largUtil sem a ourela) sairia com Y negativo: erro
  const yInv = L => y => { if (L - y < -1e-6) throw new Error('larg menor que o risco: passe a largura total do tecido em mm'); return L - y; };

  // HP-GL: 40 unidades por mm, inteiras. Origem do plotter = canto do início do risco na ourela direita
  // (x = 0, y = larg), Y do plotter para cima: yPlt = (larg − y)·40, assim a peça não sai espelhada.
  // larg = largura TOTAL do tecido em mm (mat.larg·1000), não a largUtil: as formas já vêm com a ourela E somada
  function plt(fs, larg, comp) {
    const u = v => Math.round(v * 40), Y = yInv(num(larg)), xy = ([x, y]) => u(x) + ',' + u(Y(y));
    let s = 'IN;SP1;';
    for (const f of fs || []) {
      for (const t of tracos(f)) s += 'PU' + xy(t[0]) + ';PD' + t.slice(1).map(xy).join(',') + ';';
      if (f.texto) s += 'PU' + xy([f.texto.x, f.texto.y]) + ';LB' + ascii(f.texto.s).replace(/;/g, ' ') + '\x03;';
    }
    return s + 'PU0,0;SP0;';
  }

  // DXF R12 (AC1009) em mm. DXF tem Y para cima: y' = larg − y, a mesma origem do plt (canto do início na ourela direita).
  // larg = largura TOTAL do tecido em mm (mat.larg·1000); sem larg, cai no maior Y das formas
  function dxf(fs, larg) {
    fs = fs || [];
    const Y = yInv(larg != null ? num(larg) : Math.max(0, ...fs.flatMap(f => f.pts.map(p => p[1]))));
    const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
    const poli = (pts, fechada) => {
      out.push('0', 'POLYLINE', '8', '0', '66', '1', '10', '0', '20', '0', '30', '0', '70', fechada ? '1' : '0');
      for (const [x, y] of pts) out.push('0', 'VERTEX', '8', '0', '10', String(r3(x)), '20', String(r3(Y(y))), '30', '0');
      out.push('0', 'SEQEND', '8', '0');
    };
    for (const f of fs) {
      poli(f.pts, true);
      if (f.costura) poli(f.costura, true);
      if (f.fio) tracos({ pts: f.pts, fio: f.fio }).slice(1).forEach(t => poli(t, false));
      if (f.texto) out.push('0', 'TEXT', '8', '0', '10', String(f.texto.x), '20', String(r3(Y(f.texto.y))), '30', '0', '40', '10', '1', ascii(f.texto.s));
    }
    out.push('0', 'ENDSEC', '0', 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  // folhas A4 retrato para emendar: área útil (210 − 2·margem) × (297 − 2·margem), vizinhas se sobrepõem 10 mm.
  // x ao longo do comprimento (colunas), y ao longo da largura (linhas); linha/coluna começam em 1
  function paginasA4(comp, larg, margem = 10) {
    const SOBRA = 10, w = 210 - 2 * margem, h = 297 - 2 * margem;
    const n = (tot, t) => Math.max(1, Math.ceil((num(tot) - SOBRA) / (t - SOBRA)));
    const cols = n(comp, w), lins = n(larg, h), out = [];
    for (let l = 0; l < lins; l++) for (let c = 0; c < cols; c++) out.push({ x: c * (w - SOBRA), y: l * (h - SOBRA), w, h, linha: l + 1, coluna: c + 1 });
    return out;
  }

  // comandos neutros em mm: {tipo:'poligono', pts} | {tipo:'linha', pts} | {tipo:'texto', s, x, y, tam} | {tipo:'retangulo', x, y, w, h}.
  // opts: bordas (contorno das peças, padrão sim), limites (retângulo do enfesto), cabecalho (texto numa faixa de 15 mm acima),
  // calibracao (quadrado de 100 mm depois do fim do risco). O plano todo mede lista.w × lista.h mm
  function pdfPlano(fs, larg, comp, opts) {
    const o = opts || {}, top = o.cabecalho ? 15 : 0, L = num(larg), C = num(comp), out = [];
    const m = pts => pts.map(([x, y]) => [x, y + top]);
    if (o.cabecalho) out.push({ tipo: 'texto', s: String(o.cabecalho), x: 0, y: 10, tam: 10 });
    if (o.limites) out.push({ tipo: 'retangulo', x: 0, y: top, w: C, h: L });
    for (const f of fs || []) {
      if (o.bordas !== false) out.push({ tipo: 'poligono', pts: m(f.pts) });
      if (f.costura) out.push({ tipo: 'poligono', pts: m(f.costura), tracejado: true });
      if (f.fio) tracos({ pts: f.pts, fio: f.fio }).slice(1).forEach(t => out.push({ tipo: 'linha', pts: m(t) }));
      if (f.texto) out.push({ tipo: 'texto', s: f.texto.s, x: f.texto.x, y: f.texto.y + top, tam: 8 });
    }
    if (o.calibracao) out.push({ tipo: 'retangulo', x: C + 10, y: top, w: 100, h: 100, calibracao: true },
      { tipo: 'texto', s: '10 cm', x: C + 12, y: top + 106, tam: 8 });
    out.w = C + (o.calibracao ? 110 : 0); out.h = top + Math.max(L, o.calibracao ? 110 : 0);
    return out;
  }

  const MoldeExporta = { formas, plt, dxf, paginasA4, pdfPlano };
  g.MoldeExporta = MoldeExporta;
  if (typeof module !== 'undefined') module.exports = MoldeExporta;
})(typeof window !== 'undefined' ? window : globalThis);
