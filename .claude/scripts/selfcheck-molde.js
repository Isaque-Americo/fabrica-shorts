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
  ['molParaProduto chaves', Object.keys(prodRet).sort(), ['arq', 'origem', 'pecas', 'porTam', 'un']],
  ['molParaProduto peca chaves', Object.keys(prodRet.pecas[0]).sort(), ['h', 'pts', 'qtd', 'rot', 'tecido', 'w']],
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
const semNovas = pecas => pecas.map(({ rot, tecido, ...r }) => r);
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
);

const perto = (a, b, tol) => typeof a === 'number' ? Math.abs(a - b) <= tol
  : a && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k], tol)) : a === b;

let falhas = 0;
for (const [nome, obtido, esperado, tol = TOL] of testes) {
  if (!perto(obtido, esperado, tol)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ molde: ' + testes.length + ' asserções OK');
