/* ============================================
   ClienteAPP — Módulo de Tareas y Pendientes
   ============================================ */

window.Tareas = {

  filtroActual: 'pendientes',
  _visibles: 20, // Paginación

  // Tareas predefinidas del flujo de trabajo
  PLANTILLAS: [
    { titulo: 'Pedir planos de ejes y cimientos',    categoria: 'planos',     prioridad: 'alta'  },
    { titulo: 'Pedir plano de despieces',             categoria: 'planos',     prioridad: 'alta'  },
    { titulo: 'Pedir lista de materiales',            categoria: 'materiales', prioridad: 'alta'  },
    { titulo: 'Organizar recibos y facturas',         categoria: 'admin',      prioridad: 'media' },
    { titulo: 'Actualizar el tablero de proyectos',   categoria: 'admin',      prioridad: 'media' },
    { titulo: 'Llamar al cliente para seguimiento',   categoria: 'cliente',    prioridad: 'media' },
    { titulo: 'Verificar avance de obra',             categoria: 'obra',       prioridad: 'alta'  },
    { titulo: 'Confirmar fecha de entrega de materiales', categoria: 'materiales', prioridad: 'alta' },
    { titulo: 'Registrar pagos recibidos',            categoria: 'finanzas',   prioridad: 'alta'  },
    { titulo: 'Enviar cotización al cliente',         categoria: 'cliente',    prioridad: 'media' },
    { titulo: 'Revisar contrato antes de firma',      categoria: 'admin',      prioridad: 'alta'  },
    { titulo: 'Tomar fotos del avance de obra',       categoria: 'obra',       prioridad: 'baja'  },
  ],

  // ── Renderizar página ────────────────────────────────────────────────────
  async render() {
    this._visibles = 20; // Reset paginación al navegar
    const content = document.getElementById('pageContent');
    content.innerHTML = UI.spinner('Cargando tareas...');

    const tareas   = await DB.getAll(DB.STORES.tareas);
    const clientes = await DB.getAll(DB.STORES.clientes);

    const pendientes  = tareas.filter(t => t.estado !== 'completada');
    const completadas = tareas.filter(t => t.estado === 'completada');
    const vencidas    = pendientes.filter(t => {
      if (!t.fecha) return false;
      return new Date(t.fecha + 'T23:59:59') < new Date();
    });
    const hoy = pendientes.filter(t => {
      if (!t.fecha) return false;
      return t.fecha === new Date().toISOString().split('T')[0];
    });

    // Actualizar badge sidebar
    const badge = document.getElementById('badgeTareas');
    if (pendientes.length > 0) {
      badge.textContent = pendientes.length;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }

    content.innerHTML = `
      <div class="fade-in">

        <!-- Hero -->
        <div class="tareas-hero mb-4">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h3 class="fw-bold text-white mb-1">
                <i class="bi bi-check2-square me-2"></i>Tareas y Pendientes
              </h3>
              <p class="text-white opacity-75 mb-0 small">
                ${pendientes.length} pendiente${pendientes.length !== 1 ? 's' : ''}
                ${vencidas.length > 0 ? ` · <span class="text-warning fw-semibold">${vencidas.length} vencida${vencidas.length !== 1 ? 's' : ''}</span>` : ''}
                ${hoy.length > 0 ? ` · <span class="text-info fw-semibold">${hoy.length} para hoy</span>` : ''}
              </p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-light btn-sm fw-semibold" onclick="Tareas.abrirModalNueva()">
                <i class="bi bi-plus-lg me-1"></i>Nueva Tarea
              </button>
              <button class="btn btn-outline-light btn-sm" onclick="Tareas.abrirPlantillas()">
                <i class="bi bi-lightning-charge me-1"></i>Plantillas
              </button>
            </div>
          </div>
        </div>

        <!-- KPIs -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-md-3">
            <div class="tarea-kpi" style="--kc:#ef4444;">
              <div class="tarea-kpi-num">${vencidas.length}</div>
              <div class="tarea-kpi-label">Vencidas</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tarea-kpi" style="--kc:#f59e0b;">
              <div class="tarea-kpi-num">${hoy.length}</div>
              <div class="tarea-kpi-label">Para hoy</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tarea-kpi" style="--kc:#3b82f6;">
              <div class="tarea-kpi-num">${pendientes.length}</div>
              <div class="tarea-kpi-label">Pendientes</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="tarea-kpi" style="--kc:#10b981;">
              <div class="tarea-kpi-num">${completadas.length}</div>
              <div class="tarea-kpi-label">Completadas</div>
            </div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card border-0 shadow-sm mb-4" style="border-radius:14px;">
          <div class="card-body py-3 px-4">
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <span class="text-muted small fw-semibold me-1">Filtrar:</span>
              ${this._filtros()}
            </div>
          </div>
        </div>

        <!-- Lista de tareas -->
        <div id="listaTareas">
          ${this._renderLista(tareas, clientes)}
        </div>

      </div>`;

    this._bindEvents();
  },

  // ── Filtros ───────────────────────────────────────────────────────────────
  _filtros() {
    const filtros = [
      { key: 'pendientes',  label: 'Pendientes',  icon: 'bi-clock' },
      { key: 'hoy',         label: 'Hoy',         icon: 'bi-calendar-day' },
      { key: 'alta',        label: 'Alta prioridad', icon: 'bi-exclamation-circle' },
      { key: 'planos',      label: 'Planos',       icon: 'bi-rulers' },
      { key: 'materiales',  label: 'Materiales',   icon: 'bi-box' },
      { key: 'admin',       label: 'Admin',        icon: 'bi-clipboard' },
      { key: 'cliente',     label: 'Clientes',     icon: 'bi-person' },
      { key: 'obra',        label: 'Obra',         icon: 'bi-building' },
      { key: 'completadas', label: 'Completadas',  icon: 'bi-check-circle' },
      { key: 'todas',       label: 'Todas',        icon: 'bi-list' },
    ];
    return filtros.map(f => `
      <button class="filter-pill ${this.filtroActual === f.key ? 'active' : ''}" data-filtro="${f.key}">
        <i class="bi ${f.icon} me-1"></i>${f.label}
      </button>`).join('');
  },

  // ── Renderizar lista ──────────────────────────────────────────────────────
  _renderLista(tareas, clientes) {
    const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
    const hoyStr = new Date().toISOString().split('T')[0];
    let filtradas = [...tareas];

    switch (this.filtroActual) {
      case 'pendientes':
        filtradas = filtradas.filter(t => t.estado !== 'completada');
        break;
      case 'hoy':
        filtradas = filtradas.filter(t => t.fecha === hoyStr && t.estado !== 'completada');
        break;
      case 'alta':
        filtradas = filtradas.filter(t => t.prioridad === 'alta' && t.estado !== 'completada');
        break;
      case 'completadas':
        filtradas = filtradas.filter(t => t.estado === 'completada');
        break;
      case 'todas':
        break;
      default:
        // filtro por categoría
        filtradas = filtradas.filter(t => t.categoria === this.filtroActual && t.estado !== 'completada');
    }

    // Ordenar: vencidas primero, luego por fecha, luego por prioridad
    const prioOrd = { alta: 0, media: 1, baja: 2 };
    filtradas.sort((a, b) => {
      if (a.estado === 'completada' && b.estado !== 'completada') return 1;
      if (b.estado === 'completada' && a.estado !== 'completada') return -1;
      if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
      if (a.fecha && !b.fecha) return -1;
      if (!a.fecha && b.fecha) return 1;
      return (prioOrd[a.prioridad] || 1) - (prioOrd[b.prioridad] || 1);
    });

    if (filtradas.length === 0) {
      return UI.emptyState(
        'bi-check2-all',
        this.filtroActual === 'completadas' ? '¡Sin tareas completadas aún!' : '¡Todo al día!',
        this.filtroActual === 'pendientes' ? 'No tienes tareas pendientes' : 'Sin tareas en esta categoría',
        `<button class="btn btn-primary mt-3" onclick="Tareas.abrirModalNueva()">
          <i class="bi bi-plus-lg me-2"></i>Agregar Tarea
        </button>`
      );
    }

    const visibles = filtradas.slice(0, this._visibles);
    const hayMas = filtradas.length > this._visibles;

    return `<div class="d-flex flex-column gap-2">
      ${visibles.map(t => this._tareaRow(t, clienteMap)).join('')}
    </div>
    ${hayMas ? `
      <div class="text-center mt-4">
        <button class="btn btn-outline-primary px-4 py-2 fw-semibold" onclick="Tareas._cargarMas()" style="border-radius:12px;">
          <i class="bi bi-arrow-down-circle me-2"></i>Cargar más (${filtradas.length - this._visibles} restantes)
        </button>
      </div>` : ''}`;
  },

  // ── Cargar más tareas ─────────────────────────────────────────────────────
  async _cargarMas() {
    this._visibles += 20;
    await this.render();
  },

  // ── Fila de tarea ─────────────────────────────────────────────────────────
  _tareaRow(t, clienteMap) {
    const hoyStr   = new Date().toISOString().split('T')[0];
    const vencida  = t.fecha && t.fecha < hoyStr && t.estado !== 'completada';
    const esHoy    = t.fecha === hoyStr;
    const completada = t.estado === 'completada';

    const catCfg = this._catConfig(t.categoria);
    const prioCfg = {
      alta:  { color: '#ef4444', label: 'Alta',  dot: '🔴' },
      media: { color: '#f59e0b', label: 'Media', dot: '🟡' },
      baja:  { color: '#10b981', label: 'Baja',  dot: '🟢' }
    }[t.prioridad] || { color: '#94a3b8', label: '', dot: '⚪' };

    const cliente = t.clienteId ? clienteMap[t.clienteId] : null;

    let fechaHtml = '';
    if (t.fecha) {
      if (vencida) {
        fechaHtml = `<span class="badge bg-danger"><i class="bi bi-calendar-x me-1"></i>Vencida: ${UI.formatDate(t.fecha)}</span>`;
      } else if (esHoy) {
        fechaHtml = `<span class="badge bg-warning text-dark"><i class="bi bi-calendar-day me-1"></i>Hoy</span>`;
      } else {
        fechaHtml = `<span class="badge bg-light text-muted border"><i class="bi bi-calendar me-1"></i>${UI.formatDate(t.fecha)}</span>`;
      }
    }

    return `
      <div class="tarea-row ${completada ? 'tarea-completada' : ''} ${vencida ? 'tarea-vencida' : ''}"
           style="border-left: 4px solid ${completada ? '#10b981' : prioCfg.color};">
        <div class="d-flex align-items-start gap-3">

          <!-- Checkbox -->
          <div class="flex-shrink-0 pt-1">
            <div class="tarea-check ${completada ? 'checked' : ''}"
                 onclick="Tareas.toggleCompletar('${t.id}')"
                 title="${completada ? 'Marcar como pendiente' : 'Marcar como completada'}">
              ${completada ? '<i class="bi bi-check-lg"></i>' : ''}
            </div>
          </div>

          <!-- Contenido -->
          <div class="flex-grow-1 min-w-0">
            <div class="d-flex align-items-start justify-content-between gap-2 flex-wrap">
              <div class="fw-semibold ${completada ? 'text-decoration-line-through text-muted' : ''}"
                   style="font-size:15px;">${UI.escapeHTML(t.titulo)}</div>
              <div class="d-flex gap-1 flex-shrink-0">
                ${fechaHtml}
              </div>
            </div>

            <div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
              <span class="espec-chip" style="background:${catCfg.bg};color:${catCfg.color};border-color:${catCfg.color}30;">
                <i class="bi ${catCfg.icon}"></i>${catCfg.label}
              </span>
              <span class="espec-chip">
                ${prioCfg.dot} ${prioCfg.label}
              </span>
              ${cliente ? `
                <span class="espec-chip">
                  <i class="bi bi-person"></i>${UI.escapeHTML(cliente.nombre.split(' ')[0])}
                </span>` : ''}
              ${t.notas ? `
                <span class="text-muted small text-truncate" style="max-width:200px;">
                  <i class="bi bi-sticky me-1"></i>${UI.escapeHTML(t.notas)}
                </span>` : ''}
            </div>
          </div>

          <!-- Acciones -->
          <div class="d-flex gap-1 flex-shrink-0">
            <button class="btn btn-sm btn-outline-secondary py-0 px-2"
                    onclick="Tareas.abrirModalEditar('${t.id}')" title="Editar">
              <i class="bi bi-pencil" style="font-size:12px;"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2"
                    onclick="Tareas.eliminar('${t.id}')" title="Eliminar">
              <i class="bi bi-trash" style="font-size:12px;"></i>
            </button>
          </div>
        </div>
      </div>`;
  },

  // ── Config de categoría ───────────────────────────────────────────────────
  _catConfig(cat) {
    const map = {
      planos:     { icon: 'bi-rulers',       label: 'Planos',       color: '#6366f1', bg: '#eef2ff' },
      materiales: { icon: 'bi-box-seam',     label: 'Materiales',   color: '#0891b2', bg: '#ecfeff' },
      admin:      { icon: 'bi-clipboard',    label: 'Admin',        color: '#7c3aed', bg: '#f5f3ff' },
      cliente:    { icon: 'bi-person',       label: 'Cliente',      color: '#2d6a9f', bg: '#eff6ff' },
      obra:       { icon: 'bi-building',     label: 'Obra',         color: '#d97706', bg: '#fffbeb' },
      finanzas:   { icon: 'bi-cash-coin',    label: 'Finanzas',     color: '#059669', bg: '#ecfdf5' },
      otro:       { icon: 'bi-pin',          label: 'Otro',         color: '#64748b', bg: '#f1f5f9' }
    };
    return map[cat] || map.otro;
  },

  // ── Toggle completar ──────────────────────────────────────────────────────
  async toggleCompletar(id) {
    const t = await DB.get(DB.STORES.tareas, id);
    if (!t) return;
    t.estado = t.estado === 'completada' ? 'pendiente' : 'completada';
    t.completadaEn = t.estado === 'completada' ? new Date().toISOString() : null;
    await DB.put(DB.STORES.tareas, t);

    if (t.estado === 'completada') {
      UI.toast(`✅ "${t.titulo.substring(0, 40)}" completada`, 'success');
    }
    await this.render();
  },

  // ── Abrir modal nueva ─────────────────────────────────────────────────────
  async abrirModalNueva(plantilla = null) {
    document.getElementById('modalTareaTitle').innerHTML =
      '<i class="bi bi-plus-circle me-2"></i>Nueva Tarea';
    document.getElementById('formTarea').reset();
    document.getElementById('tareaId').value = '';

    if (plantilla) {
      document.getElementById('tareaTitulo').value    = plantilla.titulo;
      document.getElementById('tareaCategoria').value = plantilla.categoria;
      document.getElementById('tareaPrioridad').value = plantilla.prioridad;
    }

    await this._cargarClientesSelect();
    UI.openModal('modalTarea');
  },

  // ── Abrir modal editar ────────────────────────────────────────────────────
  async abrirModalEditar(id) {
    const t = await DB.get(DB.STORES.tareas, id);
    if (!t) return;

    document.getElementById('modalTareaTitle').innerHTML =
      '<i class="bi bi-pencil me-2"></i>Editar Tarea';
    document.getElementById('tareaId').value        = t.id;
    document.getElementById('tareaTitulo').value    = t.titulo || '';
    document.getElementById('tareaCategoria').value = t.categoria || 'otro';
    document.getElementById('tareaPrioridad').value = t.prioridad || 'media';
    document.getElementById('tareaFecha').value     = t.fecha || '';
    document.getElementById('tareaNotas').value     = t.notas || '';

    await this._cargarClientesSelect(t.clienteId);
    UI.openModal('modalTarea');
  },

  // ── Cargar clientes en select ─────────────────────────────────────────────
  async _cargarClientesSelect(selectedId = '') {
    const clientes = await DB.getAll(DB.STORES.clientes);
    const sel = document.getElementById('tareaCliente');
    sel.innerHTML = '<option value="">Sin cliente</option>' +
      clientes
        .filter(c => !['finalizado','perdido'].includes(c.estado))
        .map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${UI.escapeHTML(c.nombre)}</option>`)
        .join('');
  },

  // ── Guardar tarea ─────────────────────────────────────────────────────────
  async guardar() {
    const id     = document.getElementById('tareaId').value;
    const titulo = document.getElementById('tareaTitulo').value.trim();

    if (!titulo) {
      UI.toast('El título es obligatorio', 'warning');
      return;
    }

    const data = {
      id:         id || DB.generateId(),
      titulo,
      categoria:  document.getElementById('tareaCategoria').value,
      prioridad:  document.getElementById('tareaPrioridad').value,
      fecha:      document.getElementById('tareaFecha').value || null,
      clienteId:  document.getElementById('tareaCliente').value || null,
      notas:      document.getElementById('tareaNotas').value.trim(),
      estado:     'pendiente'
    };

    if (id) {
      const existing = await DB.get(DB.STORES.tareas, id);
      if (existing) {
        data.estado     = existing.estado;
        data.createdAt  = existing.createdAt;
      }
    }

    await DB.put(DB.STORES.tareas, data);
    UI.closeModal('modalTarea');
    UI.toast(id ? 'Tarea actualizada' : 'Tarea creada', 'success');
    await this.render();
  },

  // ── Eliminar tarea ────────────────────────────────────────────────────────
  async eliminar(id) {
    const t = await DB.get(DB.STORES.tareas, id);
    if (!t) return;
    const ok = await UI.confirm(`¿Eliminar "${t.titulo}"?`, 'Eliminar Tarea');
    if (!ok) return;
    await DB.delete(DB.STORES.tareas, id);
    UI.toast('Tarea eliminada', 'danger');
    await this.render();
  },

  // ── Panel de plantillas ───────────────────────────────────────────────────
  abrirPlantillas() {
    const id = 'modalPlantillas-' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header" style="background:linear-gradient(135deg,#1a2e4a,#2d5a8a);color:white;">
              <h5 class="modal-title fw-bold">
                <i class="bi bi-lightning-charge me-2"></i>Plantillas de Tareas
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small mb-3">Haz clic en una plantilla para crear la tarea rápidamente.</p>
              <div class="row g-2">
                ${this.PLANTILLAS.map((p, i) => {
                  const cat = this._catConfig(p.categoria);
                  const prio = { alta: 'danger', media: 'warning', baja: 'success' }[p.prioridad];
                  return `
                    <div class="col-md-6">
                      <div class="d-flex align-items-center gap-3 p-3 rounded-3 border cursor-pointer plantilla-item"
                           style="cursor:pointer;transition:all 0.2s;"
                           onclick="Tareas._usarPlantilla(${i}, '${id}')">
                        <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
                             style="width:36px;height:36px;background:${cat.bg};">
                          <i class="bi ${cat.icon}" style="color:${cat.color};"></i>
                        </div>
                        <div class="flex-grow-1 min-w-0">
                          <div class="fw-semibold small text-truncate">${UI.escapeHTML(p.titulo)}</div>
                          <div class="d-flex gap-1 mt-1">
                            <span class="badge bg-${prio} bg-opacity-75" style="font-size:10px;">${p.prioridad}</span>
                            <span class="espec-chip py-0" style="font-size:10px;">${cat.label}</span>
                          </div>
                        </div>
                        <i class="bi bi-plus-circle text-primary flex-shrink-0"></i>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const modal = new bootstrap.Modal(el);
    modal.show();
    el.addEventListener('hidden.bs.modal', () => el.remove());

    // Hover effect
    el.querySelectorAll('.plantilla-item').forEach(item => {
      item.addEventListener('mouseenter', () => {
        item.style.background = '#f0f4f8';
        item.style.borderColor = '#2d6a9f';
      });
      item.addEventListener('mouseleave', () => {
        item.style.background = '';
        item.style.borderColor = '';
      });
    });
  },

  async _usarPlantilla(index, modalId) {
    const plantilla = this.PLANTILLAS[index];
    // Cerrar modal de plantillas
    const el = document.getElementById(modalId);
    bootstrap.Modal.getInstance(el)?.hide();
    el.addEventListener('hidden.bs.modal', async () => {
      await this.abrirModalNueva(plantilla);
    }, { once: true });
  },

  // ── Bind eventos ─────────────────────────────────────────────────────────
  _bindEvents() {
    document.querySelectorAll('.filter-pill[data-filtro]').forEach(btn => {
      btn.addEventListener('click', async () => {
        this.filtroActual = btn.dataset.filtro;
        this._visibles = 20; // Reset paginación al filtrar
        const tareas   = await DB.getAll(DB.STORES.tareas);
        const clientes = await DB.getAll(DB.STORES.clientes);
        document.getElementById('listaTareas').innerHTML = this._renderLista(tareas, clientes);
        document.querySelectorAll('.filter-pill[data-filtro]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }
};

// ── Bind modal ────────────────────────────────────────────────────────────────
document.getElementById('btnGuardarTarea')?.addEventListener('click', () => Tareas.guardar());
