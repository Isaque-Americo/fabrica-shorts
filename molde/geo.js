// Geometria do editor de molde. Pontos {x,y} em mm.
(function (g) {
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const meio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // ponto do segmento a–b mais perto de p
  function projSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }
  const distSeg = (p, a, b) => dist(p, projSeg(p, a, b));

  // retas infinitas a1→a2 e b1→b2; ta/tb são os parâmetros sobre cada uma
  function cruzar(a1, a2, b1, b2) {
    const rx = a2.x - a1.x, ry = a2.y - a1.y, sx = b2.x - b1.x, sy = b2.y - b1.y, d = rx * sy - ry * sx;
    if (Math.abs(d) <= 1e-9 * Math.hypot(rx, ry) * Math.hypot(sx, sy)) return null;
    const qx = b1.x - a1.x, qy = b1.y - a1.y, ta = (qx * sy - qy * sx) / d;
    return { p: { x: a1.x + ta * rx, y: a1.y + ta * ry }, ta, tb: (qx * ry - qy * rx) / d };
  }
  const EPS = 1e-9, em01 = t => t >= -EPS && t <= 1 + EPS;
  function intersecao(a1, a2, b1, b2) {
    const c = cruzar(a1, a2, b1, b2);
    return c && em01(c.ta) && em01(c.tb) ? c : null;
  }

  // De Casteljau: divide até os controles ficarem a ≤ tol da corda
  function bezier(a, c1, c2, b, tol = 0.2) {
    const out = [a];
    (function sub(a, c1, c2, b, nivel) {
      if (nivel > 16 || Math.max(distSeg(c1, a, b), distSeg(c2, a, b)) <= tol) { out.push(b); return; }
      const ab = meio(a, c1), bc = meio(c1, c2), cd = meio(c2, b);
      const abc = meio(ab, bc), bcd = meio(bc, cd), m = meio(abc, bcd);
      sub(a, ab, abc, m, nivel + 1);
      sub(m, bcd, cd, b, nivel + 1);
    })(a, c1, c2, b, 0);
    return out;
  }

  function comprimento(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
    return s;
  }

  // fórmula do cadarço, polígono implicitamente fechado; positivo = anti-horário
  function area(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      s += p.x * q.y - q.x * p.y;
    }
    return s / 2;
  }
  const areaAbs = pts => Math.abs(area(pts));

  function bbox(pts) {
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  }

  // n lados com flecha ≤ tol; vértices em r+flecha/2 para o polígono não ficar todo por dentro; começa em (c.x+r, c.y), anti-horário
  function circulo(c, r, tol = 0.2) {
    const n = Math.max(8, Math.ceil(Math.PI / Math.acos(Math.max(0, 1 - tol / r))));
    const R = r * (1 + (1 - Math.cos(Math.PI / n)) / 2);
    return Array.from({ length: n }, (_, i) => {
      const a = 2 * Math.PI * i / n;
      return { x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) };
    });
  }

  // ponto a t (0..1) do comprimento da polilinha, com tangente unitária do trecho
  function pontoEm(pts, t) {
    let alvo = Math.max(0, Math.min(1, t)) * comprimento(pts);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = dist(a, b);
      if (alvo <= d || i === pts.length - 1) {
        const k = d ? Math.min(alvo / d, 1) : 0;
        return {
          p: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k },
          tangente: d ? { x: (b.x - a.x) / d, y: (b.y - a.y) / d } : { x: 1, y: 0 }
        };
      }
      alvo -= d;
    }
    return { p: pts[0], tangente: { x: 1, y: 0 } };
  }

  // linha de corte de um polígono anti-horário; m[i] é a margem da aresta pts[i]→pts[i+1]
  function offset(pts, m) {
    const n = pts.length, ar = [], out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], l = dist(a, b), d = m[i] || 0;
      if (l < EPS) continue; // ponto repetido (junção de curvas) não tem normal
      const nx = (b.y - a.y) / l * d, ny = -(b.x - a.x) / l * d; // à direita = para fora no anti-horário
      ar.push({ a: { x: a.x + nx, y: a.y + ny }, b: { x: b.x + nx, y: b.y + ny }, v: b, d });
    }
    const por = p => { const u = out[out.length - 1]; if (!u || dist(u, p) > 1e-6) out.push(p); };
    ar.forEach((e, i) => {
      const f = ar[(i + 1) % ar.length], c = cruzar(e.a, e.b, f.a, f.b);
      if (c && dist(c.p, e.v) <= 4 * Math.max(e.d, f.d) + EPS) por(c.p);
      else { por(e.b); por(f.a); } // esquadria longa demais ou arestas paralelas: chanfro
    });
    if (out.length > 1 && dist(out[0], out[out.length - 1]) <= 1e-6) out.pop();
    return semLacos(out);
  }

  // corta cada laço no cruzamento e fica com o lado de maior área com sinal (o laço de curva côncava sai invertido)
  function semLacos(pts) {
    for (let mudou = true; mudou;) {
      mudou = false;
      const n = pts.length;
      busca: for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const c = intersecao(pts[i], pts[i + 1], pts[j], pts[(j + 1) % n]);
        if (!c) continue;
        const laco = [c.p, ...pts.slice(i + 1, j + 1)], resto = [...pts.slice(0, i + 1), c.p, ...pts.slice(j + 1)];
        pts = area(resto) >= area(laco) ? resto : laco;
        mudou = true;
        break busca;
      }
    }
    return pts;
  }

  function espelhar(pts, a, b) {
    const l = dist(a, b), ux = (b.x - a.x) / l, uy = (b.y - a.y) / l;
    return pts.map(p => {
      const k = (p.x - a.x) * ux + (p.y - a.y) * uy;
      return { x: 2 * (a.x + k * ux) - p.x, y: 2 * (a.y + k * uy) - p.y };
    });
  }

  // meia peça + espelho; null se a–b não for aresta do contorno
  function abrirDobra(pts, a, b) {
    const n = pts.length, ia = pts.findIndex(p => dist(p, a) < 1e-6), ib = pts.findIndex(p => dist(p, b) < 1e-6);
    const i = ia < 0 || ib < 0 ? -1 : (ia + 1) % n === ib ? ia : (ib + 1) % n === ia ? ib : -1;
    if (i < 0) return null;
    const meia = [...pts.slice(i + 1), ...pts.slice(0, i + 1)]; // da ponta final da dobra até a inicial, por fora
    const toda = [...meia, ...espelhar(meia, a, b).reverse().slice(1, -1)], t = toda.length;
    // as pontas da dobra somem quando o contorno a atravessa em linha reta
    return toda.filter((p, k) => (k && k !== meia.length - 1) || distSeg(p, toda[(k + t - 1) % t], toda[(k + 1) % t]) > 1e-6);
  }

  function ima(p, pontos, segs, raio) {
    let mel = null, md = raio;
    for (const q of pontos) if (dist(p, q) <= md) { md = dist(p, q); mel = q; }
    if (mel) return { p: mel, tipo: 'ponto' };
    for (const [a, b] of segs) { const q = projSeg(p, a, b); if (dist(p, q) <= md) { md = dist(p, q); mel = q; } }
    return mel ? { p: mel, tipo: 'linha' } : { p, tipo: null };
  }

  function estender(a, b, ate) {
    let mel = null, mt = Infinity;
    for (const [c, d] of ate) {
      const x = cruzar(a, b, c, d);
      if (x && x.ta > 1 + EPS && em01(x.tb) && x.ta < mt) { mt = x.ta; mel = x.p; }
    }
    return mel;
  }

  // arco de raio dado tangente às duas arestas, como cúbica; recua no máximo o comprimento da aresta mais curta
  function arredondar(p0, p1, p2, raio) {
    const l1 = dist(p1, p0), l2 = dist(p1, p2);
    const u = { x: (p0.x - p1.x) / l1, y: (p0.y - p1.y) / l1 }, v = { x: (p2.x - p1.x) / l2, y: (p2.y - p1.y) / l2 };
    const th = Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y)));
    const t = Math.min(raio / Math.tan(th / 2), l1, l2), r = t * Math.tan(th / 2);
    const k = 4 / 3 * Math.tan((Math.PI - th) / 4) * r;
    const ini = { x: p1.x + u.x * t, y: p1.y + u.y * t }, fim = { x: p1.x + v.x * t, y: p1.y + v.y * t };
    return { ini, fim, c1: { x: ini.x - u.x * k, y: ini.y - u.y * k }, c2: { x: fim.x - v.x * k, y: fim.y - v.y * k } };
  }

  function girar(pts, c, graus) {
    const a = graus * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    return pts.map(p => ({ x: c.x + (p.x - c.x) * cs - (p.y - c.y) * sn, y: c.y + (p.x - c.x) * sn + (p.y - c.y) * cs }));
  }
  const mover = (pts, dx, dy) => pts.map(p => ({ x: p.x + dx, y: p.y + dy }));

  const MoldeGeo = { bezier, comprimento, area, areaAbs, bbox, circulo, pontoEm, offset, espelhar, abrirDobra, ima, intersecao, estender, arredondar, girar, mover };
  g.MoldeGeo = MoldeGeo;
  if (typeof module !== 'undefined') module.exports = MoldeGeo;
})(typeof window !== 'undefined' ? window : globalThis);
