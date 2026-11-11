// Modelo de dados do molde (doc da coleção `moldes`). Medidas em mm.
(function (g) {
  const G = typeof module !== 'undefined' ? require('./geo.js') : g.MoldeGeo;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const TOL = 0.5; // folga entre pontas de traços encadeados

  const novo = nome => normalizar({ nome });

  // doc antigo/parcial: todo campo ausente ganha padrão; campos desconhecidos ficam
  function normalizar(doc) {
    const d = doc || {};
    return {
      ...d, nome: d.nome || '', produtoIds: d.produtoIds || [], base: d.base || 'M',
      pontos: d.pontos || {}, tracos: d.tracos || [], textos: d.textos || [], v: d.v || 1,
      pecas: (d.pecas || []).map(p => ({
        ...p, nome: p.nome || '', cortar: p.cortar ?? 1, par: !!p.par, tracos: p.tracos || [], dobra: p.dobra || null,
        fio: p.fio || { a: { x: 0, y: 0 }, b: { x: 0, y: 100 } }, margem: p.margem ?? 10, margemTraco: p.margemTraco || {},
        piques: p.piques || [], pences: p.pences || [], visivel: p.visivel ?? true, travada: !!p.travada
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

  // formato de p.mol; fio no eixo X, que é o comprimento do risco no encaixe (index.html)
  function molParaProduto(m) {
    const pecas = [];
    for (const peca of normalizar(m).pecas) {
      if (!peca.visivel || !peca.tracos.length) continue;
      const { a, b } = peca.fio, ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      // peça quebrada (traço ou ponto apagado, contorno que não fecha mais) fica fora, sem impedir o resto de salvar
      let c = null;
      try { if (encadear(m, peca.tracos.map(t => t.id)).ok) c = G.girar(corte(m, peca), { x: 0, y: 0 }, -ang); } catch (e) { c = null; }
      if (!c || c.length < 3 || !c.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
      const bx = G.bbox(c);
      const pts = c.map(p => [Math.round(p.x - bx.x0), Math.round(p.y - bx.y0)]);
      pecas.push({ w: Math.max(...pts.map(p => p[0])), h: Math.max(...pts.map(p => p[1])), qtd: peca.cortar * (peca.par ? 2 : 1), pts });
    }
    return { arq: 'Molde: ' + (m.nome || ''), un: 'mm', origem: 'editor', pecas };
  }

  function historico(limite = 100) {
    let pilha = [], i = -1;
    return {
      gravar(m) { pilha = pilha.slice(0, i + 1); pilha.push(structuredClone(m)); if (pilha.length > limite) pilha.shift(); i = pilha.length - 1; },
      desfazer: () => i > 0 ? structuredClone(pilha[--i]) : null,
      refazer: () => i < pilha.length - 1 ? structuredClone(pilha[++i]) : null
    };
  }

  const MoldeModelo = { novo, normalizar, tracoPts, encadear, costura, corte, molParaProduto, historico };
  g.MoldeModelo = MoldeModelo;
  if (typeof module !== 'undefined') module.exports = MoldeModelo;
})(typeof window !== 'undefined' ? window : globalThis);
