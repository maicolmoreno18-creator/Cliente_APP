-- Agregar columna de token de sesión activa a usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS session_at TIMESTAMPTZ DEFAULT NULL;
