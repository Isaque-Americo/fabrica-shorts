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

  const MoldeDigit = { rotMm, homografia, aplicarH, inversa, validarCruzes, celulas, conferir, cobertura, foraDaCobertura, melhorFoto };
  g.MoldeDigit = MoldeDigit;
  if (typeof module !== 'undefined') module.exports = MoldeDigit;
})(typeof window !== 'undefined' ? window : globalThis);
