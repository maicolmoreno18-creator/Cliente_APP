/* ============================================
   ClienteAPP — Módulo de Seguimiento / Timeline
   ============================================ */

window.Seguimiento = {

  // ── Abrir modal ───────────────────────────────────────────────────────────
  abrirModal(clienteId) {
    document.getElementById('seguimientoClienteId').value = clienteId;
    document.getElementById('formSeguimiento').reset();
    document.getElementById('seguimientoClienteId').value = clienteId;

    // Cerrar expediente si está abierto para evitar modales apilados
    const expedienteEl = document.getElementById('modalExpediente');
    const expedienteInstance = bootstrap.Modal.getInstance(expedienteEl);
    if (expedienteInstance && expedienteEl.classList.contains('show')) {
      expedienteEl.dataset.reopenClienteId = clienteId;
      expedienteInstance.hide();
      expedienteEl.addEventListener('hidden.bs.modal', function abrirSegTrasExpediente() {
        expedienteEl.removeEventListener('hidden.bs.modal', abrirSegTrasExpediente);
        UI.openModal('modalSeguimiento');
      }, { once: true });
    } else {
      UI.openModal('modalSeguimiento');
    }
  },

  // ── Guardar seguimiento ───────────────────────────────────────────────────
  async guardar() {
    const clienteId   = document.getElementById('seguimientoClienteId').value;
    const tipo        = document.getElementById('seguimientoTipo').value;
    const descripcion = document.getElementById('seguimientoDescripcion').value.trim();
    const recordatorio= document.getElementById('seguimientoRecordatorio').value;

    if (!descripcion) {
      UI.toast('La descripción es obligatoria', 'warning');
      return;
    }

    const session = Auth.getSession();

    await DB.put(DB.STORES.seguimientos, {
      id:           DB.generateId(),
      clienteId,
      tipo,
      descripcion,
      recordatorio: recordatorio || null,
      autorId:      session?.id || '',
      autorNombre:  session?.nombre || 'Sistema'
    });

    // Actualizar último seguimiento del cliente
    const cliente = await DB.get(DB.STORES.clientes, clienteId);
    if (cliente) {
      cliente.ultimoSeguimiento = new Date().toISOString();
      await DB.put(DB.STORES.clientes, cliente);
    }

    UI.closeModal('modalSeguimiento');
    UI.toast('Seguimiento registrado', 'success');

    // Refrescar badges y dashboard si está activo
    App.updateBadges();
    if (App.currentPage === 'dashboard') await Dashboard.render();

    // Reabrir expediente con datos frescos, posicionado en el tab de seguimiento
    const modalSegEl = document.getElementById('modalSeguimiento');
    modalSegEl.addEventListener('hidden.bs.modal', async function reabrirExpediente() {
      modalSegEl.removeEventListener('hidden.bs.modal', reabrirExpediente);
      await Clientes.abrirExpediente(clienteId);
      // Activar tab de seguimiento automáticamente
      setTimeout(() => {
        const tabSeg = document.querySelector('#expedienteTabs .nav-link[data-tab="seguimiento"]');
        if (tabSeg) tabSeg.click();
      }, 300);
    }, { once: true });
  },

  // ── Renderizar timeline ───────────────────────────────────────────────────
  async renderTimeline(clienteId) {
    const seguimientos = await DB.getByIndex(DB.STORES.seguimientos, 'clienteId', clienteId);

    if (seguimientos.length === 0) {
      return `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-chat-dots fs-2 d-block mb-2 opacity-50"></i>
          <p class="mb-0">Sin seguimientos aún</p>
          <small>Registra llamadas, visitas y notas del cliente</small>
        </div>`;
    }

    // Ordenar más recientes primero
    seguimientos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tipoConfig = {
      llamada:     { icon: 'bi-telephone-fill',  color: '#2d6a9f', bg: '#e8f0f8' },
      whatsapp:    { icon: 'bi-whatsapp',         color: '#25d366', bg: '#e8f8ee' },
      visita:      { icon: 'bi-house-fill',       color: '#e67e22', bg: '#fdf0e0' },
      reunion:     { icon: 'bi-people-fill',      color: '#8e44ad', bg: '#f3e8f8' },
      nota:        { icon: 'bi-sticky-fill',      color: '#f39c12', bg: '#fef9e7' },
      recordatorio:{ icon: 'bi-bell-fill',        color: '#e74c3c', bg: '#fde8e8' }
    };

    return `
      <div class="timeline">
        ${seguimientos.map(s => {
          const cfg = tipoConfig[s.tipo] || tipoConfig.nota;
          return `
            <div class="timeline-item">
              <div class="timeline-dot" style="background:${cfg.bg}; color:${cfg.color};">
                <i class="bi ${cfg.icon}" style="font-size:9px;"></i>
              </div>
              <div class="timeline-content">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <span class="fw-semibold small" style="color:${cfg.color};">
                    <i class="bi ${cfg.icon} me-1"></i>${this._tipoLabel(s.tipo)}
                  </span>
                  <small class="text-muted">${UI.timeAgo(s.createdAt)}</small>
                </div>
                <p class="mb-1 small">${UI.escapeHTML(s.descripcion)}</p>
                <div class="d-flex align-items-center justify-content-between">
                  <small class="text-muted">
                    <i class="bi bi-person me-1"></i>${UI.escapeHTML(s.autorNombre) || 'Sistema'}
                  </small>
                  ${s.recordatorio ? `
                    <small class="text-warning">
                      <i class="bi bi-bell me-1"></i>Recordatorio: ${UI.formatDateTime(s.recordatorio)}
                    </small>` : ''}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ── Label de tipo ─────────────────────────────────────────────────────────
  _tipoLabel(tipo) {
    const labels = {
      llamada:      'Llamada telefónica',
      whatsapp:     'Mensaje WhatsApp',
      visita:       'Visita al lote',
      reunion:      'Reunión',
      nota:         'Nota interna',
      recordatorio: 'Recordatorio'
    };
    return labels[tipo] || tipo;
  }
};

document.getElementById('btnGuardarSeguimiento')?.addEventListener('click', () => Seguimiento.guardar());
