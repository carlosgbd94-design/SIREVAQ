-- ============================================================================
-- BioVac — RLS de producción (Fase 6: integración)
--
-- Reemplaza las políticas temporales de biovac_rls_temporal.sql por reglas
-- basadas en los roles reales de `perfiles` (mismo patrón que ya usa este
-- repo en fix_registros_sis_rls_multimunicipio.sql / pinol_solicitudes):
--   MUNICIPAL   -> solo su(s) municipio(s) asignado(s) (municipio_asignado,
--                  municipios_allowed, o listas separadas por coma)
--   JURISDICCIONAL / ADMIN -> lectura y escritura de toda la jurisdicción
--   VISUALIZADOR_JURISDICCIONAL -> solo lectura de toda la jurisdicción
--
-- A partir de aquí biovac_* deja de ser accesible por `anon`: solo
-- `authenticated` (perfiles reales vía auth.uid()).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'biovac_jurisdicciones', 'biovac_unidades', 'biovac_bloques_catalogo',
    'biovac_catalogo_biologicos', 'biovac_lotes', 'biovac_movimientos',
    'biovac_renglones', 'biovac_correcciones', 'biovac_informes_jurisdiccionales'
  ]
  loop
    execute format('drop policy if exists biovac_temporal_all on %I', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo / referencia: lectura para cualquier perfil activo, escritura
-- solo ADMIN.
-- ---------------------------------------------------------------------------

drop policy if exists biovac_catalogo_select on biovac_jurisdicciones;
create policy biovac_catalogo_select on biovac_jurisdicciones for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists biovac_catalogo_write on biovac_jurisdicciones;
create policy biovac_catalogo_write on biovac_jurisdicciones for all to authenticated
  using (is_admin()) with check (is_admin());

-- biovac_unidades es DIFERENTE del resto del catálogo: identifica el propio
-- municipio de captura, no es referencia universal -- un MUNICIPAL solo debe
-- ver (y por tanto poder seleccionar) su(s) propio(s) municipio(s), igual
-- que ya se filtra movimientos/renglones. JURISDICCIONAL/ADMIN ven todas.
drop policy if exists biovac_catalogo_select on biovac_unidades;
create policy biovac_unidades_select on biovac_unidades for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            biovac_unidades.municipio = p.municipio_asignado
            or biovac_unidades.municipio = any (p.municipios_allowed)
            or biovac_unidades.municipio = any (string_to_array(p.municipio_asignado, ','))
            or biovac_unidades.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
        )
    )
  );
drop policy if exists biovac_catalogo_write on biovac_unidades;
create policy biovac_catalogo_write on biovac_unidades for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists biovac_catalogo_select on biovac_bloques_catalogo;
create policy biovac_catalogo_select on biovac_bloques_catalogo for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists biovac_catalogo_write on biovac_bloques_catalogo;
create policy biovac_catalogo_write on biovac_bloques_catalogo for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists biovac_catalogo_select on biovac_catalogo_biologicos;
create policy biovac_catalogo_select on biovac_catalogo_biologicos for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists biovac_catalogo_write on biovac_catalogo_biologicos;
create policy biovac_catalogo_write on biovac_catalogo_biologicos for all to authenticated
  using (is_admin()) with check (is_admin());

-- Lotes: catálogo compartido entre unidades (no tiene dimensión de unidad),
-- así que cualquier capturista activo (MUNICIPAL/JURISDICCIONAL/ADMIN)
-- puede darlos de alta al agregar un lote nuevo.
drop policy if exists biovac_lotes_select on biovac_lotes;
create policy biovac_lotes_select on biovac_lotes for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists biovac_lotes_write on biovac_lotes;
create policy biovac_lotes_write on biovac_lotes for insert to authenticated
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'
    and upper(p.rol) in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN')));
drop policy if exists biovac_lotes_update on biovac_lotes;
create policy biovac_lotes_update on biovac_lotes for update to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'
    and upper(p.rol) in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN')));

-- ---------------------------------------------------------------------------
-- Movimientos: MUNICIPAL solo su(s) municipio(s); JURISDICCIONAL/ADMIN toda
-- la jurisdicción; VISUALIZADOR_JURISDICCIONAL solo lectura.
-- ---------------------------------------------------------------------------

drop policy if exists biovac_movimientos_select on biovac_movimientos;
create policy biovac_movimientos_select on biovac_movimientos for select to authenticated
  using (
    exists (
      select 1 from biovac_unidades bu, perfiles p
      where bu.id = biovac_movimientos.unidad_id and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
        )
    )
  );

drop policy if exists biovac_movimientos_write on biovac_movimientos;
create policy biovac_movimientos_write on biovac_movimientos for all to authenticated
  using (
    exists (
      select 1 from biovac_unidades bu, perfiles p
      where bu.id = biovac_movimientos.unidad_id and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'ADMIN')
        )
    )
  )
  with check (
    exists (
      select 1 from biovac_unidades bu, perfiles p
      where bu.id = biovac_movimientos.unidad_id and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'ADMIN')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Renglones: mismo criterio que movimientos, vía el movimiento padre.
-- JURISDICCIONAL puede escribir directo (lo usa el drill-down de
-- corrección jurisdiccional) -- el trigger de bloqueo sigue exigiendo que
-- el mes esté en EN_CORRECCION para permitir cualquier escritura.
-- ---------------------------------------------------------------------------

drop policy if exists biovac_renglones_select on biovac_renglones;
create policy biovac_renglones_select on biovac_renglones for select to authenticated
  using (
    exists (
      select 1 from biovac_movimientos m, biovac_unidades bu, perfiles p
      where m.id = biovac_renglones.movimiento_id and bu.id = m.unidad_id
        and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
        )
    )
  );

drop policy if exists biovac_renglones_write on biovac_renglones;
create policy biovac_renglones_write on biovac_renglones for all to authenticated
  using (
    exists (
      select 1 from biovac_movimientos m, biovac_unidades bu, perfiles p
      where m.id = biovac_renglones.movimiento_id and bu.id = m.unidad_id
        and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'ADMIN')
        )
    )
  )
  with check (
    exists (
      select 1 from biovac_movimientos m, biovac_unidades bu, perfiles p
      where m.id = biovac_renglones.movimiento_id and bu.id = m.unidad_id
        and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'ADMIN')
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Correcciones (auditoría): mismo alcance de lectura que renglones;
-- escritura normalmente solo vía las funciones SECURITY DEFINER del motor
-- (que ignoran RLS), pero se deja una política explícita por si se inserta
-- directo.
-- ---------------------------------------------------------------------------

drop policy if exists biovac_correcciones_select on biovac_correcciones;
create policy biovac_correcciones_select on biovac_correcciones for select to authenticated
  using (
    exists (
      select 1 from biovac_movimientos m, biovac_unidades bu, perfiles p
      where m.id = biovac_correcciones.movimiento_id and bu.id = m.unidad_id
        and p.id = auth.uid() and p.activo = 'SI'
        and (
          (upper(p.rol) = 'MUNICIPAL' and (
            bu.municipio = p.municipio_asignado
            or bu.municipio = any (p.municipios_allowed)
            or bu.municipio = any (string_to_array(p.municipio_asignado, ','))
            or bu.municipio = any (string_to_array(p.municipio, ','))
          ))
          or upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
        )
    )
  );

drop policy if exists biovac_correcciones_insert on biovac_correcciones;
create policy biovac_correcciones_insert on biovac_correcciones for insert to authenticated
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'
    and upper(p.rol) in ('MUNICIPAL', 'JURISDICCIONAL', 'ADMIN')));

-- ---------------------------------------------------------------------------
-- Informes jurisdiccionales: lectura para cualquier perfil activo
-- (informativo), generación solo JURISDICCIONAL/ADMIN.
-- ---------------------------------------------------------------------------

drop policy if exists biovac_informes_select on biovac_informes_jurisdiccionales;
create policy biovac_informes_select on biovac_informes_jurisdiccionales for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));

drop policy if exists biovac_informes_insert on biovac_informes_jurisdiccionales;
create policy biovac_informes_insert on biovac_informes_jurisdiccionales for insert to authenticated
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'
    and upper(p.rol) in ('JURISDICCIONAL', 'ADMIN')));

-- ---------------------------------------------------------------------------
-- Cabecera del movimiento jurisdiccional: lectura para cualquier perfil
-- activo, escritura solo JURISDICCIONAL/ADMIN (mismo criterio que ya usa
-- biovac_movimientos_write para esos roles).
-- ---------------------------------------------------------------------------

alter table biovac_movimientos_jurisdiccionales enable row level security;

drop policy if exists biovac_mov_jurisdiccion_select on biovac_movimientos_jurisdiccionales;
create policy biovac_mov_jurisdiccion_select on biovac_movimientos_jurisdiccionales for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));

drop policy if exists biovac_mov_jurisdiccion_write on biovac_movimientos_jurisdiccionales;
create policy biovac_mov_jurisdiccion_write on biovac_movimientos_jurisdiccionales for all to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI' and upper(p.rol) in ('JURISDICCIONAL','ADMIN')))
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI' and upper(p.rol) in ('JURISDICCIONAL','ADMIN')));
