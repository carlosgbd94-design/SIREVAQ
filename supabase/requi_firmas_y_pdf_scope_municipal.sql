-- ============================================================================
-- Fix: requi_firmas y requi_pdf_generados quedaron con lectura abierta a
-- "cualquier perfil activo" -- verificado con un usuario MUNICIPAL real
-- (Querétaro) que sí podía leer las firmas de Corregidora. Deben seguir el
-- mismo alcance que requi_distribucion_municipio/unidad: MUNICIPAL solo ve
-- lo de su(s) municipio(s) (y Hospitales, de consulta general); nivel
-- JURISDICCIONAL sigue visible para todos (sin dimensión de municipio,
-- igual que requi_items_jurisdiccion).
-- ============================================================================

drop policy if exists requi_firmas_select on requi_firmas;
create policy requi_firmas_select on requi_firmas for select to authenticated
  using (
    exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.activo = 'SI'
        and (
          upper(p.rol) in ('JURISDICCIONAL', 'VISUALIZADOR_JURISDICCIONAL', 'ADMIN')
          or requi_firmas.nivel = 'JURISDICCIONAL'
          or (upper(p.rol) = 'MUNICIPAL' and (
            (requi_firmas.nivel = 'MUNICIPAL' and (
              requi_firmas.destino = 'HOSPITALES'
              or requi_firmas.destino = p.municipio_asignado
              or requi_firmas.destino = any (p.municipios_allowed)
              or requi_firmas.destino = any (string_to_array(p.municipio_asignado, ','))
              or requi_firmas.destino = any (string_to_array(p.municipio, ','))
            ))
            or (requi_firmas.nivel = 'UNIDAD' and exists (
              select 1 from requi_unidades u
              where u.id::text = requi_firmas.destino
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

-- Nota: la primera versión de esta migración también corrigió
-- requi_pdf_select comparando contra u.nombre -- se detectó que
-- requisiciones_print_ui.js guardaba el nombre bonito ("C.S. Santa
-- Barbara") en vez del id crudo de la unidad. Ver
-- requi_pdf_generados_scope_fix_destino_id.sql para la versión final
-- (compara contra u.id, y el cliente ya guarda el destino crudo).
