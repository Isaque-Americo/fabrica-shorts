// Regra da ordem de corte (lógica pura): grade dos pedidos, peças de cada enfesto com as regras do tecido
// (tubular, sentido, sentido único, encolhimento, espelhar), encaixe e resultados (pesos, custo, consumo, grade).
// mm internamente; tecido.larg em m, gram em g/m². X = comprimento do risco, Y = largura do tecido.
(function (g) {
  const E = g.MoldeEncaixe || (typeof require !== 'undefined' ? require('./encaixe.js') : null);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const num = v => Number.isFinite(+v) ? +v : 0;
  const nn = v => Math.max(0, Math.round(num(v)));

  // R$/m do tecido, igual a matCusto do index.html para tipo 'tecido'
  const matCusto = m => !m ? 0 : m.cobr === 'mt' ? num(m.preco) : num(m.rend) > 0 ? num(m.preco) / num(m.rend) : 0;

  function normEnfesto(e, i) {
    e = e || {};
    return {
      id: e.id || uid(), nome: e.nome || 'Enfesto ' + (i + 1), tecidoId: e.tecidoId || '',
      camadas: Math.max(1, nn(e.camadas)), alturaMax: nn(e.alturaMax), compMax: Math.max(0, num(e.compMax)),
      cabeceira: Math.max(0, num(e.cabeceira)), ourelaE: Math.max(0, num(e.ourelaE)), ourelaD: Math.max(0, num(e.ourelaD)),
      sentido: e.sentido === 'unico' ? 'unico' : 'duplo',
      itens: (e.itens || []).map(it => ({
        produtoId: (it && it.produtoId) || '', cor: (it && it.cor) || '',
        pecas: it && Array.isArray(it.pecas) ? it.pecas.map(String) : null,
        grade: Object.fromEntries(Object.entries((it && it.grade) || {}).map(([t, q]) => [t, nn(q)])),
        falta: Object.fromEntries(Object.entries((it && it.falta) || {}).map(([t, q]) => [t, nn(q)])) // pedido que veio do Fabricar
      }))
    };
  }

  function normalizar(doc) {
    const d = doc || {};
    return {
      ...d, nome: d.nome || '', obs: d.obs || '', criadaEm: d.criadaEm || '',
      pedidos: Array.isArray(d.pedidos) ? d.pedidos.map(String) : [],
      tecidos: (d.tecidos || []).map(t => ({ id: (t && t.id) || uid(), materiaId: (t && t.materiaId) || '' })),
      pedidoId: d.pedidoId || '', pedidoNum: d.pedidoNum ?? null, refs: Array.isArray(d.refs) ? d.refs.map(String) : [],
      enfestos: (d.enfestos || []).map(normEnfesto), v: 1
    };
  }

  function nova(nome) {
    const t = { id: uid(), materiaId: '' };
    return normalizar({ nome: nome || '', criadaEm: new Date().toISOString(), tecidos: [t], enfestos: [{ tecidoId: t.id }] });
  }

  // lista = fabricarLista() do index.html; opts.produtos dá o tecido principal (p.tecidoId) de cada produto.
  // começa com camadas 1 e grade por camada = f (o usuário ajusta); as camadas do Fabricar ficam como alturaMax sugerida; falta = f pedido
  function deFabricar(lista, opts) {
    const o = opts || {}, prods = o.produtos || [];
    const ordem = nova(''), tecidos = [], enfestos = [], gr = o.grupos;
    for (const l of lista || []) {
      const f = nn(l.f); if (!f || !l.id) continue;
      const p = prods.find(x => x.id === l.id), mat = (p && p.tecidoId) || '';
      // peças de outro tecido (forro…) ganham aba e enfesto próprios; pecasEnfesto já tira cada peça das abas que não são o tecido dela
      const outros = [...new Set(pecasTam(p, l.t).map(q => q && q.tecido).filter(t => t && t !== mat))];
      for (const m of [mat, ...outros]) {
        const k = m + '|' + (gr ? gr[l.id] ?? 0 : 0); // grupos (pedido detalhado): um enfesto por tecido e grupo, nunca junta tecidos
        let enf = enfestos.find(e => e.k === k);
        if (!enf) {
          let t = tecidos.find(x => x.materiaId === m); if (!t) tecidos.push(t = { id: uid(), materiaId: m });
          const n = enfestos.filter(e => e.mat === m).length + 1;
          enf = { k, mat: m, e: { ...(gr && { nome: 'Enfesto ' + n }), tecidoId: t.id, camadas: 1, alturaMax: o.camadas, compMax: o.compMax, itens: [] } }; enfestos.push(enf);
        }
        let it = enf.e.itens.find(x => x.produtoId === l.id && x.cor === (l.c || ''));
        if (!it) enf.e.itens.push(it = { produtoId: l.id, cor: l.c || '', pecas: null, grade: {}, falta: {} });
        it.grade[l.t] = it.falta[l.t] = (it.grade[l.t] || 0) + f;
      }
    }
    return normalizar({ ...ordem, tecidos: tecidos.length ? tecidos : ordem.tecidos, enfestos: enfestos.length ? enfestos.map(x => x.e) : ordem.enfestos });
  }

  // pedido aprovado -> ordem: cada pedido vira a sua ordem. opts.grupos {prodId: n} separa enfestos do mesmo tecido
  function dePedido(pedido, opts) {
    const o = opts || {}, prods = o.produtos || [];
    const lista = (pedido.itens || []).map(i => ({ id: i.prodId, c: i.cor, t: i.tam, f: i.qtd }));
    const refs = [...new Set((pedido.itens || []).map(i => (prods.find(p => p.id === i.prodId) || {}).ref).filter(Boolean))].sort();
    return normalizar({ ...deFabricar(lista, o), pedidoId: pedido.id, pedidoNum: pedido.numero, nome: 'Pedido #' + pedido.numero, refs });
  }

  // refs (ou prodId, se o produto não existe) dos produtos do pedido com algum tamanho sem peças no molde
  function semMolde(pedido, produtos) {
    const out = new Set();
    for (const i of pedido.itens || []) {
      const p = (produtos || []).find(x => x.id === i.prodId);
      if (!pecasTam(p, i.tam).length) out.add(p ? p.ref || p.nome || p.id : i.prodId);
    }
    return [...out];
  }

  function ajustarGrade(item, tam, delta) {
    item.grade = item.grade || {};
    return (item.grade[tam] = Math.max(0, nn(item.grade[tam]) + Math.round(num(delta))));
  }

  const areaPol = pts => Math.abs(pts.reduce((a, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return a + x * y2 - x2 * y; }, 0)) / 2;
  // meia peça para a dobra do tubular: corta na linha do meio ao longo de X (y = h/2), fica com a metade de baixo
  // e vira em Y para a linha do corte (a dobra) ficar em y = 0, encostada na borda Y=0 do tecido
  function meiaPeca(pts) {
    const ys = pts.map(p => p[1]), c = (Math.min(...ys) + Math.max(...ys)) / 2, out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = a[1] <= c, ib = b[1] <= c;
      if (ia) out.push(a);
      if (ia !== ib) out.push([a[0] + (b[0] - a[0]) * (c - a[1]) / (b[1] - a[1]), c]);
    }
    return out.map(([x, y]) => [x, c - y]);
  }

  // peças de um tamanho: porTam[tam], senão a base (produto antigo)
  const pecasTam = (p, tam) => { const m = p && p.mol; if (!m) return []; return (m.porTam && m.porTam[tam] && m.porTam[tam].length ? m.porTam[tam] : m.pecas) || []; };
  const contexto = (enf, ordem, tecidos) => {
    const aba = (ordem.tecidos || []).find(t => t.id === enf.tecidoId);
    return { aba, mat: aba && (tecidos || []).find(m => m.id === aba.materiaId) };
  };
  // tecido principal do produto na ordem: o da aba com p.tecidoId, senão o da aba [0]
  const principalDe = (p, ordem) => { const abas = (ordem.tecidos || []).map(t => t.materiaId); return abas.includes(p.tecidoId) ? p.tecidoId : abas[0]; };

  // itens para MoldeEncaixe.encaixar, um por posição no risco. Cada item leva o que o desenho precisa:
  // {pecaIdx (índice em porTam[tam]/pecas), rasters, borda0, a, produtoId, cor, tam, nome, pts (já meia/espelhada),
  //  rot, espelhar, escala, espelho, meia, rende (peças cortadas por posição e camada), area (mm², já com escala)}.
  // rasters = variantes(pts, {rot, espelhar, escala}). Seleção `pecas`: pelo nome da peça; sem nome, pelo índice ('0', '1'…)
  function pecasEnfesto(enf, ordem, produtos, tecidos) {
    const { aba, mat } = contexto(enf, ordem, tecidos); if (!aba) return [];
    const tub = !!(mat && mat.tubular), su = !!(mat && mat.sentidoUnico), unico = enf.sentido === 'unico', impar = Math.max(1, nn(enf.camadas)) % 2 === 1;
    const escala = { x: 1 + num(mat && mat.encolhC) / 100, y: 1 + num(mat && mat.encolhL) / 100 };
    const cache = new Map(), itens = [], avisos = [];
    const item = (base, pts, o) => {
      const k = base.q; if (!cache.has(k)) cache.set(k, new Map());
      const ck = o.rot + '|' + o.espelhar + '|' + o.espelho + '|' + o.meia, cc = cache.get(k);
      if (!cc.has(ck)) cc.set(ck, { rasters: E.variantes(pts, { rot: o.rot, espelhar: o.espelhar, escala }), area: areaPol(pts) * escala.x * escala.y });
      const { rasters, area } = cc.get(ck);
      return { pecaIdx: base.k, rasters, borda0: !!o.meia, a: area, produtoId: base.p.id, cor: base.cor, tam: base.tam, nome: base.nome,
        pts, rot: o.rot, espelhar: o.espelhar, escala, espelho: !!o.espelho, meia: !!o.meia, rende: o.rende, area };
    };
    const repete = (n, f) => { for (let i = 0; i < n; i++) itens.push(f()); };
    for (const it of enf.itens || []) {
      const p = (produtos || []).find(x => x.id === it.produtoId); if (!p) continue;
      const principal = principalDe(p, ordem); // peça sem tecido vai na aba do principal
      for (const [tam, gq] of Object.entries(it.grade || {})) {
        const gr = nn(gq); if (!gr) continue;
        pecasTam(p, tam).forEach((q, k) => {
          if (!(q && q.pts && q.pts.length > 2) || (q.tecido || principal) !== aba.materiaId) return;
          const nome = q.nome || String(k);
          if (it.pecas && !it.pecas.includes(nome)) return;
          const base = { q, k, p, cor: it.cor, tam, nome }, qtd = nn(q.qtd), N = gr * qtd;
          const rot = su ? 'nenhuma' : q.rot, esp = !!q.espelhar;
          if (tub && q.tubular) { const m = meiaPeca(q.pts); repete(N, () => item(base, m, { rot: 'nenhuma', espelhar: false, meia: true, rende: 1 })); } // girar/espelhar tiraria a dobra de Y=0
          else if (tub) repete(Math.ceil(N / 2), () => item(base, q.pts, { rot, espelhar: esp, rende: 2 })); // dois panos por camada
          else if (q.par && !unico && !(impar && esp)) repete(N, () => item(base, q.pts, { rot, espelhar: false, rende: 1 })); // face a face: metade das camadas já sai espelhada
          else if (q.par) { // único, ou duplo com camadas ímpares (a camada a mais ficaria sem o par)
            const n = gr * Math.ceil(qtd / 2), espelhada = esp ? q.pts.map(([x, y]) => [x, -y]) : q.pts;
            if (!esp) avisos.push({ peca: nome, tam, motivo: 'par sem espelhar no sentido único' });
            else if (!unico) avisos.push({ peca: nome, tam, motivo: 'camadas ímpares no sentido duplo: pares gerados espelhados' });
            repete(n, () => item(base, q.pts, { rot, espelhar: false, rende: 1 }));
            repete(n, () => item(base, espelhada, { rot, espelhar: false, espelho: esp, rende: 1 }));
          } else repete(N, () => item(base, q.pts, { rot, espelhar: esp, rende: 1 }));
        });
      }
    }
    itens.avisos = avisos; // [{peca, tam, motivo}] como propriedade: a lista continua indo direto para encaixar
    return itens;
  }

  // posições em mm a partir do início do encaixe (sem ourela E); comp inclui a cabeceira. null: sem peças, sem tecido ou peça mais larga que o tecido
  function calcularEnfesto(enf, ordem, produtos, tecidos) {
    const { aba, mat } = contexto(enf, ordem, tecidos); if (!mat) return null;
    const largUtil = num(mat.larg) * 1000 - (mat.tubular ? 0 : num(enf.ourelaE) + num(enf.ourelaD)); // tubular não tem ourela: a dobra fica na borda real
    const itens = pecasEnfesto(enf, ordem, produtos, tecidos), r = E.encaixar(itens, largUtil);
    if (!r) return null;
    const comp = r.comp + num(enf.cabeceira), areaPecas = itens.reduce((a, x) => a + x.area, 0), grade = {};
    for (const it of enf.itens || []) {
      const p = (produtos || []).find(x => x.id === it.produtoId);
      if (!p || principalDe(p, ordem) !== aba.materiaId) continue; // a roupa conta só no enfesto do tecido principal; forro etc. não repetem
      const gr = grade[p.ref || p.id] = grade[p.ref || p.id] || {};
      for (const [t, q] of Object.entries(it.grade || {})) {
        const q0 = pecasTam(p, t)[0]; // peças divididas entre enfestos: a roupa conta só no item que leva a peça 0
        if (nn(q) && (!it.pecas || (q0 && it.pecas.includes(q0.nome || '0')))) gr[t] = (gr[t] || 0) + nn(q);
      }
    }
    return { comp, largUtil, posicoes: r.posicoes, itens, pecasTotal: itens.reduce((a, x) => a + x.rende, 0), areaPecas,
      aproveitamento: comp > 0 && largUtil > 0 ? areaPecas / (comp * largUtil) : 0, grade, avisos: itens.avisos };
  }

  // calculos[k] = calcularEnfesto de ordem.enfestos[k] (null = fica fora). Pesos em kg; tubular conta os dois panos
  // (peças cortadas = posições × camadas × (tubular ? 2 : 1); a meia peça da dobra abre numa peça inteira, rende 1).
  // pecas = peças de roupa (soma da grade, contada só no tecido principal de cada produto);
  // consumoLinear = metros dos enfestos que contam roupa (tecido principal) ÷ peças de roupa
  function resultados(ordem, calculos, tecidos) {
    const r = { metros: 0, pesoTecido: 0, pesoPecas: 0, pesoDesperdicio: 0, consumoLinear: 0, custo: 0, pecas: 0, grade: {} };
    let mPrincipal = 0;
    (ordem.enfestos || []).forEach((enf, k) => {
      const c = (calculos || [])[k]; if (!c) return;
      const { mat } = contexto(enf, ordem, tecidos), cam = Math.max(1, nn(enf.camadas)), m = c.comp / 1000 * cam;
      const kgm2 = num(mat && mat.gram) / 1000 * (mat && mat.tubular ? 2 : 1);
      r.metros += m; r.custo += m * matCusto(mat);
      r.pesoTecido += m * num(mat && mat.larg) * kgm2;
      r.pesoPecas += num(c.areaPecas) / 1e6 * cam * kgm2;
      if (Object.keys(c.grade || {}).length) mPrincipal += m;
      for (const [ref, gt] of Object.entries(c.grade || {})) for (const [t, q] of Object.entries(gt)) {
        const gr = r.grade[ref] = r.grade[ref] || {};
        gr[t] = (gr[t] || 0) + q * cam; r.pecas += q * cam;
      }
    });
    r.pesoDesperdicio = r.pesoTecido - r.pesoPecas;
    r.consumoLinear = r.pecas ? mPrincipal / r.pecas : 0;
    return r;
  }

  // consumo sugerido no formulário do produto (m por peça): risco de uma peça de cada tamanho presente em porTam,
  // com as regras do tecido (largura útil = larg sem ourela, encolhimento, sentido único, tubular) ÷ peças de roupa.
  // {cons (P–GG), consG (G1–G4)}, cada um null se não houver tamanho; null se nenhum
  function consumoPeloMolde(p, mat) {
    const pt = p && p.mol && p.mol.porTam; if (!pt || !mat || !(num(mat.larg) > 0)) return null;
    const tecidos = [{ ...mat, id: mat.id || 'm' }], ordem = { tecidos: [{ id: 't', materiaId: tecidos[0].id }] };
    const por = tams => {
      tams = tams.filter(t => pt[t] && pt[t].length); if (!tams.length) return null;
      const n = mat.tubular ? 2 : 1; // tubular: cada posição rende 2, então pede 2 de cada para não arredondar para cima
      const enf = normEnfesto({ tecidoId: 't', itens: [{ produtoId: 'p', pecas: null, grade: Object.fromEntries(tams.map(t => [t, n])) }] }, 0);
      const c = calcularEnfesto(enf, ordem, [{ ...p, id: 'p' }], tecidos); // produto novo ainda não tem id
      return c && c.comp > 0 ? c.comp / 1000 / (tams.length * n) : null;
    };
    const cons = por(['P', 'M', 'G', 'GG']), consG = por(['G1', 'G2', 'G3', 'G4']);
    return cons == null && consG == null ? null : { cons, consG };
  }

  const MoldeOrdem = { normalizar, nova, deFabricar, dePedido, semMolde, ajustarGrade, pecasEnfesto, calcularEnfesto, resultados, matCusto, meiaPeca, consumoPeloMolde };
  g.MoldeOrdem = MoldeOrdem;
  if (typeof module !== 'undefined') module.exports = MoldeOrdem;
})(typeof window !== 'undefined' ? window : globalThis);
