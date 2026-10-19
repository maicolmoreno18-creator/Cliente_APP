/* ============================================
   ClienteAPP — Recibos de Pago (PDF / Impresión)
   Comprobante por abono individual o por etapa.
   Empresa: Construsoluciones del Meta
   ============================================ */

window.Recibos = {

  // ── Datos fijos de la empresa ─────────────────────────────────────────────
  EMPRESA: {
    nombre:    'CONSTRUSOLUCIONES DEL META',
    lema:      'Casas Prefabricadas',
    nit:       'NIT 79.715.791-4',
    telefono:  'Tel: 314 359 2700',
    direccion: 'Cra 1 #18-18, a 300 m del terminal de transporte hacia la avenida Catama',
    logo:      'assets/img/logo-construsoluciones.png'
  },

  // Sello de la empresa (se estampa en el PDF sobre la firma)
  SELLO: 'assets/img/sello-construsoluciones.png',

  // ── Construir los datos del recibo ────────────────────────────────────────
  // tipo: 'abono' (un abono puntual) | 'etapa' (total de la etapa)
  _buildData(pago, proyecto, cliente, abono, tipo) {
    const esp = proyecto?.especificaciones || {};

    const total       = pago?.valorTotal || 0;
    const abonadoTotal = pago?.valorPagado || 0;
    const saldo       = Math.max(0, total - abonadoTotal);

    // Valor del recibo: el abono puntual, o el total abonado de la etapa
    const valorRecibo = tipo === 'abono' ? (abono?.monto || 0) : abonadoTotal;

    // Especificaciones básicas (solo sistema, estilo, área)
    const especItems = [
      { label: 'Sistema constructivo', value: esp.sistema || null },
      { label: 'Estilo de la vivienda', value: esp.estilo || null },
      { label: 'Área a construir', value: proyecto?.area ? `${proyecto.area} m²` : null }
    ].filter(i => i.value);

    // Número de recibo: fecha + id corto
    const baseId = tipo === 'abono' ? (abono?.id || '') : (pago?.id || '');
    const sufijo = (baseId || Date.now().toString(36)).toString().slice(-4).toUpperCase();
    const hoy = new Date();
    const numRecibo = `${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,'0')}${String(hoy.getDate()).padStart(2,'0')}-${sufijo}`;

    // Fecha del pago
    const fechaPago = tipo === 'abono'
      ? (abono?.fecha || pago?.fecha || null)
      : (pago?.fecha || null);

    return {
      numRecibo,
      fechaEmision: hoy.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
      cliente: {
        nombre:    (cliente?.nombre || '').trim() || 'No registrado',
        telefono:  (cliente?.telefono || '').trim() || '—',
        ubicacion: (cliente?.ubicacion || '').trim() || '—'
      },
      proyecto: {
        modelo:      (proyecto?.modelo || '').trim() || 'Sin modelo',
        precioTotal: proyecto?.precio || 0
      },
      etapa: {
        label:      pago?.etapaLabel || 'Etapa',
        porcentaje: pago?.esPlaca ? null : (pago?.porcentaje || null),
        total,
        abonado:    abonadoTotal,
        saldo
      },
      especItems,
      valorRecibo,
      metodo:    tipo === 'abono' ? (abono?.metodo || '—') : '—',
      referencia: tipo === 'abono' ? (abono?.nota || '') : (pago?.observaciones || ''),
      fechaPago: fechaPago ? new Date(fechaPago).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—',
      tipo
    };
  },

  // ── Generar el HTML del recibo (tamaño carta, compacto) ───────────────────
  // conSello: true → estampa el sello de la empresa sobre la firma (solo PDF)
  _buildHTML(d, conSello = false) {
    const esc = _escR;
    const fmt = v => (v || v === 0)
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v)
      : '—';

    const especFilas = d.especItems.length > 0
      ? d.especItems.map(i => `
          <tr>
            <td class="k">${esc(i.label)}</td>
            <td class="v">${esc(i.value)}</td>
          </tr>`).join('')
      : `<tr><td colspan="2" class="empty">Sin especificaciones registradas</td></tr>`;

    const etapaPct = d.etapa.porcentaje ? ` (${d.etapa.porcentaje}% del contrato)` : (d.etapa.label ? '' : '');
    const referenciaFila = d.referencia
      ? `<div class="pago-linea"><span>Referencia:</span> <strong>${esc(d.referencia)}</strong></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Recibo ${esc(d.numRecibo)} — ${esc(d.cliente.nombre)}</title>
<style>
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  html { font-size: 16px; }
  body { font-family:'Segoe UI', Arial, sans-serif; color:#1a2533; background:#fff; line-height:1.5; }

  .recibo { max-width: 760px; margin:0 auto; padding: 18px 30px; }

  /* Encabezado */
  .r-header {
    display:flex; align-items:center; justify-content:space-between; gap:16px;
    border-bottom: 3px solid #d0021b; padding-bottom: 12px; margin-bottom: 14px;
  }
  .r-empresa { display:flex; align-items:center; gap:14px; }
  .r-logo { width:150px; height:auto; flex-shrink:0; }
  .r-empresa-info h1 { font-size:20px; font-weight:800; color:#d0021b; letter-spacing:0.3px; }
  .r-empresa-info .lema { font-size:14px; color:#1a3c8f; font-weight:600; margin-bottom:2px; }
  .r-empresa-info .dato { font-size:12px; color:#555; line-height:1.4; }
  .r-doc { text-align:right; flex-shrink:0; }
  .r-doc .titulo {
    background:#d0021b; color:#fff; font-size:16px; font-weight:800;
    padding:6px 16px; border-radius:6px; letter-spacing:0.5px; display:inline-block; margin-bottom:6px;
  }
  .r-doc .num { font-size:14px; color:#1a2533; font-weight:700; }
  .r-doc .fecha { font-size:13px; color:#666; }

  /* Secciones */
  .r-sec { margin-bottom: 11px; }
  .r-sec-titulo {
    font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px;
    color:#1a3c8f; border-bottom:1.5px solid #e2e8f0; padding-bottom:4px; margin-bottom:7px;
  }
  .r-grid { display:grid; grid-template-columns: 1fr 1fr; gap:6px 20px; font-size:14.5px; }
  .r-linea { display:flex; gap:6px; }
  .r-linea .lbl { color:#64748b; font-weight:600; white-space:nowrap; }
  .r-linea .val { color:#1a2533; font-weight:600; }
  .r-full { grid-column: 1 / -1; }

  /* Tabla especificaciones */
  table.espec { width:100%; border-collapse:collapse; font-size:14.5px; }
  table.espec td { padding:5px 8px; border-bottom:1px solid #eef2f6; }
  table.espec td.k { color:#64748b; font-weight:600; width:42%; }
  table.espec td.v { color:#1a2533; font-weight:600; }
  table.espec td.empty { color:#94a3b8; font-style:italic; text-align:center; }

  /* Bloque valor recibido (destacado) */
  .r-valor {
    background:linear-gradient(135deg,#fff5f5,#fef2f2); border:2px solid #d0021b;
    border-radius:10px; padding:12px 18px; margin:12px 0; text-align:center;
  }
  .r-valor .lbl { font-size:14px; color:#991b1b; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .r-valor .monto { font-size:36px; font-weight:900; color:#d0021b; line-height:1.1; margin:3px 0; }
  .pago-linea { font-size:14px; color:#555; margin-top:4px; }
  .pago-linea span { color:#64748b; }

  /* Estado de la etapa */
  .r-estado {
    display:grid; grid-template-columns: repeat(3,1fr); gap:8px; margin-top:6px;
  }
  .r-estado .box { text-align:center; border-radius:8px; padding:10px 6px; border:1px solid #e2e8f0; }
  .r-estado .box .n { font-size:15px; font-weight:800; }
  .r-estado .box .t { font-size:11.5px; color:#64748b; text-transform:uppercase; letter-spacing:0.4px; }
  .box.total { background:#eff6ff; } .box.total .n { color:#1a3c8f; }
  .box.abon  { background:#f0fdf4; } .box.abon .n { color:#16a34a; }
  .box.saldo { background:#fffbeb; } .box.saldo .n { color:#d97706; }

  /* Firma (una sola, centrada) */
  .r-firmas { display:flex; justify-content:center; margin-top:44px; }
  .r-firma { width:320px; max-width:60%; text-align:center; position:relative; }
  /* Espacio real para firmar a mano encima de la línea */
  .r-firma .espacio { height:48px; }
  .r-firma .linea { border-top:1.5px solid #1a2533; margin-bottom:5px; }
  .r-firma .rol { font-size:13px; font-weight:700; color:#1a2533; }
  .r-firma .sub { font-size:12px; color:#666; }
  /* Sello de la empresa (solo en PDF) — efecto estampado, derecho */
  .r-firma .sello {
    position:absolute;
    top:-14px; left:50%;
    transform:translateX(-50%) rotate(-1.5deg);
    width:185px; height:auto;
    opacity:0.8;
    mix-blend-mode:multiply;
    pointer-events:none;
  }

  .r-legal { text-align:center; font-size:12px; color:#94a3b8; margin-top:16px; font-style:italic; }
  .r-footer {
    text-align:center; font-size:11.5px; color:#64748b; margin-top:12px;
    border-top:1px solid #e2e8f0; padding-top:8px;
  }

  @media print {
    html { font-size:15px; }
    .recibo { max-width:100%; padding:0; }
    @page { size: letter; margin: 14mm; }
  }
</style>
</head>
<body>
  <div class="recibo">

    <!-- Encabezado -->
    <div class="r-header">
      <div class="r-empresa">
        <img class="r-logo" src="${this.EMPRESA.logo}" alt="Logo"
             onerror="this.style.display='none'" />
        <div class="r-empresa-info">
          <h1>${esc(this.EMPRESA.nombre)}</h1>
          <div class="lema">${esc(this.EMPRESA.lema)}</div>
          <div class="dato">${esc(this.EMPRESA.nit)}</div>
          <div class="dato">${esc(this.EMPRESA.telefono)}</div>
          <div class="dato">${esc(this.EMPRESA.direccion)}</div>
        </div>
      </div>
      <div class="r-doc">
        <div class="titulo">RECIBO DE PAGO</div>
        <div class="num">N° ${esc(d.numRecibo)}</div>
        <div class="fecha">Fecha: ${esc(d.fechaEmision)}</div>
      </div>
    </div>

    <!-- Recibimos de -->
    <div class="r-sec">
      <div class="r-sec-titulo">Recibimos de</div>
      <div class="r-grid">
        <div class="r-linea r-full"><span class="lbl">Cliente:</span> <span class="val">${esc(d.cliente.nombre)}</span></div>
        <div class="r-linea"><span class="lbl">Teléfono:</span> <span class="val">${esc(d.cliente.telefono)}</span></div>
        <div class="r-linea"><span class="lbl">Ubicación:</span> <span class="val">${esc(d.cliente.ubicacion)}</span></div>
      </div>
    </div>

    <!-- Concepto -->
    <div class="r-sec">
      <div class="r-sec-titulo">Concepto del pago</div>
      <div class="r-grid">
        <div class="r-linea"><span class="lbl">Proyecto:</span> <span class="val">${esc(d.proyecto.modelo)}</span></div>
        <div class="r-linea"><span class="lbl">Precio total casa:</span> <span class="val">${fmt(d.proyecto.precioTotal)}</span></div>
        <div class="r-linea r-full"><span class="lbl">Etapa:</span> <span class="val">${esc(d.etapa.label)}${etapaPct}</span></div>
      </div>
    </div>

    <!-- Especificaciones -->
    <div class="r-sec">
      <div class="r-sec-titulo">Especificaciones de la casa</div>
      <table class="espec"><tbody>${especFilas}</tbody></table>
    </div>

    <!-- Valor recibido (destacado) -->
    <div class="r-valor">
      <div class="lbl">Valor recibido</div>
      <div class="monto">${fmt(d.valorRecibo)}</div>
      <div class="pago-linea"><span>Método de pago:</span> <strong>${esc(d.metodo)}</strong></div>
      <div class="pago-linea"><span>Fecha del pago:</span> <strong>${esc(d.fechaPago)}</strong></div>
      ${referenciaFila}
    </div>

    <!-- Estado de la etapa -->
    <div class="r-sec">
      <div class="r-sec-titulo">Estado de la etapa "${esc(d.etapa.label)}"</div>
      <div class="r-estado">
        <div class="box total"><div class="n">${fmt(d.etapa.total)}</div><div class="t">Total etapa</div></div>
        <div class="box abon"><div class="n">${fmt(d.etapa.abonado)}</div><div class="t">Abonado</div></div>
        <div class="box saldo"><div class="n">${fmt(d.etapa.saldo)}</div><div class="t">Saldo</div></div>
      </div>
    </div>

    <!-- Firma (solo quien recibe) -->
    <div class="r-firmas">
      <div class="r-firma">
        ${conSello ? `<img class="sello" src="${this.SELLO}" alt="Sello" onerror="this.style.display='none'" />` : ''}
        <div class="espacio"></div>
        <div class="linea"></div>
        <div class="rol">${esc(this.EMPRESA.nombre)}</div>
        <div class="sub">${esc(this.EMPRESA.nit)} · Recibí conforme</div>
      </div>
    </div>

    <div class="r-legal">Este recibo certifica el pago recibido en la fecha indicada.</div>
    <div class="r-footer">ClienteApp · Software personalizado desarrollado por OracleTech (Ingeniero George Moreno)</div>

  </div>
</body>
</html>`;
  },

  // ── Obtener datos del pago + proyecto + cliente ───────────────────────────
  async _cargarContexto(pagoId) {
    const pago = await DB.get(DB.STORES.pagos, pagoId);
    if (!pago) return null;
    const [cliente, proyectos] = await Promise.all([
      DB.get(DB.STORES.clientes, pago.clienteId),
      DB.getByIndex(DB.STORES.proyectos, 'clienteId', pago.clienteId)
    ]);
    // El proyecto de esta etapa (o el primero del cliente)
    const proyecto = (proyectos || []).find(p => p.id === pago.proyectoId) || (proyectos || [])[0] || null;
    return { pago, cliente, proyecto };
  },

  // ── Imprimir recibo de un ABONO puntual ───────────────────────────────────
  async imprimirAbono(pagoId, abonoId) {
    const ctx = await this._cargarContexto(pagoId);
    if (!ctx) { UI.toast('No se encontró el pago', 'danger'); return; }
    const abono = (ctx.pago.abonos || []).find(a => a.id === abonoId);
    if (!abono) { UI.toast('No se encontró el abono', 'danger'); return; }
    const data = this._buildData(ctx.pago, ctx.proyecto, ctx.cliente, abono, 'abono');
    this._imprimir(this._buildHTML(data));
  },

  async descargarAbonoPDF(pagoId, abonoId) {
    const ctx = await this._cargarContexto(pagoId);
    if (!ctx) { UI.toast('No se encontró el pago', 'danger'); return; }
    const abono = (ctx.pago.abonos || []).find(a => a.id === abonoId);
    if (!abono) { UI.toast('No se encontró el abono', 'danger'); return; }
    const data = this._buildData(ctx.pago, ctx.proyecto, ctx.cliente, abono, 'abono');
    await this._descargarPDF(this._buildHTML(data, true), data); // con sello
  },

  // ── Imprimir recibo de la ETAPA (total abonado) ───────────────────────────
  async imprimirEtapa(pagoId) {
    const ctx = await this._cargarContexto(pagoId);
    if (!ctx) { UI.toast('No se encontró el pago', 'danger'); return; }
    if (!ctx.pago.valorPagado || ctx.pago.valorPagado <= 0) {
      UI.toast('Esta etapa aún no tiene pagos registrados', 'warning');
      return;
    }
    const data = this._buildData(ctx.pago, ctx.proyecto, ctx.cliente, null, 'etapa');
    this._imprimir(this._buildHTML(data));
  },

  async descargarEtapaPDF(pagoId) {
    const ctx = await this._cargarContexto(pagoId);
    if (!ctx) { UI.toast('No se encontró el pago', 'danger'); return; }
    if (!ctx.pago.valorPagado || ctx.pago.valorPagado <= 0) {
      UI.toast('Esta etapa aún no tiene pagos registrados', 'warning');
      return;
    }
    const data = this._buildData(ctx.pago, ctx.proyecto, ctx.cliente, null, 'etapa');
    await this._descargarPDF(this._buildHTML(data, true), data); // con sello
  },

  // ── Motor de impresión (ventana emergente) ────────────────────────────────
  _imprimir(html) {
    try {
      const win = window.open('', '_blank', 'width=820,height=700');
      if (!win) {
        UI.toast('El navegador bloqueó la ventana emergente. Permite ventanas emergentes.', 'warning', 7000);
        return;
      }
      win.document.write(html);
      win.document.close();
      let impreso = false;
      const lanzar = () => { if (impreso) return; impreso = true; try { win.focus(); win.print(); } catch (e) {} };
      win.addEventListener('load', lanzar);
      if (win.document.readyState === 'complete') setTimeout(lanzar, 400);
      else setTimeout(lanzar, 900);
    } catch (err) {
      console.error('[Recibos] Error al imprimir:', err);
      UI.toast('Error al generar el recibo', 'danger');
    }
  },

  // ── Motor de PDF (reutiliza jsPDF + html2canvas) ──────────────────────────
  async _descargarPDF(html, data) {
    // Reutilizar los cargadores de PrintDoc para no duplicar
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

    try {
      const fileName = this._sanitizeFileName(`Recibo_${data.cliente.nombre}_${data.numRecibo}`) + '.pdf';

      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      iDoc.open(); iDoc.write(html); iDoc.close();

      await new Promise(resolve => {
        if (iframe.contentDocument.readyState === 'complete') resolve();
        else { iframe.onload = resolve; setTimeout(resolve, 1200); }
      });
      // Esperar a que TODAS las imágenes (logo + sello) carguen dentro del iframe
      await new Promise(resolve => {
        const imgs = [...iframe.contentDocument.images];
        if (imgs.length === 0) { resolve(); return; }
        let pendientes = imgs.filter(img => !img.complete).length;
        if (pendientes === 0) { resolve(); return; }
        const listo = () => { pendientes--; if (pendientes <= 0) resolve(); };
        imgs.forEach(img => {
          if (img.complete) return;
          img.addEventListener('load', listo, { once: true });
          img.addEventListener('error', listo, { once: true });
        });
        setTimeout(resolve, 2500); // fallback por si alguna imagen no dispara evento
      });
      await new Promise(r => setTimeout(r, 200)); // pequeño margen de render

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
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;

      // Dimensiones "naturales" respetando el ancho disponible
      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;

      // Si el alto supera la página, escalar TODO para que quepa en una sola hoja
      if (imgH > maxH) {
        const escala = maxH / imgH;
        imgH = maxH;
        imgW = imgW * escala;
      }

      // Centrar horizontalmente el contenido escalado
      const xOffset = (pageW - imgW) / 2;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', xOffset, margin, imgW, imgH);

      pdf.save(fileName);
      UI.toast(`Recibo descargado: ${fileName}`, 'success');
    } catch (err) {
      console.error('[Recibos] Error al generar PDF:', err);
      UI.toast('Error al generar el PDF. Usa "Imprimir" y guarda como PDF desde el diálogo.', 'warning', 8000);
    }
  },

  _sanitizeFileName(name) {
    return (name || 'Recibo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').replace(/_{2,}/g, '_')
      .slice(0, 90) || 'Recibo';
  }
};

// ── Helper de escape interno ──────────────────────────────────────────────────
function _escR(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
