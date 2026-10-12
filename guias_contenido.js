/* Guías para las unidades de salud: UNA sola fuente.
 *
 *   · En la app: ayuda.js las muestra en la tarjeta «¿Cómo funciona?» en modo por pasos (sin salir de la pantalla).
 *   · Para compartir: build-guias.js genera de aquí las páginas y los PDF (instructivo_*.html/.pdf, novedades_*).
 *
 * Formato (igual que los bloques de ayuda.js):
 *   { titulo, subtitulo, pagina, pdf, volver, volverEtiqueta, pasos: [ { titulo, bloques: [...] } ] }
 *   bloque: { tipo: 'titulo', texto } | { tipo: 'item', icono, color, nombre, texto, donde? }
 *         | { tipo: 'paso', n, nombre, texto } | { tipo: 'nota', texto }
 *
 * Si cambian reglas o fechas de campaña: editar aquí y correr `npm run build:guias`.
 */
(function (root) {
  'use strict';
  const T = (texto) => ({ tipo: 'titulo', texto });
  const I = (icono, color, nombre, texto, donde) => ({ tipo: 'item', icono, color, nombre, texto, donde });
  const P = (n, nombre, texto) => ({ tipo: 'paso', n, nombre, texto });
  const N = (texto) => ({ tipo: 'nota', texto });

  const G = {};

  // ───────────────────────────────────── SINBA-SIS ─────────────────────────────────────
  G.guia_sis = {
    titulo: 'Guía del SINBA-SIS',
    subtitulo: 'Cómo llenar, enviar y dar seguimiento a tu archivo mensual.',
    pagina: 'instructivo_sis.html', pdf: 'instructivo_sis.pdf',
    volver: 'biovac.html', volverEtiqueta: 'Volver al SINBA-SIS',
    pasos: [
      { titulo: 'Qué es', bloques: [
        T('Un solo archivo al mes, con cuatro hojas'),
        I('summarize', '#0284c7', 'SIS-06-P', 'Tu concentrado del mes: las dosis aplicadas por variable. Tú lo capturas.'),
        I('inventory_2', '#d97706', 'Movimiento de Biológico', 'Existencias, recibido, aplicadas y desechadas por lote. Tú lo capturas.'),
        I('table_view', '#16a34a', 'SIS-SS-CE-H', 'La hoja oficial de claves. Se arma sola con lo que capturas; solo se lee.'),
        I('vaccines', '#C26750', 'Influenza', 'El corte del mes, tomado de tu reporte semanal de Meta-Logro; solo se lee.'),
        N('Las cuatro hojas se llenan, se concilian, se envían y se validan juntas: es un solo archivo.')
      ] },
      { titulo: 'El mes en cuatro pasos', bloques: [
        P(1, 'Captura', 'Llena SIS-06-P y Movimiento de Biológico. Guarda con el botón de la barra de abajo.'),
        P(2, 'Concilia', 'Las dosis aplicadas del paloteo y las del Movimiento deben coincidir, biológico por biológico.'),
        P(3, 'Envía', 'Cuando todo cuadra y estás en la fecha de envío, el botón Enviar se enciende.'),
        P(4, 'Validación', 'Tu municipio revisa. Si corrige algo, tú ves el cambio y lo aceptas.'),
        N('Arriba de la pantalla ves en qué paso va tu mes.')
      ] },
      { titulo: 'Fechas', bloques: [
        I('edit_calendar', '#0284c7', 'Prellenado', 'Desde 7 días antes de que termine el mes puedes ir capturando y guardando.'),
        I('send', '#16a34a', 'Envío', 'Del último día del mes hasta 7 días después. Solo en esas fechas se enciende «Enviar».'),
        I('lock_clock', '#d97706', 'Fuera de fechas', 'Puedes ver todo, pero no guardar ni enviar. Un aviso te dice cuándo abre.'),
        N('Ejemplo, septiembre: capturas desde el 23 de septiembre y envías del 30 de septiembre al 7 de octubre.')
      ] },
      { titulo: 'Para empezar', bloques: [
        I('badge', '#7c3aed', 'Responsable de la información', 'Escribe tu nombre completo. Es un solo nombre para las cuatro hojas y queda fijo cuando envías.'),
        I('domain', '#0284c7', 'Unidad', 'Aparece la tuya, ya seleccionada.'),
        I('calendar_month', '#16a34a', 'Mes que reportas y año', 'Por omisión es el mes que toca reportar. Con «Historial» consultas tus meses anteriores (solo lectura).')
      ] },
      { titulo: 'Hoja SIS-06-P', bloques: [
        I('pin', '#0284c7', 'Qué capturas', 'El total de dosis aplicadas en el mes por variable (biológico, grupo y dosis). No es el paloteo diario: va el resultado ya sumado.'),
        I('groups', '#7c3aed', 'Afromexicanos, indígenas y migrantes', 'Son una parte del total y nunca se suman aparte: si el total es 40 y afromexicanos 20, el total sigue siendo 40. Ninguno puede superar al total de su fila.'),
        N('Cada biológico es un contenedor: ábrelo para capturar. Si ves «Cambios sin guardar», falta guardar con el botón de la barra de abajo.')
      ] },
      { titulo: 'Hoja Movimiento de Biológico', bloques: [
        I('edit_note', '#0284c7', 'Qué capturas por lote', 'Recibido, dosis aplicadas y dosis desechadas. Cada celda se guarda al salir de ella.'),
        I('calculate', '#d97706', 'Existencia final', 'Existencia anterior + recibido − aplicadas − desechadas. La final pasa sola como anterior del mes siguiente.'),
        I('add_circle', '#16a34a', 'Agregar lote', 'Si llegó un lote que no está en la lista, agrégalo con el botón del biológico (también A.R.F. y Canje).'),
        I('contrast', '#7c3aed', 'Dosis pediátrica y de adulto', 'Hepatitis B y COVID Moderna tienen ambas; para conciliar, la pediátrica cuenta como media dosis.'),
        N('Lo recibido puede llegar precargado desde la requisición de la Jurisdicción: revísalo y edítalo si algo cambió.')
      ] },
      { titulo: 'Concilia', bloques: [
        I('compare_arrows', '#16a34a', 'Cómo se ve', 'Bajo cada biológico ves cuántas dosis reportaste en SIS-06-P y cuántas suman tus lotes. En verde: coinciden; si no, te dice la diferencia.'),
        I('tune', '#0284c7', 'Cómo se corrige', 'Ajusta las «aplicadas» por lote en Movimiento, o el paloteo en SIS-06-P, hasta que sean iguales.'),
        I('swap_horiz', '#d97706', 'Comodín de sustitución', 'Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT), anota cuántas con el comodín.'),
        N('Si las dosis no coinciden, el sistema no deja enviar.')
      ] },
      { titulo: 'Hojas de solo lectura', bloques: [
        I('table_view', '#16a34a', 'SIS-SS-CE-H', 'Cada variable con su clave SIS (total, afromexicanos, indígenas y migrantes). Vacío significa 0. Toca una fila para ver su detalle.'),
        I('vaccines', '#C26750', 'Influenza', 'Aquí ves el corte del mes por semana. Para cambiarlo, «Editar semanas en Meta-Logro»: ahí se valida contra tu meta.'),
        N('Lo aplicado de Antiinfluenza en Movimiento debe ser igual al total de Influenza. Si no, «Usar este total aquí» lo pasa al lote.')
      ] },
      { titulo: 'Envía y validación', bloques: [
        P(1, 'Revisa', 'Que la conciliación esté en verde y que tu nombre esté escrito.'),
        P(2, 'Envía', 'Con el botón Enviar de la barra de abajo. Te pide confirmar antes de enviar.'),
        P(3, 'Se bloquea', 'SIS-06-P, Movimiento e Influenza ya no se pueden cambiar desde la unidad; el Movimiento se cierra solo.'),
        P(4, 'Validación', 'Si tu municipio corrige algo, te aparece cada cambio y lo aceptas. Ya validado puedes exportar el Excel oficial e imprimir.'),
        N('Con «Historial» consultas todos tus meses y su estatus, sin poder editarlos.')
      ] },
      { titulo: 'Si algo pasa', bloques: [
        I('wifi_off', '#d97706', 'Se fue el internet', 'Lo que tecleaste queda respaldado en tu equipo y lo recuperas al volver a abrir el mes. En Movimiento, el cambio se guarda solo al volver la conexión.'),
        I('block', '#dc2626', 'No puedo enviar', 'Revisa que estés en la fecha de envío, que la conciliación cuadre y que el responsable esté escrito.'),
        I('edit_off', '#475569', 'Quiero cambiar algo ya enviado', 'Pide a tu municipio que lo corrija en modo revisión; tú verás el cambio para aceptarlo.'),
        I('event_busy', '#0284c7', 'Me equivoqué de mes', 'Cambia «Mes que reportas» arriba: cada mes tiene su propio archivo y su propio estatus.')
      ] }
    ]
  };

  // ───────────────────────────────────── Influenza ─────────────────────────────────────
  G.influenza_captura = {
    titulo: 'Guía del panel de Influenza',
    subtitulo: 'Cómo capturar tu reporte semanal y cuidar tu meta.',
    pagina: 'instructivo_influenza.html', pdf: 'instructivo_influenza.pdf',
    volver: 'index.html', volverEtiqueta: 'Volver a SIREVAQ',
    pasos: [
      { titulo: 'La semana', bloques: [
        T('Cada semana, de lunes a domingo, es un solo reporte'),
        I('event', '#7c3aed', 'La semana completa', 'Todo lo que apliques de lunes a domingo se suma en el reporte de esa semana.'),
        I('weekend', '#0284c7', 'Fin de semana incluido', 'Si tu unidad vacuna sábado o domingo, anótalo en el reporte de esa misma semana.'),
        I('lock_open', '#16a34a', 'Abre el lunes', 'Puedes capturar o corregir el reporte cualquier día; sigue siendo el mismo reporte.')
      ] },
      { titulo: 'Mes a media semana', bloques: [
        T('Si el mes termina a media semana, esa semana se reporta en dos partes'),
        I('event_available', '#d97706', 'De lunes a jueves', 'Se divide en el corte de fin de mes (del lunes al último día del mes) y el resto de la semana (del día 1 al domingo).'),
        I('date_range', '#0284c7', 'Viernes, sábado o domingo', 'La semana se reporta completa en un solo reporte.'),
        N('Ejemplo, semana del 30 nov al 6 dic: «30 nov» es el corte de fin de mes y «1 al 6 dic» el resto. Cada semana aparece en el panel con sus fechas.')
      ] },
      { titulo: 'Tu reporte en 4 pasos', bloques: [
        P(1, 'Elige la semana', 'En «Semana a reportar»; el panel ya te muestra la semana en curso con sus fechas.'),
        P(2, 'Escribe tu nombre', 'Quien captura queda registrado en el reporte.'),
        P(3, 'Anota las dosis', 'En «Esta semana», solo lo que aplicaste en esa semana. Si no hubo, usa «Sin movimiento».'),
        P(4, 'Guarda', 'Con el botón azul. Cada reporte recibe un folio único.')
      ] },
      { titulo: 'La tabla', bloques: [
        I('flag', '#16a34a', 'Meta anual', 'Lo asignado a tu unidad para ese grupo en toda la campaña. Es el tope.'),
        I('functions', '#7c3aed', 'Acumulado', 'Lo que ya reportaste en las demás semanas.'),
        I('edit', '#0284c7', 'Esta semana', 'Lo que aplicaste en la semana elegida: aquí escribes.'),
        I('percent', '#d97706', 'Avance', '(Acumulado + Esta semana) ÷ Meta. Bajo la barra ves «X de Y».')
      ] },
      { titulo: 'Tu meta es el tope', bloques: [
        I('error', '#dc2626', 'Te pasas por N', 'Con lo que anotas rebasas la meta: el renglón se marca en rojo y el reporte no se guarda hasta corregir la cifra.'),
        I('block', '#475569', 'Sin meta', 'Si tu unidad no tiene meta en un grupo, aparece «Sin meta asignada» y no se captura. Los grupos completos sin meta se reúnen en un aviso al final.'),
        I('schedule', '#d97706', '2ª y 1ª dosis', 'No hay 2ª dosis durante el primer mes de la campaña ni 1ª dosis durante el último mes.'),
        N('Si de verdad aplicaste más dosis que tu meta, avisa a tu municipio para revisarla.')
      ] },
      { titulo: 'Sin movimiento y después de guardar', bloques: [
        I('pause_circle', '#64748b', 'Sin movimiento', 'Si no aplicaste dosis, actívalo: la semana se guarda en ceros y recibe su folio. Si luego aplicas, desactívalo y corrige mientras la semana siga abierta.'),
        I('tag', '#7c3aed', 'Folio', 'Cada reporte recibe un folio único; lo ves en el paso 4 y en el Historial de Reportes.'),
        I('edit_note', '#0284c7', 'Corregir', 'Puedes volver a guardar la misma semana; las ediciones quedan en el historial.'),
        I('insights', '#16a34a', 'Resumen de meta', 'Tu avance, tu ritmo, el abasto de frascos y la descarga de tu meta en Excel.')
      ] },
      { titulo: 'Dudas comunes', bloques: [
        I('history', '#d97706', 'Olvidé capturar una semana', 'Captúrala después: el panel te avisa cuántas semanas tienes sin reporte y te lleva a ellas.'),
        I('weekend', '#0284c7', 'Vacunamos sábado y domingo', 'Son parte de la misma semana (de lunes a domingo): anótalos en ese reporte.'),
        I('wifi_off', '#64748b', 'No tengo internet', 'El reporte se guarda en el equipo y se envía solo cuando regresa la conexión.'),
        I('lock_clock', '#16a34a', 'Aún no abre la campaña', 'Antes del inicio verás «Captura cerrada»; ese día el panel abre.')
      ] }
    ]
  };

  // ───────────────────────────────────── Novedades ─────────────────────────────────────
  G.novedades = {
    titulo: '¿Qué hay de nuevo?',
    subtitulo: 'Lo nuevo en SIREVAQ para tu unidad. Cada cosa dice dónde encontrarla.',
    pagina: 'novedades_unidades.html', pdf: 'novedades_unidades.pdf',
    volver: 'index.html', volverEtiqueta: 'Volver a SIREVAQ',
    version: '2026-10',
    pasos: [
      { titulo: 'SINBA-SIS e Influenza', bloques: [
        I('assignment', '#0284c7', 'SINBA-SIS en un solo archivo', 'Tu mes completo en un lugar: SIS-06-P, Movimiento de Biológico, hoja de claves e Influenza. Una barra abajo te lleva entre hojas y muestra el estatus: captura, concilia, envía y validación.', 'Captura de reportes → SINBA-SIS'),
        I('vaccines', '#7c3aed', 'Influenza: un reporte por semana', 'La semana (de lunes a domingo) se abre el lunes y la capturas cualquier día. El panel te muestra cuántas dosis llevas contra tu meta y no deja pasarte de ella.', 'Captura de reportes → Influenza')
      ] },
      { titulo: 'Capacitaciones y pedidos', bloques: [
        I('event', '#0284c7', 'Calendario de capacitaciones', 'Consulta fechas, horarios y sedes de las capacitaciones de la Jurisdicción. Te avisa cuando se acercan (7, 3 y 1 día antes, y el mismo día).', 'Mi perfil → Más → Calendario de capacitaciones'),
        I('inventory', '#d97706', 'Pedidos extraordinarios', 'Cuando la Jurisdicción abre un pedido extraordinario, eliges cuál capturar. Los extraordinarios no cuentan para tu cumplimiento del pedido mensual.', 'Captura de reportes → Pedido')
      ] },
      { titulo: 'Más comodidad', bloques: [
        I('cloud_sync', '#16a34a', 'Tu captura no se pierde', 'Si se va el internet, SIS-06-P, Movimiento de Biológico e Influenza guardan un respaldo en tu equipo y se envían al volver la conexión.', 'Automático, no hay que hacer nada'),
        I('help', '#475569', 'Ayuda en cada pantalla', 'El botón «?» o «¿Cómo funciona?» explica la pantalla paso a paso. En Mi perfil → Cuenta puedes actualizar tus datos de contacto y cambiar tu contraseña.', 'Botón «?» junto al título de cada panel')
      ] }
    ]
  };

  // ───────────────────────────────────── Requisiciones (personal de la Jurisdicción) ─────────────────────────────────────
  // Solo se ve en la tarjeta de ayuda de requisiciones.html; no genera página ni PDF aparte.
  G.requi = {
    titulo: 'Guía de Requisiciones',
    subtitulo: 'De la Jurisdicción a los municipios y hospitales, y de ahí a las unidades.',
    sinNovedades: true,
    pasos: [
      { titulo: 'El recorrido', bloques: [
        T('Tres pasos, en orden'),
        P(1, 'Lo surtido', 'Registras lo que llegó del almacén estatal, lote por lote. Lo tecleas rápido o lo pegas desde Excel.'),
        P(2, 'Municipios y hospitales', 'Una tabla: un renglón por lote y una columna por destino. Repartes todo el lote.'),
        P(3, 'Unidades', 'Eliges el municipio y repartes cada lote entre sus unidades de salud.'),
        I('touch_app', '#0284c7', 'Los círculos de arriba', 'Muestran el avance de cada paso y también son botones para ir a él.'),
        N('Cada unidad recibe lo que le repartas como precarga en su Movimiento de Biológico.')
      ] },
      { titulo: 'Paso 1 · Lo surtido', bloques: [
        T('Captura rápida, sin soltar el teclado'),
        P(1, 'Elige el biológico', 'Toca su botón de color (o su renglón en la tabla). El recuadro gris confirma qué estás capturando.'),
        P(2, 'Lote, caducidad, cantidad', 'Escribe el lote y presiona Enter. Si el lote ya lo conocía el sistema, la caducidad aparece sola y Enter te manda directo a la cantidad.'),
        P(3, 'Enter guarda y sigue', 'Se guarda y regresas al campo Lote, listo para el siguiente lote del mismo biológico.'),
        I('event', '#0284c7', 'Caducidad', 'Se teclea DD-MM-AA (150729, 15-07-29 o 15/07/29) y a un lado ves cómo se mostrará: JUL-29. También entiende 07-29 o JUL-29 (toma el último día del mes).'),
        I('content_paste', '#7c3aed', 'Muchos lotes de golpe', 'Copia las filas de Excel (biológico, lote, caducidad y cantidad) y pégalas en el campo Lote o usa «Pegar desde Excel». Antes de importar ves cómo se entendió cada fila.')
      ] },
      { titulo: 'Paso 1 · Corregir y lotes por llegar', bloques: [
        T('Revisar y corregir'),
        I('edit', '#0284c7', 'Lápiz del lote', 'Cambia su cantidad o caducidad sin salir del renglón. El lápiz junto a la clave edita la clave del biológico.'),
        I('rule', '#d97706', 'Comparador de lotes', 'Te avisa si el lote ya existe o si parece un error de captura (por ejemplo, una letra de más) antes de guardarlo.'),
        T('Cantidades primero, lotes después'),
        I('format_list_numbered', '#0284c7', 'Prellenar y asignar', 'Con «Prellenar cantidades» capturas cuánto llegó de cada biológico sin lote y ya puedes repartir. Cuando lleguen los lotes, «Asignar lotes» los pone y el reparto se acomoda solo.'),
        I('call_split', '#7c3aed', 'Cambiar o dividir', 'Con el ícono de dividir cambias o partes el lote de un renglón que ya lo tenía.'),
        N('Un lote no se puede cambiar de biológico una vez capturado (quítalo y vuélvelo a agregar), ni bajar su cantidad por debajo de lo que ya repartiste.')
      ] },
      { titulo: 'Paso 2 · Municipios y hospitales', bloques: [
        T('Cómo se llena la tabla'),
        P(1, 'Ubica el lote', 'Un renglón por lote surtido, con el color de su biológico. Los botones de arriba filtran por biológico.'),
        P(2, 'Escribe la cantidad de cada destino', 'Tab avanza al siguiente destino y Enter baja al siguiente lote. Se guarda al salir de la celda.'),
        P(3, 'Revisa el saldo', 'La última columna dice cuánto queda por repartir: gris sin empezar, ámbar con saldo, verde completo.'),
        I('ads_click', '#16a34a', 'Doble clic en una celda vacía', 'Pone todo el saldo que queda de ese lote en ese destino.'),
        N('El sistema rechaza repartir más de lo surtido de ese lote, y no te deja bajar a un municipio por debajo de lo que ya repartió entre sus unidades.')
      ] },
      { titulo: 'Paso 3 · Unidades', bloques: [
        T('Cómo reparte cada municipio'),
        P(1, 'Elige el municipio', 'Cada botón muestra cuántos de sus lotes ya quedaron completos. Solo salen los lotes que ese municipio tiene asignados en el paso 2.'),
        P(2, 'Escribe por unidad', 'Un renglón por unidad (ordenadas por CLUES) y una columna por lote; arriba de cada columna ves el saldo. Tab avanza al siguiente lote y Enter baja a la siguiente unidad.'),
        I('download', '#0284c7', 'Descargar', 'El ícono al final de cada renglón exporta el Excel oficial de esa unidad.'),
        N('El reparto entre unidades no puede exceder lo asignado al municipio.')
      ] },
      { titulo: 'Atajos y avance', bloques: [
        T('Para repartir más rápido'),
        I('content_paste', '#7c3aed', 'Pegar un bloque', 'En los pasos 2 y 3 copia un rango de Excel y pégalo en cualquier celda: se acomoda hacia abajo y a la derecha.'),
        I('auto_fix_high', '#d97706', 'Sugerir según el mes anterior', 'Llena los lotes que aún no tienen reparto con la proporción del mes pasado. Nunca toca lo que ya capturaste.'),
        T('Los puntos de avance'),
        I('radio_button_unchecked', '#94a3b8', 'Gris · sin empezar', 'Ese lote todavía no tiene reparto.'),
        I('timelapse', '#f59e0b', 'Ámbar · en proceso', 'Ya tiene reparto, pero aún queda saldo por repartir.'),
        I('check_circle', '#16a34a', 'Verde · completo', 'No queda saldo. Si dejas algo sin repartir a propósito se queda ámbar y solo te lo recordamos al cerrar.')
      ] },
      { titulo: 'La entrega y su cierre', bloques: [
        T('Del mes a la exportación'),
        I('save', '#0284c7', 'Crear requisición', 'Si el mes todavía no existe, aparece un botón para crearla; hasta entonces no hay pasos.'),
        I('layers', '#0284c7', 'Entregas del mes', 'Si llega otra entrega en el mes, toca «Nueva entrega»: cada una se captura, se reparte y se exporta por separado (archivos _E1, _E2…) y puedes ponerle nombre con el lápiz.'),
        I('event', '#7c3aed', 'Fecha de recepción', 'Se captura en «Recibida el», junto a las entregas del mes (cada entrega tiene la suya): es la que sale en el Excel y se conserva al cerrar.'),
        I('lock', '#0f172a', 'Cerrar entrega', 'La marca como enviada. Puedes seguir editando; quedará «corregida posteriormente» para que municipios y unidades lo sepan.'),
        I('history', '#64748b', 'Historial y exportar', 'El reloj abre las requisiciones de otros meses; «Exportar» genera los archivos oficiales por destino.')
      ] }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = G;
  root.GuiasContenido = G;
})(typeof window !== 'undefined' ? window : globalThis);
