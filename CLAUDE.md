# Notas del proyecto (SIREVAQ)

## Revisar el Playwright de GitHub después de cada push

El flujo `.github/workflows/playwright.yml` corre **toda** la suite (`npx playwright test`, ~13 min, runner `ubuntu-24.04`)
en cada push a `main` y en cada pull request. Es la red de seguridad contra errores como los que ya pasaron
(un cambio que rompe un flujo que otro módulo daba por hecho, pruebas que dependían del mes en curso, etc.).

Al terminar un cambio:

1. Corre la suite completa en local antes de subir: `npx playwright test` (si algo falla, repítelo solo: la máquina cargada
   da fallos intermitentes; si persiste, es real).
2. Después del `git push`, **revisa el resultado en GitHub** y no des el trabajo por terminado hasta que salga en verde:
   - `gh run list --limit 3` para ver el último "Playwright Tests".
   - `gh run watch <id>` para esperarlo y `gh run view <id> --log-failed` para ver qué falló.
3. Si el CI falla, corrige y vuelve a subir; no lo dejes en rojo ni lo ignores.
4. Si cambias una regla de negocio (p. ej. qué exige "Enviar" el SINBA-SIS), actualiza o agrega la prueba que la cubre en
   el mismo commit: una prueba vieja que "se rompe" por una regla nueva debe ajustarse, no borrarse.

Para que el CI sirva de verdad:

- Las pruebas no deben depender de la fecha real: fija el reloj del navegador (`page.clock.setFixedTime(...)`) cuando
  el comportamiento dependa del mes o la semana (ya fallaron así en noviembre).
- Los archivos que `biovac.html` carga con `?v=` (por ejemplo `sis06p_biovac_module.js`, `municipal_guiado.js`) no están en
  `dist/`: sube su `?v=` cuando los cambies para que los navegadores no usen la copia vieja.
- Después de tocar fuentes que entran al bundle, corre `node build-bundle.js` y sube también `dist/`.
- Las migraciones de `supabase/` no corren en el CI: las pruebas usan un Supabase simulado. Lo que se cambie en la base
  hay que verificarlo aparte (con SQL o en el navegador) y dejar el `.sql` en `supabase/`.
