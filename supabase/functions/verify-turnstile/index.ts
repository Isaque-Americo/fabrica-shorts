import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { token, remoteip } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") return json({ error: "Token missing" }, 400);

    const secret = Deno.env.get("TURNSTILE_SECRET");
    if (!secret) return json({ error: "Server not configured" }, 500);

    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteip) form.append("remoteip", remoteip);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form
    });

    const data = await res.json();
    if (!data.success) {
      return json({ success: false, errors: data["error-codes"] || [] }, 400);
    }

    return json({ success: true });
  } catch (e) {
    console.error("Turnstile verification failed:", e);
    return json({ error: "Verification failed" }, 500);
  }
});
