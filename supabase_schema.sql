-- ============================================
-- ClienteAPP — Schema Supabase
-- Ejecutar en: Supabase → SQL Editor
-- ============================================

-- Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  login TEXT UNIQUE,
  password TEXT,
  rol TEXT DEFAULT 'admin',
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT,
  telefono TEXT,
  ubicacion TEXT,
  estado TEXT DEFAULT 'nuevo',
  notas TEXT,
  ultimo_seguimiento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proyectos
CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  modelo TEXT,
  area NUMERIC,
  precio NUMERIC,
  especificaciones JSONB,
  incluye_placa BOOLEAN DEFAULT false,
  placa_precio NUMERIC DEFAULT 0,
  notas TEXT,
  fecha_entrega DATE,
  archivos JSONB DEFAULT '[]',
  fecha_ini_construccion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos
CREATE TABLE IF NOT EXISTS pagos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  proyecto_id TEXT,
  etapa TEXT,
  etapa_label TEXT,
  porcentaje NUMERIC,
  valor_total NUMERIC DEFAULT 0,
  valor_pagado NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  fecha DATE,
  observaciones TEXT,
  es_placa BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguimientos
CREATE TABLE IF NOT EXISTS seguimientos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  tipo TEXT,
  descripcion TEXT,
  recordatorio TIMESTAMPTZ,
  recordatorio_mostrado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finanzas
CREATE TABLE IF NOT EXISTS finanzas (
  id TEXT PRIMARY KEY,
  tipo TEXT,
  proyecto_id TEXT,
  prestamo_id TEXT,
  monto NUMERIC DEFAULT 0,
  fecha DATE,
  destino TEXT,
  descripcion TEXT,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tareas
CREATE TABLE IF NOT EXISTS tareas (
  id TEXT PRIMARY KEY,
  titulo TEXT,
  categoria TEXT,
  prioridad TEXT DEFAULT 'media',
  fecha DATE,
  cliente_id TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historial de estados
CREATE TABLE IF NOT EXISTS historial_estados (
  id TEXT PRIMARY KEY,
  cliente_id TEXT,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  usuario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Config
CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY,
  key TEXT UNIQUE,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Deshabilitar RLS (Row Level Security) en todas las tablas ──
ALTER TABLE usuarios         DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes         DISABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos        DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE seguimientos     DISABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas         DISABLE ROW LEVEL SECURITY;
ALTER TABLE tareas           DISABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estados DISABLE ROW LEVEL SECURITY;
ALTER TABLE config           DISABLE ROW LEVEL SECURITY;

-- ── Índices para mejorar rendimiento ──
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id    ON proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id        ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proyecto_id       ON pagos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_seguimientos_cliente_id ON seguimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_tipo           ON finanzas(tipo);
CREATE INDEX IF NOT EXISTS idx_tareas_estado           ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_historial_cliente_id    ON historial_estados(cliente_id);
