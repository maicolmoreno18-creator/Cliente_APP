/* ============================================
   ClienteAPP — UI Helpers + Sonidos v3
   ============================================ */

// ── Motor de sonido (Web Audio API) ──────────────────────────────────────────
const Sound = (() => {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(type) {
    if (muted) return;
    try {
      const ac   = getCtx();
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain);
      gain.connect(ac.destination);
      const presets = {
        success: { freq:[523,659,784],  dur:0.11, wave:'sine',     vol:0.16 },
        danger:  { freq:[300,220],      dur:0.18, wave:'sawtooth', vol:0.13 },
        warning: { freq:[440,370,440],  dur:0.13, wave:'triangle', vol:0.14 },
        info:    { freq:[440,550],      dur:0.11, wave:'sine',     vol:0.12 },
        cash:    { freq:[784,988,1175], dur:0.09, wave:'sine',     vol:0.18 },
        alert:   { freq:[880,660,880],  dur:0.15, wave:'square',   vol:0.10 }
      };
      const p = presets[type] || presets.info;
      osc.type = p.wave;
      gain.gain.setValueAtTime(0, ac.currentTime);
      let t = ac.currentTime + 0.01;
      p.freq.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, t + i * p.dur);
        gain.gain.setValueAtTime(p.vol, t + i * p.dur);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * p.dur + p.dur * 0.85);
      });
      osc.start(ac.currentTime + 0.01);
      osc.stop(ac.currentTime + 0.01 + p.freq.length * p.dur + 0.05);
    } catch (e) { /* silencioso */ }
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  return { play, toggleMute, isMuted };
})();

window.Sound = Sound;

// ── Notificaciones Push del Navegador ────────────────────────────────────────
const PushNotif = (() => {
  async function requestPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  function send(title, body, icon = 'assets/img/icon-192.svg') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body,
        icon,
        badge: icon,
        tag: 'clienteapp-' + Date.now(),
        silent: false
      });
    } catch (e) { /* silencioso */ }
  }

  return { requestPermission, send };
})();

window.PushNotif = PushNotif;

// ── Historial de notificaciones ───────────────────────────────────────────────
const NotifHistory = (() => {
  const KEY = 'clienteapp_notifs';
  const MAX = 50;

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function add(message, type) {
    const list = getAll();
    list.unshift({ id: Date.now(), message, type, time: new Date().toISOString(), read: false });
    if (list.length > MAX) list.splice(MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
    _updateBadge(list.filter(n => !n.read).length);
  }

  function markAllRead() {
    const list = getAll().map(n => ({ ...n, read: true }));
    localStorage.setItem(KEY, JSON.stringify(list));
    _updateBadge(0);
  }

  function clear() {
    localStorage.removeItem(KEY);
    _updateBadge(0);
  }

  function unreadCount() {
    return getAll().filter(n => !n.read).length;
  }

  function _updateBadge(count) {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = ''; }
    else badge.style.display = 'none';
  }

  return { add, getAll, markAllRead, clear, unreadCount };
})();

window.NotifHistory = NotifHistory;

window.UI = {

  // ── Sanitizar HTML para prevenir XSS ─────────────────────────────────────
  escapeHTML(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // ── Toast con sonido e historial ─────────────────────────────────────────
  toast(message, type = 'success', duration = 4500) {
    // Auto-escapar el mensaje para prevenir XSS
    const safeMessage = UI.escapeHTML(message);
    const cfg = {
      success: { icon: 'bi-check-circle-fill',         color: '#10b981', bg: '#ecfdf5', sound: 'success', label: 'Éxito'           },
      danger:  { icon: 'bi-x-circle-fill',             color: '#ef4444', bg: '#fef2f2', sound: 'danger',  label: 'Error'           },
      warning: { icon: 'bi-exclamation-triangle-fill', color: '#f59e0b', bg: '#fffbeb', sound: 'warning', label: 'Atención'        },
      info:    { icon: 'bi-info-circle-fill',           color: '#3b82f6', bg: '#eff6ff', sound: 'info',    label: 'Información'     },
      cash:    { icon: 'bi-cash-coin',                  color: '#10b981', bg: '#ecfdf5', sound: 'cash',    label: 'Pago registrado' },
      alert:   { icon: 'bi-bell-fill',                  color: '#f97316', bg: '#fff7ed', sound: 'alert',   label: 'Alerta'          }
    };

    const c  = cfg[type] || cfg.info;
    const id = 'toast-' + Date.now() + Math.random().toString(36).slice(2);

    // Guardar en historial
    NotifHistory.add(message, type);

    // Sonido
    Sound.play(c.sound);

    // Push notification si la app está en segundo plano
    if (document.hidden) {
      PushNotif.send('ClienteAPP — ' + c.label, message);
    }

    const html = `
      <div id="${id}" class="toast border-0 shadow-lg overflow-hidden" role="alert"
           style="min-width:320px;max-width:400px;border-radius:16px !important;
                  animation:toastSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);">
        <div class="d-flex align-items-stretch">
          <div class="d-flex align-items-center justify-content-center px-3 flex-shrink-0"
               style="background:${c.color};min-width:54px;border-radius:16px 0 0 0;">
            <i class="bi ${c.icon} text-white" style="font-size:22px;"></i>
          </div>
          <div class="toast-body flex-grow-1 py-3 px-3" style="background:${c.bg};">
            <div class="fw-bold small" style="color:${c.color};letter-spacing:0.3px;">${c.label}</div>
            <div class="text-dark small mt-1 lh-sm" style="color:#374151 !important;">${safeMessage}</div>
          </div>
          <div class="d-flex align-items-start pt-2 pe-2" style="background:${c.bg};border-radius:0 16px 0 0;">
            <button type="button" class="btn-close" data-bs-dismiss="toast" style="font-size:9px;opacity:0.5;"></button>
          </div>
        </div>
        <div style="height:3px;background:rgba(0,0,0,0.08);border-radius:0 0 16px 16px;overflow:hidden;">
          <div class="toast-pb" style="height:100%;background:${c.color};width:100%;
               transition:width ${duration}ms linear;"></div>
        </div>
      </div>`;

    const container = document.getElementById('toastContainer');
    container.insertAdjacentHTML('beforeend', html);
    const el    = document.getElementById(id);
    const toast = new bootstrap.Toast(el, { delay: duration });
    toast.show();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const bar = el.querySelector('.toast-pb');
      if (bar) bar.style.width = '0%';
    }));

    el.addEventListener('hidden.bs.toast', () => el.remove());
  },

  // ── Panel de notificaciones ───────────────────────────────────────────────
  mostrarPanelNotificaciones() {
    const notifs = NotifHistory.getAll();
    NotifHistory.markAllRead();

    const id = 'panelNotif-' + Date.now();
    const cfgColor = {
      success:'#10b981', danger:'#ef4444', warning:'#f59e0b',
      info:'#3b82f6', cash:'#10b981', alert:'#f97316'
    };
    const cfgIcon = {
      success:'bi-check-circle-fill', danger:'bi-x-circle-fill',
      warning:'bi-exclamation-triangle-fill', info:'bi-info-circle-fill',
      cash:'bi-cash-coin', alert:'bi-bell-fill'
    };
    const cfgLabel = {
      success:'Éxito', danger:'Error', warning:'Atención',
      info:'Info', cash:'Pago', alert:'Alerta'
    };

    const renderList = (list) => list.length === 0
      ? `<div class="text-center py-5">
           <div style="font-size:48px;opacity:0.2;margin-bottom:12px;">🔔</div>
           <div class="text-muted small fw-semibold">Sin notificaciones</div>
         </div>`
      : list.map(n => `
          <div class="notif-item d-flex align-items-start gap-3 px-4 py-3"
               style="border-bottom:1px solid #f1f5f9;background:${n.read ? 'white' : '#f8faff'};transition:background 0.2s;">
            <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle mt-1"
                 style="width:36px;height:36px;background:${cfgColor[n.type] || '#64748b'}18;border:1.5px solid ${cfgColor[n.type] || '#64748b'}30;">
              <i class="bi ${cfgIcon[n.type] || 'bi-dot'}"
                 style="color:${cfgColor[n.type] || '#64748b'};font-size:15px;"></i>
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge rounded-pill" style="background:${cfgColor[n.type] || '#64748b'}18;color:${cfgColor[n.type] || '#64748b'};font-size:10px;font-weight:600;padding:2px 8px;">
                  ${cfgLabel[n.type] || 'Aviso'}
                </span>
                ${!n.read ? '<span class="badge rounded-pill bg-primary" style="font-size:9px;padding:2px 6px;">Nuevo</span>' : ''}
              </div>
              <div class="small lh-sm text-dark">${n.message}</div>
              <div class="text-muted mt-1" style="font-size:10px;">
                <i class="bi bi-clock me-1"></i>${this.timeAgo(n.time)}
              </div>
            </div>
          </div>`).join('');

    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-dialog-scrollable" style="max-width:440px;">
          <div class="modal-content border-0 shadow-lg" style="border-radius:20px;overflow:hidden;">
            <div class="modal-header border-0 py-4 px-4"
                 style="background:linear-gradient(135deg,#0f1f30,#1a3c5e,#2d6a9f);">
              <div class="d-flex align-items-center gap-3 flex-grow-1">
                <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.15);
                            display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);">
                  <i class="bi bi-bell-fill text-warning fs-5"></i>
                </div>
                <div>
                  <h6 class="fw-bold text-white mb-0">Notificaciones</h6>
                  <div class="text-white opacity-60" style="font-size:11px;">${notifs.length} en total · ${notifs.filter(n=>!n.read).length} sin leer</div>
                </div>
              </div>
              <div class="d-flex gap-2 ms-2">
                ${notifs.length > 0 ? `
                  <button class="btn btn-sm py-1 px-2" style="background:rgba(255,255,255,0.12);color:white;border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:11px;"
                          onclick="NotifHistory.clear(); document.getElementById('${id}-list').innerHTML='<div class=\\'text-center py-5\\'><div style=\\'font-size:48px;opacity:0.2;margin-bottom:12px;\\'>🔔</div><div class=\\'text-muted small fw-semibold\\'>Sin notificaciones</div></div>';">
                    <i class="bi bi-trash me-1"></i>Limpiar
                  </button>` : ''}
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
            </div>
            <div class="modal-body p-0" id="${id}-list" style="max-height:480px;overflow-y:auto;">
              ${renderList(notifs)}
            </div>
            ${notifs.length > 0 ? `
            <div class="modal-footer border-0 py-3 px-4" style="background:#f8fafc;">
              <small class="text-muted">
                <i class="bi bi-info-circle me-1"></i>
                Las notificaciones se guardan entre sesiones
              </small>
            </div>` : ''}
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const modal = new bootstrap.Modal(el);
    modal.show();
    el.addEventListener('hidden.bs.modal', () => el.remove(), { once: true });
  },

  // ── Confirm Dialog ───────────────────────────────────────────────────────
  confirm(message, title = 'Confirmar') {
    return new Promise((resolve) => {
      Sound.play('warning');
      const id = 'confirm-' + Date.now();
      const html = `
        <div class="modal fade" id="${id}" tabindex="-1">
          <div class="modal-dialog modal-sm modal-dialog-centered">
            <div class="modal-content border-0 shadow-lg" style="border-radius:18px;overflow:hidden;">
              <div class="modal-body p-4 text-center">
                <div class="mb-3">
                  <div class="d-inline-flex align-items-center justify-content-center rounded-circle"
                       style="width:60px;height:60px;background:#fef3c7;">
                    <i class="bi bi-exclamation-triangle-fill text-warning fs-2"></i>
                  </div>
                </div>
                <h6 class="fw-bold mb-2">${title}</h6>
                <p class="text-muted small mb-0">${message}</p>
              </div>
              <div class="modal-footer border-0 pt-0 pb-4 px-4 gap-2 justify-content-center">
                <button class="btn btn-light px-4 rounded-pill" id="${id}-no">Cancelar</button>
                <button class="btn btn-danger px-4 rounded-pill" id="${id}-yes">
                  <i class="bi bi-check-lg me-1"></i>Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      const el    = document.getElementById(id);
      const modal = new bootstrap.Modal(el);
      modal.show();
      document.getElementById(`${id}-yes`).onclick = () => { modal.hide(); resolve(true); };
      document.getElementById(`${id}-no`).onclick  = () => { modal.hide(); resolve(false); };
      el.addEventListener('hidden.bs.modal', () => { el.remove(); resolve(false); }, { once: true });
    });
  },

  // ── Formatear moneda ─────────────────────────────────────────────────────
  formatCurrency(value) {
    if (!value && value !== 0) return '—';
    return new Intl.NumberFormat('es-CO', {
      style:'currency', currency:'COP',
      minimumFractionDigits:0, maximumFractionDigits:0
    }).format(value);
  },

  // ── Moneda ocultable ──────────────────────────────────────────────────────
  // Envuelve el valor en un <span class="money-value"> para que el toggle de
  // privacidad (ojito) pueda ocultarlo con CSS. Usar SOLO en HTML visible,
  // NUNCA en toasts, atributos o .textContent (rompería el markup).
  money(value) {
    return `<span class="money-value">${this.formatCurrency(value)}</span>`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('es-CO', {
        day:'2-digit', month:'short', year:'numeric'
      });
    } catch { return dateStr; }
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('es-CO', {
        day:'2-digit', month:'short', year:'numeric',
        hour:'2-digit', minute:'2-digit'
      });
    } catch { return dateStr; }
  },

  timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff  = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)   return 'Ahora mismo';
    if (mins < 60)  return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7)   return `Hace ${days} días`;
    return this.formatDate(dateStr);
  },

  estadoBadge(estado) {
    const map = {
      nuevo:        { label:'Nuevo',           cls:'estado-nuevo' },
      cotizado:     { label:'Cotizado',         cls:'estado-cotizado' },
      negociacion:  { label:'En Negociación',   cls:'estado-negociacion' },
      firmado:      { label:'Firmado',          cls:'estado-firmado' },
      construccion: { label:'En Construcción',  cls:'estado-construccion' },
      finalizado:   { label:'Finalizado',       cls:'estado-finalizado' },
      perdido:      { label:'Perdido',          cls:'estado-perdido' }
    };
    const s = map[estado] || { label:estado, cls:'' };
    return `<span class="estado-badge ${s.cls}">${s.label}</span>`;
  },

  pagoBadge(estado) {
    const map = {
      pendiente: '<span class="badge bg-secondary">⏳ Pendiente</span>',
      parcial:   '<span class="badge bg-warning text-dark">🔄 Parcial</span>',
      pagado:    '<span class="badge bg-success">✅ Pagado</span>'
    };
    return map[estado] || `<span class="badge bg-light text-dark">${estado}</span>`;
  },

  initials(nombre) {
    if (!nombre) return '?';
    return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  },

  spinner(text = 'Cargando...') {
    return `
      <div class="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
        <div class="spinner-border text-primary" role="status" style="width:2.5rem;height:2.5rem;"></div>
        <span class="text-muted small">${text}</span>
      </div>`;
  },

  emptyState(icon, title, subtitle = '', action = '') {
    return `
      <div class="empty-state fade-in">
        <i class="bi ${icon}"></i>
        <h5 class="fw-semibold text-secondary">${title}</h5>
        ${subtitle ? `<p class="text-muted small">${subtitle}</p>` : ''}
        ${action}
      </div>`;
  },

  openModal(id) {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getOrCreateInstance(el).show();
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) bootstrap.Modal.getInstance(el)?.hide();
  },

  whatsappLink(telefono, mensaje = '') {
    const num  = telefono.replace(/\D/g, '');
    const full = num.startsWith('57') ? num : '57' + num;
    const msg  = encodeURIComponent(mensaje);
    return `https://wa.me/${full}${msg ? '?text=' + msg : ''}`;
  }
};

// ── Privacidad de valores monetarios (toggle "ojito") ─────────────────────────
const MoneyPrivacy = (() => {
  const KEY = 'clienteapp_ocultar_dinero';

  function estaOculto() {
    return localStorage.getItem(KEY) === '1';
  }

  // Aplicar el estado guardado al <body> (llamar al iniciar la app)
  function aplicar() {
    document.body.classList.toggle('hide-money', estaOculto());
    _actualizarBoton();
  }

  // Alternar mostrar/ocultar
  function toggle() {
    const nuevo = !estaOculto();
    localStorage.setItem(KEY, nuevo ? '1' : '0');
    document.body.classList.toggle('hide-money', nuevo);
    _actualizarBoton();
  }

  // Actualizar el icono/estado del botón en la topbar
  function _actualizarBoton() {
    const btn = document.getElementById('btnToggleMoney');
    if (!btn) return;
    const oculto = estaOculto();
    const icon = btn.querySelector('i');
    if (icon) icon.className = oculto ? 'bi bi-eye-slash fs-6' : 'bi bi-eye fs-6';
    btn.title = oculto ? 'Mostrar valores en dinero' : 'Ocultar valores en dinero';
    btn.setAttribute('aria-pressed', oculto ? 'true' : 'false');
  }

  return { estaOculto, aplicar, toggle };
})();

window.MoneyPrivacy = MoneyPrivacy;
