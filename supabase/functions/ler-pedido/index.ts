const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const resp = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MODELOS = (Deno.env.get('GEMINI_MODELOS') ||
  'gemini-3.5-flash,gemini-flash-latest,gemini-flash-lite-latest').split(',');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return resp({ error: 'Chave da IA não configurada.' }, 500);
    const { prompt, images } = await req.json();
    if (!prompt) return resp({ error: 'Pedido vazio.' }, 400);
    const parts: unknown[] = [{ text: String(prompt).slice(0, 40000) }];
    for (const i of (images || []).slice(0, 6)) parts.push({ inline_data: { mime_type: i.mime, data: i.data } });
    const body = JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    let ultimo = 'Falha na IA.';
    for (let rodada = 0; rodada < 2; rodada++) {
      if (rodada) await new Promise((ok) => setTimeout(ok, 2000));
      for (const m of MODELOS) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body,
          signal: AbortSignal.timeout(45000),
        }).catch((e) => { ultimo = String(e?.message || e); return null; });
        if (!r) continue;
        const j: any = await r.json().catch(() => null);
        if (r.ok) {
          const txt = (j?.candidates?.[0]?.content?.parts || [])
            .map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text || '')).join('')
            .replace(/^\s*```(json)?|```\s*$/g, '').trim();
          try { return resp({ result: JSON.parse(txt) }); } catch { ultimo = 'Resposta inválida da IA.'; continue; }
        }
        ultimo = j?.error?.message || `HTTP ${r.status}`;
        if (r.status === 429 || r.status === 404 || r.status >= 500 || /high demand|overloaded|no longer available/i.test(ultimo)) continue;
        return resp({ error: ultimo }, 502);
      }
    }
    return resp({ error: ultimo }, 502);
  } catch (e) {
    return resp({ error: String((e as Error)?.message || e) }, 500);
  }
});
