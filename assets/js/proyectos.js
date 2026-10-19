/* ============================================
   ClienteAPP — Módulo de Proyectos
   ============================================ */

window.Proyectos = {

  // Archivos pendientes en el modal (antes de guardar)
  _archivosNuevos: [],
  // Cache de archivos del proyecto actual (para el lightbox)
  _archivosCache: [],

  // Estado de filtros/orden de la página de proyectos
  _busqueda: '',
  _filtroEstado: 'todos',
  _orden: 'recientes',

  // Estados que implican contrato firmado
  ESTADOS_FIRMADOS: ['firmado', 'construccion', 'finalizado'],

  // ── ¿El cliente tiene contrato activo? ───────────────────────────────────
  async _clienteFirmado(clienteId) {
    const cliente = await DB.get(DB.STORES.clientes, clienteId);
    return cliente && this.ESTADOS_FIRMADOS.includes(cliente.estado);
  },

  // ── Renderizar página ────────────────────────────────────────────────────
  async render() {
    const content = document.getElementById('pageContent');
    content.innerHTML = UI.spinner('Cargando proyectos...');

    const proyectos = await DB.getAll(DB.STORES.proyectos);
    const clientes  = await DB.getAll(DB.STORES.clientes);
    this._clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
    this._proyectosCache = proyectos;

    if (proyectos.length === 0) {
      content.innerHTML = `<div class="fade-in">${UI.emptyState('bi-building', 'No hay proyectos', 'Los proyectos se crean desde el expediente de cada cliente')}</div>`;
      return;
    }

    content.innerHTML = `
      <div class="fade-in">

        <!-- Búsqueda + filtros + orden -->
        <div class="card-app p-3 mb-4">
          <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
            <div class="search-bar flex-grow-1" style="max-width:420px;">
              <i class="bi bi-search text-muted"></i>
              <input type="text" id="searchProyectos" placeholder="Buscar por modelo o cliente..." value="${UI.escapeHTML(this._busqueda)}" />
            </div>
            <div class="d-flex align-items-center gap-2 ms-auto">
              <label class="text-muted small fw-semibold mb-0"><i class="bi bi-sort-down me-1"></i>Ordenar:</label>
              <select id="ordenProyectos" class="form-select form-select-sm" style="width:auto;">
                <option value="recientes">Más recientes</option>
                <option value="antiguos">Más antiguos</option>
                <option value="entrega">Fecha de entrega</option>
                <option value="precio_desc">Precio: mayor a menor</option>
                <option value="precio_asc">Precio: menor a mayor</option>
                <option value="area_desc">Área: mayor a menor</option>
                <option value="modelo">Modelo (A-Z)</option>
              </select>
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2">
            ${this._filterPills()}
          </div>
        </div>

        <!-- Listado -->
        <div id="listaProyectos">
          ${this._renderLista()}
        </div>
      </div>`;

    this._bindEventos();
  },

  // ── Pills de filtro por estado ────────────────────────────────────────────
  _filterPills() {
    const filtros = [
      { key: 'todos',        label: 'Todos' },
      { key: 'cotizacion',   label: '📝 Cotización' },
      { key: 'firmado',      label: '🟠 Firmados' },
      { key: 'construccion', label: '🔴 En Construcción' },
      { key: 'finalizado',   label: '✅ Finalizados' }
    ];
    return filtros.map(f =>
      `<button class="filter-pill ${this._filtroEstado === f.key ? 'active' : ''}" data-fproy="${f.key}">${f.label}</button>`
    ).join('');
  },

  // ── Aplicar filtros + orden y renderizar tarjetas ─────────────────────────
  _renderLista() {
    const clienteMap = this._clienteMap || {};
    let lista = [...(this._proyectosCache || [])];

    // Filtro por estado (del cliente asociado)
    if (this._filtroEstado !== 'todos') {
      lista = lista.filter(p => {
        const estado = clienteMap[p.clienteId]?.estado || 'nuevo';
        if (this._filtroEstado === 'cotizacion') {
          // No firmados aún (cotización)
          return !this.ESTADOS_FIRMADOS.includes(estado);
        }
        return estado === this._filtroEstado;
      });
    }

    // Búsqueda por modelo o nombre de cliente
    if (this._busqueda) {
      const q = this._busqueda.toLowerCase();
      lista = lista.filter(p => {
        const modelo = (p.modelo || '').toLowerCase();
        const nombre = (clienteMap[p.clienteId]?.nombre || '').toLowerCase();
        return modelo.includes(q) || nombre.includes(q);
      });
    }

    // Ordenamiento
    lista.sort((a, b) => {
      switch (this._orden) {
        case 'antiguos':    return new Date(a.createdAt) - new Date(b.createdAt);
        case 'precio_desc': return (b.precio || 0) - (a.precio || 0);
        case 'precio_asc':  return (a.precio || 0) - (b.precio || 0);
        case 'area_desc':   return (b.area || 0) - (a.area || 0);
        case 'modelo':      return (a.modelo || '').localeCompare(b.modelo || '');
        case 'entrega': {
          // Con fecha primero (más próxima), sin fecha al final
          if (!a.fechaEntrega && !b.fechaEntrega) return 0;
          if (!a.fechaEntrega) return 1;
          if (!b.fechaEntrega) return -1;
          return new Date(a.fechaEntrega) - new Date(b.fechaEntrega);
        }
        case 'recientes':
        default:            return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    if (lista.length === 0) {
      return UI.emptyState('bi-search', 'Sin resultados',
        this._busqueda ? 'Prueba con otra búsqueda' : 'No hay proyectos con ese filtro');
    }

    return `<div class="row g-4">${lista.map(p => this._proyectoCard(p, clienteMap[p.clienteId])).join('')}</div>`;
  },

  // ── Actualizar solo el listado (sin re-render completo) ───────────────────
  _actualizarLista() {
    const cont = document.getElementById('listaProyectos');
    if (cont) cont.innerHTML = this._renderLista();
  },

  // ── Eventos de la barra de filtros ────────────────────────────────────────
  _bindEventos() {
    document.getElementById('searchProyectos')?.addEventListener('input', (e) => {
      this._busqueda = e.target.value;
      this._actualizarLista();
    });

    const ordenSel = document.getElementById('ordenProyectos');
    if (ordenSel) {
      ordenSel.value = this._orden;
      ordenSel.addEventListener('change', (e) => {
        this._orden = e.target.value;
        this._actualizarLista();
      });
    }

    document.querySelectorAll('[data-fproy]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._filtroEstado = btn.dataset.fproy;
        document.querySelectorAll('[data-fproy]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._actualizarLista();
      });
    });
  },

  // ── Card de proyecto ──────────────────────────────────────────────────────
  _proyectoCard(p, cliente) {
    const estado    = cliente?.estado || 'nuevo';
    const firmado   = this.ESTADOS_FIRMADOS.includes(estado);
    const nArchivos = (p.archivos || []).length;
    const esp       = p.especificaciones || {};

    const chips = [
      esp.sistema      ? { icon: 'bi-bricks',        label: esp.sistema } : null,
      esp.cubierta     ? { icon: 'bi-house-fill',     label: esp.cubierta === 'Otro' ? esp.cubiertaOtro : esp.cubierta } : null,
      esp.ornSistema   ? { icon: 'bi-grid-3x3-gap',   label: esp.ornSistema } : null,
      esp.puertaChapa  ? { icon: 'bi-door-open',      label: esp.puertaChapa } : null
    ].filter(Boolean).slice(0, 4);

    // Badge dinámico según el estado real del cliente
    const estadosBadge = {
      nuevo:        { bg: '#d1fae5', color: '#065f46', icon: 'bi-circle-fill',      label: 'Nuevo' },
      cotizado:     { bg: '#dbeafe', color: '#1e40af', icon: 'bi-file-text-fill',   label: 'Cotizado' },
      negociacion:  { bg: '#fef3c7', color: '#92400e', icon: 'bi-arrow-left-right', label: 'Negociación' },
      firmado:      { bg: '#d1fae5', color: '#065f46', icon: 'bi-patch-check-fill', label: 'Firmado' },
      construccion: { bg: '#fee2e2', color: '#991b1b', icon: 'bi-hammer',           label: 'En Construcción' },
      finalizado:   { bg: '#cffafe', color: '#155e75', icon: 'bi-patch-check-fill', label: 'Finalizado' },
      perdido:      { bg: '#f1f5f9', color: '#475569', icon: 'bi-x-circle-fill',    label: 'Perdido' }
    };
    const eb = estadosBadge[estado] || estadosBadge.nuevo;
    const estadoBadge = `
      <span class="badge rounded-pill" style="background:${eb.bg};color:${eb.color};font-size:11px;">
        <i class="bi ${eb.icon} me-1"></i>${eb.label}
      </span>`;

    // Color del header según estado del cliente
    const headerColors = {
      nuevo:        'linear-gradient(135deg,#1a4a2e,#2d8a4f)',  // verde
      cotizado:     'linear-gradient(135deg,#1a3a5e,#2d6a9f)',  // azul
      negociacion:  'linear-gradient(135deg,#4a3a1a,#8a6a2d)',  // dorado
      firmado:      'linear-gradient(135deg,#3a2a1a,#9a5a2d)',  // naranja
      construccion: 'linear-gradient(135deg,#4a1a1a,#8a2d2d)',  // rojo
      finalizado:   'linear-gradient(135deg,#1a3a4a,#2d7a8a)',  // cyan
      perdido:      'linear-gradient(135deg,#2a2a2a,#5a5a5a)'   // gris
    };
    const headerBg = headerColors[estado] || headerColors.nuevo;
    const badgeTextColor = estado === 'nuevo' ? 'text-success' : estado === 'cotizado' ? 'text-primary' : estado === 'negociacion' ? 'text-warning' : estado === 'firmado' ? 'text-dark' : estado === 'construccion' ? 'text-danger' : 'text-info';

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card border-0 shadow-sm h-100" style="border-radius:18px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;"
             onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,0.13)'"
             onmouseleave="this.style.transform='';this.style.boxShadow=''">

          <!-- Header con gradiente según estado -->
          <div class="p-4 text-white position-relative overflow-hidden"
               style="background:${headerBg};">
            <div style="position:absolute;width:120px;height:120px;border-radius:50%;
                        background:rgba(255,255,255,0.07);top:-30px;right:-30px;pointer-events:none;"></div>
            <div class="d-flex align-items-start justify-content-between gap-2">
              <div class="flex-grow-1 min-w-0">
                <h6 class="fw-bold mb-1 text-white" style="font-size:15px;">${UI.escapeHTML(p.modelo) || 'Sin modelo'}</h6>
                <div class="d-flex align-items-center gap-2 flex-wrap mt-1">
                  <span class="text-white opacity-75 small">
                    <i class="bi bi-person me-1"></i>${cliente ? UI.escapeHTML(cliente.nombre) : '—'}
                  </span>
                  ${estadoBadge}
                </div>
              </div>
              <span class="badge bg-white ${badgeTextColor} fw-bold px-2 py-1 flex-shrink-0" style="font-size:13px;border-radius:10px;">
                ${p.area || 0} m²
              </span>
            </div>
          </div>

          <!-- Cuerpo -->
          <div class="card-body p-4 d-flex flex-column gap-3">

            <!-- Precio(s) -->
            <div class="row g-2">
              <div class="col-${firmado && p.incluyePlaca ? '6' : '12'}">
                <div class="rounded-3 p-3 text-center" style="background:#f0fdf4;border:1.5px solid #bbf7d0;">
                  <div class="fw-bold text-success" style="font-size:15px;">${UI.formatCurrency(p.precio)}</div>
                  <div class="text-muted" style="font-size:10px;letter-spacing:0.5px;">PRECIO TOTAL</div>
                </div>
              </div>
              ${firmado && p.incluyePlaca ? `
              <div class="col-6">
                <div class="rounded-3 p-3 text-center" style="background:#fffbeb;border:1.5px solid #fde68a;">
                  <div class="fw-bold text-warning" style="font-size:15px;">${UI.formatCurrency(p.placaPrecio)}</div>
                  <div class="text-muted" style="font-size:10px;letter-spacing:0.5px;">PLACA</div>
                </div>
              </div>` : ''}
            </div>

            <!-- Especificaciones -->
            ${chips.length > 0 ? `
              <div class="d-flex flex-wrap gap-1">
                ${chips.map(c => `
                  <span class="badge rounded-pill fw-normal px-2 py-1"
                        style="background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;font-size:11px;">
                    <i class="bi ${c.icon} me-1"></i>${c.label}
                  </span>`).join('')}
              </div>` : ''}

            <!-- Altura -->
            ${esp.alturaMin && esp.alturaMax ? `
              <div class="d-flex align-items-center gap-2 text-muted small">
                <i class="bi bi-arrows-vertical text-secondary"></i>
                <span>Altura: <strong>${esp.alturaMin}m — ${esp.alturaMax}m</strong></span>
              </div>` : ''}

            <!-- Fecha entrega -->
            ${firmado ? `<div>${this._fechaEntregaBadge(p.fechaEntrega)}</div>` : ''}

            <!-- Evidencias -->
            ${nArchivos > 0 ? `
              <div class="d-flex align-items-center gap-1 text-muted small">
                <i class="bi bi-images text-primary"></i>
                <span>${nArchivos} evidencia${nArchivos > 1 ? 's' : ''}</span>
              </div>` : ''}

            <!-- Botones -->
            <div class="d-flex gap-2 mt-auto">
              <button class="btn btn-primary btn-sm flex-grow-1 fw-semibold"
                      style="border-radius:10px;"
                      onclick="Clientes.abrirExpediente('${p.clienteId}')">
                <i class="bi bi-folder2-open me-1"></i>Ver Expediente
              </button>
              <button class="btn btn-outline-secondary btn-sm"
                      style="border-radius:10px;width:38px;"
                      onclick="Proyectos.abrirModalEditar('${p.id}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  },

  // ── Badge fecha de entrega ────────────────────────────────────────────────
  _fechaEntregaBadge(fechaStr) {
    if (!fechaStr) {
      return `<span class="fecha-entrega-badge sin-fecha">
        <i class="bi bi-calendar"></i> Sin fecha de entrega
      </span>`;
    }
    const hoy   = new Date(); hoy.setHours(0,0,0,0);
    const fecha = new Date(fechaStr + 'T00:00:00');
    const dias  = Math.round((fecha - hoy) / 86400000);
    const label = UI.formatDate(fechaStr);

    if (dias < 0) {
      return `<span class="fecha-entrega-badge vencida"><i class="bi bi-calendar-x"></i> Entrega: ${label} (vencida)</span>`;
    } else if (dias <= 14) {
      return `<span class="fecha-entrega-badge cercana"><i class="bi bi-calendar-event"></i> Entrega: ${label} (${dias}d)</span>`;
    } else {
      return `<span class="fecha-entrega-badge proxima"><i class="bi bi-calendar-check"></i> Entrega: ${label}</span>`;
    }
  },

  // ── Abrir modal nuevo ─────────────────────────────────────────────────────
  async abrirModalNuevo(clienteId) {
    const cliente = clienteId ? await DB.get(DB.STORES.clientes, clienteId) : null;
    const firmado = cliente && this.ESTADOS_FIRMADOS.includes(cliente.estado);

    document.getElementById('modalProyectoTitle').innerHTML = '<i class="bi bi-building me-2"></i>Nuevo Proyecto';
    document.getElementById('formProyecto').reset();
    document.getElementById('proyectoId').value = '';
    document.getElementById('proyectoClienteId').value = clienteId || '';
    // Cargar estado actual del cliente
    document.getElementById('clienteEstado').value = cliente?.estado || 'nuevo';
    document.getElementById('placaPrecioGroup').classList.add('d-none');
    // Ocultar campos condicionales
    document.getElementById('especCubiertaOtroGroup')?.classList.add('d-none');
    document.getElementById('especOrnColorOtroGroup')?.classList.add('d-none');
    this._archivosNuevos = [];
    this._renderPreview();
    this._toggleSeccionesFirmado(firmado);
    this._bindDropZone();
    this._bindEstadoSelect();
    Opciones.inicializarSelects(); // cargar opciones personalizadas (incluye obsequios)
    // Para proyecto nuevo no hay obsequios preseleccionados — los checkboxes quedan desmarcados
    // Proyecto nuevo: sistema de ornamentación vacío → ocultar todos los sub-grupos
    this._actualizarVisibilidadOrn('');

    const expedienteEl = document.getElementById('modalExpediente');
    const expedienteInstance = bootstrap.Modal.getInstance(expedienteEl);
    if (expedienteInstance && expedienteEl.classList.contains('show')) {
      expedienteEl.dataset.reopenClienteId = clienteId || '';
      expedienteInstance.hide();
      expedienteEl.addEventListener('hidden.bs.modal', function abrirProyTrasExpediente() {
        expedienteEl.removeEventListener('hidden.bs.modal', abrirProyTrasExpediente);
        UI.openModal('modalProyecto');
      }, { once: true });
    } else {
      UI.openModal('modalProyecto');
    }
  },
  async abrirModalEditar(id) {
    const p = await DB.get(DB.STORES.proyectos, id);
    if (!p) return;

    const cliente = await DB.get(DB.STORES.clientes, p.clienteId);
    const firmado = cliente && this.ESTADOS_FIRMADOS.includes(cliente.estado);

    document.getElementById('modalProyectoTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Proyecto';
    document.getElementById('proyectoId').value          = p.id;
    document.getElementById('proyectoClienteId').value   = p.clienteId;
    document.getElementById('proyectoModelo').value      = p.modelo || '';
    document.getElementById('proyectoArea').value        = p.area || '';
    document.getElementById('proyectoPrecio').value      = p.precio || '';
    document.getElementById('proyectoPlaca').checked     = p.incluyePlaca || false;
    document.getElementById('proyectoPlacaPrecio').value = p.placaPrecio || '';
    document.getElementById('proyectoNotas').value       = p.notas || '';
    document.getElementById('proyectoFechaEntrega').value= p.fechaEntrega || '';
    // Cargar estado actual del cliente en el select del proyecto
    document.getElementById('clienteEstado').value       = cliente?.estado || 'nuevo';

    // Características técnicas
    const esp = p.especificaciones || {};
    document.getElementById('especSistema').value       = esp.sistema      || '';
    document.getElementById('especEstilo').value        = esp.estilo       || '';
    document.getElementById('especAlturaMin').value     = esp.alturaMin    || '';
    document.getElementById('especAlturaMax').value     = esp.alturaMax    || '';
    document.getElementById('especCubierta').value      = esp.cubierta     || '';
    document.getElementById('especCubiertaOtro').value  = esp.cubiertaOtro || '';
    document.getElementById('especOrnSistema').value    = esp.ornSistema   || '';
    document.getElementById('especOrnApertura').value   = esp.ornApertura  || '';
    document.getElementById('especOrnColor').value      = esp.ornColor     || '';
    document.getElementById('especOrnColorOtro').value  = esp.ornColorOtro || '';
    document.getElementById('especPuertaColor').value   = esp.puertaColor  || '';
    document.getElementById('especPuertaChapa').value   = esp.puertaChapa  || '';
    // Nuevos campos de apertura y mixto (compatibilidad: vacío si no existen)
    document.getElementById('especOrnAperturaCorrediza').value      = esp.ornAperturaCorrediza      || '';
    document.getElementById('especOrnMixtoAbatiblesRef').value      = esp.ornMixtoAbatiblesRef      || '';
    document.getElementById('especOrnAperturaAbatible').value       = esp.ornAperturaAbatible       || '';
    document.getElementById('especOrnMixtoCorredizasRef').value     = esp.ornMixtoCorredizasRef     || '';
    document.getElementById('especOrnAperturaCorredizaMixto').value = esp.ornAperturaCorredizaMixto || '';

    // Mostrar/ocultar campos condicionales
    document.getElementById('especCubiertaOtroGroup')
      .classList.toggle('d-none', esp.cubierta !== 'Otro');
    document.getElementById('especOrnColorOtroGroup')
      .classList.toggle('d-none', esp.ornColor !== 'Otro');
    Proyectos._actualizarVisibilidadOrn(esp.ornSistema || '');

    const placaGroup = document.getElementById('placaPrecioGroup');
    if (p.incluyePlaca) placaGroup.classList.remove('d-none');
    else placaGroup.classList.add('d-none');

    this._archivosNuevos = await DB.getByIndex(DB.STORES.archivos, 'proyectoId', p.id);
    // Fallback: si aún hay archivos inline (pre-migración), usarlos
    if (this._archivosNuevos.length === 0 && p.archivos && p.archivos.length > 0 && p.archivos[0].data) {
      this._archivosNuevos = [...p.archivos];
    }
    this._renderPreview();
    this._toggleSeccionesFirmado(firmado);
    this._bindDropZone();
    this._bindEstadoSelect();
    Opciones.inicializarSelects(); // cargar opciones personalizadas (incluye obsequios)

    // Restaurar valores guardados DESPUÉS de llenar los selects
    document.getElementById('especSistema').value       = esp.sistema      || '';
    document.getElementById('especCubierta').value      = esp.cubierta     || '';
    document.getElementById('especOrnSistema').value    = esp.ornSistema   || '';
    document.getElementById('especOrnColor').value      = esp.ornColor     || '';
    document.getElementById('especPuertaChapa').value   = esp.puertaChapa  || '';

    // Restaurar obsequios seleccionados (compatibilidad con proyectos sin obsequios)
    Opciones.marcarObsequios('especObsequiosGroup', esp.obsequios || []);

    // Mostrar/ocultar campos condicionales (re-evaluar tras cargar opciones)
    document.getElementById('especCubiertaOtroGroup')
      .classList.toggle('d-none', esp.cubierta !== 'Otro');
    document.getElementById('especOrnColorOtroGroup')
      .classList.toggle('d-none', esp.ornColor !== 'Otro');
    // Re-evaluar visibilidad ornamentación completa tras cargar opciones
    // (_actualizarVisibilidadOrn es la única fuente de verdad para los grupos de ornamentación)
    Proyectos._actualizarVisibilidadOrn(esp.ornSistema || '');

    const expedienteEl = document.getElementById('modalExpediente');
    const expedienteInstance = bootstrap.Modal.getInstance(expedienteEl);
    // Solo cerrar el expediente si está realmente visible en pantalla
    if (expedienteInstance && expedienteEl.classList.contains('show')) {
      expedienteEl.dataset.reopenClienteId = p.clienteId;
      expedienteInstance.hide();
      expedienteEl.addEventListener('hidden.bs.modal', function abrirEditProyTrasExpediente() {
        expedienteEl.removeEventListener('hidden.bs.modal', abrirEditProyTrasExpediente);
        UI.openModal('modalProyecto');
      }, { once: true });
    } else {
      UI.openModal('modalProyecto');
    }
  },

  // ── Mostrar/ocultar secciones según si está firmado ───────────────────────
  _toggleSeccionesFirmado(firmado) {
    const ids = ['seccionFechaEntrega', 'seccionPlaca', 'seccionEvidencias'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      firmado ? el.classList.remove('d-none') : el.classList.add('d-none');
    });
    const banner = document.getElementById('bannerCotizacion');
    if (banner) banner.classList.toggle('d-none', firmado);
  },

  // ── Mostrar/ocultar sub-campos de ornamentación según el sistema ──────────
  _actualizarVisibilidadOrn(sistema) {
    // Misma lógica de detección que guardar() y _ornLabel (todo en minúsculas)
    const ornLower    = (sistema || '').toLowerCase();
    const esMixto     = ornLower.includes('mixto');
    const esAbatible  = !esMixto && (ornLower.includes('apertura') || ornLower.includes('abatible'));
    const esCorredizo = !esMixto && ornLower.includes('corrediz');

    const toggle = (id, visible) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('d-none', !visible);
    };

    toggle('especOrnAperturaGroup',         esAbatible);
    toggle('especOrnAperturaCorredizaGroup', esCorredizo);
    toggle('especOrnMixtoGroup',             esMixto);
  },

  // ── Reaccionar al cambio de estado en tiempo real ─────────────────────────
  _bindEstadoSelect() {
    const select = document.getElementById('clienteEstado');
    if (!select) return;
    // Clonar para limpiar listeners anteriores
    const newSelect = select.cloneNode(true);
    select.replaceWith(newSelect);
    document.getElementById('clienteEstado').addEventListener('change', (e) => {
      const firmado = this.ESTADOS_FIRMADOS.includes(e.target.value);
      this._toggleSeccionesFirmado(firmado);
    });
  },

  // ── Guardar proyecto ──────────────────────────────────────────────────────
  async guardar() {
    const id        = document.getElementById('proyectoId').value;
    const clienteId = document.getElementById('proyectoClienteId').value;
    const modelo    = document.getElementById('proyectoModelo').value.trim();
    const area      = parseFloat(document.getElementById('proyectoArea').value);
    const precio    = parseFloat(document.getElementById('proyectoPrecio').value);
    const nuevoEstado = document.getElementById('clienteEstado').value;

    if (!modelo || !area || !precio) {
      UI.toast('Modelo, área y precio son obligatorios', 'warning');
      return;
    }

    // Leer estado anterior del cliente para detectar cambios
    const clienteActual = await DB.get(DB.STORES.clientes, clienteId);
    const estadoAnterior = clienteActual?.estado || 'nuevo';

    // Actualizar estado del cliente
    if (clienteActual && clienteActual.estado !== nuevoEstado) {
      clienteActual.estado = nuevoEstado;
      await DB.put(DB.STORES.clientes, clienteActual);

      // ── Registrar en historial de estados ──────────────────────────────
      await DB.put(DB.STORES.historialEstados, {
        id:         DB.generateId(),
        clienteId,
        estadoAnterior,
        estadoNuevo: nuevoEstado,
        fecha:       new Date().toISOString(),
        usuario:     localStorage.getItem('clienteapp_nombre_display') || 'Admin'
      });
    }

    const firmado      = this.ESTADOS_FIRMADOS.includes(nuevoEstado);
    const incluyePlaca = firmado && document.getElementById('proyectoPlaca').checked;
    const placaPrecio  = incluyePlaca ? parseFloat(document.getElementById('proyectoPlacaPrecio').value) || 0 : 0;
    const fechaEntrega = firmado ? (document.getElementById('proyectoFechaEntrega').value || null) : null;

    // Leer especificaciones técnicas
    const cubierta    = document.getElementById('especCubierta').value;
    const ornSistema  = document.getElementById('especOrnSistema').value;
    const ornColor    = document.getElementById('especOrnColor').value;
    // Detección de tipo consistente con _actualizarVisibilidadOrn y _ornLabel
    // (todo en minúsculas para soportar opciones personalizadas del usuario)
    const ornLower    = ornSistema.toLowerCase();
    const esMixto     = ornLower.includes('mixto');
    const esAbatible  = !esMixto && (ornLower.includes('apertura') || ornLower.includes('abatible'));
    const esCorredizo = !esMixto && ornLower.includes('corrediz');

    const especificaciones = {
      sistema:       document.getElementById('especSistema').value,
      estilo:        document.getElementById('especEstilo').value.trim(),
      alturaMin:     document.getElementById('especAlturaMin').value,
      alturaMax:     document.getElementById('especAlturaMax').value,
      cubierta,
      cubiertaOtro:  cubierta === 'Otro' ? document.getElementById('especCubiertaOtro').value.trim() : '',
      ornSistema,
      // Campo original (compatibilidad con datos existentes de tipo Apertura/abatible)
      ornApertura:         esAbatible ? document.getElementById('especOrnApertura').value : '',
      // Apertura corredizas simples
      ornAperturaCorrediza: esCorredizo ? document.getElementById('especOrnAperturaCorrediza').value : '',
      // Campos de sistema mixto
      ornMixtoAbatiblesRef:       esMixto ? document.getElementById('especOrnMixtoAbatiblesRef').value.trim() : '',
      ornAperturaAbatible:         esMixto ? document.getElementById('especOrnAperturaAbatible').value : '',
      ornMixtoCorredizasRef:       esMixto ? document.getElementById('especOrnMixtoCorredizasRef').value.trim() : '',
      ornAperturaCorredizaMixto:   esMixto ? document.getElementById('especOrnAperturaCorredizaMixto').value : '',
      ornColor,
      ornColorOtro:  ornColor === 'Otro' ? document.getElementById('especOrnColorOtro').value.trim() : '',
      puertaColor:   document.getElementById('especPuertaColor').value.trim(),
      puertaChapa:   document.getElementById('especPuertaChapa').value,
      obsequios:     Opciones.getObsequiosSeleccionados('especObsequiosGroup')
    };

    const data = {
      id:           id || DB.generateId(),
      clienteId,
      modelo,
      area,
      precio,
      especificaciones,
      incluyePlaca,
      placaPrecio,
      notas:        document.getElementById('proyectoNotas').value.trim(),
      fechaEntrega,
      archivos:     firmado ? this._archivosNuevos.map(a => ({
        id: a.id, nombre: a.nombre, tipo: a.tipo, fecha: a.fecha
      })) : []
    };

    // Guardar archivos multimedia en store separado (sin cargar el proyecto)
    if (firmado && this._archivosNuevos.length > 0) {
      const proyectoId = data.id;
      for (const archivo of this._archivosNuevos) {
        if (archivo.data) {
          await DB.put(DB.STORES.archivos, {
            id:         archivo.id,
            proyectoId,
            nombre:     archivo.nombre,
            tipo:       archivo.tipo,
            data:       archivo.data,
            fecha:      archivo.fecha || new Date().toISOString()
          });
        }
      }
    }

    if (id) {
      const existing = await DB.get(DB.STORES.proyectos, id);
      if (existing) {
        data.createdAt = existing.createdAt;
        // Guardar fecha de inicio de construcción si acaba de cambiar a ese estado
        if (nuevoEstado === 'construccion' && estadoAnterior !== 'construccion') {
          data.fechaIniConstruccion = new Date().toISOString();
        } else {
          data.fechaIniConstruccion = existing.fechaIniConstruccion || null;
        }
      }
    } else {
      // Proyecto nuevo
      if (nuevoEstado === 'construccion') {
        data.fechaIniConstruccion = new Date().toISOString();
      }
    }

    await DB.put(DB.STORES.proyectos, data);

    // Crear etapas de pago SOLO si es nuevo proyecto Y el cliente está firmado
    if (!id && firmado) {
      await Pagos.crearEtapasProyecto(data);
    }

    // Si ya existía y el cliente está firmado → crear o recalcular etapas
    if (id && firmado) {
      const etapasExistentes = await DB.getByIndex(DB.STORES.pagos, 'proyectoId', data.id);
      if (etapasExistentes.length === 0) {
        // Primera vez que se firma: crear etapas desde cero
        await Pagos.crearEtapasProyecto(data);
        UI.toast('Etapas de pago generadas al confirmar firma', 'info', 5000);
      } else {
        // Ya existían: recalcular valorTotal si cambió el precio o la placa
        await Pagos.actualizarEtapasProyecto(data);
      }
    }

    this._archivosNuevos = [];
    UI.closeModal('modalProyecto');

    const msg = firmado
      ? (id ? 'Proyecto actualizado' : 'Proyecto creado con etapas de pago')
      : (id ? 'Cotización actualizada' : 'Cotización guardada — lista para cuando firme');
    UI.toast(msg, 'success');

    // Refrescar badges y páginas activas con datos frescos
    App.updateBadges();
    if (App.currentPage === 'proyectos') await Proyectos.render();
    if (App.currentPage === 'pagos')     await Pagos.render();
    if (App.currentPage === 'dashboard') await Dashboard.render();

    // Reabrir expediente con datos frescos
    if (clienteId) {
      const modalProyEl = document.getElementById('modalProyecto');
      modalProyEl.addEventListener('hidden.bs.modal', async function reabrirExpediente() {
        modalProyEl.removeEventListener('hidden.bs.modal', reabrirExpediente);
        await Clientes.abrirExpediente(clienteId);
      }, { once: true });
    }
  },

  // ── Drop zone y selección de archivos ────────────────────────────────────
  _bindDropZone() {
    const zone  = document.getElementById('dropZone');
    const input = document.getElementById('inputArchivos');
    if (!zone || !input) return;

    // Clonar para limpiar listeners anteriores
    const newZone  = zone.cloneNode(true);
    const newInput = input.cloneNode(true);
    zone.replaceWith(newZone);
    input.replaceWith(newInput);

    const dz = document.getElementById('dropZone');
    const fi = document.getElementById('inputArchivos');

    dz.addEventListener('dragover',  (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      this._procesarArchivos([...e.dataTransfer.files]);
    });

    fi.addEventListener('change', () => {
      this._procesarArchivos([...fi.files]);
      fi.value = '';
    });
  },

  // ── Procesar archivos → Base64 (imágenes comprimidas) ────────────────────
  async _procesarArchivos(files) {
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    let agregados = 0;

    for (const file of files) {
      if (file.size > MAX_SIZE) {
        UI.toast(`"${file.name}" supera 5 MB`, 'warning');
        continue;
      }

      // Evitar duplicados por nombre
      if (this._archivosNuevos.find(a => a.nombre === file.name)) continue;

      let base64;
      if (file.type.startsWith('image/')) {
        // Comprimir imagen antes de guardar
        base64 = await this._comprimirImagen(file);
      } else {
        // PDF u otros: guardar sin comprimir
        base64 = await this._fileToBase64(file);
      }

      this._archivosNuevos.push({
        id:     DB.generateId(),
        nombre: file.name,
        tipo:   file.type,
        data:   base64,
        fecha:  new Date().toISOString()
      });
      agregados++;
    }

    if (agregados > 0) {
      this._renderPreview();
      UI.toast(`${agregados} archivo${agregados > 1 ? 's' : ''} agregado${agregados > 1 ? 's' : ''}`, 'success');
    }
  },

  // ── Comprimir imagen con Canvas ───────────────────────────────────────────
  // Reduce resolución máxima a 1280px y calidad JPEG al 75%
  // Una foto de 5 MB queda en ~150-400 KB sin pérdida visual notable
  _comprimirImagen(file) {
    return new Promise((resolve, reject) => {
      const MAX_DIM  = 1280;  // px máximo en cualquier dimensión
      const CALIDAD  = 0.75;  // 75% calidad JPEG

      const img    = new Image();
      const urlObj = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(urlObj);

        // Calcular nuevas dimensiones manteniendo proporción
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round(height * MAX_DIM / width);
            width  = MAX_DIM;
          } else {
            width  = Math.round(width * MAX_DIM / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // PNG transparente → mantener PNG, resto → JPEG
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const calidad    = outputType === 'image/png' ? undefined : CALIDAD;

        resolve(canvas.toDataURL(outputType, calidad));
      };

      img.onerror = () => {
        URL.revokeObjectURL(urlObj);
        // Si falla la compresión, guardar original
        this._fileToBase64(file).then(resolve).catch(reject);
      };

      img.src = urlObj;
    });
  },

  // ── File → Base64 ─────────────────────────────────────────────────────────
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ── Renderizar preview en el modal ────────────────────────────────────────
  _renderPreview() {
    const container = document.getElementById('archivosPreview');
    if (!container) return;

    if (this._archivosNuevos.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this._archivosNuevos.map((a, i) => {
      const esImagen = a.tipo.startsWith('image/');
      return `
        <div class="col-6 col-sm-4 col-md-3">
          <div class="archivo-thumb">
            ${esImagen
              ? `<img src="${a.data}" alt="${UI.escapeHTML(a.nombre)}" />`
              : `<div class="archivo-pdf">
                   <i class="bi bi-file-earmark-pdf fs-2"></i>
                   <span class="small fw-semibold">PDF</span>
                 </div>`
            }
            <div class="archivo-info" title="${UI.escapeHTML(a.nombre)}">${UI.escapeHTML(a.nombre)}</div>
            <button class="btn-remove" onclick="Proyectos._eliminarArchivo(${i})" title="Eliminar">
              <i class="bi bi-x"></i>
            </button>
          </div>
        </div>`;
    }).join('');
  },

  // ── Eliminar archivo del preview ──────────────────────────────────────────
  _eliminarArchivo(index) {
    this._archivosNuevos.splice(index, 1);
    this._renderPreview();
  },

  // ── Renderizar galería en expediente ──────────────────────────────────────
  async renderGaleria(proyecto) {
    const refs = proyecto?.archivos || [];

    if (refs.length === 0) {
      return `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-images fs-2 d-block mb-2 opacity-40"></i>
          <p class="mb-1 small fw-semibold">Sin evidencias fotográficas</p>
          <small>Edita el proyecto para agregar fotos o planos</small>
        </div>`;
    }

    // Cargar datos completos (con base64) desde el store separado
    const archivosCompletos = await DB.getByIndex(DB.STORES.archivos, 'proyectoId', proyecto.id);

    // Merge: combinar referencias del proyecto con datos del store
    const archivos = refs.map(ref => {
      const completo = archivosCompletos.find(a => a.id === ref.id);
      return completo || ref; // si no se encontró en store, usar la ref (compatibilidad)
    });

    // Guardar en cache para el lightbox
    this._archivosCache = archivos;

    return `
      <div class="galeria-grid">
        ${archivos.map((a, idx) => {
          const esImagen = a.tipo.startsWith('image/');
          return `
            <div class="galeria-item" onclick="Proyectos._abrirLightbox('${a.id}', Proyectos._archivosCache)">
              ${esImagen && a.data
                ? `<img src="${a.data}" alt="${UI.escapeHTML(a.nombre)}" loading="lazy" />`
                : `<div class="archivo-pdf" style="height:100px;">
                     <i class="bi bi-file-earmark-pdf fs-2"></i>
                     <span class="small">PDF</span>
                   </div>`
              }
              <div class="galeria-label" title="${UI.escapeHTML(a.nombre)}">${UI.escapeHTML(a.nombre)}</div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // ── Lightbox con navegación ───────────────────────────────────────────────
  _abrirLightbox(archivoId, archivos) {
    // archivos puede llegar como string JSON desde el onclick inline
    const lista = typeof archivos === 'string' ? JSON.parse(archivos) : archivos;
    let idx = lista.findIndex(a => a.id === archivoId);
    if (idx === -1) idx = 0;

    const mostrar = (i) => {
      const archivo = lista[i];
      if (!archivo) return;

      // Para PDF abrir en nueva pestaña
      if (!archivo.tipo.startsWith('image/')) {
        const win = window.open();
        win.document.write(`<iframe src="${archivo.data}" style="width:100%;height:100vh;border:none;"></iframe>`);
        return;
      }

      // Eliminar overlay anterior
      document.getElementById('lightboxOverlay')?.remove();

      const total    = lista.filter(a => a.tipo.startsWith('image/')).length;
      const imgIndex = lista.filter((a, j) => a.tipo.startsWith('image/') && j <= i).length;
      const hayPrev  = lista.slice(0, i).some(a => a.tipo.startsWith('image/'));
      const hayNext  = lista.slice(i + 1).some(a => a.tipo.startsWith('image/'));

      const html = `
        <div id="lightboxOverlay">
          <!-- Cerrar al clic en fondo -->
          <div style="position:absolute;inset:0;z-index:-1;" onclick="document.getElementById('lightboxOverlay').remove()"></div>

          <!-- Contador -->
          ${total > 1 ? `<div class="lb-counter">${imgIndex} / ${total}</div>` : ''}

          <!-- Botón cerrar -->
          <button class="lb-close" onclick="document.getElementById('lightboxOverlay').remove()">
            <i class="bi bi-x-lg"></i>
          </button>

          <!-- Botón imprimir -->
          <button class="lb-print" id="lbPrint" title="Imprimir imagen">
            <i class="bi bi-printer"></i>
          </button>

          <!-- Flecha anterior -->
          ${hayPrev ? `<button class="lb-nav lb-prev" id="lbPrev">
            <i class="bi bi-chevron-left"></i>
          </button>` : ''}

          <!-- Imagen -->
          <img src="${archivo.data}" alt="${UI.escapeHTML(archivo.nombre)}"
               id="lbImagen"
               onclick="event.stopPropagation(); Proyectos._toggleZoom(this);"
               style="animation:fadeInUp 0.2s ease; position:relative; z-index:2;" />

          <!-- Flecha siguiente -->
          ${hayNext ? `<button class="lb-nav lb-next" id="lbNext">
            <i class="bi bi-chevron-right"></i>
          </button>` : ''}

          <!-- Caption -->
          <div class="lb-caption">${UI.escapeHTML(archivo.nombre)}</div>
        </div>`;

      document.body.insertAdjacentHTML('beforeend', html);

      // Botón imprimir — abre ventana con solo la imagen y lanza impresión
      document.getElementById('lbPrint')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const win = window.open('', '_blank');
        const nombreSeguro = UI.escapeHTML(archivo.nombre);
        win.document.write(`<!DOCTYPE html><html><head><title>${nombreSeguro}</title>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:white; padding:16px; }
            img { max-width:100%; max-height:90vh; object-fit:contain; }
            p { font-family:sans-serif; font-size:12px; color:#666; margin-top:8px; text-align:center; }
            @media print { body { display:block; } img { width:100%; height:auto; } }
          </style></head>
          <body>
            <img src="${archivo.data}" alt="${nombreSeguro}" />
            <p>${nombreSeguro}</p>
            <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
          </body></html>`);
        win.document.close();
      });

      // Navegación con botones
      document.getElementById('lbPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Buscar imagen anterior
        for (let j = i - 1; j >= 0; j--) {
          if (lista[j].tipo.startsWith('image/')) { mostrar(j); break; }
        }
      });

      document.getElementById('lbNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        // Buscar imagen siguiente
        for (let j = i + 1; j < lista.length; j++) {
          if (lista[j].tipo.startsWith('image/')) { mostrar(j); break; }
        }
      });
    };

    mostrar(idx);

    // Teclado: flechas + Escape
    const handler = (e) => {
      const overlay = document.getElementById('lightboxOverlay');
      if (!overlay) { document.removeEventListener('keydown', handler); return; }

      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', handler);
      } else if (e.key === 'ArrowRight') {
        document.getElementById('lbNext')?.click();
      } else if (e.key === 'ArrowLeft') {
        document.getElementById('lbPrev')?.click();
      }
    };
    document.addEventListener('keydown', handler);
  },

  // ── Zoom toggle en lightbox ───────────────────────────────────────────────
  _toggleZoom(img) {
    if (img.classList.contains('zoomed')) {
      // Quitar zoom
      img.classList.remove('zoomed');
      img.style.transformOrigin = '';
      img.style.transform = '';
      img.onmousemove = null;
      img.onmouseleave = null;
      img.ontouchmove = null;
    } else {
      // Activar zoom
      img.classList.add('zoomed');
      // Seguir el mouse para mover la imagen en zoom
      img.onmousemove = (e) => {
        if (!img.classList.contains('zoomed')) return;
        const rect = img.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
      };
      img.onmouseleave = () => {
        img.style.transformOrigin = 'center center';
      };
      // Soporte táctil (mobile)
      img.ontouchmove = (e) => {
        if (!img.classList.contains('zoomed') || !e.touches[0]) return;
        const rect = img.getBoundingClientRect();
        const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
        const y = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
      };
    }
  }
};

// ── Toggle placa ──────────────────────────────────────────────────────────────
document.getElementById('proyectoPlaca')?.addEventListener('change', function() {
  const group = document.getElementById('placaPrecioGroup');
  if (this.checked) group.classList.remove('d-none');
  else group.classList.add('d-none');
});

document.getElementById('btnGuardarProyecto')?.addEventListener('click', () => Proyectos.guardar());
