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
    const { email: authEmail, usuario: internalID, municipio, clues, unidad, rol } = payload;
    const redirectTo = typeof payload.redirectTo === 'string' ? payload.redirectTo : undefined;
    
    if (!authEmail || !internalID || !rol) {
      throw new Error('El correo de acceso, el ID de usuario y el rol son obligatorios');
    }

    const email = authEmail.trim().toLowerCase();

    // 5. Crear usuario en Auth
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { 
        usuario_id: internalID,
        rol: rol.toUpperCase(),
        force_password_change: true 
      }
    });

    if (createError) throw createError;

    const newUserId = newAuthUser.user.id;

    // 6. Upsert en tabla perfiles (sobreescribir si el trigger ya lo creó)
    console.log(`[Admin] Creando perfil para UID: ${newUserId}, ID Interno: ${internalID}`);
    const { error: perfilError } = await supabaseAdmin.from('perfiles').upsert({
      id: newUserId,
      usuario: internalID, // Guardar el ID interno (ej: CLUES_MUNICIPIO)
      rol: rol.toUpperCase(),
      municipio: municipio || '',
      clues: clues || '',
      unidad: unidad || '',
      activo: 'SI',
      must_change: true
    });

    if (perfilError) console.error("Error crítico en perfiles:", perfilError);

    // 7. Upsert en tabla usuarios_legacy
    const { error: legacyError } = await supabaseAdmin.from('usuarios_legacy').upsert({
      usuario: internalID, // Guardar el ID interno
      password: null,
      rol: rol.toUpperCase(),
      municipio: municipio || '',
      clues: clues || '',
      unidad: unidad || '',
      activo: 'SI',
      must_change: true
    }, { onConflict: 'usuario' });

    if (legacyError) console.error("Error crítico en legacy:", legacyError);

    // 8. Enviar el enlace para que la persona cree su propia contraseña
    const { error: mailError } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
    const masked = maskEmail(email);
    const message = mailError
      ? `Usuario creado, pero NO se pudo enviar el correo a ${masked} (${mailError.message}). Usa "Restablecer contraseña" en la lista de usuarios para reenviarlo.`
      : `Usuario creado. Se envió un enlace a ${masked} para que cree su contraseña.`;

    return new Response(
      JSON.stringify({ ok: true, message, emailSent: !mailError }),
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
