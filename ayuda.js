/* Ayuda contextual de SIREVAQ.
 *
 * Cualquier elemento con data-ayuda="clave" abre la ayuda de esa clave
 * (botones "?" en encabezados de hojas/paneles). El contenido vive aquí, en un
 * solo lugar, para mantenerlo en el mismo tono y al día con la app:
 *
 *   { titulo, subtitulo, bloques: [
 *       { tipo: 'titulo', texto },
 *       { tipo: 'item',   icono, color, nombre, texto },   // qué es / para qué sirve
 *       { tipo: 'paso',   n, nombre, texto },              // secuencia
 *       { tipo: 'nota',   texto } ] }
 *
 * La ventana se crea sola la primera vez (no requiere marcado en la página) y
 * es adaptativa: centrada en escritorio, hoja desde abajo en móvil.
 */
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (texto) => ({ tipo: 'titulo', texto });
  const I = (icono, color, nombre, texto) => ({ tipo: 'item', icono, color, nombre, texto });
  const P = (n, nombre, texto) => ({ tipo: 'paso', n, nombre, texto });
  const N = (texto) => ({ tipo: 'nota', texto });

  const CONTENIDO = {
    // ----------------------------------------- Paneles de captura de la unidad (escritorio y móvil)
    cap_sr: {
      titulo: 'Existencia de biológicos',
      subtitulo: 'Reporte semanal de lo que hay físicamente en tu unidad refrigerante.',
      bloques: [
        T('Cuándo y qué se reporta'),
        I('event_available', '#1d4ed8', 'Una captura por semana', 'Se captura el jueves o el viernes. Una vez guardada, solo puedes modificarla con «Editar» mientras la ventana siga abierta.'),
        I('ac_unit', '#0284c7', 'Solo lo que está en tu unidad refrigerante', 'Reporta existencias físicas. No incluyas biológicos en A.R.F. (en dictamen) ni canjes.'),
        T('Cómo se captura'),
        P(1, 'Escribe tu nombre', 'Queda registrado como responsable del conteo.'),
        P(2, 'Agrega un renglón por lote', 'Elige el biológico y el lote (la caducidad aparece sola), la fecha de recepción, el origen (requisición, préstamo por desabasto o préstamo por A.R.F.) y la cantidad en frascos.'),
        P(3, 'Agrega más lotes si hace falta', 'Con «Agregar otro lote o biológico». El ícono de documento con «+» duplica ese renglón para añadir otra fecha de recepción del mismo lote, y el bote de basura lo elimina.'),
        P(4, 'Guarda', 'Con el botón Guardar de la barra flotante; el estatus junto a él te indica si el reporte ya quedó guardado.'),
        T('Detalles que conviene conocer'),
        I('science', '#d97706', 'Frascos con decimales', 'Si capturas un decimal en TD, DPT, Influenza o Hepatitis B, el sistema te pide la fecha de apertura del frasco: una vez abierto dura 28 días. BCG y SR quedan excluidas por el manual.'),
        I('traffic', '#b45309', 'Semaforización de permanencia', 'Compara la fecha de recepción con hoy: ámbar cuando el lote lleva más de 2 meses en tu unidad y rojo cuando pasa de 3.'),
        I('pause_circle', '#64748b', 'Sin movimiento', 'Aparece cuando ya tienes un reporte anterior. Al activarlo se replican los valores del último reporte con la fecha de hoy y la captura queda bloqueada. Úsalo solo si realmente no hubo cambios en la semana.'),
        N('Si el panel aparece cerrado, el aviso superior te explica el motivo: día no habilitado o reporte ya guardado.')
      ]
    },
    cap_cons: {
      titulo: 'Insumos y consumibles',
      subtitulo: 'Reporte semanal para el control de inventario de jeringas.',
      bloques: [
        T('Cuándo se reporta'),
        I('event_available', '#0f766e', 'Cada jueves', 'El reporte se habilita los jueves. Si ese día no es laborable, o si administración abre una captura extraordinaria, el aviso superior lo indica.'),
        T('Cómo se captura'),
        P(1, 'Escribe tu nombre', 'Queda registrado como responsable de la captura.'),
        P(2, 'Captura las cantidades', 'SRP y SR en dosis; jeringa 0.5 y jeringa 5.0 en piezas. Captura 0 donde no tengas.'),
        P(3, 'Revisa la aguja', 'Se llena sola y siempre es igual a la cantidad de jeringas 5.0; no se captura.'),
        P(4, 'Guarda', 'Con el botón Guardar de la barra flotante. Después, «Editar» permite corregir mientras el reporte siga habilitado.'),
        T('Si no hubo cambios'),
        I('pause_circle', '#64748b', 'Sin movimiento', 'Cuando ya existe un reporte anterior puedes replicar sus valores con la fecha de hoy. Úsalo solo si realmente no hubo cambios en la semana.'),
        N('El reporte es semanal y obligatorio: de él depende el control de inventario de jeringas de tu unidad.')
      ]
    },
    cap_bio: {
      titulo: 'Pedido de biológico',
      subtitulo: 'Existencia actual y pedido por biológico, validados contra el promedio de tu unidad.',
      bloques: [
        T('Cuándo se captura'),
        I('event_upcoming', '#4338ca', 'Pedido mensual', 'Se captura dentro de la ventana operativa del mes. La tarjeta superior muestra la fecha objetivo y el aviso de estatus indica el periodo exacto; fuera de él el panel queda cerrado.'),
        I('add_alert', '#d97706', 'Pedido extraordinario', 'Si administración abre uno, es un pedido aparte del mensual (no lo reemplaza). Cuando hay más de uno abierto aparece un selector para elegir cuál capturas.'),
        T('Cómo se captura'),
        P(1, 'Escribe tu nombre', 'Queda registrado como quien captura el pedido.'),
        P(2, 'Captura por biológico', 'Existencia: frascos que tienes hoy. Pedido: frascos que solicitas. Junto a cada uno ves el promedio mensual (en frascos) y el mínimo y máximo (en dosis).'),
        P(3, 'Revisa los avisos', 'Cada biológico muestra Correcto, Error o Pendiente. Mientras haya errores el pedido no se puede guardar.'),
        P(4, 'Guarda', 'Con el botón Guardar de la barra flotante. Después, «Editar» permite corregir mientras la ventana siga abierta.'),
        T('Reglas de validación'),
        I('functions', '#4338ca', 'Existencia + pedido ≥ promedio', 'Lo que tienes más lo que pides debe alcanzar el promedio mensual del biológico. Si no, el aviso indica cuántos frascos faltan.'),
        I('format_list_numbered', '#4338ca', 'Múltiplos', 'Hexavalente se pide de 10 en 10; Rotavirus, Neumocócica 13, Neumocócica 20 y SRP, de 5 en 5.'),
        I('campaign', '#7c3aed', 'Biológicos de campaña', 'Influenza, COVID-19, VPH y Varicela se capturan sin validar contra el promedio y aparecen como «Campaña».'),
        T('Opción «Solo existencias» (sin pedido)'),
        I('inventory', '#16a34a', 'Qué hace', 'Actívala cuando este mes no necesitas pedir: los pedidos quedan en 0 y solo reportas tu existencia. El sistema te pide confirmar antes de activarla.'),
        I('rule', '#dc2626', 'Cuándo se permite', 'Solo si la existencia de cada biológico es mayor o igual a su promedio. Si alguno queda por debajo, no se puede enviar el pedido en ceros: el aviso indica cuántos frascos faltan. Captura el pedido que corresponde o corrige la existencia.'),
        N('Si dejas todos los pedidos en cero sin activar «Solo existencias», el sistema te pedirá autorizarlo y aplicará la misma regla.')
      ]
    },
    cap_pinol: {
      titulo: 'Solicitud de Pinol',
      subtitulo: 'Una solicitud a la vez, hasta que confirmes que recibiste el insumo.',
      bloques: [
        T('El ciclo de una solicitud'),
        P(1, 'Solicitas', 'Escribes tu nombre, cuántas botellas tienes (existencia) y cuántas necesitas (pedido, mínimo 1). Las observaciones son opcionales.'),
        P(2, 'El municipio surte', 'Recibes una notificación cuando el Pinol se marca como enviado.'),
        P(3, 'Confirmas la recepción', 'Cuando lo tengas en tu unidad, pulsa «Ya lo recibí, confirmar recepción» en este panel (o confírmalo desde la notificación).'),
        P(4, 'Puedes pedir de nuevo', 'Hasta confirmar, el formulario permanece bloqueado y no se admite otra solicitud.'),
        T('Por qué se bloquea'),
        I('lock_clock', '#b45309', 'Una solicitud activa a la vez', 'Mientras una solicitud esté en curso o enviada sin confirmar, no se admite otra. El servidor también aplica el bloqueo, aunque uses otro dispositivo.'),
        I('water_drop', '#15803d', 'Uso y presentación', 'Multilimpiador desinfectante Pinol® de 828 mL por botella, de uso exclusivo para refrigeradores de vacunas y farmacia.'),
        N('El aviso del panel muestra en qué paso va tu solicitud, con las fechas de solicitud y de envío.')
      ]
    },

    // ------------------------------------------------- Influenza: captura semanal
    influenza_captura: {
      titulo: 'Cómo funciona la captura de Influenza',
      subtitulo: 'Un reporte por semana, con folio, validado contra la meta de tu unidad.',
      bloques: [
        T('Cuándo se captura'),
        I('event', '#7c3aed', 'Un reporte por semana', 'La unidad de reporte es la semana, de lunes a domingo. Cada semana se reporta una sola vez; el panel la abre el lunes y puedes capturarla o corregirla cualquier día: es el mismo reporte.'),
        I('weekend', '#0284c7', 'Sábado y domingo', 'Forman parte de la misma semana: si tu unidad vacuna en fin de semana, súmalo en el reporte de esa semana.'),
        I('event_available', '#0284c7', 'Cuando el mes termina a media semana', 'Si el mes termina de lunes a jueves, esa semana se reporta en dos partes: el «corte de fin de mes» (del lunes al último día del mes) y el resto (del día 1 al domingo). Si el mes termina en viernes, sábado o domingo, la semana se reporta completa.'),
        I('lock_clock', '#64748b', 'Panel cerrado', 'Antes del inicio de la campaña, fuera de sus fechas o antes de que abra la semana no se puede guardar; el aviso te dice cuándo abre.'),
        T('Cómo se captura'),
        P(1, 'Elige la semana', 'En «Semana a reportar». Entras en la semana en curso y cada semana aparece con sus fechas (por ejemplo, 12 al 18 oct); las etiquetas dicen si ya está capturada, pendiente o cuándo abre.'),
        P(2, 'Escribe tu nombre', 'Queda registrado como quien capturó el reporte.'),
        P(3, 'Anota las dosis aplicadas', 'En «Esta semana», escribe solo lo que aplicaste en esa semana; no sumes lo de semanas anteriores. Si no aplicaste nada, activa «Sin movimiento».'),
        P(4, 'Guarda', 'Con el botón azul. Cada reporte recibe un folio único, que ves en el paso 4 y en el Historial de Reportes. Puedes volver a guardar la misma semana para corregirla.'),
        T('Cómo leer la tabla'),
        I('flag', '#16a34a', 'Meta anual', 'Lo asignado a tu unidad para ese grupo en toda la campaña. Es el tope: no se puede reportar más.'),
        I('functions', '#7c3aed', 'Acumulado', 'Lo que ya reportaste en las demás semanas de la campaña.'),
        I('edit', '#0284c7', 'Esta semana', 'Lo que aplicaste en la semana elegida. El avance se calcula solo con Acumulado + Esta semana contra la Meta anual y debajo de la barra ves «X de Y».'),
        I('error', '#dc2626', 'Te pasas por N', 'Si con lo que anotas rebasas la meta, el renglón se marca en rojo con cuántas dosis te pasas y el reporte no se guarda hasta corregirlo.'),
        I('history', '#d97706', 'Avisos sobre la tabla', 'Aparecen solo cuando importan: si algún grupo rebasa su meta y si te falta capturar alguna semana anterior, con un acceso directo.'),
        T('Resumen de meta'),
        I('insights', '#7c3aed', 'Tu avance de un vistazo', 'La pestaña «Resumen de meta» muestra tu meta, las dosis aplicadas, el avance contra lo esperado a la fecha, las semanas reportadas, tu ritmo y el detalle por grupo. Ahí también están el abasto de frascos y el pronóstico de autonomía.'),
        I('table_view', '#16a34a', 'Exportar meta (Excel)', 'Elige Influenza, COVID-19 o ambas y genera el archivo oficial de metas con solo tu unidad: tu columna con la meta de cada rubro y, en Influenza, tu distribución de jeringa.'),
        T('Rubros bloqueados'),
        I('block', '#d97706', 'Sin meta', 'Si tu unidad no tiene meta en un renglón, aparece atenuado con «Sin meta» y no se captura. Los grupos completos sin meta se reúnen en un aviso al final de la página.'),
        I('schedule', '#d97706', '2ª y 1ª dosis', 'No hay 2ª dosis durante el 1er mes de la campaña ni 1ª dosis durante el último mes.'),
        N('Un reporte guardado se puede corregir mientras la semana esté abierta; si el SIS del mes ya se envió, la corrección la hace tu municipio.')
      ]
    },

    // ---------------------------------------------------------------- SINBA-SIS
    sinba: {
      titulo: 'Cómo funciona el SINBA-SIS',
      subtitulo: 'Un solo archivo mensual con cuatro hojas: se llena, se concilia, se envía y se valida completo.',
      bloques: [
        T('Las cuatro hojas'),
        I('summarize', '#0284c7', 'SIS-06-P', 'Tu concentrado del mes: dosis aplicadas por variable (con afromexicanos, indígenas y migrantes como subconjunto del total).'),
        I('inventory_2', '#d97706', 'Movimiento de Biológico', 'Existencias, recibido, aplicadas y desechadas por lote. La existencia pasa sola al mes siguiente.'),
        I('table_view', '#16a34a', 'SIS-SS-CE-H', 'La hoja de claves: se arma sola con SIS-06-P e Influenza. Aquí no se captura nada.'),
        I('vaccines', '#C26750', 'Influenza', 'Se lee del panel de Meta-Logro (ahí se valida contra tu meta). Aquí ves el corte del mes por semana; para cambiarlo vas a Meta-Logro.'),
        T('El mes en cuatro pasos'),
        P(1, 'Captura', 'Se abre una semana antes de cerrar el mes. Guarda con el botón de la barra de abajo; lo que teclees también queda respaldado en tu dispositivo, así que un corte de internet no te hace perder el avance.'),
        P(2, 'Concilia', 'Las dosis aplicadas del paloteo y las del Movimiento deben coincidir, biológico por biológico. Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT) usa el comodín de sustitución.'),
        P(3, 'Envía', 'Solo del último día del mes a la semana siguiente. Al enviar, todo el archivo se bloquea, incluida Influenza.'),
        P(4, 'Validación', 'El municipal revisa; si corrige algo, tú ves cada cambio y lo aceptas. Ya validado puedes exportar el Excel oficial e imprimir.'),
        T('Dos candados, dos dueños'),
        I('send', '#0f172a', 'Enviar (la unidad)', 'Es el ÚNICO candado de la unidad y bloquea todo el SINBA-SIS a la vez: paloteo, Movimiento e Influenza. Al enviar, el Movimiento se cierra solo; no hay que «cerrar el mes» aparte.'),
        I('lock', '#475569', 'Cerrar Movimiento (el municipal)', 'Solo cierra el Movimiento de Biológico; no envía ni valida. Lo manejan municipal, jurisdicción y administración, y se puede reabrir con «Corregir movimiento».'),
        T('Cómo se consolida'),
        P(1, 'Unidad', 'Cada unidad envía su SINBA-SIS. Si las dosis aplicadas del paloteo y del Movimiento no coinciden, el sistema no lo envía.'),
        P(2, 'Municipio', 'El municipal valida unidad por unidad (puede corregir y la unidad ve cada cambio). El Movimiento del municipio se arma SOLO con lo que envían sus unidades (cada envío se suma al instante); el municipal puede ajustar recibido, aplicadas y desechadas, y sus ajustes se conservan. La existencia anterior viene del cierre del mes pasado. Una unidad que no envíe (internet, etc.) no lo bloquea: se marca «sin envío» con un motivo.'),
        P(3, 'Jurisdicción', 'Suma por MUNICIPIO (no por unidad) y los hospitales aparte. Lo que llega se suma como «provisional». El municipal imprime su Movimiento, la jurisdicción lo valida en papel, se corrige en la plataforma y, al empatar, el municipal lo cierra con «Cerrar mes»: entonces queda definitivo. Para cerrar, todas las unidades deben estar validadas (o «sin envío»).'),
        N('Una vez enviado, la unidad ya no puede cambiar nada (ni SIS-06-P, ni Movimiento, ni Influenza): solo el municipal. Con «Historial» consultas todos tus meses, siempre sin poder editarlos.')
      ]
    },

    // ------------------------------------------------------------------ SIS-06-P
    sis06p: {
      titulo: 'SIS-06-P · tu concentrado del mes',
      subtitulo: 'La hoja base del archivo: de aquí se arma SIS-SS-CE-H.',
      bloques: [
        T('Qué capturas'),
        I('pin', '#0284c7', 'Total', 'Las dosis aplicadas en el mes por variable (biológico, grupo y dosis). No es el paloteo diario: aquí va el resultado ya sumado.'),
        I('groups', '#7c3aed', 'Afromexicanos, indígenas y migrantes', 'Son subconjuntos del total, nunca se suman aparte: si el total es 40 y afromexicanos 20, el total sigue siendo 40. Ninguno puede superar al total de su fila.'),
        T('Guardar y enviar'),
        P(1, 'Guarda', 'Cada biológico es un contenedor: ábrelo para capturar. El aviso "Cambios sin guardar" y el botón de la barra te dicen si falta guardar.'),
        P(2, 'Concilia', 'La tarjeta de conciliación muestra los biológicos cuyas dosis no coinciden con Movimiento de Biológico. Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT), captura cuántas en el comodín de sustitución.'),
        P(3, 'Envía', 'Cuando todo cuadra y estás en la ventana de envío, el botón Enviar se enciende.'),
        N('Si se va el internet o falla el guardado, lo que tecleaste se queda respaldado en este dispositivo: al volver a abrir el mes te avisamos y lo recuperas. Después de enviar esta hoja se bloquea; si el municipal corrige algo, te aparece cada cambio para que lo aceptes.')
      ]
    },

    // ---------------------------------------------------------------- Movimiento
    movimiento: {
      titulo: 'Movimiento de Biológico',
      subtitulo: 'Cuánto tenías, cuánto llegó y cuánto se usó, lote por lote.',
      bloques: [
        T('Cómo se calcula'),
        I('calculate', '#d97706', 'Existencia final', 'Existencia anterior + recibido − aplicadas − desechadas. La final pasa sola como anterior del mes siguiente.'),
        I('edit_note', '#0284c7', 'Qué capturas por lote', 'Recibido, dosis aplicadas y dosis desechadas. Cada celda se guarda al salir de ella.'),
        I('add_circle', '#16a34a', 'Agregar lote', 'Si llegó un lote que no está en la lista, agrégalo con el botón del biológico. Los lotes A.R.F. (en dictamen) y Canje se agregan también desde ahí.'),
        I('contrast', '#7c3aed', 'Dosis pediátrica y de adulto', 'Hepatitis B y COVID Moderna tienen dosis pediátrica y de adulto por separado; para conciliar, la pediátrica cuenta como media dosis.'),
        T('Que cuadre con tu paloteo'),
        P(1, 'Compara', 'Bajo cada biológico ves cuántas dosis reportaste en SIS-06-P y cuántas suman tus lotes. En verde: coinciden.'),
        P(2, 'Corrige', 'Ajusta las "aplicadas" por lote aquí, o el paloteo en SIS-06-P, hasta que sean iguales. En Influenza, "Usar este total aquí" pasa el total del mes al lote.'),
        N('Lo recibido puede llegar precargado desde la requisición de la Jurisdicción; puedes editarlo si algo cambió. Si falla el internet al guardar una casilla, el cambio queda respaldado y se guarda solo al volver la conexión. Al enviar el SINBA-SIS, el Movimiento se cierra solo y ya no se puede modificar desde la unidad.')
      ]
    },

    // -------------------------------------------------------------------- CE-H
    ceh: {
      titulo: 'SIS-SS-CE-H · hoja de claves',
      subtitulo: 'Se arma sola: aquí solo se lee.',
      bloques: [
        T('Qué es'),
        I('table_view', '#16a34a', 'La hoja oficial de claves', 'Cada variable con su clave SIS: total, afromexicanos, indígenas y migrantes. Vacío significa 0, igual que en el Excel oficial.'),
        I('vaccines', '#C26750', 'Influenza al final', 'Después de las claves de SIS-06-P van las de Influenza (BIE/BIO), con el corte del mes.'),
        T('Cómo leerla'),
        P(1, 'Abre un biológico', 'Todos nacen cerrados; su resumen dice cuántas dosis y cuántas variables tienen dato. "Solo biológicos con captura" oculta los vacíos.'),
        P(2, 'Toca una fila', 'Te muestra el detalle completo de esa variable con sus cuatro claves. En pantallas angostas es la forma de ver afromexicanos, indígenas y migrantes.'),
        N('Si algo no cuadra, se corrige en su origen: SIS-06-P (variables de biológicos) o Meta-Logro (Influenza). Esta hoja no se edita.')
      ]
    },

    // --------------------------------------------------------------- Influenza
    influenza: {
      titulo: 'Influenza en el SINBA-SIS',
      subtitulo: 'El corte del mes, leído de Meta-Logro.',
      bloques: [
        T('De dónde sale'),
        I('sync_alt', '#C26750', 'Meta-Logro', 'Cada semana reportas en Meta-Logro, donde se valida contra tu meta. Aquí aparece solo; no hay nada que copiar ni capturar dos veces.'),
        I('calendar_view_week', '#0284c7', 'Semanas', 'Cada reporte es una semana (de lunes a domingo); el mes toma las semanas que cierran en él (hasta 5). Una semana "sin movimiento" también cuenta como reportada.'),
        I('science', '#16a34a', 'Frascos', 'El total en frascos es el total de dosis entre 10 (10 dosis por frasco).'),
        T('Cómo usarla'),
        P(1, 'Revisa', 'En pantallas angostas elige una semana arriba para verla completa; toca una fila para ver su desglose semanal.'),
        P(2, 'Concilia', 'Lo aplicado de Antiinfluenza en Movimiento debe ser igual al total de aquí. Si no, "Ir a Movimiento" te lleva y "Usar este total aquí" lo pasa al lote.'),
        P(3, 'Corrige', '"Editar semanas en Meta-Logro" guarda tu SIS-06-P y te lleva al panel de Influenza.'),
        N('Al enviar el SINBA-SIS, Influenza de ese mes queda congelada para la unidad. Si hay que corregirla, el municipal usa «Corregir semanas» (puede cambiar cualquier semana o agregar una que falte); cada cambio queda registrado y la unidad lo ve para aceptarlo.')
      ]
    },

    // --------------------------------------------------------- Municipal / revisión
    seguimiento: {
      titulo: 'Seguimiento del SINBA-SIS',
      subtitulo: 'El estatus de cada unidad en el mes elegido.',
      bloques: [
        T('Qué ves'),
        I('fact_check', '#0284c7', 'Estatus por unidad', 'Sin enviar (aún captura), Por validar (ya envió y espera tu validación) o Validado. El banner indica la ventana de envío del mes.'),
        I('compare_arrows', '#d97706', 'Paloteo vs. Movimiento', 'Si las dosis aplicadas de cada unidad coinciden entre SIS-06-P y Movimiento. No se puede validar mientras no coincidan.'),
        T('Cómo se valida'),
        P(1, 'Revisa', 'Elige la unidad en "Unidad a revisar" para ver y, si hace falta, corregir sus hojas.'),
        P(2, 'Marca Validado', 'Con el botón de la barra. Cada corrección que hagas queda auditada y la unidad la ve para aceptarla.'),
        P(3, 'Si no cuadra', 'Corrige el lado que esté mal (SIS-06-P, Movimiento o Influenza). Solo la jurisdicción o la administración pueden validar con excepción cuando la diferencia es legítima: piden el motivo y queda auditado.'),
        N('Cuando todas las unidades de un municipio están validadas (y paloteo y Movimiento siguen cuadrando) se habilitan el CSV oficial, el ZIP de Excel y la carga a indicadores. Si después corriges algo y ese municipio ya estaba en indicadores, se actualiza solo.')
      ]
    },
    csv: {
      titulo: 'CSV del municipio',
      subtitulo: 'Solo existe concentrado a nivel municipal.',
      bloques: [
        I('description', '#7c3aed', 'Qué contiene', 'Una fila por clave SIS de cada unidad del municipio (CLUES, clave, mes, año y valor), en el mismo formato que ya acepta el panel RDA.'),
        I('exposure_zero', '#64748b', 'Ceros', 'Una unidad que aún no captura aparece con valor 0; se va llenando sola conforme las unidades guardan.'),
        N('La unidad no tiene CSV: su entregable es el Excel oficial del SINBA-SIS, una vez validado.')
      ]
    },

    // ------------------------------------------------- Concentrado jurisdiccional
    jur: {
      titulo: 'Concentrado jurisdiccional',
      subtitulo: 'La suma de los municipios y hospitales. Tú vigilas el cierre, revisas los avisos y emites el informe.',
      bloques: [
        T('Cómo se arma'),
        I('account_tree', '#0284c7', 'Unidades → municipio → jurisdicción', 'Cada unidad cierra su Movimiento al enviar su SINBA-SIS. Cada municipio es la suma de sus unidades, y la jurisdicción es la suma de los municipios y hospitales. Nadie captura aquí: todo se suma solo.'),
        I('visibility', '#64748b', 'Las unidades son solo consulta', 'El trabajo de validar el SINBA-SIS de cada unidad es del municipio. Tú ves municipios; las unidades solo aparecen cuando necesitas el detalle.'),
        T('Los cuatro pasos'),
        P(1, 'Municipios', 'Ves si cada municipio y hospital ya cerró. Uno cierra cuando cierran todas sus unidades.'),
        P(2, 'Por revisar', 'Lo que el concentrado detecta al sumar. Cada aviso dice qué pasa, quién lo resuelve y qué hacer.'),
        P(3, 'Concentrado', 'La suma por biológico y lote. "Ver por municipio" abre qué aportó cada municipio.'),
        P(4, 'Informe', 'Una lista te dice si falta algo; generas el informe del mes y descargas el Excel o el PDF.'),
        N('Desde octubre de 2026 el concentrado suma cada unidad (CLUES) agrupada por municipio; antes sumaba el Movimiento de cada municipio y hospital. El sistema toma el criterio correcto según el mes. Los hospitales (NHG y HENM) los valida la jurisdicción: su tarjeta tiene un botón para revisarlos.')
      ]
    },
    jur_validaciones: {
      titulo: 'Paso 2 · Por revisar',
      subtitulo: 'Lo que el concentrado detecta al sumar.',
      bloques: [
        T('Cómo leer un aviso'),
        I('help', '#0284c7', 'Qué pasa', 'La situación concreta: qué lote, en qué municipio y con qué cifra.'),
        I('person', '#d97706', 'Quién lo resuelve', 'Casi siempre es el municipio o la unidad; la jurisdicción no tiene que corregir nada.'),
        I('checklist', '#16a34a', 'Qué hacer', 'El paso siguiente, dicho en una frase.'),
        T('Los tipos de aviso'),
        I('remove_circle', '#ba1a1a', 'Existencia negativa (error)', 'Se dieron de baja más frascos de los que había.'),
        I('event_busy', '#d97706', 'Caducidades distintas', 'El mismo lote tiene fechas diferentes.'),
        I('hourglass_bottom', '#d97706', 'Lote en dictamen sin resolver', 'Lleva 3 meses o más en A.R.F. o canje con existencia.'),
        I('lock_open', '#64748b', 'Unidades sin cerrar', 'No es un aviso: solo indica que el concentrado es provisional. Queda plegado al final, como consulta.'),
        N('"Ver el lote" te lleva al detalle de ese lote por municipio, con la explicación a la vista.')
      ]
    },
    jur_concentrado: {
      titulo: 'Paso 3 · Concentrado',
      subtitulo: 'La suma de todos los municipios y hospitales, por biológico y lote.',
      bloques: [
        T('Cómo leerlo'),
        I('palette', '#0284c7', 'Un biológico a la vez', 'Los botones de color filtran; "Solo con avisos" deja únicamente los lotes que tienen algo por revisar.'),
        I('sell', '#f59e0b', 'Provisional', 'Al menos una unidad de ese lote todavía no cierra: el número puede cambiar.'),
        I('groups', '#64748b', 'Cierre', 'Cuántas de las unidades que reportan ese lote ya cerraron.'),
        T('El detalle de un lote'),
        P(1, 'Ver por municipio', 'Cada renglón es un municipio u hospital, con lo que aportó a ese lote. Solo aparecen los que lo reportaron.'),
        P(2, 'Ver unidades', 'Si un municipio tiene varias unidades, puedes abrirlas como consulta.'),
        N('"Corregir" es de uso excepcional: reabre un renglón con motivo obligatorio y queda auditado. Lo normal es que lo corrija el municipio. Quien solo consulta (visualizador) no lo ve.')
      ]
    },
    jur_informe: {
      titulo: 'Paso 4 · Informe',
      subtitulo: 'Lo último del mes.',
      bloques: [
        T('La lista'),
        I('lock', '#16a34a', 'Municipios cerrados', 'El informe suma solo lo que ya cerró. Si falta alguno, te pregunta antes de generarlo.'),
        I('rule', '#d97706', 'Errores y avisos', 'Lo ideal es generarlo sin errores pendientes.'),
        T('Los entregables'),
        I('summarize', '#7c3aed', 'Informe del mes', 'Es la constancia del mes: guarda una foto del concentrado con quién la generó y cuándo, y no descarga archivos. Si se corrige algo después, se marca como desactualizada y puedes generar otra.'),
        I('download', '#0284c7', 'Excel y PDF', 'El Excel usa el formato oficial de Movimiento de Biológico; el PDF sirve para archivar o imprimir.')
      ]
    },

    // ------------------------------------------------------ Cierre del municipio
    municipal: {
      titulo: 'Cierre mensual del municipio',
      subtitulo: 'Cuatro pasos, en el orden en que se hace: ver quién envió, revisar, comprobar el concentrado y entregar.',
      bloques: [
        T('Los cuatro pasos'),
        P(1, 'Envíos', 'Ves qué unidades ya enviaron su SINBA-SIS y cuáles faltan. Tocas una unidad para revisarla.'),
        P(2, 'Revisión', 'Unidad por unidad: sus cuatro hojas, con anterior/siguiente. Cuando todo cuadra la validas y pasas a la siguiente.'),
        P(3, 'Concentrado', 'Lo que se arma solo con tus unidades: conciliación, paloteo del municipio, seguimiento de biológico y recibido contra requisición.'),
        P(4, 'Entrega', 'Una lista te dice si algo quedó pendiente y, con todo validado, descargas el CSV oficial para estadística.'),
        T('Los puntos de avance'),
        I('radio_button_unchecked', '#94a3b8', 'Gris · sin enviar', 'La unidad todavía no envía su SINBA-SIS. Puedes ver lo que lleva capturado.'),
        I('timelapse', '#f59e0b', 'Ámbar · por validar', 'Ya envió y espera tu revisión.'),
        I('check_circle', '#16a34a', 'Verde · validada', 'Ya la validaste. Un punto es una unidad: tócalo para abrirla.'),
        T('Para ir más rápido'),
        I('skip_next', '#0284c7', 'Siguiente por validar', 'Te lleva a la próxima unidad que espera tu revisión, sin volver a la lista.'),
        I('auto_awesome', '#d97706', 'Al validar, pasa sola', 'Cuando validas una unidad, se abre la siguiente por validar.'),
        N('Los tres círculos de arriba también son botones. Las hojas de cada unidad funcionan igual que siempre: lo que cambia es el orden en que llegas a ellas.')
      ]
    },
    mun_revision: {
      titulo: 'Paso 2 · Revisión de la unidad',
      subtitulo: 'Revisas lo que la unidad envió y, si todo cuadra, la validas.',
      bloques: [
        T('Qué revisar'),
        I('summarize', '#0284c7', 'SIS-06-P', 'El paloteo del mes. Si hay algo que corregir puedes editarlo: cada corrección queda auditada y la unidad la ve para aceptarla.'),
        I('inventory_2', '#d97706', 'Movimiento', 'Lotes recibidos, aplicados y desechados. Lo aplicado debe ser igual al paloteo; la píldora te avisa cuántos biológicos no coinciden.'),
        I('table_view', '#16a34a', 'SIS-SS-CE-H e Influenza', 'Se arman solas (solo lectura). Sirven para comprobar que las claves salieron bien.'),
        T('Validar'),
        P(1, 'Concilia', 'No se puede validar mientras el paloteo y el Movimiento no coincidan.'),
        P(2, 'Valida', 'Con el botón Validar de la barra de abajo. Se abre sola la siguiente unidad por validar.'),
        N('Puedes moverte entre unidades con las flechas, con la lista o tocando su punto. Si hay cambios sin guardar te pregunto antes de salir.')
      ]
    },
    mun_concentrado: {
      titulo: 'Paso 3 · Concentrado del municipio',
      subtitulo: 'Tres cosas, en orden: verificar, dejar listo el Movimiento del municipio y descargar tus archivos.',
      bloques: [
        T('Las tres tarjetas'),
        P(1, 'Verifica que cuadre', 'Paloteo contra Movimiento, unidad por unidad (solo aparecen las que difieren), y lo recibido contra la requisición. La requisición es informativa: no bloquea.'),
        P(2, 'Movimiento de Biológico (BIOVAC)', 'El Movimiento del propio municipio, por lote y caducidad. Hasta septiembre 2026 se captura a mano aquí; desde octubre se arma solo con lo que envían tus unidades y lo ajustas en recibido, aplicadas y desechadas. Un aviso te dice dónde no cuadra con tus unidades (existencia anterior distinta, ajustes a mano, una unidad que cambió después…).'),
        P(3, 'Descarga tus archivos', 'Excel del concentrado (PALOTEO, SEGUIMIENTO DE BIOLÓGICO, CSV y recibido vs. requisición), Excel BIOVAC y CSV oficial: cada uno con su botón en la misma tarjeta.'),
        T('Guardar y cerrar el mes (Movimiento)'),
        I('save', '#0284c7', 'Guardar', 'Cada celda se guarda sola al salir de ella. El botón Guardar solo lo confirma.'),
        I('lock', '#7c3aed', 'Cerrar mes', 'Da el mes por terminado: lo bloquea y pasa la existencia final al mes siguiente. Si hay que cambiar algo, se reabre con un motivo y el cambio se recalcula en los meses siguientes.'),
        N('El municipio nunca se queda con vacuna: si algo no coincide con la requisición, revisa el recibido de la unidad.')
      ]
    },
    mun_entrega: {
      titulo: 'Paso 4 · Entrega',
      subtitulo: 'Lo último del mes: comprobar que no falta nada y descargar el archivo para estadística.',
      bloques: [
        T('La lista'),
        I('check_circle', '#16a34a', 'Todas validadas', 'El CSV oficial solo se habilita cuando todas las unidades del municipio están validadas.'),
        I('compare_arrows', '#d97706', 'Paloteo y Movimiento', 'Ninguna unidad debe tener diferencias.'),
        I('info', '#0284c7', 'Recibido vs. requisición', 'Es informativo: te avisa, pero no bloquea la descarga.'),
        T('Los archivos'),
        I('outbox', '#7c3aed', 'CSV oficial', 'El que se sube al departamento de estadística: CLUES, variable, valor, mes, año y municipio.'),
        I('description', '#64748b', 'CSV del panel RDA', 'Abajo queda la vista previa del CSV para el panel RDA de SIREVAQ. Es otro formato: no lo mandes a estadística.')
      ]
    },

    // ------------------------------------------------------------- Requisiciones
    requi_pegar: {
      titulo: 'Pegar lo surtido desde Excel',
      subtitulo: 'Copias en Excel, pegas aquí y revisas antes de importar.',
      bloques: [
        T('Qué puedes pegar'),
        I('table_chart', '#0284c7', 'Columnas en cualquier orden', 'Biológico (nombre, abreviatura como SRP, o clave), lote, caducidad (FEB-27, 02/27…) y cantidad. Los encabezados se ignoran.'),
        I('vaccines', '#7c3aed', 'Sin columna de biológico', 'Elige el biológico en la lista de arriba: se usará en todas las filas que no lo traigan.'),
        T('Cómo leer la vista previa'),
        I('fiber_new', '#1d4ed8', 'Nuevo', 'Un lote que no existía: se registra.'),
        I('check_circle', '#16a34a', 'Lote conocido', 'Ya existía; solo se agrega a esta requisición.'),
        I('sync', '#d97706', 'Reemplaza N', 'Ya estaba capturado en este mes: se cambia la cantidad.'),
        I('help', '#d97706', '¿"lote"?', 'Se parece mucho a otro ya registrado (¿error de captura?). Viene desmarcado: márcalo si de verdad es distinto.'),
        N('Nada se guarda hasta que presiones Importar. Las filas con problema se omiten y puedes desmarcar las que no quieras.')
      ]
    }
  };

  function htmlBloques(bloques) {
    return (bloques || []).map((b) => {
      if (b.tipo === 'titulo') return `<div class="ayuda-tit">${esc(b.texto)}</div>`;
      if (b.tipo === 'item') return `<div class="ayuda-item"><span class="material-symbols-rounded" style="color:${esc(b.color)};">${esc(b.icono)}</span><div><b>${esc(b.nombre)}</b><span class="t">${esc(b.texto)}</span>${b.donde ? `<span class="ayuda-donde"><span class="material-symbols-rounded">near_me</span>${esc(b.donde)}</span>` : ''}</div></div>`;
      if (b.tipo === 'paso') return `<div class="ayuda-paso"><span class="ayuda-num">${esc(b.n)}</span><div><b>${esc(b.nombre)}.</b><span class="t">${esc(b.texto)}</span></div></div>`;
      if (b.tipo === 'nota') return `<div class="ayuda-nota">${esc(b.texto)}</div>`;
      return '';
    }).join('');
  }

  // Las guías por pasos (guias_contenido.js) tienen prioridad sobre la ayuda corta del mismo nombre.
  function definicion(clave) {
    const G = window.GuiasContenido;
    return (G && G[clave]) || CONTENIDO[clave] || null;
  }

  let retorno = null;
  let actual = null;      // { clave, def, i }
  let avisoTimer = null;

  function crearDom() {
    if (document.getElementById('ayudaOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'ayudaOverlay';
    ov.className = 'ayuda-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = `
      <div class="ayuda-hoja" role="dialog" aria-modal="true" aria-labelledby="ayudaTitulo">
        <div class="ayuda-asa"></div>
        <div class="ayuda-cab">
          <div style="min-width:0;"><h3 id="ayudaTitulo"></h3><p id="ayudaSub" aria-live="polite"></p></div>
          <button type="button" class="ayuda-cerrar" id="ayudaCerrarX" title="Cerrar" aria-label="Cerrar"><span class="material-symbols-rounded">close</span></button>
        </div>
        <div class="ayuda-prog" id="ayudaProg" hidden><i id="ayudaProgRelleno"></i></div>
        <div class="ayuda-cuerpo" id="ayudaCuerpo" tabindex="0" role="region" aria-labelledby="ayudaTitulo"></div>
        <div class="ayuda-pie">
          <div class="ayuda-extras" id="ayudaExtras"></div>
          <div class="ayuda-puntos" id="ayudaPuntos" role="group" aria-label="Pasos de la guía"></div>
          <div class="ayuda-acciones">
            <button type="button" class="ayuda-sec" id="ayudaAnt">Anterior</button>
            <button type="button" id="ayudaCerrarBtn">Entendido</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (ev) => { if (ev.target === ov) cerrar(); });
    document.getElementById('ayudaCerrarX').addEventListener('click', cerrar);
    document.getElementById('ayudaAnt').addEventListener('click', () => irAPaso(actual.i - 1));
    document.getElementById('ayudaCerrarBtn').addEventListener('click', () => {
      if (actual && actual.def.pasos && actual.i < actual.def.pasos.length - 1) irAPaso(actual.i + 1);
      else cerrar();
    });
    document.getElementById('ayudaPuntos').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-paso]');
      if (b) irAPaso(Number(b.dataset.paso));
    });
    document.getElementById('ayudaExtras').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-accion]');
      if (!b || !actual) return;
      if (b.dataset.accion === 'compartir') compartir(actual.def);
      else if (b.dataset.accion === 'novedades') abrir('novedades');
    });
  }

  function avisar(texto) {
    const el = document.getElementById('ayudaAviso');
    if (!el) return;
    el.textContent = texto;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { el.textContent = ''; }, 2600);
  }

  async function compartir(def) {
    const url = new URL(def.pagina || def.pdf || '', location.href).href;
    if (navigator.share) {
      try { await navigator.share({ title: def.titulo, text: def.subtitulo || '', url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); avisar('Enlace copiado'); }
    catch (e) { window.prompt('Copia este enlace:', url); }
  }

  // Pinta el paso actual (o la ayuda corta) y su pie.
  function pintar() {
    const { clave, def, i } = actual;
    const pasos = def.pasos;
    const cuerpo = document.getElementById('ayudaCuerpo');
    document.getElementById('ayudaTitulo').textContent = def.titulo;
    const prog = document.getElementById('ayudaProg');
    const puntos = document.getElementById('ayudaPuntos');
    const ant = document.getElementById('ayudaAnt');
    const prim = document.getElementById('ayudaCerrarBtn');
    if (pasos && pasos.length) {
      const n = pasos.length, paso = pasos[i];
      document.getElementById('ayudaSub').textContent = `Paso ${i + 1} de ${n} · ${paso.titulo}`;
      cuerpo.innerHTML = htmlBloques(paso.bloques);
      prog.hidden = false;
      document.getElementById('ayudaProgRelleno').style.width = ((i + 1) / n * 100).toFixed(1) + '%';
      puntos.innerHTML = pasos.map((p, k) => `<button type="button" class="ayuda-punto${k === i ? ' es-actual' : ''}${k < i ? ' es-hecho' : ''}" data-paso="${k}" aria-label="Ir al paso ${k + 1}: ${esc(p.titulo)}"${k === i ? ' aria-current="step"' : ''}></button>`).join('');
      puntos.hidden = false;
      ant.hidden = i === 0;
      prim.textContent = i < n - 1 ? 'Siguiente' : 'Entendido';
    } else {
      document.getElementById('ayudaSub').textContent = def.subtitulo || '';
      cuerpo.innerHTML = htmlBloques(def.bloques);
      prog.hidden = true;
      puntos.innerHTML = ''; puntos.hidden = true;
      ant.hidden = true;
      prim.textContent = 'Entendido';
    }
    cuerpo.scrollTop = 0;
    // Pie: PDF y compartir (solo guías) y acceso a novedades desde cualquier guía
    const extras = document.getElementById('ayudaExtras');
    const partes = [];
    if (def.pdf) partes.push(`<a class="ayuda-enlace" href="${esc(def.pdf)}" download><span class="material-symbols-rounded" aria-hidden="true">download</span>PDF</a>`);
    if (def.pagina || def.pdf) partes.push(`<button type="button" class="ayuda-enlace" data-accion="compartir"><span class="material-symbols-rounded" aria-hidden="true">share</span>Compartir</button>`);
    if (pasos && clave !== 'novedades' && !def.sinNovedades && window.GuiasContenido && window.GuiasContenido.novedades) {
      partes.push(`<button type="button" class="ayuda-enlace" data-accion="novedades"><span class="material-symbols-rounded" aria-hidden="true">new_releases</span>Novedades</button>`);
    }
    extras.innerHTML = partes.join('') + '<span class="ayuda-aviso" id="ayudaAviso" role="status"></span>';
  }

  function irAPaso(i) {
    if (!actual || !actual.def.pasos) return;
    const n = actual.def.pasos.length;
    actual.i = Math.max(0, Math.min(n - 1, i));
    pintar();
    document.getElementById('ayudaCerrarBtn').focus();
  }

  function abrir(clave, paso) {
    const def = definicion(clave);
    if (!def) { console.warn('[Ayuda] Sin contenido para', clave); return; }
    crearDom();
    const ov = document.getElementById('ayudaOverlay');
    const yaAbierto = ov.classList.contains('abierto');
    actual = { clave, def, i: Math.max(0, Math.min((def.pasos ? def.pasos.length : 1) - 1, paso || 0)) };
    pintar();
    if (!yaAbierto) retorno = document.activeElement;
    ov.classList.add('abierto');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById(def.pasos ? 'ayudaCerrarBtn' : 'ayudaCerrarX').focus();
  }

  function cerrar() {
    const ov = document.getElementById('ayudaOverlay');
    if (!ov || !ov.classList.contains('abierto')) return;
    ov.classList.remove('abierto');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (retorno && typeof retorno.focus === 'function') retorno.focus();
    retorno = null;
    actual = null;
  }

  // «¿Qué hay de nuevo?» se muestra UNA vez por versión de novedades y por navegador.
  function novedadesUnaVez() {
    const g = window.GuiasContenido && window.GuiasContenido.novedades;
    if (!g) return false;
    const llave = 'sirevaq_novedades_visto';
    let visto = null;
    try { visto = localStorage.getItem(llave); } catch (e) { /* sin almacenamiento: se muestra */ }
    if (visto === g.version) return false;
    const ov = document.getElementById('ayudaOverlay');
    if (ov && ov.classList.contains('abierto')) return false;
    try { localStorage.setItem(llave, g.version); } catch (e) { /* ignorar */ }
    abrir('novedades');
    return true;
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-ayuda]');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    abrir(b.dataset.ayuda, Number(b.dataset.ayudaPaso) || 0);
  });
  document.addEventListener('keydown', (ev) => {
    const ov = document.getElementById('ayudaOverlay');
    if (!ov || !ov.classList.contains('abierto')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); cerrar(); return; }
    // Guías por pasos: flechas para avanzar y retroceder
    if (actual && actual.def.pasos && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      ev.preventDefault();
      irAPaso(actual.i + (ev.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    // El diálogo es modal: el foco da la vuelta entre sus controles y no se escapa a la página de atrás.
    if (ev.key === 'Tab') {
      const f = [...ov.querySelectorAll('button, a[href], [tabindex="0"]')].filter((e) => !e.disabled && !e.hidden && e.offsetParent !== null);
      if (!f.length) return;
      const primero = f[0], ultimo = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === primero || !ov.contains(document.activeElement))) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && (document.activeElement === ultimo || !ov.contains(document.activeElement))) { ev.preventDefault(); primero.focus(); }
    }
  });

  window.Ayuda = { abrir, cerrar, contenido: CONTENIDO, novedadesUnaVez };
})();
