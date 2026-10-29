import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const ORIGIN = 'https://isaque-americo.github.io'
const TEMP_PASSWORD = '123456'
const INTERNAL_DOMAIN = '@fabrica.interno'
const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
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

type Row = { id: string; data: Record<string, unknown> }
type Profile = { user_id: string; role: string; store_name: string | null; rep_id: string | null; must_change_password: boolean }

const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const usernameValid = (value: string) => /^[a-z0-9.]{1,64}$/.test(value)
const emailFor = (username: string) => username + INTERNAL_DOMAIN
const roleFor = (data: Record<string, unknown>) => str(data.tipoCadastro)
const displayName = (data: Record<string, unknown>) => str(data.store_name) || str(data.nome) || str(data.username)

async function loadRows() {
  const { data, error } = await admin.from('docs').select('id,data').eq('col', 'cadastros').order('created_at')
  if (error) throw new Error('Não foi possível carregar os pré-cadastros.')
  return (data || []) as Row[]
}

async function loadUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error('Não foi possível consultar as contas de autenticação.')
  return data.users as any[]
}

async function loadProfiles() {
  const { data, error } = await admin.from('user_profiles')
    .select('user_id,role,store_name,rep_id,must_change_password')
  if (error) throw new Error('Não foi possível consultar os perfis de acesso.')
  return (data || []) as Profile[]
}

function profileMatches(profile: Profile | undefined, row: Row) {
  if (!profile || profile.role !== roleFor(row.data)) return false
  if (profile.role === 'lojista') return str(profile.store_name) === str(row.data.store_name)
  if (profile.role === 'representante') return str(profile.rep_id) === str(row.data.rep_id)
  return false
}

function isBanned(user: any) {
  const until = user?.banned_until
  return Boolean(until && new Date(until).getTime() > Date.now())
}

function statusFor(row: Row, user: any, profile: Profile | undefined) {
  const stored = str(row.data.acessoStatus)
  if (stored === 'recusado') return 'recusado'
  if (stored === 'desativado' || isBanned(user)) return 'desativado'
  if (profileMatches(profile, row)) return 'ativo'
  return 'pendente'
}

async function saveStatus(row: Row, status: string) {
  const next = { ...row.data, acessoStatus: status }
  const { error } = await admin.from('docs').update({ data: next }).eq('id', row.id)
  if (error) throw new Error('Não foi possível salvar a decisão de acesso.')
}

async function restoreRow(row: Row) {
  await admin.from('docs').update({ data: row.data }).eq('id', row.id)
}

function itemFor(row: Row, status: string, temporaryPasswordSet = false) {
  return {
    username: str(row.data.username),
    role: roleFor(row.data),
    display_name: displayName(row.data),
    status,
    temporary_password_set: temporaryPasswordSet,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
  if (!supabaseUrl || !serviceKey) return json({ error: 'A função não está configurada no servidor.' }, 500)

  const origin = req.headers.get('origin')
  if (origin && origin !== ORIGIN) return json({ error: 'Origem não autorizada.' }, 403)

  try {
    const authorization = req.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token) return json({ error: 'Sessão necessária.' }, 401)

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)

    const { data: caller, error: callerError } = await admin.from('user_profiles')
      .select('role').eq('user_id', authData.user.id).maybeSingle()
    if (callerError) return json({ error: 'Não foi possível validar o perfil administrador.' }, 500)
    if (caller?.role !== 'admin') return json({ error: 'Somente o administrador pode gerenciar acessos.' }, 403)

    const body = await req.json().catch(() => ({}))
    const action = str(body.action)
    const rows = await loadRows()
    const users = await loadUsers()
    const profiles = await loadProfiles()
    const usersByEmail = new Map(users.map((u) => [String(u.email || '').toLowerCase(), u]))
    const profilesById = new Map(profiles.map((p) => [p.user_id, p]))

    if (action === 'list') {
      const items = rows.filter((row) => ['lojista', 'representante'].includes(roleFor(row)))
        .map((row) => {
          const username = str(row.data.username)
          const user = usersByEmail.get(emailFor(username).toLowerCase())
          const profile = user ? profilesById.get(user.id) : undefined
          return itemFor(row, statusFor(row, user, profile))
        })
      return json({ items })
    }

    const username = str(body.username).toLowerCase()
    if (!usernameValid(username)) return json({ error: 'Usuário inválido.' }, 400)
    const matches = rows.filter((row) => str(row.data.username).toLowerCase() === username)
    if (matches.length !== 1) return json({ error: 'Pré-cadastro não encontrado ou duplicado.' }, 404)
    const row = matches[0]
    const role = roleFor(row.data)
    if (!['lojista', 'representante'].includes(role)) return json({ error: 'Perfil não permitido.' }, 400)

    const email = emailFor(username).toLowerCase()
    let user = usersByEmail.get(email)
    let profile = user ? profilesById.get(user.id) : undefined

    if (action === 'activate') {
      if (role === 'lojista' && !str(row.data.store_name)) return json({ error: 'O cadastro da loja não tem nome vinculado.' }, 400)
      if (role === 'representante' && !str(row.data.rep_id)) return json({ error: 'O representante ainda não está vinculado à aba Representantes.' }, 400)
      if (profile && profile.role !== role) return json({ error: 'Esta conta já está vinculada a outro perfil; peça revisão ao administrador.' }, 409)

      const previous = { ...row.data }
      try {
        await saveStatus(row, 'ativo')
      } catch (e) {
        return json({ error: (e as Error).message }, 500)
      }

      let temporaryPasswordSet = false
      let createdUser = false
      try {
        if (!user) {
          const { data, error } = await admin.auth.admin.createUser({
            email,
            password: TEMP_PASSWORD,
            email_confirm: true,
          })
          if (error || !data.user) throw new Error('O Supabase Auth recusou a criação da conta com a senha temporária 123456.')
          user = data.user
          createdUser = true
          temporaryPasswordSet = true
        } else if (!profile) {
          const { error } = await admin.auth.admin.updateUserById(user.id, {
            password: TEMP_PASSWORD,
            email_confirm: true,
            ban_duration: 'none',
          })
          if (error) throw new Error('Não foi possível preparar a senha temporária desta conta.')
          temporaryPasswordSet = true
        } else {
          const { error } = await admin.auth.admin.updateUserById(user.id, { ban_duration: 'none' })
          if (error) throw new Error('Não foi possível reativar a conta no Auth.')
        }

        const profileData = {
          user_id: user.id,
          role,
          store_name: role === 'lojista' ? str(row.data.store_name) : null,
          rep_id: str(row.data.rep_id) || null,
          must_change_password: profile?.must_change_password ?? true,
        }
        const { error: profileError } = await admin.from('user_profiles')
          .upsert(profileData, { onConflict: 'user_id' })
        if (profileError) throw new Error('Não foi possível gravar o perfil de acesso.')

        return json({ item: itemFor(row, 'ativo', temporaryPasswordSet) })
      } catch (e) {
        if (createdUser && user) {
          await admin.from('user_profiles').delete().eq('user_id', user.id)
          await admin.auth.admin.deleteUser(user.id)
        }
        await admin.from('docs').update({ data: previous }).eq('id', row.id)
        return json({ error: (e as Error).message || 'Falha ao ativar a conta.' }, 400)
      }
    }

    if (action === 'reject') {
      if (profile && profile.role !== role) return json({ error: 'Esta conta já está vinculada a outro perfil; peça revisão ao administrador.' }, 409)
      if (profileMatches(profile, row) && !isBanned(user)) {
        return json({ error: 'A conta já está ativa. Para recusá-la, desative-a antes por um fluxo administrativo próprio.' }, 409)
      }
      if (user) {
        const ban = await admin.auth.admin.updateUserById(user.id, { ban_duration: '876000h' })
        if (ban.error) return json({ error: 'Não foi possível bloquear esta conta no Auth.' }, 500)
      }
      try {
        await saveStatus(row, 'recusado')
      } catch (e) {
        if (user) await admin.auth.admin.updateUserById(user.id, { ban_duration: 'none' })
        return json({ error: (e as Error).message }, 500)
      }
      return json({ item: itemFor(row, 'recusado') })
    }

    return json({ error: 'Ação não reconhecida.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Erro interno ao gerenciar a conta.' }, 500)
  }
})
