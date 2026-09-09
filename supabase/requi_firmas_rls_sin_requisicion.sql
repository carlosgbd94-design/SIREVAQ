-- requi_firmas ya no tiene requisicion_id ni nivel UNIDAD (ver
-- requi_firmas_cache_por_nivel_y_quita_neumo23.sql) -- se reescribe la
-- política de lectura sin esas dos cosas: JURISDICCIONAL sigue abierto a
-- todo perfil activo; MUNICIPAL solo ve el/los destino(s) de su municipio
-- (o Hospitales).

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
