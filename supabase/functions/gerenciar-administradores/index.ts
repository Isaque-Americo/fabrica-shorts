import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const APP_ORIGIN = 'https://isaque-americo.github.io'
const APP_URL = `${APP_ORIGIN}/fabrica-shorts/`
const CORS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

type AdminProfile = {
  user_id: string
  role: string
  contact_email: string | null
  contact_whatsapp: string | null
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const normalizePhone = (value: unknown) => typeof value === 'string' ? value.trim() : ''

function validPhone(value: string) {
  return value === '' || /^\+[1-9]\d{7,14}$/.test(value)
}

const recoveryResponse = {
  message: 'Se o número corresponder a uma conta administrativa ativa, você receberá um código pelo WhatsApp.',
}

function recoveryPhone(value: unknown) {
  return typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value.trim()) ? value.trim() : ''
}

function recoveryConfigurationReady(action: unknown) {
  const hashSecret = Deno.env.get('WHATSAPP_OTP_HASH_SECRET') || ''
  if (hashSecret.length < 32 || !Deno.env.get('TURNSTILE_SECRET_KEY')) return false
  if (action !== 'whatsapp_recovery_send') return true

  const token = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN') || ''
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID') || ''
  const templateName = Deno.env.get('META_WHATSAPP_TEMPLATE_NAME') || 'authentication_code_copy_code_button'
  const language = Deno.env.get('META_WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR'
  const version = Deno.env.get('META_GRAPH_API_VERSION') || 'v26.0'
  return Boolean(token && /^\d+$/.test(phoneNumberId) && /^[a-z0-9_]{1,512}$/i.test(templateName)
    && /^[a-z]{2,3}_[A-Z]{2}$/.test(language) && /^v\d+\.\d+$/.test(version))
}

function generateRecoveryCode() {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000
  const value = new Uint32Array(1)
  do crypto.getRandomValues(value)
  while (value[0] >= limit)
  return String(value[0] % 1_000_000).padStart(6, '0')
}

async function hashRecoveryCode(code: string, userId: string, phone: string) {
  const secret = Deno.env.get('WHATSAPP_OTP_HASH_SECRET') || ''
  if (secret.length < 32) throw new Error('WHATSAPP_OTP_HASH_SECRET is not configured.')
  const input = new TextEncoder().encode(`${userId}:${phone}:${code}`)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, input)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyRecoveryCaptcha(req: Request, token: unknown) {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || ''
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY is not configured.')
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048) return false

  const form = new URLSearchParams({ secret, response: token })
  const ip = req.headers.get('cf-connecting-ip')
  if (ip) form.set('remoteip', ip)
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  })
  if (!response.ok) throw new Error(`Turnstile verification failed with status ${response.status}.`)
  const result = await response.json()
  return result.success === true
    && (!result.hostname || result.hostname === 'isaque-americo.github.io')
}

async function findRecoveryProfile(phone: string) {
  const { data, error } = await admin.from('user_profiles')
    .select('user_id').eq('role', 'admin').eq('contact_whatsapp', phone).limit(2)
  if (error) throw new Error('Could not look up the recovery profile.')
  return data?.length === 1 ? data[0] : null
}

async function sendWhatsAppRecoveryCode(phone: string, code: string) {
  const token = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN') || ''
  const phoneNumberId = Deno.env.get('META_WHATSAPP_PHONE_NUMBER_ID') || ''
  const templateName = Deno.env.get('META_WHATSAPP_TEMPLATE_NAME') || 'authentication_code_copy_code_button'
  const language = Deno.env.get('META_WHATSAPP_TEMPLATE_LANGUAGE') || 'pt_BR'
  const version = Deno.env.get('META_GRAPH_API_VERSION') || 'v26.0'
  if (!token || !/^\d+$/.test(phoneNumberId) || !/^[a-z0-9_]{1,512}$/i.test(templateName)
    || !/^[a-z]{2,3}_[A-Z]{2}$/.test(language) || !/^v\d+\.\d+$/.test(version)) {
    throw new Error('WhatsApp Cloud API secrets are missing or invalid.')
  }

  const authorizationHeader = ['Bearer', token].join(' ')
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phone.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }],
          },
        ],
      },
    }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    console.error('WhatsApp Cloud API rejected a recovery message:', {
      status: response.status,
      code: result?.error?.code,
    })
    throw new Error('WhatsApp Cloud API could not send the recovery message.')
  }
}

async function handleWhatsAppRecovery(req: Request, body: Record<string, unknown>) {
  const action = body.action
  const phone = recoveryPhone(body.phone)
  if (!phone) return json({ error: 'Informe o WhatsApp no formato internacional, por exemplo +5532988383046.' }, 400)
  if (action === 'whatsapp_recovery_send' && body.consent !== true) {
    return json({ error: 'Autorize o envio do código de recuperação.' }, 400)
  }
  if (!recoveryConfigurationReady(action)) {
    return json({ error: 'A recuperação pelo WhatsApp ainda não está configurada. Use a recuperação por e-mail.' }, 503)
  }

  try {
    if (!await verifyRecoveryCaptcha(req, body.captchaToken)) {
      return json({ error: 'Conclua novamente a verificação de segurança.' }, 400)
    }

    const profile = await findRecoveryProfile(phone)
    if (!profile) {
      return action === 'whatsapp_recovery_send'
        ? json(recoveryResponse)
        : json({ error: 'Código inválido ou expirado.' }, 400)
    }

    if (action === 'whatsapp_recovery_send') {
      const code = generateRecoveryCode()
      const codeHash = await hashRecoveryCode(code, profile.user_id, phone)
      const { data: permitted, error } = await admin.rpc('begin_admin_password_recovery', {
        p_user_id: profile.user_id,
        p_phone: phone,
        p_code_hash: codeHash,
      })
      if (error) throw new Error('Could not start the recovery challenge.')
      if (permitted) await sendWhatsAppRecoveryCode(phone, code)
      return json(recoveryResponse)
    }

    if (action === 'whatsapp_recovery_verify') {
      const code = typeof body.code === 'string' ? body.code.trim() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!/^\d{6}$/.test(code)) return json({ error: 'Informe o código de seis dígitos.' }, 400)
      if (password.length < 8 || password.length > 72) {
        return json({ error: 'A senha deve ter entre 8 e 72 caracteres.' }, 400)
      }

      const codeHash = await hashRecoveryCode(code, profile.user_id, phone)
      const { data: verified, error } = await admin.rpc('verify_admin_password_recovery', {
        p_user_id: profile.user_id,
        p_phone: phone,
        p_code_hash: codeHash,
      })
      if (error) throw new Error('Could not verify the recovery challenge.')
      if (verified !== true) return json({ error: 'Código inválido ou expirado.' }, 400)

      const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, { password })
      if (updateError) {
        console.error('Could not update the administrator password after WhatsApp verification.')
        return json({ error: 'Não foi possível atualizar a senha. Solicite um novo código.' }, 500)
      }
      return json({ message: 'Senha atualizada. Entre com sua nova senha.' })
    }
  } catch (error) {
    console.error('WhatsApp password recovery failed:', error instanceof Error ? error.message : 'Unknown error')
    return action === 'whatsapp_recovery_send'
      ? json(recoveryResponse)
      : json({ error: 'Não foi possível concluir a recuperação. Solicite um novo código e tente novamente.' }, 500)
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ error: 'A função não está configurada no servidor.' }, 500)

  const origin = req.headers.get('origin')
  if (origin && origin !== APP_ORIGIN) return json({ error: 'Origem não autorizada.' }, 403)

  try {
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : ''
    if (action === 'whatsapp_recovery_send' || action === 'whatsapp_recovery_verify') {
      return await handleWhatsAppRecovery(req, body)
    }

    const authorization = req.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return json({ error: 'Sessão necessária.' }, 401)

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)

    const { data: caller, error: callerError } = await admin.from('user_profiles')
      .select('role').eq('user_id', authData.user.id).maybeSingle()
    if (callerError) return json({ error: 'Não foi possível validar o perfil administrador.' }, 500)
    if (caller?.role !== 'admin') return json({ error: 'Somente administradores podem gerenciar contas.' }, 403)

    if (action === 'list') {
      const [{ data: profiles, error: profilesError }, { data: users, error: usersError }] = await Promise.all([
        admin.from('user_profiles').select('user_id,role,contact_email,contact_whatsapp').eq('role', 'admin'),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ])
      if (profilesError || usersError) return json({ error: 'Não foi possível carregar os administradores.' }, 500)
      const usersById = new Map((users.users || []).map((user) => [user.id, user]))
      const items = ((profiles || []) as AdminProfile[]).map((profile) => ({
        user_id: profile.user_id,
        email: usersById.get(profile.user_id)?.email || profile.contact_email || '',
        contact_email: profile.contact_email || '',
        contact_whatsapp: profile.contact_whatsapp || '',
      }))
      return json({ items })
    }

    const email = normalizeEmail(body.email)
    const phone = normalizePhone(body.contact_whatsapp)
    if (!validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400)
    if (email.endsWith('@fabrica.interno')) return json({ error: 'Use um e-mail real que possa receber mensagens.' }, 400)
    if (!validPhone(phone)) return json({ error: 'Informe o WhatsApp no formato internacional, por exemplo +5532988383046.' }, 400)

    if (action === 'create') {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: APP_URL })
      if (error || !data.user) return json({ error: error?.message || 'Não foi possível enviar o convite.' }, 400)

      const { error: profileError } = await admin.from('user_profiles').insert({
        user_id: data.user.id,
        role: 'admin',
        contact_email: email,
        contact_whatsapp: phone || null,
      })
      if (profileError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
        if (cleanupError) return json({ error: 'O convite foi criado, mas não foi possível salvar o perfil nem remover a conta. Contate o suporte.' }, 500)
        return json({ error: 'Não foi possível criar o perfil do administrador.' }, 500)
      }

      return json({ item: { user_id: data.user.id, email, contact_email: email, contact_whatsapp: phone } }, 201)
    }

    if (action === 'update') {
      const userId = typeof body.user_id === 'string' ? body.user_id : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ error: 'Administrador inválido.' }, 400)
      }

      const { data: profile, error: profileReadError } = await admin.from('user_profiles')
        .select('user_id,role,contact_email,contact_whatsapp')
        .eq('user_id', userId).maybeSingle()
      if (profileReadError) return json({ error: 'Não foi possível consultar o administrador.' }, 500)
      if (!profile || profile.role !== 'admin') return json({ error: 'Administrador não encontrado.' }, 404)

      const { data: authUser, error: authReadError } = await admin.auth.admin.getUserById(userId)
      if (authReadError || !authUser.user) return json({ error: 'Não foi possível consultar a conta de autenticação.' }, 500)

      const oldEmail = authUser.user.email || ''
      if (oldEmail.toLowerCase() !== email) {
        const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
        if (error) return json({ error: 'Não foi possível atualizar o e-mail de login: ' + error.message }, 400)
      }

      const { error: profileUpdateError } = await admin.from('user_profiles')
        .update({ contact_email: email, contact_whatsapp: phone || null })
        .eq('user_id', userId)
      if (profileUpdateError) {
        if (oldEmail && oldEmail.toLowerCase() !== email) {
          const { error: rollbackError } = await admin.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true })
          if (rollbackError) return json({ error: 'O e-mail de login mudou, mas o contato não foi salvo nem foi possível restaurar o e-mail anterior. Contate o suporte.' }, 500)
        }
        return json({ error: 'Não foi possível salvar os dados de contato.' }, 500)
      }

      return json({ item: { user_id: userId, email, contact_email: email, contact_whatsapp: phone } })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) {
    console.error('Falha ao gerenciar administradores:', error)
    return json({ error: 'Ocorreu uma falha ao gerenciar administradores.' }, 500)
  }
})
