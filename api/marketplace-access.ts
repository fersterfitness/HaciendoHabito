/**
 * Marketplace: le crea al profesional su propia cuenta en la app y devuelve el link de invitación.
 *
 * POST { professionalId, email? }  (Authorization: Bearer <sesión de quien invita>)
 *  - Perfil sin cuenta + email nuevo      → crea la cuenta, la vincula y devuelve el link.
 *  - Perfil sin cuenta + email que existe → vincula esa cuenta. NO devuelve link (sería tomar una cuenta ajena).
 *  - Perfil con invitación sin usar       → devuelve un link nuevo.
 *
 * El link no es el de Supabase: lleva a /bienvenida con el token en el hash. La vista previa de
 * WhatsApp abre los links al pegarlos y gastaría un link de un solo uso; así el token recién se
 * canjea cuando la persona guarda su contraseña.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 20,
}

const APP_ROLE: Record<string, string | undefined> = {
  entrenador: 'trainer',
  nutricionista: 'nutritionist',
  psicologo: 'psychologist',
}

const fail = (status: number, error: string, message: string) => Response.json({ error, message }, { status })

function siteOrigin(request: Request): string {
  const origin = (request.headers.get('origin') ?? '').replace(/\/$/, '')
  if (/^https?:\/\//i.test(origin)) return origin
  const fromEnv = process.env.VITE_SITE_URL ?? process.env.VITE_APP_URL ?? process.env.VERCEL_URL
  if (fromEnv) return (fromEnv.startsWith('http') ? fromEnv : `https://${fromEnv}`).replace(/\/$/, '')
  return 'http://localhost:5173'
}

async function inviteLink(admin: SupabaseClient, email: string, origin: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const token = data?.properties?.hashed_token
  if (error || !token) return { link: null, userId: data?.user?.id ?? null }
  return { link: `${origin}/bienvenida#token=${encodeURIComponent(token)}`, userId: data.user?.id ?? null }
}

// En el runtime de Node de Vercel, el export por defecto recibe (req, res) de Node y devolver una
// Response deja el pedido colgado. Los exports con nombre de método sí usan Request/Response.
export async function POST(request: Request): Promise<Response> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anon || !serviceKey) {
    return fail(500, 'configuracion_incompleta', 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de Vercel.')
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return fail(401, 'no_autenticado', 'Iniciá sesión de nuevo.')

  let body: { professionalId?: string; email?: string }
  try {
    body = await request.json()
  } catch {
    return fail(400, 'json_invalido', 'Pedido inválido.')
  }
  const professionalId = (body.professionalId ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  if (!/^[0-9a-f-]{36}$/i.test(professionalId)) return fail(400, 'profesional_requerido', 'Falta el profesional.')

  // Quién invita, con su propia sesión (respeta RLS).
  const authed = createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: authErr } = await authed.auth.getUser()
  const uid = userData.user?.id
  if (authErr || !uid) return fail(401, 'no_autenticado', 'Iniciá sesión de nuevo.')

  const { data: canGrant, error: grantErr } = await authed.rpc('can_grant_marketplace_access')
  if (grantErr) {
    return fail(500, 'falta_migracion', 'Falta correr 20261113120000_marketplace_access.sql en Supabase.')
  }
  if (canGrant !== true) return fail(403, 'sin_permiso', 'Solo el administrador puede crear cuentas para otros profesionales.')

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: prof } = await admin
    .from('marketplace_professionals')
    .select('id, nombre, rol, whatsapp, user_id, managed_by')
    .eq('id', professionalId)
    .maybeSingle()
  const professional = prof as
    | { id: string; nombre: string; rol: string; whatsapp: string; user_id: string | null; managed_by: string | null }
    | null
  if (!professional) return fail(404, 'profesional_no_encontrado', 'No encontramos ese profesional.')

  const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle()
  const isAdmin = (me as { role?: string } | null)?.role === 'admin'
  if (!isAdmin && professional.managed_by !== uid) {
    return fail(403, 'sin_permiso', 'Ese perfil lo administra otra cuenta.')
  }

  const appRole = APP_ROLE[professional.rol]
  if (!appRole) return fail(400, 'rol_sin_app', 'Todavía no hay acceso a la app para ese tipo de profesional.')

  const { data: accessRow, error: accessErr } = await admin
    .from('marketplace_access')
    .select('user_id, email, created_account, activated_at')
    .eq('professional_id', professionalId)
    .maybeSingle()
  if (accessErr) return fail(500, 'falta_migracion', 'Falta correr 20261113120000_marketplace_access.sql en Supabase.')
  const access = accessRow as { user_id: string; email: string; created_account: boolean; activated_at: string | null } | null

  const origin = siteOrigin(request)

  // ── Ya tiene cuenta vinculada: solo se puede regenerar una invitación que nunca se usó. ──
  if (professional.user_id) {
    if (!access || !access.created_account || access.activated_at || access.user_id !== professional.user_id) {
      return fail(409, 'ya_tiene_cuenta', 'Este profesional ya tiene su cuenta. Si olvidó la clave, que use «Olvidé mi contraseña» en el ingreso.')
    }
    const { data: existing } = await admin.auth.admin.getUserById(access.user_id)
    if (!existing?.user || existing.user.last_sign_in_at) {
      return fail(409, 'ya_tiene_cuenta', 'Este profesional ya entró a su cuenta. Si olvidó la clave, que use «Olvidé mi contraseña» en el ingreso.')
    }
    const { link } = await inviteLink(admin, access.email, origin)
    if (!link) return fail(500, 'link', 'No se pudo generar el link. Probá de nuevo.')
    await admin.from('marketplace_access').update({ invited_at: new Date().toISOString(), invited_by: uid }).eq('professional_id', professionalId)
    return Response.json({ status: 'invited', email: access.email, link })
  }

  // ── Sin cuenta todavía. ──
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) {
    return fail(400, 'email_invalido', 'Escribí un correo válido: con ese correo va a entrar a la app.')
  }

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: professional.nombre, hh_invited: true },
  })

  if (created.error || !created.data.user) {
    const code = (created.error as { code?: string } | null)?.code
    const exists = code === 'email_exists' || /already|registered|exists/i.test(created.error?.message ?? '')
    if (!exists) return fail(500, 'alta', 'No se pudo crear la cuenta. Probá de nuevo.')

    // El correo ya tiene cuenta: se vincula, sin tocarle el rol ni la clave. El token que genera
    // esta consulta se descarta: nunca sale del servidor.
    const { userId } = await inviteLink(admin, email, origin)
    if (!userId) return fail(500, 'alta', 'Ese correo ya tiene cuenta pero no se pudo vincular. Probá de nuevo.')
    const { data: theirProfile } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
    const theirRole = (theirProfile as { role?: string } | null)?.role
    if (!theirRole || theirRole === 'student') {
      return fail(409, 'cuenta_de_alumno', 'Ese correo ya se usa en una cuenta de alumno. Usá otro correo.')
    }
    const linked = await admin.from('marketplace_professionals').update({ user_id: userId }).eq('id', professionalId)
    if (linked.error) {
      return fail(409, 'cuenta_ya_vinculada', 'Esa cuenta ya tiene otro perfil en el marketplace.')
    }
    await admin
      .from('marketplace_access')
      .upsert({ professional_id: professionalId, user_id: userId, email, created_account: false, invited_by: uid, activated_at: new Date().toISOString() })
    return Response.json({ status: 'linked_existing', email, link: null })
  }

  const newUserId = created.data.user.id
  const undo = async () => {
    await admin.auth.admin.deleteUser(newUserId)
  }

  // El perfil puede haberlo creado un disparador de alta: se pisa el rol y el nombre.
  const profileUp = await admin
    .from('profiles')
    .upsert({ id: newUserId, full_name: professional.nombre, role: appRole, phone: professional.whatsapp || null })
  if (profileUp.error) {
    await undo()
    return fail(500, 'perfil', `No se pudo armar el perfil de la cuenta (${profileUp.error.message}).`)
  }

  const linked = await admin.from('marketplace_professionals').update({ user_id: newUserId }).eq('id', professionalId)
  if (linked.error) {
    await undo()
    return fail(500, 'vinculo', 'No se pudo vincular la cuenta con el perfil. Probá de nuevo.')
  }

  const saved = await admin
    .from('marketplace_access')
    .upsert({ professional_id: professionalId, user_id: newUserId, email, created_account: true, invited_by: uid })
  if (saved.error) {
    await admin.from('marketplace_professionals').update({ user_id: null }).eq('id', professionalId)
    await undo()
    return fail(500, 'falta_migracion', 'Falta correr 20261113120000_marketplace_access.sql en Supabase.')
  }

  const { link } = await inviteLink(admin, email, origin)
  if (!link) return fail(500, 'link', 'La cuenta se creó pero no se pudo generar el link. Tocá «Generar link nuevo».')
  return Response.json({ status: 'invited', email, link })
}
