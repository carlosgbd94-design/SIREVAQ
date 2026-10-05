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
      throw new Error('Solo los administradores pueden borrar usuarios');
    }

    // 4. Leer Payload
    const payload = await req.json();
    const { id: targetId, usuario: internalID } = payload;

    if (!targetId && !internalID) {
      throw new Error('Falta identificar al usuario');
    }

    // Buscar el perfil por id (uuid). El ID interno `usuario` solo es respaldo y debe coincidir
    // EXACTAMENTE con una cuenta: antes era ILIKE ("_" = comodín) con LIMIT 1 y podía borrar a OTRA persona.
    let targetProfile: { id: string; email: string | null; usuario: string; rol: string } | null = null;
    if (targetId) {
      const { data, error: targetError } = await supabaseAdmin.from('perfiles').select('id, email, usuario, rol').eq('id', targetId).maybeSingle();
      if (targetError) throw new Error(`Error al buscar el perfil: ${targetError.message}`);
      targetProfile = data;
    } else {
      const { data, error: targetError } = await supabaseAdmin.from('perfiles').select('id, email, usuario, rol').eq('usuario', String(internalID).trim());
      if (targetError) throw new Error(`Error al buscar el perfil: ${targetError.message}`);
      if ((data || []).length > 1) throw new Error(`Hay varias cuentas con el ID interno '${internalID}'; elimínala desde la lista de usuarios.`);
      targetProfile = (data || [])[0] || null;
    }

    if (targetProfile) {
      if (targetProfile.id === user.id) throw new Error('No puedes eliminar tu propia cuenta.');
      if (targetProfile.rol === 'ADMIN') {
        const { count } = await supabaseAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'ADMIN').neq('id', targetProfile.id).eq('activo', 'SI');
        if (!count) throw new Error('Es el único administrador activo: no se puede eliminar.');
      }

      // 5. Eliminar usuario en Auth
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        targetProfile.id
      );

      if (deleteAuthError) {
        throw new Error(`Error al eliminar la cuenta en Auth: ${deleteAuthError.message}`);
      }

      const { error: delPerfilError } = await supabaseAdmin
        .from('perfiles')
        .delete()
        .eq('id', targetProfile.id);
        
      if (delPerfilError) console.error("Error al borrar perfil:", delPerfilError);
    } else if (internalID) {
      // Sin perfil: solo se limpia la fila heredada con ese ID interno EXACTO
      console.warn(`No se encontró perfil para ${internalID}, procediendo a borrar de legacy si existe.`);
    } else {
      throw new Error('No se encontró el usuario');
    }

    // Fila heredada: solo si ya NINGUNA otra cuenta usa ese ID interno (coincidencia exacta, no ILIKE)
    const legacyId = targetProfile ? targetProfile.usuario : String(internalID).trim();
    const { count: otras } = await supabaseAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('usuario', legacyId);
    if (!otras) {
      const { error: delLegacyError } = await supabaseAdmin.from('usuarios_legacy').delete().eq('usuario', legacyId);
      if (delLegacyError) console.error("Error al borrar legacy:", delLegacyError);
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Usuario eliminado exitosamente' }),
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
