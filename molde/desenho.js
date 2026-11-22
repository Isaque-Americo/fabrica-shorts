// Ferramentas de desenho do diagrama (lógica pura, sem DOM). Medidas em mm.
// Tela SVG com y para baixo: ângulos e giros aqui são no sentido anti-horário NA TELA (90° = para cima).
(function (g) {
  const G = typeof module !== 'undefined' ? require('./geo.js') : g.MoldeGeo;
  const MM = typeof module !== 'undefined' ? require('./modelo.js') : g.MoldeModelo;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const PERTO = 1e-4; // mm: ponto nessa distância é o mesmo ponto (fecha contorno digitado)

  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  }

  // "11,5;90" → [11.5, 90]; vírgula ou ponto decimal; null se vazio ou inválido
  function medida(txt) {
    const v = String(txt ?? '').split(';').map(s => s.trim().replace(',', '.'));
    if (v.length > 1 && v[v.length - 1] === '') v.pop();
    if (v.some(s => s === '' || !Number.isFinite(Number(s)))) return null;
    return v.map(Number);
  }
  const cm = mm => (mm / 10).toFixed(1).replace('.', ',');
  const polar = (a, mm, graus) => { const r = graus * Math.PI / 180; return { x: a.x + mm * Math.cos(r), y: a.y - mm * Math.sin(r) }; };
  const angulo = (a, b) => Math.atan2(a.y - b.y, b.x - a.x) * 180 / Math.PI;
  // Shift na reta: joga p em cima do raio que sai de a no ângulo travado, só mudando o comprimento (t < 0 cai do outro lado da mesma linha)
  const noRaio = (a, graus, p) => { const r = graus * Math.PI / 180, ux = Math.cos(r), uy = -Math.sin(r), t = (p.x - a.x) * ux + (p.y - a.y) * uy; return { x: a.x + t * ux, y: a.y + t * uy }; };

  // Douglas-Peucker: tira os pontos a ≤ tol da corda
  function simplificar(pts, tol) {
    if (pts.length < 3) return pts.slice();
    const a = pts[0], b = pts[pts.length - 1];
    let mi = 0, md = -1;
    for (let i = 1; i < pts.length - 1; i++) { const d = distSeg(pts[i], a, b); if (d > md) { md = d; mi = i; } }
    if (md <= tol) return [a, b];
    return [...simplificar(pts.slice(0, mi + 1), tol).slice(0, -1), ...simplificar(pts.slice(mi), tol)];
  }

  const uid = MM.uid;
  // id do ponto em p: reaproveita o que já está ali (ímã devolve as coordenadas exatas do ponto)
  function ponto(m, p) {
    for (const [id, q] of Object.entries(m.pontos)) if (dist(p, q) <= PERTO) return id;
    const id = uid(m, 'p');
    m.pontos[id] = { x: p.x, y: p.y };
    return id;
  }
  const usados = m => new Set(m.tracos.flatMap(t => [t.a, t.b, t.c].filter(Boolean)));
  function reta(m, a, b) { const id = uid(m, 't'); m.tracos.push({ id, tipo: 'reta', a, b }); return id; }

  // dois cantos opostos → 4 retas
  function retangulo(m, A, B) {
    if (Math.abs(B.x - A.x) < PERTO || Math.abs(B.y - A.y) < PERTO) return { erro: 'Retângulo sem largura ou altura.' };
    const c = [A, { x: B.x, y: A.y }, B, { x: A.x, y: B.y }].map(p => ponto(m, p));
    return { ids: c.map((id, i) => reta(m, id, c[(i + 1) % 4])) };
  }

  const pts = (m, t) => { const p = MM.tracoPts(m, t); return t.tipo === 'circulo' ? [...p, p[0]] : p; };
  const segs = (m, t) => { const p = pts(m, t); return p.slice(1).map((q, i) => [p[i], q]); };
  const medir = (m, ids) => m.tracos.filter(t => ids.includes(t.id)).reduce((s, t) => s + (t.tipo === 'circulo' ? 2 * Math.PI * t.r : G.comprimento(MM.tracoPts(m, t))), 0);

  // traços, pontos soltos e textos inteiros dentro da caixa a–b
  function naCaixa(m, a, b) {
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    const den = p => p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1, u = usados(m);
    return [
      ...m.tracos.filter(t => (t.tipo === 'circulo' ? G.circulo(m.pontos[t.c], t.r, 1) : MM.tracoPts(m, t)).every(den)).map(t => t.id),
      ...Object.keys(m.pontos).filter(id => !u.has(id) && den(m.pontos[id])),
      ...m.textos.filter(den).map(x => x.id)
    ];
  }

  // objetos {x,y} que mudam ao mover/girar a seleção (pontos compartilhados vão junto: o contorno continua ligado)
  function alvos(m, ids) {
    const s = new Set(ids), out = new Set();
    for (const t of m.tracos) if (s.has(t.id)) {
      for (const k of ['a', 'b', 'c']) if (t[k] && m.pontos[t[k]]) out.add(m.pontos[t[k]]);
      for (const k of ['c1', 'c2']) if (t[k]) out.add(t[k]);
      (t.pts || []).forEach(p => out.add(p));
    }
    for (const id of ids) if (m.pontos[id]) out.add(m.pontos[id]);
    for (const x of m.textos) if (s.has(x.id)) out.add(x);
    return [...out];
  }
  function transformar(m, ids, f) { const a = alvos(m, ids), n = f(a); a.forEach((p, i) => { p.x = n[i].x; p.y = n[i].y; }); }
  // positivo = anti-horário na tela (geo.girar é anti-horário com y para cima)
  function girar(m, ids, graus) {
    const a = alvos(m, ids);
    if (!a.length) return { erro: 'Selecione o que girar.' };
    const b = G.bbox(a);
    transformar(m, ids, p => G.girar(p, { x: b.x0 + b.w / 2, y: b.y0 + b.h / 2 }, -graus));
    return { ids };
  }

  function apagar(m, ids) {
    const s = new Set(ids), soltos = new Set();
    m.tracos.forEach(t => { if (s.has(t.id)) [t.a, t.b, t.c].forEach(p => p && soltos.add(p)); });
    m.tracos = m.tracos.filter(t => !s.has(t.id));
    m.textos = m.textos.filter(x => !s.has(x.id));
    const u = usados(m);
    for (const id of [...soltos, ...ids]) if (m.pontos[id] && !u.has(id)) delete m.pontos[id];
    return { ids: [] };
  }

  const retasDe = (m, ids) => m.tracos.filter(t => ids.includes(t.id) && t.tipo === 'reta');

  // caminho de traços entre dois pontos, o mais curto em comprimento (Dijkstra; num contorno fechado dá o lado curto)
  function caminhoEntre(m, a, b) {
    const viz = {};
    for (const t of m.tracos) {
      if (!t.a || !t.b || t.a === t.b || !m.pontos[t.a] || !m.pontos[t.b]) continue;
      const c = G.comprimento(MM.tracoPts(m, t)) || PERTO;
      (viz[t.a] = viz[t.a] || []).push([t.b, t.id, c]);
      (viz[t.b] = viz[t.b] || []).push([t.a, t.id, c]);
    }
    const d = { [a]: 0 }, de = {}, feito = new Set();
    for (;;) {
      let p = null;
      for (const k of Object.keys(d)) if (!feito.has(k) && (p === null || d[k] < d[p])) p = k;
      if (p === null || p === b) break;
      feito.add(p);
      for (const [q, id, c] of viz[p] || []) if (d[q] === undefined || d[p] + c < d[q]) { d[q] = d[p] + c; de[q] = { p, id }; }
    }
    if (!de[b]) return null;
    const ids = [];
    for (let p = b; de[p]; p = de[p].p) ids.push(de[p].id);
    return ids;
  }

  // pontos do caminho tr, em ordem, começando no ponto a
  function linhaDe(m, tr, a) {
    const resto = tr.map(id => m.tracos.find(t => t.id === id)), out = [m.pontos[a]];
    let p = a;
    while (resto.length) {
      const k = resto.findIndex(t => t.a === p || t.b === p);
      if (k < 0) break;
      const t = resto.splice(k, 1)[0], inv = t.b === p, q = MM.tracoPts(m, t);
      out.push(...(inv ? q.slice().reverse() : q).slice(1));
      p = inv ? t.a : t.b;
    }
    return out;
  }

  // direção da linha na ponta i (0 = começo, 1 = fim), olhando 10% do comprimento adiante: ponta a ponta o traço digitalizado treme
  function tangente(linha, fim) {
    const q = fim ? linha.slice().reverse() : linha, L = G.comprimento(q) * 0.1;
    let s = 0, j = 1;
    while (j < q.length - 1 && s < L) { s += dist(q[j - 1], q[j]); j++; }
    const v = { x: q[j].x - q[0].x, y: q[j].y - q[0].y }, n = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / n, y: v.y / n };
  }

  // alças de uma Bézier ajustada à linha, com as direções t1 e t2 dadas nas pontas:
  // o tamanho sai por mínimos quadrados sobre os pontos da linha (Graphics Gems, generateBezier)
  function alcas(linha, t1, t2) {
    const P0 = linha[0], P3 = linha[linha.length - 1], corda = dist(P0, P3);
    let s = 0;
    const L = G.comprimento(linha) || 1, u = linha.map((p, i) => (i ? s += dist(linha[i - 1], p) : 0, s / L));
    let c11 = 0, c12 = 0, c22 = 0, x1 = 0, x2 = 0;
    linha.forEach((p, i) => {
      const t = u[i], w = 1 - t, b0 = w * w * w, b1 = 3 * t * w * w, b2 = 3 * t * t * w, b3 = t * t * t;
      const a1 = { x: t1.x * b1, y: t1.y * b1 }, a2 = { x: t2.x * b2, y: t2.y * b2 };
      const d = { x: p.x - (P0.x * (b0 + b1) + P3.x * (b2 + b3)), y: p.y - (P0.y * (b0 + b1) + P3.y * (b2 + b3)) };
      c11 += a1.x * a1.x + a1.y * a1.y; c12 += a1.x * a2.x + a1.y * a2.y; c22 += a2.x * a2.x + a2.y * a2.y;
      x1 += d.x * a1.x + d.y * a1.y; x2 += d.x * a2.x + d.y * a2.y;
    });
    const det = c11 * c22 - c12 * c12;
    let al1 = det ? (x1 * c22 - c12 * x2) / det : 0, al2 = det ? (c11 * x2 - x1 * c12) / det : 0;
    // alça negativa ou exagerada = ajuste ruim (linha quase reta, ou que volta por cima de si): cai no padrão de 1/3 da corda
    const mau = v => !Number.isFinite(v) || v <= corda * 1e-3 || v > corda * 3;
    if (mau(al1) || mau(al2)) al1 = al2 = corda / 3;
    return { c1: { x: P0.x + t1.x * al1, y: P0.y + t1.y * al1 }, c2: { x: P3.x + t2.x * al2, y: P3.y + t2.y * al2 } };
  }

  // curvas no lugar da linha torta: uma só, ou partida no ponto mais longe enquanto a curva
  // passar de tol mm da linha (um Bézier só não dá conta de meia volta inteira)
  function curvasPor(linha, t1, t2, tol, prof = 0) {
    const P0 = linha[0], P3 = linha[linha.length - 1], { c1, c2 } = alcas(linha, t1, t2), uma = [{ P0, c1, c2, P3 }];
    if (prof >= 3 || linha.length < 7) return uma;
    const q = G.bezier(P0, c1, c2, P3);
    let k = -1, md = tol;
    linha.forEach((p, i) => {
      if (i === 0 || i === linha.length - 1) return;
      const d = Math.min(...q.slice(1).map((r, j) => distSeg(p, q[j], r)));
      if (d > md) { md = d; k = i; }
    });
    if (k < 0) return uma;
    const v = { x: linha[k + 1].x - linha[k - 1].x, y: linha[k + 1].y - linha[k - 1].y }, n = Math.hypot(v.x, v.y) || 1;
    const tm = { x: v.x / n, y: v.y / n }; // mesma direção dos dois lados: a emenda não faz bico
    return [...curvasPor(linha.slice(0, k + 1), t1, { x: -tm.x, y: -tm.y }, tol, prof + 1),
      ...curvasPor(linha.slice(k), tm, t2, tol, prof + 1)];
  }

  function curvaPor(m, a, b, linha, tol) {
    const out = [];
    for (const c of curvasPor(linha, tangente(linha, false), tangente(linha, true), tol)) {
      const id = uid(m, 't');
      m.tracos.push({ id, tipo: 'curva', a: ponto(m, c.P0), b: ponto(m, c.P3), c1: c.c1, c2: c.c2 });
      out.push(id);
    }
    return out;
  }

  // troca o pedaço torto entre dois pontos por uma reta, ou por curvas que seguem a linha até tol mm
  function trocarTrecho(m, ids, curvo, tol = 3) {
    const [a, b] = ids;
    if (ids.length !== 2 || a === b || !m.pontos[a] || !m.pontos[b]) return { erro: 'Clique em dois pontos diferentes do desenho.' };
    const tr = caminhoEntre(m, a, b);
    if (!tr) return { erro: 'Esses dois pontos não estão ligados por traços.' };
    const nova = curvo ? curvaPor(m, a, b, linhaDe(m, tr, a), tol) : [reta(m, a, b)];
    for (const pc of m.pecas) {
      if (!pc.tracos.some(t => tr.includes(t.id))) continue;
      pc.tracos = [...nova.map(id => ({ id, inv: false })), ...pc.tracos.filter(t => !tr.includes(t.id))];
      const r = MM.encadear(m, pc.tracos.map(t => t.id)); // encadear acerta a ordem e o sentido: a peça continua inteira
      if (r.ok) pc.tracos = r.tracos;
      pc.pences = (pc.pences || []).filter(x => !tr.includes(x.tracoId));
      pc.piques = (pc.piques || []).filter(x => !tr.includes(x.tracoId));
      for (const id of tr) if (pc.margemTraco) delete pc.margemTraco[id];
    }
    apagar(m, tr);
    return { ids: nova };
  }
  const endireitar = (m, ids) => trocarTrecho(m, ids, false);
  const suavizar = (m, ids) => trocarTrecho(m, ids, true);

  // divide cada reta selecionada onde ela cruza outro traço; cruzamento vira ponto comum
  function cortar(m, ids) {
    const sel = retasDe(m, ids), novos = [];
    if (!sel.length) return { erro: 'Selecione as retas a cortar.' };
    for (const r of sel) {
      const A = m.pontos[r.a], B = m.pontos[r.b], ts = [];
      for (const o of m.tracos) if (o !== r) for (const [c, d] of segs(m, o)) {
        const x = G.intersecao(A, B, c, d);
        if (x && x.ta > 1e-6 && x.ta < 1 - 1e-6 && !ts.some(q => Math.abs(q.ta - x.ta) < 1e-6)) ts.push(x);
      }
      if (!ts.length) { novos.push(r.id); continue; }
      const cadeia = [r.a, ...ts.sort((p, q) => p.ta - q.ta).map(x => ponto(m, x.p)), r.b];
      r.b = cadeia[1]; novos.push(r.id);
      for (let i = 1; i < cadeia.length - 1; i++) novos.push(reta(m, cadeia[i], cadeia[i + 1]));
    }
    if (novos.length === sel.length) return { erro: 'As retas selecionadas não cruzam outro traço.' };
    return { ids: novos };
  }

  // leva a ponta livre (ou, se não der, a outra) até o primeiro traço que a reta encontra
  function estender(m, ids) {
    const sel = retasDe(m, ids);
    if (!sel.length) return { erro: 'Selecione as retas a estender.' };
    let n = 0;
    for (const r of sel) {
      const ate = m.tracos.filter(t => t !== r).flatMap(t => segs(m, t));
      const conta = id => m.tracos.filter(t => [t.a, t.b, t.c].includes(id)).length;
      for (const k of conta(r.b) > 1 && conta(r.a) === 1 ? ['a', 'b'] : ['b', 'a']) {
        const o = k === 'b' ? 'a' : 'b', p = G.estender(m.pontos[r[o]], m.pontos[r[k]], ate);
        if (!p) continue;
        if (conta(r[k]) === 1) Object.assign(m.pontos[r[k]], { x: p.x, y: p.y }); else r[k] = ponto(m, p);
        n++; break;
      }
    }
    return n ? { ids } : { erro: 'A reta não encontra outro traço ao ser estendida.' };
  }

  // canto entre duas retas com ponta comum vira reta–curva–reta
  function arredondar(m, ids, raio) {
    const sel = retasDe(m, ids);
    if (sel.length !== 2 || ids.length !== 2) return { erro: 'Selecione as duas retas do canto.' };
    if (!(raio > 0)) return { erro: 'Raio inválido.' };
    const [r1, r2] = sel, com = [r1.a, r1.b].filter(id => id === r2.a || id === r2.b);
    if (com.length !== 1) return { erro: 'As duas retas precisam se encontrar num canto.' };
    const c = com[0], o1 = r1.a === c ? r1.b : r1.a, o2 = r2.a === c ? r2.b : r2.a;
    const P0 = m.pontos[o1], P1 = m.pontos[c], P2 = m.pontos[o2];
    const cruz = (P0.x - P1.x) * (P2.y - P1.y) - (P0.y - P1.y) * (P2.x - P1.x);
    if (dist(P0, P1) < PERTO || dist(P2, P1) < PERTO) return { erro: 'Reta sem comprimento.' };
    if (Math.abs(cruz) < 1e-9 * dist(P0, P1) * dist(P2, P1)) return { erro: 'As retas estão alinhadas: não há canto.' };
    const a = G.arredondar(P0, P1, P2, raio);
    if (![a.ini, a.fim, a.c1, a.c2].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) return { erro: 'Não foi possível arredondar.' };
    const fora = [];
    const ponta = (r, o, p) => {
      if (dist(p, m.pontos[o]) < PERTO) { fora.push(r.id); return o; } // raio come a reta inteira
      const id = ponto(m, p); r[r.a === c ? 'a' : 'b'] = id; return id;
    };
    const ini = ponta(r1, o1, a.ini), fim = ponta(r2, o2, a.fim);
    const id = uid(m, 't');
    m.tracos.push({ id, tipo: 'curva', a: ini, b: fim, c1: a.c1, c2: a.c2 });
    m.tracos = m.tracos.filter(t => !fora.includes(t.id));
    if (!usados(m).has(c)) delete m.pontos[c];
    return { ids: [id] };
  }

  // cópia espelhada; eixo = última reta selecionada. Pontos sobre o eixo continuam os mesmos (fecha a peça)
  function espelhar(m, ids) {
    const eixo = [...ids].reverse().map(id => m.tracos.find(t => t.id === id)).find(t => t && t.tipo === 'reta');
    const resto = ids.filter(id => !eixo || id !== eixo.id);
    if (!eixo || !resto.length) return { erro: 'Selecione o que espelhar e, por último, a reta do eixo.' };
    const A = m.pontos[eixo.a], B = m.pontos[eixo.b];
    if (dist(A, B) < PERTO) return { erro: 'Reta do eixo sem comprimento.' };
    const esp = p => G.espelhar([p], A, B)[0], linha = p => { const l = dist(A, B); return Math.abs((B.x - A.x) * (A.y - p.y) - (A.x - p.x) * (B.y - A.y)) / l; };
    const mapa = {}, pid = id => mapa[id] || (mapa[id] = linha(m.pontos[id]) < PERTO ? id : ponto(m, esp(m.pontos[id])));
    const novos = [];
    for (const t of m.tracos.filter(t => resto.includes(t.id))) {
      const n = { ...t, id: uid(m, 't') };
      for (const k of ['a', 'b', 'c']) if (t[k]) n[k] = pid(t[k]);
      for (const k of ['c1', 'c2']) if (t[k]) n[k] = esp(t[k]);
      if (t.pts) n.pts = t.pts.map(esp);
      m.tracos.push(n); novos.push(n.id);
    }
    for (const id of resto) if (m.pontos[id] && !usados(m).has(id)) novos.push(pid(id));
    for (const x of m.textos.filter(x => resto.includes(x.id))) { const n = { ...x, ...esp(x), id: uid(m, 'x') }; m.textos.push(n); novos.push(n.id); }
    return { ids: novos };
  }

  // ---- peças ----
  // ponto da polilinha mais perto de p: t = fração do comprimento (0..1), d = distância
  function noTraco(linha, p) {
    const L = G.comprimento(linha);
    let s = 0, mel = { t: 0, d: Infinity };
    for (let i = 1; i < linha.length; i++) {
      const a = linha[i - 1], b = linha[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
      const k = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (l * l))) : 0;
      const d = Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
      if (d < mel.d) mel = { t: L ? (s + k * l) / L : 0, d };
      s += l;
    }
    return mel;
  }
  // traço do contorno da peça mais perto de p, com t no sentido do próprio traço e L = comprimento dele
  function naPeca(m, peca, p) {
    let mel = null;
    for (const { id } of peca.tracos) {
      const t = m.tracos.find(x => x.id === id);
      if (!t) continue;
      const l = pts(m, t), r = noTraco(l, p);
      if (!mel || r.d < mel.d) mel = { tracoId: id, t: r.t, d: r.d, L: G.comprimento(l) };
    }
    return mel;
  }

  // costura e corte; null = contorno quebrado (traço apagado ou que não fecha mais)
  function geoPeca(m, peca) {
    const ids = peca.tracos.map(t => t.id), ok = q => q.length > 2 && q.every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    try {
      if (!ids.length || !MM.encadear(m, ids).ok) return null;
      const cost = MM.costura(m, peca), corte = MM.corte(m, peca);
      return ok(cost) && ok(corte) ? { cost, corte } : null;
    } catch (e) { return null; }
  }

  // peça nova "PEÇA n" com os traços (os que não são traço ficam de fora); fio vertical no centro
  function novaPeca(m, ids) {
    const tr = ids.filter(id => m.tracos.some(t => t.id === id));
    if (!tr.length) return { ok: false, erro: 'Selecione os traços do contorno da peça.' };
    const r = MM.encadear(m, tr);
    if (!r.ok) return r;
    let n = m.pecas.length + 1;
    while (m.pecas.some(p => p.nome === 'PEÇA ' + n)) n++;
    // mesmo tam das outras: molParaProduto só manda para porTam[T] a peça sem tam ou com tam T, então uma peça nova sem tam esconderia as outras nos demais tamanhos
    const tam = (m.pecas.find(p => p.tam) || {}).tam;
    const peca = { id: uid(m, 'pc'), nome: 'PEÇA ' + n, tam, cortar: 1, par: false, tracos: r.tracos, dobra: null, fio: null,
      margem: 10, margemTraco: {}, piques: [], pences: [], visivel: true, travada: false,
      rotacao: '180', espelhar: false, tubular: false, tecido: '', bainhas: {} }; // mesmos padrões do normalizar
    const b = G.bbox(MM.costura(m, peca)), x = b.x0 + b.w / 2;
    peca.fio = { a: { x, y: b.y0 + b.h * 0.2 }, b: { x, y: b.y0 + b.h * 0.8 } };
    m.pecas.push(peca);
    return { ok: true, peca };
  }

  // pique: traço de 5 mm do corte para dentro, na normal do contorno (para fora = direita no anti-horário)
  function pique(m, peca, { tracoId, t }) {
    const tr = peca.tracos.find(x => x.id === tracoId), tt = m.tracos.find(x => x.id === tracoId);
    if (!tr || !tt) return null;
    const { p, tangente: u } = G.pontoEm(pts(m, tt), t), s = tr.inv ? -1 : 1;
    const nx = u.y * s, ny = -u.x * s, d = peca.margemTraco[tracoId] ?? peca.margem;
    return [{ x: p.x + nx * d, y: p.y + ny * d }, { x: p.x + nx * (d - 5), y: p.y + ny * (d - 5) }];
  }

  const MoldeDesenho = { distSeg, medida, cm, polar, angulo, noRaio, simplificar, uid, ponto, usados, reta, retangulo, medir, naCaixa, transformar, girar, apagar, cortar, endireitar, suavizar, estender, arredondar, espelhar,
    noTraco, naPeca, geoPeca, novaPeca, pique };
  g.MoldeDesenho = MoldeDesenho;
  if (typeof module !== 'undefined') module.exports = MoldeDesenho;
})(typeof window !== 'undefined' ? window : globalThis);
