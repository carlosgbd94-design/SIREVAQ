import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Alta de usuarios por un ADMIN — sin contraseñas fijas.
//
// Antes: todos los usuarios nuevos nacían con "JS1-2026-Temp". Ahora la cuenta se crea con una
// contraseña aleatoria que nadie conoce y se envía al correo de la persona un enlace de
// Supabase (plantilla "Reset Password") para que cree la suya en reset.html.

const ROLES_VALIDOS = ['UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN', 'CARAVANAS'];
const CLUES_JURISDICCION = 'QTSSA012154';
const UNIDAD_JURISDICCION = 'OFICINAS DE LA JURISDICCIÓN SANITARIA 1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Escapa los comodines de LIKE ("_" y "%"): los IDs internos llevan guion bajo
const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

function randomPassword(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, 'x') + 'Aa1!'
}

function maskEmail(email: string): string {
  const [l, d] = email.split('@')
  if (!d) return email
  return (l.length <= 3 ? l[0] + '***' : l.slice(0, 3) + '***' + l.slice(-2)) + '@' + d
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
       throw new Error('Configuración incompleta: Falta SUPABASE_SERVICE_ROLE_KEY en los Secrets.');
    }

    // 1. Validar Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No se encontró cabecera de autorización');
    
    const token = authHeader.replace(/bearer /i, '');
    if (token === 'null' || token === 'undefined' || !token) {
      throw new Error('Sesión no válida. Por favor, cierra sesión y vuelve a entrar.');
    }

    // Cliente para validación de usuario
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Error al validar token:", authError);
      throw new Error(`Token inválido o sesión expirada: ${authError?.message || 'Error desconocido'}`);
    }

    // 2. Cliente Admin para operaciones
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verificar en la base de datos que este usuario realmente sea ADMIN
    const { data: callerProfile } = await supabaseAdmin
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.rol !== 'ADMIN') {
      throw new Error('Solo los administradores pueden crear nuevos usuarios');
    }

    // 4. Leer Payload
    const payload = await req.json();
    const { email: authEmail, usuario: internalIDsolicitado, municipio, clues, unidad, rol, nombre } = payload;
    const redirectTo = typeof payload.redirectTo === 'string' ? payload.redirectTo : undefined;

    if (!authEmail || !rol) {
      throw new Error('El correo de acceso y el rol son obligatorios');
    }
    const nuevoRol = String(rol).toUpperCase();
    if (!ROLES_VALIDOS.includes(nuevoRol)) throw new Error('El rol proporcionado no es válido');

    const email = String(authEmail).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error('El correo no tiene un formato válido.');

    // 5. Ubicación institucional según el rol (la fuente de verdad es el catálogo, no el navegador)
    let ubCLUES = String(clues || '').trim().toUpperCase();
    let ubUnidad = String(unidad || '').trim();
    let ubMunicipio = String(municipio || '').trim();

    if (nuevoRol === 'UNIDAD') {
      if (!ubCLUES) throw new Error('Para una cuenta de unidad hay que elegir la CLUES.');
      const { data: cat, error: catErr } = await supabaseAdmin.from('unidades').select('clues, unidad, municipio, activo').eq('clues', ubCLUES).limit(1);
      if (catErr) throw catErr;
      const u = (cat || [])[0];
      if (!u) throw new Error(`La CLUES ${ubCLUES} no existe en el catálogo de unidades.`);
      if (String(u.activo || '').toUpperCase() === 'NO') throw new Error(`La CLUES ${ubCLUES} está inactiva en el catálogo.`);
      ubUnidad = u.unidad;
      ubMunicipio = u.municipio;
    } else if (nuevoRol === 'MUNICIPAL') {
      const lista = ubMunicipio.split(/[;,]/).map((m) => m.trim()).filter(Boolean);
      if (lista.length === 0) throw new Error('Para un usuario municipal hay que asignar al menos un municipio.');
      const { data: munis } = await supabaseAdmin.from('unidades').select('municipio');
      const validos = new Set((munis || []).map((m: { municipio: string }) => norm(m.municipio)));
      validos.add('HENM'); validos.add('NHG');
      const malos = lista.filter((m) => !validos.has(norm(m)));
      if (malos.length) throw new Error(`Municipio(s) que no existen en el catálogo: ${malos.join(', ')}.`);
      ubMunicipio = lista.join(',');
      ubCLUES = CLUES_JURISDICCION;
      ubUnidad = UNIDAD_JURISDICCION;
    } else if (nuevoRol === 'ADMIN') {
      ubMunicipio = '*';
      ubCLUES = ubCLUES || 'SIN CLUES';
    } else {
      ubCLUES = CLUES_JURISDICCION;
      ubUnidad = UNIDAD_JURISDICCION;
    }

    // 6. ID interno ÚNICO. Varias personas pueden compartir unidad: si el ID propuesto ya existe se
    // le agrega _2, _3... en vez de pisar (upsert) o duplicar la cuenta de otra persona.
    const base = String(internalIDsolicitado || '').trim()
      || (nuevoRol === 'UNIDAD' ? `${ubCLUES}_${norm(ubUnidad).replace(/\s+/g, '_')}` : `${ubCLUES}_${nuevoRol}`);
    let internalID = base;
    for (let n = 2; n < 100; n++) {
      const { count } = await supabaseAdmin.from('perfiles').select('id', { count: 'exact', head: true }).ilike('usuario', escLike(internalID));
      const { count: enLegacy } = await supabaseAdmin.from('usuarios_legacy').select('usuario', { count: 'exact', head: true }).ilike('usuario', escLike(internalID));
      if (!count && !enLegacy) break;
      internalID = `${base}_${n}`;
    }

    // 7. Crear usuario en Auth
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        usuario_id: internalID,
        rol: nuevoRol,
        force_password_change: true
      }
    });

    if (createError) throw createError;

    const newUserId = newAuthUser.user.id;

    // 8. Perfil (sobreescribe el que el trigger handle_new_user haya creado con datos genéricos).
    // Si no se puede guardar, se revierte la cuenta de Auth: nunca queda una cuenta sin perfil.
    console.log(`[Admin] Creando perfil para UID: ${newUserId}, ID Interno: ${internalID}`);
    const perfil: Record<string, unknown> = {
      id: newUserId,
      usuario: internalID,
      email,
      rol: nuevoRol,
      municipio: ubMunicipio,
      municipios_allowed: nuevoRol === 'ADMIN' ? ['*'] : (nuevoRol === 'MUNICIPAL' || nuevoRol === 'JURISDICCIONAL')
        ? [...new Set(ubMunicipio.split(/[;,]/).map((m) => m.trim().toUpperCase()).filter((m) => m && m !== 'SIN ASIGNAR'))]
        : [],
      clues: ubCLUES,
      unidad: ubUnidad,
      activo: 'SI',
      must_change: true
    };
    if (typeof nombre === 'string' && nombre.trim().length >= 3) perfil.nombre = nombre.trim();
    const { error: perfilError } = await supabaseAdmin.from('perfiles').upsert(perfil);

    if (perfilError) {
      console.error("Error crítico en perfiles:", perfilError);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`No se pudo guardar el perfil (${perfilError.message}). No se creó la cuenta.`);
    }

    // 9. usuarios_legacy: solo se AGREGA (nunca se pisa la fila de otra persona)
    const { error: legacyError } = await supabaseAdmin.from('usuarios_legacy').upsert({
      usuario: internalID,
      password: null,
      rol: nuevoRol,
      municipio: ubMunicipio,
      clues: ubCLUES,
      unidad: ubUnidad,
      email,
      activo: 'SI',
      must_change: 'true'
    }, { onConflict: 'usuario', ignoreDuplicates: true });

    if (legacyError) console.error("Error en legacy:", legacyError);

    // 10. Enviar el enlace para que la persona cree su propia contraseña
    const { error: mailError } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    const masked = maskEmail(email);
    const sufijo = internalID !== base ? ` (ID interno: ${internalID}, porque ${base} ya existía)` : '';
    const message = mailError
      ? `Usuario creado${sufijo}, pero NO se pudo enviar el correo a ${masked} (${mailError.message}). Usa "Restablecer contraseña" en la lista de usuarios para reenviarlo.`
      : `Usuario creado${sufijo}. Se envió un enlace a ${masked} para que cree su contraseña.`;

    return new Response(
      JSON.stringify({ ok: true, message, emailSent: !mailError, usuario: internalID, id: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Ocurrió un error inesperado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
