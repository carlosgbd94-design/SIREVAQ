// Móvil de supervisión: Parámetros, Jeringas, Pinol, Enviar aviso y Seguridad (con PostgREST simulado con estado).
const { test, expect } = require('@playwright/test');

const { abrir, irAMas } = require('./_mobile_supervision_apoyo');

test.describe('Móvil · operaciones de supervisión', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Parámetros: elige unidad en su alcance, valida y guarda con la misma clave de escritorio', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PAR');
    await expect(page.locator('#supOps_PAR [data-clues]')).toHaveCount(2); // solo Corregidora
    await page.click('[data-clues="QTSSA000830"]');
    await expect(page.locator('#supOps_PAR .sv-mx-item')).toHaveCount(15); // 14 oficiales + VSR registrado en la base
    await expect(page.locator('#supOps_PAR .sv-nota--sup')).toContainText('otro');
    const bcg = page.locator('#supOps_PAR .sv-mx-item[data-key="BCG"]');
    await expect(bcg.locator('[data-campo="max"]')).toHaveValue('10');
    // mínimo mayor que máximo: no guarda
    await bcg.locator('[data-campo="min"]').fill('20');
    await page.click('#svMxGuardar');
    await expect(page.locator('#svMxErr')).toContainText('mínimo');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'biologicos_params')).toHaveLength(0);
    // valores válidos
    await bcg.locator('[data-campo="min"]').fill('2');
    await bcg.locator('[data-campo="prom"]').fill('5');
    await page.click('#svMxGuardar');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'biologicos_params').length).toBe(1);
    const post = reqs.find((r) => r.m === 'POST' && r.nombre === 'biologicos_params');
    expect(post.q).toContain('on_conflict=clues%2Cbiologico');
    expect(post.body).toHaveLength(15);
    const fila = post.body.find((r) => r.biologico === 'BCG');
    expect(fila).toMatchObject({ clues: 'QTSSA000830', promedio_frascos: 5, min_dosis: 2, max_dosis: 10, multiplo_pedido: 10, updated_by: 'sup', activo: 'SI' });
    expect(estado.db.biologicos_params.find((r) => r.biologico === 'BCG').promedio_frascos).toBe(5);
    expect(errores).toEqual([]);
  });

  test('Jeringas: cinco tipos, guarda en jeringas_params', async ({ page }) => {
    const { reqs } = await abrir(page, { rol: 'JURISDICCIONAL' });
    await irAMas(page, 'JER');
    await page.click('[data-clues="QTSSA000222"]');
    await expect(page.locator('#supOps_JER .sv-mx-item')).toHaveCount(5);
    await page.locator('#supOps_JER .sv-mx-item[data-key="27x13"] [data-campo="max"]').fill('7');
    await page.click('#svMxGuardar');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'jeringas_params').length).toBe(1);
    const post = reqs.find((r) => r.m === 'POST' && r.nombre === 'jeringas_params');
    expect(post.q).toContain('on_conflict=clues%2Cjeringa');
    expect(post.body.find((r) => r.jeringa === '27x13')).toMatchObject({ clues: 'QTSSA000222', max_cajas: 7, activo: 'SI' });
  });

  test('Pinol: seguimiento acotado al alcance del municipal', async ({ page }) => {
    await abrir(page, { rol: 'MUNICIPAL', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PIN');
    await expect(page.locator('#supOps_PIN .sv-unidad')).toHaveCount(1);
    await expect(page.locator('#supOps_PIN .sv-unidad')).toContainText('Santa Bárbara');
    await expect(page.locator('#supOps_PIN .sv-kpi').first()).toContainText('1');
  });

  test('Enviar aviso (municipal): confirma alcance, inserta aviso y reparte sin incluir al remitente', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', usuario: 'sup', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'ENV');
    await page.fill('#svEnvTitulo', 'Recordatorio');
    await page.fill('#svEnvMsg', 'Capturen antes del viernes.');
    await page.click('#svEnvRev');
    await expect(page.locator('.sv-confirma')).toContainText('Recordatorio');
    // 2 usuarios de unidad + 2 CLUES del catálogo (como en escritorio) + admin + municipal; sin el remitente
    await expect(page.locator('.sv-confirma .sv-nota b')).toHaveText('6');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'notificaciones')).toHaveLength(0);
    await page.click('#svEnvOk');
    await expect.poll(() => reqs.filter((r) => r.m === 'POST' && r.nombre === 'notificaciones').length).toBe(1);
    const maestro = reqs.find((r) => r.m === 'POST' && r.nombre === 'notificaciones').body;
    expect(maestro).toMatchObject({ target_scope: 'MUNICIPIO_UNITS', target_municipio: 'CORREGIDORA', title: 'Recordatorio', from_usuario: 'sup', type: 'INFO', status: 'UNREAD' });
    await expect.poll(() => estado.db.notificaciones_perfil.length).toBe(6);
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).not.toContain('sup');
    expect(estado.db.notificaciones_perfil.every((r) => r.notificacion_id === maestro.id)).toBe(true);
    expect(errores).toEqual([]);
  });

  test('Enviar aviso sin título no avanza', async ({ page }) => {
    await abrir(page, { rol: 'CARAVANAS' });
    await irAMas(page, 'ENV');
    await page.click('#svEnvRev');
    await expect(page.locator('.sv-error')).toContainText('título');
  });

  test('Seguridad (admin): abre la captura de hoy con confirmación y corre la auditoría', async ({ page }) => {
    const { estado, reqs } = await abrir(page, { rol: 'ADMIN' });
    await irAMas(page, 'SEG');
    await expect(page.locator('#supOps_SEG')).toContainText('Cerrada');
    await page.click('#svApToggle');
    expect(reqs.filter((r) => r.m === 'POST' && r.nombre === 'aperturas_existencia')).toHaveLength(0);
    await page.click('#svApSi');
    await expect.poll(() => estado.db.aperturas_existencia.length).toBe(1);
    expect(estado.db.aperturas_existencia[0]).toMatchObject({ activo: 'SI', creado_por: 'sup' });
    await expect(page.locator('#supOps_SEG')).toContainText('Abierta');
    await page.click('#svAudit');
    await expect(page.locator('#supOps_SEG')).toContainText('Unidad huérfana');
  });

  test('Permisos: visualizador y caravanas no ven Parámetros ni Seguridad', async ({ page }) => {
    await abrir(page, { rol: 'VISUALIZADOR_JURISDICCIONAL' });
    await page.click('.dock-item[data-panel="MAS"]');
    await expect(page.locator('[data-ir="PAR"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="ENV"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="SEG"]')).toHaveCount(0);
    await expect(page.locator('[data-ir="RDA"]')).toHaveCount(1);
  });

  test('Pinol: registra la entrega, valida estatus y reparte el aviso a la unidad', async ({ page }) => {
    const { estado, reqs, errores } = await abrir(page, { rol: 'MUNICIPAL', usuario: 'sup', municipios_allowed: 'CORREGIDORA' });
    await irAMas(page, 'PIN');
    await page.click('[data-entrega="p1"]');
    await expect(page.locator('#svPinEnt')).toContainText('Santa Bárbara');
    await page.selectOption('#svPinCant', '3');
    await page.fill('#svPinCom', 'Entregado en ventanilla');
    await page.click('#svPinEntOk');
    await expect.poll(() => estado.db.pinol_solicitudes.find((r) => r.id === 'p1').estatus).toBe('ENTREGADO');
    const fila = estado.db.pinol_solicitudes.find((r) => r.id === 'p1');
    expect(fila).toMatchObject({ solicitud_botellas: 3, comentario_entrega: 'Entregado en ventanilla', entregado_por: 'Sup' });
    const patch = reqs.find((r) => r.m === 'PATCH' && r.nombre === 'pinol_solicitudes');
    expect(patch.q).toContain('estatus=eq.PENDIENTE');
    await expect.poll(() => estado.db.notificaciones_perfil.filter((r) => r.notificacion_id === 'NOTIF:PINOL_ENTREGA:p1').length).toBeGreaterThan(0);
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).toContain('unidad830');
    expect(estado.db.notificaciones_perfil.map((r) => r.usuario)).not.toContain('sup');
    await expect(page.locator('#supOps_PIN .sv-unidad')).toHaveCount(0); // ya no hay pendientes en su alcance
    expect(errores).toEqual([]);
  });

  test('Indicadores RDA: esquemas de dosis, deserción y comparativa', async ({ page }) => {
    await abrir(page, { rol: 'JURISDICCIONAL' });
    await irAMas(page, 'RDA');
    await page.click('[data-esq="adultos"]');
    await expect(page.locator('#supRdaRoot .sv-avance .sv-pct')).toHaveText('115'); // 30+70+10+5
    await expect(page.locator('#supRdaRoot .sv-kpi')).toHaveCount(5);
    await page.click('[data-esq="invernal"]');
    await expect(page.locator('#supRdaRoot .sv-avance .sv-pct')).toHaveText('50');
    await page.click('[data-esq="desercion"]');
    await expect(page.locator('#supRdaRoot .sv-cadena').first()).toContainText('Dosis 1');
    await expect(page.locator('#supRdaRoot')).toContainText('Mayor caída');
    await page.click('[data-esq="comparativa"]');
    await expect(page.locator('#supRdaRoot .sv-comp')).toHaveCount(3);
    await page.click('[data-esq="influenza"]');
    await expect(page.locator('#supRdaRoot')).toContainText(/Influenza|meta/i);
  });
});
