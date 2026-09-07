import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      throw new Error('Solo los administradores pueden cambiar el estado de un usuario');
    }

    // 4. Leer Payload
    const payload = await req.json();
    const { usuario: internalID, activo } = payload;

    if (!internalID) {
      throw new Error('El ID de usuario es obligatorio');
    }

    const nuevoEstado = activo ? 'SI' : 'NO';

    // 5. Actualizar en ambas tablas (perfiles = fuente para el listado del panel,
    // usuarios_legacy = fuente para el login clásico). Deben permanecer sincronizadas.
    const { data: perfilRows, error: perfilError } = await supabaseAdmin
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .ilike('usuario', String(internalID).trim())
      .select('id');

    if (perfilError) console.error("Error al actualizar perfiles:", perfilError);

    const { data: legacyRows, error: legacyError } = await supabaseAdmin
      .from('usuarios_legacy')
      .update({ activo: nuevoEstado })
      .ilike('usuario', String(internalID).trim())
      .select('usuario');

    if (legacyError) console.error("Error al actualizar legacy:", legacyError);

    const perfilUpdated = Array.isArray(perfilRows) && perfilRows.length > 0;
    const legacyUpdated = Array.isArray(legacyRows) && legacyRows.length > 0;

    if (!perfilUpdated && !legacyUpdated) {
      throw new Error(`No se encontró el usuario '${internalID}' en ninguna tabla`);
    }

    return new Response(
      JSON.stringify({ ok: true, message: `Usuario ${nuevoEstado === 'SI' ? 'activado' : 'suspendido'} exitosamente` }),
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
