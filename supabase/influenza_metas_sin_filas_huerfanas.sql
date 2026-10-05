-- =============================================================================
-- Influenza: no se permiten metas de una CLUES que no esté activa en `unidades`.
--
-- Una fila de influenza_metas con una CLUES vieja (ej. el CLUES anterior de Tlacote,
-- copiado por una precarga) no aparece en la cuadrícula de metas, así que ni la
-- validación ni el municipal la ven, pero sí suma en los totales (+960 en Querétaro).
-- Este trigger impide que vuelva a pasar: al insertar o actualizar una meta con CLUES,
-- esa CLUES debe existir en `unidades` y estar activa. (clues nulo = meta del municipio.)
-- Idempotente.
-- =============================================================================

create or replace function public.influenza_metas_clues_valida()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.clues is not null
     and not exists (select 1 from unidades u where u.clues = new.clues and u.activo = 'SI') then
    raise exception 'La CLUES % no existe o no está activa en el catálogo de unidades; no se puede guardar su meta de influenza.', new.clues
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_influenza_metas_clues_valida on public.influenza_metas;
create trigger trg_influenza_metas_clues_valida
  before insert or update of clues on public.influenza_metas
  for each row execute function public.influenza_metas_clues_valida();
