/**
 * feedback_autoreply.js — Respuestas automáticas para el formulario de Feedback.
 *
 * Mientras la persona escribe su mensaje, se busca si coincide con una duda que
 * tiene solución conocida (contraseña olvidada, correo que no llega, etc.) y se
 * muestra la respuesta ahí mismo. Si la duda se resuelve no se manda nada a
 * Discord; si no, con "Enviar de todos modos" el reporte sale como siempre.
 *
 * Es un script independiente (sin dependencias) que comparten index.html,
 * biovac.html y mobile.html. Cada pantalla solo llama a
 * FeedbackAutoReply.attach({...}) con sus propios elementos.
 *
 * Para agregar/editar una respuesta basta con tocar RULES: cada regla decide con
 * `test(texto)` si aplica y `answer(ctx)` devuelve el contenido. Un texto se
 * compara ya normalizado (minúsculas, sin acentos).
 */
(function () {
  'use strict';

  // ── Utilidades ────────────────────────────────────────────────────────────
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const has = (t, re) => re.test(t);

  // Palabras clave reutilizadas por varias reglas
  // "clave" sola se usa también para claves de insumos, por eso solo cuenta
  // cuando va con "mi/tu" o "de acceso".
  const RE_PASS = /(contrasen|password|passwor|credencial|clave de acceso|\b(mi|tu) clave\b)/;
  const RE_USER = /\busuario\b/;
  const RE_FORGOT =
    /(olvid|no (me )?(acuerd|recuerd|se\b|s[eé] cual)|perd[ií]|recuper|restabl|resete|no (la )?tengo|cual es|cuales son|me (pasa|pasan|manda|mandan|envia|envian|da|dan|proporcion)|necesito (mi|la|el|que me)|dame|solicit\w* (mi|la|el))/;
  const RE_CANT_LOGIN =
    /(no (puedo|logro|consigo|me deja|me permite|me sale|me da acceso)( \w+){0,2} (entrar|ingresar|iniciar|acceder|abrir)|no (he )?(podido|pude) (entrar|ingresar|iniciar|acceder)|(usuario|contrasena|clave) (incorrect|invalid|equivocad)|credenciales (incorrect|invalid))/;
  const RE_CHANGE = /(cambiar|cambio|modificar|actualizar|nueva|poner otra|cambiarla)/;
  const RE_MAIL = /(correo|email|e-mail|mail|enlace|link|liga|codigo|token)/;

  // Selectores del botón "¿Olvidaste tu contraseña?" según la pantalla
  const FORGOT_BUTTONS = ['#btnForgotPassword', '#btnForgotPasswordMobile'];

  function clickFirst(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { el.click(); return true; }
    }
    return false;
  }

  // Acciones reutilizables. `run` recibe ctx; ctx.close() cierra el modal de feedback.
  const ACTION_FORGOT = {
    label: 'Ir a "¿Olvidaste tu contraseña?"',
    icon: 'lock_reset',
    run(ctx) {
      ctx.close();
      // Pequeño respiro para que el modal de feedback termine de cerrar
      setTimeout(() => {
        if (typeof window.openForgotModal === 'function') window.openForgotModal();
        else clickFirst(FORGOT_BUTTONS);
      }, 120);
    }
  };
  const ACTION_CHANGE_PASSWORD = {
    label: 'Cambiar mi contraseña',
    icon: 'password',
    run(ctx) {
      ctx.close();
      setTimeout(() => {
        if (typeof window.openChangePasswordFlow === 'function') window.openChangePasswordFlow();
      }, 120);
    }
  };

  // ── Reglas ────────────────────────────────────────────────────────────────
  // intercept:true  → el envío se detiene hasta que la persona elija
  //                   "Enviar de todos modos" o "Esto resolvió mi duda".
  // intercept:false → solo es una sugerencia, no bloquea el envío.
  const RULES = [
    {
      id: 'password_forgot',
      intercept: true,
      test: (t) =>
        (has(t, RE_PASS) || has(t, RE_USER)) &&
        (has(t, RE_FORGOT) || has(t, RE_CANT_LOGIN)) &&
        !has(t, /(error|falla|no funciona|no sirve|se queda|marca)\b.*\b(al )?(cambiar|guardar)/),
      answer: (ctx) =>
        ctx.loggedIn
          ? {
              title: 'Puedes cambiar tu contraseña tú mismo',
              paragraphs: [
                'El administrador no tiene acceso a las contraseñas de los usuarios ni puede consultarlas.',
                'Como ya tienes sesión iniciada, puedes cambiarla ahora mismo desde tu perfil:'
              ],
              steps: [
                'Abre "Mi Perfil" (arriba a la derecha).',
                'Entra a la pestaña "Cuenta".',
                'Toca "Cambiar contraseña". Te enviaremos un código a tu correo para confirmarlo.'
              ],
              action: ACTION_CHANGE_PASSWORD
            }
          : {
              title: 'No es necesario pedirle la contraseña al administrador',
              paragraphs: [
                'El administrador no tiene acceso a las contraseñas generadas por los usuarios. Si no recuerdas tu contraseña o necesitas recuperarla, en la pantalla de "Inicio de sesión" está la opción "¿Olvidaste tu contraseña?".'
              ],
              steps: [
                'En el inicio de sesión toca "¿Olvidaste tu contraseña?".',
                'Escribe tu usuario o tu correo institucional (si no recuerdas el usuario, usa el correo).',
                'Te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de SPAM / correo no deseado.'
              ],
              note: 'Si al intentarlo dice que el usuario no tiene correo registrado o el correo ya no existe, entonces sí envía este mensaje indicando tu unidad y CLUES.',
              action: ACTION_FORGOT
            }
    },
    {
      id: 'login_fail',
      intercept: true,
      test: (t) => has(t, RE_CANT_LOGIN) && !has(t, RE_FORGOT),
      answer: (ctx) => ({
        title: 'Problemas para iniciar sesión',
        paragraphs: ['Antes de reportarlo, revisa lo más común:'],
        steps: [
          'Verifica que el usuario esté escrito sin espacios al inicio o al final.',
          'Revisa que no esté activada la tecla Bloq Mayús y que el teclado esté en el idioma correcto.',
          'Si no recuerdas la contraseña, usa "¿Olvidaste tu contraseña?" en el inicio de sesión: te llega un enlace al correo.',
          'Cierra y vuelve a abrir la página (Ctrl + F5 en computadora).'
        ],
        note: 'Si nada de esto funciona, envía tu mensaje indicando tu usuario (nunca tu contraseña), unidad y CLUES.',
        action: ctx.loggedIn ? null : ACTION_FORGOT
      })
    },
    {
      id: 'password_change',
      intercept: true,
      test: (t) =>
        has(t, RE_PASS) && has(t, RE_CHANGE) && !has(t, RE_FORGOT) &&
        !has(t, /(error|falla|no funciona|no sirve|se queda|marca)/),
      answer: (ctx) =>
        ctx.loggedIn
          ? {
              title: 'Cambiar tu contraseña',
              paragraphs: ['Puedes hacerlo tú mismo desde tu perfil:'],
              steps: [
                'Abre "Mi Perfil" (arriba a la derecha).',
                'Entra a la pestaña "Cuenta" y toca "Cambiar contraseña".',
                'Te llegará un código a tu correo; escríbelo junto con la nueva contraseña.'
              ],
              action: ACTION_CHANGE_PASSWORD
            }
          : {
              title: 'Cambiar o recuperar tu contraseña',
              paragraphs: [
                'Desde el inicio de sesión toca "¿Olvidaste tu contraseña?" y te llegará un enlace a tu correo para crear una nueva. El administrador no puede ver ni cambiar contraseñas por ti.'
              ],
              action: ACTION_FORGOT
            }
    },
    {
      id: 'mail_not_arriving',
      intercept: true,
      test: (t) =>
        has(t, /(no (me )?(llego|llegan|llega|recibi|recibo|aparece|encuentro|ha llegado)|nunca (me )?llego|sin recibir)/) &&
        has(t, RE_MAIL),
      answer: () => ({
        title: 'El correo no me llega',
        paragraphs: ['Casi siempre es una de estas causas:'],
        steps: [
          'Revisa la carpeta de SPAM / correo no deseado y "Promociones".',
          'Espera de 2 a 5 minutos: a veces tarda en entregarse.',
          'No pidas varios seguidos: el sistema solo permite una solicitud por minuto y cada envío invalida el anterior. Usa siempre el correo más reciente.',
          'Confirma que estás revisando el correo institucional que tienes registrado.'
        ],
        note: 'Si pasaron 10 minutos y no hay nada, envía tu mensaje con tu usuario, unidad y CLUES para revisar qué correo tienes registrado.'
      })
    },
    {
      id: 'link_expired',
      intercept: true,
      test: (t) =>
        has(t, /(enlace|link|liga|codigo|token)/) &&
        has(t, /(expir|caduc|venci|invalid|ya (se )?(uso|utilizo)|no (me )?(sirve|funciona|abre|deja))/) &&
        has(t, /(correo|recuper|contrasen|restabl|acceso|sesion|cuenta)/),
      answer: (ctx) => ({
        title: 'Enlace o código vencido',
        paragraphs: [
          'Los enlaces y códigos son de un solo uso y vencen pronto. Además, si solicitas uno nuevo, el anterior deja de servir.'
        ],
        steps: [
          'Solicita uno nuevo y ábrelo enseguida, desde el último correo que recibiste.',
          'Ábrelo en el mismo navegador donde lo pediste (sin vista previa del correo ni apps de terceros).'
        ],
        action: ctx.loggedIn ? null : ACTION_FORGOT
      })
    },
    {
      id: 'refresh_tip',
      intercept: false,
      test: (t) =>
        has(t, /(no se actualiza|no actualiz|no (me )?(aparece|sale|carga|abre)|version (vieja|anterior)|sigue igual|pantalla (en )?blanco|se queda (cargando|pegad|congelad|trabad|en blanco)|no responde|no me deja (guardar|abrir)|se congelo|se trabo)/),
      answer: () => ({
        title: 'Prueba esto primero',
        paragraphs: ['Muchos problemas se resuelven recargando la aplicación:'],
        steps: [
          'Computadora: presiona Ctrl + F5 (o Ctrl + Shift + R) para recargar sin caché.',
          'Celular: cierra la app por completo y ábrela de nuevo; si sigue, borra los datos del sitio desde el navegador.',
          'Revisa tu conexión a internet.'
        ],
        note: 'Si el problema continúa, puedes enviar tu reporte tal cual: incluye una captura de pantalla y qué estabas haciendo.'
      })
    },
    {
      id: 'account_request',
      intercept: false,
      test: (t) =>
        has(t, /(quiero|necesito|solicit|como (obtengo|consigo|creo|saco|tramito)|alta de|dar de alta|crear|creen|nuevo|registrar)( \w+){0,4} (usuario|cuenta|acceso)/) &&
        !has(t, RE_PASS),
      answer: () => ({
        title: 'Alta de usuarios',
        paragraphs: [
          'Las cuentas no se crean solas: las da de alta el administrador. Para agilizarlo, incluye en tu mensaje tu nombre completo, unidad, CLUES, municipio y el correo institucional que quedará registrado.'
        ]
      })
    },
    {
      id: 'account_data',
      intercept: false,
      test: (t) =>
        has(t, /(cambiar|corregir|actualizar|modificar|cambio|esta mal|equivocad)( \w+){0,4} (clues|unidad|municipio|correo|email|rol|permiso|jurisdiccion)/),
      answer: () => ({
        title: 'Datos de tu cuenta',
        paragraphs: [
          'La unidad, CLUES, municipio, rol y correo de tu cuenta los administra el administrador. En tu mensaje indica cuál es el dato correcto para que se pueda corregir.',
          'Tu nombre y teléfono de contacto sí los puedes editar tú en "Mi Perfil" > "Cuenta".'
        ]
      })
    }
  ];

  // ── Motor ─────────────────────────────────────────────────────────────────
  function match(text, ctx) {
    const t = norm(text);
    if (t.length < 8) return null;
    ctx = ctx || {};
    // Una sugerencia no debería frenarse por parecerse a una duda conocida
    if (ctx.type && norm(ctx.type) === 'sugerencia') return null;
    for (const rule of RULES) {
      let ok = false;
      try { ok = rule.test(t); } catch (e) { ok = false; }
      if (ok) return { rule, content: rule.answer(ctx) };
    }
    return null;
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const STYLE_ID = 'fbAutoReplyStyles';
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    // Colores con transparencias: se ven bien tanto en claro como en oscuro.
    st.textContent = `
      .fb-autoreply{margin:4px 0 2px;padding:14px;border-radius:16px;border:1.5px solid rgba(14,165,233,.35);background:rgba(14,165,233,.08);color:inherit;font-size:12.5px;line-height:1.45;text-align:left;animation:fbArIn .22s ease-out}
      .fb-autoreply.fb-ar-pulse{animation:fbArPulse .55s ease-out}
      .fb-autoreply-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
      .fb-autoreply-head .material-symbols-rounded{font-size:20px;color:#0ea5e9;flex:none}
      .fb-autoreply-eyebrow{display:block;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
      .fb-autoreply-title{display:block;font-size:13.5px;font-weight:800;line-height:1.25}
      .fb-autoreply p{margin:0 0 8px;font-weight:600;opacity:.92}
      .fb-autoreply ol{margin:0 0 8px;padding-left:20px;list-style:decimal;font-weight:600;opacity:.92}
      .fb-autoreply li{margin-bottom:3px}
      .fb-autoreply-note{padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.12);font-size:11.5px;font-weight:600;margin-bottom:10px}
      .fb-autoreply-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
      .fb-autoreply-actions button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:36px;padding:0 14px;border-radius:12px;font-size:12px;font-weight:800;text-align:center;-webkit-tap-highlight-color:transparent}
      .fb-autoreply-actions .fb-ar-primary{background:#0ea5e9;color:#fff}
      .fb-autoreply-actions .fb-ar-ok{border:1.5px solid rgba(16,185,129,.6);color:#059669}
      .fb-autoreply-actions .fb-ar-skip{border:1.5px solid rgba(127,127,127,.4);opacity:.85}
      .fb-autoreply-actions button:focus-visible{outline:2px solid #0ea5e9;outline-offset:2px}
      .fb-autoreply-actions .material-symbols-rounded{font-size:16px}
      @keyframes fbArIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
      @keyframes fbArPulse{0%,100%{transform:none}30%{transform:scale(1.015);box-shadow:0 0 0 4px rgba(14,165,233,.25)}}
      @media (prefers-reduced-motion:reduce){.fb-autoreply,.fb-autoreply.fb-ar-pulse{animation:none}}
    `;
    document.head.appendChild(st);
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /**
   * Conecta el motor a un formulario de feedback.
   * @param {Object} o
   * @param {HTMLTextAreaElement} o.textarea      campo del mensaje
   * @param {HTMLFormElement}     o.form          formulario (se intercepta su submit)
   * @param {HTMLSelectElement}   [o.typeSelect]  selector "Tipo de mensaje"
   * @param {Element}             [o.mountAfter]  después de qué elemento va la tarjeta
   * @param {Function}            [o.getContext]  () => ({ loggedIn })
   * @param {Function}            [o.onClose]     cierra el modal de feedback (y lo limpia)
   * @param {Function}            [o.onResolved]  se llamó "Esto resolvió mi duda"
   */
  function attach(o) {
    if (!o || !o.textarea || !o.form) return null;
    ensureStyles();

    const state = { card: null, current: null, bypassedId: null, timer: null };
    const mountAfter = o.mountAfter || o.textarea.closest('.feedback-input-group') || o.textarea.parentElement;

    const getCtx = () => {
      let extra = {};
      try { extra = (o.getContext && o.getContext()) || {}; } catch (e) { /* sin contexto */ }
      return Object.assign(
        { loggedIn: false, type: o.typeSelect ? o.typeSelect.value : '', close: () => o.onClose && o.onClose() },
        extra
      );
    };

    function clear() {
      if (state.card) { state.card.remove(); state.card = null; }
      state.current = null;
    }

    function render(found) {
      const c = found.content;
      const ctx = getCtx();
      const card = el('div', 'fb-autoreply');
      card.setAttribute('role', 'status');
      card.setAttribute('aria-live', 'polite');

      const head = el('div', 'fb-autoreply-head');
      const icon = el('span', 'material-symbols-rounded', 'lightbulb');
      icon.setAttribute('aria-hidden', 'true');
      const titles = el('div');
      titles.appendChild(el('span', 'fb-autoreply-eyebrow', 'Respuesta rápida'));
      titles.appendChild(el('span', 'fb-autoreply-title', c.title));
      head.append(icon, titles);
      card.appendChild(head);

      (c.paragraphs || []).forEach((p) => card.appendChild(el('p', null, p)));
      if (c.steps && c.steps.length) {
        const ol = el('ol');
        c.steps.forEach((s) => ol.appendChild(el('li', null, s)));
        card.appendChild(ol);
      }
      if (c.note) card.appendChild(el('div', 'fb-autoreply-note', c.note));

      const actions = el('div', 'fb-autoreply-actions');
      const mkBtn = (cls, icon, label, fn) => {
        const b = el('button', cls);
        b.type = 'button';
        if (icon) { const i = el('span', 'material-symbols-rounded', icon); i.setAttribute('aria-hidden', 'true'); b.appendChild(i); }
        b.appendChild(el('span', null, label));
        b.addEventListener('click', fn);
        return b;
      };
      if (c.action) actions.appendChild(mkBtn('fb-ar-primary', c.action.icon, c.action.label, () => c.action.run(getCtx())));
      actions.appendChild(mkBtn('fb-ar-ok', 'check_circle', 'Esto resolvió mi duda', () => {
        clear();
        if (typeof window.showToast === 'function') { try { window.showToast('¡Qué bueno que se resolvió!'); } catch (e) { /* noop */ } }
        if (o.onResolved) o.onResolved(found.rule.id); else o.textarea.value = '';
      }));
      if (found.rule.intercept) {
        actions.appendChild(mkBtn('fb-ar-skip', null, 'No, enviar de todos modos', () => {
          state.bypassedId = found.rule.id;
          if (o.form.requestSubmit) o.form.requestSubmit(); else o.form.dispatchEvent(new Event('submit', { cancelable: true }));
        }));
      }
      card.appendChild(actions);

      if (state.card) state.card.replaceWith(card);
      else mountAfter.insertAdjacentElement('afterend', card);
      state.card = card;
      state.current = found;
    }

    function evaluate() {
      const found = match(o.textarea.value, getCtx());
      if (!found) { clear(); return; }
      // Misma regla ya mostrada: no re-renderizar en cada tecla
      if (state.current && state.current.rule.id === found.rule.id && state.card) return;
      render(found);
    }

    o.textarea.addEventListener('input', () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(evaluate, 350);
    });
    if (o.typeSelect) o.typeSelect.addEventListener('change', evaluate);

    // En fase de captura, para correr antes que el manejador que envía a Discord
    o.form.addEventListener('submit', (e) => {
      clearTimeout(state.timer);
      evaluate(); // por si se pulsó "Enviar" antes de que corriera el debounce
      const cur = state.current;
      if (cur && cur.rule.intercept && state.bypassedId !== cur.rule.id) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (state.card) {
          state.card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          state.card.classList.remove('fb-ar-pulse');
          void state.card.offsetWidth; // reinicia la animación
          state.card.classList.add('fb-ar-pulse');
        }
      }
    }, true);

    // Al cerrar/reiniciar el formulario se limpia el estado
    o.form.addEventListener('reset', () => { clear(); state.bypassedId = null; });

    return { clear, evaluate };
  }

  window.FeedbackAutoReply = { attach, match, rules: RULES, _norm: norm };
})();
