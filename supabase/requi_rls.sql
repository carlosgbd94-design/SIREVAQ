-- ============================================================================
-- Requisiciones — RLS de producción, mismo patrón que biovac_rls_produccion.sql
-- (fix_registros_sis_rls_multimunicipio.sql / pinol_solicitudes).
--
-- A diferencia de Biovac: aquí MUNICIPAL NUNCA escribe (solo consulta y
-- exporta PDF de lo suyo). Solo JURISDICCIONAL/ADMIN capturan y reparten,
-- tal como lo pidió el usuario. VISUALIZADOR_JURISDICCIONAL ve todo, de
-- solo lectura.
-- ============================================================================

alter table requi_catalogo_biologicos enable row level security;
alter table requi_lotes enable row level security;
alter table requi_unidades enable row level security;
alter table requi_requisiciones enable row level security;
alter table requi_items_jurisdiccion enable row level security;
alter table requi_distribucion_municipio enable row level security;
alter table requi_distribucion_unidad enable row level security;
alter table requi_pdf_generados enable row level security;
alter table requi_firmas enable row level security;

-- ---------------------------------------------------------------------------
-- Catálogo / referencia: lectura para cualquier perfil activo, escritura
-- solo ADMIN/JURISDICCIONAL.
-- ---------------------------------------------------------------------------

drop policy if exists requi_catalogo_select on requi_catalogo_biologicos;
create policy requi_catalogo_select on requi_catalogo_biologicos for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists requi_catalogo_write on requi_catalogo_biologicos;
create policy requi_catalogo_write on requi_catalogo_biologicos for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

drop policy if exists requi_lotes_select on requi_lotes;
create policy requi_lotes_select on requi_lotes for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists requi_lotes_write on requi_lotes;
create policy requi_lotes_write on requi_lotes for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

-- requi_unidades: igual que biovac_unidades -- MUNICIPAL solo ve las suyas.
-- Los hospitales ya no viven aquí (son destinos de primer nivel propios, ver
-- requi_distribucion_municipio). JURISDICCIONAL/ADMIN/VISUALIZADOR ven todo.
drop policy if exists requi_unidades_select on requi_unidades;
create policy requi_unidades_select on requi_unidades for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or (upper(p.rol) = 'MUNICIPAL' and (
            requi_unidades.municipio = p.municipio_asignado
            or requi_unidades.municipio = any (p.municipios_allowed)
            or requi_unidades.municipio = any (string_to_array(p.municipio_asignado, ','))
            or requi_unidades.municipio = any (string_to_array(p.municipio, ','))
          ))
        )
    )
  );
drop policy if exists requi_unidades_write on requi_unidades;
create policy requi_unidades_write on requi_unidades for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

-- ---------------------------------------------------------------------------
-- Requisición jurisdiccional y lo surtido: lectura general, escritura solo
-- ADMIN/JURISDICCIONAL.
-- ---------------------------------------------------------------------------

drop policy if exists requi_requisiciones_select on requi_requisiciones;
create policy requi_requisiciones_select on requi_requisiciones for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists requi_requisiciones_write on requi_requisiciones;
create policy requi_requisiciones_write on requi_requisiciones for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

drop policy if exists requi_items_juris_select on requi_items_jurisdiccion;
create policy requi_items_juris_select on requi_items_jurisdiccion for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));
drop policy if exists requi_items_juris_write on requi_items_jurisdiccion;
create policy requi_items_juris_write on requi_items_jurisdiccion for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

-- ---------------------------------------------------------------------------
-- Reparto a municipios/Hospitales: MUNICIPAL solo lee el/los suyo(s);
-- JURISDICCIONAL/ADMIN leen y escriben todo. MUNICIPAL nunca escribe.
-- ---------------------------------------------------------------------------

drop policy if exists requi_dist_muni_select on requi_distribucion_municipio;
create policy requi_dist_muni_select on requi_distribucion_municipio for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or (upper(p.rol) = 'MUNICIPAL' and (
            requi_distribucion_municipio.municipio = p.municipio_asignado
            or requi_distribucion_municipio.municipio = any (p.municipios_allowed)
            or requi_distribucion_municipio.municipio = any (string_to_array(p.municipio_asignado, ','))
            or requi_distribucion_municipio.municipio = any (string_to_array(p.municipio, ','))
          ))
        )
    )
  );
drop policy if exists requi_dist_muni_write on requi_distribucion_municipio;
create policy requi_dist_muni_write on requi_distribucion_municipio for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

-- ---------------------------------------------------------------------------
-- Reparto a unidades: mismo criterio, vía el municipio real de la unidad.
-- ---------------------------------------------------------------------------

drop policy if exists requi_dist_unidad_select on requi_distribucion_unidad;
create policy requi_dist_unidad_select on requi_distribucion_unidad for select to authenticated
  using (
    exists (
      select 1 from requi_unidades u, perfiles p
      where u.id = requi_distribucion_unidad.unidad_id
        and p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or (upper(p.rol) = 'MUNICIPAL' and (
            u.municipio = p.municipio_asignado
            or u.municipio = any (p.municipios_allowed)
            or u.municipio = any (string_to_array(p.municipio_asignado, ','))
            or u.municipio = any (string_to_array(p.municipio, ','))
          ))
        )
    )
  );
drop policy if exists requi_dist_unidad_write on requi_distribucion_unidad;
create policy requi_dist_unidad_write on requi_distribucion_unidad for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());

-- ---------------------------------------------------------------------------
-- Bitácora de impresión y firmas: MISMO alcance por municipio que el reparto
-- (verificado con usuarios reales -- ver requi_pdf_generados_scope_fix_
-- destino_id.sql / requi_firmas_y_pdf_scope_municipal.sql: la primera
-- versión dejaba leer a cualquier perfil activo sin filtrar por municipio,
-- y un MUNICIPAL de otro municipio sí podía ver firmas ajenas). El nivel
-- JURISDICCIONAL no tiene dimensión de municipio, así que se deja abierto a
-- cualquier perfil activo (igual que requi_items_jurisdiccion). El "destino"
-- guardado es siempre el crudo (código de municipio o id de unidad), nunca
-- el nombre bonito para pantalla.
-- ---------------------------------------------------------------------------

drop policy if exists requi_pdf_select on requi_pdf_generados;
create policy requi_pdf_select on requi_pdf_generados for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or requi_pdf_generados.nivel = 'JURISDICCIONAL'
          or (upper(p.rol) = 'MUNICIPAL' and (
            (requi_pdf_generados.nivel = 'MUNICIPAL' and (
              requi_pdf_generados.destino = 'HOSPITALES'
              or requi_pdf_generados.destino = p.municipio_asignado
              or requi_pdf_generados.destino = any (p.municipios_allowed)
              or requi_pdf_generados.destino = any (string_to_array(p.municipio_asignado, ','))
              or requi_pdf_generados.destino = any (string_to_array(p.municipio, ','))
            ))
            or (requi_pdf_generados.nivel = 'UNIDAD' and exists (
              select 1 from requi_unidades u
              where u.id::text = requi_pdf_generados.destino
                and (
                  u.municipio = 'HOSPITALES'
                  or u.municipio = p.municipio_asignado
                  or u.municipio = any (p.municipios_allowed)
                  or u.municipio = any (string_to_array(p.municipio_asignado, ','))
                  or u.municipio = any (string_to_array(p.municipio, ','))
                )
            ))
          ))
        )
    )
  );
drop policy if exists requi_pdf_insert on requi_pdf_generados;
create policy requi_pdf_insert on requi_pdf_generados for insert to authenticated
  with check (exists (select 1 from perfiles p where p.id = auth.uid() and p.activo = 'SI'));

drop policy if exists requi_firmas_select on requi_firmas;
create policy requi_firmas_select on requi_firmas for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or requi_firmas.nivel = 'JURISDICCIONAL'
          or (upper(p.rol) = 'MUNICIPAL' and requi_firmas.nivel = 'MUNICIPAL' and (
            requi_firmas.destino = 'HOSPITALES'
            or requi_firmas.destino = p.municipio_asignado
            or requi_firmas.destino = any (p.municipios_allowed)
            or requi_firmas.destino = any (string_to_array(p.municipio_asignado, ','))
            or requi_firmas.destino = any (string_to_array(p.municipio, ','))
          ))
        )
    )
  );
drop policy if exists requi_firmas_write on requi_firmas;
create policy requi_firmas_write on requi_firmas for all to authenticated
  using (is_admin() or is_jurisdiccional()) with check (is_admin() or is_jurisdiccional());
