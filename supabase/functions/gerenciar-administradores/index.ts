import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { validarPermissoes } from '../_shared/permissoes.mjs'

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
  is_principal: boolean
  permissoes: Record<string, string> | null
}

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const normalizePhone = (value: unknown) => typeof value === 'string' ? value.trim() : ''

function validPhone(value: string) {
  return value === '' || /^\+[1-9]\d{7,14}$/.test(value)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ error: 'A função não está configurada no servidor.' }, 500)

  const origin = req.headers.get('origin')
  if (origin && origin !== APP_ORIGIN) return json({ error: 'Origem não autorizada.' }, 403)

  try {
    const authorization = req.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return json({ error: 'Sessão necessária.' }, 401)

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)

    const { data: caller, error: callerError } = await admin.from('user_profiles')
      .select('role,is_principal').eq('user_id', authData.user.id).maybeSingle()
    if (callerError) return json({ error: 'Não foi possível validar o perfil administrador.' }, 500)
    if (caller?.role !== 'admin' || caller?.is_principal !== true) {
      return json({ error: 'Somente o administrador principal pode gerenciar administradores.' }, 403)
    }

    const parsed = await req.json().catch(() => ({}))
    const body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    const action = typeof body.action === 'string' ? body.action : ''
    // o principal só muda por migração: nunca aceitar is_principal do corpo
    if ('is_principal' in body) return json({ error: 'Não é possível alterar o administrador principal por aqui.' }, 400)

    if (action === 'list') {
      const [{ data: profiles, error: profilesError }, { data: users, error: usersError }] = await Promise.all([
        admin.from('user_profiles').select('user_id,role,contact_email,contact_whatsapp,is_principal,permissoes').eq('role', 'admin'),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ])
      if (profilesError || usersError) return json({ error: 'Não foi possível carregar os administradores.' }, 500)
      const usersById = new Map((users.users || []).map((user) => [user.id, user]))
      const items = ((profiles || []) as AdminProfile[]).map((profile) => ({
        user_id: profile.user_id,
        email: usersById.get(profile.user_id)?.email || profile.contact_email || '',
        contact_email: profile.contact_email || '',
        contact_whatsapp: profile.contact_whatsapp || '',
        is_principal: profile.is_principal === true,
        permissoes: profile.permissoes ?? null,
      }))
      return json({ items })
    }

    const email = normalizeEmail(body.email)
    const phone = normalizePhone(body.contact_whatsapp)
    if (!validEmail(email)) return json({ error: 'Informe um e-mail válido.' }, 400)
    if (email.endsWith('@fabrica.interno')) return json({ error: 'Use um e-mail real que possa receber mensagens.' }, 400)
    if (!validPhone(phone)) return json({ error: 'Informe o WhatsApp no formato internacional, por exemplo +5532988383046.' }, 400)

    // ausente = não mexe (update) / sem acesso (create); presente = valida e fecha as dependências
    const temPermissoes = body.permissoes !== undefined
    const perm = temPermissoes ? validarPermissoes(body.permissoes) : { valor: null }
    if (perm.erro) return json({ error: perm.erro }, 400)

    if (action === 'create') {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: APP_URL })
      if (error || !data.user) return json({ error: error?.message || 'Não foi possível enviar o convite.' }, 400)

      const { error: profileError } = await admin.from('user_profiles').insert({
        user_id: data.user.id,
        role: 'admin',
        contact_email: email,
        contact_whatsapp: phone || null,
        permissoes: perm.valor,
      })
      if (profileError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id)
        if (cleanupError) return json({ error: 'O convite foi criado, mas não foi possível salvar o perfil nem remover a conta. Contate o suporte.' }, 500)
        return json({ error: 'Não foi possível criar o perfil do administrador.' }, 500)
      }

      return json({ item: { user_id: data.user.id, email, contact_email: email, contact_whatsapp: phone, is_principal: false, permissoes: perm.valor } }, 201)
    }

    if (action === 'update') {
      const userId = typeof body.user_id === 'string' ? body.user_id : ''
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
        return json({ error: 'Administrador inválido.' }, 400)
      }

      const { data: profile, error: profileReadError } = await admin.from('user_profiles')
        .select('user_id,role,contact_email,contact_whatsapp,is_principal,permissoes')
        .eq('user_id', userId).maybeSingle()
      if (profileReadError) return json({ error: 'Não foi possível consultar o administrador.' }, 500)
      if (!profile || profile.role !== 'admin') return json({ error: 'Administrador não encontrado.' }, 404)
      if (profile.is_principal && temPermissoes) {
        return json({ error: 'O administrador principal tem acesso total; as permissões dele não mudam.' }, 400)
      }

      const { data: authUser, error: authReadError } = await admin.auth.admin.getUserById(userId)
      if (authReadError || !authUser.user) return json({ error: 'Não foi possível consultar a conta de autenticação.' }, 500)

      const oldEmail = authUser.user.email || ''
      if (oldEmail.toLowerCase() !== email) {
        const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
        if (error) return json({ error: 'Não foi possível atualizar o e-mail de login: ' + error.message }, 400)
      }

      const { error: profileUpdateError } = await admin.from('user_profiles')
        .update(temPermissoes
          ? { contact_email: email, contact_whatsapp: phone || null, permissoes: perm.valor }
          : { contact_email: email, contact_whatsapp: phone || null })
        .eq('user_id', userId)
      if (profileUpdateError) {
        if (oldEmail && oldEmail.toLowerCase() !== email) {
          const { error: rollbackError } = await admin.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true })
          if (rollbackError) return json({ error: 'O e-mail de login mudou, mas o contato não foi salvo nem foi possível restaurar o e-mail anterior. Contate o suporte.' }, 500)
        }
        return json({ error: 'Não foi possível salvar os dados de contato.' }, 500)
      }

      const permissoes = temPermissoes ? perm.valor : (profile.permissoes ?? null)
      return json({ item: { user_id: userId, email, contact_email: email, contact_whatsapp: phone, is_principal: profile.is_principal === true, permissoes } })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (error) {
    console.error('Falha ao gerenciar administradores:', error)
    return json({ error: 'Ocorreu uma falha ao gerenciar administradores.' }, 500)
  }
})
