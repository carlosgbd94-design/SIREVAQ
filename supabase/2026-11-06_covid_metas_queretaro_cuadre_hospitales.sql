-- COVID-19: las unidades de Querétaro sumaban 2,000 dosis más que la meta del municipio en c1 y c2
-- (exactamente lo que se asignó a HENM y NHGQ: 1,000 + 1,000). El sobrante estaba en la unidad que absorbe
-- el resto de los frascos (QTSSA001863). La meta del municipio (distribuida en «Distribución de Metas») manda.
-- Solo actúa si la unidad conserva los valores del descuadre (idempotente).
update covid_metas
set metas = jsonb_set(jsonb_set(metas, '{c1}', '27214'), '{c2}', '27214'),
    updated_at = now(),
    modificado_por = 'CORRECCION_CUADRE_HOSPITALES'
where clues = 'QTSSA001863'
  and (metas->>'c1')::numeric = 29214
  and (metas->>'c2')::numeric = 29214;
