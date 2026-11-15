#!/usr/bin/env node
// Self-check da digitalização (molde/digit.js, matemática pura). Falha = saída 2.
const path = require('path');
const D = require(path.join(__dirname, '..', '..', 'molde', 'digit.js'));

const esp = 500;
const Hv = [1.2, 0.05, 30, -0.03, 1.1, 40, 0.0001, 0.00005, 1]; // mm -> px
const foto = (rots, dx = 0, dy = 0, w = 1600, h = 1200) => ({
  w, h, cruzes: rots.map(rot => { const p = D.aplicarH(Hv, D.rotMm(rot, esp)); return { rot, x: p.x + dx, y: p.y + dy }; })
});
const A = foto(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
const B = foto(['A1', 'A2', 'A3', 'B1', 'B2', 'B3'], -218, 338); // ponto {900,250} cai perto do centro
const movida = { ...A, cruzes: A.cruzes.map(c => c.rot === 'B2' ? { ...c, x: c.x + 10 } : c) };
const Hq = D.homografia([0, 1, 2, 3].map(i => D.rotMm(['A1', 'A2', 'B1', 'B2'][i], esp)), A.cruzes.filter(c => ['A1', 'A2', 'B1', 'B2'].includes(c.rot)));
const q = D.aplicarH(Hq, { x: 250, y: 250 }), r = D.aplicarH(Hv, { x: 250, y: 250 });
const cob = D.cobertura([A], esp);
const inv = D.aplicarH(D.inversa(Hv), D.aplicarH(Hv, { x: 300, y: 200 }));

const testes = [
  ['rotMm B3', D.rotMm('B3', esp), { x: 1000, y: 500 }],
  ['rotMm minúscula', D.rotMm('a1', esp), { x: 0, y: 0 }],
  ['rotMm inválido', D.rotMm('1A', esp), null],
  ['homografia recupera Hv', Math.hypot(q.x - r.x, q.y - r.y) < 1e-6, true],
  ['inversa', Math.hypot(inv.x - 300, inv.y - 200) < 1e-6, true],
  ['homografia degenerada', D.homografia([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]), null],
  ['validarCruzes repetida', /A1/.test(D.validarCruzes([...A.cruzes, A.cruzes[0]], esp)), true],
  ['validarCruzes rótulo inválido', typeof D.validarCruzes([{ rot: 'zz', x: 0, y: 0 }, ...A.cruzes], esp), 'string'],
  ['validarCruzes 3 cruzes', typeof D.validarCruzes(A.cruzes.slice(0, 3), esp), 'string'],
  ['validarCruzes ok', D.validarCruzes(A.cruzes, esp), null],
  ['celulas', D.celulas(A.cruzes, esp).map(c => c.i + ',' + c.j).join(' '), '0,0 1,0'],
  ['conferir exato', D.conferir(A.cruzes, esp).erro < 0.01, true],
  ['conferir 10 px', D.conferir(movida.cruzes, esp).erro > 2, true],
  ['conferir 4 cruzes', D.conferir(A.cruzes.slice(0, 4), esp).erro, null],
  ['cobertura', [cob.has('0,0'), cob.has('1,0'), cob.has('0,1')], [true, true, false]],
  ['foraDaCobertura', D.foraDaCobertura([{ x: 100, y: 100 }, { x: 100, y: 700 }], cob, esp), [false, true]],
  ['melhorFoto', (D.melhorFoto([A, B], { x: 900, y: 250 }, esp) || {}).k, 1],
  ['melhorFoto fora', D.melhorFoto([A], { x: 100, y: 700 }, esp), null],
];

const perto = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9
  : a && b && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k])) : a === b;
let falhas = 0;
for (const [nome, obtido, esperado] of testes) {
  if (!perto(obtido, esperado)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ digit: ' + testes.length + ' asserções OK');
