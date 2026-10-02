-- ============================================================================
-- Catálogo de lotes ("Carga de lotes por municipio") alimentado desde Requisiciones
--
-- Regla (usuario, 2026-10-01): cada lote que Requisiciones reparte a un
-- municipio/hospital debe estar dado de alta en `lotes` para ESE destino:
--   * lote que no existe            -> se da de alta (tipo NORMAL) en los destinos que lo recibieron;
--   * lote que ya existe            -> NO se duplica; solo se agrega a los destinos donde faltaba;
--   * lote "POR DEFINIR"            -> se ignora hasta que se asigne el lote real.
-- Nunca borra ni modifica filas existentes (el catálogo manda: si la caducidad de
-- Requisiciones difiere de la ya registrada se conserva la registrada y se avisa).
-- Idempotente, atómico y serializado (advisory lock). Corre solo (trigger sobre el
-- reparto a municipios) y también a demanda (RPC lotes_sincronizar_desde_requisiciones).
-- ============================================================================

alter table lotes add column if not exists origen text;   -- NULL = capturado a mano; 'REQUISICION' = alta automática

-- Requisiciones -> nombre en `lotes.biologico` (mismos nombres que BIOS_LIST de la app).
create table if not exists requi_lotes_mapa_biologico (
  codigo_articulo text primary key,
  lotes_biologico text not null
);
alter table requi_lotes_mapa_biologico enable row level security;
drop policy if exists requi_lotes_mapa_select on requi_lotes_mapa_biologico;
create policy requi_lotes_mapa_select on requi_lotes_mapa_biologico for select to authenticated using (true);
insert into requi_lotes_mapa_biologico (codigo_articulo, lotes_biologico) values
  ('148','NEUMOCÓCICA 13'), ('6508','NEUMOCÓCICA 20'), ('150','ROTAVIRUS'), ('6135','HEXAVALENTE'),
  ('2526','HEPATITIS B'), ('3825','HEPATITIS A'), ('6187','HEPATITIS A'), ('3800','SR'), ('3801','BCG'),
  ('3805','DPT'), ('3808','TDPA'), ('3810','TD'), ('6056','VARICELA'), ('3820','SRP'),
  ('6317','INFLUENZA'), ('6501','VPH'), ('6509','VSR'), ('6502','COVID-19'), ('6506','COVID-19')
on conflict (codigo_articulo) do update set lotes_biologico = excluded.lotes_biologico;

-- Candidatos: (biologico, lote, destino) con reparto > 0 y lote real. La caducidad
-- sale del catálogo si el lote ya existe (fuente de verdad), si no de Requisiciones.
create or replace function _lotes_candidatos(p_requisicion uuid default null, p_municipio text default null, p_lote uuid default null)
returns table (biologico text, lote text, municipio text, caducidad text, cad_requisicion text)
language sql stable security definer set search_path = public as $$
  with base as (
    select distinct on (m.lotes_biologico, upper(btrim(l.numero_lote)), d.municipio)
      m.lotes_biologico as bio,
      upper(btrim(l.numero_lote)) as lote,
      case d.municipio when 'QUERETARO' then 'QUERÉTARO' when 'MARQUES' then 'EL MARQUÉS' else d.municipio end as muni,
      l.caducidad::text as cad_req
    from requi_distribucion_municipio d
    join requi_lotes l on l.id = d.lote_id
    join requi_catalogo_biologicos c on c.id = d.requi_biologico_id
    join requi_lotes_mapa_biologico m on m.codigo_articulo = c.codigo_articulo
    where d.cantidad > 0
      and btrim(l.numero_lote) <> '' and upper(btrim(l.numero_lote)) <> 'POR DEFINIR'
      and (p_requisicion is null or d.requisicion_id = p_requisicion)
      and (p_municipio is null or d.municipio = p_municipio)
      and (p_lote is null or d.lote_id = p_lote)
    order by m.lotes_biologico, upper(btrim(l.numero_lote)), d.municipio, l.caducidad nulls last
  )
  select b.bio, b.lote, b.muni,
    coalesce(
      (select x.caducidad from lotes x
        where x.biologico = b.bio and upper(btrim(x.lote)) = b.lote and x.caducidad is not null
        order by (x.tipo = 'NORMAL') desc, x.created_ts desc nulls last limit 1),
      b.cad_req),
    b.cad_req
  from base b;
$$;

-- Núcleo: inserta solo lo que falta. Devuelve un resumen.
create or replace function _lotes_publicar(p_requisicion uuid default null, p_municipio text default null, p_lote uuid default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_insertados int := 0;
  v_ya int := 0;
  v_sin_cad int := 0;
  v_conf jsonb;
  v_nuevos jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('lotes_publicar'));

  select count(*) into v_sin_cad from _lotes_candidatos(p_requisicion, p_municipio, p_lote) c where c.caducidad is null;

  with candidatos as (select * from _lotes_candidatos(p_requisicion, p_municipio, p_lote) c where c.caducidad is not null),
  faltan as (
    select c.* from candidatos c
    where not exists (
      select 1 from lotes x
      where x.biologico = c.biologico and upper(btrim(x.lote)) = c.lote
        and x.municipio in (c.municipio, '*', 'TODOS') and x.tipo = 'NORMAL')   -- '*'/'TODOS' = ya aplica a todos los destinos
  ),
  ins as (
    insert into lotes (biologico, lote, caducidad, municipio, tipo, origen)
    select f.biologico, f.lote, f.caducidad, f.municipio, 'NORMAL', 'REQUISICION' from faltan f
    on conflict (biologico, lote, municipio, tipo) do nothing
    returning biologico, lote, municipio
  )
  select (select count(*) from ins),
         (select count(*) from candidatos) - (select count(*) from ins),
         coalesce((select jsonb_agg(distinct jsonb_build_object('biologico', i.biologico, 'lote', i.lote)) from ins i), '[]'::jsonb)
    into v_insertados, v_ya, v_nuevos;

  select coalesce(jsonb_agg(jsonb_build_object('biologico', c.biologico, 'lote', c.lote,
           'caducidad_catalogo', c.caducidad, 'caducidad_requisicion', c.cad_requisicion)), '[]'::jsonb)
    into v_conf
  from (select distinct biologico, lote, caducidad, cad_requisicion
        from _lotes_candidatos(p_requisicion, p_municipio, p_lote)
        where caducidad is not null and cad_requisicion is not null and caducidad <> cad_requisicion) c;

  return jsonb_build_object('insertados', v_insertados, 'ya_existian', v_ya, 'sin_caducidad', v_sin_cad,
                            'lotes_nuevos', v_nuevos, 'conflictos_caducidad', v_conf);
end;
$$;
revoke all on function _lotes_candidatos(uuid, text, uuid) from public, anon, authenticated;
revoke all on function _lotes_publicar(uuid, text, uuid) from public, anon, authenticated;

-- RPC a demanda (botón "Sincronizar lotes" en Requisiciones): solo ADMIN/JURISDICCIONAL.
-- Con año+mes limita a las requisiciones de ese mes; sin parámetros revisa todas.
create or replace function lotes_sincronizar_desde_requisiciones(p_anio int default null, p_mes int default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
  v_totales jsonb := jsonb_build_object('insertados', 0, 'ya_existian', 0, 'sin_caducidad', 0,
                       'lotes_nuevos', '[]'::jsonb, 'conflictos_caducidad', '[]'::jsonb);
  r record;
  v_pend int;
  v_sin_mapa text;
begin
  if not (is_admin() or is_jurisdiccional()) then
    raise exception 'Solo ADMIN o JURISDICCIONAL pueden sincronizar el catálogo de lotes.';
  end if;
  for r in select id from requi_requisiciones
           where (p_anio is null or anio = p_anio) and (p_mes is null or mes = p_mes) loop
    v_res := _lotes_publicar(r.id);
    v_totales := jsonb_build_object(
      'insertados', (v_totales->>'insertados')::int + (v_res->>'insertados')::int,
      'ya_existian', (v_totales->>'ya_existian')::int + (v_res->>'ya_existian')::int,
      'sin_caducidad', (v_totales->>'sin_caducidad')::int + (v_res->>'sin_caducidad')::int,
      'lotes_nuevos', (v_totales->'lotes_nuevos') || (v_res->'lotes_nuevos'),
      'conflictos_caducidad', (v_totales->'conflictos_caducidad') || (v_res->'conflictos_caducidad'));
  end loop;

  select count(*) into v_pend
  from requi_distribucion_municipio d join requi_lotes l on l.id = d.lote_id join requi_requisiciones q on q.id = d.requisicion_id
  where d.cantidad > 0 and upper(btrim(l.numero_lote)) = 'POR DEFINIR'
    and (p_anio is null or q.anio = p_anio) and (p_mes is null or q.mes = p_mes);
  select coalesce(string_agg(distinct c.nombre, ', '), '') into v_sin_mapa
  from requi_distribucion_municipio d join requi_catalogo_biologicos c on c.id = d.requi_biologico_id
  join requi_requisiciones q on q.id = d.requisicion_id
  where d.cantidad > 0 and not exists (select 1 from requi_lotes_mapa_biologico m where m.codigo_articulo = c.codigo_articulo)
    and (p_anio is null or q.anio = p_anio) and (p_mes is null or q.mes = p_mes);
  return v_totales || jsonb_build_object('por_definir_omitidos', v_pend, 'biologicos_sin_equivalente', v_sin_mapa);
end;
$$;
revoke all on function lotes_sincronizar_desde_requisiciones(int, int) from public, anon;
grant execute on function lotes_sincronizar_desde_requisiciones(int, int) to authenticated;

-- Automático: cada reparto a un municipio/hospital publica su lote al instante.
-- Un fallo aquí nunca debe impedir capturar la requisición.
create or replace function _trg_requi_dist_publica_lotes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cantidad > 0 then
    begin
      perform _lotes_publicar(new.requisicion_id, new.municipio, new.lote_id);
    exception when others then
      raise warning 'No se pudo publicar el lote en el catálogo: %', sqlerrm;
    end;
  end if;
  return null;
end;
$$;
revoke all on function _trg_requi_dist_publica_lotes() from public, anon, authenticated;

drop trigger if exists trg_requi_dist_publica_lotes on requi_distribucion_municipio;
create trigger trg_requi_dist_publica_lotes
  after insert or update of cantidad, lote_id on requi_distribucion_municipio
  for each row execute function _trg_requi_dist_publica_lotes();
