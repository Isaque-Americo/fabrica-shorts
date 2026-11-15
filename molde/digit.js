// Digitalização do molde por fotos: grade de cruzes, perspectiva e conferência. Unidades em mm; px nas fotos.
(function (g) {
  // "B3" -> {x: 1000, y: 500} (letra = linha = y, número = coluna = x); null se inválido
  function rotMm(rot, esp) {
    const m = /^([A-Za-z])([1-9]\d*)$/.exec(rot);
    return m ? { x: (+m[2] - 1) * esp, y: (m[1].toUpperCase().charCodeAt(0) - 65) * esp } : null;
  }

  // translada e escala para centroide 0 e distância média √2; devolve T e os pontos normalizados
  function normalizar(ps) {
    const n = ps.length, cx = ps.reduce((s, p) => s + p.x, 0) / n, cy = ps.reduce((s, p) => s + p.y, 0) / n;
    const d = ps.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n;
    const s = d > 1e-12 ? Math.SQRT2 / d : 0;
    return { T: [s, 0, -s * cx, 0, s, -s * cy, 0, 0, 1], pts: ps.map(p => ({ x: (p.x - cx) * s, y: (p.y - cy) * s })), ok: s > 0 };
  }
  const mul = (A, B) => Array.from({ length: 9 }, (_, k) => { const i = Math.floor(k / 3), j = k % 3; return A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; });

  // H (3x3, linha a linha) com para ≈ H·de, mínimos quadrados com h33 = 1 sobre pontos normalizados; null se degenerado
  function homografia(de, para) {
    if (de.length < 4 || de.length !== para.length) return null;
    const a = normalizar(de), b = normalizar(para);
    if (!a.ok || !b.ok) return null;
    const M = Array.from({ length: 8 }, () => new Array(9).fill(0)); // normal: [AᵀA | Aᵀb]
    const acum = (r, y) => { for (let i = 0; i < 8; i++) { for (let j = 0; j < 8; j++) M[i][j] += r[i] * r[j]; M[i][8] += r[i] * y; } };
    a.pts.forEach((p, k) => {
      const q = b.pts[k];
      acum([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y], q.x);
      acum([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y], q.y);
    });
    for (let c = 0; c < 8; c++) { // Gauss com pivô parcial
      let m = c;
      for (let i = c + 1; i < 8; i++) if (Math.abs(M[i][c]) > Math.abs(M[m][c])) m = i;
      if (Math.abs(M[m][c]) < 1e-9) return null;
      [M[c], M[m]] = [M[m], M[c]];
      for (let i = 0; i < 8; i++) if (i !== c) { const f = M[i][c] / M[c][c]; for (let j = c; j < 9; j++) M[i][j] -= f * M[c][j]; }
    }
    const h = M.map((l, i) => l[8] / l[i]);
    const Hn = [...h, 1];
    const H = mul(inversa(b.T), mul(Hn, a.T));
    return H.every(isFinite) && Math.abs(H[8]) > 1e-12 ? H.map(v => v / H[8]) : null;
  }

  function aplicarH(H, p) {
    const w = H[6] * p.x + H[7] * p.y + H[8];
    return { x: (H[0] * p.x + H[1] * p.y + H[2]) / w, y: (H[3] * p.x + H[4] * p.y + H[5]) / w };
  }

  // adjunta (cofatores transpostos); a escala não importa em homografia
  function inversa(H) {
    const [a, b, c, d, e, f, g, h, i] = H;
    return [e * i - f * h, c * h - b * i, b * f - c * e, f * g - d * i, a * i - c * g, c * d - a * f, d * h - e * g, b * g - a * h, a * e - b * d];
  }

  function validarCruzes(cruzes, esp) {
    const vistos = new Set();
    for (const c of cruzes) {
      if (!rotMm(c.rot, esp)) return 'Rótulo inválido: "' + c.rot + '" (use letra e número, como A1).';
      const k = c.rot.toUpperCase();
      if (vistos.has(k)) return 'Rótulo repetido: ' + k + '.';
      vistos.add(k);
    }
    return cruzes.length < 4 ? 'Marque pelo menos 4 cruzes na foto.' : null;
  }

  // cruzes por "coluna,linha" da grade
  function indice(cruzes, esp) {
    const m = new Map();
    for (const c of cruzes) { const p = rotMm(c.rot, esp); if (p) m.set(p.x / esp + ',' + p.y / esp, c); }
    return m;
  }

  // uma célula por quadrado da grade com as 4 cruzes dos cantos; H leva mm -> px
  function celulas(cruzes, esp) {
    const m = indice(cruzes, esp), out = [];
    for (const k of m.keys()) {
      const [i, j] = k.split(',').map(Number);
      const q = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([x, y]) => m.get(x + ',' + y));
      if (q.some(c => !c)) continue;
      const H = homografia([[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([x, y]) => ({ x: x * esp, y: y * esp })), q);
      if (H) out.push({ i, j, H });
    }
    return out;
  }

  // deixa cada cruz de fora, ajusta px->mm com as outras e mede onde ela cai; maior erro em mm
  function conferir(cruzes, esp) {
    const ok = cruzes.filter(c => rotMm(c.rot, esp)), n = ok.length;
    if (n < 5) return { erro: null, n };
    let erro = 0;
    for (let k = 0; k < n; k++) {
      const resto = ok.filter((_, i) => i !== k), H = homografia(resto, resto.map(c => rotMm(c.rot, esp)));
      if (!H) return { erro: Infinity, n };
      const p = aplicarH(H, ok[k]), alvo = rotMm(ok[k].rot, esp);
      erro = Math.max(erro, Math.hypot(p.x - alvo.x, p.y - alvo.y));
    }
    return { erro, n };
  }

  function cobertura(fotos, esp) {
    const s = new Set();
    for (const f of fotos) for (const c of celulas(f.cruzes, esp)) s.add(c.i + ',' + c.j);
    return s;
  }
  const chave = (p, esp) => Math.floor(p.x / esp) + ',' + Math.floor(p.y / esp);
  const foraDaCobertura = (pts, cob, esp) => pts.map(p => !cob.has(chave(p, esp)));

  // foto que deixa p mais perto do centro (distância / max(w,h)), entre as que cobrem a célula de p
  function melhorFoto(fotos, p, esp) {
    let mel = null, md = Infinity;
    fotos.forEach((f, k) => {
      const c = celulas(f.cruzes, esp).find(c => c.i + ',' + c.j === chave(p, esp));
      if (!c) return;
      const q = aplicarH(c.H, p), d = Math.hypot(q.x - f.w / 2, q.y - f.h / 2) / Math.max(f.w, f.h);
      if (d < md) { md = d; mel = { k, x: q.x, y: q.y }; }
    });
    return mel;
  }

  // mm por pixel da folha: 0,5 e sobe de 0,25 em 0,25 até caber em maxPx pixels
  function escalaFolha(wMm, hMm, maxPx = 16e6) {
    let r = 0.5;
    while ((wMm / r) * (hMm / r) > maxPx) r += 0.25;
    return r;
  }

  // ---- contorno automático (px; tudo iterativo, a folha pode ter vários megapixels) ----

  // máscara 0/1 da região 4-conectada de cor ≤ tol (RGB) da média 5×5 na semente; furos internos viram 1
  function pintar(rgba, w, h, sx, sy, tol) {
    const n = w * h, mask = new Uint8Array(n), pilha = new Int32Array(n);
    let r = 0, gg = 0, b = 0, c = 0;
    for (let y = Math.max(0, sy - 2); y <= Math.min(h - 1, sy + 2); y++) for (let x = Math.max(0, sx - 2); x <= Math.min(w - 1, sx + 2); x++) {
      const o = (y * w + x) * 4; r += rgba[o]; gg += rgba[o + 1]; b += rgba[o + 2]; c++;
    }
    r /= c; gg /= c; b /= c;
    const perto = i => Math.hypot(rgba[i * 4] - r, rgba[i * 4 + 1] - gg, rgba[i * 4 + 2] - b) <= tol;
    // inunda a partir de s sobre pixels com ok(i) e ainda sem marca em m; marca com 1
    const inundar = (m, s, ok) => {
      let t = 0; m[s] = 1; pilha[t++] = s;
      while (t) {
        const i = pilha[--t], x = i % w;
        if (x > 0 && !m[i - 1] && ok(i - 1)) { m[i - 1] = 1; pilha[t++] = i - 1; }
        if (x < w - 1 && !m[i + 1] && ok(i + 1)) { m[i + 1] = 1; pilha[t++] = i + 1; }
        if (i >= w && !m[i - w] && ok(i - w)) { m[i - w] = 1; pilha[t++] = i - w; }
        if (i < n - w && !m[i + w] && ok(i + w)) { m[i + w] = 1; pilha[t++] = i + w; }
      }
    };
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || !perto(sy * w + sx)) return mask;
    inundar(mask, sy * w + sx, perto);
    // fundo = o que alcança a borda sem passar pela região; o resto é furo
    const fundo = new Uint8Array(n), livre = i => !mask[i];
    const semear = i => { if (!fundo[i] && !mask[i]) inundar(fundo, i, livre); };
    for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
    for (let i = 0; i < n; i++) if (!fundo[i]) mask[i] = 1;
    return mask;
  }

  // contorno externo (Moore): pixels de dentro da região, em sentido horário na tela, sem repetir o primeiro
  const VIZ = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]]; // O, NO, N, NE, L, SE, S, SO
  function borda(mask, w, h) {
    const dentro = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
    let s = mask.indexOf(1);
    if (s < 0) return [];
    const sx = s % w, sy = (s - sx) / w, pts = [{ x: sx, y: sy }];
    // próximo ponto a partir de (x,y) com o vizinho de entrada na direção d (fundo); acha o 1º dentro girando
    const passo = (x, y, d) => {
      for (let i = 1; i <= 8; i++) {
        const k = (d + i) % 8, nx = x + VIZ[k][0], ny = y + VIZ[k][1];
        if (dentro(nx, ny)) {
          const kb = (d + i - 1) % 8, bx = x + VIZ[kb][0] - nx, by = y + VIZ[kb][1] - ny;
          return { x: nx, y: ny, d: VIZ.findIndex(v => v[0] === bx && v[1] === by) };
        }
      }
      return null;
    };
    let cur = passo(sx, sy, 0);
    if (!cur) return pts;
    const seg = { x: cur.x, y: cur.y };
    for (let guarda = 0; guarda < 4 * w * h; guarda++) {
      if (cur.x === sx && cur.y === sy) { // volta ao início: fecha se o próximo passo repete o primeiro
        const nx = passo(cur.x, cur.y, cur.d);
        if (nx.x === seg.x && nx.y === seg.y) break;
        pts.push({ x: cur.x, y: cur.y }); cur = nx; continue;
      }
      pts.push({ x: cur.x, y: cur.y });
      cur = passo(cur.x, cur.y, cur.d);
    }
    // o início pode ter sido empurrado de novo ao revisitar; remove repetição do primeiro
    while (pts.length > 1 && pts[pts.length - 1].x === sx && pts[pts.length - 1].y === sy) pts.pop();
    return pts;
  }

  const dSeg = (p, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };

  // Douglas-Peucker em polígono fechado; âncoras: ponto mais longe do 1º e o mais longe dele (aproxima o par mais distante)
  function simplificar(pts, tol) {
    const n = pts.length;
    if (n < 4) return pts.slice();
    const longe = k => { let m = 0, md = -1; pts.forEach((p, i) => { const d = Math.hypot(p.x - pts[k].x, p.y - pts[k].y); if (d > md) { md = d; m = i; } }); return m; };
    let i0 = longe(longe(0)), i1 = longe(i0);
    if (i0 > i1) [i0, i1] = [i1, i0];
    const fica = new Uint8Array(n); fica[i0] = fica[i1] = 1;
    const pilha = [[i0, i1], [i1, i0 + n]]; // trechos (a, b) com b > a, índices módulo n
    while (pilha.length) {
      const [a, b] = pilha.pop();
      let m = -1, md = tol;
      for (let i = a + 1; i < b; i++) { const d = dSeg(pts[i % n], pts[a % n], pts[b % n]); if (d > md) { md = d; m = i; } }
      if (m >= 0) { fica[m % n] = 1; pilha.push([a, m], [m, b]); }
    }
    return pts.filter((_, i) => fica[i]);
  }

  // vértices -> traços: giro > quina graus = quina; entre quinas fica linha, no resto curva Catmull-Rom (alças a 1/3)
  function paraMolde(pts, opts = { quina: 35, passo: 1 }) {
    const n = pts.length, lim = opts.quina ?? 35, mind = 2 * (opts.passo || 1); // passo = tamanho de 1 px na unidade dos pontos
    const P = k => pts[((k % n) + n) % n];
    // vizinho no sentido s a ≥ 2 passos (ignora a ponta de 1 px da escadinha de pixels)
    const viz = (k, s) => { let j = k + s; for (let i = 0; i < n / 2 && Math.hypot(P(j).x - P(k).x, P(j).y - P(k).y) < mind; i++) j += s; return P(j); };
    const giro = k => {
      const a = viz(k, -1), b = P(k), c = viz(k, 1);
      let d = Math.abs(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)) * 180 / Math.PI;
      return d > 180 ? 360 - d : d;
    };
    const quina = pts.map((_, k) => giro(k) > lim);
    // alça saindo de P(k) rumo a P(j): 1/3 da corda, na tangente pelos vizinhos (ou na corda, se for quina)
    const alca = (k, j) => {
      const p = P(k), q = P(j), L = Math.hypot(q.x - p.x, q.y - p.y) / 3;
      let tx = q.x - p.x, ty = q.y - p.y;
      if (!quina[((k % n) + n) % n]) { const a = viz(k, -1), c = viz(k, 1); tx = c.x - a.x; ty = c.y - a.y; if (j < k) { tx = -tx; ty = -ty; } }
      const m = Math.hypot(tx, ty) || 1;
      return { x: p.x + tx / m * L, y: p.y + ty / m * L };
    };
    const seg = pts.map((_, k) => quina[k] && quina[(k + 1) % n]
      ? { tipo: 'linha' }
      : { tipo: 'curva', c1: alca(k, k + 1), c2: alca(k + 1, k) });
    return { pts: pts.map(p => ({ x: p.x, y: p.y })), seg };
  }

  const MoldeDigit = { rotMm, homografia, aplicarH, inversa, validarCruzes, celulas, conferir, cobertura, foraDaCobertura, melhorFoto, escalaFolha, pintar, borda, simplificar, paraMolde };
  g.MoldeDigit = MoldeDigit;
  if (typeof module !== 'undefined') module.exports = MoldeDigit;
})(typeof window !== 'undefined' ? window : globalThis);
