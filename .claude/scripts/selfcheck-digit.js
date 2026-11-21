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

// retângulo de 4 cantos: A1 cima-esq, A2 cima-dir, B2 baixo-dir, B1 baixo-esq
const fr = (w, h) => [['A1', 0, 0], ['A2', w, 0], ['B2', w, h], ['B1', 0, h]].map(([rot, x, y]) => { const p = D.aplicarH(Hv, { x, y }); return { rot, x: p.x, y: p.y }; });
const Hr = D.cantosRet(fr(800, 500), 800, 500), pr = D.aplicarH(Hr, { x: 400, y: 250 }), pv = D.aplicarH(Hv, { x: 400, y: 250 });

const testes = [
  ['cantosRet mapeia o centro', Math.hypot(pr.x - pv.x, pr.y - pv.y) < 1e-6, true],
  ['cantosRet falta um canto', D.cantosRet(fr(800, 500).slice(0, 3), 800, 500), null],
  // ordem do clique não importa: cantos achados pela posição na foto (rótulos errados de propósito)
  ['cantosRet embaralhado', (() => { const e = fr(800, 500).map((c, i) => ({ ...c, rot: ['B2', 'A1', 'B1', 'A2'][i] })).reverse(); const p = D.aplicarH(D.cantosRet(e, 800, 500), { x: 400, y: 250 }); return Math.hypot(p.x - pv.x, p.y - pv.y) < 1e-6; })(), true],
  ['ordenarCantos rótulos', D.ordenarCantos(fr(800, 500).reverse()).map(c => c.rot), ['A1', 'A2', 'B1', 'B2']],
  ['desvioDiag exata', D.desvioDiag(800, 500, Math.hypot(800, 500)) < 1e-9, true],
  ['desvioDiag 10 mm', Math.abs(D.desvioDiag(800, 500, Math.hypot(800, 500) + 10) - 10) < 1e-9, true],
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
  ['validarCruzes 4 numa linha', /quadrado/.test(D.validarCruzes(foto(['A1', 'A2', 'A3', 'A4'], 0, 0).cruzes, esp)), true],
  ['sugerirRot vazio', D.sugerirRot([], esp), 'A1'],
  ['sugerirRot A1', D.sugerirRot(foto(['A1'], 0, 0).cruzes, esp), 'A2'],
  ['sugerirRot A1 A2', D.sugerirRot(foto(['A1', 'A2'], 0, 0).cruzes, esp), 'B1'],
  ['sugerirRot A1 A2 B1', D.sugerirRot(foto(['A1', 'A2', 'B1'], 0, 0).cruzes, esp), 'B2'],
  ['sugerirRot quadrado completo', D.sugerirRot(foto(['A1', 'A2', 'B1', 'B2'], 0, 0).cruzes, esp), 'A3'],
  ['celulas', D.celulas(A.cruzes, esp).map(c => c.i + ',' + c.j).join(' '), '0,0 1,0'],
  ['conferir exato', D.conferir(A.cruzes, esp).erro < 0.01, true],
  ['conferir 10 px', D.conferir(movida.cruzes, esp).erro > 2, true],
  ['conferir 4 cruzes', D.conferir(A.cruzes.slice(0, 4), esp).erro, null],
  // quadrado + 1: tirar um canto deixa 3 em linha; essa rodada é pulada, as outras conferem
  ['conferir quadrado + A3', D.conferir(foto(['A1', 'A2', 'B1', 'B2', 'A3']).cruzes, esp).erro < 0.01, true],
  ['conferir quadrado + A3 movida', D.conferir(foto(['A1', 'A2', 'B1', 'B2', 'A3']).cruzes.map(c => c.rot === 'A3' ? { ...c, x: c.x + 10 } : c), esp).erro > 2, true],
  ['conferir 5 em linha', D.conferir(foto(['A1', 'A2', 'A3', 'A4', 'A5']).cruzes, esp).erro === Infinity, true],
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
// círculo em mm: coordenadas de px multiplicadas por mmPx; passo = mmPx
const circMm = (mmPx, tol) => {
  const b = D.borda(D.pintar(imCir, 200, 150, 100, 75, 60), 200, 150).map(p => ({ x: p.x * mmPx, y: p.y * mmPx }));
  const m = D.paraMolde(D.simplificar(b, tol), { quina: 35, passo: mmPx });
  let dv = 0;
  m.seg.forEach((s, k) => {
    if (s.tipo !== 'curva') return;
    const a = m.pts[k], c = m.pts[(k + 1) % m.pts.length];
    for (let i = 0; i <= 10; i++) { const t = i / 10, u = 1 - t, f = q => u * u * u * a[q] + 3 * u * u * t * s.c1[q] + 3 * u * t * t * s.c2[q] + t * t * t * c[q]; dv = Math.max(dv, Math.abs(Math.hypot(f('x') - 100 * mmPx, f('y') - 75 * mmPx) - 50 * mmPx)); }
  });
  return [m.seg.length > 4 && m.seg.every(s => s.tipo === 'curva'), dv <= 1.5 * mmPx];
};
const rEsc = D.escalaFolha ? D.escalaFolha(4000, 3000) : 0;
testes.push(
  ['escalaFolha 1,5x1 m', D.escalaFolha && D.escalaFolha(1500, 1000), 0.5],
  ['escalaFolha grande', rEsc > 0.5 && (4000 / rEsc) * (3000 / rEsc) <= 16e6, true],
  ['círculo mm 2 (tol 1)', circMm(2, 1), [true, true]],
  ['círculo mm 0.5 (tol 0.25)', circMm(0.5, 0.25), [true, true]],
  ['pintar soma', mRet.reduce((a, b) => a + b, 0), 120 * 90],
  ...(() => {
    // foto manchada (veio da mesa, papel amassado): sem o borrar de pintar dá 229 pontos e só 97% da folha,
    // porque a textura serrilha a beirada e abre baía dentro do papel. Números medidos nesta mesma cena.
    const W = 600, H = 450, M = 60, ideal = (W - 2 * M - 1) * (H - 2 * M - 1), P = 8, A = 40;
    const ru = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(777);
    const gw = Math.ceil(W / P) + 2, gh = Math.ceil(H / P) + 2, g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = ru() - 0.5;
    const foto = (amp) => { // papel sobre mesa, com gradiente de luz e a mancha interpolada da grade g
      const im = new Uint8ClampedArray(W * H * 4);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = Math.floor(x / P), j = Math.floor(y / P), tx = x / P - i, ty = y / P - j;
        const t = (g[j * gw + i] * (1 - tx) + g[j * gw + i + 1] * tx) * (1 - ty) + (g[(j + 1) * gw + i] * (1 - tx) + g[(j + 1) * gw + i + 1] * tx) * ty;
        const c = (x > M && x < W - M && y > M && y < H - M) ? [205, 193, 172] : [118, 118, 124], luz = 1 - 0.18 * x / W, o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) im[o + k] = c[k] * luz + t * 2 * amp;
        im[o + 3] = 255;
      }
      return im;
    };
    const mm = (im) => { const m = D.pintar(im, W, H, W >> 1, H >> 1, 45); let a = 0; for (let i = 0; i < m.length; i++) a += m[i]; return { pts: D.simplificar(D.borda(m, W, H), 1.5).length, area: a }; };
    const manchada = mm(foto(A)), chapada = mm(foto(0)), plano = new Uint8ClampedArray(W * H * 4).fill(177);
    return [
      ['borrar não mexe em cor chapada', D.borrar(plano, W, H).every((v, i) => v === plano[i]), true],
      ['pintar trata a foto manchada', [manchada.pts <= 130, manchada.area >= 0.98 * ideal], [true, true]],
      ['tratamento não desloca beirada limpa', [chapada.pts, chapada.area], [4, ideal]],
    ];
  })(),
  ...(() => {
    // beirada em pente (sombra/vinco): limpar tem de derrubar os vértices falsos sem mexer em retângulo
    const W = 300, H = 200, ru = (s => () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)(11);
    const puro = new Uint8Array(W * H), pente = new Uint8Array(W * H);
    for (let y = 40; y <= 160; y++) for (let x = 50; x <= 250; x++) { puro[y * W + x] = 1; pente[y * W + x] = 1; }
    for (let y = 40; y <= 160; y++) { const d = Math.round(ru() * 5); for (let x = 50; x < 50 + d; x++) pente[y * W + x] = 0; }
    const vert = m => D.simplificar(D.borda(m, W, H), 1.5).length;
    const limpo = D.limpar(puro, W, H);
    // vazamento: a mancha escapa por um pescoço de 2 px e estoura num bolsão do fundo
    const sem = 90 * W + 150, cx = (m, xa, xb, ya, yb) => { for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) m[y * W + x] = 1; return m; };
    const fio = cx(new Uint8Array(W * H), 50, 250, 40, 160);
    for (let y = 160; y <= 190; y++) { fio[y * W + 49] = 1; fio[y * W + 50] = 1; }
    cx(fio, 5, 49, 185, 195);
    const semPuro = D.semFio(puro, W, H, sem), semF = D.semFio(fio, W, H, sem), abaixo = m => { let c = 0; for (let y = 170; y < H; y++) for (let x = 0; x < W; x++) c += m[y * W + x]; return c; };
    // bico de 7 px colado na peça e pique de 3 px cortado para dentro: nenhum dos dois pode sumir
    const bico = cx(new Uint8Array(W * H), 50, 250, 40, 160); cx(bico, 147, 153, 20, 39);
    const sb = D.semFio(bico, W, H, sem); let alt = 0;
    for (let y = 20; y < 40; y++) { let t = 0; for (let x = 147; x <= 153; x++) t += sb[y * W + x]; if (t) alt++; }
    const piq = cx(new Uint8Array(W * H), 50, 250, 40, 160);
    for (let y = 40; y <= 59; y++) for (let x = 149; x <= 151; x++) piq[y * W + x] = 0;
    const sp = D.limpar(D.semFio(piq, W, H, sem), W, H); let fundoPiq = 0;
    for (let y = 40; y < 60; y++) { let t = 0; for (let x = 149; x <= 151; x++) t += sp[y * W + x]; if (!t) fundoPiq++; }
    return [
      ['limpar não mexe em retângulo', puro.every((v, i) => v === limpo[i]), true],
      ['limpar derruba pente', vert(D.limpar(pente, W, H)) * 3 < vert(pente), true],
      ['semFio não mexe em retângulo', puro.every((v, i) => v === semPuro[i]), true],
      ['semFio corta o vazamento', [abaixo(fio) > 0, abaixo(semF)], [true, 0]],
      ['semFio guarda bico de 7 px', alt, 20],
      ['semFio guarda pique de 3 px', fundoPiq, 20],
    ];
  })(),
  ['borda fechada sem repetir', bRet.length > 4 && (bRet[0].x !== bRet[bRet.length - 1].x || bRet[0].y !== bRet[bRet.length - 1].y), true],
  ['simplificar 4 cantos', sRet.length, 4],
  ['simplificar cantos', cantos.every(([x, y]) => sRet.some(p => Math.hypot(p.x - x, p.y - y) <= 1)), true],
  ['paraMolde retângulo', D.paraMolde(sRet).seg.map(s => s.tipo), ['linha', 'linha', 'linha', 'linha']],
  ['paraMolde círculo curvas', mol.seg.length > 4 && mol.seg.every(s => s.tipo === 'curva'), true],
  ['paraMolde círculo raio', dev <= 1.5, true],
);

{ // folha de fundo: alinhar com 2 pares
  const f = { x0: 10, y0: -5, tx: 0, ty: 0, ang: 0 }, S1 = { x: 20, y: 0 }, S2 = { x: 120, y: 0 };
  const verd = { x0: 10, y0: -5, tx: 30, ty: -12, ang: 25 };
  const P1 = D.folhaParaMolde(verd, S1), P2 = D.folhaParaMolde(verd, S2);
  const r = D.alinharFolha(f, S1, S2, P1, P2), g = { ...f, ...r };
  testes.push(
    ['alinhar ang', r.ang, 25],
    ['alinhar S1->P1', D.folhaParaMolde(g, S1), P1],
    ['alinhar S2->P2', D.folhaParaMolde(g, S2), P2],
    ['alinhar tx/ty', [r.tx, r.ty], [30, -12]],
    ['ida e volta', D.moldeParaFolha(verd, D.folhaParaMolde(verd, { x: 33, y: 44 })), { x: 33, y: 44 }],
    ['alinhar pontos iguais', D.alinharFolha(f, S1, S1, P1, P2), null],
  );
}

{ // bordaFora: folha 20x10 px, 1 mm/px, x0=y0=0, esp 10 -> células 0,0 e 1,0; só 0,0 coberta
  const W = 20, H = 10, cb = new Set(['0,0']);
  const mk = (xa, xb, ya, yb) => { const m = new Uint8Array(W * H); for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) m[y * W + x] = 1; return D.borda(m, W, H); };
  const fora = (b, cob) => D.bordaFora(b, W, H, 0, 0, 1, cob, 10);
  const cbTudo = new Set(['0,0', '1,0']);
  testes.push(
    ['bordaFora encosta na borda da imagem', fora(mk(0, 4, 2, 6), cbTudo).some(Boolean), true],
    ['bordaFora vizinha de célula sem foto', fora(mk(3, 9, 2, 6), cb).some(Boolean), true],
    ['bordaFora vizinha só no x=9', fora(mk(3, 9, 2, 6), cb).filter(Boolean).length, mk(3, 9, 2, 6).filter(p => p.x === 9).length],
    ['bordaFora dentro e longe da borda', fora(mk(2, 7, 2, 7), cb).some(Boolean), false],
  );
}

const perto =(a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= 1e-9
  : a && b && typeof a === 'object' ? Object.keys(b).length === Object.keys(a).length && Object.keys(b).every(k => perto(a[k], b[k])) : a === b;
let falhas = 0;
for (const [nome, obtido, esperado] of testes) {
  if (!perto(obtido, esperado)) { falhas++; console.error('FALHA ' + nome + ': obtido ' + JSON.stringify(obtido) + ', esperado ' + JSON.stringify(esperado)); }
}
if (falhas) process.exit(2);
console.log('✓ digit: ' + testes.length + ' asserções OK');
