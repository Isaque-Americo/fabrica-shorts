#!/usr/bin/env node
// Self-check do editor de molde (molde/*.js, lógica pura). Falha = saída 2.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..', '..', 'molde');
const G = require(path.join(raiz, 'geo.js'));
// modelo.js entra nas etapas seguintes
const M = fs.existsSync(path.join(raiz, 'modelo.js')) ? require(path.join(raiz, 'modelo.js')) : null;

const P = (x, y) => ({ x, y });
const quadrado = [P(0, 0), P(100, 0), P(100, 100), P(0, 100)];
const TOL = 0.5;

// sem auto-interseção: nenhum par de arestas não vizinhas se cruza
function semCruzar(pts) {
  const n = pts.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (G.intersecao(pts[i], pts[i + 1], pts[j], pts[(j + 1) % n])) return false;
  }
  return true;
}
function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
// menor distância de um vértice do corte ao contorno da costura
const folga = (corte, cont) => Math.min(...corte.map(p => Math.min(...cont.map((a, i) => distSeg(p, a, cont[(i + 1) % cont.length])))));
const margem = (pts, d) => G.offset(pts, pts.map(() => d));

const L = [P(0, 0), P(100, 0), P(100, 40), P(40, 40), P(40, 100), P(0, 100)];
// gancho: canto superior direito recortado por arco côncavo de raio r centrado em (100,100)
const gancho = r => [P(0, 0), P(100, 0), ...G.bezier(P(100, 100 - r), P(100 - r * 0.5523, 100 - r), P(100 - r, 100 - r * 0.5523), P(100 - r, 100)), P(0, 100)];
const g30 = gancho(30), g5 = gancho(5);
const cL = margem(L, 10), c30 = margem(g30, 10), c5 = margem(g5, 10);
// ponta de ~7°: o chanfro não pode passar perto da costura (mede vértice da costura → segmento do corte)
const agudo = [P(0, 0), P(200, 0), P(0, 25)], cAgudo = margem(agudo, 10);
const folgaSeg = (corte, cont) => Math.min(...cont.map(p => Math.min(...corte.map((a, i) => distSeg(p, a, corte[(i + 1) % corte.length])))));
const meiaPeca =[P(0, 0), P(50, 0), P(50, 100), P(0, 100)];
const dobra = G.abrirDobra(meiaPeca, P(0, 100), P(0, 0));
const canto = G.arredondar(P(0, 100), P(0, 0), P(100, 0), 10);

// [nome, obtido, esperado, tolerância opcional]
const testes = [
  ['comprimento 3-4-5', G.comprimento([P(0, 0), P(30, 40)]), 50],
  ['area quadrado anti-horario', G.area(quadrado), 10000],
  ['area quadrado horario', G.area(quadrado.slice().reverse()), -10000],
  ['areaAbs horario', G.areaAbs(quadrado.slice().reverse()), 10000],
  ['bezier quarto de circulo', G.comprimento(G.bezier(P(0, 0), P(0, 55.23), P(44.77, 100), P(100, 100))), 157.08],
  ['bezier inclui extremos', (b => [b[0].x, b[0].y, b[b.length - 1].x, b[b.length - 1].y])(G.bezier(P(0, 0), P(0, 55.23), P(44.77, 100), P(100, 100))), [0, 0, 100, 100]],
  ['areaAbs circulo r=100', G.areaAbs(G.circulo(P(0, 0), 100)), 31415.9, 30],
  ['circulo anti-horario', G.area(G.circulo(P(0, 0), 100)) > 0, true],
  ['pontoEm 25%', G.pontoEm([P(0, 0), P(100, 0)], 0.25).p, P(25, 0)],
  ['pontoEm tangente', G.pontoEm([P(0, 0), P(100, 0)], 0.25).tangente, P(1, 0)],
  ['pontoEm em polilinha', G.pontoEm([P(0, 0), P(100, 0), P(100, 100)], 0.75).p, P(100, 50)],
  ['bbox', G.bbox([P(10, 20), P(40, 5), P(25, 50)]), { x0: 10, y0: 5, w: 30, h: 45 }],
  ['offset quadrado bbox', G.bbox(margem(quadrado, 10)), { x0: -10, y0: -10, w: 120, h: 120 }],
  ['offset quadrado area', G.area(margem(quadrado, 10)), 14400],
  ['offset bainha 4cm', G.bbox(G.offset(quadrado, [10, 10, 40, 10])).h, 150],
  ['offset L sem cruzar', semCruzar(cL), true],
  ['offset L folga >= 9,5', folga(cL, L) >= 9.5, true],
  // canto em esquadria: A + d·perímetro + d²·(5 cantos convexos − 1 reentrante)
  ['offset L area', G.area(cL), 6400 + 10 * 400 + 100 * 4],
  ['offset gancho r30 sem cruzar', semCruzar(c30), true],
  ['offset gancho r30 folga >= 9,5', folga(c30, g30) >= 9.5, true],
  ['offset gancho r5 sem cruzar', semCruzar(c5), true],
  ['offset gancho r5 folga >= 9,5', folga(c5, g5) >= 9.5, true],
  ['offset ponta aguda folga >= 9,5', folgaSeg(cAgudo, agudo) >= 9.5, true],
  ['offset ponta aguda sem cruzar', semCruzar(cAgudo), true],
  ['offset L folga por segmento', folgaSeg(cL, L) >= 9.5, true],
  ['dobra area', G.areaAbs(dobra), 10000],
  ['dobra 4 vertices', dobra.length, 4],
  ['dobra anti-horario', G.area(dobra) > 0, true],
  ['espelhar', G.espelhar([P(10, 5)], P(0, 0), P(0, 1))[0], P(-10, 5)],
  ['ima ponto', G.ima(P(3, 2), [P(0, 0)], [], 5).tipo, 'ponto'],
  ['ima fora do raio', G.ima(P(30, 20), [P(0, 0)], [], 5).tipo, null],
  ['ima ponto vence linha', G.ima(P(3, 1), [P(0, 0)], [[P(-10, 1), P(10, 1)]], 5).tipo, 'ponto'],
  ['ima linha', G.ima(P(50, 3), [P(0, 0)], [[P(0, 0), P(100, 0)]], 5), { p: P(50, 0), tipo: 'linha' }],
  ['intersecao', G.intersecao(P(0, 0), P(10, 10), P(0, 10), P(10, 0)), { p: P(5, 5), ta: 0.5, tb: 0.5 }],
  ['intersecao fora dos segmentos', G.intersecao(P(0, 0), P(1, 1), P(0, 10), P(10, 0)), null],
  ['estender', G.estender(P(0, 0), P(10, 0), [[P(50, -10), P(50, 10)]]), P(50, 0)],
  ['estender sem alvo', G.estender(P(0, 0), P(10, 0), [[P(-50, -10), P(-50, 10)]]), null],
  ['arredondar ini a 10 do canto', Math.hypot(canto.ini.x, canto.ini.y), 10],
  ['arredondar fim a 10 do canto', Math.hypot(canto.fim.x, canto.fim.y), 10],
  ['arredondar meio no arco', (b => Math.hypot(b.x - 10, b.y - 10))(G.pontoEm(G.bezier(canto.ini, canto.c1, canto.c2, canto.fim), 0.5).p), 10],
  ['girar 90', G.girar([P(10, 0)], P(0, 0), 90)[0], P(0, 10)],
  ['mover', G.mover([P(1, 2)], 3, 4)[0], P(4, 6)],
];

// modelo: retângulo 100×200 com a barra (r1) embaixo
if (!M) { console.error('FALHA molde/modelo.js ausente'); process.exit(2); }
const ret = M.novo('teste');
Object.assign(ret.pontos, { a: P(0, 0), b: P(100, 0), c: P(100, 200), d: P(0, 200) });
ret.tracos.push({ id: 'r1', tipo: 'reta', a: 'a', b: 'b' }, { id: 'r2', tipo: 'reta', a: 'b', b: 'c' },
  { id: 'r3', tipo: 'reta', a: 'd', b: 'c' }, { id: 'r4', tipo: 'reta', a: 'd', b: 'a' }); // r3 invertida
const enc = M.encadear(ret, ['r3', 'r1', 'r4', 'r2']);
const furo = M.encadear(ret, ['r1', 'r2', 'r3']);
const pecaRet = (extra) => M.normalizar({ pecas: [{ id: 'p', tracos: enc.tracos, ...extra }] }).pecas[0];
const contornoEnc = enc.tracos.map(t => (p => t.inv ? p.slice().reverse() : p)(M.tracoPts(ret, ret.tracos.find(x => x.id === t.id)))[0]);
ret.pecas = [pecaRet({ par: true, fio: { a: P(0, 0), b: P(0, 100) } })];
const prodRet = M.molParaProduto(ret);
// quadrado com fio a 45°
const qd = M.novo('qd');
Object.assign(qd.pontos, { a: P(0, 0), b: P(100, 0), c: P(100, 100), d: P(0, 100) });
qd.tracos.push({ id: 's1', tipo: 'reta', a: 'a', b: 'b' }, { id: 's2', tipo: 'reta', a: 'b', b: 'c' },
  { id: 's3', tipo: 'reta', a: 'c', b: 'd' }, { id: 's4', tipo: 'reta', a: 'd', b: 'a' });
qd.pecas = [M.normalizar({ pecas: [{ id: 'q', cortar: 1, par: true, tracos: M.encadear(qd, ['s1', 's2', 's3', 's4']).tracos, fio: { a: P(0, 0), b: P(100, 100) } }] }).pecas[0]];
const prodQd = M.molParaProduto(qd), cxQd = G.bbox(G.girar(M.corte(qd, qd.pecas[0]), P(0, 0), -45));
// dobra no lado esquerdo (r4) → peça aberta 200×200
const pecaDobra = pecaRet({ dobra: { tracoId: 'r4' } });
// pence de 20 de abertura e 50 de profundidade no meio da barra
const pecaPence = pecaRet({ pences: [{ tracoId: 'r1', t: 0.5, abertura: 20, profundidade: 50 }] });
const cosPence = M.costura(ret, pecaPence);
const circ = M.novo('c');
circ.pontos.o = P(0, 0); circ.tracos.push({ id: 'k', tipo: 'circulo', c: 'o', r: 50 });
const h = M.historico();
h.gravar({ n: 1 }); h.gravar({ n: 2 }); h.gravar({ n: 3 });
const h1 = (h.desfazer(), h.desfazer()), h2 = h.refazer();
const nVazio = M.normalizar({});
// peça apontando para traço apagado não derruba o salvamento
const quebrado = { ...ret, pecas: [...ret.pecas, pecaRet({ id: 'x', tracos: [{ id: 'sumiu', inv: false }] })] };
const prodQuebrado = M.molParaProduto(quebrado);
const semPonto = { ...ret, pontos: { a: P(0, 0) } };

testes.push(
  ['encadear traco inexistente', M.encadear(ret, ['r1', 'sumiu']), { ok: false, erro: 'Traço inexistente' }],
  ['encadear vazio', M.encadear(ret, []).ok, false],
  ['molParaProduto pula peca quebrada', prodQuebrado.pecas.length, 1],
  ['molParaProduto ponto apagado nao lanca', M.molParaProduto(semPonto).pecas.length, 0],
  ['encadear fora de ordem ok', enc.ok, true],
  ['encadear 4 tracos', enc.tracos.length, 4],
  ['encadear area positiva', G.area(contornoEnc) > 0, true],
  ['encadear sem uma reta falha', furo.ok, false],
  ['encadear erro nao fecha', /não fecha/.test(furo.erro), true],
  ['encadear ponta solta', [P(0, 0), P(0, 200)].some(q => Math.hypot(q.x - furo.ponta.x, q.y - furo.ponta.y) < TOL), true],
  ['encadear circulo sozinho', M.encadear(circ, ['k']).ok, true],
  ['corte com bainha 30', (b => [b.w, b.h])(G.bbox(M.corte(ret, pecaRet({ margemTraco: { r1: 30 } })))), [120, 240]],
  ['costura com dobra 200x200', (b => [b.w, b.h])(G.bbox(M.costura(ret, pecaDobra))), [200, 200]],
  ['costura com dobra area', G.area(M.costura(ret, pecaDobra)), 40000],
  ['pence ponta a 50 da barra', cosPence.some(q => Math.abs(q.x - 50) < TOL && Math.abs(q.y - 50) < TOL), true],
  ['pence tira o V da area', G.area(cosPence), 20000 - 20 * 50 / 2],
  ['molParaProduto chaves', Object.keys(prodRet).sort(), ['arq', 'avisos', 'origem', 'pecas', 'porTam', 'un']],
  ['molParaProduto peca chaves', Object.keys(prodRet.pecas[0]).sort(), ['espelhar', 'h', 'nome', 'par', 'pts', 'qtd', 'rot', 'tecido', 'tubular', 'w']],
  ['molParaProduto par, espelhar, tubular e nome', (q => [q.nome, q.par, q.espelhar, q.tubular])(M.molParaProduto({ ...qd, pecas: [{ ...qd.pecas[0], nome: 'Bolso', espelhar: true, tubular: true }] }).pecas[0]), ['Bolso', true, true, true]],
  ['molParaProduto un mm', prodRet.un, 'mm'],
  ['molParaProduto pts [x,y] inteiros', prodRet.pecas[0].pts.every(q => Array.isArray(q) && q.length === 2 && q.every(Number.isInteger)), true],
  ['molParaProduto pts no canto', (p => [Math.min(...p.map(q => q[0])), Math.min(...p.map(q => q[1]))])(prodRet.pecas[0].pts), [0, 0]],
  ['molParaProduto fio vertical vai para X', [prodRet.pecas[0].w, prodRet.pecas[0].h], [220, 120], 1],
  ['molParaProduto qtd par', prodQd.pecas[0].qtd, 2],
  ['molParaProduto fio 45 caixa', [prodQd.pecas[0].w, prodQd.pecas[0].h], [cxQd.w, cxQd.h], 1],
  ['molParaProduto oculta fica fora', M.molParaProduto({ ...qd, pecas: [{ ...qd.pecas[0], visivel: false }] }).pecas.length, 0],
  ['normalizar vazio', [nVazio.pontos, nVazio.tracos, nVazio.pecas, nVazio.base], [{}, [], [], 'M']],
  ['normalizar margem padrao', M.normalizar({ pecas: [{ id: 'a' }] }).pecas[0].margem, 10],
  ['novo', [M.novo('x').nome, M.novo('x').v, M.novo('x').base], ['x', 1, 'M']],
  ['historico desfazer 2', h1, { n: 1 }],
  ['historico refazer', h2, { n: 2 }],
);

// ferramentas de desenho (molde/desenho.js)
const D = require(path.join(raiz, 'desenho.js'));
const dr = M.novo('d'), rr = D.retangulo(dr, P(0, 0), P(300, 500)).ids;
const drCanto = structuredClone(dr), arr = D.arredondar(drCanto, [rr[0], rr[1]], 50);
const drMedir = D.medir(drCanto, drCanto.tracos.map(t => t.id));
// cruz: horizontal 0..100 e vertical em x=50
const cz = M.novo('c'), cza = D.ponto(cz, P(0, 0)), czb = D.ponto(cz, P(100, 0)), czc = D.ponto(cz, P(50, -50)), czd = D.ponto(cz, P(50, 50));
const czh = D.reta(cz, cza, czb), czv = D.reta(cz, czc, czd);
const corte = D.cortar(cz, [czh, czv]);
// estender: reta 0..40 até a vertical em x=100
const es = M.novo('e'); D.reta(es, D.ponto(es, P(0, 0)), D.ponto(es, P(40, 0)));
const esv = D.reta(es, D.ponto(es, P(100, -50)), D.ponto(es, P(100, 50)));
const esr = D.estender(es, [es.tracos[0].id]);
// espelho: meia peça pelo eixo x=0
const ep = M.novo('ep'), e0 = D.ponto(ep, P(0, 0)), e1 = D.ponto(ep, P(0, 100)), e2 = D.ponto(ep, P(50, 50));
const eixo = D.reta(ep, e0, e1), lado = [D.reta(ep, e0, e2), D.reta(ep, e2, e1)];
const espe = D.espelhar(ep, [...lado, eixo]);
const espTodos = [...lado, ...espe.ids];
const ap = structuredClone(dr); D.apagar(ap, [rr[0]]);
const gi = structuredClone(dr); D.girar(gi, rr, 90);
testes.push(
  ['medida 11,5;90', D.medida('11,5;90'), [11.5, 90]],
  ['medida so comprimento', D.medida(' 30 '), [30]],
  ['medida ; final', D.medida('30;'), [30]],
  ['medida invalida', [D.medida(''), D.medida('abc'), D.medida('1;x'), D.medida(null)], [null, null, null, null]],
  ['cm 1 casa virgula', D.cm(1600), '160,0'],
  ['polar 90 sobe na tela', D.polar(P(0, 0), 100, 90), P(0, -100)],
  ['angulo para cima', D.angulo(P(0, 0), P(0, -10)), 90],
  ['simplificar reta', D.simplificar([P(0, 0), P(10, 0.3), P(20, -0.2), P(30, 0)], 1).length, 2],
  ['simplificar mantem canto', D.simplificar([P(0, 0), P(50, 0), P(50, 50)], 1), [P(0, 0), P(50, 0), P(50, 50)]],
  ['ponto reaproveita id', D.ponto(dr, P(300, 500)), dr.tracos[1].b],
  ['retangulo 4 retas 4 pontos', [dr.tracos.length, Object.keys(dr.pontos).length], [4, 4]],
  ['retangulo fecha', M.encadear(dr, rr).ok, true],
  ['retangulo mede 1600', D.medir(dr, rr), 1600],
  ['retangulo sem altura', !!D.retangulo(M.novo('x'), P(0, 0), P(10, 0)).erro, true],
  ['arredondar cria curva', drCanto.tracos.map(t => t.tipo).sort(), ['curva', 'reta', 'reta', 'reta', 'reta']],
  ['arredondar tira o canto', Object.values(drCanto.pontos).some(q => q.x === 300 && q.y === 0), false],
  ['arredondar contorno fecha', M.encadear(drCanto, drCanto.tracos.map(t => t.id)).ok, true],
  ['arredondar mede 1600-100+25pi', drMedir, 1600 - 100 + 25 * Math.PI, 0.5],
  ['arredondar alinhadas', (m => { const a = D.ponto(m, P(0, 0)), b = D.ponto(m, P(10, 0)), c = D.ponto(m, P(20, 0));
    return D.arredondar(m, [D.reta(m, a, b), D.reta(m, b, c)], 5).erro; })(M.novo('x')), 'As retas estão alinhadas: não há canto.'],
  ['arredondar raio 0', !!D.arredondar(structuredClone(dr), [rr[0], rr[1]], 0).erro, true],
  ['cortar cruz 4 retas', [corte.ids.length, cz.tracos.length], [4, 4]],
  ['cortar ponto comum', Object.values(cz.pontos).filter(q => Math.abs(q.x - 50) < 1e-6 && Math.abs(q.y) < 1e-6).length, 1],
  ['cortar sem cruzar', !!D.cortar(dr, [rr[0]]).erro, true],
  ['estender ate x=100', es.pontos[es.tracos[0].b], P(100, 0)],
  ['estender ok', !!esr.ids, true],
  ['espelhar reusa pontos do eixo', [espe.ids.length, Object.keys(ep.pontos).length], [2, 4]],
  ['espelhar copia em x=-50', Object.values(ep.pontos).some(q => Math.abs(q.x + 50) < 1e-6 && Math.abs(q.y - 50) < 1e-6), true],
  ['espelhar fecha contorno', M.encadear(ep, espTodos).ok, true],
  ['apagar tira so ponto sem uso', [ap.tracos.length, Object.keys(ap.pontos).length], [3, 4]],
  ['apagar dois lados tira o canto', (m => (D.apagar(m, [rr[0], rr[1]]), Object.keys(m.pontos).length))(structuredClone(dr)), 3],
  ['girar 90 anti-horario na tela', G.bbox(Object.values(gi.pontos)), { x0: -100, y0: 100, w: 500, h: 300 }],
  ['naCaixa pega retangulo', D.naCaixa(dr, P(-1, -1), P(301, 501)).length, 4],
  ['naCaixa parcial fica fora', D.naCaixa(dr, P(-1, -1), P(301, 10)).length, 1],
);

// peças: retângulo dr (0,0)–(300,500); rr[0] = barra de baixo (0,0)→(300,0)
const pm = structuredClone(dr), np1 = D.novaPeca(pm, [...rr, Object.keys(pm.pontos)[0]]), np2 = D.novaPeca(pm, rr);
const pc1 = np1.peca, solta = D.novaPeca(structuredClone(dr), [rr[0], rr[1]]);
const pmQ = structuredClone(pm); D.apagar(pmQ, [rr[0]]);
// peça editada depois de extraída: reta atravessando a barra + cortar; arredondar um canto
const pmUma = structuredClone(dr); D.novaPeca(pmUma, rr);
const pmCortada = structuredClone(pmUma); D.reta(pmCortada, D.ponto(pmCortada, P(150, -50)), D.ponto(pmCortada, P(150, 50)));
const cortou = D.cortar(pmCortada, [rr[0]]);
const pmArred = structuredClone(pmUma), arredou = D.arredondar(pmArred, [rr[0], rr[1]], 50);
testes.push(
  ['novaPeca ok ignora ponto', [np1.ok, pc1.tracos.length], [true, 4]],
  ['novaPeca padroes', [pc1.nome, pc1.cortar, pc1.par, pc1.margem, pc1.dobra, pc1.visivel, pc1.travada], ['PEÇA 1', 1, false, 10, null, true, false]],
  ['novaPeca fio vertical no centro', pc1.fio, { a: P(150, 100), b: P(150, 400) }],
  ['novaPeca segunda PEÇA 2 id novo', [np2.peca.nome, np2.peca.id !== pc1.id, pm.pecas.length], ['PEÇA 2', true, 2]],
  ['novaPeca aberta da ponta', [solta.ok, !!solta.ponta], [false, true]],
  ['novaPeca sem traco', D.novaPeca(structuredClone(dr), []).ok, false],
  ['geoPeca corte 1 cm', G.bbox(D.geoPeca(pm, pc1).corte), { x0: -10, y0: -10, w: 320, h: 520 }],
  ['geoPeca traco apagado quebra', D.geoPeca(pmQ, pmQ.pecas[0]), null],
  ['pique 5 mm para dentro do corte', D.pique(pm, pc1, { tracoId: rr[0], t: 0.5 }), [P(150, -10), P(150, -5)]],
  ['pique na bainha 3 cm', D.pique(pm, { ...pc1, margemTraco: { [rr[0]]: 30 } }, { tracoId: rr[0], t: 0.5 }), [P(150, -30), P(150, -25)]],
  ['pique traco invertido', D.pique(pm, { ...pc1, tracos: [{ id: rr[0], inv: true }] }, { tracoId: rr[0], t: 0.5 }), [P(150, 10), P(150, 5)]],
  ['naPeca acha traco e t', (h => [h.tracoId, h.t, h.d, h.L])(D.naPeca(pm, pc1, P(100, 2))), [rr[0], 1 / 3, 2, 300], 1e-6],
  ['cortar e arredondar aplicados na peca', [!!cortou.ids, !!arredou.ids], [true, true]],
  ['molParaProduto peca inteira vai', M.molParaProduto(pmUma).pecas.length, 1],
  ['molParaProduto pula peca com aresta cortada', [D.geoPeca(pmCortada, pmCortada.pecas[0]), M.molParaProduto(pmCortada).pecas.length], [null, 0]],
  ['molParaProduto pula peca com canto arredondado', [D.geoPeca(pmArred, pmArred.pecas[0]), M.molParaProduto(pmArred).pecas.length], [null, 0]],
  ['noTraco polilinha', D.noTraco([P(0, 0), P(100, 0), P(100, 100)], P(105, 50)), { t: 0.75, d: 5 }],
);

// etapa 2: grade, gradação e bainha
const semNovas = pecas => pecas.map(({ rot, tecido, nome, par, espelhar, tubular, ...r }) => r);
const gp = M.normalizar({ grade: M.GRADES.app, base: 'M' });
M.graduarPasso(gp, 'p1', 5, 0);
const gs = M.normalizar({ grade: M.GRADES.app, base: 'M' });
M.graduarPasso(gs, 'p1', 5, 0, { salto: { dx: 10, dy: 0, de: 'G1' } });
const cv = M.normalizar({ grade: ['P', 'M', 'G'], pontos: { a: P(0, 0), b: P(100, 0) }, grad: { b: { G: { dx: 20, dy: 0 } } },
  tracos: [{ id: 'k', tipo: 'curva', a: 'a', b: 'b', c1: P(30, -30), c2: P(70, -30) }] });
const cvG = M.noTamanho(cv, 'G').tracos[0];
// retângulo 100×200 com fio em X e os dois pontos da direita +10 por passo
const gr = M.normalizar({ ...structuredClone(ret), grade: M.GRADES.app, base: 'M' });
gr.pecas[0].fio = { a: P(0, 0), b: P(100, 0) };
M.graduarPasso(gr, 'b', 10, 0); M.graduarPasso(gr, 'c', 10, 0);
const prodGr = M.molParaProduto(gr);
const sp = structuredClone(gr); sp.grade = ['P', 'M', 'G'];
const areaG = G.area(M.costura(M.noTamanho(sp, 'G'), sp.pecas[0]));
M.separarTamanhos(sp);
const spG = sp.pecas.find(p => p.nome.endsWith(' · G'));
const bp = pecaRet();
M.aplicarBainha(bp, 't3', { largura: 15, dobras: 2, piques: true });
const bp30 = [bp.margemTraco.t3, bp.bainhas.t3];
M.aplicarBainha(bp, 't3', { largura: 0, dobras: 2, piques: true });
const rt = structuredClone(ret); rt.grade = ['P', 'M']; Object.assign(rt.pecas[0], { rotacao: 'nenhuma', tecido: 'mat9' });
const prodRt = M.molParaProduto(rt);
const nPeca = M.normalizar({ pecas: [{ id: 'a' }] });
// final 1: depois de separar, cada tamanho só leva a sua peça
const prodSp = M.molParaProduto(sp);
// final 2: traço lápis não anda com a gradação; no G o contorno quebra e vai a peça do base com aviso
const lp = M.normalizar({ grade: ['P', 'M', 'G'], base: 'M', pontos: { a: P(0, 0), b: P(100, 0), c: P(100, 100) },
  tracos: [{ id: 'l1', tipo: 'reta', a: 'a', b: 'b' }, { id: 'l2', tipo: 'reta', a: 'b', b: 'c' }, { id: 'l3', tipo: 'livre', pts: [P(100, 100), P(0, 100), P(0, 0)] }] });
lp.pecas = M.normalizar({ pecas: [{ id: 'lp', nome: 'Lapis', tracos: M.encadear(lp, ['l1', 'l2', 'l3']).tracos, fio: { a: P(0, 0), b: P(100, 0) } }] }).pecas;
M.graduarPasso(lp, 'c', 10, 0);
const prodLp = M.molParaProduto(lp);
testes.push(
  ['review1 ret pecas iguais a etapa 1', semNovas(prodRet.pecas), [{ w: 220, h: 120, qtd: 2, pts: [[0, 120], [0, 0], [220, 0], [220, 120]] }]],
  ['review1 qd pecas iguais a etapa 1', semNovas(prodQd.pecas), [{ w: 170, h: 170, qtd: 2, pts: [[85, 0], [170, 85], [85, 170], [0, 85]] }]],
  ['review1 pmUma pecas iguais a etapa 1', semNovas(M.molParaProduto(pmUma).pecas), [{ w: 520, h: 320, qtd: 1, pts: [[0, 0], [520, 0], [520, 320], [0, 320]] }]],
  ['review1 porTam so base', [Object.keys(prodRet.porTam), prodRet.porTam.M === prodRet.pecas], [['M'], true]],
  ['review1 rot e tecido padrao', [prodRet.pecas[0].rot, prodRet.pecas[0].tecido], ['180', '']],
  ['normalizar campos etapa 2', [nVazio.grade, nVazio.grad, nVazio.medidas, nVazio.foto], [[], {}, [], '']],
  ['normalizar peca etapa 2', (p => [p.rotacao, p.espelhar, p.tubular, p.tecido, p.bainhas])(nPeca.pecas[0]), ['180', false, false, '', {}]],
  ['tamanhos sem grade = base', M.tamanhos(M.normalizar({ base: '40' })), ['40']],
  ['tamanhos com grade', M.tamanhos(gp), M.GRADES.app],
  ['GRADES numerica', M.GRADES.numerica, ['36', '38', '40', '42', '44', '46', '48', '50', '52', '54', '56']],
  // brief dizia G4=35, mas (índice(G4) − índice(M)) × 5 = 6 × 5 = 30, e o caso com salto (G4=50) também conta 6 passos
  ['graduarPasso P M G G4', [gp.grad.p1.P.dx, gp.grad.p1.M.dx, gp.grad.p1.G.dx, gp.grad.p1.G4.dx], [-5, 0, 5, 30]],
  ['graduarPasso salto GG G1 G4', [gs.grad.p1.GG.dx, gs.grad.p1.G1.dx, gs.grad.p1.G4.dx, gs.grad.p1.P.dx], [10, 20, 50, -5]],
  ['review2 c2 segue b, c1 fica', [cvG.c1, cvG.c2], [P(30, -30), P(90, -30)]],
  ['review2 noTamanho nao altera o original', cv.tracos[0].c2, P(70, -30)],
  ['costura GG 120 base 100', [G.bbox(M.costura(M.noTamanho(gr, 'GG'), gr.pecas[0])).w, G.bbox(M.costura(M.noTamanho(gr, 'M'), gr.pecas[0])).w], [120, 100]],
  ['porTam GG - M = 20', prodGr.porTam.GG[0].w - prodGr.porTam.M[0].w, 20, 1],
  ['porTam um por tamanho', Object.keys(prodGr.porTam), M.GRADES.app],
  ['review3 separar 3 pecas', sp.pecas.length, 3],
  ['review3 area G igual', G.area(M.costura(sp, spG)), areaG],
  ['review3 grad vazio', sp.grad, {}],
  ['review3 separadas encadeiam', sp.pecas.every(p => M.encadear(sp, p.tracos.map(t => t.id)).ok), true],
  ['review3 base fica como era', G.bbox(M.costura(sp, sp.pecas[0])), { x0: 0, y0: 0, w: 100, h: 200 }],
  ['medir base 100 GG 120', [M.medir(gr, ['r1'], 'M'), M.medir(gr, ['r1'], 'GG')], [100, 120]],
  ['aplicarBainha 15x2', bp30, [30, { largura: 15, dobras: 2, piques: true }]],
  ['aplicarBainha largura 0 remove', ['t3' in bp.margemTraco, 't3' in bp.bainhas], [false, false]],
  ['molParaProduto rot e tecido', Object.values(prodRt.porTam).flat().map(p => [p.rot, p.tecido]), [['nenhuma', 'mat9'], ['nenhuma', 'mat9']]],
  ['final1 separar porTam G 1 peca com largura do G', [prodSp.porTam.G.length, prodSp.porTam.G[0].w, prodSp.pecas.length, prodSp.porTam.P.length], [1, prodGr.porTam.G[0].w, 1, 1]],
  ['final1 separar G e a copia', prodSp.porTam.G[0].w - prodSp.pecas[0].w, 10, 1],
  ['final1 separar tam nas pecas', sp.pecas.map(p => p.tam).sort(), ['G', 'M', 'P']],
  ['final2 G quebrado usa a peca do base', [prodLp.porTam.G.length, prodLp.porTam.G[0].w], [1, prodLp.pecas[0].w]],
  ['final2 avisos', prodLp.avisos, [{ peca: 'Lapis', tam: 'P' }, { peca: 'Lapis', tam: 'G' }]],
  ['final2 sem quebra sem aviso', prodGr.avisos, []],
  ['GRADES pgg', M.GRADES.pgg, ['P', 'M', 'G', 'GG']],
);


// encaixe (molde/encaixe.js). Review 2: números tirados do index.html em 9f5b2e0 antes de mover o código
const E = fs.existsSync(path.join(raiz, 'encaixe.js')) ? require(path.join(raiz, 'encaixe.js')) : {};
const antigos = {
  tri: [[0, 0], [300, 0], [0, 250]],
  L: [[0, 0], [400, 0], [400, 120], [150, 120], [150, 300], [0, 300]],
  sq: [[0, 0], [200, 0], [200, 200], [0, 200]]
};
const baseline = {
  tri: { '1@1': 0.3, '1@1.6': 0.3, '2@1': 0.3, '2@1.6': 0.3, '3@1': 0.58, '3@1.6': 0.3, '5@1': 1.14, '5@1.6': 0.68 },
  L: { '1@1': 0.4, '1@1.6': 0.4, '2@1': 0.96, '2@1.6': 0.56, '3@1': 1.12, '3@1.6': 0.8, '5@1': 1.92, '5@1.6': 1.12 },
  sq: { '1@1': 0.2, '1@1.6': 0.2, '2@1': 0.4, '2@1.6': 0.2, '3@1': 0.6, '3@1.6': 0.4, '5@1': 0.8, '5@1.6': 0.6 }
};
const TAMS = ['P', 'M', 'G', 'GG', 'XG'];
const encAntigo = {};
for (const k in antigos) {
  const [w, h] = [Math.max(...antigos[k].map(p => p[0])), Math.max(...antigos[k].map(p => p[1]))];
  const prod = { id: k, mol: { pecas: [{ w, h, qtd: 4, pts: antigos[k] }] } };
  encAntigo[k] = {};
  for (const n of [1, 2, 3, 5]) for (const l of [1, 1.6]) encAntigo[k][n + '@' + l] = E.encaixeMol ? E.encaixeMol(E.pecasDoRisco(prod, TAMS.slice(0, n)), l * 1000) : null;
}
// célula ocupada no máximo uma vez e dentro da largura
function posicoesOk(itens, r, largMm) {
  if (!r || !r.posicoes || r.posicoes.length !== itens.length) return false;
  const R = E.ENC_RES, occ = new Set(), largCel = Math.floor(largMm / R);
  for (const p of r.posicoes) {
    const ra = itens[p.i].rasters[p.var], ox = p.ox / R, oy = p.oy / R;
    if (oy < 0 || oy + ra.ch > largCel || ox + ra.cw > r.comp / R) return false;
    for (let cy = 0; cy < ra.ch; cy++) for (let cx = 0; cx < ra.cw; cx++) if (ra.m[cy * ra.cw + cx]) {
      const c = (ox + cx) + ',' + (oy + cy);
      if (occ.has(c)) return false;
      occ.add(c);
    }
  }
  return new Set(r.posicoes.map(p => p.i)).size === itens.length;
}
const va = (pts, o) => E.variantes ? E.variantes(pts, o) : [];
const mix = [...Array(4)].map((_, i) => ({ pecaIdx: 0, rasters: va(antigos.L, { rot: 'livre' }) }))
  .concat([...Array(5)].map(() => ({ pecaIdx: 1, rasters: va(antigos.tri, {}) })));
const rMix = E.encaixar ? E.encaixar(mix, 1000) : null;
const bordaIt = [...Array(3)].map(() => ({ pecaIdx: 0, rasters: va(antigos.sq, {}), borda0: true })).concat([{ pecaIdx: 1, rasters: va(antigos.tri, {}) }]);
const rBorda = E.encaixar ? E.encaixar(bordaIt, 1000) : null;
const rTodos0 = E.encaixar ? E.encaixar(bordaIt.map(x => ({ ...x, borda0: false })), 1000, { borda0: true }) : null;
const itTri = o => [...Array(6)].map(() => ({ pecaIdx: 0, rasters: va(antigos.tri, o) }));
const cTri = o => E.encaixar ? E.encaixar(itTri(o), 1000).comp : null;
testes.push(
  ['review2 antigos mesmo comprimento do index.html', encAntigo, baseline, 1e-9],
  ['encaixe ENC_RES 20', E.ENC_RES, 20],
  ['encaixar posicoes sem sobrepor e dentro da largura', posicoesOk(mix, rMix, 1000), true],
  ['encaixar comp em mm multiplo de ENC_RES', rMix && rMix.comp % 20, 0],
  ['encaixar posicoes em mm', rMix && rMix.posicoes.every(p => p.ox % 20 === 0 && p.oy % 20 === 0), true],
  ['borda0 da peca: oy 0', rBorda && [posicoesOk(bordaIt, rBorda, 1000), rBorda.posicoes.filter(p => bordaIt[p.i].borda0).every(p => p.oy === 0)], [true, true]],
  ['opts.borda0: todas oy 0', rTodos0 && rTodos0.posicoes.every(p => p.oy === 0), true],
  ['espelhar dobra variantes', [va(antigos.L, { rot: 'livre', espelhar: true }).length, va(antigos.L, { rot: 'nenhuma', espelhar: true }).length], [8, 2]],
  ['espelhada e o reflexo em Y', (() => { const [n, r] = va(antigos.L, { rot: 'nenhuma', espelhar: true });
    return !!r && [...Array(n.ch)].every((_, y) => [...Array(n.cw)].every((_, x) => n.m[y * n.cw + x] === r.m[(n.ch - 1 - y) * n.cw + x])); })(), true],
  ['escala 1,1 x 1 alarga o raster', va(antigos.sq, { escala: { x: 1.1, y: 1 } }).map(r => [r.cw, r.ch])[0], [11, 10]],
  ['escala 1,1 x 1: comprimento maior ou igual', cTri({ escala: { x: 1.1, y: 1 } }) >= cTri({}), true],
  ['encaixar peca mais larga que o tecido: null', E.encaixar ? E.encaixar([{ pecaIdx: 0, rasters: va(antigos.L, { rot: 'nenhuma' }) }], 200) : 0, null],
  ['encaixar lista vazia: null', E.encaixar ? E.encaixar([], 1000) : 0, null],
);

// fallback do encaixar: a variante escolhida pode ser mais larga que rot[0] (caso achado por busca aleatória)
const Rm = (cw, ch, s) => ({ cw, ch, m: Uint8Array.from([...s].map(Number)) });
const itLargo = [{ pecaIdx: 0, rasters: [Rm(1, 2, '10')] }, { pecaIdx: 1, rasters: [Rm(1, 2, '10'), Rm(7, 1, '1111111')] }, { pecaIdx: 2, rasters: [Rm(1, 2, '01')] }];
const rLargo = E.encaixar ? E.encaixar(itLargo, 40) : null;
testes.push(['encaixar variante mais larga que rot[0]: posicoes dentro do comp', posicoesOk(itLargo, rLargo, 40), true]);

// ordem de corte (molde/ordem.js)
const O = fs.existsSync(path.join(raiz, 'ordem.js')) ? require(path.join(raiz, 'ordem.js')) : null;
const fn = (f, d) => { try { return O ? f() : d; } catch (e) { return 'erro: ' + e.message; } };
const sq200 = [[0, 0], [200, 0], [200, 200], [0, 200]];
const pc = o => ({ w: 200, h: 200, qtd: 1, pts: sq200, rot: '180', tecido: '', ...o });
const prodO = pecas => ({ id: 'p1', ref: 'R1', tecidoId: 'tA', mol: { pecas, porTam: { M: pecas } } });
const tec = o => ({ id: 'tA', nome: 'Malha', larg: 1.6, gram: 160, cobr: 'mt', preco: 12, ...o });
const ordemO = (o, item) => ({ tecidos: [{ id: 'a1', materiaId: 'tA' }, { id: 'a2', materiaId: 'tF' }],
  enfestos: [{ id: 'e1', tecidoId: 'a1', camadas: 1, sentido: 'duplo', itens: [{ produtoId: 'p1', cor: 'Azul', pecas: null, grade: { M: 4 }, ...item }], ...o }] });
const naOrdem = (f, pecas, t, o, item) => { const ord = O.normalizar(ordemO(o, item)); return f(ord.enfestos[0], ord, [prodO(pecas)], [t, { id: 'tF', larg: 1.5 }]); };
const pe = (...a) => fn(() => naOrdem(O.pecasEnfesto, ...a), []);
const ce = (...a) => fn(() => naOrdem(O.calcularEnfesto, ...a), null);
const lista3 = [{ id: 'p1', ref: 'R1', nome: 'Short', c: 'Azul', t: 'P', f: 3 }, { id: 'p1', ref: 'R1', nome: 'Short', c: 'Azul', t: 'M', f: 5 },
  { id: 'p2', ref: 'R2', nome: 'Bermuda', c: 'Preto', t: 'G', f: 2 }];
const deF = fn(() => O.deFabricar(lista3, { produtos: [{ id: 'p1', tecidoId: 'tA' }, { id: 'p2', tecidoId: 'tB' }] }), null);
const deF3 = fn(() => O.deFabricar(lista3, { camadas: 3, compMax: 4000 }), null);
const itAj = { grade: { M: 2 } };
const ajust = fn(() => [O.ajustarGrade(itAj, 'M', -5), itAj.grade.M], null);
const ordR4 = { tecidos: [{ id: 'a1', materiaId: 'tA' }], enfestos: [{ id: 'e1', tecidoId: 'a1', camadas: 10 }] };
const res4 = t => fn(() => O.resultados(O.normalizar(ordR4), [{ comp: 2000, areaPecas: 1.6e6, pecasTotal: 8, grade: { R1: { M: 4 } } }], [t]), null);
const r4 = res4(tec()), r4kg = res4(tec({ cobr: 'kg', preco: 60, rend: 5 }));
const aberto = pe([pc()], tec()), tub = pe([pc()], tec({ tubular: true })), cTub = ce([pc()], tec({ tubular: true }));
const dobraT = pe([pc({ w: 200, h: 300, pts: [[0, 0], [200, 0], [200, 300], [0, 300]], tubular: true })], tec({ tubular: true }));
const parE = pc({ qtd: 2, par: true, espelhar: true });
const parU = pe([parE], tec(), { sentido: 'unico' }), cParU = ce([parE], tec(), { sentido: 'unico' }), parD = pe([parE], tec());
const parN = pc({ nome: 'Bolso', qtd: 2, par: true }), parSemE = pe([parN], tec(), { sentido: 'unico' }), cParSemE = ce([parN], tec(), { sentido: 'unico' });
const pesoDe = t => { const o = { camadas: 3 }, c = ce([pc()], t, o); return [c, c && fn(() => O.resultados(O.normalizar(ordemO(o)), [c], [t]), null)]; };
const [cPeso, rPeso] = pesoDe(tec()), [cPesoT, rPesoT] = pesoDe(tec({ tubular: true }));
// produto com peça do principal e do forro, uma aba e um enfesto por tecido: a roupa conta uma vez só
const duasAbas = fn(() => {
  const it = { produtoId: 'p1', cor: 'Azul', pecas: null, grade: { M: 3 } }, tecs = [tec(), { id: 'tF', larg: 1.5, gram: 100 }];
  const ord = O.normalizar({ tecidos: [{ id: 'a1', materiaId: 'tA' }, { id: 'a2', materiaId: 'tF' }],
    enfestos: [{ id: 'e1', tecidoId: 'a1', camadas: 5, itens: [it] }, { id: 'e2', tecidoId: 'a2', camadas: 5, itens: [it] }] });
  const cs = ord.enfestos.map(e => O.calcularEnfesto(e, ord, [prodO([pc({ nome: 'Frente' }), pc({ nome: 'Forro', tecido: 'tF' })])], tecs)), r = O.resultados(ord, cs, tecs);
  return [cs[1].grade, cs[1].pecasTotal, r.pecas, r.grade, r.consumoLinear === cs[0].comp / 1000 * 5 / 15];
}, null);
const cTubOurela = ce([pc()], tec({ tubular: true }), { ourelaE: 20, ourelaD: 30 });
const su = pe([pc({ rot: 'livre' }), pc({ rot: '180' })], tec({ sentidoUnico: true }));
const cSem = ce([pc()], tec({ larg: 0.2 }), {}, { grade: { M: 6 } }), cEnc = ce([pc()], tec({ larg: 0.2, encolhC: 10 }), {}, { grade: { M: 6 } });
const doisTec = [pc({ nome: 'Frente' }), pc({ nome: 'Forro', tecido: 'tF' }), pc({ nome: 'Bolso' })];
const naPrincipal = pe(doisTec, tec()), noForro = pe(doisTec, tec(), { tecidoId: 'a2' }), soBolso = pe(doisTec, tec(), {}, { pecas: ['Bolso'] });
const cCab = ce([pc()], tec(), { cabeceira: 40, ourelaE: 20, ourelaD: 30 });
const nv = fn(() => O.nova('Ordem X'), null);
testes.push(
  ['ordem nova', nv && [nv.nome, nv.tecidos.length, nv.enfestos.length, nv.enfestos[0].tecidoId === nv.tecidos[0].id, nv.enfestos[0].camadas, nv.enfestos[0].sentido, nv.v], ['Ordem X', 1, 1, true, 1, 'duplo', 1]],
  ['ordem normalizar vazio', fn(() => (n => [n.nome, n.pedidos, n.tecidos, n.enfestos, n.v])(O.normalizar({})), null), ['', [], [], [], 1]],
  ['ordem normalizar grade negativa vira 0', fn(() => O.normalizar({ enfestos: [{ itens: [{ grade: { M: -3, G: '2' } }] }] }).enfestos[0].itens[0].grade, null), { M: 0, G: 2 }],
  ['review3 deFabricar grade = f', deF && deF.enfestos.flatMap(e => e.itens.map(i => [i.produtoId, i.cor, i.grade])), [['p1', 'Azul', { P: 3, M: 5 }], ['p2', 'Preto', { G: 2 }]]],
  ['review3 deFabricar um enfesto por tecido principal', deF && [deF.tecidos.map(t => t.materiaId), deF.enfestos.map(e => deF.tecidos.find(t => t.id === e.tecidoId).materiaId), deF.enfestos[0].camadas], [['tA', 'tB'], ['tA', 'tB'], 1]],
  ['deFabricar camadas 3: grade por camada arredonda para cima', deF3 && [deF3.enfestos.length, deF3.enfestos[0].camadas, deF3.enfestos[0].compMax, deF3.enfestos[0].itens.map(i => i.grade)], [1, 3, 4000, [{ P: 1, M: 2 }, { G: 1 }]]],
  ['review3 ajustarGrade -5 em 2 = 0', ajust, [0, 0]],
  ['review4 pesoTecido 5,12 kg', r4 && r4.pesoTecido, 5.12, 1e-9],
  ['review4 metros 20, custo 240', r4 && [r4.metros, r4.custo], [20, 240], 1e-9],
  ['review4 custo por kg com rendimento', r4kg && r4kg.custo, 240, 1e-9],
  ['review4 peso pecas e desperdicio', r4 && [r4.pesoPecas, r4.pesoDesperdicio], [2.56, 2.56], 1e-9],
  ['review4 pecas, consumo e grade', r4 && [r4.pecas, r4.consumoLinear, r4.grade], [40, 0.5, { R1: { M: 40 } }], 1e-9],
  ['review5 aberto duplo: 4 posicoes', aberto.length, 4],
  ['review5 tubular: 2 posicoes, 4 pecas', [tub.length, tub.reduce((a, x) => a + x.rende, 0), cTub && cTub.posicoes.length, cTub && cTub.pecasTotal], [2, 4, 2, 4]],
  ['review5 unico par espelhar: normais = espelhadas', [parU.length, parU.filter(x => x.espelho).length, cParU && cParU.posicoes.filter(p => cParU.itens[p.i].espelho).length], [8, 4, 4]],
  ['review5 duplo par: 8 posicoes, todas normais', [parD.length, parD.every(x => !x.espelho && !x.espelhar && x.rende === 1), (parD.avisos || []).length], [8, true, 0]],
  ['review5 unico par sem espelhar: 8 normais e 1 aviso', [parSemE.length, parSemE.filter(x => x.espelho).length, parSemE.avisos, cParSemE && (cParSemE.avisos || []).length],
    [8, 0, [{ peca: 'Bolso', tam: 'M', motivo: 'par sem espelhar no sentido único' }], 1]],
  ['duas abas: roupa so no tecido principal (15, nao 30)', duasAbas, [{}, 3, 15, { R1: { M: 15 } }, true]],
  ['tubular ignora ourelas na largura util', cTubOurela && cTubOurela.largUtil, 1600],
  ['peso das pecas = area x gram x pecas (aberto, 3 camadas)', rPeso && [cPeso.pecasTotal, rPeso.pesoPecas], [4, 0.04 * 0.16 * 4 * 3], 1e-9],
  ['peso das pecas = area x gram x pecas (tubular, 3 camadas)', rPesoT && [cPesoT.pecasTotal, rPesoT.pesoPecas], [4, 0.04 * 0.16 * 4 * 3], 1e-9],
  ['review5 dobra tubular: meia peca na borda Y=0', dobraT.length && [dobraT.length, dobraT[0].borda0, dobraT[0].rende, dobraT[0].rasters.length, [dobraT[0].rasters[0].cw, dobraT[0].rasters[0].ch]], [4, true, 1, 1, [10, 8]]],
  ['review5 dobra: corte encosta em Y=0', !!dobraT.length && dobraT[0].pts.filter(q => q[1] === 0).length >= 2 && Math.min(...dobraT[0].pts.map(q => q[1])) === 0, true],
  ['sentidoUnico: todas as variantes rot 0', [su.length, su.every(x => x.rot === 'nenhuma' && x.rasters.length === 1)], [8, true]],
  ['encolhimento 10% C: comp >= 1,1x', !!(cSem && cEnc) && cEnc.comp >= 1.1 * cSem.comp - 20, true],
  ['encolhimento escala no item', (pe([pc()], tec({ encolhC: 10, encolhL: 5 }))[0] || {}).escala, { x: 1.1, y: 1.05 }, 1e-9],
  ['tecido da aba: principal sem o forro', naPrincipal.map(x => x.nome), ['Frente', 'Frente', 'Frente', 'Frente', 'Bolso', 'Bolso', 'Bolso', 'Bolso']],
  ['tecido da aba: forro so o forro', [noForro.length, noForro.every(x => x.nome === 'Forro')], [4, true]],
  ['selecao de pecas por nome', [soBolso.length, soBolso.every(x => x.nome === 'Bolso')], [4, true]],
  ['calcularEnfesto largUtil, cabeceira e aproveitamento', cCab && [cCab.largUtil, cCab.comp, cCab.areaPecas, cCab.aproveitamento], [1550, 240, 160000, 160000 / (240 * 1550)], 1e-9],
  ['calcularEnfesto grade por camada', cCab && cCab.grade, { R1: { M: 4 } }],
  ['calcularEnfesto posicoes dentro', !!cCab && posicoesOk(cCab.itens, cCab, 1550), true],
);

const perto = (a, b, tol) => typeof a === 'number' ? Math.abs(a - b) <= tol
  : a && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k], tol)) : a === b;

let falhas = 0;
for (const [nome, obtido, esperado, tol = TOL] of testes) {
  if (!perto(obtido, esperado, tol)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ molde: ' + testes.length + ' asserções OK');
