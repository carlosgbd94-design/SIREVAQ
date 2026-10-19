-- Marca (MODERNA/PFIZER) de cada lote de COVID-19, deducida de Requisiciones (claves 6502 Moderna, 6506 Pfizer).
-- La existencia de las unidades guarda un solo biológico «COVID-19» sin marca; el PDF de resguardo y los cálculos de dosis
-- la necesitan para usar 5 dosis por frasco (Moderna) o 6 (Pfizer). Solo devuelve lote + marca (nada sensible).
create or replace function public.covid_marca_por_lote()
returns table (lote text, marca text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct upper(btrim(l.numero_lote)) as lote,
         case b.codigo_articulo when '6502' then 'MODERNA' else 'PFIZER' end as marca
    from requi_lotes l
    join requi_distribucion_unidad du on du.lote_id = l.id
    join requi_catalogo_biologicos b on b.id = du.requi_biologico_id and b.codigo_articulo in ('6502', '6506')
   where btrim(l.numero_lote) <> '' and upper(btrim(l.numero_lote)) <> 'POR DEFINIR'
  union
  select distinct upper(btrim(l.numero_lote)),
         case b.codigo_articulo when '6502' then 'MODERNA' else 'PFIZER' end
    from requi_lotes l
    join requi_distribucion_municipio d on d.lote_id = l.id
    join requi_catalogo_biologicos b on b.id = d.requi_biologico_id and b.codigo_articulo in ('6502', '6506')
   where btrim(l.numero_lote) <> '' and upper(btrim(l.numero_lote)) <> 'POR DEFINIR';
$$;

revoke all on function public.covid_marca_por_lote() from public, anon;
grant execute on function public.covid_marca_por_lote() to authenticated;
