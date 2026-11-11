// Geometria do editor de molde. Pontos {x,y} em mm.
(function (g) {
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const meio = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function distSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    if (!l2) return dist(p, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
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

  const MoldeGeo = { bezier, comprimento, area, areaAbs, bbox, circulo, pontoEm };
  g.MoldeGeo = MoldeGeo;
  if (typeof module !== 'undefined') module.exports = MoldeGeo;
})(typeof window !== 'undefined' ? window : globalThis);
