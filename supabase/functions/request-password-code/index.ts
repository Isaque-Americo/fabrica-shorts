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

function randomCode(len = 6) {
  const digits = '0123456789'
  let out = ''
  const cryptoObj = globalThis.crypto
  for (let i = 0; i < len; i++) {
    const r = cryptoObj.getRandomValues(new Uint32Array(1))[0]
    out += digits[r % 10]
  }
  return out
}

async function sendEmail(to: string, code: string) {
  const smtpHost = Deno.env.get('SMTP_HOST')
  const smtpPort = Number(Deno.env.get('SMTP_PORT') || '587')
  const smtpUser = Deno.env.get('SMTP_USER')
  const smtpPass = Deno.env.get('SMTP_PASS')
  const smtpFrom = Deno.env.get('SMTP_FROM') || smtpUser || ''
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP não configurado, código não será enviado por e-mail')
    return false
  }
  try {
    const nodemailer = (await import('npm:nodemailer@6.9.9')).default
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass }
    })
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject: 'Código de recuperação de senha - Fabrica Shorts',
      text: `Seu código de verificação é: ${code}\nVálido por 15 minutos.\n\nNão responda a este e-mail.`,
      html: `<p>Olá,</p><p>Seu código de verificação para redefinir a senha é: <strong style="font-size:1.2em;letter-spacing:2px">${code}</strong></p><p>Válido por 15 minutos.</p><p>Se você não solicitou esta alteração, ignore este e-mail.</p>`
    })
    return true
  } catch (e) {
    console.error('Falha ao enviar e-mail:', e)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ error: 'Função não configurada.' }, 500)

  const origin = req.headers.get('origin')
  if (origin && origin !== APP_ORIGIN) return json({ error: 'Origem não autorizada.' }, 403)

  try {
    const { email } = await req.json().catch(() => ({}))
    if (!email || typeof email !== 'string') return json({ error: 'E-mail inválido.' }, 400)

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    await admin.from('docs').insert({
      col: 'password_recovery_audit',
      data: { email: email.toLowerCase(), action: 'request_code', ip, created_at: new Date().toISOString() }
    })

    const { data: users } = await admin.auth.admin.listUsers()
    const user = users?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) return json({ notFound: true })

    const code = randomCode(6)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    await admin.from('docs').insert({
      col: 'password_recovery_codes',
      data: { email: email.toLowerCase(), code, expires_at: expiresAt, used: false, user_id: user.id }
    })

    const sent = await sendEmail(email, code)
    if (!sent) {
      console.log(`Código para ${email}: ${code}`)
    }

    return json({ success: true })
  } catch (e) {
    console.error('Erro ao gerar código:', e)
    return json({ error: 'Falha ao processar solicitação.' }, 500)
  }
})
