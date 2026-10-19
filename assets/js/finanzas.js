/* ============================================
   ClienteAPP — Módulo de Finanzas Personales
   Comisiones · Préstamos · Base Mensual
   ============================================ */

// Base mensual configurable desde Configuración (con fallback)
function getBaseMensual() {
  const v = Opciones.get().baseMensual;
  return (typeof v === 'number' && v > 0) ? v : 500000;
}

window.Finanzas = {

  // ── Renderizar página principal ──────────────────────────────────────────
  async render() {
    const content = document.getElementById('pageContent');
    content.innerHTML = UI.spinner('Cargando finanzas...');

    const [proyectos, clientes, registros] = await Promise.all([
      DB.getAll(DB.STORES.proyectos),
      DB.getAll(DB.STORES.clientes),
      DB.getAll(DB.STORES.finanzas)
    ]);

    // Leer porcentaje de comisión personalizado
    const comisionPct = (Opciones.get().comisionPct || 5) / 100;

    const clienteMap  = Object.fromEntries(clientes.map(c => [c.id, c]));
    const proyectoMap = Object.fromEntries(proyectos.map(p => [p.id, p]));

    // Separar registros por tipo
    const cobrosComision = registros.filter(r => r.tipo === 'comision');
    const prestamos      = registros.filter(r => r.tipo === 'prestamo');
    const abonos         = registros.filter(r => r.tipo === 'abono');
    const bases          = registros.filter(r => r.tipo === 'base');

    // ── Métricas de comisiones ──────────────────────────────────────────────
    // Proyectos firmados con su comisión esperada
    const proyFirmados = proyectos.filter(p => {
      const c = clienteMap[p.clienteId];
      return c && ['firmado','construccion','finalizado'].includes(c.estado);
    });

    const totalComisionEsperada = proyFirmados.reduce((s, p) => s + (p.precio * comisionPct), 0);
    const totalComisionCobrada  = cobrosComision.reduce((s, r) => s + (r.monto || 0), 0);
    const totalComisionPendiente= totalComisionEsperada - totalComisionCobrada;

    // ── Métricas de préstamos ───────────────────────────────────────────────
    // Deuda total = suma de todos los préstamos registrados
    const totalPrestado = prestamos.reduce((s, r) => s + (r.monto || 0), 0);

    // Total abonado = suma de todos los abonos registrados (incluye abonos desde base mensual)
    const totalAbonado  = abonos.reduce((s, r) => s + (r.monto || 0), 0);

    // Deuda restante = deuda total - lo que ya se ha abonado
    const deudaActual   = Math.max(0, totalPrestado - totalAbonado);

    // ── Métricas de base mensual ────────────────────────────────────────────
    const totalBases     = bases.reduce((s, r) => s + (r.monto || 0), 0);
    const basesAbonadas  = bases.filter(r => r.destino === 'prestamo').reduce((s, r) => s + (r.monto || 0), 0);
    const basesDisponibles = bases.filter(r => r.destino === 'disponible').reduce((s, r) => s + (r.monto || 0), 0);

    // ── Balance disponible ──────────────────────────────────────────────────
    const disponible = totalComisionCobrada + basesDisponibles - deudaActual;

    // Próxima base (día 16 del mes actual o siguiente)
    const hoy = new Date();
    let proxBase = new Date(hoy.getFullYear(), hoy.getMonth(), 16);
    if (hoy.getDate() > 16) proxBase = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 16);
    const diasProxBase = Math.ceil((proxBase - hoy) / 86400000);

    content.innerHTML = `
      <div class="fade-in">

        <!-- Hero finanzas -->
        <div class="finanzas-hero mb-4">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h3 class="fw-bold mb-1 text-white">
                <i class="bi bi-wallet2 me-2"></i>Mis Finanzas
              </h3>
              <p class="mb-0 text-white opacity-75 small">
                Comisiones · Préstamos · Base mensual
              </p>
            </div>
            <div class="d-flex gap-2 flex-wrap align-items-center">
              <div class="hero-pill ${disponible >= 0 ? '' : 'hero-pill-warn'}">
                <i class="bi bi-wallet me-1"></i>
                Disponible: <strong>${UI.money(disponible)}</strong>
              </div>
              ${diasProxBase <= 5 ? `
                <div class="hero-pill hero-pill-warn">
                  <i class="bi bi-calendar-check me-1"></i>
                  Base en ${diasProxBase} día${diasProxBase !== 1 ? 's' : ''}
                </div>` : ''}
              <button class="btn btn-light btn-sm fw-semibold"
                      onclick="ReporteFinanzas.descargarPDF()" title="Descargar reporte en PDF">
                <i class="bi bi-file-earmark-pdf me-1"></i>Reporte PDF
              </button>
              <button class="btn btn-outline-light btn-sm fw-semibold"
                      onclick="ReporteFinanzas.imprimir()" title="Imprimir reporte">
                <i class="bi bi-printer"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="row g-3 mb-4">
          <div class="col-6 col-lg-3">
            <div class="kpi-card" style="--kpi-gradient:linear-gradient(135deg,#1a4a2e,#2d8a4f);">
              <div class="kpi-icon"><i class="bi bi-percent"></i></div>
              <div class="kpi-valor">${UI.formatCurrency(totalComisionCobrada)}</div>
              <div class="kpi-label">Comisiones Cobradas</div>
              <div class="kpi-sub">${UI.money(totalComisionPendiente)} pendiente</div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="kpi-card" style="--kpi-gradient:linear-gradient(135deg,#4a1a1a,#8a2d2d);">
              <div class="kpi-icon"><i class="bi bi-bank"></i></div>
              <div class="kpi-valor">${UI.formatCurrency(deudaActual)}</div>
              <div class="kpi-label">Deuda Restante</div>
              <div class="kpi-sub">
                Total: ${UI.money(totalPrestado)} · Abonado: ${UI.money(totalAbonado)}
              </div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="kpi-card" style="--kpi-gradient:linear-gradient(135deg,#1a2e4a,#2d5a8a);">
              <div class="kpi-icon"><i class="bi bi-calendar-check"></i></div>
              <div class="kpi-valor">${UI.formatCurrency(totalBases)}</div>
              <div class="kpi-label">Bases Recibidas</div>
              <div class="kpi-sub">${bases.length} pagos · día 16</div>
            </div>
          </div>
          <div class="col-6 col-lg-3">
            <div class="kpi-card" style="--kpi-gradient:${disponible >= 0 ? 'linear-gradient(135deg,#28a745,#6ee7b7)' : 'linear-gradient(135deg,#dc3545,#f07080)'};">
              <div class="kpi-icon"><i class="bi bi-wallet-fill"></i></div>
              <div class="kpi-valor">${UI.formatCurrency(Math.abs(disponible))}</div>
              <div class="kpi-label">${disponible >= 0 ? 'Disponible' : 'Déficit'}</div>
              <div class="kpi-sub">${disponible >= 0 ? 'Balance positivo' : 'Balance negativo'}</div>
            </div>
          </div>
        </div>

        <!-- Fila 2: Comisiones + Próxima base -->
        <div class="row g-3 mb-4">

          <!-- Comisiones por proyecto -->
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-percent me-2 text-success"></i>Comisiones por Proyecto (${Opciones.get().comisionPct || 5}%)
                </h6>
                <button class="btn btn-sm btn-success" onclick="Finanzas.abrirModalComision()">
                  <i class="bi bi-plus-lg me-1"></i>Registrar cobro
                </button>
              </div>
              <div class="card-body px-4 pb-4">
                ${this._tablaComisiones(proyFirmados, cobrosComision, clienteMap)}
              </div>
            </div>
          </div>

          <!-- Base mensual -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm h-100">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-calendar-check me-2 text-primary"></i>Base Mensual (${UI.formatCurrency(getBaseMensual())} · día 16)
                </h6>
                <button class="btn btn-sm btn-primary" onclick="Finanzas.abrirModalBase()">
                  <i class="bi bi-plus-lg me-1"></i>Registrar
                </button>
              </div>
              <div class="card-body px-4 pb-4">
                <!-- Próxima base -->
                <div class="alert ${diasProxBase <= 3 ? 'alert-warning' : 'alert-info'} py-2 small mb-3">
                  <i class="bi bi-calendar-event me-1"></i>
                  Próxima base: <strong>${proxBase.toLocaleDateString('es-CO', {day:'numeric',month:'long',year:'numeric'})}</strong>
                  ${diasProxBase === 0 ? ' — <strong>¡Hoy!</strong>' : ` — en ${diasProxBase} día${diasProxBase !== 1 ? 's' : ''}`}
                </div>
                ${this._listaBases(bases)}
              </div>
            </div>
          </div>
        </div>

        <!-- Fila 3: Préstamos -->
        <div class="row g-3">
          <div class="col-12">
            <div class="card border-0 shadow-sm">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-bank me-2 text-danger"></i>Préstamos y Abonos
                </h6>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-warning" onclick="Finanzas.abrirModalAbono()">
                    <i class="bi bi-arrow-down-circle me-1"></i>Abonar
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="Finanzas.abrirModalPrestamo()">
                    <i class="bi bi-plus-lg me-1"></i>Nuevo préstamo
                  </button>
                </div>
              </div>
              <div class="card-body px-4 pb-4">
                ${this._tablaPrestamos(prestamos, abonos)}
              </div>
            </div>
          </div>
        </div>

      </div>`;
  },

  // ── Tabla de comisiones por proyecto ─────────────────────────────────────
  _tablaComisiones(proyectos, cobros, clienteMap) {
    if (proyectos.length === 0) {
      return `<div class="text-center py-4 text-muted">
        <i class="bi bi-percent fs-2 d-block mb-2 opacity-40"></i>
        <small>Sin proyectos firmados aún</small>
      </div>`;
    }

    return `<div class="table-responsive">
      <table class="table table-hover align-middle mb-0">
        <thead class="table-light">
          <tr>
            <th class="small">Cliente / Proyecto</th>
            <th class="small text-end">Valor Casa</th>
            <th class="small text-end">Comisión (5%)</th>
            <th class="small text-end">Cobrado</th>
            <th class="small text-end">Pendiente</th>
            <th class="small text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${proyectos.map(p => {
            const cliente      = clienteMap[p.clienteId];
            const pctComision  = (Opciones.get().comisionPct || 5) / 100;
            const comisionTotal= p.precio * pctComision;
            const cobrado      = cobros.filter(c => c.proyectoId === p.id).reduce((s, c) => s + (c.monto || 0), 0);
            const pendiente    = comisionTotal - cobrado;
            const pct          = comisionTotal > 0 ? Math.round(cobrado / comisionTotal * 100) : 0;
            const estadoCls    = pct >= 100 ? 'success' : pct > 0 ? 'warning' : 'secondary';
            const estadoLabel  = pct >= 100 ? 'Cobrada' : pct > 0 ? 'Parcial' : 'Pendiente';

            return `<tr>
              <td>
                <div class="fw-semibold small">${cliente ? UI.escapeHTML(cliente.nombre) : '—'}</div>
                <div class="text-muted" style="font-size:11px;">${UI.escapeHTML(p.modelo)} · ${p.area}m²</div>
                <div class="progress mt-1" style="height:3px;width:80px;">
                  <div class="progress-bar bg-${estadoCls}" style="width:${pct}%;"></div>
                </div>
              </td>
              <td class="text-end small fw-semibold">${UI.formatCurrency(p.precio)}</td>
              <td class="text-end small fw-bold text-success">${UI.formatCurrency(comisionTotal)}</td>
              <td class="text-end small text-success">${UI.formatCurrency(cobrado)}</td>
              <td class="text-end small ${pendiente > 0 ? 'text-warning fw-semibold' : 'text-muted'}">${UI.formatCurrency(pendiente)}</td>
              <td class="text-center">
                <span class="badge bg-${estadoCls}">${estadoLabel}</span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // ── Lista de bases mensuales ──────────────────────────────────────────────
  _listaBases(bases) {
    if (bases.length === 0) {
      return `<div class="text-center py-3 text-muted">
        <i class="bi bi-calendar-x fs-2 d-block mb-2 opacity-40"></i>
        <small>Sin bases registradas</small>
      </div>`;
    }

    const recientes = [...bases].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 6);

    return recientes.map(b => {
      const esAbono = b.destino === 'prestamo';
      return `
        <div class="d-flex align-items-center gap-3 py-2 border-bottom">
          <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
               style="width:32px;height:32px;background:${esAbono ? '#fef3c7' : '#d1fae5'};">
            <i class="bi ${esAbono ? 'bi-arrow-down-circle text-warning' : 'bi-wallet2 text-success'}" style="font-size:14px;"></i>
          </div>
          <div class="flex-grow-1">
            <div class="fw-semibold small">${UI.formatCurrency(b.monto)}</div>
            <div class="text-muted" style="font-size:11px;">
              ${UI.formatDate(b.fecha)} · ${esAbono ? 'Abonado a préstamo' : 'Disponible'}
            </div>
          </div>
          <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="Finanzas.eliminarRegistro('${b.id}')" title="Eliminar">
            <i class="bi bi-trash" style="font-size:11px;"></i>
          </button>
        </div>`;
    }).join('');
  },

  // ── Tabla de préstamos ────────────────────────────────────────────────────
  _tablaPrestamos(prestamos, abonos) {
    if (prestamos.length === 0) {
      return `<div class="text-center py-4 text-muted">
        <i class="bi bi-bank fs-2 d-block mb-2 opacity-40"></i>
        <small>Sin préstamos registrados — ¡Bien!</small>
      </div>`;
    }

    return `<div class="row g-3">
      ${prestamos.map(p => {
        const abonosPrestamo = abonos.filter(a => a.prestamoId === p.id);
        const totalAbonado   = abonosPrestamo.reduce((s, a) => s + (a.monto || 0), 0);
        const saldo          = Math.max(0, p.monto - totalAbonado);
        const pct            = p.monto > 0 ? Math.round(totalAbonado / p.monto * 100) : 0;
        const pagado         = saldo === 0;

        return `
          <div class="col-md-6">
            <div class="card border-0 shadow-sm ${pagado ? 'border-success' : ''}" style="${pagado ? 'border:1.5px solid #28a745 !important;' : ''}">
              <div class="card-body p-3">
                <div class="d-flex align-items-start justify-content-between mb-2">
                  <div>
                    <div class="fw-bold small">${UI.escapeHTML(p.descripcion)}</div>
                    <div class="text-muted" style="font-size:11px;">${UI.formatDate(p.fecha)}</div>
                  </div>
                  <div class="d-flex gap-1">
                    ${pagado
                      ? '<span class="badge bg-success">✅ Pagado</span>'
                      : `<span class="badge bg-danger">${UI.formatCurrency(saldo)}</span>`}
                    <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="Finanzas.eliminarRegistro('${p.id}')" title="Eliminar">
                      <i class="bi bi-trash" style="font-size:11px;"></i>
                    </button>
                  </div>
                </div>

                <div class="row g-2 text-center mb-2">
                  <div class="col-4">
                    <div class="small fw-bold text-danger">${UI.formatCurrency(p.monto)}</div>
                    <div class="text-muted" style="font-size:10px;">Prestado</div>
                  </div>
                  <div class="col-4">
                    <div class="small fw-bold text-success">${UI.formatCurrency(totalAbonado)}</div>
                    <div class="text-muted" style="font-size:10px;">Abonado</div>
                  </div>
                  <div class="col-4">
                    <div class="small fw-bold ${saldo > 0 ? 'text-warning' : 'text-success'}">${UI.formatCurrency(saldo)}</div>
                    <div class="text-muted" style="font-size:10px;">Saldo</div>
                  </div>
                </div>

                <div class="progress mb-2" style="height:6px;border-radius:3px;">
                  <div class="progress-bar ${pagado ? 'bg-success' : 'bg-warning'}"
                       style="width:${pct}%;transition:width 1s ease;"></div>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                  <small class="text-muted">${pct}% pagado</small>
                  ${!pagado ? `
                    <button class="btn btn-sm btn-outline-warning py-0 px-2" style="font-size:11px;"
                            onclick="Finanzas.abrirModalAbono('${p.id}')">
                      <i class="bi bi-arrow-down-circle me-1"></i>Abonar
                    </button>` : ''}
                </div>

                ${abonosPrestamo.length > 0 ? `
                  <div class="mt-2 pt-2 border-top">
                    <small class="text-muted fw-semibold">ABONOS:</small>
                    ${[...abonosPrestamo].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map(a => `
                      <div class="d-flex justify-content-between align-items-center mt-1 gap-2">
                        <small class="text-muted flex-shrink-0">${UI.formatDate(a.fecha)}</small>
                        <small class="text-success fw-semibold ms-auto">+${UI.formatCurrency(a.monto)}</small>
                        <div class="d-flex gap-1 flex-shrink-0">
                          <button class="btn btn-sm btn-outline-success py-0 px-1" style="font-size:10px;line-height:1;"
                                  onclick="Finanzas.editarAbono('${a.id}')" title="Editar abono">
                            <i class="bi bi-pencil"></i>
                          </button>
                          <button class="btn btn-sm btn-outline-danger py-0 px-1" style="font-size:10px;line-height:1;"
                                  onclick="Finanzas.eliminarRegistro('${a.id}')" title="Eliminar abono">
                            <i class="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>`).join('')}
                  </div>` : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
  },

  // ── Modal Comisión ────────────────────────────────────────────────────────
  async abrirModalComision() {
    const proyectos = await DB.getAll(DB.STORES.proyectos);
    const clientes  = await DB.getAll(DB.STORES.clientes);
    const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));

    const firmados = proyectos.filter(p => {
      const c = clienteMap[p.clienteId];
      return c && ['firmado','construccion','finalizado'].includes(c.estado);
    });

    const sel = document.getElementById('comisionProyectoSelect');
    sel.innerHTML = '<option value="">Selecciona un proyecto...</option>' +
      firmados.map(p => {
        const c = clienteMap[p.clienteId];
        return `<option value="${p.id}" data-precio="${p.precio}">
          ${c ? UI.escapeHTML(c.nombre) : '?'} — ${UI.escapeHTML(p.modelo)}
        </option>`;
      }).join('');

    document.getElementById('comisionFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('comisionMonto').value = '';
    document.getElementById('comisionObservaciones').value = '';
    document.getElementById('comisionInfoText').textContent = 'Selecciona un proyecto para ver la comisión.';

    sel.onchange = () => {
      const opt    = sel.selectedOptions[0];
      const precio = parseFloat(opt?.dataset.precio || 0);
      if (precio > 0) {
        const pctComision = (Opciones.get().comisionPct || 5) / 100;
        const comision    = precio * pctComision;
        const pctLabel    = Opciones.get().comisionPct || 5;
        document.getElementById('comisionInfoText').textContent =
          `Precio: ${UI.formatCurrency(precio)} → Comisión ${pctLabel}%: ${UI.formatCurrency(comision)}`;
        document.getElementById('comisionMonto').value = comision;
      }
    };

    UI.openModal('modalComision');
  },

  // ── Guardar comisión ──────────────────────────────────────────────────────
  async guardarComision() {
    const proyectoId = document.getElementById('comisionProyectoSelect').value;
    const monto      = parseFloat(document.getElementById('comisionMonto').value);
    const fecha      = document.getElementById('comisionFecha').value;

    if (!proyectoId || !monto || !fecha) {
      UI.toast('Completa todos los campos obligatorios', 'warning');
      return;
    }

    await DB.put(DB.STORES.finanzas, {
      id:           DB.generateId(),
      tipo:         'comision',
      proyectoId,
      monto,
      fecha,
      observaciones: document.getElementById('comisionObservaciones').value.trim()
    });

    UI.closeModal('modalComision');
    UI.toast(`Comisión de ${UI.formatCurrency(monto)} registrada`, 'cash');
    await this.render();
  },

  // ── Modal Préstamo ────────────────────────────────────────────────────────
  abrirModalPrestamo() {
    document.getElementById('formPrestamo').reset();
    document.getElementById('prestamoFecha').value = new Date().toISOString().split('T')[0];
    UI.openModal('modalPrestamo');
  },

  // ── Guardar préstamo ──────────────────────────────────────────────────────
  async guardarPrestamo() {
    const descripcion = document.getElementById('prestamoDescripcion').value.trim();
    const monto       = parseFloat(document.getElementById('prestamoMonto').value);
    const fecha       = document.getElementById('prestamoFecha').value;

    if (!descripcion || !monto || !fecha) {
      UI.toast('Completa todos los campos obligatorios', 'warning');
      return;
    }

    await DB.put(DB.STORES.finanzas, {
      id:           DB.generateId(),
      tipo:         'prestamo',
      descripcion,
      monto,
      fecha,
      observaciones: document.getElementById('prestamoObservaciones').value.trim()
    });

    UI.closeModal('modalPrestamo');
    UI.toast(`Préstamo de ${UI.formatCurrency(monto)} registrado`, 'warning');
    await this.render();
  },

  // ── Modal Abono ───────────────────────────────────────────────────────────
  async abrirModalAbono(prestamoIdPreseleccionado = '') {
    const registros  = await DB.getAll(DB.STORES.finanzas);
    const prestamos  = registros.filter(r => r.tipo === 'prestamo');
    const abonos     = registros.filter(r => r.tipo === 'abono');

    const sel = document.getElementById('abonoPrestamoSelect');
    sel.innerHTML = '<option value="">Selecciona un préstamo...</option>' +
      prestamos.map(p => {
        const totalAbonado = abonos.filter(a => a.prestamoId === p.id).reduce((s, a) => s + (a.monto || 0), 0);
        const saldo = Math.max(0, p.monto - totalAbonado);
        return `<option value="${p.id}" data-saldo="${saldo}" ${p.id === prestamoIdPreseleccionado ? 'selected' : ''}>
          ${UI.escapeHTML(p.descripcion)} — Saldo: ${UI.formatCurrency(saldo)}
        </option>`;
      }).join('');

    document.getElementById('abonoFecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('abonoMonto').value = '';
    document.getElementById('abonoObservaciones').value = '';

    const infoAlert = document.getElementById('abonoInfoAlert');
    const infoText  = document.getElementById('abonoInfoText');

    const actualizarInfo = () => {
      const opt   = sel.selectedOptions[0];
      const saldo = parseFloat(opt?.dataset.saldo || 0);
      if (saldo > 0) {
        infoText.textContent = `Saldo pendiente: ${UI.formatCurrency(saldo)}`;
        infoAlert.style.display = '';
        document.getElementById('abonoMonto').value = saldo;
      } else {
        infoAlert.style.display = 'none';
      }
    };

    sel.onchange = actualizarInfo;
    if (prestamoIdPreseleccionado) actualizarInfo();

    UI.openModal('modalAbono');
  },

  // ── Guardar abono ─────────────────────────────────────────────────────────
  async guardarAbono() {
    const prestamoId = document.getElementById('abonoPrestamoSelect').value;
    const monto      = parseFloat(document.getElementById('abonoMonto').value);
    const fecha      = document.getElementById('abonoFecha').value;

    if (!prestamoId || !monto || !fecha) {
      UI.toast('Completa todos los campos obligatorios', 'warning');
      return;
    }

    // Limitante: no permitir abonar más del saldo pendiente
    const registros        = await DB.getAll(DB.STORES.finanzas);
    const prestamo         = registros.find(r => r.id === prestamoId);
    const abonosExistentes = registros.filter(r => r.tipo === 'abono' && r.prestamoId === prestamoId);
    const totalAbonado     = abonosExistentes.reduce((s, a) => s + (a.monto || 0), 0);
    const saldoPrestamo    = Math.max(0, (prestamo?.monto || 0) - totalAbonado);

    if (monto > saldoPrestamo) {
      UI.toast(
        `El saldo pendiente es ${UI.formatCurrency(saldoPrestamo)}. No puedes abonar más de eso.`,
        'warning', 6000
      );
      return;
    }

    await DB.put(DB.STORES.finanzas, {
      id:           DB.generateId(),
      tipo:         'abono',
      prestamoId,
      monto,
      fecha,
      observaciones: document.getElementById('abonoObservaciones').value.trim()
    });

    UI.closeModal('modalAbono');
    UI.toast(`Abono de ${UI.formatCurrency(monto)} registrado`, 'success');
    await this.render();
  },

  // ── Modal Base Mensual ────────────────────────────────────────────────────
  async abrirModalBase() {
    const registros = await DB.getAll(DB.STORES.finanzas);
    const prestamos = registros.filter(r => r.tipo === 'prestamo');
    const abonos    = registros.filter(r => r.tipo === 'abono');

    // Préstamos con saldo pendiente
    const conSaldo = prestamos.filter(p => {
      const totalAbonado = abonos.filter(a => a.prestamoId === p.id).reduce((s, a) => s + (a.monto || 0), 0);
      return p.monto - totalAbonado > 0;
    });

    const sel = document.getElementById('basePrestamoSelect');
    sel.innerHTML = conSaldo.map(p => {
      const totalAbonado = abonos.filter(a => a.prestamoId === p.id).reduce((s, a) => s + (a.monto || 0), 0);
      const saldo = p.monto - totalAbonado;
      return `<option value="${p.id}" data-saldo="${saldo}">${UI.escapeHTML(p.descripcion)} — Saldo: ${UI.formatCurrency(saldo)}</option>`;
    }).join('');

    // Mes actual
    const hoy = new Date();
    document.getElementById('baseMes').value =
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('baseMonto').value = getBaseMensual();
    document.getElementById('baseObservaciones').value = '';

    // Radio buttons — mostrar/ocultar grupo de préstamo específico
    document.querySelectorAll('input[name="baseDestino"]').forEach(r => {
      r.onchange = () => {
        const group = document.getElementById('basePrestamoGroup');
        group.classList.toggle('d-none', r.value !== 'prestamo');
      };
    });
    document.getElementById('baseDestinoDisponible').checked = true;
    document.getElementById('basePrestamoGroup').classList.add('d-none');

    UI.openModal('modalBase');
  },

  // ── Guardar base mensual ──────────────────────────────────────────────────
  async guardarBase() {
    const mes    = document.getElementById('baseMes').value;
    const monto  = parseFloat(document.getElementById('baseMonto').value);
    const destino= document.querySelector('input[name="baseDestino"]:checked')?.value || 'disponible';

    if (!mes || !monto) {
      UI.toast('Completa todos los campos obligatorios', 'warning');
      return;
    }

    // Fecha: día 16 del mes seleccionado
    const [anio, mesNum] = mes.split('-');
    const fecha = `${anio}-${mesNum}-16`;
    const obs   = document.getElementById('baseObservaciones').value.trim();

    // ── Opción 1: Disponible para mí ────────────────────────────────────────
    if (destino === 'disponible') {
      await DB.put(DB.STORES.finanzas, {
        id: DB.generateId(), tipo: 'base',
        monto, fecha, destino: 'disponible', prestamoId: null, observaciones: obs
      });
      UI.closeModal('modalBase');
      UI.toast(`Base de ${UI.formatCurrency(monto)} registrada como disponible`, 'success');
      await this.render();
      return;
    }

    // ── Opción 2: Abonar a un préstamo específico ────────────────────────────
    if (destino === 'prestamo') {
      const prestamoId = document.getElementById('basePrestamoSelect').value;
      if (!prestamoId) {
        UI.toast('Selecciona un préstamo', 'warning');
        return;
      }

      // Calcular saldo real del préstamo seleccionado
      const registros  = await DB.getAll(DB.STORES.finanzas);
      const prestamo   = registros.find(r => r.id === prestamoId);
      const abonosExistentes = registros.filter(r => r.tipo === 'abono' && r.prestamoId === prestamoId);
      const totalAbonado = abonosExistentes.reduce((s, a) => s + (a.monto || 0), 0);
      const saldoPrestamo = Math.max(0, (prestamo?.monto || 0) - totalAbonado);

      // Limitante: no permitir abonar más del saldo pendiente
      if (monto > saldoPrestamo) {
        UI.toast(
          `El saldo pendiente es ${UI.formatCurrency(saldoPrestamo)}. No puedes abonar más de eso.`,
          'warning', 6000
        );
        return;
      }

      await DB.put(DB.STORES.finanzas, {
        id: DB.generateId(), tipo: 'base',
        monto, fecha, destino: 'prestamo', prestamoId, observaciones: obs
      });
      await DB.put(DB.STORES.finanzas, {
        id: DB.generateId(), tipo: 'abono',
        prestamoId, monto, fecha,
        observaciones: `Base mensual ${mes} abonada al préstamo`
      });

      UI.closeModal('modalBase');
      UI.toast(`Base de ${UI.formatCurrency(monto)} abonada al préstamo`, 'cash');
      await this.render();
      return;
    }

    // ── Opción 3: Abonar todo hasta donde alcance ────────────────────────────
    if (destino === 'todo') {
      const registros = await DB.getAll(DB.STORES.finanzas);
      const prestamos = registros.filter(r => r.tipo === 'prestamo');
      const abonos    = registros.filter(r => r.tipo === 'abono');

      // Calcular saldo de cada préstamo y ordenar de menor a mayor
      const conSaldo = prestamos
        .map(p => {
          const totalAbonado = abonos.filter(a => a.prestamoId === p.id).reduce((s, a) => s + (a.monto || 0), 0);
          return { ...p, saldo: Math.max(0, p.monto - totalAbonado) };
        })
        .filter(p => p.saldo > 0)
        .sort((a, b) => a.saldo - b.saldo); // menor deuda primero

      if (conSaldo.length === 0) {
        UI.toast('No tienes préstamos con saldo pendiente', 'info');
        return;
      }

      // Registrar la base
      await DB.put(DB.STORES.finanzas, {
        id: DB.generateId(), tipo: 'base',
        monto, fecha, destino: 'todo', prestamoId: null, observaciones: obs
      });

      // Distribuir el monto entre deudas de menor a mayor
      let restante = monto;
      const detalle = [];

      for (const p of conSaldo) {
        if (restante <= 0) break;
        const abonar = Math.min(restante, p.saldo);
        await DB.put(DB.STORES.finanzas, {
          id: DB.generateId(), tipo: 'abono',
          prestamoId: p.id, monto: abonar, fecha,
          observaciones: `Base mensual ${mes} — distribución automática`
        });
        detalle.push(`${p.descripcion}: ${UI.formatCurrency(abonar)}`);
        restante -= abonar;
      }

      UI.closeModal('modalBase');

      // Mostrar resumen de la distribución
      const sobrante = restante > 0
        ? ` · Sobrante disponible: ${UI.formatCurrency(restante)}`
        : '';
      UI.toast(`Distribuido: ${detalle.join(' · ')}${sobrante}`, 'cash', 8000);
      await this.render();
    }
  },

  // ── Editar un abono de préstamo ───────────────────────────────────────────
  async editarAbono(abonoId) {
    const registros = await DB.getAll(DB.STORES.finanzas);
    const abono = registros.find(r => r.id === abonoId && r.tipo === 'abono');
    if (!abono) { UI.toast('No se encontró el abono', 'danger'); return; }

    const prestamo = registros.find(r => r.id === abono.prestamoId && r.tipo === 'prestamo');

    // Saldo disponible SIN contar este abono (para validar el nuevo monto)
    const otrosAbonos = registros.filter(r =>
      r.tipo === 'abono' && r.prestamoId === abono.prestamoId && r.id !== abonoId
    );
    const abonadoSinEste = otrosAbonos.reduce((s, a) => s + (a.monto || 0), 0);
    const maxPermitido = Math.max(0, (prestamo?.monto || 0) - abonadoSinEste);

    const id = 'modalEditAbonoFin-' + Date.now();
    const html = `
      <div class="modal fade" id="${id}" tabindex="-1">
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg" style="border-radius:16px;overflow:hidden;">
            <div class="modal-header border-0 py-3 px-4"
                 style="background:linear-gradient(135deg,#4a3a1a,#8a6a2d);color:white;">
              <h6 class="fw-bold mb-0 text-white">
                <i class="bi bi-pencil me-2"></i>Editar Abono
              </h6>
              <button type="button" class="btn-close btn-close-white btn-sm" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <div class="row g-3">
                ${prestamo ? `
                <div class="col-12">
                  <div class="alert alert-secondary py-2 px-3 mb-0 small">
                    <i class="bi bi-bank me-1"></i>Préstamo: <strong>${UI.escapeHTML(prestamo.descripcion)}</strong><br>
                    Máximo permitido: <strong>${UI.formatCurrency(maxPermitido)}</strong>
                  </div>
                </div>` : ''}
                <div class="col-12">
                  <label class="form-label fw-semibold small">Monto *</label>
                  <div class="input-group input-group-sm">
                    <span class="input-group-text">$</span>
                    <input type="number" class="form-control" id="${id}-monto"
                           value="${abono.monto || ''}" min="1" required />
                  </div>
                </div>
                <div class="col-12">
                  <label class="form-label fw-semibold small">Fecha *</label>
                  <input type="date" class="form-control form-control-sm" id="${id}-fecha"
                         value="${abono.fecha || ''}" required />
                </div>
                <div class="col-12">
                  <label class="form-label fw-semibold small">Observaciones</label>
                  <input type="text" class="form-control form-control-sm" id="${id}-obs"
                         value="${UI.escapeHTML(abono.observaciones || '')}"
                         placeholder="Nota del abono..." />
                </div>
              </div>
            </div>
            <div class="modal-footer border-0 pt-0 pb-4 px-4 gap-2">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
              <button class="btn btn-warning btn-sm fw-semibold"
                      onclick="Finanzas.guardarEdicionAbono('${abonoId}','${id}',${maxPermitido})">
                <i class="bi bi-check-lg me-1"></i>Guardar cambios
              </button>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    const el = document.getElementById(id);
    const modal = new bootstrap.Modal(el);
    modal.show();
    el.addEventListener('hidden.bs.modal', () => el.remove(), { once: true });
  },

  // ── Guardar edición de abono ──────────────────────────────────────────────
  async guardarEdicionAbono(abonoId, modalId, maxPermitido) {
    const monto = parseFloat(document.getElementById(`${modalId}-monto`)?.value);
    const fecha = document.getElementById(`${modalId}-fecha`)?.value;

    if (!monto || monto <= 0 || !fecha) {
      UI.toast('Monto y fecha son obligatorios', 'warning'); return;
    }
    if (maxPermitido > 0 && monto > maxPermitido) {
      UI.toast(`El máximo permitido para este abono es ${UI.formatCurrency(maxPermitido)}.`, 'warning', 6000);
      return;
    }

    const abono = await DB.get(DB.STORES.finanzas, abonoId);
    if (!abono) return;

    abono.monto = monto;
    abono.fecha = fecha;
    abono.observaciones = document.getElementById(`${modalId}-obs`)?.value?.trim() || '';
    await DB.put(DB.STORES.finanzas, abono);

    bootstrap.Modal.getInstance(document.getElementById(modalId))?.hide();
    UI.toast('Abono actualizado', 'success');
    await this.render();
  },

  // ── Eliminar registro ─────────────────────────────────────────────────────
  async eliminarRegistro(id) {
    const ok = await UI.confirm('¿Eliminar este registro?', 'Eliminar');
    if (!ok) return;
    await DB.delete(DB.STORES.finanzas, id);
    UI.toast('Registro eliminado', 'danger');
    await this.render();
  }
};

// ── Bind botones de modales ───────────────────────────────────────────────────
document.getElementById('btnGuardarComision')?.addEventListener('click', () => Finanzas.guardarComision());
document.getElementById('btnGuardarPrestamo')?.addEventListener('click', () => Finanzas.guardarPrestamo());
document.getElementById('btnGuardarAbono')?.addEventListener('click',    () => Finanzas.guardarAbono());
document.getElementById('btnGuardarBase')?.addEventListener('click',     () => Finanzas.guardarBase());
