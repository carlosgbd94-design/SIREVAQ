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
        P(1, 'Captura', 'Puedes ir prellenando desde una semana antes de cerrar el mes. Guarda con el botón de la barra de abajo.'),
        P(2, 'Concilia', 'Las dosis aplicadas del paloteo y las del Movimiento deben coincidir, biológico por biológico. Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT) usa el comodín de sustitución.'),
        P(3, 'Envía', 'Solo del último día del mes a la semana siguiente. Al enviar, todo el archivo se bloquea, incluida Influenza.'),
        P(4, 'Validación', 'El municipal revisa; si corrige algo, tú ves cada cambio y lo aceptas. Ya validado puedes exportar el Excel oficial e imprimir.')
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
        N('Después de enviar esta hoja se bloquea. Si el municipal corrige algo, te aparece cada cambio para que lo aceptes.')
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
        N('Lo recibido puede llegar precargado desde la requisición de la Jurisdicción; puedes editarlo si algo cambió. Al enviar el SINBA-SIS, el Movimiento se cierra solo.')
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
        I('sync_alt', '#C26750', 'Meta-Logro', 'Cada jueves o viernes reportas la semana en Meta-Logro, donde se valida contra tu meta. Aquí aparece solo; no hay nada que copiar ni capturar dos veces.'),
        I('calendar_view_week', '#0284c7', 'Semanas', 'Cada reporte corresponde a un viernes; el mes cuenta los viernes que caen en él (hasta 5). Una semana "sin movimiento" también cuenta como reportada.'),
        I('science', '#16a34a', 'Frascos', 'El total en frascos es el total de dosis entre 10 (10 dosis por frasco).'),
        T('Cómo usarla'),
        P(1, 'Revisa', 'En pantallas angostas elige una semana arriba para verla completa; toca una fila para ver su desglose semanal.'),
        P(2, 'Concilia', 'Lo aplicado de Antiinfluenza en Movimiento debe ser igual al total de aquí. Si no, "Ir a Movimiento" te lleva y "Usar este total aquí" lo pasa al lote.'),
        P(3, 'Corrige', '"Editar semanas en Meta-Logro" guarda tu SIS-06-P y te lleva al panel de Influenza.'),
        N('Al enviar el SINBA-SIS, Influenza de ese mes queda congelada para la unidad; si hay que corregirla, lo hace el municipal.')
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
        N('Cuando todas las unidades de un municipio están validadas se habilita el CSV oficial de ese municipio.')
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
      subtitulo: 'Se arma solo con lo que cierran las unidades. Tú vigilas, atiendes lo que no cuadra y emites el informe.',
      bloques: [
        T('Los cuatro pasos'),
        P(1, 'Cierre', 'Ves cuántos municipios, hospitales y unidades ya cerraron su Movimiento del mes. El concentrado suma cada uno en cuanto cierra.'),
        P(2, 'Validaciones', 'El propio concentrado te avisa lo que no cuadra: existencias negativas, caducidades distintas, lotes en A.R.F. sin resolver y unidades sin cerrar.'),
        P(3, 'Concentrado', 'La suma por biológico y lote. Abres el detalle por unidad y, si algo está mal, lo corriges en su origen con un motivo.'),
        P(4, 'Informe', 'Una lista te dice si falta algo; generas el informe del mes y descargas el Excel o el PDF.'),
        T('Los puntos de avance'),
        I('radio_button_unchecked', '#94a3b8', 'Gris · sin movimiento', 'La unidad todavía no abre su Movimiento de este mes.'),
        I('timelapse', '#f59e0b', 'Ámbar · en captura o corrección', 'Tiene el Movimiento abierto: lo que lleva se ve como provisional.'),
        I('check_circle', '#16a34a', 'Verde · cerrado', 'Ya cerró: su número es definitivo en el concentrado.'),
        N('Desde octubre de 2026 el concentrado suma cada unidad (CLUES); antes sumaba el Movimiento de cada municipio y hospital. Tú no tienes que elegirlo: el sistema toma el criterio correcto según el mes.')
      ]
    },
    jur_validaciones: {
      titulo: 'Paso 2 · Validaciones',
      subtitulo: 'Lo que el concentrado detecta por sí mismo.',
      bloques: [
        T('Qué significa cada aviso'),
        I('remove_circle', '#ba1a1a', 'Existencia negativa (error)', 'Una unidad dio de baja más de lo que tenía. Hay que corregir ese renglón.'),
        I('event_busy', '#d97706', 'Caducidades distintas', 'El mismo lote tiene fechas diferentes en unidades distintas: una está mal.'),
        I('hourglass_bottom', '#d97706', 'A.R.F. o canje sin resolver', 'Lleva 3 meses o más con existencia sin resolver.'),
        I('lock_open', '#64748b', 'Unidades sin cerrar', 'No es un error: el concentrado es provisional y se completa solo cuando cierren.'),
        T('Qué hacer'),
        P(1, 'Ver en el concentrado', 'El botón de cada aviso te lleva al lote con su detalle por unidad ya abierto.'),
        P(2, 'Corregir en el origen', 'Con "Corregir aquí" editas el renglón de la unidad; escribes el motivo y queda auditado.'),
        N('Las correcciones se propagan a los meses siguientes de esa unidad y ella recibe el aviso para revisarlas.')
      ]
    },
    jur_concentrado: {
      titulo: 'Paso 3 · Concentrado',
      subtitulo: 'La suma en vivo de las unidades, por biológico y lote.',
      bloques: [
        T('Cómo leerlo'),
        I('palette', '#0284c7', 'Un biológico a la vez', 'Los botones de color filtran; "Solo con alertas" deja únicamente los lotes con algo que revisar.'),
        I('sell', '#f59e0b', 'Provisional', 'Al menos una unidad de ese lote todavía no cierra: el número puede cambiar.'),
        I('groups', '#64748b', 'Unidades', 'Cuántas unidades ya cerraron de las que reportan ese lote.'),
        T('Corregir'),
        P(1, 'Ver', 'Abre el detalle del lote por unidad.'),
        P(2, 'Corregir aquí', 'Solo en unidades ya cerradas: reabre su renglón. Escribes el motivo, editas y guardas.'),
        N('Quien solo consulta (visualizador) ve todo el concentrado pero no puede corregir.')
      ]
    },
    jur_informe: {
      titulo: 'Paso 4 · Informe',
      subtitulo: 'Lo último del mes.',
      bloques: [
        T('La lista'),
        I('lock', '#16a34a', 'Movimientos cerrados', 'El informe suma solo lo que ya cerró. Si faltan, te pregunta antes de generarlo.'),
        I('rule', '#d97706', 'Errores y advertencias', 'Lo ideal es generar el informe sin errores pendientes.'),
        T('Los entregables'),
        I('summarize', '#7c3aed', 'Informe del mes', 'Una foto del concentrado, con quién la generó y cuándo. Puedes generar otro si algo cambia después.'),
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
      subtitulo: 'Se arma solo con lo que capturan las unidades: aquí no se captura nada.',
      bloques: [
        T('Qué encuentras'),
        I('compare_arrows', '#d97706', 'Conciliación', 'Solo aparecen las unidades donde el paloteo y el Movimiento no coinciden, con los biológicos que difieren.'),
        I('local_shipping', '#0284c7', 'Recibido: requisición vs. unidades', 'Lo que la Jurisdicción repartió al municipio debe ser igual a lo que las unidades capturaron como recibido. Es informativo: no bloquea.'),
        I('table_chart', '#16a34a', 'Paloteo y seguimiento de biológico', 'Una columna por unidad y el total del municipio. Puedes descargar todo en un Excel.'),
        I('inventory_2', '#7c3aed', 'Movimiento del municipio', 'El botón de arriba abre el Movimiento del propio municipio; desde octubre ya no se captura, es la suma de las unidades.'),
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
    requi: {
      titulo: 'Requisiciones de biológicos',
      subtitulo: 'De la Jurisdicción a los municipios y hospitales, y de ahí a las unidades. Tres pasos, en orden.',
      bloques: [
        T('El recorrido'),
        P(1, 'Lo surtido', 'Registras lo que llegó del almacén estatal, lote por lote. Lo tecleas rápido o lo pegas desde Excel.'),
        P(2, 'Municipios y hospitales', 'Una tabla: un renglón por lote y una columna por destino. Repartes todo el lote.'),
        P(3, 'Unidades', 'Eliges el municipio y repartes cada lote entre sus unidades de salud.'),
        T('Los puntos de avance'),
        I('radio_button_unchecked', '#94a3b8', 'Gris · sin empezar', 'Ese lote todavía no tiene reparto.'),
        I('timelapse', '#f59e0b', 'Ámbar · en proceso', 'Ya tiene reparto, pero aún queda saldo por repartir.'),
        I('check_circle', '#16a34a', 'Verde · completo', 'No queda saldo. Si dejas algo sin repartir a propósito se queda ámbar y no pasa nada: solo te lo recordamos al cerrar el mes.'),
        I('touch_app', '#0284c7', 'Toca un punto', 'Te lleva directo a ese lote. Arriba, los tres círculos numerados muestran el avance de cada paso y también son botones.'),
        T('Para capturar más rápido'),
        I('keyboard', '#0284c7', 'Solo teclado', 'Enter baja al siguiente renglón y Tab avanza a la siguiente celda. Lo que escribes se guarda al salir de la celda.'),
        I('content_paste', '#7c3aed', 'Pegar desde Excel', 'En el paso 1 pega filas completas de lotes; en los pasos 2 y 3 pega un bloque de cantidades sobre la tabla y se acomoda solo.'),
        I('auto_fix_high', '#d97706', 'Sugerir según el mes anterior', 'Llena los lotes que aún no tienen reparto con la misma proporción del mes pasado. Nunca toca lo que ya capturaste y después ajustas lo que haga falta.'),
        I('ads_click', '#16a34a', 'Doble clic en una celda vacía', 'Pone todo el saldo que queda de ese lote.'),
        T('El mes'),
        I('save', '#0284c7', 'Crear requisición', 'Si el mes todavía no existe, aparece un botón para crearla; hasta entonces no hay pasos.'),
        I('lock', '#0f172a', 'Cerrar mes', 'La marca como enviada. Puedes seguir editando después; quedará "corregida posteriormente" para que municipios y unidades lo sepan.'),
        I('history', '#64748b', 'Historial y exportar', 'El reloj abre las requisiciones de otros meses; Exportar genera los archivos oficiales por destino.'),
        N('Cada unidad recibe lo que le repartas como precarga en su Movimiento de Biológico.')
      ]
    },
    requi1: {
      titulo: 'Paso 1 · Lo surtido',
      subtitulo: 'Lo que llegó del almacén estatal, capturado sin soltar el teclado.',
      bloques: [
        T('Captura rápida'),
        P(1, 'Elige el biológico', 'Toca su botón de color (o su renglón en la tabla). El recuadro gris confirma qué estás capturando.'),
        P(2, 'Lote, caducidad, cantidad', 'Escribe el lote y presiona Enter. Si el lote ya lo conocía el sistema, la caducidad aparece sola y Enter te manda directo a la cantidad.'),
        P(3, 'Enter guarda y sigue', 'Se guarda y regresas al campo Lote, listo para el siguiente lote del mismo biológico. Para cambiar de biológico toca otro botón.'),
        I('event', '#0284c7', 'Caducidad', 'Teclea solo números: 0227 se convierte en FEB-27. También entiende 02/27 o 28/02/2027.'),
        T('Muchos lotes de golpe'),
        I('content_paste', '#7c3aed', 'Pegar desde Excel', 'Copia las filas (biológico, lote, caducidad y cantidad) y pégalas en el campo Lote, o usa el botón de arriba. Antes de importar ves cómo se entendió cada fila.'),
        T('Revisar y corregir'),
        I('edit', '#0284c7', 'Lápiz del lote', 'Cambia su cantidad o caducidad sin salir del renglón. El lápiz junto a la clave edita la clave del biológico.'),
        I('rule', '#d97706', 'Comparador de lotes', 'Te avisa si el lote ya existe o si parece un error de captura (por ejemplo, una letra de más) antes de guardarlo.'),
        N('Un lote no se puede cambiar de biológico una vez capturado (quítalo y vuélvelo a agregar), ni bajar su cantidad por debajo de lo que ya repartiste.')
      ]
    },
    requi2: {
      titulo: 'Paso 2 · Municipios y hospitales',
      subtitulo: 'Cada hospital es su propio destino, igual que un municipio.',
      bloques: [
        T('Cómo se llena la tabla'),
        P(1, 'Ubica el lote', 'Un renglón por lote surtido, con el color de su biológico. Los botones de arriba filtran por biológico.'),
        P(2, 'Escribe la cantidad de cada destino', 'Tab avanza al siguiente destino y Enter baja al siguiente lote. Se guarda al salir de la celda.'),
        P(3, 'Revisa el saldo', 'La última columna dice cuánto queda por repartir: gris sin empezar, ámbar con saldo, verde completo.'),
        T('Atajos'),
        I('ads_click', '#16a34a', 'Doble clic en una celda vacía', 'Pone todo el saldo que queda de ese lote en ese destino.'),
        I('content_paste', '#7c3aed', 'Pegar un bloque', 'Copia un rango de Excel y pégalo en cualquier celda: se acomoda hacia abajo y a la derecha desde ahí.'),
        I('auto_fix_high', '#d97706', 'Sugerir según el mes anterior', 'Reparte los lotes vacíos con la proporción con que repartiste ese biológico el mes pasado. No toca lo que ya tiene reparto.'),
        N('El sistema rechaza repartir más de lo surtido de ese lote, y no te deja bajar a un municipio por debajo de lo que ya repartió entre sus unidades.')
      ]
    },
    requi3: {
      titulo: 'Paso 3 · Unidades',
      subtitulo: 'Cómo reparte cada municipio lo que recibió.',
      bloques: [
        T('Cómo se llena la tabla'),
        P(1, 'Elige el municipio', 'Cada botón muestra cuántos de sus lotes ya quedaron completos. Solo salen los lotes que ese municipio tiene asignados en el paso 2.'),
        P(2, 'Escribe por unidad', 'Un renglón por unidad y una columna por lote; arriba de cada columna ves el saldo. Tab avanza al siguiente lote y Enter baja a la siguiente unidad.'),
        T('Atajos'),
        I('ads_click', '#16a34a', 'Doble clic en una celda vacía', 'Pone todo el saldo que queda de ese lote en esa unidad.'),
        I('content_paste', '#7c3aed', 'Pegar un bloque', 'Copia un rango de Excel (unidades × lotes) y pégalo en cualquier celda.'),
        I('auto_fix_high', '#d97706', 'Sugerir según el mes anterior', 'Reparte los lotes vacíos del municipio con la misma proporción por unidad del mes pasado.'),
        I('download', '#0284c7', 'Descargar', 'El ícono al final de cada renglón exporta el Excel oficial de esa unidad.'),
        N('El reparto entre unidades no puede exceder lo asignado al municipio. Esa cantidad llega a cada unidad como precarga en su Movimiento.')
      ]
    },
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

  function html(def) {
    return def.bloques.map((b) => {
      if (b.tipo === 'titulo') return `<div class="ayuda-tit">${esc(b.texto)}</div>`;
      if (b.tipo === 'item') return `<div class="ayuda-item"><span class="material-symbols-rounded" style="color:${esc(b.color)};">${esc(b.icono)}</span><div><b>${esc(b.nombre)}</b><span class="t">${esc(b.texto)}</span></div></div>`;
      if (b.tipo === 'paso') return `<div class="ayuda-paso"><span class="ayuda-num">${esc(b.n)}</span><div><b>${esc(b.nombre)}.</b><span class="t">${esc(b.texto)}</span></div></div>`;
      if (b.tipo === 'nota') return `<div class="ayuda-nota">${esc(b.texto)}</div>`;
      return '';
    }).join('');
  }

  let retorno = null;

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
          <div style="min-width:0;"><h3 id="ayudaTitulo"></h3><p id="ayudaSub"></p></div>
          <button type="button" class="ayuda-cerrar" id="ayudaCerrarX" title="Cerrar" aria-label="Cerrar"><span class="material-symbols-rounded">close</span></button>
        </div>
        <div class="ayuda-cuerpo" id="ayudaCuerpo"></div>
        <div class="ayuda-pie"><button type="button" id="ayudaCerrarBtn">Entendido</button></div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (ev) => { if (ev.target === ov) cerrar(); });
    document.getElementById('ayudaCerrarX').addEventListener('click', cerrar);
    document.getElementById('ayudaCerrarBtn').addEventListener('click', cerrar);
  }

  function abrir(clave) {
    const def = CONTENIDO[clave];
    if (!def) { console.warn('[Ayuda] Sin contenido para', clave); return; }
    crearDom();
    document.getElementById('ayudaTitulo').textContent = def.titulo;
    document.getElementById('ayudaSub').textContent = def.subtitulo || '';
    const cuerpo = document.getElementById('ayudaCuerpo');
    cuerpo.innerHTML = html(def);
    cuerpo.scrollTop = 0;
    retorno = document.activeElement;
    const ov = document.getElementById('ayudaOverlay');
    ov.classList.add('abierto');
    ov.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.getElementById('ayudaCerrarX').focus();
  }

  function cerrar() {
    const ov = document.getElementById('ayudaOverlay');
    if (!ov || !ov.classList.contains('abierto')) return;
    ov.classList.remove('abierto');
    ov.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (retorno && typeof retorno.focus === 'function') retorno.focus();
    retorno = null;
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-ayuda]');
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    abrir(b.dataset.ayuda);
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(); });

  window.Ayuda = { abrir, cerrar, contenido: CONTENIDO };
})();
