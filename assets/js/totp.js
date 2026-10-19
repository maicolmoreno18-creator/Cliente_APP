/* ============================================
   ClienteAPP — TOTP (Authenticator 2FA)
   Compatible con Google Authenticator, Authy, etc.
   Usa Web Crypto API — sin dependencias externas.
   ============================================ */

window.TOTP = {

  // ── Generar secreto aleatorio (base32, 20 bytes = 32 chars) ────────────────
  generarSecreto() {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    return this._base32Encode(bytes);
  },

  // ── Generar URI para código QR (otpauth://) ───────────────────────────────
  generarURI(secreto, cuenta = 'admin', emisor = 'ClienteAPP') {
    return `otpauth://totp/${encodeURIComponent(emisor)}:${encodeURIComponent(cuenta)}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`;
  },

  // ── Generar código TOTP actual ────────────────────────────────────────────
  async generarCodigo(secreto) {
    const key = this._base32Decode(secreto);
    const time = Math.floor(Date.now() / 1000);
    const counter = Math.floor(time / 30);
    return await this._hotp(key, counter);
  },

  // ── Verificar código ingresado (con ventana de ±1 paso = 90 segundos) ─────
  async verificar(secreto, codigo) {
    if (!secreto || !codigo) return false;
    codigo = codigo.replace(/\s/g, '');
    if (codigo.length !== 6 || !/^\d{6}$/.test(codigo)) return false;

    const key = this._base32Decode(secreto);
    const time = Math.floor(Date.now() / 1000);
    const counter = Math.floor(time / 30);

    // Verificar paso actual y ±1 (tolerancia de 90 segundos)
    for (let i = -1; i <= 1; i++) {
      const expected = await this._hotp(key, counter + i);
      if (expected === codigo) return true;
    }
    return false;
  },

  // ── ¿Está configurado el 2FA? ─────────────────────────────────────────────
  estaConfigurado() {
    return !!localStorage.getItem('clienteapp_totp_secret');
  },

  // ── Obtener secreto guardado ──────────────────────────────────────────────
  getSecreto() {
    return localStorage.getItem('clienteapp_totp_secret') || null;
  },

  // ── Guardar secreto ───────────────────────────────────────────────────────
  guardarSecreto(secreto) {
    localStorage.setItem('clienteapp_totp_secret', secreto);
  },

  // ── Eliminar 2FA ──────────────────────────────────────────────────────────
  eliminar() {
    localStorage.removeItem('clienteapp_totp_secret');
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCIONES INTERNAS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── HOTP (RFC 4226) ───────────────────────────────────────────────────────
  async _hotp(keyBytes, counter) {
    // Counter como 8 bytes big-endian
    const counterBuf = new ArrayBuffer(8);
    const view = new DataView(counterBuf);
    view.setUint32(4, counter, false); // big-endian, solo los 4 bytes bajos

    // HMAC-SHA1
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false, ['sign']
    );
    const hmac = await crypto.subtle.sign('HMAC', cryptoKey, counterBuf);
    const hmacArr = new Uint8Array(hmac);

    // Dynamic Truncation
    const offset = hmacArr[hmacArr.length - 1] & 0x0f;
    const code = (
      ((hmacArr[offset] & 0x7f) << 24) |
      ((hmacArr[offset + 1] & 0xff) << 16) |
      ((hmacArr[offset + 2] & 0xff) << 8) |
      (hmacArr[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
  },

  // ── Base32 Encode ─────────────────────────────────────────────────────────
  _base32Encode(bytes) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    let bits = 0;
    let value = 0;
    for (const byte of bytes) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        result += CHARS[(value >>> (bits - 5)) & 0x1f];
        bits -= 5;
      }
    }
    if (bits > 0) {
      result += CHARS[(value << (5 - bits)) & 0x1f];
    }
    return result;
  },

  // ── Base32 Decode ─────────────────────────────────────────────────────────
  _base32Decode(str) {
    const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    str = str.replace(/[= ]/g, '').toUpperCase();
    let bits = 0;
    let value = 0;
    const output = [];
    for (const c of str) {
      const idx = CHARS.indexOf(c);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return new Uint8Array(output);
  }
};
