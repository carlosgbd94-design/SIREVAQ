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

    // ------------------------------------------------------------- Requisiciones
    requi: {
      titulo: 'Requisiciones de biológicos',
      subtitulo: 'De la Jurisdicción a los municipios y hospitales, y de ahí a las unidades.',
      bloques: [
        T('Los tres pasos'),
        P(1, 'Lo surtido', 'Capturas lo que llegó del almacén estatal, lote por lote.'),
        P(2, 'Reparto a municipios y hospitales', 'Repartes cada lote entre los destinos.'),
        P(3, 'Reparto a unidades', 'Cada municipio reparte lo suyo entre sus unidades.'),
        T('El mes'),
        I('save', '#0284c7', 'Guardar', 'Crea la requisición del mes si todavía no existe; hasta entonces no aparecen los pasos.'),
        I('lock', '#0f172a', 'Cerrar mes', 'La marca como enviada. Puedes seguir editando después; quedará "corregida posteriormente" para que municipios y unidades lo sepan.'),
        I('history', '#64748b', 'Historial y exportar', 'El reloj abre las requisiciones de otros meses; Exportar genera los archivos oficiales por destino.'),
        N('Cada unidad recibe lo que le repartas como precarga en su Movimiento de Biológico.')
      ]
    },
    requi1: {
      titulo: 'Paso 1 · Lo surtido',
      subtitulo: 'Lo que llegó del almacén estatal.',
      bloques: [
        P(1, 'Elige un biológico', 'Da clic en su renglón para ver o agregar los lotes recibidos, sin límite de lotes.'),
        P(2, 'Captura el lote', 'Número de lote, caducidad y cantidad surtida. El comparador te avisa si el lote ya existe o parece un error de captura antes de guardarlo.'),
        I('edit', '#0284c7', 'Clave de artículo', 'El lápiz junto al biológico edita su clave sin salir del renglón.'),
        N('Un lote no se puede cambiar de biológico una vez capturado (quítalo y vuélvelo a agregar), ni bajar su cantidad por debajo de lo que ya repartiste.')
      ]
    },
    requi2: {
      titulo: 'Paso 2 · Municipios y hospitales',
      subtitulo: 'Cada hospital es su propio destino, igual que un municipio.',
      bloques: [
        P(1, 'Elige biológico y lote', 'Solo aparecen los lotes que ya capturaste en el paso 1.'),
        P(2, 'Reparte', 'Captura la cantidad de cada destino; se guarda al salir del campo.'),
        I('analytics', '#d97706', 'Saldo', 'Disponible − ya repartido. Verde: alcanza; ámbar: queda menos del 20 %; rojo: agotado.'),
        N('El sistema rechaza repartir más de lo surtido de ese lote.')
      ]
    },
    requi3: {
      titulo: 'Paso 3 · Unidades',
      subtitulo: 'Cómo reparte cada municipio lo que recibió.',
      bloques: [
        P(1, 'Elige municipio, biológico y lote', 'Solo salen los lotes que ese municipio tiene asignados en el paso 2.'),
        P(2, 'Reparte por unidad', 'Captura la cantidad de cada unidad. Las que ya tienen algo asignado se marcan en verde para ubicarlas rápido.'),
        N('El reparto entre unidades no puede exceder lo asignado al municipio. Esa cantidad llega a cada unidad como precarga en su Movimiento.')
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
