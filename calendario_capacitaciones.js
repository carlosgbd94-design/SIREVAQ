/**
 * calendario_capacitaciones.js — Calendario anual de capacitaciones.
 *
 * ADMIN / JURISDICCIONAL registran fecha, hora, tema y sede; el resto de los roles (UNIDAD
 * incluida) lo consulta. Una sola vista sirve para dos lugares:
 *   - CalendarioCap.openCalendar()   -> ventana emergente (botón "Calendario" del perfil UNIDAD)
 *   - CalendarioCap.mount(elemento)  -> incrustada en un panel (pestaña "Capacitaciones" del admin)
 * y además avisa cuando se aproxima una capacitación (CalendarioCap.checkReminders()).
 *
 * Todo vive en Shadow DOM: los resets globales !important de style.css (input/select/button)
 * no deforman los controles. Tabla: public.calendario_capacitaciones (supabase/calendario_capacitaciones.sql).
 */
(function () {
  'use strict';

  const TABLE = 'calendario_capacitaciones';
  const REMIND_DAYS = 7;                       // desde cuántos días antes se avisa
  const REMIND_KEY = 'JS1_cal_cap_recordado';  // localStorage: avisos ya mostrados
  const EDIT_ROLES = ['ADMIN', 'JURISDICCIONAL'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS_C = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const MODALIDADES = { PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', MIXTA: 'Mixta' };

  let cfg = null;
  let cache = { rows: null, at: 0 };
  let reminderRun = null;

  // ── Utilidades ────────────────────────────────────────────────────────────
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => c != null && c !== false && n.append(c));
    return n;
  };

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const daysUntil = (s) => Math.round((parseISO(s) - today()) / 86400000);
  const fmtLong = (s) => { const d = parseISO(s); return `${d.getDate()} ${MESES_C[d.getMonth()]} ${d.getFullYear()}`; };
  const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
  const horario = (r) => (r.hora_inicio ? `${hhmm(r.hora_inicio)}${r.hora_fin ? ' – ' + hhmm(r.hora_fin) : ''} h` : '');
  const role = () => String((cfg && cfg.getUser() && cfg.getUser().rol) || '').trim().toUpperCase();
  const canEdit = () => EDIT_ROLES.includes(role());
  const toast = (msg, kind) => { if (cfg && cfg.toast) cfg.toast(msg, kind); };

  function countdown(r) {
    const n = daysUntil(r.fecha);
    if (n < 0) return { text: 'Realizada', tone: 'past', n };
    if (n === 0) return { text: 'Hoy', tone: 'now', n };
    if (n === 1) return { text: 'Mañana', tone: 'soon', n };
    if (n <= REMIND_DAYS) return { text: `En ${n} días`, tone: 'soon', n };
    return { text: `En ${n} días`, tone: 'future', n };
  }

  function isDark() {
    const d = document.documentElement;
    return d.classList.contains('dark') || d.dataset.theme === 'dark' || document.body.classList.contains('dark');
  }

  // ── Datos ─────────────────────────────────────────────────────────────────
  async function fetchRows(force) {
    if (!force && cache.rows && Date.now() - cache.at < 60000) return cache.rows;
    const client = cfg.getClient();
    const { data, error } = await client.from(TABLE).select('*').eq('activo', true)
      .order('fecha', { ascending: true }).order('hora_inicio', { ascending: true, nullsFirst: true });
    if (error) throw error;
    cache = { rows: data || [], at: Date.now() };
    return cache.rows;
  }
  const invalidate = () => { cache = { rows: null, at: 0 }; };

  async function notifyUnits(row, mode) {
    const user = cfg.getUser() || {};
    const titulo = mode === 'updated' ? 'Capacitación actualizada' : 'Nueva capacitación programada';
    const msg = `${mode === 'updated' ? 'Se actualizó' : 'Se programó'} "${row.tema}" el ${fmtLong(row.fecha)}`
      + `${horario(row) ? ', ' + horario(row) : ''}. Sede: ${row.sede}. Consulta el Calendario de capacitaciones.`;
    const client = cfg.getClient();
    for (const destino of ['UNIDAD', 'MUNICIPAL']) {
      await client.from('notificaciones').insert({
        id: crypto.randomUUID(),
        from_usuario: user.usuario || 'SISTEMA',
        from_rol: user.rol || 'ADMIN',
        target_scope: 'ROLE',
        target_usuario: destino,
        type: 'INFO',
        title: titulo,
        message: msg,
        status: 'UNREAD',
      });
    }
  }

  // ── Archivo .ics (agregar al calendario del celular) ──────────────────────
  function downloadIcs(r) {
    const stamp = (s, t) => s.replace(/-/g, '') + (t ? 'T' + hhmm(t).replace(':', '') + '00' : '');
    const next = parseISO(r.fecha); next.setDate(next.getDate() + 1);
    const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SIREVAQ//Calendario de capacitaciones//ES', 'BEGIN:VEVENT',
      `UID:${r.id}@sirevaq`, `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`];
    if (r.hora_inicio) {
      lines.push(`DTSTART:${stamp(r.fecha, r.hora_inicio)}`, `DTEND:${stamp(r.fecha, r.hora_fin || r.hora_inicio)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${r.fecha.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${iso(next).replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${esc('Capacitación: ' + r.tema)}`,
      `LOCATION:${esc([r.sede, r.direccion].filter(Boolean).join(' — '))}`,
      `DESCRIPTION:${esc([r.dirigido_a && 'Dirigido a: ' + r.dirigido_a, r.notas].filter(Boolean).join('\n'))}`,
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Capacitación mañana', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'capacitacion_' + r.fecha + '.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ── Estilos (Shadow DOM) ──────────────────────────────────────────────────
  const CSS = `
    :host{all:initial;display:block;--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--field:#f1f5f9;--accent:#0b5cad;--accent-fg:#fff;--accent-soft:rgba(11,92,173,.09);--ok:#059669;--warn:#b45309;--warn-bg:rgba(245,158,11,.16);--bad:#dc2626}
    :host(.dark){--bg:#1e293b;--fg:#f1f5f9;--muted:#94a3b8;--line:#334155;--field:#0f172a;--accent:#38bdf8;--accent-fg:#082f49;--accent-soft:rgba(56,189,248,.14);--ok:#34d399;--warn:#fbbf24;--warn-bg:rgba(251,191,36,.16);--bad:#f87171}
    *{box-sizing:border-box;font-family:'Inter','Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
    .ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.5);animation:fade .18s ease-out}
    .card{width:100%;max-width:960px;max-height:calc(100dvh - 32px);overflow:auto;background:var(--bg);color:var(--fg);border-radius:28px;padding:24px;box-shadow:0 16px 48px rgba(0,0,0,.22);animation:rise .22s ease-out}
    .card.sm{max-width:520px}
    .embedded{background:var(--bg);color:var(--fg);border-radius:28px;padding:24px;border:1px solid var(--line)}
    .head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
    h2{margin:0;font-size:20px;font-weight:800;letter-spacing:-.01em}
    .sub{margin:2px 0 0;font-size:12.5px;color:var(--muted);font-weight:500}
    .tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .yr{display:flex;align-items:center;gap:2px;background:var(--field);border-radius:999px;padding:3px}
    .yr b{min-width:56px;text-align:center;font-size:15px;font-weight:800}
    .ib{all:unset;cursor:pointer;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none;font-size:18px;line-height:1}
    .ib:hover{background:var(--accent-soft);color:var(--accent)}
    .ib.del:hover{background:rgba(220,38,38,.12);color:var(--bad)}
    .btn{all:unset;box-sizing:border-box;cursor:pointer;min-height:40px;padding:0 16px;border-radius:12px;font-size:13px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:6px;text-align:center;-webkit-tap-highlight-color:transparent}
    .btn.pri{background:var(--accent);color:var(--accent-fg)}
    .btn.sec{background:var(--field);color:var(--fg)}
    .btn[disabled]{opacity:.5;cursor:not-allowed}
    .btn:focus-visible,.ib:focus-visible,.chip:focus-visible,.day:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .chip{all:unset;cursor:pointer;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:800;color:var(--muted);background:var(--field)}
    .chip.on{background:var(--accent-soft);color:var(--accent)}
    .next{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:var(--accent-soft);margin-bottom:18px}
    .next.soon{background:var(--warn-bg)}
    .next .big{flex:none;width:52px;text-align:center;line-height:1}
    .next .big b{display:block;font-size:24px;font-weight:800}
    .next .big span{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .next .t{font-size:14px;font-weight:800}
    .next .s{font-size:12.5px;color:var(--muted);font-weight:600;margin-top:2px}
    .months{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px;margin-bottom:22px}
    .mini{border:1px solid var(--line);border-radius:16px;padding:10px 10px 8px}
    .mini h4{margin:0 0 6px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    .mini.cur h4{color:var(--accent)}
    .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center}
    .grid .dh{font-size:9.5px;font-weight:800;color:var(--muted);padding-bottom:2px}
    .day{all:unset;box-sizing:border-box;height:22px;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;border-radius:50%;color:var(--fg)}
    .day.today{box-shadow:inset 0 0 0 1.5px var(--accent)}
    .day.ev{background:var(--accent);color:var(--accent-fg);font-weight:800;cursor:pointer}
    .day.ev.past{background:var(--muted);opacity:.6}
    .day.ev.soon{background:var(--warn);color:#fff}
    .agenda h3{margin:18px 0 8px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .ev-row{display:flex;gap:14px;padding:14px;border:1px solid var(--line);border-radius:18px;margin-bottom:8px;transition:background .3s,border-color .3s}
    .ev-row.flash{background:var(--accent-soft);border-color:var(--accent)}
    .ev-row.past{opacity:.62}
    .date{flex:none;width:52px;text-align:center;border-radius:14px;background:var(--field);padding:6px 0;line-height:1}
    .date b{display:block;font-size:20px;font-weight:800}
    .date span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .body{flex:1;min-width:0}
    .ttl{font-size:14.5px;font-weight:800;line-height:1.3;word-break:break-word}
    .meta{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:5px;font-size:12.5px;color:var(--muted);font-weight:600}
    .tag{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:800;background:var(--field);color:var(--muted);margin-left:6px;vertical-align:middle}
    .tag.soon,.tag.now{background:var(--warn-bg);color:var(--warn)}
    .tag.future{background:var(--accent-soft);color:var(--accent)}
    .note{margin-top:6px;font-size:12px;color:var(--muted);font-weight:500;line-height:1.45}
    .acts{display:flex;align-items:flex-start;flex:none}
    .empty{text-align:center;padding:36px 12px;color:var(--muted);font-size:13.5px;font-weight:600}
    .msg{padding:10px 12px;border-radius:12px;font-size:12.5px;font-weight:600;background:rgba(220,38,38,.12);color:var(--bad);margin-bottom:12px}
    .fld{margin-bottom:14px}
    .fld.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    label{display:block;margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    input,textarea{all:unset;box-sizing:border-box;display:block;width:100%;min-height:44px;padding:0 14px;font-size:14px;font-weight:600;color:var(--fg);background:var(--field);border:1.5px solid transparent;border-radius:12px;font-family:inherit}
    textarea{padding:11px 14px;min-height:72px;white-space:pre-wrap;line-height:1.4;font-weight:500}
    input:focus,textarea:focus{border-color:var(--accent)}
    input::placeholder,textarea::placeholder{color:var(--muted);font-weight:500}
    input[type=date],input[type=time]{color-scheme:light}
    :host(.dark) input[type=date],:host(.dark) input[type=time]{color-scheme:dark}
    .seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:12px;background:var(--field)}
    .seg button{all:unset;cursor:pointer;height:36px;border-radius:9px;text-align:center;font-size:12.5px;font-weight:800;color:var(--muted);display:flex;align-items:center;justify-content:center}
    .seg button.on{background:var(--bg);color:var(--accent);box-shadow:0 1px 2px rgba(15,23,42,.14)}
    .chk{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;text-transform:none;letter-spacing:0;color:var(--fg);cursor:pointer}
    .chk input{width:18px;min-height:18px;height:18px;padding:0;accent-color:var(--accent);display:inline-block}
    .foot{display:flex;justify-content:flex-end;gap:10px;margin-top:8px}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ov,.card{animation:none}}
    @media (max-width:560px){.ov{align-items:flex-end;padding:0}.card{max-width:none;border-radius:28px 28px 0 0;padding:18px}.ev-row{padding:12px;gap:10px}.fld.two{grid-template-columns:1fr}.embedded{padding:16px}}
  `;

  // ── Vista (modal o incrustada) ────────────────────────────────────────────
  function createView(root, opts) {
    const state = { year: today().getFullYear(), rows: [], loading: true, error: '', onlyUpcoming: false };
    const mount = el('div');
    root.append(mount);

    const yearRows = () => state.rows.filter((r) => parseISO(r.fecha).getFullYear() === state.year
      && (!state.onlyUpcoming || daysUntil(r.fecha) >= 0));

    async function load(force) {
      state.loading = true; state.error = ''; render();
      try { state.rows = await fetchRows(force); }
      catch (e) { state.error = (e && e.message) || 'No se pudo cargar el calendario.'; }
      state.loading = false; render();
    }

    function miniMonth(m, rows) {
      const first = new Date(state.year, m, 1);
      const lead = (first.getDay() + 6) % 7;                 // lunes = 0
      const total = new Date(state.year, m + 1, 0).getDate();
      const t = today();
      const grid = el('div', { class: 'grid' }, DIAS_C.map((d) => el('div', { class: 'dh', text: d })));
      for (let i = 0; i < lead; i++) grid.append(el('div'));
      for (let d = 1; d <= total; d++) {
        const key = `${state.year}-${pad(m + 1)}-${pad(d)}`;
        const evs = rows.filter((r) => r.fecha === key);
        const cls = ['day'];
        if (state.year === t.getFullYear() && m === t.getMonth() && d === t.getDate()) cls.push('today');
        if (evs.length) {
          const n = daysUntil(key);
          cls.push('ev'); if (n < 0) cls.push('past'); else if (n <= REMIND_DAYS) cls.push('soon');
          grid.append(el('button', {
            class: cls.join(' '), type: 'button', text: String(d),
            title: evs.map((r) => r.tema).join(' · '), 'aria-label': `${d} de ${MESES[m]}: ${evs.map((r) => r.tema).join(', ')}`,
            onclick: () => focusEvent(evs[0].id),
          }));
        } else grid.append(el('div', { class: cls.join(' '), text: String(d) }));
      }
      const cur = state.year === t.getFullYear() && m === t.getMonth();
      return el('div', { class: 'mini' + (cur ? ' cur' : '') }, el('h4', { text: MESES[m] }), grid);
    }

    function focusEvent(id) {
      const row = mount.querySelector(`[data-id="${id}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1600);
    }

    function eventRow(r) {
      const d = parseISO(r.fecha);
      const c = countdown(r);
      const meta = [
        el('span', { text: '📍 ' + r.sede + (r.direccion ? ' — ' + r.direccion : '') }),
        horario(r) && el('span', { text: '🕒 ' + horario(r) }),
        el('span', { text: MODALIDADES[r.modalidad] || 'Presencial' }),
        r.dirigido_a && el('span', { text: '👥 ' + r.dirigido_a }),
      ];
      const acts = el('div', { class: 'acts' },
        el('button', { class: 'ib', type: 'button', title: 'Agregar a mi calendario (.ics)', 'aria-label': 'Agregar a mi calendario', text: '🗓', onclick: () => downloadIcs(r) }));
      if (opts.editable) {
        acts.append(
          el('button', { class: 'ib', type: 'button', title: 'Editar', 'aria-label': 'Editar', text: '✎', onclick: () => openForm(r) }),
          el('button', { class: 'ib del', type: 'button', title: 'Eliminar', 'aria-label': 'Eliminar', text: '🗑', onclick: () => remove(r) }));
      }
      return el('div', { class: 'ev-row' + (c.tone === 'past' ? ' past' : ''), 'data-id': r.id },
        el('div', { class: 'date' }, el('b', { text: String(d.getDate()) }), el('span', { text: MESES_C[d.getMonth()] })),
        el('div', { class: 'body' },
          el('div', { class: 'ttl' }, r.tema, el('span', { class: 'tag ' + c.tone, text: c.text })),
          el('div', { class: 'meta' }, meta),
          r.notas && el('div', { class: 'note', text: r.notas })),
        acts);
    }

    async function remove(r) {
      const ok = window.showConfirmDialog
        ? await window.showConfirmDialog('Eliminar capacitación', `¿Eliminar "${r.tema}" del calendario?`)
        : window.confirm(`¿Eliminar "${r.tema}" del calendario?`);
      if (!ok) return;
      const { error } = await cfg.getClient().from(TABLE).delete().eq('id', r.id);
      if (error) { toast('No se pudo eliminar: ' + error.message, 'bad'); return; }
      toast('Capacitación eliminada', 'good');
      invalidate(); await load(true); refreshBadges();
    }

    function openForm(row) {
      const isNew = !row;
      const f = Object.assign({ fecha: iso(today()), hora_inicio: '', hora_fin: '', tema: '', sede: '', direccion: '', modalidad: 'PRESENCIAL', dirigido_a: '', notas: '' }, row || {});
      f.hora_inicio = hhmm(f.hora_inicio); f.hora_fin = hhmm(f.hora_fin);
      const errBox = el('div', { class: 'msg', style: 'display:none' });
      const mkField = (id, label, attrs) => {
        const control = el(attrs.rows ? 'textarea' : 'input', Object.assign({ id, autocomplete: 'off' }, attrs));
        control.value = f[id] || '';
        return el('div', { class: 'fld' }, el('label', { for: id, text: label }), control);
      };
      const segBtns = Object.entries(MODALIDADES).map(([k, v]) => el('button', {
        type: 'button', class: k === f.modalidad ? 'on' : '',
        onclick: () => { f.modalidad = k; segBtns.forEach((b, i) => b.classList.toggle('on', Object.keys(MODALIDADES)[i] === k)); },
        text: v,
      }));
      const notify = el('input', { type: 'checkbox', id: 'cc_notify' });
      notify.checked = isNew;
      const saveBtn = el('button', { class: 'btn pri', type: 'button', text: isNew ? 'Agregar' : 'Guardar' });

      const card = el('div', { class: 'card sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': isNew ? 'Nueva capacitación' : 'Editar capacitación' },
        el('div', { class: 'head' }, el('div', null, el('h2', { text: isNew ? 'Nueva capacitación' : 'Editar capacitación' }),
          el('p', { class: 'sub', text: 'Se publica en el calendario anual de todas las unidades.' })),
          el('button', { class: 'ib', type: 'button', 'aria-label': 'Cerrar', text: '✕', onclick: closeForm })),
        errBox,
        mkField('tema', 'Tema', { placeholder: 'Ej: Red de frío y manejo de biológicos', maxlength: '160' }),
        mkField('fecha', 'Fecha', { type: 'date' }),
        el('div', { class: 'fld two' },
          mkField('hora_inicio', 'Hora de inicio', { type: 'time' }),
          mkField('hora_fin', 'Hora de término', { type: 'time' })),
        mkField('sede', 'Sede', { placeholder: 'Ej: Auditorio de la Jurisdicción Sanitaria 1', maxlength: '160' }),
        mkField('direccion', 'Dirección (opcional)', { placeholder: 'Calle, número, colonia', maxlength: '200' }),
        el('div', { class: 'fld' }, el('label', { text: 'Modalidad' }), el('div', { class: 'seg' }, segBtns)),
        mkField('dirigido_a', 'Dirigido a (opcional)', { placeholder: 'Ej: Responsables de vacunación', maxlength: '160' }),
        mkField('notas', 'Notas (opcional)', { rows: '3', placeholder: 'Qué llevar, enlace de la sesión, etc.', maxlength: '500' }),
        el('div', { class: 'fld' }, el('label', { class: 'chk' }, notify, 'Avisar a unidades y municipios por notificación')),
        el('div', { class: 'foot' }, el('button', { class: 'btn sec', type: 'button', text: 'Cancelar', onclick: closeForm }), saveBtn));
      // Host propio en <body>: dentro de un panel con transform, "fixed" no centra respecto a la ventana.
      const formHost = document.createElement('div');
      formHost.id = 'calendarioCapFormHost';
      formHost.classList.toggle('dark', isDark());
      const formRoot = formHost.attachShadow({ mode: 'open' });
      formRoot.append(el('style', { text: CSS }));
      function closeForm() { formHost.remove(); document.removeEventListener('keydown', onFormKey, true); }
      const onFormKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeForm(); } };
      const ov = el('div', { class: 'ov', onmousedown: (e) => { if (e.target === ov) closeForm(); } }, card);
      formRoot.append(ov);
      document.body.append(formHost);
      document.addEventListener('keydown', onFormKey, true);
      setTimeout(() => card.querySelector('#tema').focus(), 60);

      saveBtn.addEventListener('click', async () => {
        const v = (id) => (card.querySelector('#' + id).value || '').trim();
        const payload = {
          tema: v('tema'), fecha: v('fecha'), hora_inicio: v('hora_inicio') || null, hora_fin: v('hora_fin') || null,
          sede: v('sede'), direccion: v('direccion') || null, modalidad: f.modalidad,
          dirigido_a: v('dirigido_a') || null, notas: v('notas') || null, updated_at: new Date().toISOString(),
        };
        const fail = (m) => { errBox.textContent = m; errBox.style.display = ''; };
        if (!payload.tema) return fail('Escribe el tema de la capacitación.');
        if (!payload.fecha) return fail('Elige la fecha.');
        if (!payload.sede) return fail('Indica la sede.');
        if (payload.hora_inicio && payload.hora_fin && payload.hora_fin <= payload.hora_inicio) return fail('La hora de término debe ser posterior a la de inicio.');
        saveBtn.disabled = true; errBox.style.display = 'none';
        const client = cfg.getClient();
        let res;
        if (isNew) {
          payload.creado_por = (cfg.getUser() || {}).usuario || null;
          res = await client.from(TABLE).insert(payload).select().single();
        } else {
          res = await client.from(TABLE).update(payload).eq('id', row.id).select().single();
        }
        if (res.error) { saveBtn.disabled = false; return fail('No se pudo guardar: ' + res.error.message); }
        if (notify.checked) { try { await notifyUnits(res.data, isNew ? 'created' : 'updated'); } catch (e) { console.warn('[CalendarioCap] notificación', e); } }
        closeForm();
        toast(isNew ? 'Capacitación agregada al calendario' : 'Capacitación actualizada', 'good');
        state.year = parseISO(payload.fecha).getFullYear();
        invalidate(); await load(true); refreshBadges();
      });
    }

    function render() {
      mount.replaceChildren();
      const rows = yearRows();
      const upcoming = state.rows.filter((r) => daysUntil(r.fecha) >= 0)[0];

      const tools = el('div', { class: 'tools' },
        el('div', { class: 'yr' },
          el('button', { class: 'ib', type: 'button', 'aria-label': 'Año anterior', text: '‹', onclick: () => { state.year--; render(); } }),
          el('b', { text: String(state.year) }),
          el('button', { class: 'ib', type: 'button', 'aria-label': 'Año siguiente', text: '›', onclick: () => { state.year++; render(); } })),
        el('button', { class: 'chip' + (state.onlyUpcoming ? ' on' : ''), type: 'button', text: 'Solo próximas', 'aria-pressed': String(state.onlyUpcoming), onclick: () => { state.onlyUpcoming = !state.onlyUpcoming; render(); } }));
      if (opts.editable) tools.append(el('button', { class: 'btn pri', type: 'button', text: '+ Nueva capacitación', onclick: () => openForm(null) }));
      if (opts.onClose) tools.append(el('button', { class: 'ib', type: 'button', 'aria-label': 'Cerrar', text: '✕', onclick: opts.onClose }));

      mount.append(el('div', { class: 'head' },
        el('div', null, el('h2', { text: 'Calendario de capacitaciones' }),
          el('p', { class: 'sub', text: opts.editable ? 'Programa las fechas y sedes del año; las unidades las ven en su calendario.' : 'Fechas y sedes programadas por la Jurisdicción.' })),
        tools));

      if (state.error) mount.append(el('div', { class: 'msg', text: state.error }));
      if (state.loading) { mount.append(el('div', { class: 'empty', text: 'Cargando calendario…' })); return; }

      if (upcoming) {
        const c = countdown(upcoming);
        mount.append(el('div', { class: 'next' + (c.tone === 'soon' || c.tone === 'now' ? ' soon' : '') },
          el('div', { class: 'big' }, el('b', { text: String(parseISO(upcoming.fecha).getDate()) }), el('span', { text: MESES_C[parseISO(upcoming.fecha).getMonth()] })),
          el('div', null, el('div', { class: 't', text: `Próxima: ${upcoming.tema}` }),
            el('div', { class: 's', text: `${c.text} · ${fmtLong(upcoming.fecha)}${horario(upcoming) ? ' · ' + horario(upcoming) : ''} · ${upcoming.sede}` }))));
      }

      const months = el('div', { class: 'months' });
      for (let m = 0; m < 12; m++) months.append(miniMonth(m, yearRows()));
      mount.append(months);

      const agenda = el('div', { class: 'agenda' });
      if (!rows.length) {
        agenda.append(el('div', { class: 'empty', text: opts.editable
          ? `Aún no hay capacitaciones en ${state.year}. Usa “Nueva capacitación” para programar la primera.`
          : `No hay capacitaciones programadas para ${state.year}.` }));
      } else {
        let mes = -1;
        rows.forEach((r) => {
          const m = parseISO(r.fecha).getMonth();
          if (m !== mes) { mes = m; agenda.append(el('h3', { text: MESES[m] })); }
          agenda.append(eventRow(r));
        });
      }
      mount.append(agenda);
    }

    load(false);
    return { reload: () => { invalidate(); return load(true); } };
  }

  // ── Hosts ─────────────────────────────────────────────────────────────────
  let modalHost = null;
  function closeModal() {
    if (modalHost) { modalHost.remove(); modalHost = null; }
    document.removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    if (e.key !== 'Escape' || !modalHost) return;
    if (document.getElementById('calendarioCapFormHost')) return;
    closeModal();
  }

  function openCalendar() {
    if (!cfg) return;
    closeModal();
    modalHost = document.createElement('div');
    modalHost.id = 'calendarioCapHost';
    modalHost.classList.toggle('dark', isDark());
    const root = modalHost.attachShadow({ mode: 'open' });
    root.append(el('style', { text: CSS }));
    const card = el('div', { class: 'card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Calendario de capacitaciones' });
    const ov = el('div', { class: 'ov', onmousedown: (e) => { if (e.target === ov) closeModal(); } }, card);
    root.append(ov);
    document.body.append(modalHost);
    document.addEventListener('keydown', onKey, true);
    // El formulario de edición se monta en la misma raíz (encima del modal).
    createView(card, { editable: canEdit(), onClose: closeModal, root });
  }

  function mountPanel(container) {
    if (!cfg || !container) return;
    let root = container.shadowRoot;
    if (!root) {
      root = container.attachShadow({ mode: 'open' });
      root.append(el('style', { text: CSS }));
      const wrap = el('div', { class: 'embedded' });
      root.append(wrap);
      container.__calView = createView(wrap, { editable: canEdit(), root });
      container.classList.toggle('dark', isDark());
    } else {
      container.classList.toggle('dark', isDark());
      container.__calView.reload();
    }
  }

  // ── Recordatorios ─────────────────────────────────────────────────────────
  function bucket(n) { return n <= 0 ? '0' : n === 1 ? '1' : n <= 3 ? '3' : '7'; }

  function readSeen() { try { return JSON.parse(localStorage.getItem(REMIND_KEY) || '{}'); } catch (e) { return {}; } }
  function writeSeen(o) {
    try {
      const keep = Object.fromEntries(Object.entries(o).filter(([k]) => cache.rows && cache.rows.some((r) => k.startsWith(r.id))));
      localStorage.setItem(REMIND_KEY, JSON.stringify(keep));
    } catch (e) { /* sin almacenamiento */ }
  }

  function paintReminders(list) {
    document.querySelectorAll('[data-cal-cap-badge]').forEach((b) => {
      b.textContent = list.length ? String(list.length) : '';
      b.style.display = list.length ? 'inline-flex' : 'none';
    });
    document.querySelectorAll('[data-cal-cap-dot]').forEach((d) => { d.style.display = list.length ? 'block' : 'none'; });
    const banner = document.getElementById('calCapBanner');
    if (!banner) return;
    if (!list.length) { banner.style.display = 'none'; return; }
    const r = list[0], c = countdown(r);
    const more = list.length > 1 ? ` (+${list.length - 1} más)` : '';
    banner.querySelector('[data-cal-cap-text]').textContent =
      `${c.text}: ${r.tema} · ${fmtLong(r.fecha)}${horario(r) ? ', ' + horario(r) : ''} · ${r.sede}${more}`;
    banner.style.display = 'flex';
  }

  function refreshBadges() {
    const list = (cache.rows || []).filter((r) => { const n = daysUntil(r.fecha); return n >= 0 && n <= REMIND_DAYS; });
    paintReminders(list);
    return list;
  }

  /** Carga el calendario, pinta insignias/banner y muestra un aviso (una vez por etapa: 7, 3, 1 día y el mismo día). */
  function checkReminders() {
    if (!cfg) return Promise.resolve([]);
    if (reminderRun) return reminderRun;
    reminderRun = (async () => {
      try {
        await fetchRows(true);
        const list = refreshBadges();
        const seen = readSeen();
        const fresh = list.filter((r) => !seen[`${r.id}:${r.fecha}:${bucket(daysUntil(r.fecha))}`]);
        if (fresh.length) {
          fresh.forEach((r) => { seen[`${r.id}:${r.fecha}:${bucket(daysUntil(r.fecha))}`] = 1; });
          writeSeen(seen);
          const r = fresh[0], c = countdown(r);
          toast(`📅 Capacitación ${c.text.toLowerCase()}: ${r.tema} — ${r.sede}${fresh.length > 1 ? ` (+${fresh.length - 1} más)` : ''}`, 'good');
        }
        return list;
      } catch (e) {
        console.warn('[CalendarioCap] recordatorios:', e && e.message);
        return [];
      }
    })();
    setTimeout(() => { reminderRun = null; }, 30000);
    return reminderRun;
  }

  window.CalendarioCap = {
    init(c) { cfg = c; },
    openCalendar,
    mount: mountPanel,
    checkReminders,
    canEdit,
  };
})();
