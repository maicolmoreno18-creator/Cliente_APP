/* ============================================
   ClienteAPP — Opciones Personalizables
   Sistemas, cubiertas, ornamentación, puertas, comisión
   ============================================ */

const OPCIONES_KEY = 'clienteapp_opciones';

// Valores por defecto (los que ya tenía la app)
const OPCIONES_DEFAULT = {
  comisionPct: 5,
  baseMensual: 500000,
  sistemas: [
    'Plaqueta',
    'Bloquelon',
    'Mixto (Plaqueta + Bloquelon)'
  ],
  cubiertas: [
    'Eternit',
    'Teja Arquitectónica Azul',
    'Teja Arquitectónica Roja',
    'Teja Arquitectónica Gris',
    'Teja Termoacústica'
  ],
  ornSistemas: [
    'Corredizo',
    'Apertura (abatible)',
    'Sistema mixto (corredizas + abatibles)'
  ],
  ornColores: [
    'Negro',
    'Blanco'
  ],
  puertaChapas: [
    'Pomo madera',
    'Pomo metal',
    'Manija recta'
  ],
  obsequios: [
    'Kit de herramientas',
    'Pintura interior',
    'Instalación eléctrica básica'
  ]
};

window.Opciones = {

  // ── Leer opciones (mezcla default + personalizadas) ───────────────────────
  get() {
    try {
      const guardadas = JSON.parse(localStorage.getItem(OPCIONES_KEY) || '{}');
      return { ...OPCIONES_DEFAULT, ...guardadas };
    } catch {
      return { ...OPCIONES_DEFAULT };
    }
  },

  // ── Guardar opciones ──────────────────────────────────────────────────────
  save(opciones) {
    localStorage.setItem(OPCIONES_KEY, JSON.stringify(opciones));
  },

  // ── Llenar un select con opciones personalizadas ──────────────────────────
  llenarSelect(selectId, lista, incluirOtro = false) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    // Escape local (no depende de UI.escapeHTML para independencia de carga)
    const esc = s => String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    const valorActual = sel.value;
    sel.innerHTML = '<option value="">Seleccionar...</option>' +
      (lista || []).map(op => `<option value="${esc(op)}">${esc(op)}</option>`).join('') +
      (incluirOtro ? '<option value="Otro">Otro</option>' : '');
    // Restaurar valor si sigue existiendo
    if (valorActual) sel.value = valorActual;
  },

  // ── Inicializar todos los selects del modal de proyecto ───────────────────
  inicializarSelects() {
    const op = this.get();
    this.llenarSelect('especSistema',    op.sistemas,     true);
    this.llenarSelect('especCubierta',   op.cubiertas,    true);
    this.llenarSelect('especOrnSistema', op.ornSistemas,  false);
    this.llenarSelect('especOrnColor',   op.ornColores,   true);
    this.llenarSelect('especPuertaChapa',op.puertaChapas, true);
    this.llenarCheckboxObsequios('especObsequiosGroup', op.obsequios);
  },

  // ── Llenar grupo de checkboxes para Obsequios ─────────────────────────────
  llenarCheckboxObsequios(containerId, lista) {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Helper de escape local (no depende de UI.escapeHTML para independencia de carga)
    const esc = s => String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    // Guardar valores actualmente seleccionados antes de re-renderizar
    const seleccionados = this.getObsequiosSeleccionados(containerId);
    container.innerHTML = (lista || []).map(op => {
      const checked  = seleccionados.includes(op) ? 'checked' : '';
      const safeId   = 'obq_' + op.replace(/[^a-zA-Z0-9]/g, '_');
      const safeVal  = esc(op);
      return `
        <div class="form-check form-check-inline mb-1">
          <input class="form-check-input" type="checkbox" id="${safeId}"
                 name="especObsequio" value="${safeVal}" ${checked} />
          <label class="form-check-label small" for="${safeId}">${safeVal}</label>
        </div>`;
    }).join('');
  },

  // ── Obtener obsequios seleccionados del grupo de checkboxes ───────────────
  getObsequiosSeleccionados(containerId = 'especObsequiosGroup') {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return [...container.querySelectorAll('input[name="especObsequio"]:checked')]
      .map(cb => cb.value);
  },

  // ── Marcar obsequios en los checkboxes (al editar) ────────────────────────
  marcarObsequios(containerId, seleccionados) {
    if (!seleccionados || !seleccionados.length) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('input[name="especObsequio"]').forEach(cb => {
      cb.checked = seleccionados.includes(cb.value);
    });
  }
};
