-- Arrastra a octubre-2026 la existencia final de septiembre de las unidades que capturaron (datos de prueba).
-- Idempotente; solo toca la existencia anterior de octubre; no toca septiembre. Ya ejecutada una vez en prod (8 unidades).
create or replace function public.biovac_arrastrar_sep_a_oct_unidades()
returns table(clues text, unidad text, lotes int, frascos numeric)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare r record; v_oct uuid;
begin
  if current_user not in ('postgres','service_role','supabase_admin') and coalesce(_sis_rol_actual(),'') <> 'ADMIN' then
    raise exception 'Solo ADMIN';
  end if;
  perform set_config('biovac.bypass_lock','on',true);
  perform set_config('biovac.bypass_validaciones','on',true);
  for r in
    select m.id mov_id, u.id uid, u.clues, u.nombre
    from biovac_movimientos m join biovac_unidades u on u.id=m.unidad_id
    where m.anio=2026 and m.mes=9 and u.clues not like 'JS1-%' and u.municipio not in ('NHG','HENM') and u.activo
      and exists (select 1 from biovac_renglones x where x.movimiento_id=m.id and x.existencia_final_frascos<>0)
  loop
    perform biovac_recalcular_movimiento(r.mov_id);
    insert into biovac_movimientos(unidad_id,anio,mes) values (r.uid,2026,10) on conflict (unidad_id,anio,mes) do nothing;
    select id into v_oct from biovac_movimientos where unidad_id=r.uid and anio=2026 and mes=10;
    insert into biovac_renglones(movimiento_id,lote_id,categoria,existencia_anterior_frascos)
    select v_oct, x.lote_id, x.categoria, x.existencia_final_frascos
    from biovac_renglones x where x.movimiento_id=r.mov_id and x.existencia_final_frascos<>0
    on conflict (movimiento_id,lote_id,categoria) do update set existencia_anterior_frascos = excluded.existencia_anterior_frascos + biovac_renglones.ajuste_anterior_frascos;
    perform biovac_recalcular_movimiento(v_oct);
    clues := r.clues; unidad := r.nombre;
    select count(*)::int, coalesce(sum(existencia_anterior_frascos),0) into lotes, frascos from biovac_renglones where movimiento_id=v_oct;
    return next;
  end loop;
  perform set_config('biovac.bypass_lock','off',true);
  perform set_config('biovac.bypass_validaciones','off',true);
end $$;
revoke all on function public.biovac_arrastrar_sep_a_oct_unidades() from public, anon, authenticated;
