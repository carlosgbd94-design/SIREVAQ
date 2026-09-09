-- ============================================================================
-- Correcciones reportadas por el usuario tras probar el flujo real:
--
-- 1) Las firmas/responsables casi nunca cambian mes a mes -- deben guardarse
--    como una configuración fija (caché) por nivel/destino, NO por cada
--    requisición mensual (obligaba a volver a teclearlas cada mes). Se quita
--    la columna requisicion_id: ahora es un catálogo de responsables, no
--    datos transaccionales.
-- 2) Las unidades NO llevan nombre precapturado: la unidad firma a mano y
--    anota su propio nombre en el papel. Se quita 'UNIDAD' como nivel válido.
--    Se rescata el único dato real que el usuario ya había capturado ahí
--    (elaboro_nombre='LESLIE LOPEZ') hacia el nuevo renglón jurisdiccional,
--    en vez de perderlo.
-- 3) VACUNA ANTINEUMOCOCCICA 23 1DS ya no existe en el esquema de vacunación
--    vigente -- se desactiva (no se borra por si ya hay históricos).
-- ============================================================================

delete from requi_firmas where nivel = 'UNIDAD';

alter table requi_firmas drop constraint requi_firmas_requisicion_id_fkey;
alter table requi_firmas drop constraint requi_firmas_requisicion_id_nivel_destino_key;
alter table requi_firmas drop column requisicion_id;

alter table requi_firmas drop constraint requi_firmas_nivel_check;
alter table requi_firmas add constraint requi_firmas_nivel_check check (nivel in ('JURISDICCIONAL','MUNICIPAL'));

alter table requi_firmas add constraint requi_firmas_nivel_destino_key unique (nivel, destino);

insert into requi_firmas (nivel, destino, elaboro_nombre)
values ('JURISDICCIONAL', 'JURISDICCION', 'LESLIE LOPEZ')
on conflict (nivel, destino) do nothing;

update requi_catalogo_biologicos set activo = false where codigo_articulo = '146';
