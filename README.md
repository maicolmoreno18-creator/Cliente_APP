# ClienteAPP 3.0 — CRM Casas Prefabricadas

> Sistema CRM profesional para gestión de clientes, proyectos, pagos y seguimiento de obras de casas prefabricadas. Desarrollado para **Construsoluciones del Meta**. Funciona 100% en el navegador, sin servidor ni base de datos externa.

---

## 🚀 Inicio rápido

### Opción 1 — Abrir directo
Abre `index.html` en Chrome o Edge. Funciona sin servidor para uso básico.

### Opción 2 — Servidor local (recomendado para PWA)
Para que el Service Worker y la instalación como app funcionen correctamente:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code — instala "Live Server" y haz clic en "Go Live"
```

Luego abre: `http://localhost:8080`

---

## 🔐 Credenciales de acceso

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Super Administrador |

---

## 📦 Stack tecnológico

| Tecnología | Uso |
|---|---|
| HTML5 + CSS3 | Estructura y estilos |
| Bootstrap 5.3 | Componentes UI y grid |
| Bootstrap Icons 1.11 | Iconografía |
| JavaScript Vanilla ES6+ | Lógica de la aplicación |
| IndexedDB | Base de datos local en el navegador |
| Service Worker (v22+) | PWA offline-first, network-first |
| jsPDF 2.5.1 | Generación de PDFs (local, offline) |
| html2canvas 1.4.1 | Renderizado de HTML a imagen (local, offline) |
| Web Crypto API | Hash de contraseñas SHA-256 + TOTP 2FA |
| File System Access API | Auto-guardado automático en disco |

> Sin backend de datos. Sin base de datos externa. Sin dependencias npm. Todo corre en el navegador. Supabase solo para usuarios compartidos.

---

## ✨ Módulos (19 archivos JS)

### 📊 Dashboard
- Hero con indicadores: clientes activos, en obra, recaudado, pendiente
- KPIs con animaciones y gradientes
- Anillo SVG de progreso de cobros (recibido / pendiente / total)
- Pipeline de ventas por etapa
- Sección **"A quién llamar hoy"** con prioridades (urgente / importante / rutinario)
- Resumen financiero por cliente con barras de progreso
- Entregas próximas con cuenta regresiva

### 👥 Clientes
- CRUD completo: nombre, teléfono, ubicación, notas
- Pipeline de **7 estados**: Nuevo → Cotizado → Negociación → Firmado → En Construcción → Finalizado → Perdido
- Búsqueda en tiempo real y filtros por estado con pills
- WhatsApp directo con mensaje predefinido
- Paginación (20 por carga)

### 🏠 Proyectos
- Modelo, área (m²), precio total, fecha de entrega
- **Filtros y ordenamiento** (7 criterios: recientes, antiguos, fecha entrega, precio, área, modelo)
- **Especificaciones técnicas completas:**
  - Sistema constructivo (Plaqueta / Bloquelón / Mixto)
  - Estilo de la vivienda
  - Altura mínima y máxima
  - Tipo de cubierta
  - **Ornamentación mixta** (Corredizo, Abatible o Sistema mixto con sub-configuración)
  - Puertas internas (color + chapa)
  - **Obsequios** (configurable desde Configuración)
- Placa de cimentación opcional (cobro independiente)
- Galería de evidencias fotográficas (JPG/PNG/PDF) con lightbox y zoom
- Modo cotización (sin pagos) y modo firmado (con pagos activos)

### 💰 Pagos
- Etapas automáticas al firmar: **50% firma / 40% materiales / 10% techo**
- Placa de cimentación como etapa independiente
- Modal con **dos modos**: agregar abono (suma automática) o corregir total
- **Historial de abonos** por etapa: monto, fecha, método de pago, nota
- **Edición de abonos individuales** (monto, fecha, método, nota)
- Eliminación de abonos con recálculo automático del total
- Estado (pendiente/parcial/pagado) calculado automáticamente

### 🧾 Recibos de Pago
- Por **abono individual** o por **etapa completa**
- **Logo de Construsoluciones del Meta** en encabezado
- **Sello de la empresa** estampado (solo en PDF, no al imprimir)
- Especificaciones básicas de la casa incluidas
- Una sola página carta garantizada (escala automático)
- Imprimir (sin sello) o Descargar PDF (con sello)

### 📄 Especificaciones Técnicas
- Documento PDF sin información de precios
- Incluye características técnicas, obsequios y notas del proyecto
- Tamaño carta, diseño profesional
- Disponible desde el expediente del cliente

### 📁 Expediente del Cliente
- Tabs: Proyecto · Pagos · Seguimiento · Historial de estados
- Historial de cambios de estado con línea de tiempo y duración por etapa
- Botones de acción: Editar · Imprimir especificaciones · Descargar PDF

### 💬 Seguimiento
- Timeline de interacciones: llamada, WhatsApp, visita, reunión, nota, recordatorio
- Recordatorios con notificación push del navegador
- Historial ordenado por fecha

### 💼 Mis Finanzas
- Registro de comisiones por proyecto con porcentaje configurable
- Control de préstamos personales y abonos
- Base mensual con distribución automática entre préstamos
- Balance disponible en tiempo real

### ✅ Tareas
- CRUD completo con categorías (Planos, Materiales, Admin, Cliente, Obra, Finanzas)
- Prioridades (Alta / Media / Baja) con colores
- Filtros por estado, prioridad, categoría y fecha
- **12 plantillas predefinidas** del flujo de trabajo
- Vinculación opcional a un cliente

### ⚙️ Configuración
- Cambiar nombre para mostrar
- Cambiar contraseña
- Autenticator 2FA (Google Authenticator, Authy)
- Gestión de usuarios (solo superadmin)
- **Personalización de catálogos**: sistemas constructivos, cubiertas, ornamentación, colores, chapas, **obsequios**
- **Indicador de estado del backup** (verde/amarillo/rojo)
- Auto-guardado en disco con File System Access API
- Exportar / Importar backup JSON
- Limpieza de datos

### 🔒 Autenticación y Seguridad
- Login con hash SHA-256
- Sesión en localStorage con **caducidad de 8 horas**
- Rate-limiting progresivo (5 intentos → 5 min, 10 → 30 min, 15 → TOTP)
- 2FA TOTP (RFC 4226, sin dependencias externas)
- Sesión única por usuario (best-effort con Supabase)
- Fallback local si Supabase no responde (timeout 5s)

---

## 🎨 Diseño y UX

- **Splash screen** con logo de Construsoluciones al iniciar
- Privacidad de dinero: botón 👁️ que difumina todos los valores monetarios
- Toasts con sonido (Web Audio API) y barra de progreso
- Búsqueda global `Ctrl+K`: clientes, proyectos, pagos
- Notificaciones inteligentes de pagos y entregas próximas
- **Recordatorio de backup** automático si pasan +7 días
- Responsive completo para móvil y tablet
- Calculadora / cotizador flotante

---

## 💾 Backup y datos

Los datos se guardan en **IndexedDB** del navegador (local, privado).

Para hacer backup:
1. **Configuración → Exportar** → se descarga `ClienteAPP_backup_FECHA.json`
2. Para restaurar: **Configuración → Importar** ese `.json`

**Auto-guardado en disco:** conecta una carpeta desde Configuración y los datos se guardan automáticamente cada 2 segundos tras un cambio (requiere Chrome/Edge).

> ⚠️ Importante: los datos viven en el navegador. Si cambias de navegador o equipo, exporta el backup antes y luego impórtalo.

---

## 📱 Instalar como app (PWA)

**Chrome / Edge (PC o Android):**
1. Abre la app en el navegador
2. Clic en los 3 puntos → *"Instalar ClienteAPP"*

**Safari (iPhone / iPad):**
1. Abre en Safari → Botón Compartir → *"Agregar a pantalla de inicio"*

---

## 📁 Estructura del proyecto

```
ClienteAPP_7/
├── index.html                  # App principal (SPA + modales)
├── manifest.json               # Configuración PWA
├── sw.js                       # Service Worker (offline, network-first)
├── README.md
├── supabase_schema.sql         # Schema de la tabla de usuarios en Supabase
├── supabase_add_session.sql    # Migración: session_token
└── assets/
    ├── css/
    │   └── app.css             # Estilos + privacidad de dinero
    ├── img/
    │   ├── icon-192.svg/png    # Ícono PWA
    │   ├── icon-512.png        # Ícono PWA grande
    │   ├── logo-construsoluciones.png  # Logo empresa
    │   └── sello-construsoluciones.png # Sello empresa (PDFs)
    ├── vendor/
    │   ├── jspdf.umd.min.js    # PDF local (offline)
    │   └── html2canvas.min.js  # Captura HTML local (offline)
    └── js/
        ├── app.js              # Router, expediente, búsqueda, notificaciones
        ├── auth.js             # Autenticación, sesión 8h, rate-limiting
        ├── autosave.js         # Auto-guardado en disco
        ├── calculadora.js      # Calculadora / cotizador flotante
        ├── clientes.js         # Módulo clientes
        ├── configuracion.js    # Configuración, backup, personalización
        ├── dashboard.js        # Dashboard visual
        ├── db.js               # IndexedDB wrapper v5
        ├── finanzas.js         # Finanzas personales
        ├── opciones.js         # Catálogos configurables
        ├── pagos.js            # Pagos, historial de abonos, edición
        ├── print.js            # PDF especificaciones técnicas
        ├── proyectos.js        # Proyectos, ornamentación, filtros
        ├── recibos.js          # Recibos de pago con logo y sello
        ├── seguimiento.js      # Timeline de seguimiento
        ├── supabase.js         # Cliente Supabase (solo usuarios)
        ├── tareas.js           # Gestión de tareas
        ├── totp.js             # TOTP 2FA (RFC 4226)
        └── ui.js               # UI helpers, toasts, privacidad dinero
```

---

## 🛠️ Desarrollo

No requiere instalación de dependencias. Todas las librerías críticas están locales en `assets/vendor/`.

1. Clona o descarga el repositorio
2. Abre en VS Code
3. Instala **Live Server** y haz clic en **Go Live**
4. Edita cualquier archivo — los cambios se toman automáticamente (SW network-first)

---

## 📋 Changelog

### v3.0 (Septiembre 2026)
- ✨ Splash screen con logo de Construsoluciones al iniciar
- ✨ Edición de abonos individuales en historial de pagos
- ✨ Filtros y ordenamiento en página de Proyectos
- ✨ Recordatorio automático de backup (+7 días sin respaldo)
- ✨ Indicador visual de estado del backup en Configuración
- ✨ Obsequios como nueva característica técnica configurable
- ✨ Sistema mixto de ornamentación (corredizas + abatibles)
- ✨ Historial de abonos por etapa (monto, fecha, método, nota)
- ✨ Recibos de pago en PDF con logo y sello de Construsoluciones
- 🔧 Sesión migrada a localStorage con caducidad de 8 horas
- 🔧 Login robusto: timeout 5s a Supabase + fallback local
- 🔧 Service Worker network-first (actualización automática sin Ctrl+Shift+R)
- 🔧 jsPDF y html2canvas locales (PDF funciona offline)
- 🔧 Seguridad XSS cerrada en notas, modelo, archivos, tareas, finanzas

### v2.0 (Junio 2026)
- Especificaciones técnicas en PDF
- Módulo de finanzas personales (comisiones, préstamos, base)
- Historial de estados del proyecto con línea de tiempo
- Auto-guardado en disco (File System Access API)
- 2FA TOTP con Google Authenticator
- Búsqueda global Ctrl+K
- Galería de evidencias fotográficas con lightbox

### v1.0 (2025)
- CRM base: clientes, proyectos, pagos, seguimiento
- Pipeline de 7 estados
- Dashboard con KPIs
- Sistema de tareas
- Exportar/importar backup JSON
- PWA instalable

---

*Desarrollado por **OracleTech** (Ingeniero George Moreno) para Construsoluciones del Meta.*
*© 2026 — Todos los derechos reservados.*
# Cliente_APP
