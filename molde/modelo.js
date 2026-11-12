// Modelo de dados do molde (doc da coleção `moldes`). Medidas em mm.
(function (g) {
  const G = typeof module !== 'undefined' ? require('./geo.js') : g.MoldeGeo;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const TOL = 0.5; // folga entre pontas de traços encadeados

  const GRADES = { app: ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4'], pgg: ['P', 'M', 'G', 'GG'], numerica: ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56'] };
  const novo = nome => normalizar({ nome });

  function uid(m, pre) {
    const usado = new Set([...Object.keys(m.pontos), ...m.tracos.map(t => t.id), ...m.textos.map(t => t.id), ...m.pecas.map(p => p.id)]);
    let i = usado.size + 1;
    while (usado.has(pre + i)) i++;
    return pre + i;
  }

  // doc antigo/parcial: todo campo ausente ganha padrão; campos desconhecidos ficam
  function normalizar(doc) {
    const d = doc || {};
    return {
      ...d, nome: d.nome || '', produtoIds: d.produtoIds || [], base: d.base || 'M',
      pontos: d.pontos || {}, tracos: d.tracos || [], textos: d.textos || [], v: d.v || 1,
      grade: d.grade || [], grad: d.grad || {}, medidas: d.medidas || [], foto: d.foto || '',
      pecas: (d.pecas || []).map(p => ({
        ...p, nome: p.nome || '', cortar: p.cortar ?? 1, par: !!p.par, tracos: p.tracos || [], dobra: p.dobra || null,
        fio: p.fio || { a: { x: 0, y: 0 }, b: { x: 0, y: 100 } }, margem: p.margem ?? 10, margemTraco: p.margemTraco || {},
        piques: p.piques || [], pences: p.pences || [], visivel: p.visivel ?? true, travada: !!p.travada,
        rotacao: p.rotacao || '180', espelhar: !!p.espelhar, tubular: !!p.tubular, tecido: p.tecido || '', bainhas: p.bainhas || {}
      }))
    };
  }

  function tracoPts(m, t) {
    const P = id => m.pontos[id];
    if (t.tipo === 'reta') return [P(t.a), P(t.b)];
    if (t.tipo === 'curva') return G.bezier(P(t.a), t.c1, t.c2, P(t.b));
    if (t.tipo === 'circulo') return G.circulo(P(t.c), t.r);
    return t.pts;
  }
  const acha = (m, id) => m.tracos.find(t => t.id === id);
  const orientado = (m, { id, inv }) => (p => inv ? p.slice().reverse() : p)(tracoPts(m, acha(m, id)));

  // pence: V com a ponta para dentro (esquerda, no anti-horário), centrado em t do traço (t no sentido do traço)
  function comPences(linha, pences, inv) {
    for (const pc of pences) {
      const L = G.comprimento(linha), t = inv ? 1 - pc.t : pc.t, s1 = t * L - pc.abertura / 2, s2 = t * L + pc.abertura / 2;
      const meio = G.pontoEm(linha, t), ponta = { x: meio.p.x - meio.tangente.y * pc.profundidade, y: meio.p.y + meio.tangente.x * pc.profundidade };
      const antes = [], depois = [];
      let s = 0;
      linha.forEach((q, i) => { if (i) s += dist(linha[i - 1], q); if (s < s1 - 1e-6) antes.push(q); else if (s > s2 + 1e-6) depois.push(q); });
      linha = [...antes, G.pontoEm(linha, s1 / L).p, ponta, G.pontoEm(linha, s2 / L).p, ...depois];
    }
    return linha;
  }

  // polígono fechado do contorno; ids[i] = traço da aresta pts[i]→pts[i+1]
  function contorno(m, peca) {
    const pts = [], dono = [];
    for (const t of peca.tracos) {
      const p = comPences(orientado(m, t), (peca.pences || []).filter(pc => pc.tracoId === t.id), t.inv);
      for (let i = pts.length ? 1 : 0; i < p.length; i++) { pts.push(p[i]); dono.push(t.id); }
    }
    if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= TOL) pts.pop();
    // a aresta que chega em pts[i+1] é do traço que pôs esse ponto; a que fecha é do último traço
    const ult = peca.tracos.length ? peca.tracos[peca.tracos.length - 1].id : null;
    return { pts, ids: [...dono.slice(1, pts.length), ult] };
  }

  function encadear(m, ids) {
    if (!ids || !ids.length || ids.some(id => !acha(m, id))) return { ok: false, erro: 'Traço inexistente' };
    if (ids.length === 1 && acha(m, ids[0]).tipo === 'circulo') return { ok: true, tracos: [{ id: ids[0], inv: false }] };
    const resto = ids.slice(1), cad = [{ id: ids[0], inv: false }];
    const ini = orientado(m, cad[0])[0];
    let fim = orientado(m, cad[0]).slice(-1)[0];
    while (resto.length) {
      if (dist(fim, ini) <= TOL) return { ok: false, erro: 'O contorno fecha sem usar todos os traços', ponta: fim };
      const k = resto.findIndex(id => { const p = tracoPts(m, acha(m, id)); return dist(p[0], fim) <= TOL || dist(p[p.length - 1], fim) <= TOL; });
      if (k < 0) return { ok: false, erro: 'O contorno não fecha', ponta: fim };
      const id = resto.splice(k, 1)[0], p = tracoPts(m, acha(m, id)), inv = dist(p[0], fim) > TOL;
      cad.push({ id, inv });
      fim = inv ? p[0] : p[p.length - 1];
    }
    if (dist(fim, ini) > TOL) return { ok: false, erro: 'O contorno não fecha', ponta: fim };
    if (G.area(contorno(m, { tracos: cad }).pts) < 0) return { ok: true, tracos: cad.reverse().map(t => ({ id: t.id, inv: !t.inv })) };
    return { ok: true, tracos: cad };
  }

  function distSegPt(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  // abre a dobra espelhando a meia peça na aresta do traço reto; o espelho herda o traço de cada aresta
  function comDobra(peca, { pts, ids }) {
    const n = pts.length, i = ids.indexOf(peca.dobra.tracoId);
    if (i < 0 || ids.lastIndexOf(peca.dobra.tracoId) !== i) return { pts, ids }; // não é uma aresta reta inteira
    const a = pts[i], b = pts[(i + 1) % n];
    const meia = [...pts.slice(i + 1), ...pts.slice(0, i + 1)], im = [...ids.slice(i + 1), ...ids.slice(0, i)];
    const P = [...meia, ...G.espelhar(meia, a, b).reverse().slice(1, -1)], I = [...im, ...im.slice().reverse()];
    // as pontas da dobra somem quando o contorno a atravessa em linha reta (as duas arestas vizinhas são do mesmo traço)
    for (const k of [meia.length - 1, 0]) {
      const t = P.length, u = P[(k + t - 1) % t], w = P[(k + 1) % t];
      if (distSegPt(P[k], u, w) <= 1e-6) { P.splice(k, 1); I.splice(k, 1); }
    }
    return { pts: P, ids: I };
  }

  function marcado(m, peca) {
    const c = contorno(m, peca);
    return peca.dobra ? comDobra(peca, c) : c;
  }
  const costura = (m, peca) => marcado(m, peca).pts;
  function corte(m, peca) {
    const { pts, ids } = marcado(m, peca);
    return G.offset(pts, ids.map(id => peca.margemTraco[id] ?? peca.margem));
  }

  const tamanhos = m => m.grade && m.grade.length ? m.grade : [m.base || 'M'];
  const desloc = (m, id, tam) => (m.grad && m.grad[id] && m.grad[id][tam]) || { dx: 0, dy: 0 };
  const somar = (p, d) => ({ x: p.x + d.dx, y: p.y + d.dy });

  // cópia do molde no tamanho: cada ponto anda grad[id][tam]; c1 da curva anda com a, c2 com b
  function noTamanho(m, tam) {
    const c = structuredClone(m);
    for (const id in c.pontos) c.pontos[id] = somar(c.pontos[id], desloc(m, id, tam));
    for (const t of c.tracos) if (t.tipo === 'curva' && t.c1 && t.c2) { t.c1 = somar(t.c1, desloc(m, t.a, tam)); t.c2 = somar(t.c2, desloc(m, t.b, tam)); }
    return c;
  }

  // deslocamento por passo a partir do base; com salto, os passos que chegam em salto.de ou além valem o salto
  function graduarPasso(m, pontoId, dx, dy, opts = { salto: null }) {
    const tams = tamanhos(m), ib = tams.indexOf(m.base), s = opts && opts.salto, is = s ? tams.indexOf(s.de) : -1;
    const passo = j => s && is >= 0 && j >= is ? s : { dx, dy };
    const r = {};
    tams.forEach((tam, i) => {
      let x = 0, y = 0;
      for (let j = ib + 1; j <= i; j++) { x += passo(j).dx; y += passo(j).dy; }
      for (let j = i + 1; j <= ib; j++) { x -= passo(j).dx; y -= passo(j).dy; }
      r[tam] = { dx: x, dy: y };
    });
    m.grad[pontoId] = r;
  }
  function copiarRegra(m, de, para) {
    for (const id of para) if (m.grad[de]) m.grad[id] = structuredClone(m.grad[de]); else delete m.grad[id];
  }
  const removerGradacao = m => { m.grad = {}; };

  // cada tamanho ≠ base vira cópia das peças visíveis, à direita do molde; depois a gradação some
  function separarTamanhos(m, espaco = 50) {
    const tams = tamanhos(m).filter(t => t !== m.base), pecas = m.pecas.filter(p => p.visivel !== false);
    const bb = G.bbox(tamanhos(m).flatMap(tam => { const c = noTamanho(m, tam); return c.tracos.flatMap(t => tracoPts(c, t)); }));
    tams.forEach((tam, k) => {
      const c = noTamanho(m, tam), d = { dx: (k + 1) * (bb.w + espaco), dy: 0 }, pid = {}, tid = {};
      const ponto = id => { if (!pid[id]) { pid[id] = uid(m, 'p'); m.pontos[pid[id]] = somar(c.pontos[id], d); } return pid[id]; };
      for (const peca of pecas) {
        for (const { id } of peca.tracos) {
          const t0 = c.tracos.find(x => x.id === id);
          if (tid[id] || !t0) continue;
          const t = structuredClone(t0);
          for (const q of ['a', 'b', 'c']) if (t[q]) t[q] = ponto(t[q]);
          for (const q of ['c1', 'c2']) if (t[q]) t[q] = somar(t[q], d);
          if (t.pts) t.pts = t.pts.map(p => somar(p, d));
          t.id = tid[id] = uid(m, 't');
          m.tracos.push(t);
        }
        const n = structuredClone(peca), novoId = id => tid[id] || id;
        const chaves = o => Object.fromEntries(Object.entries(o || {}).map(([id, v]) => [novoId(id), v]));
        const comTraco = l => (l || []).map(x => ({ ...x, tracoId: novoId(x.tracoId) }));
        Object.assign(n, { id: uid(m, 'pc'), tam, nome: peca.nome + ' · ' + tam, tracos: peca.tracos.map(t => ({ ...t, id: novoId(t.id) })),
          fio: n.fio && { a: somar(n.fio.a, d), b: somar(n.fio.b, d) }, dobra: n.dobra && { ...n.dobra, tracoId: novoId(n.dobra.tracoId) },
          margemTraco: chaves(n.margemTraco), bainhas: chaves(n.bainhas), piques: comTraco(n.piques), pences: comTraco(n.pences) });
        m.pecas.push(n);
      }
    });
    for (const peca of pecas) peca.tam = m.base; // molParaProduto põe em porTam[t] só as peças de tam t (e as sem tam)
    removerGradacao(m);
  }

  function medir(m, ids, tam) {
    const c = noTamanho(m, tam);
    return ids.reduce((s, id) => { const t = acha(c, id); return s + (!t ? 0 : t.tipo === 'circulo' ? 2 * Math.PI * t.r : G.comprimento(tracoPts(c, t))); }, 0);
  }

  function aplicarBainha(peca, tracoId, { largura, dobras, piques }) {
    peca.bainhas = peca.bainhas || {}; peca.margemTraco = peca.margemTraco || {};
    if (!(largura > 0)) { delete peca.bainhas[tracoId]; delete peca.margemTraco[tracoId]; return; }
    peca.bainhas[tracoId] = { largura, dobras, piques };
    peca.margemTraco[tracoId] = largura * dobras;
  }

  // peça de p.mol num molde já no tamanho (null se quebrada); fio no eixo X, que é o comprimento do risco no encaixe (index.html)
  function pecaProduto(m, peca) {
    if (!peca) return null;
    const { a, b } = peca.fio, ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    // peça quebrada (traço ou ponto apagado, contorno que não fecha mais) fica fora, sem impedir o resto de salvar
    let c = null;
    try { if (encadear(m, peca.tracos.map(t => t.id)).ok) c = G.girar(corte(m, peca), { x: 0, y: 0 }, -ang); } catch (e) { c = null; }
    if (!c || c.length < 3 || !c.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
    const bx = G.bbox(c);
    const pts = c.map(p => [Math.round(p.x - bx.x0), Math.round(p.y - bx.y0)]);
    return { w: Math.max(...pts.map(p => p[0])), h: Math.max(...pts.map(p => p[1])), qtd: peca.cortar * (peca.par ? 2 : 1), pts, rot: peca.rotacao, tecido: peca.tecido,
      nome: peca.nome, par: peca.par, espelhar: peca.espelhar, tubular: peca.tubular }; // par/espelhar/tubular: regras da ordem de corte (molde/ordem.js)
  }
  // formato de p.mol; pecas = tamanho base, porTam = uma lista por tamanho (só as peças sem tam ou com tam = o tamanho).
  // peça boa no base que quebra num tamanho (ex.: traço lápis não acompanha a gradação) vai com a forma do base e entra em avisos
  function molParaProduto(m) {
    const n = normalizar(m), porTam = {}, avisos = [];
    const vis = n.pecas.filter(p => p.visivel && p.tracos.length), nb = noTamanho(n, n.base);
    const doBase = Object.fromEntries(vis.map(p => [p.id, pecaProduto(nb, p)]));
    for (const tam of tamanhos(n)) {
      const c = tam === n.base ? nb : noTamanho(n, tam);
      porTam[tam] = [];
      for (const p of vis) {
        if (p.tam && p.tam !== tam) continue;
        let r = tam === n.base ? doBase[p.id] : pecaProduto(c, c.pecas.find(x => x.id === p.id));
        if (!r && doBase[p.id]) { r = doBase[p.id]; avisos.push({ peca: p.nome, tam }); }
        if (r) porTam[tam].push(r);
      }
    }
    return { arq: 'Molde: ' + (m.nome || ''), un: 'mm', origem: 'editor', pecas: porTam[n.base] || [], porTam, avisos };
  }

  function historico(limite = 100) {
    let pilha = [], i = -1;
    return {
      gravar(m) { pilha = pilha.slice(0, i + 1); pilha.push(structuredClone(m)); if (pilha.length > limite) pilha.shift(); i = pilha.length - 1; },
      desfazer: () => i > 0 ? structuredClone(pilha[--i]) : null,
      refazer: () => i < pilha.length - 1 ? structuredClone(pilha[++i]) : null
    };
  }

  const MoldeModelo = { GRADES, novo, normalizar, uid, tracoPts, encadear, costura, corte, tamanhos, noTamanho, graduarPasso, copiarRegra,
    removerGradacao, separarTamanhos, medir, aplicarBainha, molParaProduto, historico };
  g.MoldeModelo = MoldeModelo;
  if (typeof module !== 'undefined') module.exports = MoldeModelo;
})(typeof window !== 'undefined' ? window : globalThis);
