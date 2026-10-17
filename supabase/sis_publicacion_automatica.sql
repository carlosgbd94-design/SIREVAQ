-- Publicación AUTOMÁTICA del SINBA-SIS a registros_sis (indicadores).
-- Cuando el municipio queda completo (todas sus unidades VALIDADAS o "sin envío") se publica solo;
-- si después cambia algo (captura validada editada en revisión, re-validación, Influenza, sin envío),
-- se vuelve a publicar. sis_publicar_registros_sis ya es idempotente (borra/inserta solo las mismas llaves).
-- Nunca bloquea la acción del usuario: cualquier falla se registra en sis_publicacion_auto_log.
create table if not exists public.sis_publicacion_auto_log (
  id uuid primary key default gen_random_uuid(),
  anio int not null, mes int not null, municipio text not null,
  resultado text not null, detalle text, usuario text,
  creado_en timestamptz not null default now()
);
alter table public.sis_publicacion_auto_log enable row level security;
drop policy if exists sis_pub_log_lectura on public.sis_publicacion_auto_log;
create policy sis_pub_log_lectura on public.sis_publicacion_auto_log for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and upper(p.rol) in ('ADMIN','JURISDICCIONAL','MUNICIPAL')));

create or replace function public._sis_publicar_auto_core(p_mes int, p_anio int, p_municipio text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ini date; v_usr text; v_res jsonb;
begin
  if p_municipio is null or p_mes is null or p_anio is null then return; end if;
  select valor::date into v_ini from sis_config where clave = 'inicio_captura_por_unidad';
  if v_ini is not null and make_date(p_anio, p_mes, 1) < date_trunc('month', v_ini)::date then return; end if;
  select p.usuario into v_usr from perfiles p where p.id = auth.uid();
  begin
    v_res := sis_publicar_registros_sis(p_mes, p_anio, p_municipio, coalesce(v_usr, 'AUTO') || ' (auto)');
    insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
    values (p_anio, p_mes, p_municipio, 'PUBLICADO',
            'insertadas=' || (v_res ->> 'insertadas') || ' reemplazadas=' || (v_res ->> 'reemplazadas'), v_usr);
  exception when others then
    -- "faltan por validar" / sesión / rol: es el estado normal a mitad de mes, no se registra
    if sqlerrm not like 'Faltan por validar%' and sqlerrm not like 'Sesión no válida%' and sqlerrm not like 'Rol %' then
      insert into sis_publicacion_auto_log (anio, mes, municipio, resultado, detalle, usuario)
      values (p_anio, p_mes, p_municipio, 'BLOQUEADO', left(sqlerrm, 800), v_usr);
    end if;
  end;
end $$;
revoke all on function public._sis_publicar_auto_core(int, int, text) from public, anon, authenticated;

-- Envoltura a prueba de fallas: la publicación automática jamás debe impedir guardar/validar.
create or replace function public._sis_publicar_auto(p_mes int, p_anio int, p_municipio text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _sis_publicar_auto_core(p_mes, p_anio, p_municipio);
exception when others then
  null;
end $$;
revoke all on function public._sis_publicar_auto(int, int, text) from public, anon, authenticated;

create or replace function public.sis06p_trg_publicar_auto_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'VALIDADO' then perform _sis_publicar_auto(new.mes, new.anio, new.municipio); end if;
  return null;
end $$;
drop trigger if exists trg_sis06p_90_publicar_auto on public.sis06p_capturas;
create trigger trg_sis06p_90_publicar_auto after insert or update on public.sis06p_capturas
  for each row execute function public.sis06p_trg_publicar_auto_cap();

create or replace function public.sis06p_trg_publicar_auto_sin_envio() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mun text; v_c text := coalesce(new.clues, old.clues); v_m int := coalesce(new.mes, old.mes); v_a int := coalesce(new.anio, old.anio);
begin
  select municipio into v_mun from biovac_unidades where clues = v_c limit 1;
  perform _sis_publicar_auto(v_m, v_a, v_mun);
  return null;
end $$;
drop trigger if exists trg_sis06p_sin_envio_publicar_auto on public.sis06p_sin_envio;
create trigger trg_sis06p_sin_envio_publicar_auto after insert or delete on public.sis06p_sin_envio
  for each row execute function public.sis06p_trg_publicar_auto_sin_envio();

-- Influenza: solo si el mes de esa unidad ya está publicado (re-publica con los números reales)
create or replace function public.influenza_trg_publicar_auto() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_c text := coalesce(new.clues, old.clues); v_f date := coalesce(new.fecha, old.fecha); v_mun text;
begin
  select municipio into v_mun from biovac_unidades where clues = v_c limit 1;
  if v_mun is not null and exists (
    select 1 from sis_publicaciones p
    where p.anio = extract(year from v_f)::int and p.mes = extract(month from v_f)::int
      and p.municipio = v_mun and v_c = any (p.clues_publicadas)) then
    perform _sis_publicar_auto(extract(month from v_f)::int, extract(year from v_f)::int, v_mun);
  end if;
  return null;
end $$;
drop trigger if exists trg_influenza_publicar_auto on public.influenza_capturas;
create trigger trg_influenza_publicar_auto after insert or update or delete on public.influenza_capturas
  for each row execute function public.influenza_trg_publicar_auto();
