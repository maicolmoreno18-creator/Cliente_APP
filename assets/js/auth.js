/* ============================================
   ClienteAPP — Autenticación
   Usuarios en Supabase (nube) — datos en IndexedDB (local)
   Rate limiting progresivo + TOTP (Authenticator)
   ============================================ */

const SESSION_KEY = 'clienteapp_session';
const LOCK_KEY    = 'clienteapp_login_lock';
// Duración máxima de una sesión local antes de exigir login de nuevo (8 horas)
const SESSION_MAX_MS = 8 * 60 * 60 * 1000;

window.Auth = {

  // ── Hash SHA-256 ──────────────────────────────────────────────────────────
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(password);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── Obtener estado de bloqueo desde localStorage ──────────────────────────
  _getLockState() {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (!raw) return { attempts: 0, lockedUntil: 0, requiresTOTP: false };
      return JSON.parse(raw);
    } catch { return { attempts: 0, lockedUntil: 0, requiresTOTP: false }; }
  },

  _saveLockState(state) {
    localStorage.setItem(LOCK_KEY, JSON.stringify(state));
  },

  _clearLockState() {
    localStorage.removeItem(LOCK_KEY);
  },

  // ── Verificar si está bloqueado ───────────────────────────────────────────
  estasBloqueado() {
    const state = this._getLockState();

    // Si requiere TOTP (15+ intentos), siempre bloqueado hasta verificar
    if (state.requiresTOTP) return { bloqueado: true, requiereTOTP: true, intentos: state.attempts };

    // Si hay un lock con tiempo, verificar si ya pasó
    if (state.lockedUntil > 0) {
      if (Date.now() < state.lockedUntil) {
        const segs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
        return { bloqueado: true, requiereTOTP: false, segundos: segs, intentos: state.attempts };
      }
      // El tiempo expiró, quitar el lock temporal (pero mantener intentos)
      state.lockedUntil = 0;
      this._saveLockState(state);
    }

    return { bloqueado: false, requiereTOTP: false, intentos: state.attempts };
  },

  // ── Login — busca usuario en Supabase ─────────────────────────────────────
  async login(loginInput, password) {
    // Verificar bloqueo
    const lock = this.estasBloqueado();
    if (lock.bloqueado) {
      if (lock.requiereTOTP) {
        throw new Error('🔒 Cuenta bloqueada. Ingresa el código de tu Authenticator para desbloquear.');
      }
      const mins = Math.floor(lock.segundos / 60);
      const segs = lock.segundos % 60;
      const tiempo = mins > 0 ? `${mins}m ${segs}s` : `${segs} segundos`;
      throw new Error(`🔒 Demasiados intentos. Bloqueado por ${tiempo}.`);
    }

    const hashed = await this.hashPassword(password);

    // Buscar usuario en Supabase
    let user = await SupabaseUsers.findByLogin(loginInput.trim());

    // Fallback: buscar en IndexedDB local (por si acaso)
    if (!user) {
      const locales = await DB.getAll(DB.STORES.usuarios);
      user = locales.find(u => u.login === loginInput.trim() && u.activo !== false) || null;
    }

    if (!user || user.activo === false) {
      this._registrarFallo();
      throw new Error(this._mensajeError());
    }

    // Verificar contraseña (SHA-256 o legacy Base64)
    const isLegacy = user.password && user.password.length < 50;
    const ok = isLegacy
      ? user.password === btoa(password)
      : user.password === hashed;

    if (!ok) {
      this._registrarFallo();
      throw new Error(this._mensajeError());
    }

    // Migrar legacy → SHA-256
    if (isLegacy) {
      user.password = hashed;
      await SupabaseUsers.put(user);
    }

    // ── Sesión única: bloquear si ya hay otra sesión activa ───────────────
    if (user.rol !== 'superadmin') {
      const yaActivo = await SupabaseUsers.tieneSesionActiva(user.id);
      if (yaActivo) {
        throw new Error(
          `⚠️ "${user.login}" ya tiene una sesión activa en otro dispositivo. ` +
          `Cierra sesión allí primero. Si crees que es un error, espera 8 horas ` +
          `o contacta al administrador para que la libere.`
        );
      }
    }

    // Login exitoso → limpiar bloqueo
    this._clearLockState();

    // Registrar token de sesión en Supabase
    const sessionToken = await SupabaseUsers.registrarSesion(user.id);

    const session = {
      id:           user.id,
      nombre:       user.nombre,
      login:        user.login,
      rol:          user.rol,
      loginTime:    new Date().toISOString(),
      sessionToken
    };

    // Guardar sesión en localStorage (persiste entre recargas y cierres de pestaña)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // Registrar presencia en línea
    const presencia = JSON.parse(localStorage.getItem('clienteapp_presencia') || '{}');
    presencia[user.id] = { nombre: user.nombre, login: user.login, desde: new Date().toISOString() };
    localStorage.setItem('clienteapp_presencia', JSON.stringify(presencia));

    return session;
  },

  // ── Desbloquear con TOTP ──────────────────────────────────────────────────
  async desbloquearConTOTP(codigo) {
    if (!TOTP.estaConfigurado()) {
      throw new Error('El Authenticator no está configurado. Espera a que expire el bloqueo.');
    }

    const secreto = TOTP.getSecreto();
    const valido = await TOTP.verificar(secreto, codigo);

    if (!valido) {
      throw new Error('Código incorrecto. Intenta con el código actual de tu Authenticator.');
    }

    // Código correcto → limpiar bloqueo completamente
    this._clearLockState();
    return true;
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout() {
    const session = this.getSession();
    // Limpiar sesión local SIEMPRE primero (en localStorage y sessionStorage por compatibilidad)
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    // Recargar UNA sola vez, gane quien gane la carrera (respuesta de Supabase o timeout)
    let recargado = false;
    const recargarUnaVez = () => {
      if (recargado) return;
      recargado = true;
      location.reload();
    };

    if (session?.id) {
      const presencia = JSON.parse(localStorage.getItem('clienteapp_presencia') || '{}');
      delete presencia[session.id];
      localStorage.setItem('clienteapp_presencia', JSON.stringify(presencia));
      // Cerrar sesión en Supabase en segundo plano; recargar sin esperar la red
      SupabaseUsers.cerrarSesion(session.id).finally(recargarUnaVez);
      // Si Supabase tarda, recargar de todas formas tras 1.5s (lo que ocurra primero)
      setTimeout(recargarUnaVez, 1500);
    } else {
      recargarUnaVez();
    }
  },

  // ── Sesión actual ─────────────────────────────────────────────────────────
  getSession() {
    try {
      // Preferir localStorage (persistente). Fallback a sessionStorage por si
      // quedó una sesión de la versión anterior.
      let raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        raw = sessionStorage.getItem(SESSION_KEY);
        // Migrar sesión vieja de sessionStorage a localStorage
        if (raw) localStorage.setItem(SESSION_KEY, raw);
      }
      if (!raw) return null;

      const session = JSON.parse(raw);

      // ── Caducidad: expira 8 horas después del login ──────────────────────
      if (session?.loginTime) {
        const edadMs = Date.now() - new Date(session.loginTime).getTime();
        if (edadMs > SESSION_MAX_MS) {
          // Sesión vencida → limpiar y forzar nuevo login
          localStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(SESSION_KEY);
          return null;
        }
      }

      return session;
    } catch { return null; }
  },

  isAuthenticated() { return !!this.getSession(); },

  hasRole(...roles) {
    const s = this.getSession();
    return s && roles.includes(s.rol);
  },

  isAdmin()      { return this.hasRole('admin', 'superadmin'); },
  isSuperAdmin() { return this.hasRole('superadmin'); },

  getRoleName(rol) {
    const names = {
      superadmin: 'Super Administrador',
      admin:      'Administrador',
      asesor:     'Asesor de Ventas',
      tecnico:    'Técnico de Obra'
    };
    return names[rol] || rol;
  },

  // ── Registrar intento fallido (progresivo) ────────────────────────────────
  _registrarFallo() {
    const state = this._getLockState();
    state.attempts++;

    // 5 intentos → bloqueo 5 minutos
    if (state.attempts >= 15) {
      // 15+ intentos → bloqueo indefinido (requiere TOTP)
      if (TOTP.estaConfigurado()) {
        state.requiresTOTP = true;
        state.lockedUntil = 0;
      } else {
        // Sin TOTP configurado → bloqueo 2 horas
        state.lockedUntil = Date.now() + (2 * 60 * 60 * 1000);
      }
    } else if (state.attempts >= 10) {
      // 10 intentos → bloqueo 30 minutos
      state.lockedUntil = Date.now() + (30 * 60 * 1000);
    } else if (state.attempts >= 5) {
      // 5 intentos → bloqueo 5 minutos
      state.lockedUntil = Date.now() + (5 * 60 * 1000);
    }

    this._saveLockState(state);
  },

  // ── Mensaje de error según estado ─────────────────────────────────────────
  _mensajeError() {
    const state = this._getLockState();

    if (state.requiresTOTP) {
      return '🔒 Cuenta bloqueada por demasiados intentos. Usa tu Authenticator para desbloquear.';
    }

    if (state.lockedUntil > 0 && Date.now() < state.lockedUntil) {
      const segs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      const mins = Math.floor(segs / 60);
      if (mins > 0) return `🔒 Bloqueado por ${mins} minutos. Demasiados intentos fallidos.`;
      return `🔒 Bloqueado por ${segs} segundos. Demasiados intentos fallidos.`;
    }

    const r = 5 - (state.attempts % 5 || 5);
    if (r <= 0) return '🔒 Demasiados intentos fallidos.';
    return `Usuario o contraseña incorrectos. ${r} intento${r !== 1 ? 's' : ''} restante${r !== 1 ? 's' : ''}.`;
  }
};
