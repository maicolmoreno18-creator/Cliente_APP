/* ============================================
   ClienteAPP — Supabase (solo usuarios)
   Login compartido en la nube.
   Todo lo demás usa IndexedDB local.
   ============================================ */

const SUPABASE_URL = 'https://jjtlgesknsenYajqkymg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqdGxnZXNrbnNlbnlhanFreW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDM4MDAsImV4cCI6MjA5NTQxOTgwMH0.tsSVCClNS78mkbPsHAXH6dlOnmI5Jp_dffaiR2rRSRo';

let _sbClient = null;

window.SupabaseUsers = {

  // ── Inicializar ───────────────────────────────────────────────────────────
  init() {
    if (typeof window.supabase === 'undefined') {
      console.warn('[Supabase] SDK no cargado — usuarios solo locales');
      return false;
    }
    _sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Supabase] Usuarios en la nube activos');
    return true;
  },

  // ── Seed: crear superadmin si no existe ──────────────────────────────────
  async seed() {
    if (!_sbClient) return;
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
      const { data } = await Promise.race([
        _sbClient.from('usuarios').select('id').limit(1),
        timeout
      ]);
      if (data && data.length === 0) {
        const hash = await this._hash('admin123');
        await _sbClient.from('usuarios').insert({
          id:       this._uuid(),
          nombre:   'George',
          login:    'admin',
          password: hash,
          rol:      'superadmin',
          activo:   true
        });
        console.log('[Supabase] Superadmin creado en la nube');
      } else {
        // Migrar admin → superadmin si aplica
        await _sbClient.from('usuarios')
          .update({ rol: 'superadmin' })
          .eq('login', 'admin')
          .eq('rol', 'admin');
      }
    } catch (e) {
      console.error('[Supabase] Error seed:', e);
    }
  },

  // ── Obtener todos los usuarios ────────────────────────────────────────────
  async getAll() {
    if (!_sbClient) return [];
    const { data, error } = await _sbClient.from('usuarios').select('*');
    if (error) { console.error('[Supabase] getAll usuarios:', error); return []; }
    return data || [];
  },

  // ── Obtener un usuario por ID ─────────────────────────────────────────────
  async get(id) {
    if (!_sbClient) return null;
    const { data } = await _sbClient.from('usuarios').select('*').eq('id', id).single();
    return data || null;
  },

  // ── Guardar / actualizar usuario ──────────────────────────────────────────
  async put(usuario) {
    if (!_sbClient) return usuario;
    if (!usuario.id) usuario.id = this._uuid();
    const { data, error } = await _sbClient.from('usuarios').upsert(usuario).select().single();
    if (error) { console.error('[Supabase] put usuario:', error); throw error; }
    return data || usuario;
  },

  // ── Eliminar usuario ──────────────────────────────────────────────────────
  async delete(id) {
    if (!_sbClient) return;
    const { error } = await _sbClient.from('usuarios').delete().eq('id', id);
    if (error) { console.error('[Supabase] delete usuario:', error); throw error; }
  },

  // ── Buscar usuario por login ──────────────────────────────────────────────
  async findByLogin(login) {
    if (!_sbClient) return null;
    try {
      // Timeout de 5 segundos para no bloquear el login si Supabase tarda
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );
      const queryPromise = _sbClient
        .from('usuarios')
        .select('*')
        .eq('login', login.trim())
        .single();
      const { data } = await Promise.race([queryPromise, timeoutPromise]);
      return data || null;
    } catch (e) {
      console.warn('[Supabase] findByLogin falló (modo offline):', e.message);
      return null; // cae al fallback local
    }
  },

  // ── Registrar sesión activa (token único por usuario) ─────────────────────
  async registrarSesion(userId) {
    if (!_sbClient) return null;
    try {
      const token = this._uuid();
      await _sbClient.from('usuarios')
        .update({ session_token: token, session_at: new Date().toISOString() })
        .eq('id', userId);
      return token;
    } catch (e) {
      console.warn('[Supabase] registrarSesion falló (modo offline):', e.message);
      return null; // no bloquear el login si Supabase no responde
    }
  },

  // ── Verificar si el token sigue siendo válido ─────────────────────────────
  async verificarSesion(userId, token) {
    if (!_sbClient) return true; // sin Supabase, siempre válido
    const { data } = await _sbClient
      .from('usuarios')
      .select('session_token')
      .eq('id', userId)
      .single();
    return data?.session_token === token;
  },

  // ── Cerrar sesión (limpiar token) ─────────────────────────────────────────
  async cerrarSesion(userId) {
    if (!_sbClient) return;
    try {
      await _sbClient.from('usuarios')
        .update({ session_token: null, session_at: null })
        .eq('id', userId);
    } catch (e) {
      console.error('[Supabase] cerrarSesion error:', e);
    }
  },

  // ── Verificar si ya hay sesión activa ─────────────────────────────────────
  async tieneSesionActiva(userId) {
    if (!_sbClient) return false;
    try {
      const { data } = await _sbClient
        .from('usuarios')
        .select('session_token, session_at')
        .eq('id', userId)
        .single();
      if (!data?.session_token) return false;
      // Considerar sesión expirada si tiene más de 8 horas sin actividad
      if (data.session_at) {
        const horas = (Date.now() - new Date(data.session_at).getTime()) / 3600000;
        if (horas > 8) return false;
      }
      return true;
    } catch (e) {
      console.warn('[Supabase] tieneSesionActiva falló (modo offline):', e.message);
      return false; // en caso de error de red, permitir el login
    }
  },

  // ── Hash SHA-256 ──────────────────────────────────────────────────────────
  async _hash(plain) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plain));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── UUID v4 ───────────────────────────────────────────────────────────────
  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
};
