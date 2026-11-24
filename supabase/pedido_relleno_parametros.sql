-- 2026-11-24: el pedido capturado desde el MOVIL no guardaba promedio_frascos / min_dosis / max_dosis (ni unidad),
-- asi que el detalle del pedido (Live View) mostraba 0 en Promedio y Min/Max y sin cobertura.
--
-- 1) Relleno de datos aplicado una vez (pedidos con los tres parametros en cero, tomados de biologicos_params):
--    ver el UPDATE al final de este archivo.
-- 2) Guardia: al insertar un renglon sin parametros, se toman de biologicos_params de esa CLUES y biologico
--    (cubre clientes viejos en cache y cualquier otra via de captura).
create or replace function public.pedido_relleno_parametros()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p record;
begin
  if coalesce(nullif(new.promedio_frascos::text, '')::numeric, 0) = 0
     and coalesce(new.max_dosis, 0) = 0 and coalesce(new.min_dosis, 0) = 0 then
    select bp.promedio_frascos, bp.min_dosis, bp.max_dosis, bp.unidad into p
      from biologicos_params bp
     where upper(bp.clues) = upper(new.clues) and upper(bp.biologico) = upper(new.biologico)
     order by (bp.activo = 'SI') desc
     limit 1;
    if found then
      new.promedio_frascos := p.promedio_frascos;
      new.min_dosis := p.min_dosis;
      new.max_dosis := p.max_dosis;
    end if;
  end if;
  if new.unidad is null then
    select u.unidad into new.unidad from unidades u where upper(u.clues) = upper(new.clues) limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pedido_params_relleno on public.biologicos_pedido;
create trigger trg_pedido_params_relleno
  before insert on public.biologicos_pedido
  for each row execute function public.pedido_relleno_parametros();

-- Relleno de lo ya capturado sin parametros (pedidos de noviembre 2026 en adelante)
update public.biologicos_pedido b
   set promedio_frascos = p.promedio_frascos, min_dosis = p.min_dosis, max_dosis = p.max_dosis
  from public.biologicos_params p
 where upper(p.clues) = upper(b.clues) and upper(p.biologico) = upper(b.biologico) and p.activo = 'SI'
   and b.fecha_pedido_programada >= '2026-11-01'
   and coalesce(nullif(b.promedio_frascos::text, '')::numeric, 0) = 0 and coalesce(b.max_dosis, 0) = 0 and coalesce(b.min_dosis, 0) = 0;
update public.biologicos_pedido b
   set unidad = u.unidad
  from public.unidades u
 where upper(u.clues) = upper(b.clues) and b.unidad is null and b.fecha_pedido_programada >= '2026-11-01';
