/* ============================================
   ClienteAPP — Auto-guardado en disco
   Usa File System Access API para escribir
   automáticamente un backup.json en una carpeta
   del computador elegida por el usuario.
   ============================================ */

window.AutoSave = {

  _dirHandle: null,       // Handle del directorio elegido
  _fileHandle: null,      // Handle del archivo backup.json
  _saving: false,         // Evitar escrituras simultáneas
  _pendiente: false,      // Si hay un cambio pendiente mientras se guarda
  _debounceTimer: null,   // Timer para agrupar cambios rápidos
  _conectado: false,      // Si ya se conectó la carpeta en esta sesión

  FILENAME: 'ClienteAPP_backup.json',
  DEBOUNCE_MS: 2000,      // Esperar 2 segundos después del último cambio

  // ── Verificar si el navegador soporta la API ──────────────────────────────
  isSupported() {
    return 'showDirectoryPicker' in window;
  },

  // ── Conectar carpeta (el usuario elige una vez por sesión) ────────────────
  async conectar() {
    if (!this.isSupported()) {
      UI.toast('Tu navegador no soporta guardado en disco. Usa Chrome o Edge.', 'warning');
      return false;
    }

    try {
      // Pedir al usuario que elija una carpeta
      this._dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      // Obtener o crear el archivo
      this._fileHandle = await this._dirHandle.getFileHandle(this.FILENAME, { create: true });
      this._conectado = true;

      // Guardar referencia en IndexedDB para reconexión rápida
      await this._guardarReferencia();

      UI.toast(`Carpeta conectada: guardado automático activo`, 'success');
      console.log('[AutoSave] Conectado a carpeta:', this._dirHandle.name);

      // Hacer un guardado inicial inmediato
      await this._guardarAhora();

      return true;
    } catch (e) {
      if (e.name === 'AbortError') {
        // Usuario canceló el picker
        return false;
      }
      console.error('[AutoSave] Error al conectar:', e);
      UI.toast('Error al conectar carpeta: ' + e.message, 'danger');
      return false;
    }
  },

  // ── Reconectar carpeta guardada (sin picker, verifica permisos) ───────────
  async reconectar() {
    if (!this.isSupported()) return false;

    try {
      const stored = await this._obtenerReferencia();
      if (!stored) return false;

      this._dirHandle = stored;

      // Verificar que aún tenemos permiso
      const perm = await this._dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this._fileHandle = await this._dirHandle.getFileHandle(this.FILENAME, { create: true });
        this._conectado = true;
        console.log('[AutoSave] Reconectado automáticamente a:', this._dirHandle.name);
        return true;
      }

      // Pedir permiso si fue revocado
      const req = await this._dirHandle.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') {
        this._fileHandle = await this._dirHandle.getFileHandle(this.FILENAME, { create: true });
        this._conectado = true;
        console.log('[AutoSave] Permiso re-otorgado:', this._dirHandle.name);
        return true;
      }

      return false;
    } catch (e) {
      console.warn('[AutoSave] No se pudo reconectar:', e.message);
      return false;
    }
  },

  // ── Desconectar (dejar de guardar automáticamente) ────────────────────────
  async desconectar() {
    this._dirHandle = null;
    this._fileHandle = null;
    this._conectado = false;
    await this._borrarReferencia();
    UI.toast('Guardado automático desactivado', 'warning');
  },

  // ── Disparar guardado (con debounce) ──────────────────────────────────────
  notificarCambio() {
    if (!this._conectado) return;

    // Si ya hay un timer, reiniciarlo (debounce)
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._guardarAhora();
    }, this.DEBOUNCE_MS);
  },

  // ── Realizar el guardado en disco ─────────────────────────────────────────
  async _guardarAhora() {
    if (!this._conectado || !this._fileHandle) return;

    // Si ya estamos guardando, marcar como pendiente
    if (this._saving) {
      this._pendiente = true;
      return;
    }

    this._saving = true;

    try {
      // Recopilar todos los datos (igual que el export manual)
      const [clientes, proyectos, pagos, seguimientos, finanzas, tareas, historial, archivos] = await Promise.all([
        DB.getAll(DB.STORES.clientes),
        DB.getAll(DB.STORES.proyectos),
        DB.getAll(DB.STORES.pagos),
        DB.getAll(DB.STORES.seguimientos),
        DB.getAll(DB.STORES.finanzas),
        DB.getAll(DB.STORES.tareas),
        DB.getAll(DB.STORES.historialEstados),
        DB.getAll(DB.STORES.archivos)
      ]);

      const backup = {
        version: '1.1.0',
        autoSavedAt: new Date().toISOString(),
        app: 'ClienteAPP',
        data: { clientes, proyectos, pagos, seguimientos, finanzas, tareas, historial, archivos }
      };

      // Escribir al archivo
      const writable = await this._fileHandle.createWritable();
      await writable.write(JSON.stringify(backup, null, 2));
      await writable.close();

      // Registrar fecha del último respaldo (cuenta para el recordatorio de backup)
      localStorage.setItem('clienteapp_ultimo_backup', new Date().toISOString());

      console.log('[AutoSave] Guardado:', new Date().toLocaleTimeString());
    } catch (e) {
      console.error('[AutoSave] Error al guardar:', e);
      // Si perdimos el permiso, marcar como desconectado
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        this._conectado = false;
        UI.toast('Se perdió el acceso a la carpeta. Reconecta desde Configuración.', 'warning');
      }
    } finally {
      this._saving = false;

      // Si hubo cambios mientras guardábamos, guardar de nuevo
      if (this._pendiente) {
        this._pendiente = false;
        setTimeout(() => this._guardarAhora(), 500);
      }
    }
  },

  // ── Restaurar datos desde el archivo en disco ─────────────────────────────
  async restaurarDesdeArchivo() {
    if (!this._conectado || !this._fileHandle) {
      UI.toast('Primero conecta una carpeta', 'warning');
      return false;
    }

    try {
      const file = await this._fileHandle.getFile();
      const text = await file.text();

      if (!text || text.trim().length === 0) {
        UI.toast('El archivo de backup está vacío', 'warning');
        return false;
      }

      const backup = JSON.parse(text);
      if (!backup.data) throw new Error('Formato inválido');

      const ok = await UI.confirm(
        `¿Restaurar datos del backup guardado el ${new Date(backup.autoSavedAt).toLocaleString()}?\n` +
        `Esto fusionará los datos con los actuales.`,
        'Restaurar desde disco'
      );
      if (!ok) return false;

      const { clientes, proyectos, pagos, seguimientos, finanzas, tareas, historial, archivos } = backup.data;
      for (const c of (clientes     || [])) await DB.put(DB.STORES.clientes, c);
      for (const p of (proyectos    || [])) await DB.put(DB.STORES.proyectos, p);
      for (const p of (pagos        || [])) await DB.put(DB.STORES.pagos, p);
      for (const s of (seguimientos || [])) await DB.put(DB.STORES.seguimientos, s);
      for (const f of (finanzas     || [])) await DB.put(DB.STORES.finanzas, f);
      for (const t of (tareas       || [])) await DB.put(DB.STORES.tareas, t);
      for (const h of (historial    || [])) await DB.put(DB.STORES.historialEstados, h);
      for (const a of (archivos     || [])) await DB.put(DB.STORES.archivos, a);

      UI.toast('Datos restaurados correctamente desde disco', 'success');
      return true;
    } catch (e) {
      console.error('[AutoSave] Error al restaurar:', e);
      UI.toast('Error al restaurar: ' + e.message, 'danger');
      return false;
    }
  },

  // ── Estado actual ─────────────────────────────────────────────────────────
  estaConectado() {
    return this._conectado;
  },

  getNombreCarpeta() {
    return this._dirHandle?.name || null;
  },

  // ── Persistir referencia del directorio en IndexedDB ──────────────────────
  async _guardarReferencia() {
    try {
      // Guardamos el handle del directorio en IndexedDB dedicado
      const dbReq = indexedDB.open('ClienteAPP_AutoSave', 1);
      dbReq.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('handles', { keyPath: 'id' });
      };
      const idb = await new Promise((res, rej) => {
        dbReq.onsuccess = () => res(dbReq.result);
        dbReq.onerror = () => rej(dbReq.error);
      });
      const tx = idb.transaction('handles', 'readwrite');
      tx.objectStore('handles').put({ id: 'dir', handle: this._dirHandle });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      idb.close();
    } catch (e) {
      console.warn('[AutoSave] No se pudo guardar referencia:', e.message);
    }
  },

  async _obtenerReferencia() {
    try {
      const dbReq = indexedDB.open('ClienteAPP_AutoSave', 1);
      dbReq.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('handles', { keyPath: 'id' });
      };
      const idb = await new Promise((res, rej) => {
        dbReq.onsuccess = () => res(dbReq.result);
        dbReq.onerror = () => rej(dbReq.error);
      });
      const tx = idb.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get('dir');
      const result = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      idb.close();
      return result?.handle || null;
    } catch (e) {
      return null;
    }
  },

  async _borrarReferencia() {
    try {
      const dbReq = indexedDB.open('ClienteAPP_AutoSave', 1);
      dbReq.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('handles', { keyPath: 'id' });
      };
      const idb = await new Promise((res, rej) => {
        dbReq.onsuccess = () => res(dbReq.result);
        dbReq.onerror = () => rej(dbReq.error);
      });
      const tx = idb.transaction('handles', 'readwrite');
      tx.objectStore('handles').delete('dir');
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      idb.close();
    } catch (e) {
      console.warn('[AutoSave] Error borrando referencia:', e.message);
    }
  }
};
