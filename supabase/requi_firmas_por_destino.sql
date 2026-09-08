-- ============================================================================
-- Requisiciones — Firmas por nivel/destino (reemplaza los 4 pares de
-- columnas que se habían puesto en requi_requisiciones: el usuario señaló
-- que Elaboró/Autorizó/Entrega/Recibe cambian en cada rango -- jurisdicción,
-- cada municipio/Hospitales y cada unidad tienen su propio responsable, así
-- que capturarlas una sola vez para todo el mes no tiene sentido.
--
-- destino: 'JURISDICCION' para nivel=JURISDICCIONAL (solo hay un destino);
-- el código de municipio ('CORREGIDORA'...'HOSPITALES') para nivel=MUNICIPAL;
-- el id de requi_unidades para nivel=UNIDAD.
-- ============================================================================

alter table requi_requisiciones
  drop column if exists elaboro_nombre,
  drop column if exists elaboro_cargo,
  drop column if exists autorizo_nombre,
  drop column if exists autorizo_cargo,
  drop column if exists entrega_nombre,
  drop column if exists entrega_cargo,
  drop column if exists recibe_nombre,
  drop column if exists recibe_cargo;

create table if not exists requi_firmas (
  id uuid primary key default gen_random_uuid(),
  requisicion_id uuid not null references requi_requisiciones(id) on delete cascade,
  nivel text not null check (nivel in ('JURISDICCIONAL','MUNICIPAL','UNIDAD')),
  destino text not null,
  elaboro_nombre text,
  elaboro_cargo text,
  autorizo_nombre text,
  autorizo_cargo text,
  entrega_nombre text,
  entrega_cargo text,
  recibe_nombre text,
  recibe_cargo text,
  updated_at timestamptz not null default now(),
  unique (requisicion_id, nivel, destino)
);

create index if not exists idx_requi_firmas_requisicion on requi_firmas(requisicion_id);

drop trigger if exists trg_requi_firmas_touch on requi_firmas;
create trigger trg_requi_firmas_touch
  before update on requi_firmas
  for each row execute function requi_trg_touch_updated_at();

alter table requi_firmas enable row level security;

drop policy if exists requi_firmas_select on requi_firmas;
create policy requi_firmas_select on requi_firmas for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));

drop policy if exists requi_firmas_write on requi_firmas;
create policy requi_firmas_write on requi_firmas for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());
