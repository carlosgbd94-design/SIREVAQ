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
    const { id: targetId, usuario: internalID, activo } = payload;

    if (!targetId && !internalID) {
      throw new Error('Falta identificar al usuario');
    }

    const nuevoEstado = activo ? 'SI' : 'NO';

    // 5. Localizar la cuenta por id (uuid). El ID interno `usuario` solo sirve de respaldo y si
    // coincide EXACTAMENTE con una sola cuenta: antes se buscaba con ILIKE y el "_" de los IDs es
    // comodín, así que suspender a un usuario podía suspender también a otro.
    let target: { id: string; usuario: string; rol: string } | null = null;
    if (targetId) {
      const { data } = await supabaseAdmin.from('perfiles').select('id, usuario, rol').eq('id', targetId).maybeSingle();
      target = data;
    } else {
      const { data, error } = await supabaseAdmin.from('perfiles').select('id, usuario, rol').eq('usuario', String(internalID).trim());
      if (error) throw error;
      if ((data || []).length > 1) throw new Error(`Hay varias cuentas con el ID interno '${internalID}'; usa la lista de usuarios.`);
      target = (data || [])[0] || null;
    }
    if (!target) throw new Error('No se encontró el usuario');

    if (nuevoEstado === 'NO') {
      if (target.id === user.id) throw new Error('No puedes suspender tu propia cuenta.');
      if (target.rol === 'ADMIN') {
        const { count } = await supabaseAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'ADMIN').neq('id', target.id).eq('activo', 'SI');
        if (!count) throw new Error('Es el único administrador activo: no se puede suspender.');
      }
    }

    // 6. Suspender DE VERDAD: además de la marca en perfiles (que el navegador revisa al abrir sesión),
    // se bloquea la cuenta en Auth. Sin esto una sesión ya abierta seguía leyendo/escribiendo
    // (las políticas RLS no consultan `activo`) hasta que expiraba su token, y podía renovarlo.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(target.id, {
      ban_duration: nuevoEstado === 'NO' ? '876000h' : 'none'
    });
    if (banError) throw new Error(`No se pudo ${nuevoEstado === 'NO' ? 'bloquear' : 'desbloquear'} la cuenta en Auth: ${banError.message}`);

    // 7. Actualizar perfiles (por id) y usuarios_legacy (por ID interno exacto)
    const { error: perfilError } = await supabaseAdmin.from('perfiles').update({ activo: nuevoEstado }).eq('id', target.id);
    if (perfilError) throw new Error(`No se pudo actualizar el perfil: ${perfilError.message}`);

    const { error: legacyError } = await supabaseAdmin.from('usuarios_legacy').update({ activo: nuevoEstado }).eq('usuario', target.usuario);
    if (legacyError) console.error("Error al actualizar legacy:", legacyError);

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
