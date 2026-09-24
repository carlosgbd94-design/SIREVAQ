// recover-access — "¿Olvidaste tu contraseña?" y "Enlace mágico" desde el inicio de sesión.
//
// Antes el navegador leía public.usuarios_legacy (usuario -> correo) con la llave anónima,
// lo que obligaba a dejar esa tabla (con hashes de contraseña y correos) legible por
// cualquiera. Ahora la búsqueda se hace aquí, con la service role, y al navegador solo
// regresa el correo ENMASCARADO (nunca completo).
//
// Deploy con verify_jwt = true: el login llama con la llave anónima (que es un JWT válido)
// en Authorization; así se descartan llamadas que no vengan de un cliente de Supabase.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function maskEmail(email: string): string {
  const [l, d] = email.split('@')
  if (!d) return email
  return (l.length <= 3 ? l[0] + '***' : l.slice(0, 3) + '***' + l.slice(-2)) + '@' + d
}

// Escapa comodines de ILIKE para que "a%" no coincida con medio catálogo
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)

// Freno básico por IP (memoria de la instancia; Supabase Auth ya limita 1 correo/min por destino)
const hits = new Map<string, number[]>()
function tooMany(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > 6
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, code: 'METHOD', message: 'Método no permitido' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!url || !anonKey || !serviceKey) throw new Error('Configuración incompleta del servidor')

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    if (tooMany(ip)) return json({ ok: false, code: 'RATE', message: 'Demasiados intentos. Espera un minuto.' }, 429)

    const body = await req.json().catch(() => ({}))
    const identifier = String(body.identifier ?? '').trim()
    const mode = body.mode === 'magiclink' ? 'magiclink' : 'recovery'
    const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined
    if (!identifier || identifier.length > 200) {
      return json({ ok: false, code: 'BAD_INPUT', message: 'Ingresa tu usuario o correo institucional' }, 400)
    }

    let email = ''
    if (identifier.includes('@')) {
      email = identifier.toLowerCase()
    } else {
      const admin = createClient(url, serviceKey)
      const pattern = escapeLike(identifier)
      // perfiles es la fuente vigente; usuarios_legacy solo como respaldo de cuentas viejas
      let found: string | null = null
      const p = await admin.from('perfiles').select('email').ilike('usuario', pattern).limit(1).maybeSingle()
      found = p.data?.email ?? null
      if (!found) {
        const l = await admin.from('usuarios_legacy').select('email').ilike('usuario', pattern).limit(1).maybeSingle()
        found = l.data?.email ?? null
      }
      if (!found) {
        return json({ ok: false, code: 'NO_EMAIL', message: 'El usuario no tiene un correo registrado o no existe' }, 404)
      }
      email = found
    }

    const anon = createClient(url, anonKey)
    const { error } = mode === 'magiclink'
      // shouldCreateUser:false — solo cuentas ya dadas de alta por un administrador
      // (evita que cualquier correo obtenga cuenta vía public.handle_new_user)
      ? await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
      : await anon.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) return json({ ok: false, code: 'AUTH', message: error.message }, 400)
    return json({ ok: true, masked: maskEmail(email) })
  } catch (e) {
    console.error('recover-access error:', e)
    return json({ ok: false, code: 'SERVER', message: 'No se pudo procesar la solicitud' }, 500)
  }
})
