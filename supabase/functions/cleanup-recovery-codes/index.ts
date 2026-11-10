import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
})

Deno.serve(async () => {
  try {
    const now = new Date().toISOString()
    const { error } = await admin.from('docs')
      .delete()
      .eq('col', 'password_recovery_codes')
      .lt('data->>expires_at', now)
    if (error) {
      console.error('Erro ao limpar códigos expirados:', error)
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e) {
    console.error('Falha na limpeza:', e)
    return new Response(JSON.stringify({ success: false, error: 'Falha interna' }), { status: 500 })
  }
})
