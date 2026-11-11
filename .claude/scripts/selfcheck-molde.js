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
];

const perto = (a, b, tol) => typeof a === 'number' ? Math.abs(a - b) <= tol
  : a && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k], tol)) : a === b;

let falhas = 0;
for (const [nome, obtido, esperado, tol = TOL] of testes) {
  if (!perto(obtido, esperado, tol)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ molde: ' + testes.length + ' asserções OK');
