/**
 * perfil_cuenta.js — "Mi Perfil > Cuenta": datos de contacto y cambio de contraseña.
 *
 * Lo comparten index.html (escritorio) y mobile.html. Cada pantalla llama una vez a
 * PerfilCuenta.init({...}) con su cliente de Supabase y sus datos de sesión, y luego
 * abre los diálogos con PerfilCuenta.openContacto() / PerfilCuenta.openCambiarPassword().
 *
 * Los diálogos viven en un Shadow DOM: así los resets globales !important de style.css
 * (input/select/button/.modern-input-group) no los deforman ni hace falta pelear con ellos.
 *
 * Cambio de contraseña con código por correo (100% servicios incluidos en Supabase Auth,
 * sin Edge Functions ni servicios de pago):
 *   1) auth.resetPasswordForEmail(email)          -> Supabase manda el correo de recuperación
 *   2) auth.verifyOtp({email, token, type:'recovery'}) -> el SERVIDOR valida el código de 6 dígitos
 *   3) auth.updateUser({ password })              -> guarda la nueva contraseña
 * Requiere que la plantilla "Reset Password" del correo (Dashboard > Authentication >
 * Emails) incluya {{ .Token }}; ver la nota al final de supabase/perfil_contacto.sql.
 * Si la plantilla solo trae el enlace, el mismo correo sigue funcionando: el enlace lleva a reset.html.
 *
 * Nombre y teléfono se guardan con la RPC public.actualizar_mi_contacto (valida en servidor).
 */
(function () {
  'use strict';

  const COOLDOWN_MS = 60000;                       // Supabase limita 1 correo por minuto por usuario
  const COOLDOWN_KEY = 'JS1_last_reset_request';   // misma llave que el flujo "Olvidé mi contraseña"
  const MIN_PASSWORD = 8;

  let cfg = null;
  let host = null;
  let root = null;
  let cooldownTimer = null;

  // ── Utilidades ────────────────────────────────────────────────────────────
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  };

  function maskEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [l, d] = email.split('@');
    return (l.length <= 3 ? l[0] + '***' : l.slice(0, 3) + '***' + l.slice(-2)) + '@' + d;
  }

  const digits = (s) => String(s || '').replace(/\D/g, '');
  function normalizePhone(s) {
    let d = digits(s);
    if (d.length === 12 && d.startsWith('52')) d = d.slice(2);
    return d;
  }
  function formatPhone(d) {
    d = normalizePhone(d);
    if (d.length !== 10) return d;
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }

  function cooldownLeft() {
    try {
      const last = parseInt(localStorage.getItem(COOLDOWN_KEY) || '0', 10);
      return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000));
    } catch (e) { return 0; }
  }
  function markSent() { try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) { /* noop */ } }

  function friendlyAuthError(err) {
    const m = String((err && err.message) || err || '').toLowerCase();
    if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) return 'El código es incorrecto o ya venció. Revisa el correo más reciente o solicita uno nuevo.';
    if (m.includes('rate limit') || m.includes('for security purposes') || m.includes('seconds') || m.includes('too many')) return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
    if (m.includes('different from the old') || (m.includes('same') && m.includes('password'))) return 'La nueva contraseña debe ser distinta a la actual.';
    if (m.includes('weak') || m.includes('at least')) return 'La contraseña es muy débil. Usa al menos 8 caracteres combinando letras y números.';
    if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
    return (err && err.message) || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  // ── Shadow DOM base ───────────────────────────────────────────────────────
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box;font-family:'Inter','Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
    .ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.5);animation:fade .18s ease-out}
    .card{width:100%;max-width:440px;max-height:calc(100dvh - 32px);overflow:auto;background:var(--bg);color:var(--fg);border-radius:28px;padding:24px;box-shadow:0 16px 48px rgba(0,0,0,.22);animation:rise .22s ease-out}
    :host{--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--field:#f1f5f9;--accent:#0284c7;--accent-fg:#fff;--ok:#059669;--bad:#dc2626}
    :host(.dark){--bg:#1e293b;--fg:#f1f5f9;--muted:#94a3b8;--line:#334155;--field:#0f172a;--accent:#38bdf8;--accent-fg:#082f49;--ok:#34d399;--bad:#f87171}
    .head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:6px}
    h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}
    .sub{margin:4px 0 18px;font-size:13px;line-height:1.5;color:var(--muted);font-weight:500}
    .x{all:unset;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
    .x:hover{background:var(--field)}
    label{display:block;margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .fld{margin-bottom:14px}
    .inp{display:flex;align-items:center;background:var(--field);border:1.5px solid transparent;border-radius:14px}
    .inp:focus-within{border-color:var(--accent)}
    input{all:unset;box-sizing:border-box;flex:1;min-width:0;height:48px;padding:0 14px;font-size:15px;font-weight:600;color:var(--fg)}
    input::placeholder{color:var(--muted);font-weight:500}
    input.code{letter-spacing:.35em;font-size:20px;font-weight:800;text-align:center}
    .eye{all:unset;cursor:pointer;width:44px;height:48px;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
    .hint{margin:6px 2px 0;font-size:11.5px;color:var(--muted);font-weight:500;line-height:1.4}
    .msg{margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:12.5px;font-weight:600;line-height:1.4}
    .msg.bad{background:rgba(220,38,38,.12);color:var(--bad)}
    .msg.ok{background:rgba(5,150,105,.12);color:var(--ok)}
    .msg.info{background:rgba(2,132,199,.10);color:var(--fg)}
    .row{display:flex;gap:10px;margin-top:6px;flex-wrap:wrap}
    .btn{all:unset;box-sizing:border-box;cursor:pointer;flex:1;min-width:120px;min-height:46px;padding:0 18px;border-radius:14px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;text-align:center;-webkit-tap-highlight-color:transparent}
    .btn.pri{background:var(--accent);color:var(--accent-fg)}
    .btn.sec{background:var(--field);color:var(--fg)}
    .btn[disabled],.btn[aria-disabled=true]{opacity:.5;cursor:not-allowed}
    .btn:focus-visible,.x:focus-visible,.eye:focus-visible,.lnk:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .lnk{all:unset;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--accent)}
    .lnk[disabled]{color:var(--muted);cursor:default}
    .center{text-align:center;padding:8px 0}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ov,.card{animation:none}}
    @media (max-width:480px){.ov{align-items:flex-end;padding:0}.card{max-width:none;border-radius:28px 28px 0 0}}
  `;

  const SVG_X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const SVG_EYE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'perfilCuentaHost';
    root = host.attachShadow({ mode: 'open' });
    root.appendChild(el('style', { text: CSS }));
    document.body.appendChild(host);
  }

  function isDark() {
    const d = document.documentElement;
    return d.classList.contains('dark') || d.dataset.theme === 'dark' || document.body.classList.contains('dark');
  }

  function closeDialog() {
    clearInterval(cooldownTimer);
    if (!root) return;
    root.querySelectorAll('.ov').forEach((n) => n.remove());
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) { if (e.key === 'Escape') closeDialog(); }

  function openDialog(title, sub, build) {
    ensureHost();
    closeDialog();
    host.classList.toggle('dark', isDark());
    const body = el('div');
    const card = el('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('div', { class: 'head' },
        el('h2', { text: title }),
        el('button', { class: 'x', type: 'button', 'aria-label': 'Cerrar', onclick: closeDialog })),
      el('p', { class: 'sub', text: sub }),
      body);
    card.querySelector('.x').innerHTML = SVG_X;
    const ov = el('div', { class: 'ov', onmousedown: (e) => { if (e.target === ov) closeDialog(); } }, card);
    root.appendChild(ov);
    document.addEventListener('keydown', onKey, true);
    build(body);
    const first = body.querySelector('input');
    if (first) setTimeout(() => first.focus(), 60);
  }

  function field(id, label, inputAttrs, hint, withEye) {
    const input = el('input', Object.assign({ id, autocomplete: 'off' }, inputAttrs));
    const wrap = el('div', { class: 'inp' }, input);
    if (withEye) {
      const eye = el('button', { class: 'eye', type: 'button', 'aria-label': 'Mostrar u ocultar contraseña',
        onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } });
      eye.innerHTML = SVG_EYE;
      wrap.append(eye);
    }
    return { input, node: el('div', { class: 'fld' }, el('label', { for: id, text: label }), wrap, hint ? el('p', { class: 'hint', text: hint }) : null) };
  }

  const setMsg = (slot, kind, text) => {
    slot.replaceChildren();
    if (text) slot.append(el('div', { class: `msg ${kind}`, role: kind === 'bad' ? 'alert' : 'status', text }));
  };

  const client = () => cfg && cfg.getClient && cfg.getClient();

  // ── Datos de contacto ─────────────────────────────────────────────────────
  async function openContacto() {
    if (!cfg) return;
    const u = (cfg.getUser && cfg.getUser()) || {};
    openDialog('Datos de contacto', 'Así podremos identificarte y comunicarnos contigo si hay algo que aclarar sobre tu unidad.', (body) => {
      const slot = el('div');
      const nombre = field('pcNombre', 'Nombre completo', { type: 'text', maxlength: '120', placeholder: 'Ej. María Fernanda López Ruiz', autocomplete: 'name' });
      const tel = field('pcTelefono', 'Teléfono de contacto', { type: 'tel', inputmode: 'tel', maxlength: '18', placeholder: '10 dígitos', autocomplete: 'tel' }, 'Solo lo verá el administrador. No se envían mensajes SMS.');
      nombre.input.value = u.nombre || '';
      tel.input.value = formatPhone(u.telefono || '');
      const save = el('button', { class: 'btn pri', type: 'submit', text: 'Guardar' });
      const cancel = el('button', { class: 'btn sec', type: 'button', text: 'Cancelar', onclick: closeDialog });
      const form = el('form', { novalidate: true }, slot, nombre.node, tel.node, el('div', { class: 'row' }, cancel, save));
      body.append(form);

      // Trae lo último guardado (la sesión pudo abrirse antes de guardar en otro dispositivo)
      (async () => {
        try {
          const c = client();
          if (!c || !u.uid) return;
          const { data } = await c.from('perfiles').select('nombre, telefono').eq('id', u.uid).maybeSingle();
          if (data && document.activeElement !== nombre.input && !nombre.input.value) nombre.input.value = data.nombre || '';
          if (data && document.activeElement !== tel.input && !tel.input.value) tel.input.value = formatPhone(data.telefono || '');
        } catch (e) { /* se queda con lo de la sesión */ }
      })();

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const n = nombre.input.value.replace(/\s+/g, ' ').trim();
        const t = normalizePhone(tel.input.value);
        if (n && n.length < 3) return setMsg(slot, 'bad', 'Escribe tu nombre completo (mínimo 3 letras).');
        if (t && t.length !== 10) return setMsg(slot, 'bad', 'El teléfono debe tener 10 dígitos (lada + número).');
        save.disabled = true; save.textContent = 'Guardando…'; setMsg(slot, 'info', '');
        try {
          const { data, error } = await client().rpc('actualizar_mi_contacto', { p_nombre: n, p_telefono: t });
          if (error) throw error;
          if (cfg.onContactSaved) cfg.onContactSaved({ nombre: (data && data.nombre) || '', telefono: (data && data.telefono) || '' });
          closeDialog();
          if (cfg.toast) cfg.toast('Datos de contacto guardados', 'good');
        } catch (err) {
          save.disabled = false; save.textContent = 'Guardar';
          setMsg(slot, 'bad', friendlyAuthError(err));
        }
      });
    });
  }

  // ── Cambio de contraseña con código por correo ────────────────────────────
  function openCambiarPassword() {
    if (!cfg) return;
    const u = (cfg.getUser && cfg.getUser()) || {};
    if (!u.email) { if (cfg.toast) cfg.toast('No se encontró un correo asociado a tu cuenta', 'bad'); return; }

    openDialog('Cambiar contraseña', 'Por seguridad, confirmaremos que eres tú con un código que enviaremos a tu correo.', (body) => {
      const mail = maskEmail(u.email);
      const slot = el('div');
      body.append(slot);

      // Paso 1 — enviar código
      const step1 = () => {
        const send = el('button', { class: 'btn pri', type: 'button', text: 'Enviar código' });
        const cancel = el('button', { class: 'btn sec', type: 'button', text: 'Cancelar', onclick: closeDialog });
        body.replaceChildren(slot, el('p', { class: 'sub', text: `Enviaremos un código de 6 dígitos a ${mail}.` }), el('div', { class: 'row' }, cancel, send));
        send.addEventListener('click', async () => {
          const wait = cooldownLeft();
          if (wait > 0) { setMsg(slot, 'info', `Ya se envió un código hace un momento. Espera ${wait} s para pedir otro, o usa el que ya te llegó.`); step2(); return; }
          await sendCode(send);
        });
      };

      async function sendCode(btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
        try {
          const { error } = await client().auth.resetPasswordForEmail(u.email, cfg.redirectTo ? { redirectTo: cfg.redirectTo } : undefined);
          if (error) throw error;
          markSent();
          setMsg(slot, 'ok', `Código enviado a ${mail}. Revisa también SPAM o correo no deseado.`);
          step2();
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'Enviar código'; }
          setMsg(slot, 'bad', friendlyAuthError(err));
        }
      }

      // Paso 2 — código + contraseña nueva
      const step2 = () => {
        const code = field('pcCode', 'Código del correo', { type: 'text', inputmode: 'numeric', maxlength: '8', autocomplete: 'one-time-code', placeholder: '000000', class: 'code' });
        const p1 = field('pcPass1', 'Nueva contraseña', { type: 'password', autocomplete: 'new-password', placeholder: `Mínimo ${MIN_PASSWORD} caracteres` }, null, true);
        const p2 = field('pcPass2', 'Confirmar nueva contraseña', { type: 'password', autocomplete: 'new-password', placeholder: 'Repite la contraseña' }, null, true);
        const resend = el('button', { class: 'lnk', type: 'button' });
        const submit = el('button', { class: 'btn pri', type: 'submit', text: 'Cambiar contraseña' });
        const cancel = el('button', { class: 'btn sec', type: 'button', text: 'Cancelar', onclick: closeDialog });
        const form = el('form', { novalidate: true },
          code.node, p1.node, p2.node,
          el('p', { class: 'hint', text: 'Si tu correo solo trae un enlace y no un código, ábrelo: también te lleva a cambiar la contraseña.' }),
          el('div', { class: 'row' }, cancel, submit),
          el('div', { class: 'center' }, resend));
        body.replaceChildren(slot, form);
        setTimeout(() => code.input.focus(), 40);

        const tick = () => {
          const left = cooldownLeft();
          resend.disabled = left > 0;
          resend.textContent = left > 0 ? `Reenviar código (${left} s)` : 'Reenviar código';
        };
        clearInterval(cooldownTimer);
        tick(); cooldownTimer = setInterval(tick, 1000);
        resend.addEventListener('click', async () => {
          if (cooldownLeft() > 0) return;
          resend.disabled = true;
          try {
            const { error } = await client().auth.resetPasswordForEmail(u.email, cfg.redirectTo ? { redirectTo: cfg.redirectTo } : undefined);
            if (error) throw error;
            markSent(); setMsg(slot, 'ok', `Enviamos un código nuevo a ${mail}. El anterior ya no sirve.`);
          } catch (err) { setMsg(slot, 'bad', friendlyAuthError(err)); }
          tick();
        });

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const token = digits(code.input.value);
          const a = p1.input.value, b = p2.input.value;
          if (!/^\d{6,8}$/.test(token)) return setMsg(slot, 'bad', 'Escribe el código de 6 dígitos que llegó a tu correo.');
          if (a.length < MIN_PASSWORD) return setMsg(slot, 'bad', `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
          if (!/[A-Za-z]/.test(a) || !/\d/.test(a)) return setMsg(slot, 'bad', 'Combina letras y números en tu contraseña.');
          if (a !== b) return setMsg(slot, 'bad', 'La confirmación no coincide con la nueva contraseña.');

          submit.disabled = true; submit.textContent = 'Verificando…'; setMsg(slot, 'info', '');
          try {
            const c = client();
            // El servidor valida el código (si es incorrecto o venció, falla aquí y no se cambia nada)
            const v = await c.auth.verifyOtp({ email: u.email, token, type: 'recovery' });
            if (v.error) throw v.error;
            const up = await c.auth.updateUser({ password: a, data: { force_password_change: false } });
            if (up.error) throw up.error;
            if (cfg.onPasswordChanged) { try { await cfg.onPasswordChanged(); } catch (e2) { /* la contraseña ya cambió */ } }
            done();
          } catch (err) {
            submit.disabled = false; submit.textContent = 'Cambiar contraseña';
            setMsg(slot, 'bad', friendlyAuthError(err));
          }
        });
      };

      const done = () => {
        clearInterval(cooldownTimer);
        const ok = el('button', { class: 'btn pri', type: 'button', text: 'Listo', onclick: closeDialog });
        body.replaceChildren(
          el('div', { class: 'msg ok', role: 'status', text: 'Tu contraseña se actualizó correctamente. Úsala la próxima vez que inicies sesión.' }),
          el('div', { class: 'row' }, ok));
        if (cfg.toast) cfg.toast('Contraseña actualizada con éxito', 'good');
      };

      // Si ya se pidió un código hace menos de un minuto, entra directo al paso del código
      if (cooldownLeft() > 0) { setMsg(slot, 'info', 'Ya solicitaste un código hace un momento; escríbelo aquí. Si no te llegó, podrás reenviarlo en unos segundos.'); step2(); }
      else step1();
    });
  }

  window.PerfilCuenta = {
    /**
     * @param {Object} c
     * @param {() => any} c.getClient        cliente de Supabase ya inicializado
     * @param {() => {uid,email,nombre,telefono}} c.getUser  datos de la sesión actual
     * @param {string} [c.redirectTo]        URL del enlace del correo (reset.html)
     * @param {(msg:string, kind:'good'|'bad')=>void} [c.toast]
     * @param {(p:{nombre,telefono})=>void} [c.onContactSaved]
     * @param {() => Promise<void>|void} [c.onPasswordChanged]  p.ej. sincronizar must_change
     */
    init(c) { cfg = c; },
    openContacto,
    openCambiarPassword,
    // expuestos para pruebas
    _normalizePhone: normalizePhone,
    _formatPhone: formatPhone
  };
})();
