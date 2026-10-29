/* Tutoriales animados del SINBA-SIS.
 *
 * Mini-películas de 6 a 8 pasos que muestran, con un cursor que se mueve y hace clic solo, cómo resolver los casos que más
 * dudas generan. La pantalla que se ve es una réplica de la real (usa las mismas clases y estilos de biovac.html), así que
 * siempre se parece a lo que la persona tiene enfrente.
 *
 *   Tutoriales.abrir('primer_mes')   · Tutoriales.menu()   · cualquier elemento con data-tutorial="clave"
 *
 * Cada paso: { texto, detalle?, cursor?: selector, clic?: true, tipear?: { sel, valor }, resalta?: selector, antes?(r), despues?(r), espera? }
 *   - antes: se aplica al entrar al paso (sin animación de cursor).
 *   - despues: el cambio que provoca el clic/escritura del paso. Al retroceder se re-aplica sin animación.
 * Con «reducir movimiento» activado en el sistema no se reproduce solo: se avanza con Siguiente.
 */
(function () {
  'use strict';

  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mov = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ESPERA = (ms) => new Promise((r) => setTimeout(r, ms));
  const ico = (n) => `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;

  // ------------------------------------------------------------------ piezas de la réplica
  const THEAD = `<thead><tr>
      <th style="text-align:left" scope="col">Lote</th><th scope="col">Caducidad</th>
      <th class="c-ant" scope="col"><span class="th-con-icono">${ico('inventory_2')}Existencia anterior</span></th>
      <th class="c-rec" scope="col"><span class="th-con-icono">${ico('move_to_inbox')}Recibido</span></th>
      <th class="c-apl" scope="col"><span class="th-con-icono">${ico('vaccines')}Dosis aplicadas</span></th>
      <th class="c-des" scope="col"><span class="th-con-icono">${ico('delete_sweep')}Dosis desechadas</span></th>
      <th class="c-fin" scope="col"><span class="th-con-icono">${ico('calculate')}Final</span></th>
      <th scope="col">Observaciones</th><th scope="col"><span class="sr-solo">Acciones</span></th></tr></thead>`;
  const COLGROUP = '<colgroup><col class="col-lote"><col class="col-caducidad"><col class="col-ant"><col class="col-dato"><col class="col-dato"><col class="col-dato"><col class="col-final"><col class="col-obs"><col class="col-accion"></colgroup>';

  function fila(o) {
    const rec = o.candado
      ? `<span class="recibido-requi"><span class="recibido-num">${o.rec}</span><span class="material-symbols-rounded recibido-candado" aria-hidden="true">lock</span></span>`
      : `<span>${o.rec}</span>`;
    const acciones = o.candado
      ? `<div class="acciones-fila"><button type="button" class="btn-fantasma" data-t="lapiz" tabindex="-1">${ico('edit')}</button><span class="nota-lote-requi">${ico('lock')}</span></div>`
      : `<div class="acciones-fila"><button type="button" class="btn-fantasma" tabindex="-1">${ico('edit')}</button><button type="button" class="btn-fantasma" tabindex="-1">${ico('delete')}</button></div>`;
    return `<tr data-t="${o.id}"${o.clase ? ` class="${o.clase}"` : ''}>
      <td><div class="lote-texto">${esc(o.lote)}${o.sinMover ? '' : `<button type="button" class="btn-resolver mover" data-t="mover-${o.id}" tabindex="-1">${ico('swap_horiz')} Mover</button>`}</div></td>
      <td><div class="caducidad-chip sem-ok"><span class="semaforo"></span>${o.cad}</div></td>
      <td class="col-anterior c-ant"><span class="ant-valor" data-t="ant-${o.id}" style="display:inline-block">${o.ant}</span></td>
      <td class="col-mov c-rec" data-t="rec-${o.id}">${rec}</td>
      <td class="col-mov c-apl"><input type="text" readonly tabindex="-1" data-t="apl-${o.id}" value="${o.apl}"></td>
      <td class="col-mov c-des"><input type="text" readonly tabindex="-1" value="${o.des}"></td>
      <td class="col-final c-fin"><span class="valor-final" data-t="fin-${o.id}">${o.fin}</span></td>
      <td><input type="text" readonly tabindex="-1" value="${esc(o.obs || '')}"></td>
      <td>${acciones}</td></tr>`;
  }

  function totales(id, ant, rec, apl, des, fin) {
    return `<tfoot><tr><td colspan="2">Total B.C.G. frasco multidosis</td><td data-t="${id}-ant">${ant}</td><td data-t="${id}-rec">${rec}</td><td data-t="${id}-apl">${apl}</td><td data-t="${id}-des">${des}</td><td><span class="valor-final" data-t="${id}-fin">${fin}</span></td><td colspan="2"></td></tr></tfoot>`;
  }

  function bloqueBCG(cuerpo, pie, extra) {
    return `<div class="bloque tut-bloque">
      <div class="bloque-titulo"><div class="bio-icon" style="background:rgba(14,165,233,.13);color:#0284c7;"><span class="material-symbols-rounded">medication_liquid</span></div>
        <div class="bio-meta"><h2>B.C.G. frasco multidosis</h2></div></div>
      <div class="tabla-wrap"><table class="renglones">${COLGROUP}${THEAD}<tbody data-t="cuerpo">${cuerpo}</tbody>${pie}</table></div>
      ${extra || ''}</div>`;
  }

  const sel = (valor, etiqueta, id) => `<div class="tut-select" data-t="${id}"><span>${esc(valor)}</span>${ico('expand_more')}<span class="tut-etq">${esc(etiqueta)}</span></div>`;

  function panelAgregar() {
    return `<button type="button" class="btn-agregar-lote" data-t="btn-agregar" tabindex="-1" aria-expanded="false">${ico('add_circle')} Agregar un lote que ya tenías de B.C.G. frasco multidosis</button>
      <div class="panel-agregar" data-t="panel-agregar">
        <p class="nota-panel-agregar">Solo para lo que te quedó del mes pasado. Lo que recibiste este mes ya está cargado desde Requisiciones; si es el mismo lote (dirá «lo recibiste este mes»), elígelo aquí: el botón cambia a «Añadir existencia anterior» y los frascos se suman a ese lote, sin duplicarlo.</p>
        <div class="tut-campos">
          <div class="tut-campo"><label>1. Estatus</label>${sel('Selecciona el Estatus…', 'Estatus', 'cat')}</div>
          <div class="tut-campo tut-ancho"><label>2. N° de lote</label>${sel('Primero elige el Estatus…', 'Lote', 'lote')}</div>
          <div class="tut-campo"><label>3. Cuántos frascos tenías</label><div class="tut-entrada" data-t="cant"><span>0</span></div></div>
        </div>
        <div class="alerta-lote-repetido info tut-aviso" data-t="aviso"><span class="material-symbols-rounded" aria-hidden="true">info</span>
          <div class="texto"><b>Este es el lote que recibiste este mes (30 frascos).</b> Sí se puede guardar: escribe cuántos frascos de este lote te quedaban del mes pasado y pulsa «Añadir existencia anterior». Se suman a su fila (resaltada arriba), no se crea otra.</div></div>
        <div class="acciones"><button type="button" class="btn-primario btn-mini" data-t="btn-confirmar" tabindex="-1">${ico('check')} <span data-t="txt-confirmar">Agregar lote</span></button><button type="button" class="btn-fantasma btn-mini" tabindex="-1">Cancelar</button></div>
      </div>`;
  }

  function dock(estado) {
    return `<nav class="dock-sis tut-dock"><div class="dock-hojas" role="tablist">
        <button type="button" class="hoja-tab" tabindex="-1">${ico('description')}<span class="hoja-nombre">SIS-06-P</span></button>
        <button type="button" class="hoja-tab activo" style="--hoja:#d97706" tabindex="-1">${ico('inventory_2')}<span class="hoja-nombre">Movimiento de Biológico</span></button>
        <button type="button" class="hoja-tab" tabindex="-1">${ico('table_view')}<span class="hoja-nombre">SIS-SS-CE-H</span></button>
        <button type="button" class="hoja-tab" tabindex="-1">${ico('vaccines')}<span class="hoja-nombre">Influenza</span></button></div>
      <div class="dock-estado" style="display:flex"><b><span class="dock-punto" data-t="punto"></span><span data-t="est-titulo">Borrador</span></b><small data-t="est-detalle">${esc(estado)}</small></div>
      <div class="dock-acciones"><button type="button" class="dock-btn dock-enviar" data-t="btn-enviar" disabled>${ico('send')}<span class="dock-etiqueta">Enviar</span></button>
        <button type="button" class="dock-btn en-reposo dock-guardar">${ico('check')}<span class="dock-etiqueta">Guardado</span></button></div></nav>`;
  }

  const item = (id, ok, titulo, falta) => `<div class="tut-chk" data-t="${id}"><span class="material-symbols-rounded" aria-hidden="true">${ok ? 'check_circle' : 'pending'}</span>
    <div><b>${esc(titulo)}</b><div class="tut-chk-falta">${esc(falta || '')}</div></div></div>`;

  // ------------------------------------------------------------------ las películas
  const T = {};

  T.primer_mes = {
    titulo: 'Anotar lo que ya tenías de un lote que te llegó',
    resumen: 'Primer mes: el lote llegó por Requisiciones y también tenías frascos del mes pasado.',
    icono: 'inventory_2', color: '#0284c7', alto: 540,
    escena: () => bloqueBCG(
      fila({ id: 'a', lote: '0374MA108', cad: 'MAR-27', ant: 0, rec: 30, apl: 0, des: 0, fin: 30, obs: 'Cargado desde Requisiciones (30 fras', candado: true })
      ,
      totales('tot', 0, 30, 0, 0, 30), panelAgregar()),
    pasos: [
      { texto: 'Tu lote llegó por Requisiciones: aparece solo, con un candado 🔒 en «Recibido».', detalle: 'Lo recibido no se captura aquí; ya viene cargado.', resalta: '[data-t="rec-a"]', espera: 3200 },
      { texto: 'Si ese mismo lote ya lo tenías del mes pasado, pulsa «Agregar un lote que ya tenías».', cursor: '[data-t="btn-agregar"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="panel-agregar"]').classList.add('abierto'); r.querySelector('[data-t="btn-agregar"]').setAttribute('aria-expanded', 'true'); } },
      { texto: 'Elige el Estatus: «Normal» (lo normal, disponible para aplicar).', cursor: '[data-t="cat"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="cat"] span').textContent = 'Normal'; r.querySelector('[data-t="lote"] span').textContent = 'Selecciona un lote…'; } },
      { texto: 'Elige el lote. Si dice «(lo recibiste este mes)», es el mismo que te llegó: no se duplica.', detalle: 'La fila se resalta arriba y el botón de abajo cambia a «Añadir existencia anterior».', cursor: '[data-t="lote"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="lote"] span').textContent = '0374MA108 — MAR-27 (lo recibiste este mes)'; r.querySelector('[data-t="txt-confirmar"]').textContent = 'Añadir existencia anterior'; r.querySelector('[data-t="aviso"]').classList.add('visible'); r.querySelector('[data-t="a"]').classList.add('fila-destacada'); }, espera: 3600 },
      { texto: 'Escribe cuántos frascos tenías del mes pasado.', cursor: '[data-t="cant"]', clic: true, tipear: { sel: '[data-t="cant"] span', valor: '4' } },
      { texto: 'Pulsa «Añadir existencia anterior».', cursor: '[data-t="btn-confirmar"]', clic: true,
        despues: (r) => {
          r.querySelector('[data-t="panel-agregar"]').classList.remove('abierto'); r.querySelector('[data-t="btn-agregar"]').setAttribute('aria-expanded', 'false');
          r.querySelector('[data-t="ant-a"]').textContent = '4'; r.querySelector('[data-t="fin-a"]').textContent = '34';
          r.querySelector('[data-t="tot-ant"]').textContent = '4'; r.querySelector('[data-t="tot-fin"]').textContent = '34';
          r.querySelectorAll('.fila-destacada').forEach((x) => x.classList.remove('fila-destacada')); r.querySelector('[data-t="a"]').classList.add('fila-destacada');
        } },
      { texto: 'Listo: el lote no se duplicó. Ahora tiene 4 de existencia anterior y su final se calculó solo.', detalle: 'También puedes tocar el lápiz ✏️ de la fila para escribir o corregir esa cifra. Solo se puede en tu primer mes.', resalta: '[data-t="lapiz"]', espera: 4200 }
    ]
  };

  T.cuadrar = {
    titulo: 'Mi paloteo y mi Movimiento no coinciden',
    resumen: 'Las dosis aplicadas de SIS-06-P y del Movimiento deben ser iguales para poder enviar.',
    icono: 'balance', color: '#d97706', alto: 330,
    escena: () => `<div class="tut-vista" data-t="v-conc">
        <div class="tut-conc" data-t="tarjeta"><div class="tut-conc-cab">${ico('assignment_late')}<div><b data-t="conc-titulo">1 biológico por cuadrar con el Movimiento</b>
          <span data-t="conc-sub">Antes de enviar, deja las dosis aplicadas iguales: corrige el paloteo o las «aplicadas» por lote en el Movimiento.</span></div>
          <button type="button" class="btn-secundario btn-mini" data-t="btn-ir" tabindex="-1">${ico('medication_liquid')} Ir al Movimiento</button></div>
          <table class="tut-conc-tabla"><thead><tr><th>Biológico</th><th>Paloteo SIS-06-P</th><th>Aplicado (Movimiento)</th><th>Diferencia</th></tr></thead>
          <tbody><tr data-t="conc-fila"><td>BCG</td><td>40</td><td data-t="conc-apl">32</td><td data-t="conc-dif" class="tut-dif">+8</td></tr></tbody></table></div></div>
      <div class="tut-vista" data-t="v-mov" hidden>${bloqueBCG(
        fila({ id: 'a', lote: '0374MA108', cad: 'MAR-27', ant: 15, rec: 30, apl: 32, des: 0, fin: 13, candado: true, obs: 'Cargado desde Requisiciones (30 fras' }),
        totales('tot', 15, 30, 32, 0, 13))}</div>`,
    pasos: [
      { texto: 'La tarjeta te avisa: tu paloteo dice 40 dosis de BCG, pero en el Movimiento solo anotaste 32.', detalle: 'Es normal mientras capturas. Solo debe cuadrar antes de enviar.', resalta: '[data-t="conc-fila"]', espera: 3600 },
      { texto: 'Piensa cuál número es el correcto: las dosis que de verdad aplicaste.', detalle: 'Si el paloteo está bien, el que falta es el Movimiento. Si el Movimiento está bien, corrige el paloteo en SIS-06-P.', espera: 3600 },
      { texto: 'Pulsa «Ir al Movimiento».', cursor: '[data-t="btn-ir"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="v-conc"]').hidden = true; r.querySelector('[data-t="v-mov"]').hidden = false; } },
      { texto: 'En la fila del lote, escribe las dosis aplicadas que faltan para llegar a 40.', detalle: 'Si usaste varios lotes, reparte las dosis entre ellos: la suma de todos debe dar 40.', cursor: '[data-t="apl-a"]', clic: true, tipear: { sel: '[data-t="apl-a"]', valor: '40', borrar: true } },
      { texto: 'El Final del lote se recalcula solo: existencia anterior + recibido − aplicadas − desechadas.', resalta: '[data-t="fin-a"]',
        antes: (r) => { r.querySelector('[data-t="fin-a"]').textContent = '5'; r.querySelector('[data-t="tot-apl"]').textContent = '40'; r.querySelector('[data-t="tot-fin"]').textContent = '5'; }, espera: 3200 },
      { texto: 'Regresa a la tarjeta: cuando coinciden, se pone verde y ya no estorba para enviar.',
        antes: (r) => {
          r.querySelector('[data-t="v-conc"]').hidden = false; r.querySelector('[data-t="v-mov"]').hidden = true;
          const t = r.querySelector('[data-t="tarjeta"]'); t.classList.add('ok');
          r.querySelector('.tut-conc-cab > .material-symbols-rounded').textContent = 'check_circle';
          r.querySelector('[data-t="conc-titulo"]').textContent = 'Paloteo y Movimiento coinciden';
          r.querySelector('[data-t="conc-sub"]').textContent = 'Todo cuadra. Cuando llegue la fecha de envío podrás enviar.';
          r.querySelector('[data-t="conc-apl"]').textContent = '40'; r.querySelector('[data-t="conc-dif"]').textContent = '0';
          r.querySelector('[data-t="btn-ir"]').style.visibility = 'hidden';
        }, espera: 3600 },
      { texto: 'Si aplicaste SRP en lugar de SR (o TdPa en lugar de DPT), anótalo con el «comodín de sustitución» en SIS-06-P.', detalle: 'Así el sistema sabe que la diferencia es esa sustitución y no un error.', espera: 4200 }
    ]
  };

  T.mover = {
    titulo: 'Mover un lote a A.R.F. o a Canje',
    resumen: 'Cuando parte de un lote quedó en dictamen o se va a cambiar con el proveedor.',
    icono: 'swap_horiz', color: '#7c3aed', alto: 500,
    escena: () => bloqueBCG(
      fila({ id: 'a', lote: '0374MA109', cad: 'MAR-27', ant: 12, rec: 0, apl: 0, des: 0, fin: 12 }),
      totales('tot', 12, 0, 0, 0, 12),
      `<div class="panel-resolver tut-mover" data-t="panel-mover">
        <p>Pasa parte o todo este lote a otro estatus; queda registrado con su motivo. Existencia actual: <b>12</b> frasco(s).</p>
        <div class="tut-campos">
          <div class="tut-campo"><label>Mover a</label>${sel('A.R.F. (en dictamen)', 'Estatus nuevo', 'dest')}</div>
          <div class="tut-campo"><label>Cantidad (frascos)</label><div class="tut-entrada" data-t="cant"><span>12</span></div></div>
          <div class="tut-campo tut-ancho"><label>Motivo</label><div class="tut-entrada tut-vacia" data-t="motivo"><span>Ej. Falla en cadena de frío, se manda a dictamen</span></div></div>
        </div>
        <div class="acciones"><button type="button" class="btn-primario btn-mini" data-t="btn-mover-ok" tabindex="-1">${ico('check')} Mover</button></div></div>`),
    pasos: [
      { texto: 'Un lote de tu tabla tuvo un problema (por ejemplo, se rompió la cadena de frío). Pulsa «Mover» junto al lote.', cursor: '[data-t="mover-a"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="panel-mover"]').classList.add('abierto'); } },
      { texto: '«Mover a»: A.R.F. si queda en dictamen; Canje si se va a cambiar con el proveedor.', resalta: '[data-t="dest"]', espera: 3400 },
      { texto: 'Escribe cuántos frascos se mueven (pueden ser solo algunos, no todo el lote).', cursor: '[data-t="cant"]', clic: true, tipear: { sel: '[data-t="cant"] span', valor: '3', borrar: true } },
      { texto: 'Escribe el motivo con tus palabras: queda registrado.', cursor: '[data-t="motivo"]', clic: true, tipear: { sel: '[data-t="motivo"] span', valor: 'Falla en cadena de frío', borrar: true, texto: true },
        despues: (r) => r.querySelector('[data-t="motivo"]').classList.remove('tut-vacia') },
      { texto: 'Pulsa «Mover».', cursor: '[data-t="btn-mover-ok"]', clic: true,
        despues: (r) => {
          r.querySelector('[data-t="panel-mover"]').classList.remove('abierto');
          r.querySelector('[data-t="fin-a"]').textContent = '9'; r.querySelector('[data-t="ant-a"]').textContent = '9';
          r.querySelector('[data-t="apl-a"]').value = '0';
          const cuerpo = r.querySelector('[data-t="cuerpo"]');
          cuerpo.insertAdjacentHTML('beforeend', `<tr><td colspan="9" class="subseccion arf">A.R.F. — En dictamen</td></tr>${fila({ id: 'arf', lote: '0374MA109', cad: 'MAR-27', ant: 3, rec: 0, apl: 0, des: 0, fin: 3, clase: 'categoria-arf', sinMover: true, obs: 'Falla en cadena de frío' })}`);
          r.querySelector('[data-t="tot-fin"]').textContent = '12';
        } },
      { texto: 'Listo: 9 frascos siguen como Normal y 3 quedaron en A.R.F. con su motivo.', detalle: 'Cuando llegue el dictamen, en ese renglón verás el botón «Dictamen» para regresarlos a Normal o darlos de baja.', resalta: '[data-t="arf"]', espera: 4600 }
    ]
  };

  T.enviar = {
    titulo: 'Enviar tu SINBA-SIS',
    resumen: 'Qué revisar y qué pasa cuando el botón «Enviar» está apagado.',
    icono: 'send', color: '#16a34a', alto: 540,
    escena: () => `<div class="tut-lienzo">${dock('2 por cuadrar antes de enviar')}
      <div class="tut-modal" data-t="modal-chk" hidden><div class="tut-modal-caja"><h3>Qué falta para enviar</h3><p data-t="chk-sub">Te faltan 4 cosas. Mientras tanto, el botón «Enviar» se queda apagado.</p>
        ${item('c1', true, 'Tu concentrado está guardado')}
        ${item('c2', false, 'Tu nombre está escrito', 'Escribe tu nombre completo en «Responsable de la información», arriba.')}
        ${item('c5', false, 'Ningún lote caducado con existencia', 'Da de baja lo que sobre con «Dar de baja» en su fila, o pásalo a A.R.F. o canje con «Mover».')}
        ${item('c3', false, 'El paloteo y el Movimiento cuadran', 'Corrige el lado que esté mal.')}
        ${item('c4', false, 'Ya es fecha de envío', 'El envío se abre del 31 de octubre al 7 de noviembre. Mientras tanto puedes seguir capturando.')}
        <div class="tut-modal-acc"><span class="btn-primario">Entendido</span></div></div></div>
      <div class="tut-modal" data-t="modal-conf" hidden><div class="tut-modal-caja"><h3>Enviar el SINBA-SIS para validación</h3>
        <p>Al enviarlo, el paloteo SIS-06-P y el Movimiento de Biológico quedan bloqueados: ya no podrás editarlos, solo tu municipal podrá corregirlos. ¿Confirmas que todo está completo y revisado?</p>
        <div class="tut-modal-acc"><span class="btn-fantasma">Cancelar</span><span class="btn-primario" data-t="btn-si">Sí, enviar</span></div></div></div>
      <div class="tut-toast" data-t="toast" hidden>✅ SIS enviado para validación</div></div>`,
    pasos: [
      { texto: 'Abajo está la barra de tu SINBA-SIS. Ahí ves el estatus y el botón «Enviar».', detalle: 'Mientras captures, el estatus dice «Borrador».', resalta: '.tut-dock', espera: 3200 },
      { texto: 'Si «Enviar» está apagado, tócalo: te dice exactamente qué falta.', cursor: '[data-t="btn-enviar"]', clic: true,
        despues: (r) => { r.querySelector('[data-t="modal-chk"]').hidden = false; }, espera: 3600 },
      { texto: 'Una lista con palomitas: guardado, tu nombre, que no queden lotes caducados con frascos, que el paloteo cuadre con el Movimiento y la fecha de envío.', resalta: '[data-t="c2"], [data-t="c5"], [data-t="c3"], [data-t="c4"]', espera: 4200 },
      { texto: 'Resuelve cada pendiente. Cuando todo queda en verde y ya es fecha de envío…', cursor: '[data-t="c3"]', clic: false,
        antes: (r) => {
          r.querySelectorAll('.tut-chk').forEach((c) => { c.classList.add('ok'); c.querySelector('.material-symbols-rounded').textContent = 'check_circle'; c.querySelector('.tut-chk-falta').textContent = ''; });
          r.querySelector('[data-t="chk-sub"]').textContent = 'Todo listo. Cierra esta ventana y pulsa «Enviar» en la barra de abajo.';
        }, espera: 3200 },
      { texto: '…el botón «Enviar» se enciende. Púlsalo.', cursor: '[data-t="btn-enviar"]', clic: true,
        antes: (r) => { r.querySelector('[data-t="modal-chk"]').hidden = true; const b = r.querySelector('[data-t="btn-enviar"]'); b.disabled = false; r.querySelector('[data-t="est-detalle"]').textContent = 'Listo para enviar hasta el 7 nov'; },
        despues: (r) => { r.querySelector('[data-t="modal-conf"]').hidden = false; } },
      { texto: 'Te pide confirmar: al enviar, todo queda bloqueado. Si estás seguro, «Sí, enviar».', cursor: '[data-t="btn-si"]', clic: true,
        despues: (r) => {
          r.querySelector('[data-t="modal-conf"]').hidden = true; r.querySelector('[data-t="btn-enviar"]').disabled = true;
          r.querySelector('[data-t="est-titulo"]').textContent = 'Enviado'; r.querySelector('[data-t="punto"]').classList.add('enviado');
          r.querySelector('[data-t="est-detalle"]').textContent = 'Esperando al municipal'; r.querySelector('[data-t="toast"]').hidden = false;
        } },
      { texto: 'Listo. Tu municipal recibe el archivo para validarlo. Si corrige algo, tú verás el cambio y lo aceptas.', resalta: '[data-t="est-detalle"]', espera: 4200 }
    ]
  };

  const ORDEN = ['primer_mes', 'cuadrar', 'mover', 'enviar'];

  // ------------------------------------------------------------------ estilos
  function estilos() {
    if (document.getElementById('tutEstilos')) return;
    const st = document.createElement('style');
    st.id = 'tutEstilos';
    st.textContent = `
      .tut-overlay { position: fixed; inset: 0; z-index: 2200; background: rgba(15,23,42,.58); display: none; align-items: center; justify-content: center; padding: 18px; }
      .tut-overlay.abierto { display: flex; }
      body.tut-abierto .feedback-fab { display: none !important; }
      .tut-hoja { width: min(1080px, 100%); max-height: calc(100vh - 36px); background: #f8fafc; border-radius: 22px; box-shadow: 0 24px 70px rgba(15,23,42,.4); display: flex; flex-direction: column; overflow: hidden; font-family: 'Nunito Sans', 'Inter', sans-serif; }
      .tut-cab { display: flex; align-items: center; gap: 12px; padding: 16px 20px 12px; }
      .tut-cab h3 { margin: 0; font: 800 17px/1.25 'Poppins', 'Nunito Sans', sans-serif; color: #0f172a; }
      .tut-cab p { margin: 2px 0 0; font-size: 12.5px; color: #5b6b80; }
      .tut-cerrar { margin-left: auto; flex: none; width: 38px; height: 38px; border: none; background: transparent; border-radius: 50%; cursor: pointer; color: #475569; display: grid; place-items: center; }
      .tut-cerrar:hover { background: rgba(15,23,42,.08); }
      .tut-cuerpo { overflow: auto; padding: 0 20px 6px; }
      .tut-pantalla { position: relative; border-radius: 16px; background: #eef2f7; border: 1px solid #dbe3ec; padding: 14px; overflow: hidden; min-height: 320px; }
      .tut-escena { pointer-events: none; user-select: none; }
      .tut-escena .bloque { margin: 0; }
      .tut-escena .btn-agregar-lote, .tut-escena .panel-agregar { margin-top: 10px; }
      .tut-escena .nota-panel-agregar { display: none; }
      .tut-escena .panel-agregar { padding-top: 14px; }
      .tut-vista[hidden], .tut-modal[hidden], .tut-toast[hidden] { display: none !important; }
      .tut-campos { display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: flex-end; margin: 10px 0; }
      .tut-campo { width: 200px; } .tut-campo.tut-ancho { width: 360px; max-width: 100%; }
      .tut-campo label { display: block; margin-bottom: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #5b6b80; }
      .tut-select, .tut-entrada { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 42px; padding: 0 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; font-weight: 600; color: #0f172a; }
      .tut-select .material-symbols-rounded { font-size: 20px; color: #64748b; }
      .tut-etq { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .tut-vacia span { color: #94a3b8; font-weight: 500; font-size: 13px; }
      .tut-aviso.visible { display: flex; }
      .tut-escena .fila-destacada td { animation: filaDestacada 1.15s ease-in-out 4; }
      .tut-escena .fila-destacada td.c-ant .ant-valor { outline: 2px solid #0ea5e9; outline-offset: 3px; border-radius: 6px; }
      .tut-mover { display: none; margin-top: 10px; } .tut-mover.abierto { display: block; }
      .tut-conc { background: #fff; border: 1.5px solid #fcd34d; border-radius: 16px; padding: 16px; } .tut-conc.ok { border-color: #86efac; background: #f0fdf4; }
      .tut-conc-cab { display: flex; gap: 12px; align-items: flex-start; } .tut-conc-cab > .material-symbols-rounded { font-size: 26px; color: #d97706; }
      .tut-conc.ok .tut-conc-cab > .material-symbols-rounded { color: #16a34a; }
      .tut-conc-cab b { display: block; font-size: 15px; color: #0f172a; } .tut-conc-cab span { font-size: 12.5px; color: #475569; } .tut-conc-cab .btn-secundario { margin-left: auto; flex: none; }
      .tut-conc-tabla { width: 100%; margin-top: 12px; border-collapse: collapse; font-size: 13px; } .tut-conc-tabla th { text-align: left; font-size: 10.5px; color: #64748b; text-transform: uppercase; padding: 6px 8px; }
      .tut-conc-tabla td { padding: 8px; border-top: 1px solid #eef2f7; font-weight: 700; color: #0f172a; } .tut-dif { color: #dc2626 !important; } .tut-conc.ok .tut-dif { color: #16a34a !important; }
      .tut-lienzo { position: relative; min-height: 470px; display: flex; align-items: flex-end; justify-content: center; padding: 20px 0 6px; }
      .tut-dock.dock-sis { position: static; transform: none; max-width: 100%; z-index: 1; }
      .tut-modal { position: absolute; inset: 0 0 78px 0; background: rgba(15,23,42,.4); display: flex; align-items: center; justify-content: center; padding: 12px; border-radius: 12px; }
      .tut-modal-caja { background: #fff; border-radius: 18px; padding: 18px 20px; width: min(430px, 100%); box-shadow: 0 16px 40px rgba(15,23,42,.3); }
      .tut-modal-caja h3 { margin: 0 0 6px; font: 800 15px 'Poppins', sans-serif; color: #0f172a; } .tut-modal-caja p { margin: 0 0 8px; font-size: 12.5px; color: #475569; line-height: 1.45; }
      .tut-modal-acc { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; } .tut-modal-acc span { padding: 9px 16px; border-radius: 999px; font-weight: 800; font-size: 12.5px; }
      .tut-modal-acc .btn-primario { background: #0f172a; color: #fff; } .tut-modal-acc .btn-fantasma { background: #eef2f7; color: #334155; }
      .tut-chk { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #eef2f7; } .tut-chk .material-symbols-rounded { font-size: 22px; color: #d97706; flex: none; }
      .tut-chk.ok .material-symbols-rounded { color: #16a34a; } .tut-chk b { font-size: 13px; color: #0f172a; } .tut-chk-falta { font-size: 12px; color: #475569; line-height: 1.4; margin-top: 2px; }
      .tut-chk .tut-chk-falta:empty { display: none; }
      .tut-toast { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #fff; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 700; z-index: 3; }
      .tut-resalta { position: relative; z-index: 2; animation: tutPulso 1s ease-in-out infinite; border-radius: 10px; }
      tr.tut-resalta { animation: none; outline: 3px solid #f59e0b; outline-offset: -2px; background: #fffbeb; }
      @keyframes tutPulso { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,.55); } }
      .tut-escribiendo { box-shadow: 0 0 0 3px rgba(2,132,199,.4) !important; border-color: #0284c7 !important; }
      .tut-cursor { position: absolute; left: 0; top: 0; z-index: 5; width: 30px; height: 30px; pointer-events: none; transition: transform .75s cubic-bezier(.4,.1,.2,1); filter: drop-shadow(0 3px 4px rgba(15,23,42,.35)); }
      .tut-cursor.oculto { opacity: 0; }
      .tut-onda { position: absolute; z-index: 4; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 3px solid #0284c7; pointer-events: none; animation: tutOnda .55s ease-out forwards; }
      @keyframes tutOnda { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.6); opacity: 0; } }
      .tut-pie { padding: 12px 20px 16px; border-top: 1px solid #e2e8f0; background: #fff; }
      .tut-prog { height: 4px; border-radius: 4px; background: #e2e8f0; overflow: hidden; margin-bottom: 12px; } .tut-prog i { display: block; height: 100%; width: 0; background: var(--tut-color, #0284c7); transition: width .4s ease; }
      .tut-paso { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--tut-color, #0284c7); }
      .tut-texto { margin: 3px 0 2px; font: 800 18px/1.35 'Poppins', 'Nunito Sans', sans-serif; color: #0f172a; min-height: 48px; }
      .tut-detalle { font-size: 13.5px; color: #475569; line-height: 1.45; min-height: 20px; }
      .tut-ctl { display: flex; align-items: center; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
      .tut-btn { display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 999px; padding: 10px 16px; font: 800 13px 'Poppins', 'Nunito Sans', sans-serif; cursor: pointer; background: #eef2f7; color: #334155; }
      .tut-btn:hover { background: #e2e8f0; } .tut-btn.prim { background: #0f172a; color: #fff; } .tut-btn.prim:hover { background: #1e293b; }
      .tut-btn:disabled { opacity: .45; cursor: default; } .tut-btn .material-symbols-rounded { font-size: 19px; }
      .tut-puntos { display: flex; gap: 6px; margin-left: auto; } .tut-punto { width: 10px; height: 10px; border-radius: 50%; border: none; padding: 0; background: #cbd5e1; cursor: pointer; }
      .tut-punto.es-actual { background: var(--tut-color, #0284c7); transform: scale(1.25); } .tut-punto.es-hecho { background: #94a3b8; }
      .tut-menu { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 4px 20px 20px; }
      .tut-tarjeta { display: flex; gap: 12px; align-items: flex-start; text-align: left; background: #fff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 14px; cursor: pointer; font-family: inherit; }
      .tut-tarjeta:hover { border-color: var(--c, #0284c7); } .tut-tarjeta:focus-visible { outline: 3px solid #0f172a; outline-offset: 2px; }
      .tut-tarjeta .tut-ic { flex: none; width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, white); }
      .tut-tarjeta b { display: block; font-size: 14px; color: #0f172a; line-height: 1.3; } .tut-tarjeta span.s { display: block; margin-top: 3px; font-size: 12.5px; color: #5b6b80; line-height: 1.4; }
      .tut-tarjeta .tut-dur { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 11.5px; font-weight: 800; color: #334155; } .tut-tarjeta .tut-dur .material-symbols-rounded { color: var(--c); }
      .tut-enlace { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; padding: 0; cursor: pointer; font: 800 12.5px 'Nunito Sans', sans-serif; color: #0369a1; text-decoration: none; }
      .tut-enlace .tut-txt { text-decoration: underline; text-underline-offset: 3px; }
      .tut-enlace .material-symbols-rounded { font-size: 18px; }
      @media (max-width: 700px) { .tut-menu { grid-template-columns: 1fr; } .tut-texto { font-size: 16px; } .tut-pantalla { padding: 8px; } .tut-overlay { padding: 8px; align-items: flex-end; } .tut-hoja { max-height: calc(100vh - 16px); } }
      @media (prefers-reduced-motion: reduce) { .tut-cursor { transition: none; } .tut-resalta, .tut-escena .fila-destacada td { animation: none; } .tut-onda { animation: none; opacity: 0; } }`;
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ reproductor
  let ov = null;
  let cur = null;     // { id, def, i, raiz, auto, token }
  let retorno = null;

  function dom() {
    if (ov) return ov;
    estilos();
    ov = document.createElement('div');
    ov.className = 'tut-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = `<div class="tut-hoja" role="dialog" aria-modal="true" aria-labelledby="tutTitulo">
      <div class="tut-cab"><div style="min-width:0"><h3 id="tutTitulo"></h3><p id="tutSub"></p></div>
        <button type="button" class="tut-cerrar" id="tutCerrar" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
      <div class="tut-cuerpo" id="tutCuerpo"></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (ev) => { if (ev.target === ov) cerrar(); });
    ov.querySelector('#tutCerrar').addEventListener('click', cerrar);
    return ov;
  }

  function mostrar() {
    const o = dom();
    if (!o.classList.contains('abierto')) retorno = document.activeElement;
    o.classList.add('abierto'); o.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; document.body.classList.add('tut-abierto');
  }

  function cerrar() {
    if (!ov || !ov.classList.contains('abierto')) return;
    if (cur) cur.token++;
    cur = null;
    ov.classList.remove('abierto'); ov.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; document.body.classList.remove('tut-abierto');
    ov.querySelector('#tutCuerpo').innerHTML = '';
    if (retorno && retorno.focus) retorno.focus();
    retorno = null;
  }

  function menu() {
    mostrar();
    ov.querySelectorAll('.tut-pie').forEach((x) => x.remove());
    if (cur) { cur.token++; cur = null; }
    ov.querySelector('#tutTitulo').textContent = 'Tutoriales cortos';
    ov.querySelector('#tutSub').textContent = 'Elige qué quieres aprender. Cada uno dura menos de un minuto y se mueve solo.';
    ov.querySelector('#tutCuerpo').innerHTML = `<div class="tut-menu">${ORDEN.map((id) => {
      const d = T[id];
      return `<button type="button" class="tut-tarjeta" data-tut="${id}" style="--c:${d.color}"><span class="tut-ic"><span class="material-symbols-rounded" aria-hidden="true">${d.icono}</span></span>
        <span><b>${esc(d.titulo)}</b><span class="s">${esc(d.resumen)}</span><span class="tut-dur"><span class="material-symbols-rounded" aria-hidden="true" style="font-size:16px">play_circle</span>${d.pasos.length} pasos</span></span></button>`;
    }).join('')}</div>`;
    ov.querySelectorAll('[data-tut]').forEach((b) => b.addEventListener('click', () => abrir(b.dataset.tut)));
    const primero = ov.querySelector('[data-tut]'); if (primero) primero.focus();
  }

  const FLECHA = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M4 2l15 9-6.5 1.8L9.8 19.5z" fill="#0f172a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function abrir(id, desde) {
    const def = T[id];
    if (!def) return;
    mostrar();
    ov.querySelectorAll('.tut-pie').forEach((x) => x.remove());
    const cuerpo = ov.querySelector('#tutCuerpo');
    ov.querySelector('#tutTitulo').textContent = def.titulo;
    ov.querySelector('#tutSub').textContent = def.resumen;
    cuerpo.innerHTML = `<div class="tut-pantalla" style="--tut-color:${def.color}"><div class="tut-escena" id="tutEscena" aria-hidden="true"></div><div class="tut-cursor oculto" id="tutCursor">${FLECHA}</div></div>`;
    const pie = document.createElement('div');
    pie.className = 'tut-pie'; pie.style.setProperty('--tut-color', def.color);
    pie.innerHTML = `<div class="tut-prog"><i id="tutProg"></i></div>
      <div class="tut-paso" id="tutPaso"></div><div class="tut-texto" id="tutTexto" aria-live="polite"></div><div class="tut-detalle" id="tutDetalle"></div>
      <div class="tut-ctl"><button type="button" class="tut-btn" id="tutAnt"><span class="material-symbols-rounded" aria-hidden="true">arrow_back</span>Anterior</button>
        <button type="button" class="tut-btn prim" id="tutPlay"><span class="material-symbols-rounded" aria-hidden="true">pause</span><span>Pausa</span></button>
        <button type="button" class="tut-btn" id="tutSig">Siguiente<span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
        <button type="button" class="tut-btn" id="tutTodos"><span class="material-symbols-rounded" aria-hidden="true">apps</span>Otros tutoriales</button>
        <div class="tut-puntos" id="tutPuntos" role="group" aria-label="Pasos"></div></div>`;
    ov.querySelector('.tut-hoja').appendChild(pie);
    ajustarEscala(def);
    cur = { id, def, i: 0, raiz: ov.querySelector('#tutEscena'), auto: !mov(), token: (cur ? cur.token : 0) + 1, pie };
    pie.querySelector('#tutAnt').addEventListener('click', () => { cur.auto = false; irA(cur.i - 1); });
    pie.querySelector('#tutSig').addEventListener('click', () => { cur.auto = false; irA(cur.i + 1); });
    pie.querySelector('#tutPlay').addEventListener('click', () => {
      if (cur.i >= def.pasos.length - 1 && !cur.auto) { cur.auto = true; irA(0); return; }
      cur.auto = !cur.auto; actualizarPlay(); if (cur.auto) irA(cur.i, true);
    });
    pie.querySelector('#tutTodos').addEventListener('click', () => { pie.remove(); menu(); });
    pie.querySelector('#tutPuntos').innerHTML = def.pasos.map((p, k) => `<button type="button" class="tut-punto" data-k="${k}" aria-label="Ir al paso ${k + 1}"></button>`).join('');
    pie.querySelector('#tutPuntos').addEventListener('click', (ev) => { const b = ev.target.closest('[data-k]'); if (b) { cur.auto = false; irA(Number(b.dataset.k)); } });
    irA(desde || 0);
  }

  // La réplica se achica lo necesario para verse completa en pantallas bajas (sin tener que desplazarla).
  function ajustarEscala(def) {
    const esc = ov && ov.querySelector('#tutEscena');
    const pie = ov && ov.querySelector('.tut-pie');
    if (!esc || !pie) return;
    const disponible = window.innerHeight - 36 - 78 - pie.offsetHeight - 44;
    const ancho = (esc.parentElement ? esc.parentElement.clientWidth : window.innerWidth) - 24;
    // En teléfono la réplica (de ~880 px de ancho) se achica también a lo ancho: el texto de abajo es el que se lee.
    const f = Math.max(0.36, Math.min(1, disponible / (def.alto || 460), ancho / 880));
    esc.style.zoom = f < 1 ? String(f.toFixed(3)) : '';
  }
  window.addEventListener('resize', () => { if (cur) ajustarEscala(cur.def); });

  function actualizarPlay() {
    if (!cur) return;
    const b = cur.pie.querySelector('#tutPlay');
    const fin = cur.i >= cur.def.pasos.length - 1 && !cur.auto;
    b.querySelector('.material-symbols-rounded').textContent = cur.auto ? 'pause' : (fin ? 'replay' : 'play_arrow');
    b.querySelector('span:last-child').textContent = cur.auto ? 'Pausa' : (fin ? 'Ver otra vez' : 'Reproducir');
  }

  function aplicar(r, p) { try { if (p.antes) p.antes(r); if (p.tipear) escribir(r, p.tipear, true); if (p.despues) p.despues(r); } catch (e) { console.warn('[Tutoriales]', e); } }

  function escribir(r, t, directo) {
    const el = r.querySelector(t.sel);
    if (!el) return Promise.resolve();
    const poner = (v) => { if ('value' in el && el.tagName === 'INPUT') el.value = v; else el.textContent = v; };
    if (directo) { poner(t.valor); return Promise.resolve(); }
    const base = t.borrar ? '' : (el.tagName === 'INPUT' ? el.value : '');
    el.classList.add('tut-escribiendo'); poner(base);
    const caracteres = String(t.valor).split('');
    return (async () => {
      let acum = base;
      for (const ch of caracteres) { acum += ch; poner(acum); await ESPERA(t.texto ? 55 : 160); }
      await ESPERA(250); el.classList.remove('tut-escribiendo');
    })();
  }

  function posicionCursor(objetivo) {
    const pant = ov.querySelector('.tut-pantalla');
    const rp = pant.getBoundingClientRect();
    const re = objetivo.getBoundingClientRect();
    return { x: re.left - rp.left + Math.min(re.width * 0.55, 70), y: re.top - rp.top + re.height * 0.6 + pant.scrollTop };
  }

  async function irA(i, reanudar) {
    if (!cur) return;
    const def = cur.def, n = def.pasos.length;
    const k = Math.max(0, Math.min(n - 1, i));
    const token = ++cur.token;
    cur.i = k;
    const r = cur.raiz;
    // Se reconstruye la escena y se aplican (sin animación) los pasos anteriores.
    r.innerHTML = def.escena();
    for (let j = 0; j < k; j++) aplicar(r, def.pasos[j]);
    const cursor = ov.querySelector('#tutCursor');
    const p = def.pasos[k];
    if (!p.cursor) cursor.classList.add('oculto');
    ov.querySelector('#tutPaso').textContent = `Paso ${k + 1} de ${n}`;
    ov.querySelector('#tutTexto').textContent = p.texto;
    ov.querySelector('#tutDetalle').textContent = p.detalle || '';
    ov.querySelector('#tutProg').style.width = (((k + 1) / n) * 100).toFixed(1) + '%';
    cur.pie.querySelectorAll('.tut-punto').forEach((b, m) => { b.classList.toggle('es-actual', m === k); b.classList.toggle('es-hecho', m < k); if (m === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    cur.pie.querySelector('#tutAnt').disabled = k === 0;
    cur.pie.querySelector('#tutSig').disabled = k === n - 1;
    actualizarPlay();
    const vivo = () => cur && cur.token === token;

    if (p.antes) { try { p.antes(r); } catch (e) { console.warn('[Tutoriales]', e); } }
    const marcar = () => { if (p.resalta) r.querySelectorAll(p.resalta).forEach((e) => e.classList.add('tut-resalta')); };
    const animar = cur.auto && !mov();

    if (p.cursor && animar) {
      const objetivo = r.querySelector(p.cursor);
      if (objetivo) {
        const pant = ov.querySelector('.tut-pantalla');
        // La película puede ser más alta que la ventana: se lleva el objetivo a la vista antes de mover el cursor.
        const caja = ov.querySelector('#tutCuerpo');
        const rc = caja.getBoundingClientRect(), ro = objetivo.getBoundingClientRect();
        if (ro.top < rc.top + 20 || ro.bottom > rc.bottom - 20) { caja.scrollTo({ top: Math.max(0, caja.scrollTop + (ro.top - rc.top) - rc.height / 2 + ro.height / 2), behavior: 'smooth' }); await ESPERA(480); if (!vivo()) return; }
        const ini = posicionCursor(objetivo);
        if (!cursor.dataset.x) { cursor.style.transition = 'none'; cursor.style.transform = `translate(${Math.max(20, ini.x - 220)}px, ${Math.max(20, ini.y + 140)}px)`; void cursor.offsetWidth; cursor.style.transition = ''; }
        cursor.classList.remove('oculto');
        await ESPERA(120); if (!vivo()) return;
        cursor.style.transform = `translate(${ini.x}px, ${ini.y}px)`; cursor.dataset.x = '1';
        await ESPERA(850); if (!vivo()) return;
        if (p.clic) {
          const onda = document.createElement('span'); onda.className = 'tut-onda'; onda.style.left = ini.x + 'px'; onda.style.top = ini.y + 'px'; pant.appendChild(onda);
          setTimeout(() => onda.remove(), 700);
          await ESPERA(160); if (!vivo()) return;
        }
        if (p.tipear) { await escribir(r, p.tipear, false); if (!vivo()) return; }
        if (p.despues) { try { p.despues(r); } catch (e) { console.warn('[Tutoriales]', e); } }
      } else { aplicar(r, { despues: p.despues, tipear: p.tipear }); }
    } else {
      if (p.tipear) escribir(r, p.tipear, true);
      if (p.despues) { try { p.despues(r); } catch (e) { console.warn('[Tutoriales]', e); } }
    }
    marcar();
    if (!vivo()) return;
    if (cur.auto && !mov()) {
      await ESPERA(p.espera || 2300); if (!vivo()) return;
      if (k < n - 1) irA(k + 1);
      else { cur.auto = false; actualizarPlay(); }
    }
  }

  document.addEventListener('click', (ev) => {
    const b = ev.target && ev.target.closest ? ev.target.closest('[data-tutorial]') : null;
    if (!b) return;
    ev.preventDefault();
    const id = b.dataset.tutorial;
    // Si hay un aviso (modal) abierto detrás, se cierra para que el tutorial quede al frente.
    const ayuda = window.Ayuda && window.Ayuda.cerrar; if (ayuda) ayuda();
    const mo = document.getElementById('modalOverlay'); if (mo && mo.classList.contains('abierto')) { const bc = document.getElementById('modalBtnAceptar'); if (bc) bc.click(); }
    if (id === 'menu') menu(); else abrir(id);
  });
  document.addEventListener('keydown', (ev) => {
    if (!ov || !ov.classList.contains('abierto')) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); cerrar(); return; }
    if (cur && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) { ev.preventDefault(); cur.auto = false; irA(cur.i + (ev.key === 'ArrowRight' ? 1 : -1)); return; }
    if (ev.key === 'Tab') {
      const f = [...ov.querySelectorAll('button:not(:disabled)')].filter((e) => e.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (ev.shiftKey && (document.activeElement === a || !ov.contains(document.activeElement))) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && (document.activeElement === z || !ov.contains(document.activeElement))) { ev.preventDefault(); a.focus(); }
    }
  }, true);

  estilos();
  window.Tutoriales = { abrir, menu, cerrar, lista: () => ORDEN.slice() };
})();
