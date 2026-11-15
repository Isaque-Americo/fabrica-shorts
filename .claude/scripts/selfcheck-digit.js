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

// contorno automático: retângulo 120x90 com ruído e círculo r50; borda = pixels de dentro (cantos 40..159 x 30..119)
const img = fn => { const d = new Uint8ClampedArray(200 * 150 * 4); for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) { const v = fn(x, y), o = (y * 200 + x) * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; } return d; };
const ruido = [[50, 40], [70, 100], [120, 50], [140, 110], [90, 35], [60, 80]];
const imRet = img((x, y) => ruido.some(([a, b]) => a === x && b === y) ? 10 : x >= 40 && x <= 159 && y >= 30 && y <= 119 ? 255 : 40);
const imCir = img((x, y) => Math.hypot(x - 100, y - 75) <= 50 ? 255 : 40);
const mRet = D.pintar(imRet, 200, 150, 100, 75, 60);
const bRet = D.borda(mRet, 200, 150), sRet = D.simplificar(bRet, 1.5);
const cantos = [[40, 30], [159, 30], [159, 119], [40, 119]];
const mol = D.paraMolde(D.simplificar(D.borda(D.pintar(imCir, 200, 150, 100, 75, 60), 200, 150), 0.8));
let dev = 0;
mol.seg.forEach((s, k) => {
  if (s.tipo !== 'curva') return;
  const a = mol.pts[k], b = mol.pts[(k + 1) % mol.pts.length];
  for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t, f = c => u * u * u * a[c] + 3 * u * u * t * s.c1[c] + 3 * u * t * t * s.c2[c] + t * t * t * b[c]; dev = Math.max(dev, Math.abs(Math.hypot(f('x') - 100, f('y') - 75) - 50)); }
});
testes.push(
  ['pintar soma', mRet.reduce((a, b) => a + b, 0), 120 * 90],
  ['borda fechada sem repetir', bRet.length > 4 && (bRet[0].x !== bRet[bRet.length - 1].x || bRet[0].y !== bRet[bRet.length - 1].y), true],
  ['simplificar 4 cantos', sRet.length, 4],
  ['simplificar cantos', cantos.every(([x, y]) => sRet.some(p => Math.hypot(p.x - x, p.y - y) <= 1)), true],
  ['paraMolde retângulo', D.paraMolde(sRet).seg.map(s => s.tipo), ['linha', 'linha', 'linha', 'linha']],
  ['paraMolde círculo curvas', mol.seg.length > 4 && mol.seg.every(s => s.tipo === 'curva'), true],
  ['paraMolde círculo raio', dev <= 1.5, true],
);

const perto = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9
  : a && b && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k])) : a === b;
let falhas = 0;
for (const [nome, obtido, esperado] of testes) {
  if (!perto(obtido, esperado)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ digit: ' + testes.length + ' asserções OK');
