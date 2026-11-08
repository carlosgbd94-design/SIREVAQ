-- 2026-11-08: biologicos_pedido tenía UNA política "Permitir gestionar" ALL con USING true para cualquier sesión:
-- una unidad podía editar o borrar los pedidos de otras unidades. Ahora la lectura sigue abierta a toda sesión (los tableros
-- de cumplimiento la necesitan) y escribir exige: ser la unidad dueña (clues propia) o tener rol ADMIN/MUNICIPAL/JURISDICCIONAL/CARAVANAS.
-- VISUALIZADOR_JURISDICCIONAL queda solo lectura.
drop policy if exists "Permitir gestionar biologicos_pedido" on public.biologicos_pedido;
create policy pedido_select_sesion on public.biologicos_pedido for select to authenticated using (true);
create policy pedido_insert_alcance on public.biologicos_pedido for insert to authenticated with check (
  clues = (select public.mi_clues_unidad())
  or (select upper(p.rol) from public.perfiles p where p.id = (select auth.uid())) in ('ADMIN','MUNICIPAL','JURISDICCIONAL','CARAVANAS'));
create policy pedido_update_alcance on public.biologicos_pedido for update to authenticated
  using (clues = (select public.mi_clues_unidad())
    or (select upper(p.rol) from public.perfiles p where p.id = (select auth.uid())) in ('ADMIN','MUNICIPAL','JURISDICCIONAL','CARAVANAS'))
  with check (clues = (select public.mi_clues_unidad())
    or (select upper(p.rol) from public.perfiles p where p.id = (select auth.uid())) in ('ADMIN','MUNICIPAL','JURISDICCIONAL','CARAVANAS'));
create policy pedido_delete_alcance on public.biologicos_pedido for delete to authenticated using (
  clues = (select public.mi_clues_unidad())
  or (select upper(p.rol) from public.perfiles p where p.id = (select auth.uid())) in ('ADMIN','MUNICIPAL','JURISDICCIONAL','CARAVANAS'));
