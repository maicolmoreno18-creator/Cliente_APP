/* ============================================
   ClienteAPP — Reporte Financiero (PDF)
   Resumen de comisiones, préstamos y bases para
   presentar al jefe. Multipágina tamaño carta.
   ============================================ */

window.ReporteFinanzas = {

  EMPRESA: {
    nombre: 'CONSTRUSOLUCIONES DEL META',
    lema:   'Casas Prefabricadas',
    logo:   'assets/img/logo-construsoluciones.png'
  },

  // ── Recopilar todos los datos financieros ─────────────────────────────────
  async _buildData() {
    const [proyectos, clientes, registros] = await Promise.all([
      DB.getAll(DB.STORES.proyectos),
      DB.getAll(DB.STORES.clientes),
      DB.getAll(DB.STORES.finanzas)
    ]);

    const comisionPct = (Opciones.get().comisionPct || 5) / 100;
    const pctLabel    = Opciones.get().comisionPct || 5;
    const clienteMap  = Object.fromEntries(clientes.map(c => [c.id, c]));

    const cobrosComision = registros.filter(r => r.tipo === 'comision');
    const prestamos      = registros.filter(r => r.tipo === 'prestamo');
    const abonos         = registros.filter(r => r.tipo === 'abono');
    const bases          = registros.filter(r => r.tipo === 'base');

    // Proyectos firmados
    const proyFirmados = proyectos.filter(p => {
      const c = clienteMap[p.clienteId];
      return c && ['firmado','construccion','finalizado'].includes(c.estado);
    });

    // Comisiones
    const comisiones = proyFirmados.map(p => {
      const c            = clienteMap[p.clienteId];
      const comisionTotal = (p.precio || 0) * comisionPct;
      const cobrado      = cobrosComision.filter(x => x.proyectoId === p.id).reduce((s, x) => s + (x.monto || 0), 0);
      const pendiente    = comisionTotal - cobrado;
      return {
        cliente:  c ? c.nombre : '—',
        modelo:   p.modelo || '—',
        precio:   p.precio || 0,
        comisionTotal, cobrado, pendiente,
        estado:   pendiente <= 0 ? 'Cobrada' : cobrado > 0 ? 'Parcial' : 'Pendiente'
      };
    });

    const totalComisionEsperada = comisiones.reduce((s, c) => s + c.comisionTotal, 0);
    const totalComisionCobrada  = cobrosComision.reduce((s, r) => s + (r.monto || 0), 0);
    const totalComisionPend     = totalComisionEsperada - totalComisionCobrada;

    // Préstamos
    const prestamosData = prestamos.map(p => {
      const abon = abonos.filter(a => a.prestamoId === p.id).reduce((s, a) => s + (a.monto || 0), 0);
      const saldo = Math.max(0, (p.monto || 0) - abon);
      return {
        descripcion: p.descripcion || '—',
        fecha:       p.fecha,
        prestado:    p.monto || 0,
        abonado:     abon,
        saldo,
        estado:      saldo <= 0 ? 'Pagado' : 'Pendiente'
      };
    });

    const totalPrestado = prestamos.reduce((s, r) => s + (r.monto || 0), 0);
    const totalAbonado  = abonos.reduce((s, r) => s + (r.monto || 0), 0);
    const deudaActual   = Math.max(0, totalPrestado - totalAbonado);

    // Bases
    const totalBases       = bases.reduce((s, r) => s + (r.monto || 0), 0);
    const basesDisponibles = bases.filter(r => r.destino === 'disponible').reduce((s, r) => s + (r.monto || 0), 0);

    // Balance
    const disponible = totalComisionCobrada + basesDisponibles - deudaActual;

    return {
      fecha: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
      pctLabel,
      comisiones, totalComisionEsperada, totalComisionCobrada, totalComisionPend,
      prestamosData, totalPrestado, totalAbonado, deudaActual,
      totalBases, basesDisponibles,
      disponible
    };
  },

  // ── Generar el HTML del reporte ───────────────────────────────────────────
  _buildHTML(d) {
    const esc = _escRF;
    const fmt = v => (v || v === 0)
      ? new Intl.NumberFormat('es-CO', { style:'currency', currency:'COP', minimumFractionDigits:0 }).format(v)
      : '—';

    const filasComision = d.comisiones.length > 0
      ? d.comisiones.map(c => `
          <tr>
            <td>${esc(c.cliente)}<div class="sub">${esc(c.modelo)}</div></td>
            <td class="num">${fmt(c.precio)}</td>
            <td class="num">${fmt(c.comisionTotal)}</td>
            <td class="num ok">${fmt(c.cobrado)}</td>
            <td class="num ${c.pendiente > 0 ? 'warn' : 'muted'}">${fmt(c.pendiente)}</td>
            <td class="center"><span class="badge ${c.estado === 'Cobrada' ? 'b-ok' : c.estado === 'Parcial' ? 'b-warn' : 'b-pend'}">${esc(c.estado)}</span></td>
          </tr>`).join('')
      : `<tr><td colspan="6" class="empty">Sin proyectos firmados</td></tr>`;

    const filasPrestamo = d.prestamosData.length > 0
      ? d.prestamosData.map(p => `
          <tr>
            <td>${esc(p.descripcion)}<div class="sub">${p.fecha ? UI.formatDate(p.fecha) : ''}</div></td>
            <td class="num">${fmt(p.prestado)}</td>
            <td class="num ok">${fmt(p.abonado)}</td>
            <td class="num ${p.saldo > 0 ? 'warn' : 'muted'}">${fmt(p.saldo)}</td>
            <td class="center"><span class="badge ${p.estado === 'Pagado' ? 'b-ok' : 'b-pend'}">${esc(p.estado)}</span></td>
          </tr>`).join('')
      : `<tr><td colspan="5" class="empty">Sin préstamos registrados</td></tr>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Reporte Financiero</title>
<style>
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  html { font-size: 15px; }
  body { font-family:'Segoe UI', Arial, sans-serif; color:#1a2533; background:#fff; line-height:1.5; }
  .rep { max-width: 740px; margin:0 auto; padding: 24px 30px; }

  /* Encabezado */
  .r-head { display:flex; align-items:center; justify-content:space-between; gap:16px;
            border-bottom:3px solid #1a3c8f; padding-bottom:14px; margin-bottom:18px; }
  .r-brand { display:flex; align-items:center; gap:14px; }
  .r-logo { width:120px; height:auto; }
  .r-brand h1 { font-size:18px; font-weight:800; color:#1a3c8f; }
  .r-brand .lema { font-size:12px; color:#64748b; }
  .r-doc { text-align:right; }
  .r-doc .t { background:#1a3c8f; color:#fff; font-size:15px; font-weight:800;
              padding:6px 16px; border-radius:6px; display:inline-block; margin-bottom:6px; }
  .r-doc .f { font-size:12px; color:#666; }

  /* Resumen KPIs */
  .kpis { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
  .kpi { border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; }
  .kpi .l { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; }
  .kpi .v { font-size:17px; font-weight:800; margin-top:3px; }
  .kpi.ok  { background:#f0fdf4; border-color:#bbf7d0; } .kpi.ok .v  { color:#16a34a; }
  .kpi.warn{ background:#fffbeb; border-color:#fde68a; } .kpi.warn .v{ color:#d97706; }
  .kpi.red { background:#fef2f2; border-color:#fecaca; } .kpi.red .v { color:#dc2626; }
  .kpi.blue{ background:#eff6ff; border-color:#bfdbfe; } .kpi.blue .v{ color:#1a3c8f; }

  /* Secciones */
  .sec { margin-bottom:20px; page-break-inside:auto; }
  .sec-t { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;
           color:#1a3c8f; border-bottom:1.5px solid #e2e8f0; padding-bottom:5px; margin-bottom:10px; }

  /* Tablas */
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  thead tr { background:#1a3c8f; color:#fff; }
  thead th { padding:7px 9px; text-align:left; font-size:10.5px; font-weight:700;
             text-transform:uppercase; letter-spacing:0.4px; }
  thead th.num, thead th.center { text-align:right; }
  thead th.center { text-align:center; }
  tbody tr { border-bottom:1px solid #eef2f6; page-break-inside:avoid; }
  tbody tr:nth-child(even) { background:#f8fafc; }
  td { padding:7px 9px; vertical-align:top; }
  td.num { text-align:right; font-weight:600; }
  td.center { text-align:center; }
  td .sub { font-size:10px; color:#94a3b8; font-weight:400; }
  td.ok { color:#16a34a; } td.warn { color:#d97706; } td.muted { color:#94a3b8; }
  td.empty { text-align:center; color:#94a3b8; font-style:italic; padding:14px; }
  .badge { font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; }
  .b-ok  { background:#d1fae5; color:#065f46; }
  .b-warn{ background:#fef3c7; color:#92400e; }
  .b-pend{ background:#f1f5f9; color:#475569; }
  tfoot td { padding:8px 9px; font-weight:800; border-top:2px solid #1a3c8f; font-size:12.5px; }
  tfoot td.num { text-align:right; }

  .footer { margin-top:24px; padding-top:10px; border-top:1px solid #e2e8f0;
            text-align:center; font-size:10px; color:#94a3b8; }
  @media print { @page { size: letter; margin: 12mm; } }
</style>
</head>
<body>
  <div class="rep">

    <div class="r-head">
      <div class="r-brand">
        <img class="r-logo" src="${this.EMPRESA.logo}" alt="Logo" onerror="this.style.display='none'" />
        <div>
          <h1>${esc(this.EMPRESA.nombre)}</h1>
          <div class="lema">${esc(this.EMPRESA.lema)}</div>
        </div>
      </div>
      <div class="r-doc">
        <div class="t">REPORTE FINANCIERO</div>
        <div class="f">Generado: ${esc(d.fecha)}</div>
      </div>
    </div>

    <!-- Resumen ejecutivo -->
    <div class="sec">
      <div class="sec-t">Resumen Ejecutivo</div>
      <div class="kpis">
        <div class="kpi ok"><div class="l">Comisiones Cobradas</div><div class="v">${fmt(d.totalComisionCobrada)}</div></div>
        <div class="kpi warn"><div class="l">Comisiones Pendientes</div><div class="v">${fmt(d.totalComisionPend)}</div></div>
        <div class="kpi red"><div class="l">Deuda Restante</div><div class="v">${fmt(d.deudaActual)}</div></div>
        <div class="kpi blue"><div class="l">Bases Recibidas</div><div class="v">${fmt(d.totalBases)}</div></div>
        <div class="kpi ok"><div class="l">Total Prestado</div><div class="v">${fmt(d.totalPrestado)}</div></div>
        <div class="kpi ${d.disponible >= 0 ? 'ok' : 'red'}"><div class="l">${d.disponible >= 0 ? 'Disponible' : 'Déficit'}</div><div class="v">${fmt(Math.abs(d.disponible))}</div></div>
      </div>
    </div>

    <!-- Comisiones -->
    <div class="sec">
      <div class="sec-t">Comisiones por Proyecto (${esc(String(d.pctLabel))}%)</div>
      <table>
        <thead><tr>
          <th>Cliente / Proyecto</th>
          <th class="num">Valor Casa</th>
          <th class="num">Comisión</th>
          <th class="num">Cobrado</th>
          <th class="num">Pendiente</th>
          <th class="center">Estado</th>
        </tr></thead>
        <tbody>${filasComision}</tbody>
        <tfoot><tr>
          <td>TOTALES</td>
          <td class="num"></td>
          <td class="num">${fmt(d.totalComisionEsperada)}</td>
          <td class="num">${fmt(d.totalComisionCobrada)}</td>
          <td class="num">${fmt(d.totalComisionPend)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>

    <!-- Préstamos -->
    <div class="sec">
      <div class="sec-t">Préstamos y Abonos</div>
      <table>
        <thead><tr>
          <th>Descripción</th>
          <th class="num">Prestado</th>
          <th class="num">Abonado</th>
          <th class="num">Saldo</th>
          <th class="center">Estado</th>
        </tr></thead>
        <tbody>${filasPrestamo}</tbody>
        <tfoot><tr>
          <td>TOTALES</td>
          <td class="num">${fmt(d.totalPrestado)}</td>
          <td class="num">${fmt(d.totalAbonado)}</td>
          <td class="num">${fmt(d.deudaActual)}</td>
          <td></td>
        </tr></tfoot>
      </table>
    </div>

    <div class="footer">ClienteApp · Reporte generado automáticamente · Desarrollado por OracleTech (Ing. George Moreno)</div>
  </div>
</body>
</html>`;
  },

  // ── Imprimir el reporte ────────────────────────────────────────────────────
  async imprimir() {
    const d = await this._buildData();
    const html = this._buildHTML(d);
    try {
      const win = window.open('', '_blank', 'width=860,height=700');
      if (!win) { UI.toast('El navegador bloqueó la ventana emergente.', 'warning', 7000); return; }
      win.document.write(html); win.document.close();
      let impreso = false;
      const lanzar = () => { if (impreso) return; impreso = true; try { win.focus(); win.print(); } catch (e) {} };
      win.addEventListener('load', lanzar);
      if (win.document.readyState === 'complete') setTimeout(lanzar, 500);
      else setTimeout(lanzar, 1000);
    } catch (err) {
      console.error('[ReporteFinanzas] Error al imprimir:', err);
      UI.toast('Error al generar el reporte', 'danger');
    }
  },

  // ── Descargar el reporte en PDF (multipágina) ─────────────────────────────
  async descargarPDF() {
    const jsPDFAvail = !!(window.jspdf?.jsPDF || window.jsPDF);
    const h2cAvail   = !!window.html2canvas;
    if (!jsPDFAvail || !h2cAvail) {
      UI.toast('Preparando generador de PDF...', 'info', 3000);
      try {
        if (!jsPDFAvail && window.PrintDoc?._cargarJsPDF) await PrintDoc._cargarJsPDF();
        if (!h2cAvail   && window.PrintDoc?._cargarHtml2Canvas) await PrintDoc._cargarHtml2Canvas();
      } catch (e) {
        UI.toast('No se pudo cargar la librería de PDF. Verifica tu conexión.', 'danger', 7000);
        return;
      }
    }

    UI.toast('Generando reporte...', 'info', 2500);

    try {
      const d = await this._buildData();
      const html = this._buildHTML(d);
      const fileName = 'Reporte_Financiero_' + new Date().toISOString().split('T')[0] + '.pdf';

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);
      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      iDoc.open(); iDoc.write(html); iDoc.close();

      await new Promise(resolve => {
        if (iframe.contentDocument.readyState === 'complete') resolve();
        else { iframe.onload = resolve; setTimeout(resolve, 1200); }
      });
      // Esperar al logo
      await new Promise(resolve => {
        const imgs = [...iframe.contentDocument.images];
        if (imgs.length === 0) { resolve(); return; }
        let pend = imgs.filter(i => !i.complete).length;
        if (pend === 0) { resolve(); return; }
        const listo = () => { pend--; if (pend <= 0) resolve(); };
        imgs.forEach(i => { if (!i.complete) { i.addEventListener('load', listo, {once:true}); i.addEventListener('error', listo, {once:true}); } });
        setTimeout(resolve, 2500);
      });
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
        width: 794, windowWidth: 794, logging: false
      });
      document.body.removeChild(iframe);

      const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
      const pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;

      // Paginación: cortar el canvas en trozos del alto de una página
      let remainH = imgH, yOffset = margin, pagina = 0;
      while (remainH > 0) {
        const sliceH = Math.min(remainH, pageH - margin * 2);
        const srcY   = (imgH - remainH) * (canvas.height / imgH);
        const srcH   = sliceH * (canvas.height / imgH);
        const sc = document.createElement('canvas');
        sc.width = canvas.width; sc.height = srcH;
        sc.getContext('2d').drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
        if (pagina > 0) pdf.addPage();
        pdf.addImage(sc.toDataURL('image/jpeg', 0.95), 'JPEG', margin, yOffset, imgW, sliceH);
        remainH -= sliceH; pagina++;
      }

      pdf.save(fileName);
      UI.toast(`Reporte descargado: ${fileName}`, 'success');
    } catch (err) {
      console.error('[ReporteFinanzas] Error al generar PDF:', err);
      UI.toast('Error al generar el PDF. Usa "Imprimir" y guarda como PDF.', 'warning', 8000);
    }
  }
};

// ── Helper de escape ───────────────────────────────────────────────────────────
function _escRF(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
