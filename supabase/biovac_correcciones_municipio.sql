-- =============================================================================
-- BioVac: corrección de Jurisdicción sobre el movimiento de un MUNICIPIO.
--
-- Desde el arranque por unidad el movimiento del municipio es la SUMA de sus unidades, así que
-- Jurisdicción no puede teclearlo directamente. En vez de eso pide una corrección: fija las cifras
-- que deben quedar para un lote de un municipio (recibido / aplicadas / desechadas). El municipio
-- ajusta los movimientos de sus unidades hasta que la suma coincida; entonces la solicitud se
-- marca RESUELTA sola y desaparece de la vista (la fila gris del municipio y su corrección).
--
--  * biovac_correcciones_municipio: una solicitud PENDIENTE por (jurisdicción, municipio, mes, lote,
--    categoría). Solo se guardan las cifras que Jurisdicción corrigió (las demás quedan en null y no se
--    comparan). La existencia anterior nunca se corrige: viene del cierre del mes anterior.
--  * biovac_correcciones_municipio_estado(...): devuelve las pendientes con la suma actual de las
--    unidades y si ya coincide; las que coinciden las marca RESUELTA (security definer, para que el
--    municipal las cierre al cuadrar sin tener permiso de escritura sobre la tabla).
-- =============================================================================

create table if not exists public.biovac_correcciones_municipio (
  id uuid primary key default gen_random_uuid(),
  jurisdiccion_id uuid not null references biovac_jurisdicciones(id),
  municipio text not null,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  lote_id uuid not null references biovac_lotes(id),
  categoria text not null,
  recibido_frascos numeric,
  aplicadas_a numeric,
  aplicadas_b numeric,
  desechadas_a numeric,
  desechadas_b numeric,
  motivo text not null,
  creado_por text not null,
  creado_en timestamptz not null default now(),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'RESUELTA', 'CANCELADA')),
  resuelto_en timestamptz
);

create unique index if not exists uq_biovac_corr_muni_pendiente
  on public.biovac_correcciones_municipio (jurisdiccion_id, municipio, anio, mes, lote_id, categoria)
  where estado = 'PENDIENTE';

alter table public.biovac_correcciones_municipio enable row level security;

drop policy if exists biovac_corr_muni_select on public.biovac_correcciones_municipio;
create policy biovac_corr_muni_select on public.biovac_correcciones_municipio
  for select to authenticated using (true);

drop policy if exists biovac_corr_muni_write on public.biovac_correcciones_municipio;
create policy biovac_corr_muni_write on public.biovac_correcciones_municipio
  for all to authenticated
  using (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI'
                 and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')))
  with check (exists (select 1 from perfiles p where p.id = (select auth.uid()) and p.activo = 'SI'
                      and upper(p.rol) in ('ADMIN', 'JURISDICCIONAL')));

create or replace function public.biovac_correcciones_municipio_estado(
  p_jurisdiccion_id uuid, p_anio int, p_mes int, p_municipio text default null
) returns table (
  id uuid, municipio text, lote_id uuid, numero_lote text, biologico_id uuid, nombre_excel text, categoria text,
  motivo text, creado_por text, creado_en timestamptz,
  obj_recibido numeric, obj_aplicadas_a numeric, obj_aplicadas_b numeric, obj_desechadas_a numeric, obj_desechadas_b numeric,
  act_recibido numeric, act_aplicadas_a numeric, act_aplicadas_b numeric, act_desechadas_a numeric, act_desechadas_b numeric,
  coincide boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with base as (
    select c.* from biovac_correcciones_municipio c
    where c.estado = 'PENDIENTE' and c.jurisdiccion_id = p_jurisdiccion_id and c.anio = p_anio and c.mes = p_mes
      and (p_municipio is null or c.municipio = p_municipio)
  ),
  act as (
    select b.id as cid,
           coalesce(sum(r.recibido_frascos), 0) as a_rec, coalesce(sum(r.aplicadas_a), 0) as a_apa,
           coalesce(sum(r.aplicadas_b), 0) as a_apb, coalesce(sum(r.desechadas_a), 0) as a_dea,
           coalesce(sum(r.desechadas_b), 0) as a_deb
    from base b
    left join biovac_unidades u on u.jurisdiccion_id = b.jurisdiccion_id and u.municipio = b.municipio and u.activo
         and biovac_cuenta_para_jurisdiccion(u.clues, u.municipio, b.anio, b.mes)
    left join biovac_movimientos m on m.unidad_id = u.id and m.anio = b.anio and m.mes = b.mes
    left join biovac_renglones r on r.movimiento_id = m.id and r.lote_id = b.lote_id and r.categoria = b.categoria
    group by b.id
  ),
  res as (
    select b.*, a.a_rec, a.a_apa, a.a_apb, a.a_dea, a.a_deb,
           (b.recibido_frascos is null or b.recibido_frascos = a.a_rec)
           and (b.aplicadas_a is null or b.aplicadas_a = a.a_apa)
           and (b.aplicadas_b is null or b.aplicadas_b = a.a_apb)
           and (b.desechadas_a is null or b.desechadas_a = a.a_dea)
           and (b.desechadas_b is null or b.desechadas_b = a.a_deb) as ok
    from base b join act a on a.cid = b.id
  ),
  cierre as (
    update biovac_correcciones_municipio c set estado = 'RESUELTA', resuelto_en = now()
    from res where res.id = c.id and res.ok
    returning c.id
  )
  select res.id, res.municipio, res.lote_id, l.numero_lote, l.biologico_id, cb.nombre_excel, res.categoria,
         res.motivo, res.creado_por, res.creado_en,
         res.recibido_frascos, res.aplicadas_a, res.aplicadas_b, res.desechadas_a, res.desechadas_b,
         res.a_rec, res.a_apa, res.a_apb, res.a_dea, res.a_deb, res.ok
  from res
  join biovac_lotes l on l.id = res.lote_id
  join biovac_catalogo_biologicos cb on cb.id = l.biologico_id
  order by cb.orden_en_bloque, l.numero_lote;
end;
$$;

revoke all on function public.biovac_correcciones_municipio_estado(uuid, int, int, text) from public, anon;
grant execute on function public.biovac_correcciones_municipio_estado(uuid, int, int, text) to authenticated;
