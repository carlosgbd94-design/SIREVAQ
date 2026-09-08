-- ============================================================================
-- Fix: requisiciones_print_ui.js guardaba el nombre bonito para pantalla
-- ("C.S. Santa Barbara") en requi_pdf_generados.destino en vez del id crudo
-- de requi_unidades (o el código de municipio), rompiendo el join de la
-- política de RLS de requi_firmas_y_pdf_scope_municipal.sql. Se corrigió el
-- cliente para guardar el destino tal cual llega en el query param (mismo
-- criterio que requi_firmas); aquí se ajusta la política para comparar
-- contra u.id en vez de u.nombre.
-- ============================================================================

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
