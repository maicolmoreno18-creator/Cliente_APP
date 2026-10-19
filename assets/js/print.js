/* ============================================
   ClienteAPP — Módulo de Impresión y PDF
   Especificaciones de ornamentación / proyecto
   Sin información económica (precios/comisiones)
   ============================================ */

window.PrintDoc = {

  // ── Construir datos del documento a partir de proyecto + cliente ──────────
  _buildData(proyecto, cliente) {
    const esp = proyecto?.especificaciones || {};

    // Nombre del cliente
    const nombreCliente = (cliente?.nombre || '').trim() || 'No registrado';

    // Área de la casa
    const area = proyecto?.area ? `${proyecto.area} m²` : 'No registrado';

    // Lugar de instalación (ubicación del cliente)
    const lugar = (cliente?.ubicacion || '').trim() || 'No registrado';

    // Notas del proyecto
    const notas = (proyecto?.notas || '').trim();

    // Obsequios (array, compatible con proyectos sin este campo)
    const obsequios = Array.isArray(esp.obsequios) ? esp.obsequios.filter(Boolean) : [];

    // Especificaciones técnicas — misma lógica que Expediente._ornLabel
    const ornLabel = (() => {
      if (!esp.ornSistema) return null;

      const color      = esp.ornColor === 'Otro' ? (esp.ornColorOtro || '') : (esp.ornColor || '');
      const colorSufijo = color ? ` · Anticorrosivo ${color}` : '';
      const ornLower   = esp.ornSistema.toLowerCase();
      const esMixto    = ornLower.includes('mixto');
      const esAbatible = !esMixto && (ornLower.includes('apertura') || ornLower.includes('abatible'));
      const esCorredizo= !esMixto && ornLower.includes('corrediz');

      if (esMixto) {
        const partes = [esp.ornSistema];
        const refAb  = (esp.ornMixtoAbatiblesRef  || '').trim();
        const aperAb = esp.ornAperturaAbatible || '';
        if (refAb || aperAb) {
          let ab = 'Abatibles';
          if (refAb)  ab += `: ${refAb}`;
          if (aperAb) ab += ` (${aperAb})`;
          partes.push(ab);
        }
        const refCo  = (esp.ornMixtoCorredizasRef      || '').trim();
        const aperCo = esp.ornAperturaCorredizaMixto || '';
        if (refCo || aperCo) {
          let co = 'Corredizas';
          if (refCo)  co += `: ${refCo}`;
          if (aperCo) co += ` (${aperCo})`;
          partes.push(co);
        }
        return (partes.join(' · ') + colorSufijo) || null;
      }

      if (esAbatible) {
        let label = esp.ornSistema;
        if (esp.ornApertura) label += ` · ${esp.ornApertura}`;
        return (label + colorSufijo) || null;
      }

      if (esCorredizo) {
        let label = esp.ornSistema;
        if (esp.ornAperturaCorrediza) label += ` · ${esp.ornAperturaCorrediza}`;
        return (label + colorSufijo) || null;
      }

      // Fallback: valor personalizado o datos anteriores
      let label = esp.ornSistema;
      if (esp.ornApertura) label += ` · ${esp.ornApertura}`;
      return (label + colorSufijo) || null;
    })();

    const puertaLabel = (() => {
      if (!esp.puertaColor && !esp.puertaChapa) return null;
      const parts = [];
      if (esp.puertaColor) parts.push(`Color ${esp.puertaColor}`);
      if (esp.puertaChapa) parts.push(esp.puertaChapa);
      return parts.join(' · ') || null;
    })();

    const alturaLabel = (() => {
      if (esp.alturaMin && esp.alturaMax) return `${esp.alturaMin} m — ${esp.alturaMax} m`;
      if (esp.alturaMin) return `Mín. ${esp.alturaMin} m`;
      if (esp.alturaMax) return `Máx. ${esp.alturaMax} m`;
      return null;
    })();

    const cubiertaLabel = esp.cubierta === 'Otro' ? (esp.cubiertaOtro || null) : (esp.cubierta || null);

    const especItems = [
      { label: 'Sistema Constructivo',  value: esp.sistema      || null },
      { label: 'Estilo de la Vivienda', value: esp.estilo        || null },
      { label: 'Altura',                value: alturaLabel              },
      { label: 'Tipo de Cubierta',      value: cubiertaLabel            },
      { label: 'Ornamentación',         value: ornLabel                 },
      { label: 'Puertas Internas',      value: puertaLabel              }
    ].filter(i => i.value);

    return {
      nombreCliente,
      area,
      lugar,
      modelo: (proyecto?.modelo || '').trim() || 'Sin modelo',
      especItems,
      obsequios,
      notas,
      fechaDoc: new Date().toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric'
      })
    };
  },

  // ── Generar el HTML del documento (limpio, sin precios) ───────────────────
  _buildHTML(data) {
    const { nombreCliente, area, lugar, modelo, especItems, obsequios, notas, fechaDoc } = data;

    const especTabla = especItems.length > 0
      ? `<table class="spec-table">
           <thead>
             <tr>
               <th style="width:38%">Característica</th>
               <th>Detalle</th>
             </tr>
           </thead>
           <tbody>
             ${especItems.map(i => `
               <tr>
                 <td class="spec-label">${_esc(i.label)}</td>
                 <td>${_esc(i.value)}</td>
               </tr>`).join('')}
           </tbody>
         </table>`
      : `<p class="empty-note">No se registraron especificaciones técnicas.</p>`;

    const obsequiosHTML = obsequios.length > 0
      ? `<ul class="gift-list">
           ${obsequios.map(o => `<li>${_esc(o)}</li>`).join('')}
         </ul>`
      : '';  // Si no hay obsequios, la sección completa no aparece

    const notasHTML = notas
      ? `<section class="doc-section">
           <h2 class="section-title">
             <span class="section-icon">📝</span> Notas del Proyecto
           </h2>
           <div class="notes-box">${_esc(notas).replace(/\n/g, '<br>')}</div>
         </section>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Especificaciones — ${_esc(nombreCliente)}</title>
  <style>
    /* ── Reset y base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 19px; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a2533;
      background: #fff;
      line-height: 1.55;
    }

    /* ── Página ── */
    .doc-page {
      max-width: 794px;
      margin: 0 auto;
      padding: 26px 30px 32px;
    }

    /* ── Encabezado ── */
    .doc-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 3px solid #1a3c5e;
      padding-bottom: 12px;
      margin-bottom: 16px;
      gap: 16px;
    }
    .doc-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .doc-brand-icon {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #1a3c5e, #2d6a9f);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: white;
      font-size: 22px;
      flex-shrink: 0;
    }
    .doc-brand-name {
      font-size: 25px;
      font-weight: 700;
      color: #1a3c5e;
      letter-spacing: -0.3px;
    }
    .doc-brand-sub {
      font-size: 14px;
      color: #64748b;
      margin-top: 1px;
    }
    .doc-meta {
      text-align: right;
      font-size: 14px;
      color: #64748b;
    }
    .doc-meta strong {
      display: block;
      font-size: 16px;
      color: #1a2533;
      margin-bottom: 2px;
    }

    /* ── Datos del proyecto ── */
    .project-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 14px;
    }
    .info-card {
      background: #f0f4f8;
      border-radius: 8px;
      padding: 12px 14px;
      border-left: 3px solid #2d6a9f;
    }
    .info-card-label {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .info-card-value {
      font-size: 17px;
      font-weight: 600;
      color: #1a2533;
      word-break: break-word;
    }

    /* ── Secciones ── */
    .doc-section {
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1a3c5e;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .section-icon { font-size: 20px; }

    /* ── Tabla de especificaciones ── */
    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 1.05rem;
    }
    .spec-table thead tr {
      background: #1a3c5e;
      color: white;
    }
    .spec-table thead th {
      padding: 11px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .spec-table tbody tr:nth-child(even) {
      background: #f8fafc;
    }
    .spec-table tbody tr:nth-child(odd) {
      background: #ffffff;
    }
    .spec-table tbody tr {
      border-bottom: 1px solid #e8edf2;
    }
    .spec-table td {
      padding: 11px 14px;
      vertical-align: top;
    }
    .spec-label {
      color: #475569;
      font-weight: 600;
      white-space: nowrap;
    }
    .empty-note {
      color: #94a3b8;
      font-style: italic;
      font-size: 15px;
      padding: 10px 0;
    }

    /* ── Obsequios ── */
    .gift-list {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 0;
    }
    .gift-list li {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 15px;
      font-weight: 500;
      color: #166534;
    }
    .gift-list li::before {
      content: '🎁 ';
    }

    /* ── Notas ── */
    .notes-box {
      background: #fefce8;
      border: 1.5px solid #fde68a;
      border-radius: 8px;
      padding: 14px 18px;
      font-size: 1.05rem;
      line-height: 1.65;
      color: #1a2533;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Pie de página ── */
    .doc-footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #94a3b8;
    }
    .doc-footer strong { color: #64748b; }

    /* ── MEDIA PRINT ── */
    @media print {
      html { font-size: 16px; }
      body { background: white; }
      .doc-page { padding: 0; max-width: 100%; }
      .no-print-notice { display: none !important; }
      .doc-section { page-break-inside: avoid; }
      .spec-table { page-break-inside: auto; }
      .spec-table tr { page-break-inside: avoid; page-break-after: auto; }
      .notes-box { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="doc-page">

    <!-- Encabezado -->
    <header class="doc-header">
      <div class="doc-brand">
        <div class="doc-brand-icon">🏠</div>
        <div>
          <div class="doc-brand-name">ClienteAPP</div>
          <div class="doc-brand-sub">CRM · Casas Prefabricadas</div>
        </div>
      </div>
      <div class="doc-meta">
        Fecha: ${_esc(fechaDoc)}
      </div>
    </header>

    <!-- Datos del proyecto -->
    <section class="doc-section">
      <h2 class="section-title">
        <span class="section-icon">📋</span> Datos del Proyecto
      </h2>
      <div class="project-info-grid">
        <div class="info-card">
          <div class="info-card-label">Cliente</div>
          <div class="info-card-value">${_esc(nombreCliente)}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">Área de la Casa</div>
          <div class="info-card-value">${_esc(area)}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">Lugar de Instalación</div>
          <div class="info-card-value">${_esc(lugar)}</div>
        </div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;">
        <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748b;">Modelo</span>
        <div style="font-size:17px;font-weight:600;margin-top:3px;">${_esc(modelo)}</div>
      </div>
    </section>

    <!-- Características técnicas -->
    <section class="doc-section">
      <h2 class="section-title">
        <span class="section-icon">🔧</span> Características Técnicas
      </h2>
      ${especTabla}
    </section>

    <!-- Obsequios (solo si hay) -->
    ${obsequiosHTML ? `
    <section class="doc-section">
      <h2 class="section-title">
        <span class="section-icon">🎁</span> Obsequios
      </h2>
      ${obsequiosHTML}
    </section>` : ''}

    <!-- Notas del proyecto (solo si hay) -->
    ${notasHTML}

    <!-- Pie de página -->
    <footer class="doc-footer">
      <span><strong>ClienteAPP 2.0</strong> · Aplicación de CRM desarrollada por <strong>OracleTech</strong> (George Moreno)</span>
      <span>Generado el ${_esc(fechaDoc)}</span>
    </footer>

  </div>
</body>
</html>`;
  },

  // ── Imprimir especificaciones desde la ventana del navegador ─────────────
  async imprimir(proyectoId, clienteId) {
    try {
      const [proyecto, cliente] = await Promise.all([
        DB.get(DB.STORES.proyectos, proyectoId),
        DB.get(DB.STORES.clientes, clienteId)
      ]);

      if (!proyecto) {
        UI.toast('No se encontró el proyecto', 'danger');
        return;
      }

      const data = this._buildData(proyecto, cliente);
      const html = this._buildHTML(data);

      // Abrir ventana de impresión con el HTML del documento
      const win = window.open('', '_blank', 'width=860,height=700');
      if (!win) {
        UI.toast('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para esta página.', 'warning', 7000);
        return;
      }
      win.document.write(html);
      win.document.close();

      // Lanzar el diálogo de impresión de forma robusta.
      // El documento se escribe de forma síncrona, así que el evento 'load'
      // puede haber disparado ya; por eso no dependemos solo del listener.
      let impreso = false;
      const lanzarImpresion = () => {
        if (impreso) return;      // evitar doble llamada
        impreso = true;
        try { win.focus(); win.print(); } catch (e) { /* ventana cerrada por el usuario */ }
      };

      // Respaldo por si el evento load aún no ocurrió
      win.addEventListener('load', lanzarImpresion);
      // Si el documento ya está completo, imprimir tras un breve delay para
      // dar tiempo al render (fuentes, layout). Cubre el caso síncrono.
      if (win.document.readyState === 'complete') {
        setTimeout(lanzarImpresion, 350);
      } else {
        // Fallback duro por si 'load' nunca llega en algunos navegadores
        setTimeout(lanzarImpresion, 800);
      }

    } catch (err) {
      console.error('[PrintDoc] Error al imprimir:', err);
      UI.toast('Error al generar el documento de impresión', 'danger');
    }
  },

  // ── Descargar PDF ─────────────────────────────────────────────────────────
  async descargarPDF(proyectoId, clienteId) {
    // Cargar librerías si aún no están disponibles (fallback en caso de fallo CDN)
    const jsPDFAvail  = !!(window.jspdf?.jsPDF || window.jsPDF);
    const h2cAvail    = !!window.html2canvas;

    if (!jsPDFAvail || !h2cAvail) {
      UI.toast('Preparando generador de PDF...', 'info', 3000);
      try {
        if (!jsPDFAvail)  await this._cargarJsPDF();
        if (!h2cAvail)    await this._cargarHtml2Canvas();
      } catch (e) {
        UI.toast('No se pudo cargar la librería de PDF. Verifica tu conexión a internet.', 'danger', 7000);
        return;
      }
    }

    const btn = document.querySelector(`[data-pdf-btn="${proyectoId}"]`);
    const originalHTML = btn ? btn.innerHTML : null;
    if (btn) {
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Generando...';
      btn.disabled = true;
    }

    try {
      const [proyecto, cliente] = await Promise.all([
        DB.get(DB.STORES.proyectos, proyectoId),
        DB.get(DB.STORES.clientes, clienteId)
      ]);

      if (!proyecto) {
        UI.toast('No se encontró el proyecto', 'danger');
        return;
      }

      const data      = this._buildData(proyecto, cliente);
      const html      = this._buildHTML(data);
      const fileName  = this._sanitizeFileName(`Especificaciones_${data.nombreCliente}`) + '.pdf';

      // Crear iframe oculto para renderizar el HTML
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;height:1123px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      // Escribir el HTML en el iframe
      const iDoc = iframe.contentDocument || iframe.contentWindow.document;
      iDoc.open();
      iDoc.write(html);
      iDoc.close();

      // Esperar a que el iframe cargue completamente
      await new Promise(resolve => {
        if (iframe.contentDocument.readyState === 'complete') {
          resolve();
        } else {
          iframe.onload = resolve;
          setTimeout(resolve, 1200); // fallback
        }
      });
      await new Promise(r => setTimeout(r, 300)); // pequeño delay para renderizado

      // Capturar con html2canvas
      const canvas = await html2canvas(iframe.contentDocument.body, {
        scale:           2,
        useCORS:         true,
        allowTaint:      true,
        backgroundColor: '#ffffff',
        width:           794,
        windowWidth:     794,
        logging:         false
      });

      document.body.removeChild(iframe);

      // Crear PDF con jsPDF (A4)
      const jsPDF  = window.jspdf?.jsPDF || window.jsPDF;
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW  = pdf.internal.pageSize.getWidth();   // 210 mm
      const pageH  = pdf.internal.pageSize.getHeight();  // 297 mm
      const margin = 10; // mm

      const imgW     = pageW - margin * 2;
      const imgH     = (canvas.height * imgW) / canvas.width;

      // Paginar si el contenido excede una página
      let yOffset = margin;
      let remainH = imgH;

      while (remainH > 0) {
        const sliceH = Math.min(remainH, pageH - margin * 2);
        const srcY   = (imgH - remainH) * (canvas.height / imgH);
        const srcH   = sliceH * (canvas.height / imgH);

        // Crear canvas recortado para la página actual
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(sliceData, 'JPEG', margin, yOffset, imgW, sliceH);

        remainH -= sliceH;
        yOffset = margin;
        if (remainH > 0) {
          pdf.addPage();
        }
      }

      pdf.save(fileName);
      UI.toast(`PDF descargado: ${fileName}`, 'success');

    } catch (err) {
      console.error('[PrintDoc] Error al generar PDF:', err);
      UI.toast('Error al generar el PDF. Intenta usar "Imprimir" y guarda como PDF desde el diálogo.', 'warning', 8000);
    } finally {
      if (btn && originalHTML) {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
      }
    }
  },

  // ── Cargar un script probando primero local, luego CDN como respaldo ─────
  _cargarScript(rutaLocal, rutaCDN, yaCargado) {
    return new Promise((resolve, reject) => {
      if (yaCargado()) { resolve(); return; }
      const intentar = (src, onFail) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload  = resolve;
        s.onerror = onFail;
        document.head.appendChild(s);
      };
      // 1) copia local (funciona offline) → 2) CDN si la local falla
      intentar(rutaLocal, () => intentar(rutaCDN, reject));
    });
  },

  // ── Cargar jsPDF dinámicamente si no está disponible ─────────────────────
  _cargarJsPDF() {
    return this._cargarScript(
      'assets/vendor/jspdf.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      () => !!(window.jspdf?.jsPDF || window.jsPDF)
    );
  },

  // ── Cargar html2canvas dinámicamente si no está disponible ───────────────
  _cargarHtml2Canvas() {
    return this._cargarScript(
      'assets/vendor/html2canvas.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      () => !!window.html2canvas
    );
  },

  // ── Sanitizar nombre de archivo ───────────────────────────────────────────
  _sanitizeFileName(name) {
    return (name || 'Especificaciones')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // quitar tildes
      .replace(/[^a-zA-Z0-9_\-\s]/g, '') // quitar caracteres inválidos
      .replace(/\s+/g, '_')              // espacios → guiones bajos
      .replace(/_{2,}/g, '_')            // dobles guiones bajos → uno
      .slice(0, 80)                       // máx 80 caracteres
      || 'Especificaciones';
  }
};

// ── Helper interno (no expuesto globalmente) ──────────────────────────────────
function _esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
