-- Datos de contacto del usuario (nombre y teléfono), editables desde
-- "Mi Perfil > Cuenta". Aditivo: solo agrega 2 columnas nullable y 1 función.
--
-- main.js ya leía `perfil.nombre` (buildUserFromPerfil) pero la columna no existía,
-- así que USER.nombre siempre quedaba vacío y los "capturado_por" caían al usuario.
-- Al llenarse `nombre`, esos textos pasan a mostrar el nombre real.
--
-- El teléfono es solo un dato de contacto (NO se verifica por SMS: Supabase exige
-- proveedor de pago como Twilio para eso).

alter table public.perfiles
  add column if not exists nombre   text,
  add column if not exists telefono text;

alter table public.perfiles drop constraint if exists perfiles_nombre_len;
alter table public.perfiles add  constraint perfiles_nombre_len
  check (nombre is null or char_length(nombre) between 3 and 120);

alter table public.perfiles drop constraint if exists perfiles_telefono_10_digitos;
alter table public.perfiles add  constraint perfiles_telefono_10_digitos
  check (telefono is null or telefono ~ '^[0-9]{10}$');

-- Única vía prevista para que el usuario edite estos dos campos: valida y
-- normaliza en el servidor, y solo toca SU propia fila (auth.uid()).
create or replace function public.actualizar_mi_contacto(p_nombre text, p_telefono text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_nombre text := nullif(btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g')), '');
  v_tel    text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  -- Acepta +52 / 52 al inicio (12 dígitos) y lo normaliza a 10
  if length(v_tel) = 12 and left(v_tel, 2) = '52' then
    v_tel := right(v_tel, 10);
  end if;

  if v_nombre is not null and char_length(v_nombre) < 3 then
    raise exception 'El nombre debe tener al menos 3 caracteres' using errcode = '22023';
  end if;
  if char_length(coalesce(v_nombre, '')) > 120 then
    raise exception 'El nombre es demasiado largo' using errcode = '22023';
  end if;
  if v_tel <> '' and v_tel !~ '^[0-9]{10}$' then
    raise exception 'El teléfono debe tener 10 dígitos' using errcode = '22023';
  end if;

  update public.perfiles
     set nombre     = v_nombre,
         telefono   = nullif(v_tel, ''),
         updated_at = now()
   where id = v_uid;

  if not found then
    raise exception 'No se encontró tu perfil' using errcode = 'P0002';
  end if;

  return jsonb_build_object('nombre', v_nombre, 'telefono', nullif(v_tel, ''));
end;
$$;

revoke all on function public.actualizar_mi_contacto(text, text) from public, anon;
grant execute on function public.actualizar_mi_contacto(text, text) to authenticated;

-- ============================================================================
-- PASO MANUAL EN EL DASHBOARD (no se puede hacer por SQL)
-- El cambio de contraseña desde "Mi Perfil" (perfil_cuenta.js) manda un código de
-- 6 dígitos al correo del usuario y lo valida en el servidor con verifyOtp(type
-- 'recovery'). Para que el correo lo traiga, en:
--   Authentication > Emails > Templates > "Reset Password"
-- agrega, junto al enlace que ya tenga, algo como:
--
--   <p>Tu código de verificación es: <strong>{{ .Token }}</strong></p>
--   <p>Vence en 1 hora. Si no fuiste tú, ignora este mensaje.</p>
--
-- El enlace existente NO se quita: el flujo "¿Olvidaste tu contraseña?" del inicio
-- de sesión sigue usándolo (reset.html).
-- ============================================================================
