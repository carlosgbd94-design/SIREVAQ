import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

// Reseteo de contraseña por un ADMIN — sin contraseñas fijas.
//
// Antes: se ponía siempre "JS1-2026-Temp" (la misma para todos, conocida por todos los admins).
// Ahora:
//   1) la contraseña actual se invalida poniendo una aleatoria que NADIE conoce,
//   2) se envía al correo de la persona un enlace de Supabase (plantilla "Reset Password")
//      para que ella misma cree su contraseña en reset.html.
// El orden importa: cambiar la contraseña en Auth invalida los tokens de recuperación
// pendientes, así que primero se cambia y DESPUÉS se envía el correo.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function randomPassword(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  // Base64 sin símbolos problemáticos + sufijo para cumplir reglas de complejidad
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
      throw new Error('Solo los administradores pueden resetear contraseñas');
    }

    // 4. Leer Payload
    const payload = await req.json();
    const { usuario: internalID } = payload;
    const redirectTo = typeof payload.redirectTo === 'string' ? payload.redirectTo : undefined;

    if (!internalID) {
      throw new Error('El ID de usuario es obligatorio');
    }

    // Buscar el usuario real en 'perfiles' para obtener su Auth ID y correo
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('perfiles')
      .select('id, email')
      .eq('usuario', internalID)
      .single();

    if (targetError || !targetProfile) {
      throw new Error('No se encontró el perfil del usuario en la base de datos');
    }
    if (!targetProfile.email) {
      throw new Error('Este usuario no tiene un correo registrado, no se le puede enviar el enlace');
    }

    // 5. Invalidar la contraseña actual (aleatoria, desconocida) y exigir cambio
    const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
      targetProfile.id,
      {
        password: randomPassword(),
        user_metadata: { force_password_change: true }
      }
    );

    if (updateAuthError) {
      throw new Error(`Error al resetear la contraseña en Auth: ${updateAuthError.message}`);
    }

    // 6. Marcar must_change en perfiles y limpiar cualquier hash heredado en usuarios_legacy
    const { error: updatePerfilError } = await supabaseAdmin
      .from('perfiles')
      .update({ must_change: true })
      .eq('id', targetProfile.id);

    if (updatePerfilError) console.error("Error al actualizar perfiles:", updatePerfilError);

    const { error: legacyError } = await supabaseAdmin
      .from('usuarios_legacy')
      .update({ password: null, must_change: true })
      .eq('usuario', internalID);

    if (legacyError) console.error("Error al actualizar legacy:", legacyError);

    // 7. Enviar el enlace para que la persona cree su propia contraseña
    const { error: mailError } = await supabaseClient.auth.resetPasswordForEmail(targetProfile.email, { redirectTo });
    const masked = maskEmail(targetProfile.email);

    if (mailError) {
      throw new Error(
        `La contraseña anterior ya quedó invalidada, pero no se pudo enviar el correo a ${masked} (${mailError.message}). ` +
        `Vuelve a pulsar "Restablecer" en unos minutos o pídele que use "¿Olvidaste tu contraseña?".`
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: `Se envió un enlace para crear una contraseña nueva a ${masked}. La contraseña anterior ya no funciona.` }),
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
