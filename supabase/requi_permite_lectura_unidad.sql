-- ============================================================================
-- Requisiciones -- permite a la propia UNIDAD (CLUES) leer su fila en
-- requi_unidades y su reparto en requi_distribucion_unidad.
--
-- requi_rls.sql (política original) solo daba SELECT a MUNICIPAL (acotado a
-- su municipio) / JURISDICCIONAL / VISUALIZADOR_JURISDICCIONAL / ADMIN -- el
-- rol UNIDAD nunca quedó incluido, porque hasta ahora Requisiciones solo se
-- consultaba desde esos roles. Con el puente de precarga a nivel unidad en
-- biovac_ui.js (ofrecerCargaDesdeRequisicionesUnidad, análogo al que ya
-- existía a nivel municipio con ofrecerCargaDesdeRequisiciones), la propia
-- unidad de salud necesita poder leer su reparto para que se le pueda
-- ofrecer cargarlo como "recibido" en su Movimiento de Biológico.
--
-- Solo se agrega la rama UNIDAD (comparando por CLUES) a las políticas ya
-- existentes -- no se toca nada de lo que ya podían ver MUNICIPAL/
-- JURISDICCIONAL/ADMIN/VISUALIZADOR_JURISDICCIONAL.
-- ============================================================================

-- NOTA: la política vigente en producción ya trae una rama extra
-- (`requi_unidades.municipio = 'HOSPITALES'`) que no estaba en la copia local
-- de requi_rls.sql -- se preserva aquí tal cual está desplegada, solo se le
-- agrega la rama UNIDAD.
drop policy if exists requi_unidades_select on requi_unidades;
create policy requi_unidades_select on requi_unidades for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or (upper(p.rol) = 'MUNICIPAL' and (
            requi_unidades.municipio = 'HOSPITALES'
            or requi_unidades.municipio = p.municipio_asignado
            or requi_unidades.municipio = any (p.municipios_allowed)
            or requi_unidades.municipio = any (string_to_array(p.municipio_asignado, ','))
            or requi_unidades.municipio = any (string_to_array(p.municipio, ','))
          ))
          or (upper(p.rol) = 'UNIDAD' and requi_unidades.clues = p.clues)
        )
    )
  );

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
          or (upper(p.rol) = 'UNIDAD' and u.clues = p.clues)
        )
    )
  );
