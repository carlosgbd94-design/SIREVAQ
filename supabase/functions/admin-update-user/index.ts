import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLES_VALIDOS = ['UNIDAD', 'MUNICIPAL', 'JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN', 'CARAVANAS'];
const CLUES_JURISDICCION = 'QTSSA012154';
const UNIDAD_JURISDICCION = 'OFICINAS DE LA JURISDICCIÓN SANITARIA 1';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

// Edición de un usuario por un ADMIN: rol, CLUES / unidad / municipio, correo y nombre.
//
// Qué cambió respecto a la versión anterior:
//  * El usuario se identifica por su `id` (uuid de Auth). Antes se buscaba por el texto `usuario` con
//    ILIKE: el "_" de los IDs (QTSSA..._NOMBRE) es comodín y dos cuentas con el mismo ID interno se
//    editaban a la vez. Se conserva `usuario` solo como respaldo (coincidencia exacta; si hay más de una
//    cuenta con ese texto, se rechaza en vez de adivinar).
//  * Para UNIDAD la unidad y el municipio se toman del catálogo `unidades` según la CLUES elegida: el
//    navegador ya no puede dejar una CLUES con el nombre/municipio de otra.
//  * Mover a alguien de CLUES NO toca sus reportes históricos (guardan su propia CLUES) ni su ID.
//  * Un ADMIN no puede quitarse a sí mismo el rol ni dejar el sistema sin administradores.
// municipios_allowed según rol: ADMIN todos; MUNICIPAL/JURISDICCIONAL la lista del campo municipio
function municipiosAllowedDe(rol: string, municipio: string): string[] {
  if (rol === 'ADMIN') return ['*'];
  if (rol !== 'MUNICIPAL' && rol !== 'JURISDICCIONAL') return [];
  return [...new Set(municipio.split(/[;,]/).map((m) => m.trim().toUpperCase()).filter((m) => m && m !== 'SIN ASIGNAR'))];
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

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("Error al validar token:", authError);
      throw new Error(`Token inválido o sesión expirada: ${authError?.message || 'Error desconocido'}`);
    }

    // 2. Cliente Admin para operaciones
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Verificar en la base de datos que quien llama sea ADMIN activo
    const { data: callerProfile } = await supabaseAdmin
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.rol !== 'ADMIN' || callerProfile.activo === 'NO') {
      throw new Error('Solo los administradores pueden editar usuarios');
    }

    // 4. Payload
    const payload = await req.json();
    const { id: targetId, usuario: internalID, rol, municipio, clues, unidad, email, nombre, explicito } = payload;

    const nuevoRol = String(rol || '').toUpperCase();
    if (!nuevoRol || !ROLES_VALIDOS.includes(nuevoRol)) {
      throw new Error('El rol proporcionado no es válido');
    }

    // 5. Localizar al usuario: por id; respaldo por ID interno EXACTO
    let target: { id: string; usuario: string; email: string | null; rol: string; municipio: string | null } | null = null;
    if (targetId) {
      const { data } = await supabaseAdmin.from('perfiles').select('id, usuario, email, rol, municipio').eq('id', targetId).maybeSingle();
      target = data;
    } else if (internalID) {
      const { data, error } = await supabaseAdmin.from('perfiles').select('id, usuario, email, rol, municipio').eq('usuario', String(internalID).trim());
      if (error) throw error;
      if ((data || []).length > 1) {
        throw new Error(`Hay ${(data || []).length} cuentas con el ID interno '${internalID}'. Edita desde la lista de usuarios (se identifica por cuenta, no por texto).`);
      }
      target = (data || [])[0] || null;
    } else {
      throw new Error('Falta identificar al usuario a editar');
    }
    if (!target) throw new Error('No se encontró el usuario en la base de datos');

    // 6. No dejar al sistema sin administradores (ni auto-degradarse)
    if (target.rol === 'ADMIN' && nuevoRol !== 'ADMIN') {
      if (target.id === user.id) throw new Error('No puedes quitarte a ti mismo el rol de administrador.');
      const { count } = await supabaseAdmin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'ADMIN').neq('id', target.id).eq('activo', 'SI');
      if (!count) throw new Error('Es el único administrador activo: no se puede cambiar su rol.');
    }

    // 7. Ubicación institucional según el rol (la fuente de verdad es el catálogo, no el navegador)
    let nuevaClues = String(clues || '').trim().toUpperCase();
    let nuevaUnidad = String(unidad || '').trim();
    let nuevoMunicipio = String(municipio || '').trim();

    if (nuevoRol === 'UNIDAD') {
      if (!nuevaClues) throw new Error('Para una cuenta de unidad hay que elegir la CLUES.');
      const { data: cat, error: catErr } = await supabaseAdmin.from('unidades').select('clues, unidad, municipio, activo').eq('clues', nuevaClues).limit(1);
      if (catErr) throw catErr;
      const u = (cat || [])[0];
      if (!u) throw new Error(`La CLUES ${nuevaClues} no existe en el catálogo de unidades.`);
      if (String(u.activo || '').toUpperCase() === 'NO') throw new Error(`La CLUES ${nuevaClues} está inactiva en el catálogo.`);
      nuevaUnidad = u.unidad;
      nuevoMunicipio = u.municipio;
    } else if (nuevoRol === 'MUNICIPAL') {
      const lista = nuevoMunicipio.split(/[;,]/).map((m) => m.trim()).filter(Boolean);
      if (lista.length === 0) throw new Error('Para un usuario municipal hay que asignar al menos un municipio.');
      const { data: munis } = await supabaseAdmin.from('unidades').select('municipio');
      const validos = new Set((munis || []).map((m: { municipio: string }) => norm(m.municipio)));
      validos.add('HENM'); validos.add('NHG');
      const malos = lista.filter((m) => !validos.has(norm(m)));
      if (malos.length) throw new Error(`Municipio(s) que no existen en el catálogo: ${malos.join(', ')}.`);
      nuevoMunicipio = lista.join(',');
      nuevaClues = CLUES_JURISDICCION;
      nuevaUnidad = UNIDAD_JURISDICCION;
    } else if (nuevoRol === 'ADMIN') {
      nuevoMunicipio = '*';
      nuevaClues = nuevaClues || 'SIN CLUES';
      nuevaUnidad = nuevaUnidad || '';
    } else {
      // JURISDICCIONAL / VISUALIZADOR_JURISDICCIONAL / CARAVANAS: oficinas de la jurisdicción.
      // El municipio (p. ej. 'NHG,HENM' de quien hace de municipal de los hospitales) se conserva si el
      // cliente no lo mandó de forma explícita: la versión anterior del panel enviaba '' y lo borraba.
      if (!explicito && !nuevoMunicipio && target.rol === nuevoRol && target.municipio) nuevoMunicipio = target.municipio;
      nuevaClues = CLUES_JURISDICCION;
      nuevaUnidad = UNIDAD_JURISDICCION;
    }

    const updateData: Record<string, unknown> = {
      rol: nuevoRol,
      municipio: nuevoMunicipio,
      clues: nuevaClues,
      unidad: nuevaUnidad,
      // Lo que viaja en el JWT y usan las políticas RLS. Antes solo se cambiaba `municipio`, así que al
      // mover a un MUNICIPAL conservaba el acceso a sus municipios anteriores.
      municipios_allowed: municipiosAllowedDe(nuevoRol, nuevoMunicipio),
    };

    // 8. Correo y nombre (opcionales)
    const nuevoEmail = email ? String(email).trim().toLowerCase() : '';
    if (nuevoEmail && nuevoEmail !== String(target.email || '').toLowerCase()) {
      if (!EMAIL_RE.test(nuevoEmail)) throw new Error('El correo no tiene un formato válido.');
      const { error: mailErr } = await supabaseAdmin.auth.admin.updateUserById(target.id, { email: nuevoEmail, email_confirm: true });
      if (mailErr) throw new Error(`No se pudo cambiar el correo: ${mailErr.message}`);
      updateData.email = nuevoEmail;
    }
    if (typeof nombre === 'string' && nombre.trim()) {
      const n = nombre.trim();
      if (n.length < 3 || n.length > 120) throw new Error('El nombre debe tener entre 3 y 120 caracteres.');
      updateData.nombre = n;
    }

    // 9. Aplicar en perfiles (por id) y reflejar en usuarios_legacy (por ID interno exacto)
    const { error: perfilError } = await supabaseAdmin.from('perfiles').update(updateData).eq('id', target.id);
    if (perfilError) throw new Error(`No se pudo actualizar el perfil: ${perfilError.message}`);

    const legacyData: Record<string, unknown> = { rol: nuevoRol, municipio: nuevoMunicipio, clues: nuevaClues, unidad: nuevaUnidad };
    if (updateData.email) legacyData.email = updateData.email;
    const { error: legacyError } = await supabaseAdmin.from('usuarios_legacy').update(legacyData).eq('usuario', target.usuario);
    if (legacyError) console.error("Error al actualizar legacy:", legacyError);

    return new Response(
      JSON.stringify({ ok: true, message: 'Usuario actualizado exitosamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message || 'Ocurrió un error inesperado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
