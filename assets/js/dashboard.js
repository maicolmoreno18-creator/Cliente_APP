/* ============================================
   ClienteAPP — Dashboard Principal v3
   ============================================ */

window.Dashboard = {

  _chartInstances: {},

  _destroyCharts() {
    Object.values(this._chartInstances).forEach(c => { try { c.destroy(); } catch {} });
    this._chartInstances = {};
  },

  // ── Calcular lista "A quién llamar hoy" ───────────────────────────────────
  _calcularLlamadasHoy(clientes, proyectos, pagos, seguimientos) {
    const hoy     = new Date(); hoy.setHours(0,0,0,0);
    const ahora   = Date.now();
    const proyMap = Object.fromEntries(proyectos.map(p => [p.clienteId, p]));
    const lista   = [];

    for (const c of clientes) {
      if (['perdido', 'finalizado'].includes(c.estado)) continue;

      const proyecto = proyMap[c.id];
      const cPagos   = pagos.filter(p => p.clienteId === c.id);
      const ref      = c.ultimoSeguimiento || c.createdAt;
      const diasSin  = Math.floor((ahora - new Date(ref).getTime()) / 86400000);
      const motivos  = [];
      let   prioridad = 'rutinario';

      // Recordatorio programado para hoy
      const recHoy = seguimientos.find(s => {
        if (s.clienteId !== c.id || !s.recordatorio || s.recordatorioMostrado) return false;
        const fr = new Date(s.recordatorio);
        return fr >= hoy && fr < new Date(hoy.getTime() + 86400000);
      });
      if (recHoy) {
        motivos.push({ icon: 'bi-bell-fill', color: '#ef4444', texto: `Recordatorio: "${UI.escapeHTML(recHoy.descripcion.substring(0,50))}"` });
        prioridad = 'urgente';
      }

      // Entrega en ≤ 7 días con pago incompleto
      if (proyecto?.fechaEntrega) {
        const diasEntrega = Math.round((new Date(proyecto.fechaEntrega + 'T00:00:00') - hoy) / 86400000);
        const totalPag    = cPagos.reduce((s, p) => s + (p.valorPagado || 0), 0);
        const totalEsp    = cPagos.reduce((s, p) => s + (p.valorTotal  || 0), 0);
        const pct         = totalEsp > 0 ? Math.round(totalPag / totalEsp * 100) : 0;
        if (diasEntrega >= 0 && diasEntrega <= 7 && pct < 100) {
          motivos.push({ icon: 'bi-calendar-x-fill', color: '#ef4444',
            texto: `Entrega ${diasEntrega === 0 ? 'hoy' : 'en ' + diasEntrega + ' días'} — ${pct}% pagado` });
          prioridad = 'urgente';
        }
      }

      // En construcción con materiales pendientes
      if (c.estado === 'construccion') {
        const mat = cPagos.find(p => p.etapa === 'materiales');
        if (mat && mat.estado !== 'pagado') {
          const pctMat = mat.valorTotal > 0 ? Math.round(mat.valorPagado / mat.valorTotal * 100) : 0;
          motivos.push({ icon: 'bi-hammer', color: '#f97316',
            texto: `En obra — materiales al ${pctMat}% (debe ${UI.formatCurrency(mat.valorTotal - mat.valorPagado)})` });
          if (prioridad !== 'urgente') prioridad = 'urgente';
        }
      }

      // Sin seguimiento > 7 días
      if (diasSin > 7) {
        motivos.push({ icon: 'bi-clock-fill', color: '#f59e0b', texto: `Sin contacto hace ${diasSin} días` });
        if (prioridad === 'rutinario') prioridad = 'importante';
      }

      // En negociación sin contacto > 5 días
      if (c.estado === 'negociacion' && diasSin > 5 && diasSin <= 7) {
        motivos.push({ icon: 'bi-arrow-left-right', color: '#f59e0b', texto: `Negociación activa — ${diasSin} días sin contacto` });
        if (prioridad === 'rutinario') prioridad = 'importante';
      }

      // Cotizado sin respuesta > 3 días
      if (c.estado === 'cotizado' && diasSin > 3 && diasSin <= 7) {
        motivos.push({ icon: 'bi-file-text-fill', color: '#3b82f6', texto: `Cotización enviada hace ${diasSin} días sin respuesta` });
      }

      if (motivos.length > 0) {
        lista.push({ cliente: c, motivos, prioridad, diasSin });
      }
    }

    const orden = { urgente: 0, importante: 1, rutinario: 2 };
    lista.sort((a, b) => orden[a.prioridad] - orden[b.prioridad] || b.diasSin - a.diasSin);
    return lista;
  },

  // ── Renderizar sección "A quién llamar hoy" ───────────────────────────────
  _renderLlamadasHoy(lista) {
    if (lista.length === 0) {
      return `
        <div class="text-center py-4">
          <div style="font-size:36px;margin-bottom:8px;">🎉</div>
          <div class="fw-semibold text-success small">¡Todo al día!</div>
          <div class="text-muted" style="font-size:12px;">No hay clientes que requieran atención hoy</div>
        </div>`;
    }

    const cfg = {
      urgente:    { color: '#ef4444', bg: '#fef2f2', border: '#fecaca', label: 'Urgente',    icon: 'bi-exclamation-circle-fill' },
      importante: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', label: 'Importante', icon: 'bi-exclamation-triangle-fill' },
      rutinario:  { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', label: 'Rutinario',  icon: 'bi-telephone-fill' }
    };

    const msgWA = (c) => {
      const msgs = {
        nuevo:        `Hola ${c.nombre.split(' ')[0]}, te contacto para conocer tu interés en una casa prefabricada. ¿Tienes un momento?`,
        cotizado:     `Hola ${c.nombre.split(' ')[0]}, quería hacer seguimiento a la cotización que te enviamos. ¿Tuviste oportunidad de revisarla?`,
        negociacion:  `Hola ${c.nombre.split(' ')[0]}, ¿cómo vas con la decisión? Estoy disponible para resolver cualquier duda.`,
        firmado:      `Hola ${c.nombre.split(' ')[0]}, te contacto para coordinar los próximos pasos del proyecto.`,
        construccion: `Hola ${c.nombre.split(' ')[0]}, te llamo para darte un avance del estado de tu proyecto.`
      };
      return encodeURIComponent(msgs[c.estado] || `Hola ${c.nombre.split(' ')[0]}, te contacto de ClienteAPP.`);
    };

    return lista.map((item, idx) => {
      const { cliente: c, motivos, prioridad: p } = item;
      const c2  = cfg[p];
      const tel = c.telefono?.replace(/\D/g, '');
      const waNum = tel?.startsWith('57') ? tel : '57' + (tel || '');

      return `
        <div style="background:${c2.bg};border:1.5px solid ${c2.border};border-radius:14px;
                    padding:14px 16px;margin-bottom:10px;
                    animation:fadeInUp 0.3s ease ${idx * 0.05}s both;
                    transition:transform 0.2s,box-shadow 0.2s;"
             onmouseenter="this.style.transform='translateX(3px)';this.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'"
             onmouseleave="this.style.transform='';this.style.boxShadow=''">

          <div class="d-flex align-items-center gap-3 mb-2">
            <div class="cliente-avatar flex-shrink-0"
                 style="width:40px;height:40px;font-size:14px;border-radius:12px;">
              ${UI.initials(c.nombre)}
            </div>
            <div class="flex-grow-1 min-w-0">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="fw-bold" style="font-size:14px;">${UI.escapeHTML(c.nombre)}</span>
                <span style="background:${c2.color};color:white;border-radius:20px;
                             padding:2px 9px;font-size:10px;font-weight:700;">
                  <i class="bi ${c2.icon} me-1"></i>${c2.label}
                </span>
                ${UI.estadoBadge(c.estado)}
              </div>
            </div>
          </div>

          <div class="d-flex flex-column gap-1 mb-3 ps-1">
            ${motivos.map(m => `
              <div class="d-flex align-items-start gap-2" style="font-size:12px;color:#374151;">
                <i class="bi ${m.icon} flex-shrink-0 mt-1" style="color:${m.color};font-size:11px;"></i>
                <span>${m.texto}</span>
              </div>`).join('')}
          </div>

          <div class="d-flex gap-2 flex-wrap">
            ${c.telefono ? `
              <a href="https://wa.me/${waNum}?text=${msgWA(c)}" target="_blank"
                 class="btn btn-sm fw-semibold"
                 style="background:#25d366;color:white;border:none;border-radius:8px;font-size:12px;">
                <i class="bi bi-whatsapp me-1"></i>WhatsApp
              </a>
              <a href="tel:${c.telefono}"
                 class="btn btn-sm btn-outline-secondary fw-semibold"
                 style="border-radius:8px;font-size:12px;">
                <i class="bi bi-telephone me-1"></i>Llamar
              </a>` : ''}
            <button class="btn btn-sm fw-semibold"
                    style="background:${c2.color};color:white;border:none;border-radius:8px;font-size:12px;"
                    onclick="Dashboard._registrarContacto('${c.id}')">
              <i class="bi bi-check-circle me-1"></i>Registrar contacto
            </button>
            <button class="btn btn-sm btn-outline-secondary fw-semibold"
                    style="border-radius:8px;font-size:12px;"
                    onclick="Clientes.abrirExpediente('${c.id}')">
              <i class="bi bi-folder2-open me-1"></i>Expediente
            </button>
          </div>
        </div>`;
    }).join('');
  },

  // ── Registrar contacto rápido desde el dashboard ──────────────────────────
  _registrarContacto(clienteId) {
    document.getElementById('seguimientoClienteId').value   = clienteId;
    document.getElementById('seguimientoTipo').value        = 'llamada';
    document.getElementById('seguimientoDescripcion').value = '';
    document.getElementById('seguimientoRecordatorio').value = '';
    UI.openModal('modalSeguimiento');
    // Al cerrar el modal, refrescar el dashboard
    const modal = document.getElementById('modalSeguimiento');
    modal.addEventListener('hidden.bs.modal', () => {
      setTimeout(() => Dashboard.render(), 300);
    }, { once: true });
  },

  async render() {
    this._destroyCharts();
    const content = document.getElementById('pageContent');
    content.innerHTML = UI.spinner('Cargando dashboard...');

    const [clientes, proyectos, pagos, seguimientos] = await Promise.all([
      DB.getAll(DB.STORES.clientes),
      DB.getAll(DB.STORES.proyectos),
      DB.getAll(DB.STORES.pagos),
      DB.getAll(DB.STORES.seguimientos)
    ]);

    const session = Auth.getSession();

    // ── Métricas globales ──────────────────────────────────────────────────
    const totalClientes     = clientes.length;
    const enConstruccion    = clientes.filter(c => c.estado === 'construccion').length;
    const firmados          = clientes.filter(c => ['firmado','construccion','finalizado'].includes(c.estado)).length;
    const finalizados       = clientes.filter(c => c.estado === 'finalizado').length;
    const perdidos          = clientes.filter(c => c.estado === 'perdido').length;

    const totalEsperado     = pagos.reduce((s, p) => s + (p.valorTotal  || 0), 0);
    const totalRecibido     = pagos.reduce((s, p) => s + (p.valorPagado || 0), 0);
    const totalPendiente    = totalEsperado - totalRecibido;
    const pctCobrado        = totalEsperado > 0 ? Math.round(totalRecibido / totalEsperado * 100) : 0;
    const etapasPendientes  = pagos.filter(p => p.estado !== 'pagado').length;

    // Clientes sin seguimiento > 7 días
    const sinSeguimiento = clientes.filter(c => {
      if (['finalizado','perdido'].includes(c.estado)) return false;
      const ref  = c.ultimoSeguimiento || c.createdAt;
      return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) > 7;
    });

    // Por estado
    const porEstado = {};
    clientes.forEach(c => { porEstado[c.estado] = (porEstado[c.estado] || 0) + 1; });

    // Proyectos con entrega próxima (≤ 30 días)
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const entregasProximas = proyectos.filter(p => {
      if (!p.fechaEntrega) return false;
      const dias = Math.round((new Date(p.fechaEntrega + 'T00:00:00') - hoy) / 86400000);
      return dias >= 0 && dias <= 30;
    }).sort((a, b) => new Date(a.fechaEntrega + 'T00:00:00') - new Date(b.fechaEntrega + 'T00:00:00'));

    // Pagos pendientes por cliente (top 5)
    const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
    const pagosPendientesPorCliente = {};
    pagos.filter(p => p.estado !== 'pagado').forEach(p => {
      if (!pagosPendientesPorCliente[p.clienteId]) pagosPendientesPorCliente[p.clienteId] = 0;
      pagosPendientesPorCliente[p.clienteId] += (p.valorTotal - p.valorPagado);
    });
    const topDeudores = Object.entries(pagosPendientesPorCliente)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

    // ── SVG ring helper ────────────────────────────────────────────────────
    const r = 54, circ = 2 * Math.PI * r;
    const dash = circ * pctCobrado / 100;

    // ── Pipeline de ventas (orden de etapas) ──────────────────────────────
    const pipelineEstados = [
      { key: 'nuevo',        label: 'Nuevos',         color: '#10b981', icon: 'bi-circle' },
      { key: 'cotizado',     label: 'Cotizados',       color: '#3b82f6', icon: 'bi-file-text' },
      { key: 'negociacion',  label: 'Negociación',     color: '#f59e0b', icon: 'bi-arrow-left-right' },
      { key: 'firmado',      label: 'Firmados',        color: '#f97316', icon: 'bi-pen' },
      { key: 'construccion', label: 'En Obra',         color: '#ef4444', icon: 'bi-hammer' },
      { key: 'finalizado',   label: 'Finalizados',     color: '#06b6d4', icon: 'bi-check-circle' },
      { key: 'perdido',      label: 'Perdidos',        color: '#94a3b8', icon: 'bi-x-circle' }
    ];
    const pipelineMax = Math.max(1, ...pipelineEstados.map(e => porEstado[e.key] || 0));

    // ── Top 5 clientes para resumen financiero ────────────────────────────
    const top5Financiero = clientes
      .map(c => {
        const cp = pagos.filter(p => p.clienteId === c.id);
        const rec = cp.reduce((s, p) => s + (p.valorPagado || 0), 0);
        const pen = cp.reduce((s, p) => s + Math.max(0, (p.valorTotal || 0) - (p.valorPagado || 0)), 0);
        return { c, rec, pen, total: rec + pen };
      })
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    const finMax = Math.max(1, ...top5Financiero.map(x => x.total));

    content.innerHTML = `
      <div class="fade-in">

        <!-- ══════════════════════════════════════════════════════════════════
             HERO HEADER — gradient + animated overlay + mini stat chips
             ══════════════════════════════════════════════════════════════════ -->
        <div class="dashboard-hero mb-4" style="position:relative;overflow:hidden;border-radius:20px;">

          <style>
            @keyframes kpiEntrance {
              from { opacity:0; transform:translateY(20px) scale(0.96); }
              to   { opacity:1; transform:translateY(0)    scale(1); }
            }
          </style>

          <div style="position:relative;z-index:1;">
            <!-- Greeting row -->
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
              <div>
                <h3 class="fw-bold mb-1 text-white" style="font-size:1.6rem;letter-spacing:-0.3px;">
                  ${saludo}, ${localStorage.getItem('clienteapp_nombre_display') || (session?.nombre === 'Administrador' ? 'George' : (session?.nombre?.split(' ')[0] || 'George'))} 👋
                </h3>
                <p class="mb-0 text-white opacity-75 small">
                  <i class="bi bi-calendar3 me-1"></i>
                  ${new Date().toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                </p>
              </div>
              <div class="d-flex gap-2 flex-wrap">
                ${(() => {
                  const ll = this._calcularLlamadasHoy(clientes, proyectos, pagos, seguimientos);
                  const urg = ll.filter(l => l.prioridad === 'urgente').length;
                  return ll.length > 0 ? `
                    <div class="hero-pill ${urg > 0 ? 'hero-pill-warn' : ''}"
                         style="cursor:pointer;" onclick="document.querySelector('.llamadas-hoy-card')?.scrollIntoView({behavior:'smooth'})">
                      <i class="bi bi-telephone-fill me-1"></i>${ll.length} llamada${ll.length !== 1 ? 's' : ''} pendiente${ll.length !== 1 ? 's' : ''}
                    </div>` : '';
                })()}
              </div>
            </div>

            <!-- Mini stat chips row -->
            <div class="d-flex gap-3 flex-wrap">
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);
                          border:1px solid rgba(255,255,255,0.2);border-radius:14px;
                          padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:130px;">
                <div style="width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,0.35);
                            display:flex;align-items:center;justify-content:center;">
                  <i class="bi bi-people-fill text-white" style="font-size:15px;"></i>
                </div>
                <div>
                  <div class="fw-bold text-white" style="font-size:18px;line-height:1.1;">${totalClientes}</div>
                  <div class="text-white opacity-70" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Clientes</div>
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);
                          border:1px solid rgba(255,255,255,0.2);border-radius:14px;
                          padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:130px;">
                <div style="width:34px;height:34px;border-radius:10px;background:rgba(239,68,68,0.35);
                            display:flex;align-items:center;justify-content:center;">
                  <i class="bi bi-hammer text-white" style="font-size:15px;"></i>
                </div>
                <div>
                  <div class="fw-bold text-white" style="font-size:18px;line-height:1.1;">${enConstruccion}</div>
                  <div class="text-white opacity-70" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;">En Obra</div>
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);
                          border:1px solid rgba(255,255,255,0.2);border-radius:14px;
                          padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:160px;">
                <div style="width:34px;height:34px;border-radius:10px;background:rgba(16,185,129,0.35);
                            display:flex;align-items:center;justify-content:center;">
                  <i class="bi bi-cash-coin text-white" style="font-size:15px;"></i>
                </div>
                <div>
                  <div class="fw-bold text-white" style="font-size:15px;line-height:1.1;">${UI.money(totalRecibido)}</div>
                  <div class="text-white opacity-70" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Recaudado</div>
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.12);backdrop-filter:blur(10px);
                          border:1px solid rgba(255,255,255,0.2);border-radius:14px;
                          padding:10px 18px;display:flex;align-items:center;gap:10px;min-width:160px;">
                <div style="width:34px;height:34px;border-radius:10px;background:rgba(245,158,11,0.35);
                            display:flex;align-items:center;justify-content:center;">
                  <i class="bi bi-hourglass-split text-white" style="font-size:15px;"></i>
                </div>
                <div>
                  <div class="fw-bold text-white" style="font-size:15px;line-height:1.1;">${UI.money(totalPendiente)}</div>
                  <div class="text-white opacity-70" style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;">Pendiente</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             ALERTAS
             ══════════════════════════════════════════════════════════════════ -->
        ${sinSeguimiento.length > 0 ? `
          <div class="alert alert-warning alert-dismissible fade show d-flex align-items-start gap-3 mb-4 shadow-sm" role="alert">
            <i class="bi bi-exclamation-triangle-fill fs-4 flex-shrink-0 mt-1"></i>
            <div>
              <strong>${sinSeguimiento.length} cliente${sinSeguimiento.length > 1 ? 's' : ''} sin seguimiento</strong>
              en más de 7 días:
              ${sinSeguimiento.slice(0, 3).map(c =>
                `<a href="#" class="alert-link fw-semibold" onclick="Clientes.abrirExpediente('${c.id}'); return false;">${UI.escapeHTML(c.nombre.split(' ')[0])}</a>`
              ).join(', ')}
              ${sinSeguimiento.length > 3 ? ` y ${sinSeguimiento.length - 3} más` : ''}
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>` : ''}

        <!-- ══════════════════════════════════════════════════════════════════
             KPI CARDS — glassmorphism style
             ══════════════════════════════════════════════════════════════════ -->
        <div class="row g-3 mb-4">
          ${this._kpiCard('bi-people-fill', 'primary', totalClientes, 'Total Clientes', `${firmados} firmados`, 0)}
          ${this._kpiCard('bi-hammer', 'danger', enConstruccion, 'En Construcción', `${finalizados} finalizados`, 1)}
          ${this._kpiCard('bi-hourglass-split', 'warning', etapasPendientes, 'Pagos Pendientes', `${UI.money(totalPendiente)} por cobrar`, 2)}
          ${this._kpiCard('bi-cash-coin', 'success', UI.money(totalRecibido), 'Total Recaudado', `${pctCobrado}% del total`, 3)}
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             A QUIÉN LLAMAR HOY
             ══════════════════════════════════════════════════════════════════ -->
        ${(() => {
          const llamadas = this._calcularLlamadasHoy(clientes, proyectos, pagos, seguimientos);
          const urgentes    = llamadas.filter(l => l.prioridad === 'urgente').length;
          const importantes = llamadas.filter(l => l.prioridad === 'importante').length;
          const rutinarios  = llamadas.filter(l => l.prioridad === 'rutinario').length;
          return `
          <div class="llamadas-hoy-card card border-0 shadow-sm mb-4" style="border-radius:18px;overflow:hidden;">
            <div class="p-4 pb-3" style="background:linear-gradient(135deg,#0f1f30,#1a3c5e);">
              <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="d-flex align-items-center gap-3">
                  <div style="width:44px;height:44px;border-radius:12px;
                              background:rgba(255,255,255,0.12);backdrop-filter:blur(8px);
                              display:flex;align-items:center;justify-content:center;
                              border:1px solid rgba(255,255,255,0.2);">
                    <i class="bi bi-telephone-fill text-white fs-5"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-white mb-0">A quién llamar hoy</h6>
                    <div class="text-white opacity-60" style="font-size:12px;">
                      ${llamadas.length === 0
                        ? 'Sin pendientes — ¡excelente trabajo!'
                        : `${llamadas.length} cliente${llamadas.length !== 1 ? 's' : ''} requieren atención`}
                    </div>
                  </div>
                </div>
                <div class="d-flex gap-2 flex-wrap">
                  ${urgentes > 0 ? `
                    <span style="background:rgba(239,68,68,0.2);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);
                                 border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;">
                      <i class="bi bi-exclamation-circle-fill me-1"></i>${urgentes} urgente${urgentes !== 1 ? 's' : ''}
                    </span>` : ''}
                  ${importantes > 0 ? `
                    <span style="background:rgba(245,158,11,0.2);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);
                                 border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;">
                      <i class="bi bi-exclamation-triangle-fill me-1"></i>${importantes} importante${importantes !== 1 ? 's' : ''}
                    </span>` : ''}
                  ${rutinarios > 0 ? `
                    <span style="background:rgba(59,130,246,0.2);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);
                                 border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700;">
                      <i class="bi bi-telephone-fill me-1"></i>${rutinarios} rutinario${rutinarios !== 1 ? 's' : ''}
                    </span>` : ''}
                </div>
              </div>
            </div>
            <div class="p-4" style="background:#fafbfc;max-height:520px;overflow-y:auto;">
              ${this._renderLlamadasHoy(llamadas)}
            </div>
          </div>`;
        })()}

        <!-- ══════════════════════════════════════════════════════════════════
             FILA 2 — Ring cobros | Pipeline ventas | Actividad reciente
             ══════════════════════════════════════════════════════════════════ -->
        <div class="row g-3 mb-4">

          <!-- Col 1: Circular progress ring -->
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm h-100" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-graph-up-arrow me-2 text-success"></i>Progreso de Cobros
                </h6>
              </div>
              <div class="card-body px-4 pb-4 d-flex flex-column align-items-center">
                <!-- SVG Ring -->
                <div style="margin:8px 0 16px;">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="${r}" fill="none" stroke="#e9ecef" stroke-width="12"/>
                    <circle cx="70" cy="70" r="${r}" fill="none" stroke="#10b981" stroke-width="12"
                      stroke-dasharray="${dash} ${circ}" stroke-dashoffset="${circ / 4}"
                      stroke-linecap="round" style="transition:stroke-dasharray 1.2s ease;"/>
                    <text x="70" y="65" text-anchor="middle" font-size="22" font-weight="800" fill="#10b981">${pctCobrado}%</text>
                    <text x="70" y="85" text-anchor="middle" font-size="11" fill="#94a3b8">cobrado</text>
                  </svg>
                </div>
                <!-- 3 mini stat boxes -->
                <div class="row g-2 w-100">
                  <div class="col-4">
                    <div class="rounded-3 p-2 text-center" style="background:#f0fdf4;border:1px solid #bbf7d0;">
                      <div class="fw-bold text-success" style="font-size:11px;">${UI.money(totalRecibido)}</div>
                      <div class="text-muted" style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;">Recibido</div>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="rounded-3 p-2 text-center" style="background:#fffbeb;border:1px solid #fde68a;">
                      <div class="fw-bold text-warning" style="font-size:11px;">${UI.money(totalPendiente)}</div>
                      <div class="text-muted" style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;">Pendiente</div>
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="rounded-3 p-2 text-center" style="background:#eff6ff;border:1px solid #bfdbfe;">
                      <div class="fw-bold text-primary" style="font-size:11px;">${UI.money(totalEsperado)}</div>
                      <div class="text-muted" style="font-size:9px;text-transform:uppercase;letter-spacing:.4px;">Total</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Col 2: Pipeline de ventas -->
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm h-100" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-funnel-fill me-2 text-primary"></i>Pipeline de Ventas
                </h6>
              </div>
              <div class="card-body px-4 pb-4">
                ${totalClientes === 0
                  ? '<p class="text-muted text-center py-3 mb-0">Sin clientes registrados</p>'
                  : pipelineEstados.filter(e => (porEstado[e.key] || 0) > 0).map((e, idx) => {
                      const count = porEstado[e.key] || 0;
                      const pct   = Math.round(count / pipelineMax * 100);
                      return `
                        <div class="mb-2" style="animation:fadeInUp 0.3s ease ${idx * 0.06}s both;">
                          <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small fw-semibold d-flex align-items-center gap-2">
                              <i class="bi ${e.icon}" style="color:${e.color};font-size:12px;"></i>
                              ${e.label}
                            </span>
                            <span class="fw-bold small" style="color:${e.color};">${count}</span>
                          </div>
                          <div style="height:8px;border-radius:4px;background:#f1f5f9;overflow:hidden;">
                            <div style="height:100%;width:0%;border-radius:4px;background:${e.color};
                                        transition:width 1s ease;box-shadow:0 0 6px ${e.color}55;"
                                 data-width="${pct}%"></div>
                          </div>
                        </div>`;
                    }).join('')
                }
              </div>
            </div>
          </div>

          <!-- Col 3: Actividad reciente (timeline) -->
          <div class="col-lg-4">
            <div class="card border-0 shadow-sm h-100" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-activity me-2" style="color:#8e44ad;"></i>Actividad Reciente
                </h6>
              </div>
              <div class="card-body px-4 pb-4">
                ${this._seguimientosRecientes(seguimientos, clienteMap)}
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             FILA 3 — Saldos pendientes + Entregas próximas (enhanced)
             ══════════════════════════════════════════════════════════════════ -->
        <div class="row g-3 mb-4">

          <!-- Saldos pendientes con borde de color y avatar gradiente -->
          <div class="col-lg-6">
            <div class="card border-0 shadow-sm h-100" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-cash-stack me-2 text-warning"></i>Saldos Pendientes
                </h6>
                <a href="#" class="small text-primary text-decoration-none fw-semibold" onclick="App.navigate('pagos'); return false;">
                  Ver pagos <i class="bi bi-arrow-right"></i>
                </a>
              </div>
              <div class="card-body px-4 pb-4">
                ${topDeudores.length === 0
                  ? `<div class="text-center py-4 text-muted">
                       <i class="bi bi-check-circle-fill text-success fs-2 d-block mb-2"></i>
                       <small>¡Todo al día! Sin saldos pendientes</small>
                     </div>`
                  : topDeudores.map(([cId, monto], idx) => {
                      const c = clienteMap[cId];
                      if (!c) return '';
                      const cPagos  = pagos.filter(p => p.clienteId === cId);
                      const total   = cPagos.reduce((s, p) => s + (p.valorTotal || 0), 0);
                      const pagado  = cPagos.reduce((s, p) => s + (p.valorPagado || 0), 0);
                      const pct     = total > 0 ? Math.round(pagado / total * 100) : 0;
                      const borderColor = pct >= 70 ? '#10b981' : pct >= 30 ? '#f59e0b' : '#ef4444';
                      const avatarGrad  = pct >= 70
                        ? 'linear-gradient(135deg,#10b981,#34d399)'
                        : pct >= 30
                          ? 'linear-gradient(135deg,#f59e0b,#fcd34d)'
                          : 'linear-gradient(135deg,#ef4444,#f87171)';
                      return `
                        <div class="d-flex align-items-center gap-3 py-2 border-bottom"
                             onclick="Clientes.abrirExpediente('${c.id}')" style="cursor:pointer;
                             border-left:3px solid ${borderColor} !important;padding-left:10px;
                             animation:fadeInUp 0.3s ease ${idx * 0.07}s both;">
                          <div class="flex-shrink-0 d-flex align-items-center justify-content-center fw-bold text-white"
                               style="width:38px;height:38px;border-radius:12px;font-size:13px;
                                      background:${avatarGrad};box-shadow:0 2px 8px ${borderColor}44;">
                            ${UI.initials(c.nombre)}
                          </div>
                          <div class="flex-grow-1 min-w-0">
                            <div class="fw-semibold small text-truncate">${UI.escapeHTML(c.nombre)}</div>
                            <div style="height:4px;border-radius:2px;background:#f1f5f9;margin-top:4px;overflow:hidden;">
                              <div style="height:100%;width:${pct}%;background:${borderColor};
                                          border-radius:2px;transition:width 1s ease;"></div>
                            </div>
                          </div>
                          <div class="text-end flex-shrink-0">
                            <div class="fw-bold small" style="color:#ef4444;">${UI.formatCurrency(monto)}</div>
                            <div class="text-muted" style="font-size:10px;">${pct}% pagado</div>
                          </div>
                        </div>`;
                    }).join('')
                }
              </div>
            </div>
          </div>

          <!-- Entregas próximas con countdown circle -->
          <div class="col-lg-6">
            <div class="card border-0 shadow-sm h-100" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-calendar-event me-2 text-info"></i>Entregas Próximas (30 días)
                </h6>
                <span class="badge bg-info text-dark">${entregasProximas.length}</span>
              </div>
              <div class="card-body px-4 pb-4">
                ${entregasProximas.length === 0
                  ? `<div class="text-center py-4 text-muted">
                       <i class="bi bi-calendar-check fs-2 d-block mb-2 opacity-40"></i>
                       <small>Sin entregas programadas en los próximos 30 días</small>
                     </div>`
                  : entregasProximas.map((p, idx) => {
                      const c    = clienteMap[p.clienteId];
                      const dias = Math.round((new Date(p.fechaEntrega + 'T00:00:00') - hoy) / 86400000);
                      const ringColor = dias <= 7 ? '#ef4444' : dias <= 14 ? '#f59e0b' : '#10b981';
                      const rr = 16, cc = 2 * Math.PI * rr;
                      const dd = cc * Math.max(0, (30 - dias)) / 30;
                      return `
                        <div class="d-flex align-items-center gap-3 py-2 border-bottom"
                             onclick="Clientes.abrirExpediente('${p.clienteId}')" style="cursor:pointer;
                             animation:fadeInUp 0.3s ease ${idx * 0.07}s both;">
                          <!-- Countdown circle -->
                          <div class="flex-shrink-0">
                            <svg width="44" height="44" viewBox="0 0 44 44">
                              <circle cx="22" cy="22" r="${rr}" fill="none" stroke="#e9ecef" stroke-width="4"/>
                              <circle cx="22" cy="22" r="${rr}" fill="none" stroke="${ringColor}" stroke-width="4"
                                stroke-dasharray="${dd} ${cc}" stroke-dashoffset="${cc / 4}"
                                stroke-linecap="round"/>
                              <text x="22" y="26" text-anchor="middle" font-size="10" font-weight="800" fill="${ringColor}">${dias}</text>
                            </svg>
                          </div>
                          <div class="flex-grow-1 min-w-0">
                            <div class="fw-semibold small text-truncate">${c ? UI.escapeHTML(c.nombre) : 'Cliente'}</div>
                            <div class="text-muted" style="font-size:11px;">
                              <i class="bi bi-house me-1"></i>${UI.escapeHTML(p.modelo)} · ${UI.formatDate(p.fechaEntrega)}
                            </div>
                          </div>
                          <span class="badge" style="background:${ringColor}18;color:${ringColor};
                                border:1px solid ${ringColor}44;font-size:10px;border-radius:8px;padding:3px 8px;">
                            ${dias === 0 ? '¡Hoy!' : dias <= 7 ? 'Urgente' : 'Próximo'}
                          </span>
                        </div>`;
                    }).join('')
                }
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             FILA 4 — Resumen financiero (CSS bars) + Acciones rápidas
             ══════════════════════════════════════════════════════════════════ -->
        <div class="row g-3">

          <!-- Resumen financiero — horizontal CSS bar chart -->
          <div class="col-lg-7">
            <div class="card border-0 shadow-sm" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex align-items-center justify-content-between">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-bar-chart-horizontal-fill me-2 text-primary"></i>Resumen Financiero (Top 5)
                </h6>
                <a href="#" class="small text-primary text-decoration-none fw-semibold" onclick="App.navigate('pagos'); return false;">
                  Ver pagos <i class="bi bi-arrow-right"></i>
                </a>
              </div>
              <div class="card-body px-4 pb-4">
                ${top5Financiero.length === 0
                  ? `<div class="text-center py-4 text-muted">
                       <i class="bi bi-bar-chart fs-2 d-block mb-2 opacity-40"></i>
                       <small>Sin datos financieros aún</small>
                     </div>`
                  : top5Financiero.map((x, idx) => {
                      const recPct = Math.round(x.rec / finMax * 100);
                      const penPct = Math.round(x.pen / finMax * 100);
                      return `
                        <div class="mb-3" style="animation:fadeInUp 0.3s ease ${idx * 0.07}s both;">
                          <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small fw-semibold text-truncate" style="max-width:160px;">${UI.escapeHTML(x.c.nombre)}</span>
                            <span class="small text-muted">${UI.formatCurrency(x.total)}</span>
                          </div>
                          <!-- Recibido bar -->
                          <div class="d-flex align-items-center gap-2 mb-1">
                            <span style="width:60px;font-size:10px;color:#10b981;text-align:right;flex-shrink:0;">Recibido</span>
                            <div style="flex:1;height:10px;border-radius:5px;background:#f1f5f9;overflow:hidden;">
                              <div style="height:100%;width:0%;border-radius:5px;
                                          background:linear-gradient(90deg,#10b981,#34d399);
                                          transition:width 1s ease;" data-width="${recPct}%"></div>
                            </div>
                            <span style="width:70px;font-size:10px;color:#10b981;flex-shrink:0;">${UI.formatCurrency(x.rec)}</span>
                          </div>
                          <!-- Pendiente bar -->
                          <div class="d-flex align-items-center gap-2">
                            <span style="width:60px;font-size:10px;color:#f59e0b;text-align:right;flex-shrink:0;">Pendiente</span>
                            <div style="flex:1;height:10px;border-radius:5px;background:#f1f5f9;overflow:hidden;">
                              <div style="height:100%;width:0%;border-radius:5px;
                                          background:linear-gradient(90deg,#f59e0b,#fcd34d);
                                          transition:width 1s ease 0.2s;" data-width="${penPct}%"></div>
                            </div>
                            <span style="width:70px;font-size:10px;color:#f59e0b;flex-shrink:0;">${UI.formatCurrency(x.pen)}</span>
                          </div>
                        </div>`;
                    }).join('')
                }
              </div>
            </div>
          </div>

          <!-- Acciones rápidas -->
          <div class="col-lg-5">
            <div class="card border-0 shadow-sm" style="border-radius:18px;">
              <div class="card-header bg-white border-0 pt-4 pb-2 px-4">
                <h6 class="fw-bold mb-0">
                  <i class="bi bi-lightning-charge-fill me-2 text-warning"></i>Acciones Rápidas
                </h6>
              </div>
              <div class="card-body px-4 pb-4">
                <div class="row g-3">
                  <div class="col-6">
                    <button onclick="App.navigate('clientes')"
                            class="w-100 border-0 rounded-3 p-3 d-flex flex-column align-items-center gap-2 text-white fw-semibold"
                            style="background:linear-gradient(135deg,#2d6a9f,#5a9fd4);
                                   cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;min-height:90px;"
                            onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(45,106,159,0.4)'"
                            onmouseleave="this.style.transform='';this.style.boxShadow=''">
                      <i class="bi bi-person-plus-fill" style="font-size:24px;"></i>
                      <span style="font-size:13px;">Nuevo Cliente</span>
                    </button>
                  </div>
                  <div class="col-6">
                    <button onclick="App.navigate('pagos')"
                            class="w-100 border-0 rounded-3 p-3 d-flex flex-column align-items-center gap-2 text-white fw-semibold"
                            style="background:linear-gradient(135deg,#10b981,#34d399);
                                   cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;min-height:90px;"
                            onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(16,185,129,0.4)'"
                            onmouseleave="this.style.transform='';this.style.boxShadow=''">
                      <i class="bi bi-cash-coin" style="font-size:24px;"></i>
                      <span style="font-size:13px;">Ver Pagos</span>
                    </button>
                  </div>
                  <div class="col-6">
                    <button onclick="App.navigate('proyectos')"
                            class="w-100 border-0 rounded-3 p-3 d-flex flex-column align-items-center gap-2 text-white fw-semibold"
                            style="background:linear-gradient(135deg,#f97316,#fb923c);
                                   cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;min-height:90px;"
                            onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(249,115,22,0.4)'"
                            onmouseleave="this.style.transform='';this.style.boxShadow=''">
                      <i class="bi bi-building-fill-gear" style="font-size:24px;"></i>
                      <span style="font-size:13px;">Ver Proyectos</span>
                    </button>
                  </div>
                  <div class="col-6">
                    <button onclick="App.navigate('tareas')"
                            class="w-100 border-0 rounded-3 p-3 d-flex flex-column align-items-center gap-2 text-white fw-semibold"
                            style="background:linear-gradient(135deg,#8e44ad,#a855f7);
                                   cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;min-height:90px;"
                            onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px rgba(142,68,173,0.4)'"
                            onmouseleave="this.style.transform='';this.style.boxShadow=''">
                      <i class="bi bi-check2-square" style="font-size:24px;"></i>
                      <span style="font-size:13px;">Ir a Tareas</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>`;

    // Animar contadores y barras de progreso
    this._animarElementos();
  },

  // ── KPI Card — glassmorphism style ────────────────────────────────────────
  _kpiCard(icon, color, valor, label, sub, delay = 0) {
    const palette = {
      primary: { grad: 'linear-gradient(135deg,#2d6a9f,#5a9fd4)', light: '#eff6ff', border: '#3b82f6', trend: '#3b82f6' },
      danger:  { grad: 'linear-gradient(135deg,#dc3545,#f07080)', light: '#fef2f2', border: '#ef4444', trend: '#ef4444' },
      warning: { grad: 'linear-gradient(135deg,#f59e0b,#fcd34d)', light: '#fffbeb', border: '#f59e0b', trend: '#f59e0b' },
      success: { grad: 'linear-gradient(135deg,#28a745,#6ee7b7)', light: '#f0fdf4', border: '#10b981', trend: '#10b981' },
      info:    { grad: 'linear-gradient(135deg,#17a2b8,#67e8f9)', light: '#ecfeff', border: '#06b6d4', trend: '#06b6d4' }
    };
    const p = palette[color] || palette.primary;
    return `
      <div class="col-6 col-lg-3">
        <div style="background:white;border-radius:18px;padding:20px;position:relative;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.07);border-bottom:3px solid ${p.border};
                    animation:kpiEntrance 0.5s ease ${delay * 0.1}s both;
                    transition:transform 0.2s,box-shadow 0.2s;"
             onmouseenter="this.style.transform='translateY(-4px)';this.style.boxShadow='0 8px 28px rgba(0,0,0,0.12)'"
             onmouseleave="this.style.transform='';this.style.boxShadow='0 2px 12px rgba(0,0,0,0.07)'">

          <!-- Colored icon box top-right -->
          <div style="position:absolute;top:16px;right:16px;width:42px;height:42px;border-radius:12px;
                      background:${p.grad};display:flex;align-items:center;justify-content:center;
                      box-shadow:0 4px 12px ${p.border}44;">
            <i class="bi ${icon} text-white" style="font-size:18px;"></i>
          </div>

          <!-- Large bold number -->
          <div style="font-size:clamp(1.4rem,3vw,2rem);font-weight:900;color:#1e293b;
                      line-height:1.1;margin-bottom:4px;padding-right:52px;">${valor}</div>

          <!-- Label -->
          <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;
                      letter-spacing:.5px;margin-bottom:8px;">${label}</div>

          <!-- Trend indicator -->
          <div style="display:inline-flex;align-items:center;gap:4px;
                      background:${p.light};border-radius:20px;padding:3px 10px;">
            <i class="bi bi-arrow-up-right" style="color:${p.trend};font-size:11px;"></i>
            <span style="font-size:11px;font-weight:600;color:${p.trend};">${sub}</span>
          </div>
        </div>
      </div>`;
  },

  // ── Gráfico de estados ────────────────────────────────────────────────────
  _estadoChart(porEstado, total) {
    const estados = [
      { key: 'nuevo',        label: 'Nuevos',         color: '#10b981', icon: 'bi-circle-fill' },
      { key: 'cotizado',     label: 'Cotizados',       color: '#3b82f6', icon: 'bi-circle-fill' },
      { key: 'negociacion',  label: 'Negociación',     color: '#f59e0b', icon: 'bi-circle-fill' },
      { key: 'firmado',      label: 'Firmados',        color: '#f97316', icon: 'bi-circle-fill' },
      { key: 'construccion', label: 'En Construcción', color: '#ef4444', icon: 'bi-circle-fill' },
      { key: 'finalizado',   label: 'Finalizados',     color: '#06b6d4', icon: 'bi-circle-fill' },
      { key: 'perdido',      label: 'Perdidos',        color: '#94a3b8', icon: 'bi-circle-fill' }
    ];

    return estados
      .filter(e => (porEstado[e.key] || 0) > 0)
      .map(e => {
        const count = porEstado[e.key] || 0;
        const pct   = Math.round(count / total * 100);
        return `
          <div class="mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="small fw-semibold d-flex align-items-center gap-1">
                <i class="bi bi-circle-fill" style="color:${e.color};font-size:8px;"></i>
                ${e.label}
              </span>
              <span class="small text-muted">${count} <span class="text-muted fw-normal">(${pct}%)</span></span>
            </div>
            <div class="progress" style="height:8px;border-radius:4px;">
              <div class="progress-bar" role="progressbar"
                   style="width:0%;background:${e.color};border-radius:4px;transition:width 1s ease;"
                   data-width="${pct}%"></div>
            </div>
          </div>`;
      }).join('');
  },

  // ── Últimos clientes ──────────────────────────────────────────────────────
  _ultimosClientes(clientes) {
    const ultimos = [...clientes]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    if (ultimos.length === 0) {
      return `<div class="text-center py-4 text-muted">
        <i class="bi bi-people fs-2 d-block mb-2 opacity-40"></i>
        <small>Sin clientes registrados</small>
      </div>`;
    }

    return ultimos.map(c => `
      <div class="d-flex align-items-center gap-3 py-2 border-bottom"
           onclick="Clientes.abrirExpediente('${c.id}')" style="cursor:pointer;">
        <div class="cliente-avatar flex-shrink-0" style="width:36px;height:36px;font-size:13px;">
          ${UI.initials(c.nombre)}
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold small text-truncate">${UI.escapeHTML(c.nombre)}</div>
          <div class="text-muted" style="font-size:11px;">
            <i class="bi bi-telephone me-1"></i>${UI.escapeHTML(c.telefono) || '—'}
          </div>
        </div>
        <div class="d-flex flex-column align-items-end gap-1">
          ${UI.estadoBadge(c.estado)}
          <span class="text-muted" style="font-size:10px;">${UI.timeAgo(c.createdAt)}</span>
        </div>
      </div>`).join('');
  },

  // ── Seguimientos recientes ────────────────────────────────────────────────
  _seguimientosRecientes(seguimientos, clienteMap) {
    const recientes = [...seguimientos]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);

    if (recientes.length === 0) {
      return `<div class="text-center py-4 text-muted">
        <i class="bi bi-chat-dots fs-2 d-block mb-2 opacity-40"></i>
        <small>Sin seguimientos registrados aún</small>
      </div>`;
    }

    const tipoConfig = {
      llamada:      { icon: 'bi-telephone-fill',  color: '#2d6a9f', label: 'Llamada' },
      whatsapp:     { icon: 'bi-whatsapp',         color: '#25d366', label: 'WhatsApp' },
      visita:       { icon: 'bi-house-fill',       color: '#f97316', label: 'Visita' },
      reunion:      { icon: 'bi-people-fill',      color: '#8e44ad', label: 'Reunión' },
      nota:         { icon: 'bi-sticky-fill',      color: '#f59e0b', label: 'Nota' },
      recordatorio: { icon: 'bi-bell-fill',        color: '#ef4444', label: 'Recordatorio' }
    };

    return recientes.map(s => {
      const c   = clienteMap[s.clienteId];
      const cfg = tipoConfig[s.tipo] || tipoConfig.nota;
      return `
        <div class="d-flex align-items-start gap-3 py-2 border-bottom"
             onclick="Clientes.abrirExpediente('${s.clienteId}')" style="cursor:pointer;">
          <div class="flex-shrink-0 d-flex align-items-center justify-content-center rounded-circle"
               style="width:32px;height:32px;background:${cfg.color}20;">
            <i class="bi ${cfg.icon}" style="color:${cfg.color};font-size:13px;"></i>
          </div>
          <div class="flex-grow-1" style="min-width:0;overflow:hidden;">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-semibold small text-truncate" style="max-width:100%;">${c ? UI.escapeHTML(c.nombre.split(' ')[0] + ' ' + (c.nombre.split(' ')[1] || '')) : 'Cliente'}</span>
              <span class="badge rounded-pill flex-shrink-0" style="background:${cfg.color}20;color:${cfg.color};font-size:10px;">${cfg.label}</span>
            </div>
            <div class="text-muted" style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${UI.escapeHTML(s.descripcion)}</div>
          </div>
          <span class="text-muted flex-shrink-0 text-end" style="font-size:10px;white-space:nowrap;">${UI.timeAgo(s.createdAt)}</span>
        </div>`;
    }).join('');
  },

  // ── Animar barras y contadores ────────────────────────────────────────────
  _animarElementos() {
    // Barras de progreso con data-width
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll('[data-width]').forEach(el => {
          el.style.width = el.dataset.width;
        });
      }, 150);
    });

    // Contador animado del porcentaje
    document.querySelectorAll('.counter').forEach(el => {
      const target = parseInt(el.dataset.target) || 0;
      let current  = 0;
      const step   = Math.max(1, Math.round(target / 40));
      const timer  = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current + '%';
        if (current >= target) clearInterval(timer);
      }, 30);
    });
  }
};
