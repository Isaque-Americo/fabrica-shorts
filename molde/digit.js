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
    if (cruzes.length < 4) return 'Marque pelo menos 4 cruzes na foto.';
    // 4 cruzes numa linha só não formam célula: nada para emendar
    return celulas(cruzes, esp).length ? null : 'As cruzes não formam um quadrado da grade. A letra é a linha e o número a coluna: A1 A2 em cima, B1 B2 embaixo.';
  }

  // retângulo de 4 cantos (A1 cima-esq, A2 cima-dir, B2 baixo-dir, B1 baixo-esq), w×h em mm; H leva mm -> px da foto
  // os 4 cantos pela posição na foto (a ordem do clique não importa): cima-esq A1, cima-dir A2, baixo-esq B1, baixo-dir B2
  // shortcut: supõe a foto com o retângulo "em pé" (largura na horizontal); foto girada 90° troca w com h
  function ordenarCantos(cruzes) {
    if (cruzes.length < 4) return null;
    const porY = [...cruzes].sort((a, b) => a.y - b.y), ex = (a, b) => a.x - b.x;
    const [tl, tr] = porY.slice(0, 2).sort(ex), [bl, br] = porY.slice(2, 4).sort(ex);
    return [{ ...tl, rot: 'A1' }, { ...tr, rot: 'A2' }, { ...bl, rot: 'B1' }, { ...br, rot: 'B2' }];
  }
  function cantosRet(cruzes, w, h) {
    const q = ordenarCantos(cruzes);
    if (!q) return null;
    return homografia([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }], q);
  }

  // quanto a diagonal medida com a trena foge do retângulo ideal (mm): fita fora de esquadro ou medida errada
  const desvioDiag = (w, h, diag) => Math.abs(diag - Math.hypot(w, h));

  // próximo rótulo: o canto que falta na célula mais completa (lendo linha a linha)
  function sugerirRot(cruzes, esp) {
    const m = indice(cruzes, esp);
    if (!m.size) return 'A1';
    const rot = (i, j) => String.fromCharCode(65 + j) + (i + 1);
    let melhor = null;
    for (const k of m.keys()) {
      const [ci, cj] = k.split(',').map(Number);
      for (const [i, j] of [[ci - 1, cj - 1], [ci, cj - 1], [ci - 1, cj], [ci, cj]]) {
        if (i < 0 || j < 0 || j > 25) continue;
        const cantos = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]], falta = cantos.filter(([x, y]) => !m.has(x + ',' + y));
        if (!falta.length) continue;
        const n = 4 - falta.length, [fx, fy] = falta[0];
        if (!melhor || n > melhor.n || (n === melhor.n && (fy < melhor.y || (fy === melhor.y && fx < melhor.x)))) melhor = { n, x: fx, y: fy };
      }
    }
    return rot(melhor.x, melhor.y);
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
    let erro = 0, feitas = 0;
    for (let k = 0; k < n; k++) {
      const resto = ok.filter((_, i) => i !== k), H = homografia(resto, resto.map(c => rotMm(c.rot, esp)));
      if (!H) continue; // sobrou 3 em linha (ex.: quadrado + 1 sem um canto): esta rodada não confere nada
      const p = aplicarH(H, ok[k]), alvo = rotMm(ok[k].rot, esp);
      erro = Math.max(erro, Math.hypot(p.x - alvo.x, p.y - alvo.y));
      feitas++;
    }
    // nenhuma rodada possível: cruzes todas em linha, ajuste impossível
    return { erro: feitas ? erro : Infinity, n };
  }

  function cobertura(fotos, esp) {
    const s = new Set();
    for (const f of fotos) for (const c of celulas(f.cruzes, esp)) s.add(c.i + ',' + c.j);
    return s;
  }
  const chave = (p, esp) => Math.floor(p.x / esp) + ',' + Math.floor(p.y / esp);
  const foraDaCobertura = (pts, cob, esp) => pts.map(p => !cob.has(chave(p, esp)));
  // pixels de borda (px da folha) cortados: na beirada da imagem ou com ele/um vizinho 4-conexo em célula sem foto
  // (o papel pode continuar além do que foi fotografado e o contorno sai reto ali)
  function bordaFora(pxPts, W, H, x0, y0, mmPx, cob, esp) {
    const sem = (x, y) => !cob.has(chave({ x: x0 + (x + 0.5) * mmPx, y: y0 + (y + 0.5) * mmPx }, esp));
    return pxPts.map(({ x, y }) => x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1
      || sem(x, y) || sem(x - 1, y) || sem(x + 1, y) || sem(x, y - 1) || sem(x, y + 1));
  }

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
    const n = w * h, mask = new Uint8Array(n);
    let r = 0, gg = 0, b = 0, c = 0;
    for (let y = Math.max(0, sy - 2); y <= Math.min(h - 1, sy + 2); y++) for (let x = Math.max(0, sx - 2); x <= Math.min(w - 1, sx + 2); x++) {
      const o = (y * w + x) * 4; r += rgba[o]; gg += rgba[o + 1]; b += rgba[o + 2]; c++;
    }
    r /= c; gg /= c; b /= c;
    const perto = i => Math.hypot(rgba[i * 4] - r, rgba[i * 4 + 1] - gg, rgba[i * 4 + 2] - b) <= tol;
    if (sx < 0 || sy < 0 || sx >= w || sy >= h || !perto(sy * w + sx)) return mask;
    inundar(mask, w, h, sy * w + sx, perto);
    // fundo = o que alcança a borda sem passar pela região; o resto é furo
    const fundo = new Uint8Array(n), livre = i => !mask[i];
    const semear = i => { if (!fundo[i] && !mask[i]) inundar(fundo, w, h, i, livre); };
    for (let x = 0; x < w; x++) { semear(x); semear((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { semear(y * w); semear(y * w + w - 1); }
    for (let i = 0; i < n; i++) if (!fundo[i]) mask[i] = 1;
    return limpar(semFio(mask, w, h, sy * w + sx), w, h);
  }

  // inunda m (4-conexo) a partir de s sobre pixels com ok(i) e ainda sem marca; marca com 1
  function inundar(m, w, h, s, ok) {
    const n = w * h, pilha = new Int32Array(n);
    let t = 0; m[s] = 1; pilha[t++] = s;
    while (t) {
      const i = pilha[--t], x = i % w;
      if (x > 0 && !m[i - 1] && ok(i - 1)) { m[i - 1] = 1; pilha[t++] = i - 1; }
      if (x < w - 1 && !m[i + 1] && ok(i + 1)) { m[i + 1] = 1; pilha[t++] = i + 1; }
      if (i >= w && !m[i - w] && ok(i - w)) { m[i - w] = 1; pilha[t++] = i - w; }
      if (i < n - w && !m[i + w] && ok(i + w)) { m[i + w] = 1; pilha[t++] = i + w; }
    }
  }

  // mínimo (erosão) ou máximo (dilatação) 3x3, separável; fora da imagem repete a beirada para não comer a região que encosta nela
  function morf(src, w, h, max) {
    const t = new Uint8Array(w * h), o = new Uint8Array(w * h), jun = (a, b, c) => max ? (a | b | c) : (a & b & c);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; t[i] = jun(src[x > 0 ? i - 1 : i], src[i], src[x < w - 1 ? i + 1 : i]); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; o[i] = jun(t[y > 0 ? i - w : i], t[i], t[y < h - 1 ? i + w : i]); }
    return o;
  }

  // abertura seguida de fecho: apaga pente e baía de até r px na beirada (sombra, vinco, foco ruim), que viram
  // dezenas de vértices falsos no Douglas-Peucker. Retângulo e quina reta sobrevivem (elemento quadrado).
  // shortcut: r fixo em 1 px; subir para 2 se a foto for muito maior que a folha e a beirada continuar tremida.
  function limpar(mask, w, h, r = 1) {
    let m = mask;
    for (let i = 0; i < r; i++) m = morf(m, w, h, false);
    for (let i = 0; i < 2 * r; i++) m = morf(m, w, h, true);
    for (let i = 0; i < r; i++) m = morf(m, w, h, false);
    return m;
  }

  // corta o fio fino do vazamento (a tinta escapa por uma fresta de sombra e corre pela beirada da folha).
  // A erosão de r px diz o que é corpo grosso e corta o pescoço; fica só o pedaço do clique; depois o detalhe
  // original volta onde encosta nesse corpo. Assim quina viva e bico colado na peça ficam inteiros, mas o que
  // só se segurava pela fresta some. shortcut: r = 3 px; baixar se um molde de verdade tiver pescoço legítimo fino.
  function semFio(mask, w, h, seed, r = 3) {
    const n = w * h;
    let a = mask;
    for (let i = 0; i < r; i++) a = morf(a, w, h, false);
    for (let i = 0; i < r; i++) a = morf(a, w, h, true);
    if (a[seed]) { const c = new Uint8Array(n); inundar(c, w, h, seed, i => a[i] === 1); a = c; } // semente comida pela erosão: não filtra
    for (let i = 0; i < r; i++) a = morf(a, w, h, true);
    const o = new Uint8Array(n);
    for (let i = 0; i < n; i++) o[i] = a[i] & mask[i];
    return o;
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

  // Folha de fundo: f = {x0,y0,tx,ty,ang}. Ponto local s (mm, sem ajuste) vai para R(ang)(s - o) + o + t,
  // com o = (x0,y0) (canto da folha), ang em graus (positivo = horário na tela, y para baixo), t = (tx,ty).
  const rot = (v, a) => { const r = a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; };
  function folhaParaMolde(f, s) { const r = rot({ x: s.x - f.x0, y: s.y - f.y0 }, f.ang); return { x: r.x + f.x0 + f.tx, y: r.y + f.y0 + f.ty }; }
  function moldeParaFolha(f, p) { const r = rot({ x: p.x - f.x0 - f.tx, y: p.y - f.y0 - f.ty }, -f.ang); return { x: r.x + f.x0, y: r.y + f.y0 }; }
  // 2 pares: S1,S2 = pontos clicados na folha (coordenadas locais); P1,P2 = pontos do molde. Giro + deslocamento, sem escala:
  // o giro vem dos vetores S1S2 -> P1P2; o deslocamento põe o meio de S no meio de P. null se S1 = S2 ou P1 = P2.
  function alinharFolha(f, S1, S2, P1, P2) {
    const vs = { x: S2.x - S1.x, y: S2.y - S1.y }, vp = { x: P2.x - P1.x, y: P2.y - P1.y };
    if (Math.hypot(vs.x, vs.y) < 1e-6 || Math.hypot(vp.x, vp.y) < 1e-6) return null;
    const ang = (Math.atan2(vp.y, vp.x) - Math.atan2(vs.y, vs.x)) * 180 / Math.PI;
    const r = rot({ x: (S1.x + S2.x) / 2 - f.x0, y: (S1.y + S2.y) / 2 - f.y0 }, ang);
    return { ang, tx: (P1.x + P2.x) / 2 - r.x - f.x0, ty: (P1.y + P2.y) / 2 - r.y - f.y0 };
  }

  const MoldeDigit = { rotMm, homografia, aplicarH, inversa, validarCruzes, sugerirRot, cantosRet, ordenarCantos, desvioDiag, celulas, conferir, cobertura, foraDaCobertura, bordaFora, melhorFoto, escalaFolha, pintar, limpar, semFio, borda, simplificar, paraMolde, folhaParaMolde, moldeParaFolha, alinharFolha };
  g.MoldeDigit = MoldeDigit;
  if (typeof module !== 'undefined') module.exports = MoldeDigit;
})(typeof window !== 'undefined' ? window : globalThis);
