/* ============================================
   ClienteAPP — Módulo de Clientes
   ============================================ */

window.Clientes = {

  filtroActual: 'todos',
  busqueda: '',
  _visibles: 20, // Cantidad de clientes visibles (paginación)

  // ── Renderizar página ────────────────────────────────────────────────────
  async render() {
    this._visibles = 20; // Reset paginación al navegar
    const content = document.getElementById('pageContent');
    content.innerHTML = UI.spinner('Cargando clientes...');

    const clientes = await DB.getAll(DB.STORES.clientes);
    const total = clientes.length;

    // Actualizar badge sidebar
    document.getElementById('badgeClientes').textContent = total;

    content.innerHTML = `
      <div class="fade-in">

        <!-- Búsqueda y filtros -->
        <div class="card-app p-3 mb-4">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
            <div class="search-bar flex-grow-1" style="max-width:420px;">
              <i class="bi bi-search text-muted"></i>
              <input type="text" id="searchClientes" placeholder="Buscar por nombre, teléfono o ubicación..." value="${this.busqueda}" />
            </div>
            <button class="btn btn-primary" id="btnNuevoCliente">
              <i class="bi bi-person-plus me-2"></i>Nuevo Cliente
            </button>
          </div>
          <div class="d-flex flex-wrap gap-2">
            ${this._filterPills()}
          </div>
        </div>

        <!-- Lista de clientes -->
        <div id="listaClientes">
          ${this._renderLista(clientes)}
        </div>
      </div>`;

    this._bindEvents();
  },

  // ── Filtros pills ─────────────────────────────────────────────────────────
  _filterPills() {
    const filtros = [
      { key: 'todos',        label: 'Todos' },
      { key: 'nuevo',        label: '🟢 Nuevos' },
      { key: 'cotizado',     label: '🔵 Cotizados' },
      { key: 'negociacion',  label: '🟡 Negociación' },
      { key: 'firmado',      label: '🟠 Firmados' },
      { key: 'construccion', label: '🔴 Construcción' },
      { key: 'finalizado',   label: '✅ Finalizados' },
      { key: 'perdido',      label: '❌ Perdidos' }
    ];
    return filtros.map(f =>
      `<button class="filter-pill ${this.filtroActual === f.key ? 'active' : ''}" data-filtro="${f.key}">${f.label}</button>`
    ).join('');
  },

  // ── Renderizar lista ──────────────────────────────────────────────────────
  _renderLista(clientes) {
    let filtrados = clientes;

    if (this.filtroActual !== 'todos') {
      filtrados = filtrados.filter(c => c.estado === this.filtroActual);
    }

    if (this.busqueda) {
      const q = this.busqueda.toLowerCase();
      filtrados = filtrados.filter(c =>
        (c.nombre || '').toLowerCase().includes(q) ||
        (c.telefono || '').includes(q) ||
        (c.ubicacion || '').toLowerCase().includes(q)
      );
    }

    // Ordenar: más recientes primero
    filtrados.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (filtrados.length === 0) {
      return UI.emptyState(
        'bi-people',
        'No hay clientes',
        this.busqueda ? 'Intenta con otra búsqueda' : 'Agrega tu primer cliente para comenzar',
        `<button class="btn btn-primary mt-3" onclick="Clientes.abrirModalNuevo()">
          <i class="bi bi-person-plus me-2"></i>Agregar Cliente
        </button>`
      );
    }

    const visibles = filtrados.slice(0, this._visibles);
    const hayMas = filtrados.length > this._visibles;

    return `<div class="row g-3">
      ${visibles.map(c => this._clienteCard(c)).join('')}
    </div>
    ${hayMas ? `
      <div class="text-center mt-4">
        <button class="btn btn-outline-primary px-4 py-2 fw-semibold" onclick="Clientes._cargarMas()" style="border-radius:12px;">
          <i class="bi bi-arrow-down-circle me-2"></i>Cargar más (${filtrados.length - this._visibles} restantes)
        </button>
      </div>` : ''}`;
  },

  // ── Cargar más clientes ───────────────────────────────────────────────────
  async _cargarMas() {
    this._visibles += 20;
    await this._actualizarLista();
  },

  // ── Card de cliente ───────────────────────────────────────────────────────
  _clienteCard(c) {
    const diasSinSeguimiento = this._diasSinSeguimiento(c);
    const alertaSeguimiento = diasSinSeguimiento > 7 && !['finalizado','perdido'].includes(c.estado);
    const nombre   = UI.escapeHTML(c.nombre);
    const telefono = UI.escapeHTML(c.telefono);
    const ubicacion = UI.escapeHTML(c.ubicacion);

    return `
      <div class="col-md-6 col-xl-4">
        <div class="card border-0 shadow-sm h-100"
             style="border-radius:18px;overflow:hidden;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;"
             onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 32px rgba(0,0,0,0.13)'"
             onmouseleave="this.style.transform='';this.style.boxShadow=''"
             onclick="Clientes.abrirExpediente('${c.id}')">

          <!-- Franja de color según estado -->
          <div style="height:5px;background:${this._estadoColor(c.estado)};"></div>

          <div class="card-body p-4">
            <!-- Avatar + nombre -->
            <div class="d-flex align-items-start gap-3 mb-3">
              <div class="cliente-avatar flex-shrink-0"
                   style="width:52px;height:52px;font-size:18px;border-radius:14px;">
                ${UI.initials(c.nombre)}
              </div>
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <h6 class="mb-0 fw-bold text-truncate" style="font-size:15px;">${nombre}</h6>
                  ${alertaSeguimiento ? `
                    <span class="badge rounded-pill bg-warning text-dark"
                          style="font-size:10px;" title="Sin seguimiento hace ${diasSinSeguimiento} días">
                      <i class="bi bi-clock me-1"></i>${diasSinSeguimiento}d
                    </span>` : ''}
                </div>
                <div class="mt-1">${UI.estadoBadge(c.estado)}</div>
              </div>
            </div>

            <!-- Info de contacto -->
            <div class="d-flex flex-column gap-1 mb-3">
              ${c.telefono ? `
                <div class="d-flex align-items-center gap-2 text-muted small">
                  <i class="bi bi-telephone" style="color:#2d6a9f;width:14px;"></i>
                  <span>${telefono}</span>
                </div>` : ''}
              ${c.ubicacion ? `
                <div class="d-flex align-items-center gap-2 text-muted small">
                  <i class="bi bi-geo-alt" style="color:#2d6a9f;width:14px;"></i>
                  <span class="text-truncate">${ubicacion}</span>
                </div>` : ''}
            </div>

            <!-- Acciones -->
            <div class="d-flex gap-2 pt-2 border-top" onclick="event.stopPropagation()">
              ${c.telefono ? `
                <a href="${UI.whatsappLink(c.telefono)}" target="_blank"
                   class="btn btn-sm flex-grow-1 fw-semibold"
                   style="background:#25d366;color:white;border:none;border-radius:10px;">
                  <i class="bi bi-whatsapp me-1"></i>WhatsApp
                </a>` : ''}
              <button class="btn btn-sm btn-outline-primary"
                      style="border-radius:10px;width:36px;"
                      onclick="Clientes.abrirModalEditar('${c.id}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger"
                      style="border-radius:10px;width:36px;"
                      onclick="Clientes.eliminar('${c.id}')" title="Eliminar">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  },

  // ── Color de franja según estado ──────────────────────────────────────────
  _estadoColor(estado) {
    const map = {
      nuevo:        '#10b981',
      cotizado:     '#3b82f6',
      negociacion:  '#f59e0b',
      firmado:      '#f97316',
      construccion: '#ef4444',
      finalizado:   '#06b6d4',
      perdido:      '#94a3b8'
    };
    return map[estado] || '#94a3b8';
  },

  // ── Días sin seguimiento ──────────────────────────────────────────────────
  _diasSinSeguimiento(cliente) {
    const ref = cliente.ultimoSeguimiento || cliente.createdAt;
    if (!ref) return 0;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  },

  // ── Bind eventos ─────────────────────────────────────────────────────────
  _bindEvents() {
    document.getElementById('btnNuevoCliente')?.addEventListener('click', () => this.abrirModalNuevo());

    document.getElementById('searchClientes')?.addEventListener('input', (e) => {
      this.busqueda = e.target.value;
      this._visibles = 20; // Reset paginación al buscar
      this._actualizarLista();
    });

    document.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.filtroActual = btn.dataset.filtro;
        this._visibles = 20; // Reset paginación al filtrar
        this._actualizarLista();
        document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  },

  // ── Actualizar lista sin re-renderizar todo ───────────────────────────────
  async _actualizarLista() {
    const clientes = await DB.getAll(DB.STORES.clientes);
    document.getElementById('listaClientes').innerHTML = this._renderLista(clientes);
  },

  // ── Abrir modal nuevo ─────────────────────────────────────────────────────
  async abrirModalNuevo() {
    document.getElementById('modalClienteTitle').innerHTML = '<i class="bi bi-person-plus me-2"></i>Nuevo Cliente';
    document.getElementById('formCliente').reset();
    document.getElementById('clienteId').value = '';
    UI.openModal('modalCliente');
  },

  // ── Abrir modal editar ────────────────────────────────────────────────────
  async abrirModalEditar(id) {
    const c = await DB.get(DB.STORES.clientes, id);
    if (!c) return;

    document.getElementById('modalClienteTitle').innerHTML = '<i class="bi bi-pencil me-2"></i>Editar Cliente';
    document.getElementById('clienteId').value       = c.id;
    document.getElementById('clienteNombre').value   = c.nombre || '';
    document.getElementById('clienteTelefono').value = c.telefono || '';
    document.getElementById('clienteUbicacion').value= c.ubicacion || '';
    document.getElementById('clienteNotas').value    = c.notas || '';

    UI.openModal('modalCliente');
  },

  // ── Guardar cliente ───────────────────────────────────────────────────────
  async guardar() {
    const id      = document.getElementById('clienteId').value;
    const nombre  = document.getElementById('clienteNombre').value.trim();
    const telefono= document.getElementById('clienteTelefono').value.trim();

    if (!nombre || !telefono) {
      UI.toast('Nombre y teléfono son obligatorios', 'warning');
      return;
    }

    const data = {
      id:        id || DB.generateId(),
      nombre,
      telefono,
      ubicacion: document.getElementById('clienteUbicacion').value.trim(),
      estado:    id
        ? (await DB.get(DB.STORES.clientes, id))?.estado || 'nuevo'  // conservar estado existente
        : 'nuevo',                                                     // nuevo cliente siempre empieza en Nuevo
      notas:     document.getElementById('clienteNotas').value.trim()
    };

    if (id) {
      const existing = await DB.get(DB.STORES.clientes, id);
      if (existing) {
        data.createdAt = existing.createdAt;
        data.ultimoSeguimiento = existing.ultimoSeguimiento;
      }
    }

    await DB.put(DB.STORES.clientes, data);
    UI.closeModal('modalCliente');
    UI.toast(id ? 'Cliente actualizado correctamente' : '¡Nuevo cliente registrado!', 'success');

    // Si venía del expediente, reabrirlo con datos frescos
    const expedienteEl = document.getElementById('modalExpediente');
    const reopenId = expedienteEl?.dataset.reopenClienteId;
    if (id && reopenId === id) {
      expedienteEl.dataset.reopenClienteId = '';
      const modalClienteEl = document.getElementById('modalCliente');
      modalClienteEl.addEventListener('hidden.bs.modal', async function reabrirExpediente() {
        modalClienteEl.removeEventListener('hidden.bs.modal', reabrirExpediente);
        await Clientes.abrirExpediente(id);
      }, { once: true });
    }

    // Refrescar la página actual con datos frescos
    await this.render();
    App.updateBadges();
    // Si el dashboard está activo, refrescarlo también
    if (App.currentPage === 'dashboard') await Dashboard.render();
  },

  // ── Eliminar cliente ──────────────────────────────────────────────────────
  async eliminar(id) {
    const c = await DB.get(DB.STORES.clientes, id);
    if (!c) return;

    const ok = await UI.confirm(
      `¿Eliminar a <strong>${c.nombre}</strong>? Se eliminarán también sus proyectos, pagos y seguimientos.`,
      'Eliminar Cliente'
    );
    if (!ok) return;

    // Eliminar datos relacionados
    const proyectos = await DB.getByIndex(DB.STORES.proyectos, 'clienteId', id);
    for (const p of proyectos) {
      // Eliminar archivos multimedia del proyecto
      const archivos = await DB.getByIndex(DB.STORES.archivos, 'proyectoId', p.id);
      for (const a of archivos) await DB.delete(DB.STORES.archivos, a.id);
      await DB.delete(DB.STORES.proyectos, p.id);
    }

    const pagos = await DB.getByIndex(DB.STORES.pagos, 'clienteId', id);
    for (const p of pagos) await DB.delete(DB.STORES.pagos, p.id);

    const segs = await DB.getByIndex(DB.STORES.seguimientos, 'clienteId', id);
    for (const s of segs) await DB.delete(DB.STORES.seguimientos, s.id);

    // Eliminar tareas vinculadas al cliente
    const tareas = await DB.getAll(DB.STORES.tareas);
    for (const t of tareas) {
      if (t.clienteId === id) await DB.delete(DB.STORES.tareas, t.id);
    }

    // Eliminar historial de estados del cliente
    const historial = await DB.getByIndex(DB.STORES.historialEstados, 'clienteId', id);
    for (const h of historial) await DB.delete(DB.STORES.historialEstados, h.id);

    await DB.delete(DB.STORES.clientes, id);
    UI.toast('Cliente eliminado', 'danger');
    await this.render();
    App.updateBadges();
  },

  // ── Abrir expediente completo ─────────────────────────────────────────────
  async abrirExpediente(clienteId) {
    const cliente = await DB.get(DB.STORES.clientes, clienteId);
    if (!cliente) return;

    document.getElementById('expedienteTitulo').innerHTML =
      `<i class="bi bi-folder2-open me-2"></i>Expediente — ${UI.escapeHTML(cliente.nombre)}`;

    const proyectos    = await DB.getByIndex(DB.STORES.proyectos, 'clienteId', clienteId);
    const pagos        = await DB.getByIndex(DB.STORES.pagos, 'clienteId', clienteId);
    const seguimientos = await DB.getByIndex(DB.STORES.seguimientos, 'clienteId', clienteId);

    const proyecto = proyectos[0] || null;

    document.getElementById('expedienteContent').innerHTML =
      await Expediente.render(cliente, proyecto, pagos, seguimientos);

    UI.openModal('modalExpediente');
    Expediente.bindEvents(clienteId, proyecto);
  }
};

// ── Bind modal guardar ────────────────────────────────────────────────────────
document.getElementById('btnGuardarCliente')?.addEventListener('click', () => Clientes.guardar());
document.getElementById('btnQuickAdd')?.addEventListener('click', () => Clientes.abrirModalNuevo());
