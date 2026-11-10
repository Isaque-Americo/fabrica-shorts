import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

const APP_ORIGIN = Deno.env.get('APP_ORIGIN') || 'https://isaque-americo.github.io'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ error: 'Função não configurada.' }, 500)

  const origin = req.headers.get('origin')
  if (origin && origin !== APP_ORIGIN) return json({ error: 'Origem não autorizada.' }, 403)

  try {
    const { email, code, newPassword } = await req.json().catch(() => ({}))
    if (!email || !code || !newPassword) return json({ error: 'Dados incompletos.' }, 400)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

    const { data: rows, error } = await admin.from('docs')
      .select('id,data')
      .eq('col', 'password_recovery_codes')
      .eq('data->>email', email.toLowerCase())
    if (error) return json({ error: 'Falha ao validar código.' }, 500)

    const now = new Date().toISOString()
    let valid = false
    let userId = ''
    for (const r of rows || []) {
      const d = r.data as any
      if (d.code === code && !d.used && d.expires_at > now) {
        valid = true
        userId = d.user_id
        await admin.from('docs').update({ data: { ...d, used: true } }).eq('id', r.id)
        break
      }
    }
    await admin.from('docs').insert({
      col: 'password_recovery_audit',
      data: { email: email.toLowerCase(), action: valid ? 'confirm_success' : 'confirm_failed', ip, created_at: new Date().toISOString() }
    })
    if (!valid) return json({ error: 'Código inválido ou expirado.' }, 400)

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
    if (updErr) return json({ error: 'Não foi possível atualizar senha.' }, 500)

    return json({ success: true })
  } catch (e) {
    console.error('Erro ao confirmar código:', e)
    return json({ error: 'Falha ao processar.' }, 500)
  }
})
