/* ============================================
   ClienteAPP — Controlador Principal
   ============================================ */

// ── Módulo Expediente ─────────────────────────────────────────────────────────
window.Expediente = {

  // Estado del expediente abierto (soporta varios proyectos por cliente)
  _cliente: null,
  _proyectos: [],
  _proyectoIdx: 0,

  // Proyecto actualmente seleccionado en el tab "Proyecto"
  get _proyectoActual() {
    return this._proyectos[this._proyectoIdx] || null;
  },

  async render(cliente, proyectos, pagos, seguimientos, idx = 0) {
    // Guardar estado para el selector de casas y los tabs
    this._cliente     = cliente;
    this._proyectos   = Array.isArray(proyectos) ? proyectos : (proyectos ? [proyectos] : []);
    this._proyectoIdx = (idx >= 0 && idx < this._proyectos.length) ? idx : 0;
    const proyecto    = this._proyectoActual;

    const session = Auth.getSession();
    const nombre   = UI.escapeHTML(cliente.nombre);
    const telefono = UI.escapeHTML(cliente.telefono);
    const ubicacion = UI.escapeHTML(cliente.ubicacion);

    return `
      <div class="p-0">
        <!-- Header del expediente -->
        <div class="p-4 border-bottom" style="background:linear-gradient(135deg,#f8fafc,#e8f0f8);">
          <div class="d-flex align-items-start gap-3">
            <div class="cliente-avatar" style="width:56px;height:56px;font-size:20px;">
              ${UI.initials(cliente.nombre)}
            </div>
            <div class="flex-grow-1">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <h5 class="fw-bold mb-0">${nombre}</h5>
                ${UI.estadoBadge(cliente.estado)}
              </div>
              <div class="d-flex flex-wrap gap-3 mt-2">
                ${cliente.telefono ? `
                  <a href="${UI.whatsappLink(cliente.telefono)}" target="_blank" class="btn-whatsapp btn btn-sm">
                    <i class="bi bi-whatsapp me-1"></i>${telefono}
                  </a>` : ''}
                ${cliente.ubicacion ? `
                  <span class="text-muted small">
                    <i class="bi bi-geo-alt me-1"></i>${ubicacion}
                  </span>` : ''}
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-sm btn-outline-primary"
                onclick="Expediente.editarClienteDesdeExpediente('${cliente.id}')">
                <i class="bi bi-pencil me-1"></i>Editar
              </button>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <ul class="nav expediente-tabs border-bottom px-4" id="expedienteTabs">
          <li class="nav-item">
            <a class="nav-link active" data-tab="proyecto" href="#">
              <i class="bi bi-building me-1"></i>Proyecto
            </a>
          </li>
          ${Proyectos.ESTADOS_FIRMADOS.includes(cliente.estado) ? `
          <li class="nav-item">
            <a class="nav-link" data-tab="pagos" href="#">
              <i class="bi bi-cash me-1"></i>Pagos
            </a>
          </li>` : ''}
          <li class="nav-item">
            <a class="nav-link" data-tab="seguimiento" href="#">
              <i class="bi bi-chat-dots me-1"></i>Seguimiento
              <span class="badge bg-primary ms-1">${seguimientos.length}</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" data-tab="historial" href="#">
              <i class="bi bi-clock-history me-1"></i>Historial
            </a>
          </li>
        </ul>

        <!-- Tab content -->
        <div class="p-4" id="expedienteTabContent">
          ${await this._tabProyecto(cliente, proyecto)}
        </div>
      </div>`;
  },

  // Selector de casas (solo si el cliente tiene más de un proyecto)
  _selectorProyectos(cliente) {
    const proys = this._proyectos;
    if (proys.length <= 1) return '';
    const pills = proys.map((p, i) => {
      const activo = i === this._proyectoIdx;
      const etiqueta = p.modelo ? UI.escapeHTML(p.modelo) : `Casa ${i + 1}`;
      return `
        <button class="btn btn-sm ${activo ? 'btn-primary' : 'btn-outline-primary'} fw-semibold"
                style="border-radius:20px;"
                onclick="Expediente.seleccionarProyecto(${i})">
          <i class="bi bi-house-door me-1"></i>Casa ${i + 1}
          <span class="opacity-75 ms-1" style="font-size:11px;">· ${etiqueta}</span>
        </button>`;
    }).join('');
    return `
      <div class="col-12">
        <div class="d-flex align-items-center flex-wrap gap-2 p-2 rounded-3"
             style="background:#eff6ff;border:1px solid #bfdbfe;">
          <span class="text-primary small fw-semibold me-1 ms-1">
            <i class="bi bi-houses me-1"></i>${proys.length} proyectos:
          </span>
          ${pills}
        </div>
      </div>`;
  },

  // Cabecera con botón "Nuevo proyecto" (siempre permite agregar otra casa)
  _barraNuevoProyecto(cliente) {
    return `
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span class="text-muted small">
            <i class="bi bi-info-circle me-1"></i>Puedes registrar varias casas para este mismo cliente.
          </span>
          <button class="btn btn-sm btn-success fw-semibold" onclick="Proyectos.abrirModalNuevo('${cliente.id}')">
            <i class="bi bi-plus-lg me-1"></i>Nuevo proyecto
          </button>
        </div>
      </div>`;
  },

  // Cambiar de casa seleccionada y re-renderizar solo el tab Proyecto
  async seleccionarProyecto(idx) {
    if (idx < 0 || idx >= this._proyectos.length) return;
    this._proyectoIdx = idx;
    const content = document.getElementById('expedienteTabContent');
    if (content) {
      content.innerHTML = UI.spinner();
      content.innerHTML = await this._tabProyecto(this._cliente, this._proyectoActual);
    }
  },

  async _tabProyecto(cliente, proyecto) {
    if (this._proyectos.length === 0) {
      return `
        <div class="text-center py-5">
          <i class="bi bi-building fs-1 text-muted d-block mb-3 opacity-50"></i>
          <h6 class="fw-semibold text-muted">Sin proyecto asignado</h6>
          <p class="text-muted small">Crea un proyecto para este cliente</p>
          <button class="btn btn-success" onclick="Proyectos.abrirModalNuevo('${cliente.id}')">
            <i class="bi bi-plus-lg me-2"></i>Crear Proyecto
          </button>
        </div>`;
    }

    const firmado = Proyectos.ESTADOS_FIRMADOS.includes(cliente.estado);

    return `
      <div class="row g-4">

        ${this._selectorProyectos(cliente)}
        ${this._barraNuevoProyecto(cliente)}

        <!-- Fila superior: botones de acción siempre visibles -->
        <div class="col-12">
          <div class="d-flex flex-wrap align-items-center gap-2 p-3 rounded-3"
               style="background:#f8fafc;border:1.5px solid #e2e8f0;">
            <span class="text-muted small fw-semibold me-1">
              <i class="bi bi-lightning-charge me-1 text-primary"></i>Acciones:
            </span>
            <button class="btn btn-sm btn-outline-success fw-semibold"
                    onclick="Proyectos.abrirModalEditar('${proyecto.id}')">
              <i class="bi bi-pencil me-1"></i>Editar Proyecto
            </button>
            <button class="btn btn-sm btn-outline-primary fw-semibold"
                    onclick="typeof PrintDoc!=='undefined' ? PrintDoc.imprimir('${proyecto.id}','${cliente.id}') : UI.toast('Recarga la página para activar esta función (Ctrl+Shift+R)','warning',5000)"
                    title="Imprimir especificaciones técnicas (sin precios)">
              <i class="bi bi-printer me-1"></i>Imprimir especificaciones
            </button>
            <button class="btn btn-sm btn-outline-danger fw-semibold"
                    data-pdf-btn="${proyecto.id}"
                    onclick="typeof PrintDoc!=='undefined' ? PrintDoc.descargarPDF('${proyecto.id}','${cliente.id}') : UI.toast('Recarga la página para activar esta función (Ctrl+Shift+R)','warning',5000)"
                    title="Descargar especificaciones en PDF (sin precios)">
              <i class="bi bi-file-earmark-pdf me-1"></i>Descargar PDF
            </button>
            <small class="text-muted ms-auto align-self-center" style="font-size:11px;">
              <i class="bi bi-calendar me-1"></i>Registrado: ${UI.formatDate(proyecto.createdAt)}
            </small>
          </div>
        </div>

        <!-- Columna izquierda: detalles -->
        <div class="${firmado ? 'col-md-6' : 'col-12'}">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="fw-bold mb-0"><i class="bi bi-house me-2 text-success"></i>Detalles del Proyecto</h6>
            ${!firmado ? `
              <span class="badge bg-secondary px-3 py-2">
                <i class="bi bi-clock me-1"></i>Cotización — pendiente de firma
              </span>` : ''}
          </div>

          ${firmado ? `<div class="mb-3">${Proyectos._fechaEntregaBadge(proyecto.fechaEntrega)}</div>` : ''}

          <!-- Info básica -->
          <div class="row g-2 mb-3">
            <div class="col-6">
              <div class="rounded-3 p-2 text-center" style="background:#f0fdf4;">
                <div class="fw-bold text-success">${UI.formatCurrency(proyecto.precio)}</div>
                <div class="text-muted" style="font-size:11px;">Precio Total</div>
              </div>
            </div>
            <div class="col-6">
              <div class="rounded-3 p-2 text-center" style="background:#eff6ff;">
                <div class="fw-bold text-primary">${proyecto.area} m²</div>
                <div class="text-muted" style="font-size:11px;">Área</div>
              </div>
            </div>
            ${firmado && proyecto.incluyePlaca ? `
            <div class="col-12">
              <div class="rounded-3 p-2 text-center" style="background:#fffbeb;">
                <div class="fw-bold text-warning">${UI.formatCurrency(proyecto.placaPrecio)}</div>
                <div class="text-muted" style="font-size:11px;">Placa de Cimentación</div>
              </div>
            </div>` : ''}
          </div>

          <!-- Modelo -->
          <div class="mb-3 p-3 rounded-3 border">
            <div class="text-muted small fw-semibold text-uppercase mb-1">Modelo</div>
            <div class="fw-semibold">${UI.escapeHTML(proyecto.modelo)}</div>
          </div>

          <!-- Especificaciones técnicas -->
          ${this._renderEspecificaciones(proyecto.especificaciones)}

          <!-- Notas técnicas -->
          ${proyecto.notas ? `
            <div class="mt-3 p-3 rounded-3" style="background:#fefce8;border:1px solid #fde68a;">
              <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-sticky-fill text-warning"></i>
                <span class="fw-semibold small text-uppercase">Notas Técnicas</span>
              </div>
              <p class="mb-0 small" style="line-height:1.6;white-space:pre-wrap;word-break:break-word;">${UI.escapeHTML(proyecto.notas)}</p>
            </div>` : ''}

          ${!firmado ? `
            <div class="alert alert-warning mt-3 py-2 small">
              <i class="bi bi-info-circle me-1"></i>
              Para activar pagos, fecha de entrega y evidencias, cambia el estado del cliente a
              <strong>Firmado</strong> y luego edita el proyecto.
            </div>` : ''}

          <div class="mt-3 d-flex gap-2">
            <small class="text-muted align-self-center" style="font-size:11px;">
              <i class="bi bi-info-circle me-1"></i>Usa los botones de arriba para editar o imprimir.
            </small>
          </div>
        </div>

        <!-- Columna derecha: pagos (solo si firmado) -->
        ${firmado ? `
        <div class="col-md-6">
          <h6 class="fw-bold mb-3"><i class="bi bi-cash me-2 text-primary"></i>Resumen de Pagos</h6>
          <div id="resumenPagosExpediente">
            ${await Pagos.renderEtapasExpediente(cliente.id, proyecto.id)}
          </div>
        </div>` : ''}

        <!-- Galería (solo si firmado) -->
        ${firmado ? `
        <div class="col-12">
          <hr class="my-1" />
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h6 class="fw-bold mb-0">
              <i class="bi bi-images me-2 text-primary"></i>Evidencias / Planos
              ${(proyecto.archivos||[]).length > 0
                ? `<span class="badge bg-primary ms-1">${proyecto.archivos.length}</span>`
                : ''}
            </h6>
            <button class="btn btn-sm btn-outline-primary" onclick="Proyectos.abrirModalEditar('${proyecto.id}')">
              <i class="bi bi-plus-lg me-1"></i>Agregar
            </button>
          </div>
          ${await Proyectos.renderGaleria(proyecto)}
        </div>` : ''}

      </div>`;
  },

  async _tabPagos(clienteId, proyectoId) {
    // Selector de casa dentro del tab de pagos (si hay más de un proyecto)
    let selector = '';
    if (this._proyectos.length > 1) {
      const pills = this._proyectos.map((p, i) => {
        const activo = i === this._proyectoIdx;
        return `
          <button class="btn btn-sm ${activo ? 'btn-primary' : 'btn-outline-primary'} fw-semibold"
                  style="border-radius:20px;"
                  onclick="Expediente.seleccionarProyectoPagos(${i})">
            <i class="bi bi-house-door me-1"></i>Casa ${i + 1}
          </button>`;
      }).join('');
      selector = `
        <div class="d-flex align-items-center flex-wrap gap-2 p-2 mb-3 rounded-3"
             style="background:#eff6ff;border:1px solid #bfdbfe;">
          <span class="text-primary small fw-semibold me-1 ms-1"><i class="bi bi-houses me-1"></i>Pagos de:</span>
          ${pills}
        </div>`;
    }
    return `
      <div>
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h6 class="fw-bold mb-0"><i class="bi bi-cash-stack me-2 text-primary"></i>Etapas de Pago</h6>
        </div>
        ${selector}
        ${await Pagos.renderEtapasExpediente(clienteId, proyectoId)}
      </div>`;
  },

  // Cambiar de casa desde el tab de pagos y re-renderizar ese tab
  async seleccionarProyectoPagos(idx) {
    if (idx < 0 || idx >= this._proyectos.length) return;
    this._proyectoIdx = idx;
    const content = document.getElementById('expedienteTabContent');
    if (content) {
      content.innerHTML = UI.spinner();
      content.innerHTML = await this._tabPagos(this._cliente?.id, this._proyectoActual?.id);
    }
  },

  async _tabSeguimiento(clienteId) {
    return `
      <div>
        <div class="d-flex align-items-center justify-content-between mb-3">
          <h6 class="fw-bold mb-0"><i class="bi bi-chat-dots me-2 text-purple"></i>Historial de Seguimiento</h6>
          <button class="btn btn-sm btn-primary" onclick="Seguimiento.abrirModal('${clienteId}')">
            <i class="bi bi-plus-lg me-1"></i>Agregar
          </button>
        </div>
        ${await Seguimiento.renderTimeline(clienteId)}
      </div>`;
  },

  // ── Tab Historial de estados ──────────────────────────────────────────────
  async _tabHistorial(clienteId) {
    const registros = await DB.getByIndex(DB.STORES.historialEstados, 'clienteId', clienteId);
    registros.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const estadoConfig = {
      nuevo:        { label: 'Nuevo',            color: '#10b981', icon: 'bi-circle-fill',       bg: '#f0fdf4' },
      cotizado:     { label: 'Cotizado',          color: '#3b82f6', icon: 'bi-file-text-fill',    bg: '#eff6ff' },
      negociacion:  { label: 'En Negociación',    color: '#f59e0b', icon: 'bi-arrow-left-right',  bg: '#fffbeb' },
      firmado:      { label: 'Firmado',           color: '#f97316', icon: 'bi-pen-fill',          bg: '#fff7ed' },
      construccion: { label: 'En Construcción',   color: '#ef4444', icon: 'bi-hammer',            bg: '#fef2f2' },
      finalizado:   { label: 'Finalizado',        color: '#06b6d4', icon: 'bi-patch-check-fill',  bg: '#ecfeff' },
      perdido:      { label: 'Perdido',           color: '#94a3b8', icon: 'bi-x-circle-fill',     bg: '#f8fafc' }
    };

    if (registros.length === 0) {
      return `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-clock-history fs-1 d-block mb-3 opacity-25"></i>
          <h6 class="fw-semibold">Sin cambios registrados</h6>
          <p class="small">Los cambios de estado del proyecto aparecerán aquí automáticamente.</p>
        </div>`;
    }

    // Calcular tiempo en cada estado
    const conDuracion = registros.map((r, i) => {
      const siguiente = registros[i - 1]; // el más reciente está primero
      const hasta = siguiente ? new Date(siguiente.fecha) : new Date();
      const desde = new Date(r.fecha);
      const dias  = Math.round((hasta - desde) / 86400000);
      return { ...r, dias };
    });

    return `
      <div>
        <div class="d-flex align-items-center justify-content-between mb-4">
          <h6 class="fw-bold mb-0">
            <i class="bi bi-clock-history me-2" style="color:#8b5cf6;"></i>
            Historial de Estados
          </h6>
          <span class="badge rounded-pill" style="background:#f3f0ff;color:#7c3aed;font-size:11px;">
            ${registros.length} cambio${registros.length !== 1 ? 's' : ''}
          </span>
        </div>

        <!-- Línea de tiempo -->
        <div style="position:relative;padding-left:36px;">
          <!-- Línea vertical -->
          <div style="position:absolute;left:14px;top:8px;bottom:8px;width:2px;
                      background:linear-gradient(to bottom,#8b5cf6,#e2e8f0);
                      border-radius:2px;"></div>

          ${conDuracion.map((r, i) => {
            const cfg     = estadoConfig[r.estadoNuevo]  || { label: r.estadoNuevo,  color: '#94a3b8', icon: 'bi-circle', bg: '#f8fafc' };
            const cfgPrev = estadoConfig[r.estadoAnterior] || { label: r.estadoAnterior, color: '#94a3b8', icon: 'bi-circle', bg: '#f8fafc' };
            const esUltimo = i === conDuracion.length - 1;

            return `
              <div style="position:relative;margin-bottom:${esUltimo ? '0' : '20px'};">
                <!-- Punto en la línea -->
                <div style="position:absolute;left:-29px;top:10px;
                            width:16px;height:16px;border-radius:50%;
                            background:${cfg.color};border:3px solid white;
                            box-shadow:0 0 0 2px ${cfg.color}40;
                            display:flex;align-items:center;justify-content:center;">
                </div>

                <!-- Tarjeta del cambio -->
                <div style="background:${cfg.bg};border:1.5px solid ${cfg.color}30;
                            border-radius:12px;padding:12px 14px;
                            animation:fadeInUp 0.3s ease ${i * 0.06}s both;">

                  <!-- Fila superior: flecha de cambio -->
                  <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    <span class="badge fw-semibold"
                          style="background:${cfgPrev.color}18;color:${cfgPrev.color};
                                 border:1px solid ${cfgPrev.color}30;font-size:11px;padding:3px 10px;">
                      <i class="bi ${cfgPrev.icon} me-1"></i>${cfgPrev.label}
                    </span>
                    <i class="bi bi-arrow-right text-muted" style="font-size:12px;"></i>
                    <span class="badge fw-bold"
                          style="background:${cfg.color};color:white;font-size:11px;padding:3px 10px;">
                      <i class="bi ${cfg.icon} me-1"></i>${cfg.label}
                    </span>
                  </div>

                  <!-- Fila inferior: fecha + duración + usuario -->
                  <div class="d-flex align-items-center justify-content-between flex-wrap gap-1">
                    <div class="d-flex align-items-center gap-3">
                      <span class="text-muted" style="font-size:11px;">
                        <i class="bi bi-calendar3 me-1"></i>
                        ${UI.formatDateTime(r.fecha)}
                      </span>
                      <span class="text-muted" style="font-size:11px;">
                        <i class="bi bi-person me-1"></i>${r.usuario || 'Admin'}
                      </span>
                    </div>
                    ${r.dias > 0 ? `
                      <span style="background:rgba(0,0,0,0.06);color:#64748b;border-radius:20px;
                                   padding:2px 10px;font-size:10px;font-weight:600;">
                        <i class="bi bi-hourglass-split me-1"></i>
                        ${r.dias} día${r.dias !== 1 ? 's' : ''} en este estado
                      </span>` : ''}
                  </div>
                </div>
              </div>`;
          }).join('')}

          <!-- Estado actual (al final de la línea) -->
          ${(() => {
            const ultimo = conDuracion[0];
            if (!ultimo) return '';
            const cfgActual = estadoConfig[ultimo.estadoNuevo] || { label: ultimo.estadoNuevo, color: '#94a3b8', icon: 'bi-circle', bg: '#f8fafc' };
            const diasActual = Math.round((new Date() - new Date(ultimo.fecha)) / 86400000);
            return `
              <div style="position:relative;margin-top:20px;">
                <div style="position:absolute;left:-29px;top:10px;
                            width:16px;height:16px;border-radius:50%;
                            background:${cfgActual.color};border:3px solid white;
                            box-shadow:0 0 0 4px ${cfgActual.color}30;
                            animation:syncPulse 2s ease-in-out infinite;">
                </div>
                <div style="background:${cfgActual.bg};border:2px solid ${cfgActual.color}50;
                            border-radius:12px;padding:12px 14px;">
                  <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <div class="d-flex align-items-center gap-2">
                      <span class="fw-bold" style="color:${cfgActual.color};font-size:13px;">
                        <i class="bi ${cfgActual.icon} me-1"></i>Estado actual: ${cfgActual.label}
                      </span>
                    </div>
                    <span style="background:${cfgActual.color}18;color:${cfgActual.color};
                                 border-radius:20px;padding:2px 10px;font-size:10px;font-weight:700;">
                      <i class="bi bi-clock me-1"></i>
                      ${diasActual === 0 ? 'Hoy' : `${diasActual} día${diasActual !== 1 ? 's' : ''} aquí`}
                    </span>
                  </div>
                </div>
              </div>`;
          })()}
        </div>
      </div>`;
  },

  // ── Renderizar especificaciones técnicas ─────────────────────────────────
  _renderEspecificaciones(esp) {
    if (!esp) return '';

    const items = [
      { icon: 'bi-bricks',        label: 'Sistema',          val: esp.sistema },
      { icon: 'bi-house-door',    label: 'Estilo',           val: esp.estilo },
      { icon: 'bi-arrows-vertical',label:'Altura',           val: esp.alturaMin && esp.alturaMax ? `${esp.alturaMin}m — ${esp.alturaMax}m` : (esp.alturaMin || esp.alturaMax || null) },
      { icon: 'bi-house-fill',    label: 'Cubierta',         val: esp.cubierta === 'Otro' ? esp.cubiertaOtro : esp.cubierta },
      { icon: 'bi-grid-3x3-gap', label: 'Ornamentación',    val: this._ornLabel(esp) },
      { icon: 'bi-door-open',     label: 'Puertas',          val: this._puertaLabel(esp) }
    ].filter(i => i.val);

    // Obsequios (array opcional, compatible con proyectos antiguos)
    const obsequios = Array.isArray(esp.obsequios) ? esp.obsequios.filter(Boolean) : [];
    const obsequiosHTML = obsequios.length > 0
      ? `<div class="mt-3">
           <div class="d-flex align-items-center gap-2 mb-2">
             <i class="bi bi-gift text-success" style="font-size:13px;"></i>
             <span class="text-muted" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Obsequios</span>
           </div>
           <div class="d-flex flex-wrap gap-1">
             ${obsequios.map(o => `
               <span class="badge fw-normal px-2 py-1"
                     style="background:#f0fdf4;color:#166534;border:1px solid #86efac;border-radius:20px;font-size:11px;">
                 🎁 ${UI.escapeHTML(o)}
               </span>`).join('')}
           </div>
         </div>`
      : '';

    // Si no hay especificaciones ni obsequios, no mostrar nada
    if (items.length === 0 && !obsequiosHTML) return '';

    const secciones = [
      { titulo: 'Construcción',   icono: 'bi-bricks',       color: '#6366f1', bg: '#eef2ff', keys: ['Sistema', 'Estilo', 'Altura'] },
      { titulo: 'Cubierta',       icono: 'bi-house-fill',   color: '#0891b2', bg: '#ecfeff', keys: ['Cubierta'] },
      { titulo: 'Ornamentación',  icono: 'bi-grid-3x3-gap', color: '#059669', bg: '#ecfdf5', keys: ['Ornamentación'] },
      { titulo: 'Puertas',        icono: 'bi-door-open',    color: '#d97706', bg: '#fffbeb', keys: ['Puertas'] }
    ];

    return `
      <div class="mt-3">
        <div class="d-flex align-items-center gap-2 mb-3">
          <div style="height:1.5px;flex:1;background:linear-gradient(90deg,#e2e8f0,transparent);"></div>
          <span class="fw-bold small text-uppercase text-muted" style="letter-spacing:1px;">
            <i class="bi bi-tools me-1"></i>Especificaciones
          </span>
          <div style="height:1.5px;flex:1;background:linear-gradient(90deg,transparent,#e2e8f0);"></div>
        </div>
        <div class="row g-2">
          ${items.map(item => `
            <div class="col-12">
              <div class="d-flex align-items-start gap-2 p-2 rounded-3" style="background:#f8fafc;border:1px solid #e8edf2;">
                <i class="bi ${item.icon} mt-1 flex-shrink-0" style="color:#64748b;font-size:13px;"></i>
                <div class="flex-grow-1">
                  <div class="text-muted" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${item.label}</div>
                  <div class="fw-semibold small">${UI.escapeHTML(item.val)}</div>
                </div>
              </div>
            </div>`).join('')}
        </div>
        ${obsequiosHTML}
      </div>`;
  },

  _ornLabel(esp) {
    if (!esp?.ornSistema) return null;

    const color = esp.ornColor === 'Otro' ? (esp.ornColorOtro || '') : (esp.ornColor || '');
    const colorSufijo = color ? ` · Anticorrosivo ${color}` : '';
    const ornLower   = esp.ornSistema.toLowerCase();
    const esMixto    = ornLower.includes('mixto');
    const esAbatible = !esMixto && (ornLower.includes('apertura') || ornLower.includes('abatible'));
    const esCorredizo= !esMixto && ornLower.includes('corrediz');

    if (esMixto) {
      // Sistema mixto: mostrar detalle de cada sub-tipo
      const partes = [esp.ornSistema];
      // Sub-sección abatibles
      const refAb  = (esp.ornMixtoAbatiblesRef  || '').trim();
      const aperAb = esp.ornAperturaAbatible || '';
      if (refAb || aperAb) {
        let ab = 'Abatibles';
        if (refAb)  ab += `: ${refAb}`;
        if (aperAb) ab += ` (${aperAb})`;
        partes.push(ab);
      }
      // Sub-sección corredizas
      const refCo  = (esp.ornMixtoCorredizasRef      || '').trim();
      const aperCo = esp.ornAperturaCorredizaMixto || '';
      if (refCo || aperCo) {
        let co = 'Corredizas';
        if (refCo)  co += `: ${refCo}`;
        if (aperCo) co += ` (${aperCo})`;
        partes.push(co);
      }
      return partes.join(' · ') + colorSufijo || null;
    }

    if (esAbatible) {
      // Abatibles simples — campo original ornApertura
      let label = esp.ornSistema;
      if (esp.ornApertura) label += ` · ${esp.ornApertura}`;
      return label + colorSufijo || null;
    }

    if (esCorredizo) {
      // Corredizas simples — campo nuevo ornAperturaCorrediza
      let label = esp.ornSistema;
      if (esp.ornAperturaCorrediza) label += ` · ${esp.ornAperturaCorrediza}`;
      return label + colorSufijo || null;
    }

    // Fallback: cualquier otro valor de ornSistema (datos personalizados del usuario)
    let label = esp.ornSistema;
    // compatibilidad: si tiene ornApertura de datos antiguos, mostrarlo
    if (esp.ornApertura) label += ` · ${esp.ornApertura}`;
    return label + colorSufijo || null;
  },

  _puertaLabel(esp) {
    if (!esp?.puertaColor && !esp?.puertaChapa) return null;
    const parts = [];
    if (esp.puertaColor) parts.push(`Color ${esp.puertaColor}`);
    if (esp.puertaChapa) parts.push(esp.puertaChapa);
    return parts.join(' · ') || null;
  },

  // ── Editar cliente desde expediente (cierra expediente primero) ──────────
  editarClienteDesdeExpediente(clienteId) {
    const expedienteEl = document.getElementById('modalExpediente');
    const expedienteInstance = bootstrap.Modal.getInstance(expedienteEl);
    if (expedienteInstance && expedienteEl.classList.contains('show')) {
      expedienteEl.dataset.reopenClienteId = clienteId;
      expedienteInstance.hide();
      expedienteEl.addEventListener('hidden.bs.modal', async function abrirEditCliente() {
        expedienteEl.removeEventListener('hidden.bs.modal', abrirEditCliente);
        await Clientes.abrirModalEditar(clienteId);
      }, { once: true });
    } else {
      Clientes.abrirModalEditar(clienteId);
    }
  },

  bindEvents(clienteId) {
    document.querySelectorAll('#expedienteTabs .nav-link').forEach(tab => {
      tab.addEventListener('click', async (e) => {
        e.preventDefault();
        document.querySelectorAll('#expedienteTabs .nav-link').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const tabName = tab.dataset.tab;
        const content = document.getElementById('expedienteTabContent');
        content.innerHTML = UI.spinner();

        if (tabName === 'proyecto') {
          const cliente = await DB.get(DB.STORES.clientes, clienteId);
          content.innerHTML = await this._tabProyecto(cliente, this._proyectoActual);
        } else if (tabName === 'pagos') {
          content.innerHTML = await this._tabPagos(clienteId, this._proyectoActual?.id);
        } else if (tabName === 'seguimiento') {
          content.innerHTML = await this._tabSeguimiento(clienteId);
        } else if (tabName === 'historial') {
          content.innerHTML = await this._tabHistorial(clienteId);
        }
      });
    });
  }
};

// ── App Principal ─────────────────────────────────────────────────────────────
window.App = {
  currentPage: 'dashboard',

  // ── Inicializar ───────────────────────────────────────────────────────────
  async init() {
    try {
      // Mostrar el splash screen y arrancar en paralelo
      const splashPromise = this._mostrarSplash();

      // IndexedDB — datos locales (clientes, proyectos, pagos, etc.)
      await DB.init();
      await DB.seed();
      await DB.migrateArchivos();

      // Supabase — solo usuarios (compartido entre equipos)
      // El seed corre en segundo plano para NO bloquear el arranque si la red tarda.
      SupabaseUsers.init();
      SupabaseUsers.seed().catch(e => console.warn('[App] Supabase seed en segundo plano:', e?.message));

      // Auto-guardado en disco — reconectar carpeta si ya fue configurada
      if (AutoSave.isSupported()) {
        AutoSave.reconectar().then(ok => {
          if (ok) console.log('[App] Auto-guardado en disco reconectado');
        });
      }

      // Esperar a que se cumpla el tiempo mínimo del splash (los datos ya
      // cargaron arriba con await), luego ocultar el splash con animación.
      await splashPromise;
      await this._ocultarSplash();

      if (Auth.isAuthenticated()) {
        this.showApp();
      } else {
        this.showLogin();
      }

      this._bindGlobalEvents();
      this._checkOnlineStatus();
      this._checkReminders();
      // Verificar notificaciones de pagos al iniciar (con delay para no interrumpir el login)
      setTimeout(() => this._checkNotificacionesPagos(), 3000);
      // Recordatorio de backup (con delay para no saturar el inicio)
      setTimeout(() => this._checkBackupReminder(), 5000);

    } catch (err) {
      console.error('[App] Error al inicializar:', err);
      // Ocultar el splash y mostrar el login para no dejar pantalla en blanco
      const splash = document.getElementById('splashScreen');
      if (splash) splash.style.display = 'none';
      try { this.showLogin(); } catch (e) { /* ignore */ }
      alert('Hubo un problema al iniciar. Intenta recargar la página.\n\nDetalle: ' + (err?.message || err));
    }
  },

  // ── Splash screen de bienvenida ───────────────────────────────────────────
  _mostrarSplash() {
    return new Promise(resolve => {
      const splash  = document.getElementById('splashScreen');
      const bar     = document.getElementById('splashBar');
      if (!splash) { resolve(); return; }

      // Sonido de bienvenida (acorde mayor ascendente — cálido y profesional)
      try {
        const ac   = new (window.AudioContext || window.webkitAudioContext)();
        const notas = [
          { freq: 523.25, t: 0.00 },   // Do5
          { freq: 659.25, t: 0.18 },   // Mi5
          { freq: 783.99, t: 0.36 },   // Sol5
          { freq: 1046.5, t: 0.55 }    // Do6
        ];
        notas.forEach(({ freq, t }) => {
          const osc  = ac.createOscillator();
          const gain = ac.createGain();
          osc.connect(gain);
          gain.connect(ac.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ac.currentTime + t);
          gain.gain.setValueAtTime(0, ac.currentTime + t);
          gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + t + 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.35);
          osc.start(ac.currentTime + t);
          osc.stop(ac.currentTime + t + 0.4);
        });
      } catch (e) { /* silencioso si el navegador bloquea el audio */ }

      // Arrancar la barra de progreso
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (bar) bar.style.width = '100%';
      }));

      // Tiempo mínimo visible del splash: 2.6 segundos.
      // NO oculta el splash aquí; solo cumple el mínimo. El ocultamiento lo
      // dispara init() con _ocultarSplash() cuando los datos ya están listos.
      setTimeout(resolve, 2600);
    });
  },

  // ── Ocultar el splash con animación de salida ─────────────────────────────
  _ocultarSplash() {
    return new Promise(resolve => {
      const splash = document.getElementById('splashScreen');
      if (!splash || splash.style.display === 'none') { resolve(); return; }
      splash.classList.add('splash-saliendo');
      setTimeout(() => {
        splash.style.display = 'none';
        resolve();
      }, 480); // duración del fade out
    });
  },

  // ── Mostrar login ─────────────────────────────────────────────────────────
  showLogin() {
    document.getElementById('loginScreen').classList.remove('d-none');
    document.getElementById('appScreen').classList.add('d-none');
    // Verificar si el login está bloqueado y mostrar TOTP si aplica
    this._checkTOTPUnlockVisibility();
  },

  // ── Mostrar app ───────────────────────────────────────────────────────────
  showApp() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('appScreen').classList.remove('d-none');

    const session = Auth.getSession();
    // Leer nombre personalizado de localStorage (tiene prioridad)
    const nombreDisplay = localStorage.getItem('clienteapp_nombre_display')
      || (session?.nombre === 'Administrador' ? 'George' : (session?.nombre || 'George'));
    document.getElementById('sidebarUserName').textContent = nombreDisplay;
    document.getElementById('sidebarUserRole').textContent = Auth.getRoleName(session?.rol || '');
    document.getElementById('sidebarAvatar').textContent   = UI.initials(nombreDisplay);

    // Aplicar preferencia guardada de privacidad de valores en dinero
    MoneyPrivacy.aplicar();

    this.navigate('dashboard');
    this.updateBadges();

    // Solicitar permisos de notificaciones push (con pequeño delay para no interrumpir)
    setTimeout(() => PushNotif.requestPermission(), 2000);
  },

  // ── Navegar a página ──────────────────────────────────────────────────────
  async navigate(page) {
    this.currentPage = page;

    // Actualizar sidebar activo
    document.querySelectorAll('.sidebar-link').forEach(l => {
      l.classList.toggle('active', l.dataset.page === page);
    });

    // Actualizar título
    const titles = {
      dashboard:     'Dashboard',
      clientes:      'Clientes',
      proyectos:     'Proyectos',
      pagos:         'Control de Pagos',
      finanzas:      'Mis Finanzas',
      tareas:        'Tareas y Pendientes',
      configuracion: 'Configuración'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    // Cerrar sidebar en móvil
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.add('d-none');

    // Renderizar página
    const pages = {
      dashboard:     () => Dashboard.render(),
      clientes:      () => Clientes.render(),
      proyectos:     () => Proyectos.render(),
      pagos:         () => Pagos.render(),
      finanzas:      () => Finanzas.render(),
      tareas:        () => Tareas.render(),
      configuracion: () => Configuracion.render()
    };

    if (pages[page]) await pages[page]();

    // Re-verificar notificaciones de pagos al entrar al dashboard
    if (page === 'dashboard') {
      setTimeout(() => this._checkNotificacionesPagos(), 1500);
    }
  },

  // ── Actualizar badges ─────────────────────────────────────────────────────
  async updateBadges() {
    const [clientes, pagos, tareas] = await Promise.all([
      DB.getAll(DB.STORES.clientes),
      DB.getAll(DB.STORES.pagos),
      DB.getAll(DB.STORES.tareas)
    ]);

    document.getElementById('badgeClientes').textContent = clientes.length || '';
    const pendientesPago = pagos.filter(p => p.estado !== 'pagado').length;
    document.getElementById('badgePagos').textContent = pendientesPago || '';

    // Badge tareas
    const tareasPendientes = tareas.filter(t => t.estado !== 'completada').length;
    const badgeTareas = document.getElementById('badgeTareas');
    if (badgeTareas) {
      if (tareasPendientes > 0) {
        badgeTareas.textContent = tareasPendientes;
        badgeTareas.style.display = '';
      } else {
        badgeTareas.style.display = 'none';
      }
    }

    // Badge notificaciones — usar NotifHistory como fuente única de verdad
    const unread = NotifHistory.unreadCount();
    const badge = document.getElementById('notifBadge');
    if (unread > 0) {
      badge.textContent = unread > 9 ? '9+' : unread;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  },

  // ── Eventos globales ──────────────────────────────────────────────────────
  _bindGlobalEvents() {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user  = document.getElementById('loginUser').value;
      const pass  = document.getElementById('loginPass').value;
      const alert = document.getElementById('loginAlert');
      const msg   = document.getElementById('loginAlertMsg');
      const btn   = e.target.querySelector('button[type="submit"]');

      // Mostrar spinner en el botón
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Verificando...';
      btn.disabled = true;

      try {
        await Auth.login(user, pass);
        btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>¡Bienvenido!';
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        document.getElementById('totpUnlockSection').classList.add('d-none');
        setTimeout(() => this.showApp(), 400);
      } catch (err) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        msg.textContent = err.message;
        alert.classList.remove('d-none');
        Sound.play('danger');
        // Sacudir el formulario
        const card = document.querySelector('#loginScreen .card');
        if (card) {
          card.style.animation = 'loginShake 0.4s ease';
          setTimeout(() => { card.style.animation = ''; }, 400);
        }
        setTimeout(() => alert.classList.add('d-none'), 6000);

        // Mostrar sección TOTP si está bloqueado con Authenticator
        this._checkTOTPUnlockVisibility();
      }
    });

    // Botón desbloquear con TOTP
    document.getElementById('btnTotpUnlock')?.addEventListener('click', async () => {
      const code = document.getElementById('totpCode').value.replace(/\s/g, '');
      const alertEl = document.getElementById('totpUnlockAlert');

      if (!code || code.length < 6) {
        alertEl.textContent = 'Ingresa el código de 6 dígitos.';
        alertEl.classList.remove('d-none');
        return;
      }

      try {
        await Auth.desbloquearConTOTP(code);
        alertEl.classList.add('d-none');
        document.getElementById('totpUnlockSection').classList.add('d-none');
        document.getElementById('totpCode').value = '';
        UI.toast('Cuenta desbloqueada. Intenta iniciar sesión.', 'success');
      } catch (err) {
        alertEl.textContent = err.message;
        alertEl.classList.remove('d-none');
        Sound.play('danger');
      }
    });

    // Enter en campo TOTP
    document.getElementById('totpCode')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnTotpUnlock')?.click();
    });

    // Toggle password
    document.getElementById('togglePass').addEventListener('click', () => {
      const input = document.getElementById('loginPass');
      const icon  = document.querySelector('#togglePass i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'bi bi-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'bi bi-eye';
      }
    });

    // Logout
    document.getElementById('btnLogout').addEventListener('click', () => Auth.logout());

    // Sidebar links
    document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(link.dataset.page);
      });
    });

    // Mobile sidebar
    document.getElementById('openSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.remove('d-none');
    });

    document.getElementById('closeSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.add('d-none');
    });

    document.getElementById('sidebarOverlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.add('d-none');
    });

    // Notificaciones
    document.getElementById('btnNotifications').addEventListener('click', () => {
      UI.mostrarPanelNotificaciones();
    });

    // Ocultar/mostrar valores en dinero (toggle "ojito")
    document.getElementById('btnToggleMoney')?.addEventListener('click', () => {
      MoneyPrivacy.toggle();
    });
  },

  // ── Mostrar/ocultar sección TOTP según estado de bloqueo ────────────────
  _checkTOTPUnlockVisibility() {
    const lock = Auth.estasBloqueado();
    const section = document.getElementById('totpUnlockSection');
    if (!section) return;

    if (lock.bloqueado && lock.requiereTOTP && TOTP.estaConfigurado()) {
      section.classList.remove('d-none');
    } else {
      section.classList.add('d-none');
    }
  },

  // ── Estado online/offline ─────────────────────────────────────────────────
  _checkOnlineStatus() {
    const update = () => {
      const online = navigator.onLine;
      const dot  = document.getElementById('syncStatus');
      const text = document.getElementById('syncText');
      dot.className    = 'sync-dot ' + (online ? 'online' : 'offline');
      text.textContent = online ? 'En línea' : 'Sin conexión';
    };

    update();
    window.addEventListener('online',  () => {
      update();
      UI.toast('Conexión restaurada', 'success');
    });
    window.addEventListener('offline', () => {
      update();
      UI.toast('Sin conexión — modo offline activo', 'warning');
    });
  },

  // ── Verificar recordatorios ───────────────────────────────────────────────
  async _checkReminders() {
    const seguimientos = await DB.getAll(DB.STORES.seguimientos);
    const ahora = new Date();

    for (const s of seguimientos) {
      if (!s.recordatorio || s.recordatorioMostrado) continue;
      const fecha = new Date(s.recordatorio);
      if (fecha <= ahora) {
        const cliente = await DB.get(DB.STORES.clientes, s.clienteId);
        UI.toast(
          `${cliente?.nombre || 'Cliente'} — ${s.descripcion.substring(0, 60)}`,
          'alert',
          8000
        );
        s.recordatorioMostrado = true;
        await DB.put(DB.STORES.seguimientos, s);
      }
    }
  },

  // ── Recordatorio de backup ────────────────────────────────────────────────
  async _checkBackupReminder() {
    const DIAS_LIMITE = 7;

    // Si el auto-guardado a disco está activo, los datos ya se respaldan solos → no molestar
    if (window.AutoSave && AutoSave.estaConectado && AutoSave.estaConectado()) return;

    // Si no hay datos aún, no tiene sentido pedir backup
    const clientes = await DB.getAll(DB.STORES.clientes);
    if (clientes.length === 0) return;

    const ultimo = localStorage.getItem('clienteapp_ultimo_backup');

    // Evitar mostrar el aviso más de una vez por día
    const hoyStr = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('clienteapp_backup_aviso_dia') === hoyStr) return;

    let diasSin;
    if (!ultimo) {
      diasSin = null; // nunca ha hecho backup
    } else {
      diasSin = Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
      if (diasSin < DIAS_LIMITE) return; // backup reciente, no molestar
    }

    // Marcar que ya avisamos hoy
    localStorage.setItem('clienteapp_backup_aviso_dia', hoyStr);

    const mensaje = diasSin === null
      ? 'Aún no has hecho una copia de seguridad. Ve a Configuración → Exportar para proteger tus datos.'
      : `Hace ${diasSin} días que no haces copia de seguridad. Ve a Configuración → Exportar para proteger tus datos.`;

    UI.toast(mensaje, 'warning', 9000);
  },

  // ── Notificaciones inteligentes de pagos ──────────────────────────────────
  async _checkNotificacionesPagos() {
    const CLAVE = 'clienteapp_notif_pagos_vistas';
    let vistas = {};
    try { vistas = JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch {}

    const hoy       = new Date(); hoy.setHours(0,0,0,0);
    const clientes  = await DB.getAll(DB.STORES.clientes);
    const proyectos = await DB.getAll(DB.STORES.proyectos);
    const pagos     = await DB.getAll(DB.STORES.pagos);

    const proyMap = Object.fromEntries(proyectos.map(p => [p.clienteId, p]));

    for (const cliente of clientes) {
      const proyecto = proyMap[cliente.id];
      if (!proyecto) continue;

      const pagosFirma = pagos.filter(p => p.clienteId === cliente.id && p.etapa === 'firma');
      const pagosMat   = pagos.filter(p => p.clienteId === cliente.id && p.etapa === 'materiales');

      // ── REGLA 1: Falta ≤ 30 días para entrega y firma < 50% pagada ────────
      if (proyecto.fechaEntrega && pagosFirma.length > 0) {
        const fechaEntrega = new Date(proyecto.fechaEntrega + 'T00:00:00');
        const diasRestantes = Math.round((fechaEntrega - hoy) / 86400000);
        const firma = pagosFirma[0];
        const pctFirma = firma.valorTotal > 0
          ? Math.round(firma.valorPagado / firma.valorTotal * 100) : 0;

        if (diasRestantes >= 0 && diasRestantes <= 30 && pctFirma < 50) {
          const claveNotif = `firma_${cliente.id}_${proyecto.fechaEntrega}`;
          if (!vistas[claveNotif]) {
            const diasTexto = diasRestantes === 0 ? 'hoy' : `en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`;
            UI.toast(
              `⚠️ ${cliente.nombre} — entrega ${diasTexto} y solo ha pagado el ${pctFirma}% de la firma del contrato`,
              'warning', 10000
            );
            PushNotif.send(
              'Pago pendiente — Firma del Contrato',
              `${cliente.nombre}: entrega ${diasTexto}, ${pctFirma}% pagado de la firma`
            );
            vistas[claveNotif] = new Date().toDateString();
          }
        }
      }

      // ── REGLA 2: Estado = construccion y 40% materiales sin pagar (>1 día) ─
      if (cliente.estado === 'construccion' && pagosMat.length > 0) {
        const mat = pagosMat[0];
        const pctMat = mat.valorTotal > 0
          ? Math.round(mat.valorPagado / mat.valorTotal * 100) : 0;

        if (pctMat < 40) {
          // Calcular días desde que entró en construcción
          const fechaIni = proyecto.fechaIniConstruccion
            ? new Date(proyecto.fechaIniConstruccion)
            : null;
          const diasEnObra = fechaIni
            ? Math.floor((hoy - fechaIni) / 86400000) : 0;

          if (diasEnObra >= 1) {
            const claveNotif = `materiales_${cliente.id}_${new Date().toDateString()}`;
            if (!vistas[claveNotif]) {
              UI.toast(
                `🏗️ ${cliente.nombre} — lleva ${diasEnObra} día${diasEnObra !== 1 ? 's' : ''} en construcción y aún no ha cancelado el 40% de materiales (${pctMat}% pagado)`,
                'alert', 10000
              );
              PushNotif.send(
                'Pago pendiente — Descarga de Materiales',
                `${cliente.nombre}: ${diasEnObra}d en obra, ${pctMat}% pagado de materiales`
              );
              vistas[claveNotif] = new Date().toDateString();
            }
          }
        }
      }
    }

    localStorage.setItem(CLAVE, JSON.stringify(vistas));
  }
};

// ── Registrar Service Worker ──────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // Detectar nueva versión disponible
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Hay una nueva versión — notificar al usuario
            UI.toast('Nueva versión disponible. Recarga para actualizar.', 'info', 8000);
          }
        });
      });
    }).catch(err => {
      console.warn('[SW] No se pudo registrar:', err);
    });
  });
}

// ── PWA Install prompt ────────────────────────────────────────────────────────
let _deferredInstallPrompt = null;

// Cuando el navegador soporta instalación automática
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;

  // Mostrar sección de instalación directa en el modal
  const autoSection = document.getElementById('pwaAutoInstall');
  if (autoSection) autoSection.classList.remove('d-none');

  // Botón de instalación directa dentro del modal
  const btnDirecto = document.getElementById('btnInstalarDirecto');
  if (btnDirecto) {
    btnDirecto.onclick = async () => {
      if (!_deferredInstallPrompt) return;
      btnDirecto.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Instalando...';
      btnDirecto.disabled = true;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        UI.toast('¡ClienteAPP instalada en tu escritorio!', 'success', 7000);
        bootstrap.Modal.getInstance(document.getElementById('modalInstalar'))?.hide();
      } else {
        btnDirecto.innerHTML = '<i class="bi bi-download me-2"></i>Instalar Ahora';
        btnDirecto.disabled = false;
      }
      _deferredInstallPrompt = null;
    };
  }
});

// El botón siempre abre el modal de instrucciones
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnInstalarPWA');
  if (btn) {
    btn.addEventListener('click', () => {
      // Si hay prompt automático disponible, dispararlo directamente
      if (_deferredInstallPrompt) {
        _deferredInstallPrompt.prompt();
        _deferredInstallPrompt.userChoice.then(({ outcome }) => {
          if (outcome === 'accepted') {
            UI.toast('¡ClienteAPP instalada en tu escritorio!', 'success', 7000);
            btn.style.display = 'none';
          }
          _deferredInstallPrompt = null;
        });
      } else {
        // Mostrar modal con instrucciones
        UI.openModal('modalInstalar');
      }
    });
  }
});

window.addEventListener('appinstalled', () => {
  UI.toast('✅ ClienteAPP instalada correctamente en tu dispositivo', 'success', 6000);
  const btn = document.getElementById('btnInstalarPWA');
  if (btn) btn.style.display = 'none';
  localStorage.setItem('pwa_installed', '1');
  _deferredInstallPrompt = null;
});

// Al cargar, ocultar el botón si ya fue instalada antes
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('pwa_installed') === '1') {
    const btn = document.getElementById('btnInstalarPWA');
    if (btn) btn.style.display = 'none';
  }
});

// ── Iniciar aplicación ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

/* ══════════════════════════════════════════
   BÚSQUEDA GLOBAL
══════════════════════════════════════════ */
window.BusquedaGlobal = {

  _indiceActivo: -1,
  _resultados:   [],

  // ── Abrir ─────────────────────────────────────────────────────────────────
  abrir() {
    const overlay = document.getElementById('searchOverlay');
    const input   = document.getElementById('globalSearchInput');
    overlay.classList.add('visible');
    input.value = '';
    this._mostrarPlaceholder();
    this._indiceActivo = -1;
    setTimeout(() => input.focus(), 80);
  },

  // ── Cerrar ────────────────────────────────────────────────────────────────
  cerrar() {
    const overlay = document.getElementById('searchOverlay');
    overlay.classList.remove('visible');
    document.getElementById('globalSearchInput').value = '';
    this._resultados = [];
    this._indiceActivo = -1;
  },

  // ── Placeholder inicial ───────────────────────────────────────────────────
  _mostrarPlaceholder() {
    document.getElementById('globalSearchResults').innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-search d-block mb-2 opacity-25" style="font-size:36px;"></i>
        <div class="small fw-semibold">Escribe para buscar</div>
        <div style="font-size:11px;margin-top:4px;color:#cbd5e1;">
          Clientes · Proyectos · Pagos pendientes
        </div>
      </div>`;
  },

  // ── Buscar ────────────────────────────────────────────────────────────────
  async buscar(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { this._mostrarPlaceholder(); return; }

    const [clientes, proyectos, pagos] = await Promise.all([
      DB.getAll(DB.STORES.clientes),
      DB.getAll(DB.STORES.proyectos),
      DB.getAll(DB.STORES.pagos)
    ]);

    const proyMap = Object.fromEntries(proyectos.map(p => [p.clienteId, p]));
    // Mapa cliente por id — evita recorrer el array de clientes por cada proyecto/pago
    const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
    this._resultados = [];

    // ── Clientes ──────────────────────────────────────────────────────────
    const clientesMatch = clientes.filter(c =>
      c.nombre?.toLowerCase().includes(q) ||
      c.telefono?.includes(q) ||
      c.ubicacion?.toLowerCase().includes(q)
    ).slice(0, 5);

    clientesMatch.forEach(c => {
      this._resultados.push({
        tipo:    'cliente',
        id:      c.id,
        titulo:  c.nombre,
        sub:     `${c.telefono || '—'} · ${c.ubicacion || 'Sin ubicación'}`,
        estado:  c.estado,
        accion:  () => { this.cerrar(); Clientes.abrirExpediente(c.id); }
      });
    });

    // ── Proyectos ─────────────────────────────────────────────────────────
    const proyectosMatch = proyectos.filter(p =>
      p.modelo?.toLowerCase().includes(q) ||
      clienteMap[p.clienteId]?.nombre?.toLowerCase().includes(q)
    ).slice(0, 4);

    proyectosMatch.forEach(p => {
      const cliente = clienteMap[p.clienteId];
      this._resultados.push({
        tipo:   'proyecto',
        id:     p.id,
        titulo: p.modelo || 'Sin modelo',
        sub:    `${cliente?.nombre || '—'} · ${p.area}m² · ${UI.formatCurrency(p.precio)}`,
        accion: () => { this.cerrar(); Clientes.abrirExpediente(p.clienteId); }
      });
    });

    // ── Pagos pendientes ──────────────────────────────────────────────────
    const pagosMatch = pagos.filter(p => {
      if (p.estado === 'pagado') return false;
      const c = clienteMap[p.clienteId];
      return c?.nombre?.toLowerCase().includes(q) ||
             p.etapaLabel?.toLowerCase().includes(q);
    }).slice(0, 4);

    pagosMatch.forEach(p => {
      const c = clienteMap[p.clienteId];
      const pendiente = (p.valorTotal || 0) - (p.valorPagado || 0);
      this._resultados.push({
        tipo:   'pago',
        id:     p.id,
        titulo: `${c?.nombre || '—'} — ${p.etapaLabel}`,
        sub:    `Pendiente: ${UI.formatCurrency(pendiente)} · ${p.estado}`,
        estado: p.estado,
        accion: () => { this.cerrar(); App.navigate('pagos'); }
      });
    });

    this._renderResultados(q);
  },

  // ── Renderizar resultados ─────────────────────────────────────────────────
  _renderResultados(q) {
    const container = document.getElementById('globalSearchResults');
    this._indiceActivo = -1;

    if (this._resultados.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-emoji-frown d-block mb-2 opacity-25" style="font-size:36px;"></i>
          <div class="small fw-semibold">Sin resultados para "${q}"</div>
          <div style="font-size:11px;margin-top:4px;color:#cbd5e1;">
            Intenta con otro nombre, teléfono o modelo
          </div>
        </div>`;
      return;
    }

    // Agrupar por tipo
    const grupos = [
      { tipo: 'cliente',  label: 'Clientes',           icon: 'bi-people-fill',    color: '#3b82f6', bg: '#eff6ff' },
      { tipo: 'proyecto', label: 'Proyectos',           icon: 'bi-building-fill',  color: '#10b981', bg: '#f0fdf4' },
      { tipo: 'pago',     label: 'Pagos Pendientes',    icon: 'bi-cash-stack',     color: '#f59e0b', bg: '#fffbeb' }
    ];

    const highlight = (texto) => {
      if (!texto || !q) return texto;
      const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return texto.replace(re, '<span class="search-highlight">$1</span>');
    };

    let html = '';
    grupos.forEach(g => {
      const items = this._resultados.filter(r => r.tipo === g.tipo);
      if (items.length === 0) return;

      html += `<div class="search-group-label">${g.label}</div>`;
      items.forEach((item, i) => {
        const idx = this._resultados.indexOf(item);
        html += `
          <div class="search-result-item" data-idx="${idx}"
               onclick="BusquedaGlobal._ejecutar(${idx})">
            <div class="search-result-icon" style="background:${g.bg};color:${g.color};">
              <i class="bi ${g.icon}"></i>
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="search-result-title">${highlight(item.titulo)}</div>
              <div class="search-result-sub">${highlight(item.sub)}</div>
            </div>
            ${item.estado ? `<div style="flex-shrink:0;">${UI.estadoBadge(item.estado)}</div>` : ''}
            <i class="bi bi-arrow-return-left text-muted flex-shrink-0" style="font-size:12px;opacity:0.4;"></i>
          </div>`;
      });
    });

    container.innerHTML = html;
  },

  // ── Ejecutar acción del resultado ─────────────────────────────────────────
  _ejecutar(idx) {
    const item = this._resultados[idx];
    if (item?.accion) item.accion();
  },

  // ── Navegación con teclado ────────────────────────────────────────────────
  _moverSeleccion(dir) {
    const items = document.querySelectorAll('.search-result-item');
    if (items.length === 0) return;

    items[this._indiceActivo]?.classList.remove('active');
    this._indiceActivo = Math.max(0, Math.min(items.length - 1, this._indiceActivo + dir));
    const activo = items[this._indiceActivo];
    activo?.classList.add('active');
    activo?.scrollIntoView({ block: 'nearest' });
  },

  // ── Confirmar selección con Enter ─────────────────────────────────────────
  _confirmar() {
    if (this._indiceActivo >= 0) {
      const items = document.querySelectorAll('.search-result-item');
      const idx   = parseInt(items[this._indiceActivo]?.dataset.idx ?? '-1');
      if (idx >= 0) this._ejecutar(idx);
    }
  },

  // ── Inicializar eventos ───────────────────────────────────────────────────
  init() {
    // Botón en topbar
    document.getElementById('btnBusquedaGlobal')?.addEventListener('click', () => this.abrir());

    // Cerrar al hacer clic en el fondo
    document.getElementById('searchOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('searchOverlay')) this.cerrar();
    });

    // Input — buscar mientras escribe
    let debounce;
    document.getElementById('globalSearchInput')?.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => this.buscar(e.target.value), 200);
    });

    // Teclado — navegación y cierre
    document.getElementById('globalSearchInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown')  { e.preventDefault(); this._moverSeleccion(1); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this._moverSeleccion(-1); }
      if (e.key === 'Enter')      { e.preventDefault(); this._confirmar(); }
      if (e.key === 'Escape')     this.cerrar();
    });

    // Atajo global Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const overlay = document.getElementById('searchOverlay');
        overlay.classList.contains('visible') ? this.cerrar() : this.abrir();
      }
      if (e.key === 'Escape') this.cerrar();
    });
  }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => BusquedaGlobal.init(), 600);
});
