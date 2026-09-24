/**
 * desabasto_center.js — Centro de desabasto: modal que consolida TODAS las alertas de
 * desabasto (Esquema Básico) en un solo lugar, en vez de una tarjeta/notificación por unidad.
 *
 * Es solo interfaz: main.js le pasa los datos ya consolidados y las acciones.
 *
 *   DesabastoCenter.open({
 *     getUnits:  () => Unit[],              // se vuelve a llamar tras cada acción para refrescar
 *     resolve:   async (ids: string[]) => void,   // marca esas alertas como verificadas
 *     markRead:  async () => void,          // se llama una vez al abrir si hay algo sin leer
 *     toast:     (msg: string, ok?: boolean) => void,
 *   })
 *
 *   Unit = { clues, unidad, municipio, missing: string[], status: 'activa'|'resuelta',
 *            ids: string[], created_ts: string, unread: boolean }
 *
 * Vive en un Shadow DOM (como perfil_cuenta.js): los resets globales !important de style.css
 * sobre input/button no lo deforman. Diseño plano, botones de icono sin caja.
 */
(function () {
  'use strict';

  const CONFIRM_MS = 4000;

  const ICON = {
    warn: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  };

  const CSS = `
    :host{all:initial}
    :host{--bg:#fff;--fg:#0f172a;--muted:#64748b;--line:#e2e8f0;--field:#f1f5f9;--accent:#e11d48;--accent-fg:#fff;--ok:#059669;--chip:#fee2e2;--chip-fg:#991b1b}
    :host(.dark){--bg:#1e293b;--fg:#f1f5f9;--muted:#94a3b8;--line:#334155;--field:#0f172a;--accent:#fb7185;--accent-fg:#4c0519;--ok:#34d399;--chip:rgba(251,113,133,.16);--chip-fg:#fda4af}
    *{box-sizing:border-box;font-family:'Inter','Poppins',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
    .ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.5);animation:fade .18s ease-out}
    .card{width:100%;max-width:640px;height:min(760px,calc(100dvh - 32px));display:flex;flex-direction:column;background:var(--bg);color:var(--fg);border-radius:24px;box-shadow:0 16px 48px rgba(0,0,0,.22);overflow:hidden;animation:rise .22s ease-out}
    .top{padding:20px 22px 14px;flex:none}
    .head{display:flex;align-items:flex-start;gap:12px}
    .ico{flex:none;color:var(--accent);margin-top:2px}
    .ttl{flex:1;min-width:0}
    h2{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
    .sub{margin:3px 0 0;font-size:13px;color:var(--muted);font-weight:500}
    .x{all:unset;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
    .x:hover{color:var(--fg)}
    .bios{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
    .bios:empty{display:none}
    .chip{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;background:var(--chip);color:var(--chip-fg);border:1.5px solid transparent}
    .chip b{font-weight:800;opacity:.75}
    .chip[aria-pressed=true]{border-color:var(--accent)}
    .bar{display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap}
    .find{flex:1;min-width:160px;display:flex;align-items:center;gap:8px;background:var(--field);border-radius:12px;padding:0 12px;color:var(--muted)}
    .find:focus-within{outline:2px solid var(--accent)}
    .find input{all:unset;flex:1;min-width:0;height:38px;font-size:14px;font-weight:600;color:var(--fg)}
    .find input::placeholder{color:var(--muted);font-weight:500}
    .seg{display:flex;background:var(--field);border-radius:12px;padding:3px;flex:none}
    .seg button{all:unset;cursor:pointer;padding:6px 12px;border-radius:9px;font-size:12.5px;font-weight:700;color:var(--muted);white-space:nowrap}
    .seg button[aria-pressed=true]{background:var(--bg);color:var(--fg)}
    .list{flex:1;min-height:0;overflow:auto;padding:0 22px 8px;overscroll-behavior:contain}
    .muni{margin-top:10px}
    .mh{all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;padding:8px 0;border-bottom:1px solid var(--line);font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .mh .n{margin-left:auto;color:var(--accent)}
    .mh .cv{display:flex;transition:transform .15s}
    .muni.closed .cv{transform:rotate(-90deg)}
    .muni.closed .rows{display:none}
    .row{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
    .row:last-child{border-bottom:0}
    .info{flex:1;min-width:0}
    .nm{font-size:14px;font-weight:700;line-height:1.3;word-break:break-word}
    .meta{margin-top:2px;font-size:11.5px;color:var(--muted);font-weight:500}
    .meta code{font-family:ui-monospace,Menlo,Consolas,monospace}
    .miss{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
    .miss span{padding:3px 8px;border-radius:7px;font-size:11.5px;font-weight:700;background:var(--chip);color:var(--chip-fg)}
    .row.done .miss span{background:var(--field);color:var(--muted);text-decoration:line-through}
    .act{all:unset;cursor:pointer;flex:none;display:inline-flex;align-items:center;gap:5px;padding:6px 4px;font-size:12.5px;font-weight:800;color:var(--ok)}
    .act:hover{text-decoration:underline}
    .act[disabled]{opacity:.5;cursor:default;text-decoration:none}
    .tag{flex:none;display:inline-flex;align-items:center;gap:4px;padding:6px 4px;font-size:12px;font-weight:700;color:var(--muted)}
    .empty{padding:48px 12px;text-align:center;color:var(--muted);font-size:14px;font-weight:600}
    .foot{flex:none;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--line);flex-wrap:wrap}
    .btn{all:unset;box-sizing:border-box;cursor:pointer;min-height:42px;padding:0 16px;border-radius:12px;font-size:13.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:7px;-webkit-tap-highlight-color:transparent}
    .card:focus{outline:none}
    .btn{white-space:nowrap}
    .btn.sec{background:var(--field);color:var(--fg)}
    .btn.pri{background:var(--accent);color:var(--accent-fg)}
    .btn.confirm{background:var(--ok);color:#fff}
    .btn[disabled]{opacity:.5;cursor:default}
    .btn[hidden]{display:none}
    .grp{display:flex;gap:10px;flex-wrap:wrap}
    .x:focus-visible,.chip:focus-visible,.seg button:focus-visible,.mh:focus-visible,.act:focus-visible,.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    @keyframes fade{from{opacity:0}to{opacity:1}}
    @keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.ov,.card{animation:none}}
    @media (max-width:520px){
      .ov{align-items:flex-end;padding:0}
      .card{max-width:none;height:min(92dvh,760px);border-radius:24px 24px 0 0}
      .top{padding:16px 16px 12px}.list{padding:0 16px 8px}.foot{padding:12px 16px}
      .foot{flex-wrap:nowrap}.foot .x2,.foot .lbl{display:none}.foot .grp{flex:1}.foot .btn.pri{flex:1}
    }
  `;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

  function ago(ts) {
    const t = new Date(ts).getTime();
    if (!t) return '';
    const min = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ayer' : `hace ${d} d`;
  }

  let host = null;
  let root = null;
  let cfg = null;
  let prevFocus = null;
  let confirmTimer = null;
  let busy = false;
  const ui = { filter: 'activa', q: '', bio: null, closed: new Set(), confirming: false };

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'desabastoCenterHost';
    root = host.attachShadow({ mode: 'open' });
    const st = document.createElement('style');
    st.textContent = CSS;
    root.appendChild(st);
    document.body.appendChild(host);
  }

  function isDark() {
    const d = document.documentElement;
    return d.classList.contains('dark') || d.dataset.theme === 'dark' || document.body.classList.contains('dark');
  }

  function units() {
    try { return (cfg && cfg.getUnits && cfg.getUnits()) || []; } catch (_e) { return []; }
  }

  // Unidades que pasan búsqueda + filtro de biológico (todavía sin filtrar por estado).
  function matching(all) {
    const q = norm(ui.q);
    return all.filter((u) => {
      if (ui.bio && !u.missing.includes(ui.bio)) return false;
      if (!q) return true;
      return norm(u.unidad).includes(q) || norm(u.clues).includes(q) || norm(u.municipio).includes(q);
    });
  }

  function visibleUnits(all) {
    const base = matching(all);
    return ui.filter === 'todas' ? base : base.filter((u) => u.status === ui.filter);
  }

  function groupByMuni(list) {
    const map = new Map();
    list.forEach((u) => {
      const k = String(u.municipio || 'SIN MUNICIPIO').trim().toUpperCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(u);
    });
    const activeCount = (arr) => arr.filter((u) => u.status === 'activa').length;
    return Array.from(map.entries())
      .map(([k, arr]) => [k, arr.sort((a, b) => (a.status === b.status ? a.unidad.localeCompare(b.unidad, 'es') : a.status === 'activa' ? -1 : 1))])
      .sort((a, b) => activeCount(b[1]) - activeCount(a[1]) || b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'));
  }

  function render() {
    if (!root) return;
    const card = root.querySelector('.card');
    if (!card) return;

    const all = units();
    const active = all.filter((u) => u.status === 'activa');
    const resolved = all.length - active.length;
    const munisActive = new Set(active.map((u) => String(u.municipio || '').toUpperCase())).size;

    // Si ya no queda nada activo y el filtro era "activas", enseñar todas para no dejar la vista vacía.
    if (ui.filter === 'activa' && active.length === 0 && all.length > 0) ui.filter = 'todas';
    // Un biológico ya sin unidades activas no puede seguir filtrando.
    if (ui.bio && !all.some((u) => u.missing.includes(ui.bio))) ui.bio = null;

    card.querySelector('.sub').textContent = active.length
      ? `${active.length} unidad${active.length === 1 ? '' : 'es'} con desabasto activo · ${munisActive} municipio${munisActive === 1 ? '' : 's'}`
      : 'Sin desabasto activo';

    // Chips de biológicos (sobre las activas): cuántas unidades afecta cada uno
    const counts = new Map();
    active.forEach((u) => u.missing.forEach((b) => counts.set(b, (counts.get(b) || 0) + 1)));
    card.querySelector('.bios').innerHTML = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .map(([b, n]) => `<button type="button" class="chip" data-bio="${esc(b)}" aria-pressed="${ui.bio === b}">${esc(b)} <b>${n}</b></button>`)
      .join('');

    const segs = [['activa', `Activas (${active.length})`], ['resuelta', `Resueltas (${resolved})`], ['todas', `Todas (${all.length})`]];
    card.querySelector('.seg').innerHTML = segs
      .map(([k, label]) => `<button type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${label}</button>`)
      .join('');

    const vis = visibleUnits(all);
    const listEl = card.querySelector('.list');
    const scrollTop = listEl.scrollTop;
    if (!vis.length) {
      listEl.innerHTML = `<div class="empty">${all.length === 0
        ? 'No hay alertas de desabasto.'
        : (ui.q || ui.bio ? 'Ninguna unidad coincide con el filtro.' : 'No hay unidades en esta vista.')}</div>`;
    } else {
      listEl.innerHTML = groupByMuni(vis).map(([muni, arr]) => {
        const nAct = arr.filter((u) => u.status === 'activa').length;
        const closed = ui.closed.has(muni);
        return `<section class="muni${closed ? ' closed' : ''}" data-muni="${esc(muni)}">
          <button type="button" class="mh" data-toggle="${esc(muni)}" aria-expanded="${!closed}">
            <span class="cv">${ICON.chev}</span>${esc(muni)}<span class="n">${nAct ? `${nAct} activa${nAct === 1 ? '' : 's'}` : `${arr.length} resuelta${arr.length === 1 ? '' : 's'}`}</span>
          </button>
          <div class="rows">${arr.map(rowHtml).join('')}</div>
        </section>`;
      }).join('');
      listEl.scrollTop = scrollTop;
    }

    // Pie: copiar resumen + verificar visibles
    const visActive = vis.filter((u) => u.status === 'activa');
    const copyBtn = card.querySelector('[data-act=copy]');
    copyBtn.disabled = visActive.length === 0;
    const verBtn = card.querySelector('[data-act=verify]');
    verBtn.hidden = visActive.length === 0;
    verBtn.disabled = busy;
    verBtn.className = 'btn ' + (ui.confirming ? 'confirm' : 'pri');
    verBtn.innerHTML = ui.confirming
      ? `${ICON.check} Confirmar (${visActive.length})`
      : `${ICON.check} Verificar ${visActive.length === 1 ? 'unidad' : `${visActive.length} unidades`}`;
  }

  function rowHtml(u) {
    const done = u.status !== 'activa';
    return `<div class="row${done ? ' done' : ''}">
      <div class="info">
        <div class="nm">${esc(u.unidad)}</div>
        <div class="meta"><code>${esc(u.clues)}</code> · ${esc(ago(u.created_ts))}</div>
        <div class="miss">${u.missing.map((b) => `<span>${esc(b)}</span>`).join('')}</div>
      </div>
      ${done
        ? `<span class="tag">${ICON.check} Verificada</span>`
        : `<button type="button" class="act" data-resolve="${esc(u.clues)}"${busy ? ' disabled' : ''}>${ICON.check} Verificar</button>`}
    </div>`;
  }

  async function runResolve(ids) {
    if (!ids.length || busy) return;
    busy = true;
    ui.confirming = false;
    clearTimeout(confirmTimer);
    render();
    try {
      await cfg.resolve(ids);
      cfg.toast && cfg.toast(ids.length === 1 ? 'Alerta verificada' : 'Alertas verificadas');
    } catch (e) {
      cfg.toast && cfg.toast((e && e.message) || 'No se pudo verificar la alerta', false);
    } finally {
      busy = false;
      render();
    }
  }

  function summaryText(list) {
    const d = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const lines = [`DESABASTO ESQUEMA BÁSICO — ${d}`, `${list.length} unidad${list.length === 1 ? '' : 'es'} con desabasto activo`, ''];
    groupByMuni(list).forEach(([muni, arr]) => {
      lines.push(`${muni} (${arr.length})`);
      arr.forEach((u) => lines.push(`• ${u.unidad} (${u.clues}): ${u.missing.join(', ')}`));
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (_e2) { return false; }
    }
  }

  function onClick(e) {
    const t = e.target.closest('[data-bio],[data-filter],[data-toggle],[data-resolve],[data-act],.x');
    if (!t || !root.contains(t)) return;
    if (t.matches('.x')) return close();
    if (t.dataset.bio) {
      ui.bio = ui.bio === t.dataset.bio ? null : t.dataset.bio;
      ui.confirming = false;
      return render();
    }
    if (t.dataset.filter) {
      ui.filter = t.dataset.filter;
      ui.confirming = false;
      return render();
    }
    if (t.dataset.toggle) {
      const k = t.dataset.toggle;
      ui.closed.has(k) ? ui.closed.delete(k) : ui.closed.add(k);
      return render();
    }
    if (t.dataset.resolve) {
      const u = units().find((x) => x.clues === t.dataset.resolve);
      return u && runResolve(u.ids);
    }
    const visActive = visibleUnits(units()).filter((u) => u.status === 'activa');
    if (t.dataset.act === 'copy') {
      return copyText(summaryText(visActive)).then((ok) => cfg.toast && cfg.toast(ok ? 'Resumen copiado' : 'No se pudo copiar el resumen', ok));
    }
    if (t.dataset.act === 'verify') {
      if (!ui.confirming) {
        ui.confirming = true;
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { ui.confirming = false; render(); }, CONFIRM_MS);
        return render();
      }
      return runResolve(visActive.flatMap((u) => u.ids));
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  }

  function close() {
    clearTimeout(confirmTimer);
    document.removeEventListener('keydown', onKey, true);
    if (root) root.querySelectorAll('.ov').forEach((n) => n.remove());
    if (prevFocus && prevFocus.isConnected) { try { prevFocus.focus(); } catch (_e) { /* sin foco */ } }
    prevFocus = null;
    cfg = null;
  }

  function open(config) {
    cfg = config;
    ensureHost();
    root.querySelectorAll('.ov').forEach((n) => n.remove());
    host.classList.toggle('dark', isDark());
    prevFocus = document.activeElement;
    Object.assign(ui, { filter: 'activa', q: '', bio: null, confirming: false });
    ui.closed.clear();
    busy = false;

    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-label="Desabasto en Esquema Básico" tabindex="-1">
        <div class="top">
          <div class="head">
            <span class="ico">${ICON.warn}</span>
            <div class="ttl"><h2>Desabasto en Esquema Básico</h2><p class="sub"></p></div>
            <button type="button" class="x" aria-label="Cerrar">${ICON.x}</button>
          </div>
          <div class="bios"></div>
          <div class="bar">
            <label class="find">${ICON.search}<input type="search" placeholder="Buscar unidad, CLUES o municipio" autocomplete="off" aria-label="Buscar"></label>
            <div class="seg" role="group" aria-label="Estado"></div>
          </div>
        </div>
        <div class="list"></div>
        <div class="foot">
          <button type="button" class="btn sec" data-act="copy">${ICON.copy}<span class="lbl">Copiar resumen</span></button>
          <div class="grp">
            <button type="button" class="btn sec x2">Cerrar</button>
            <button type="button" class="btn pri" data-act="verify"></button>
          </div>
        </div>
      </div>`;
    root.appendChild(ov);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.addEventListener('click', onClick);
    ov.querySelector('.x2').addEventListener('click', close);
    ov.querySelector('input').addEventListener('input', (e) => { ui.q = e.target.value; ui.confirming = false; render(); });
    document.addEventListener('keydown', onKey, true);

    render();
    ov.querySelector('.card').focus(); // foco al diálogo (no a un botón) para no pintar un aro al abrir

    if (units().some((u) => u.unread) && cfg.markRead) {
      Promise.resolve(cfg.markRead()).catch(() => { /* no bloquea la lectura del modal */ });
    }
  }

  // Refresca la vista si está abierta (p. ej. llegó una alerta nueva en tiempo real).
  function refresh() {
    if (cfg && root && root.querySelector('.ov')) render();
  }

  // ── Consolidación: N alertas ALERTA_DESABASTO -> 1 tarjeta de bandeja ────────
  // Cada captura con ceros inserta una fila por unidad. La bandeja muestra UNA tarjeta
  // resumen; sus ids reales quedan en `digest_ids` para que leer/borrar/verificar la
  // tarjeta actúe sobre todas las alertas que agrupa. Varias alertas de la misma unidad
  // (CLUES) se funden en una sola entrada.
  const DIGEST_ID = 'DESABASTO_DIGEST';
  const RESOLVED_KEEP_DAYS = 7;

  // meta_json llega como texto JSON (o como objeto si la columna jsonb ya viene parseada).
  function parseMeta(raw) {
    if (raw && typeof raw === 'object') return raw;
    try {
      const v = JSON.parse(String(raw || '{}'));
      return v && typeof v === 'object' ? v : {};
    } catch (_e) {
      return {};
    }
  }

  function buildDigest(items) {
    const rest = [];
    const byClues = new Map();
    const cutoff = Date.now() - RESOLVED_KEEP_DAYS * 86400000;
    const allIds = [];

    (items || []).forEach((n) => {
      if (String(n.type || '').toUpperCase() !== 'ALERTA_DESABASTO') { rest.push(n); return; }

      const meta = parseMeta(n.meta_json);
      const isActive = meta.status === 'activa';
      const ts = new Date(n.created_ts || 0).getTime() || 0;
      if (!isActive && ts < cutoff) return; // historial resuelto viejo: no estorba en la bandeja

      allIds.push(n.id);
      const clues = String(meta.clues || n.id).trim().toUpperCase();
      let u = byClues.get(clues);
      if (!u) {
        u = { clues, unidad: '', municipio: '', ts: 0, activeMissing: new Set(), lastMissing: [], activeIds: [], status: 'resuelta', unread: false };
        byClues.set(clues, u);
      }
      const missing = Array.isArray(meta.missing) ? meta.missing : [];
      if (ts >= u.ts) {
        u.ts = ts;
        u.unidad = meta.unidad || u.unidad || clues;
        u.municipio = meta.municipio || n.target_municipio || u.municipio;
        u.lastMissing = missing;
      }
      if (isActive) {
        u.status = 'activa';
        u.activeIds.push(n.id);
        missing.forEach((b) => u.activeMissing.add(b));
        if (String(n.status || 'UNREAD').toUpperCase() !== 'READ') u.unread = true;
      }
    });

    if (!byClues.size) return rest;

    const list = Array.from(byClues.values())
      .map((u) => ({
        clues: u.clues,
        unidad: u.unidad,
        municipio: u.municipio,
        missing: u.status === 'activa' ? Array.from(u.activeMissing) : u.lastMissing,
        status: u.status,
        ids: u.activeIds, // solo las alertas aún por verificar
        created_ts: u.ts ? new Date(u.ts).toISOString() : '',
        unread: u.unread,
      }))
      .sort((a, b) => String(b.created_ts).localeCompare(String(a.created_ts)));

    const active = list.filter((u) => u.status === 'activa');
    const munis = new Set(active.map((u) => String(u.municipio || '').toUpperCase()));
    const counts = new Map();
    active.forEach((u) => u.missing.forEach((b) => counts.set(b, (counts.get(b) || 0) + 1)));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
    const newest = active[0] || list[0];

    let title;
    let message;
    if (active.length === 0) {
      title = 'Desabasto resuelto';
      message = `Las ${list.length} alerta${list.length === 1 ? '' : 's'} de desabasto reciente${list.length === 1 ? '' : 's'} ya fue${list.length === 1 ? '' : 'ron'} verificada${list.length === 1 ? '' : 's'}.`;
    } else if (active.length === 1) {
      title = `🚨 Desabasto en ${active[0].unidad}`;
      message = `${active[0].unidad} capturó sin existencias de: ${active[0].missing.join(', ')}.`;
    } else {
      title = `🚨 ${active.length} unidades con desabasto`;
      message = `${active.length} unidades de ${munis.size} municipio${munis.size === 1 ? '' : 's'} capturaron sin existencias. ` +
        `Más afectados: ${top.slice(0, 3).map(([b, c]) => `${b} (${c})`).join(', ')}.`;
    }

    const unread = active.some((u) => u.unread);
    const digest = {
      id: DIGEST_ID,
      type: 'ALERTA_DESABASTO',
      created_ts: newest.created_ts,
      created_date: String(newest.created_ts).slice(0, 10),
      from_usuario: 'SISTEMA',
      from_rol: 'SYS',
      target_scope: 'MUNICIPIO',
      title,
      message,
      status: unread ? 'UNREAD' : 'READ',
      is_read: unread ? 'NO' : 'SI',
      is_digest: true,
      digest_ids: allIds,
      meta_json: JSON.stringify({
        is_digest: true,
        status: active.length ? 'activa' : 'resuelta',
        units: list,
        units_count: active.length,
        municipios_count: munis.size,
        missing: top.map(([b]) => b),
        // texto plano para que la búsqueda de la bandeja encuentre unidades/CLUES/biológicos
        search: list.map((u) => `${u.unidad} ${u.clues} ${u.municipio} ${u.missing.join(' ')}`).join(' '),
      }),
    };

    return [...rest, digest];
  }

  window.DesabastoCenter = {
    open, close, refresh,
    isOpen: () => !!(cfg && root && root.querySelector('.ov')),
    buildDigest, parseMeta, DIGEST_ID,
  };
})();
