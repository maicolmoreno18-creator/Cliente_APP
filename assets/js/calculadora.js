/* ============================================
   ClienteAPP — Calculadora + Cotizador + Placa
   Panel flotante con 3 tabs
   ============================================ */

window.Calculadora = {

  _visible: false,
  _tab: 'calculadora',
  _display: '0',
  _operador: null,
  _prevValue: null,
  _newNumber: true,
  _cotizadorTipo: '1piso',
  _totalCotizador: 0,

  // ── Toggle panel ──────────────────────────────────────────────────────────
  toggle() {
    this._visible = !this._visible;
    const panel = document.getElementById('calcPanel');
    if (this._visible) {
      panel.classList.remove('d-none');
      panel.style.animation = 'fadeInUp 0.25s ease';
    } else {
      panel.classList.add('d-none');
    }
  },

  // ── Cambiar tab ───────────────────────────────────────────────────────────
  setTab(tab) {
    this._tab = tab;
    document.getElementById('calcTabCalc').classList.toggle('active', tab === 'calculadora');
    document.getElementById('calcTabCot').classList.toggle('active', tab === 'cotizador');
    document.getElementById('calcBodyCalc').classList.toggle('d-none', tab !== 'calculadora');
    document.getElementById('calcBodyCot').classList.toggle('d-none', tab !== 'cotizador');
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULADORA NORMAL
  // ═══════════════════════════════════════════════════════════════════════════

  input(val) {
    if (this._newNumber) {
      this._display = val === '.' ? '0.' : val;
      this._newNumber = false;
    } else {
      if (val === '.' && this._display.includes('.')) return;
      this._display += val;
    }
    this._updateDisplay();
  },

  operador(op) {
    this._calculate();
    this._operador = op;
    this._prevValue = parseFloat(this._display);
    this._newNumber = true;
  },

  calculate() {
    this._calculate();
    this._operador = null;
    this._newNumber = true;
  },

  _calculate() {
    if (this._operador && this._prevValue !== null) {
      const current = parseFloat(this._display);
      let result;
      switch (this._operador) {
        case '+': result = this._prevValue + current; break;
        case '-': result = this._prevValue - current; break;
        case '*': result = this._prevValue * current; break;
        case '/': result = current !== 0 ? this._prevValue / current : 0; break;
        default: result = current;
      }
      this._display = this._formatResult(result);
      this._prevValue = result;
    }
    this._updateDisplay();
  },

  percent() {
    const val = parseFloat(this._display);
    this._display = this._formatResult(val / 100);
    this._updateDisplay();
  },

  clear() {
    this._display = '0';
    this._operador = null;
    this._prevValue = null;
    this._newNumber = true;
    this._updateDisplay();
  },

  backspace() {
    if (this._display.length > 1) {
      this._display = this._display.slice(0, -1);
    } else {
      this._display = '0';
      this._newNumber = true;
    }
    this._updateDisplay();
  },

  _formatResult(num) {
    if (Number.isInteger(num)) return num.toString();
    return parseFloat(num.toFixed(8)).toString();
  },

  _updateDisplay() {
    const el = document.getElementById('calcDisplay');
    if (el) el.textContent = this._display;
  },

  // ── Teclado numérico ──────────────────────────────────────────────────────
  _handleKeyboard(e) {
    if (!Calculadora._visible) return;
    if (Calculadora._tab !== 'calculadora') return;
    // No capturar si hay un input enfocado
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

    const key = e.key;
    if (/^[0-9]$/.test(key)) { Calculadora.input(key); e.preventDefault(); }
    else if (key === '.') { Calculadora.input('.'); e.preventDefault(); }
    else if (key === '+') { Calculadora.operador('+'); e.preventDefault(); }
    else if (key === '-') { Calculadora.operador('-'); e.preventDefault(); }
    else if (key === '*') { Calculadora.operador('*'); e.preventDefault(); }
    else if (key === '/') { Calculadora.operador('/'); e.preventDefault(); }
    else if (key === 'Enter' || key === '=') { Calculadora.calculate(); e.preventDefault(); }
    else if (key === 'Backspace') { Calculadora.backspace(); e.preventDefault(); }
    else if (key === 'Escape') { Calculadora.clear(); e.preventDefault(); }
    else if (key === '%') { Calculadora.percent(); e.preventDefault(); }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COTIZADOR
  // ═══════════════════════════════════════════════════════════════════════════

  setCotTipo(tipo) {
    this._cotizadorTipo = tipo;
    document.getElementById('cotBtn1p').classList.toggle('active', tipo === '1piso');
    document.getElementById('cotBtn2p').classList.toggle('active', tipo === '2pisos');
    document.getElementById('cotCampos2p').classList.toggle('d-none', tipo === '1piso');
    document.getElementById('cotCampos1p').classList.toggle('d-none', tipo === '2pisos');
    this.calcularCotizacion();
  },

  calcularCotizacion() {
    let total = 0;
    if (this._cotizadorTipo === '1piso') {
      const m2 = parseFloat(document.getElementById('cot1pM2')?.value) || 0;
      const valor = parseFloat(document.getElementById('cot1pValor')?.value) || 0;
      total = m2 * valor;
    } else {
      const p1m2 = parseFloat(document.getElementById('cot2pP1M2')?.value) || 0;
      const p1val = parseFloat(document.getElementById('cot2pP1Valor')?.value) || 0;
      const p2m2 = parseFloat(document.getElementById('cot2pP2M2')?.value) || 0;
      const p2val = parseFloat(document.getElementById('cot2pP2Valor')?.value) || 0;
      const plancha = parseFloat(document.getElementById('cot2pPlancha')?.value) || 0;
      const escaleras = parseFloat(document.getElementById('cot2pEscaleras')?.value) || 0;
      total = (p1m2 * p1val) + (p2m2 * p2val) + plancha + escaleras;
    }
    const placa = parseFloat(document.getElementById('cotPlaca')?.value) || 0;
    total += placa;
    this._totalCotizador = total;
    document.getElementById('cotTotal').textContent = UI.formatCurrency(total);
    this._updateEtapas();
  },

  aplicarOperacion() {
    const input = document.getElementById('cotOperacion');
    const expr = input?.value?.trim();
    if (!expr) return;
    const op = expr[0];
    const num = parseFloat(expr.substring(1).replace(/,/g, ''));
    if (isNaN(num)) { UI.toast('Formato: +500000, -100000, *1.1, /2', 'warning'); return; }
    switch (op) {
      case '+': this._totalCotizador += num; break;
      case '-': this._totalCotizador -= num; break;
      case '*': this._totalCotizador *= num; break;
      case '/': if (num !== 0) this._totalCotizador /= num; break;
      default: UI.toast('Empieza con +, -, * o /', 'warning'); return;
    }
    this._totalCotizador = Math.round(this._totalCotizador);
    document.getElementById('cotTotal').textContent = UI.formatCurrency(this._totalCotizador);
    input.value = '';
    this._updateEtapas();
  },

  _updateEtapas() {
    const t = this._totalCotizador;
    document.getElementById('cotEtapa50').textContent = UI.formatCurrency(Math.round(t * 0.5));
    document.getElementById('cotEtapa40').textContent = UI.formatCurrency(Math.round(t * 0.4));
    document.getElementById('cotEtapa10').textContent = UI.formatCurrency(Math.round(t * 0.1));
  },

  limpiarCotizador() {
    document.querySelectorAll('#calcBodyCot input').forEach(i => i.value = '');
    this._totalCotizador = 0;
    document.getElementById('cotTotal').textContent = '$0';
    this._updateEtapas();
  }
};

// ── Inicializar teclado ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => Calculadora._handleKeyboard(e));
