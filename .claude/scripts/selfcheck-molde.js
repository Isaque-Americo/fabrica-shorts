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

const perto = (a, b, tol) => typeof a === 'number' ? Math.abs(a - b) <= tol
  : a && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k], tol)) : a === b;

let falhas = 0;
for (const [nome, obtido, esperado, tol = TOL] of testes) {
  if (!perto(obtido, esperado, tol)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ molde: ' + testes.length + ' asserções OK');
