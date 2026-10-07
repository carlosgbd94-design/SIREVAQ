-- SIS: de quién es cada concentrado y quién lo valida.
--
-- Los hospitales (HENM, NHG) están dados de alta en biovac_unidades bajo su propio
-- "municipio" (HENM / NHG) y los valida la JURISDICCIÓN, pero el perfil de la unidad
-- hospitalaria trae municipio = QUERETARO, y el cliente copiaba ese valor a
-- sis06p_capturas.municipio. Consecuencias:
--   * el concentrado de un hospital quedaba a nombre de QUERETARO: un MUNICIPAL de
--     Querétaro tenía permiso de servidor (RLS + sis06p_marcar_validado) para validarlo,
--     aunque su pantalla no lo lista;
--   * el concentrado municipal de NHG/HENM (que filtra por sis06p_capturas.municipio)
--     salía vacío.
--
-- Arreglo: el municipio de una captura SIEMPRE sale de biovac_unidades (por CLUES), no de
-- lo que mande el cliente. Así el alcance del MUNICIPAL (que se revisa contra
-- sis06p_capturas.municipio) deja fuera a los hospitales y quedan solo para la JURISDICCIONAL.

create or replace function sis06p_trg_03_municipio_de_la_unidad() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_mun text;
begin
  select bu.municipio into v_mun from biovac_unidades bu
  where bu.clues = new.clues and bu.clues not like 'JS1-%' limit 1;
  if v_mun is not null then new.municipio := v_mun; end if;
  return new;
end;
$$;
revoke all on function sis06p_trg_03_municipio_de_la_unidad() from public, anon, authenticated;

drop trigger if exists trg_sis06p_03_municipio on sis06p_capturas;
create trigger trg_sis06p_03_municipio
before insert or update of clues, municipio on sis06p_capturas
for each row execute function sis06p_trg_03_municipio_de_la_unidad();

-- Corrige lo ya capturado (el trigger de bloqueo se salta con la bandera, igual que las demás funciones del módulo).
select set_config('sis06p.bypass_lock', 'on', true);
update sis06p_capturas c set municipio = bu.municipio
from biovac_unidades bu
where bu.clues = c.clues and bu.clues not like 'JS1-%' and c.municipio is distinct from bu.municipio;
update sis06p_correcciones sc set municipio = bu.municipio
from biovac_unidades bu
where bu.clues = sc.clues and bu.clues not like 'JS1-%' and sc.municipio is distinct from bu.municipio;
select set_config('sis06p.bypass_lock', 'off', true);
