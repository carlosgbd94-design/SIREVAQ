-- Hospitales (NHG, HENM) con cuenta propia: el concentrado jurisdiccional suma SU Movimiento.
--
-- Hasta agosto de 2026 la jurisdicción capturaba el Movimiento de cada hospital a mano (filas JS1-NHG / JS1-HENM).
-- Desde septiembre de 2026 cada hospital tiene su propia cuenta y captura su Movimiento como cualquier unidad
-- (QTSSA002901 / QTSSA001740), así que desde ese mes el concentrado cuenta la fila real del hospital y deja fuera la
-- JS1- (que queda guardada, sin borrarse). Los municipios siguen igual: por municipio (JS1-) hasta el arranque por
-- unidad ('inicio_captura_por_unidad') y por unidad desde entonces.
-- El mes de arranque de los hospitales vive en sis_config para poder moverlo sin tocar código.

insert into sis_config (clave, valor) values ('inicio_captura_hospitales', '2026-09-01')
on conflict (clave) do nothing;

create or replace function biovac_cuenta_para_jurisdiccion(p_clues text, p_municipio text, p_anio int, p_mes int)
returns boolean
language sql
stable
set search_path = public
as $$
  select case
    -- Hospitales con cuenta propia: solo su fila real
    when p_municipio in ('NHG', 'HENM')
         and make_date(p_anio, p_mes, 1) >= coalesce((select valor::date from sis_config where clave = 'inicio_captura_hospitales'), date '2026-09-01')
      then p_clues not like 'JS1-%'
    when make_date(p_anio, p_mes, 1) < (select valor::date from sis_config where clave = 'inicio_captura_por_unidad')
      then p_clues like 'JS1-%'
    else p_clues not like 'JS1-%'
         or not exists (
           select 1 from biovac_unidades r
           where r.municipio = p_municipio and r.clues not like 'JS1-%' and r.activo
         )
  end;
$$;

grant execute on function biovac_cuenta_para_jurisdiccion(text, text, int, int) to authenticated;
