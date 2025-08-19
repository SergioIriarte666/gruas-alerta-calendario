# TMS Grúas - Sistema de Gestión de Servicios de Grúas v2.1.0

## 🚛 Descripción

Towing Manage System es un sistema integral de gestión para empresas de servicios de grúas que permite administrar de manera eficiente todos los aspectos del negocio: servicios, clientes, operadores, equipos, **inventario y bodega**, facturación y reportes. Incluye funcionalidades avanzadas como inspecciones digitales, portal de clientes, **sistema completo de gestión de inventario con alertas automáticas** y gestión de recursos en tiempo real.

## ✨ Características Principales

### 📊 Dashboard Ejecutivo Responsive en Tiempo Real
- Métricas adaptativas por dispositivo con Chile timezone
- Alertas optimizadas para móviles y tablets
- Servicios futuros con vista responsive
- Panel de alertas interactivo táctil
- **Sistema responsive avanzado** con hooks personalizados
- **Experiencia mobile-first** completamente optimizada

### 🚚 Gestión Completa de Servicios
- Creación y seguimiento completo de servicios
- Sistema de folios automático con numeración inteligente
- Asignación automática de recursos (grúas y operadores)
- Estados en tiempo real con notificaciones
- Filtros avanzados y búsqueda inteligente
- Sistema de cierres de servicios por período

### 👥 Portal del Operador Avanzado
- Aplicación móvil optimizada PWA
- **Sistema de inspecciones digitales completo**
- Captura de fotos con categorización automática
- Firmas digitales de operador y cliente
- Generación automática de PDFs profesionales
- Envío automático por email
- Interface táctil optimizada

### 🏢 Portal de Clientes Independiente
- Dashboard personalizado por cliente
- **Solicitud de servicios con formulario dinámico**
- Descarga de documentos de inspección
- Seguimiento de servicios en tiempo real
- Interface móvil completamente optimizada
- Autenticación separada del sistema principal

### 💰 Módulo Financiero Completo
- **Sistema de cierres de servicios por período**
- Facturación automática desde cierres
- Control de costos operativos detallado
- **Sistema de carga XML para facturas chilenas (DTE)**
- Procesamiento automático de DTEs con categorización inteligente
- Reportes de rentabilidad avanzados
- Gestión de estados de facturación

### 📋 Gestión de Recursos Inteligente
- Control completo de flota de grúas
- Gestión de operadores con licencias
- **Sistema de invitaciones por email automatizado**
- Alertas de vencimientos automáticas
- Mantenimiento preventivo programado

### 📦 **Sistema de Inventario y Bodega Completo** (NUEVO v2.1.0)
- **Gestión de productos**: Catálogo completo con categorías, SKU, códigos de barra
- **Control de stock**: Seguimiento en tiempo real por ubicación
- **Movimientos de inventario**: Entradas, salidas, transferencias y ajustes automáticos
- **Sistema de alertas automáticas**: Stock bajo, sobrestock, productos sin movimiento
- **Dashboard de inventario**: Métricas visuales y reportes en tiempo real
- **Gestión de proveedores**: Control de suministros y órdenes de compra
- **Reportes de valorización**: Análisis de costos y consumo por grúa/operador
- **Sistema inteligente de reposición**: Alertas predictivas de compras

### 🔔 Sistema de Notificaciones Push
- Notificaciones en tiempo real
- Configuración por tipo de usuario
- Funcionamiento offline con PWA
- Integración nativa con dispositivos

## 🛠️ Stack Tecnológico

### Frontend Responsive Avanzado
- **React 18** + **TypeScript** para desarrollo moderno
- **Vite** para builds optimizados y desarrollo rápido
- **Tailwind CSS** + **shadcn/ui** para diseño responsive consistente
- **Hooks personalizados**: `useDeviceType`, `useBreakpoint` para detección de dispositivos
- **Sistema de breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **React Query** para gestión de estado servidor
- **React Router** para navegación SPA adaptativa

### Backend Escalable
- **Supabase** como Backend-as-a-Service completo
- **PostgreSQL** con Row Level Security
- **Edge Functions** para lógica serverless
- **Resend** para emails transaccionales
- **Real-time subscriptions** para actualizaciones instantáneas

### Herramientas Especializadas
- **jsPDF** + **jsPDF AutoTable** para documentos profesionales
- **React Hook Form** + **Zod** para formularios robustos
- **date-fns** + **date-fns-tz** para manejo de zonas horarias
- **React Signature Canvas** para firmas digitales
- **Parser XML Avanzado** para facturas chilenas DTE
- **PWA** con Service Workers para funcionalidad offline

## 🚀 Instalación Rápida

### Prerrequisitos
- Node.js 18+ 
- npm 8+
- Cuenta en Supabase
- Cuenta en Resend (para emails)

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-empresa/tms-gruas.git
cd tms-gruas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📚 Documentación Completa

### Guías de Usuario
- **[Manual de Usuario](docs/MANUAL_USUARIO.md)** - Guía completa del sistema
- **[Portal de Clientes](docs/PORTAL_CLIENTE.md)** - Guía específica del portal
- **[Guía de Instalación](docs/GUIA_INSTALACION.md)** - Instalación paso a paso

### Documentación Técnica
- **[Documentación Técnica](docs/DOCUMENTACION_TECNICA.md)** - Arquitectura y APIs
- **[Arquitectura del Sistema](docs/ARQUITECTURA.md)** - Diseño y patrones
- **[Arquitectura Portal](docs/ARQUITECTURA_PORTAL.md)** - Portal de clientes

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes React organizados por módulo
│   ├── ui/             # Componentes base shadcn/ui
│   ├── operator/       # Módulo de operadores
│   │   ├── PhotoCapture.tsx          # Captura de fotos
│   │   ├── SignaturePad.tsx          # Firmas digitales
│   │   └── inspection/               # Inspecciones digitales
│   ├── portal/         # Portal de clientes
│   ├── dashboard/      # Dashboard principal
│   ├── settings/       # Configuraciones del sistema
│   └── ...             # Otros módulos
├── hooks/              # Hooks especializados
│   ├── inspection/     # Hooks de inspecciones
│   ├── portal/         # Hooks del portal
│   ├── services/       # Hooks de servicios
│   └── ...             # Otros hooks
├── utils/              # Utilidades especializadas
│   ├── pdf/           # Generación de PDFs
│   ├── xmlParser/     # Parser XML para DTEs chilenos
│   ├── timezoneUtils.ts  # Manejo de zonas horarias
│   ├── photoProcessor.ts # Procesamiento de imágenes
│   └── ...            # Otras utilidades
└── schemas/           # Esquemas de validación Zod
    ├── inspectionSchema.ts        # Schema de inspecciones
    ├── serviceSchema.ts           # Schema de servicios
    └── ...            # Otros schemas
```

## 🎯 Funcionalidades Implementadas

### ✅ Sistema de Inspecciones Digitales
- Checklist de equipamiento configurable
- Captura de fotos por categorías automatizada
- Firmas digitales de operador y cliente
- Generación automática de PDFs profesionales
- Envío por email inmediato
- Actualización automática de estados de servicio

### ✅ Portal de Clientes Completo
- Autenticación independiente del sistema principal
- Dashboard personalizado con métricas del cliente
- Solicitud de servicios con formulario dinámico
- Acceso completo al historial de servicios
- Descarga de documentos de inspección
- Interface móvil completamente optimizada

### ✅ Sistema de Usuarios con Invitaciones
- Pre-registro de usuarios por administradores
- Envío automático de invitaciones por email
- Control de estados de invitación en tiempo real
- Reenvío de invitaciones no utilizadas
- Asignación automática de roles y permisos

### ✅ Sistema de Cierres y Facturación
- Cierres de servicios por período configurable
- Facturación automática desde cierres
- Control de estados de facturación completo
- **Sistema de carga XML completo para DTEs chilenos**
- Procesamiento automático de facturas electrónicas
- Categorización inteligente por proveedor
- Validación robusta con manejo de errores
- Reportes financieros integrados

### ✅ Gestión de Zonas Horarias
- Manejo consistente de timezone Chile en toda la aplicación
- Cálculos precisos de servicios futuros
- Formateo correcto de fechas en toda la interfaz
- Sincronización de datos en tiempo real

## 👥 Roles de Usuario

### 🔑 Administrador
- Acceso completo al sistema
- **Gestión avanzada de usuarios con invitaciones**
- Configuración de empresa y sistema
- Reportes ejecutivos y financieros
- Control total de configuraciones

### 🚛 Operador
- Portal móvil optimizado con PWA
- **Inspecciones completas con firmas y fotos**
- Gestión de servicios asignados
- Generación automática de documentos
- Acceso restringido a sus servicios

### 🏢 Cliente
- **Portal de autoservicio independiente**
- Solicitud de nuevos servicios
- Acceso a historial completo e inspecciones
- Descarga de documentos
- Dashboard personalizado

### 👁️ Visualizador
- Acceso de solo lectura
- Reportes básicos
- Dashboard de métricas
- Sin permisos de modificación

## 📱 Módulos Principales

### 1. Dashboard
Tablero ejecutivo con métricas en tiempo real, alertas automáticas y gráficos interactivos con datos actualizados desde Chile timezone.

### 2. Servicios
Gestión completa del ciclo de vida desde creación hasta facturación con estados automatizados y numeración inteligente de folios.

### 3. Portal del Operador
- Inspecciones digitales completas
- Generación automática de PDFs de inspección
- Interface móvil optimizada con PWA
- Firmas digitales integradas

### 4. Portal de Clientes
- **Solicitud de servicios con formulario dinámico**
- Dashboard personalizado por cliente
- Acceso completo a documentos de inspección
- Interface responsive optimizada

### 5. **Sistema de Inventario y Bodega** (NUEVO v2.1.0)
- **Gestión de productos**: Catálogo con categorías, ubicaciones y proveedores
- **Control de stock**: Stock en tiempo real con alertas automáticas
- **Movimientos**: Entradas, salidas, transferencias con trazabilidad completa
- **Dashboard especializado**: Métricas de inventario y alertas visuales
- **Reportes avanzados**: Valorización, consumo, análisis predictivo
- **Sistema de alertas**: Stock bajo, crítico, sin movimiento, vencimientos
- **Integración completa**: Con servicios, grúas y operadores

### 6. Cierres y Facturación
- **Sistema de cierres de servicios por período**
- Facturación automática desde cierres
- **Lector XML inteligente para DTEs chilenos**
- Carga masiva de gastos desde facturas electrónicas
- Categorización automática por proveedor
- Control completo de estados financieros

### 7. Configuración Avanzada
- **Sistema de invitaciones por email**
- Gestión completa de usuarios y roles
- Configuración de empresa personalizable
- Respaldos automáticos programados

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Build para producción optimizado
npm run preview      # Vista previa del build

# Testing
npm run test         # Ejecutar tests unitarios
npm run test:ui      # Interface de testing
npm run coverage     # Reporte de cobertura

# Calidad de Código
npm run lint         # ESLint con reglas estrictas
npm run type-check   # Verificación de tipos TypeScript

# Base de Datos
npm run db:push      # Aplicar cambios a Supabase
npm run db:reset     # Resetear base de datos
```

## 🌐 Deployment

### Producción Recomendada
- **Frontend**: Vercel, Netlify o Cloudflare Pages
- **Backend**: Supabase (incluido en el stack)
- **CDN**: Cloudflare para assets estáticos
- **Monitoreo**: Supabase Analytics + logs personalizados

### Variables de Entorno Requeridas
```env
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Email
VITE_RESEND_API_KEY=tu_resend_api_key

# Aplicación
VITE_APP_URL=https://tu-dominio.com
```

## 🔍 Estado del Sistema

### ✅ Módulos Completamente Funcionales
- Dashboard con métricas en tiempo real
- Gestión completa de servicios
- Portal de operadores con inspecciones
- Portal de clientes independiente
- Sistema de invitaciones automatizado
- Inspecciones digitales con PDFs
- **Sistema XML completo para DTEs chilenos**
- Gestión de zonas horarias

### 🚧 En Desarrollo Continuo
- Reportes avanzados con más métricas
- Optimizaciones de rendimiento
- Nuevas funcionalidades por solicitud

### ✅ Totalmente Operativo
- Sistema de emails transaccionales
- Autenticación y autorización
- Base de datos con RLS
- PWA con funcionalidad offline
- Respaldos automáticos

## 📋 Sistema XML para Facturas Chilenas DTE

### 🔍 Características del Parser XML

#### **Soporte Completo para DTEs**
- **Facturas Electrónicas (Tipo 33)** ✅
- **Facturas Exentas (Tipo 34)** ✅
- **Boletas Electrónicas (Tipo 39)** ✅
- **Navegación jerárquica automática** en estructura DTE
- **Extracción inteligente** de datos anidados

#### **Campos Extraídos Automáticamente**
- `Encabezado/IdDoc/FchEmis` → **Fecha de emisión**
- `Encabezado/Totales/MntTotal` → **Monto total**
- `Encabezado/Emisor/RznSoc` → **Proveedor**
- `Encabezado/Emisor/RUTEmisor` → **RUT del emisor**
- `Encabezado/IdDoc/Folio` → **Número de factura**
- `Encabezado/Emisor/GiroEmis` → **Descripción/Giro**

#### **Categorización Automática por Proveedor**
- **HDI, Seguros** → Categoría "Seguros"
- **Shell, Copec, Petrobras** → Categoría "Combustible"
- **Talleres, Repuestos** → Categoría "Mantenimiento"
- **Peajes** → Categoría "Peajes"
- **Otros proveedores** → Categoría "Otros"

#### **Validación y Procesamiento Robusto**
- **Validación de estructura XML** con manejo de errores
- **Verificación de campos requeridos** vs opcionales
- **Transformaciones automáticas** de tipos de datos
- **Advertencias** para campos faltantes no críticos
- **Vista previa** completa antes de carga

#### **Interface de Usuario Optimizada**
- **Drag & Drop** para archivos XML
- **Análisis en tiempo real** con feedback visual
- **Vista previa de datos** extraídos en tabla
- **Mapeo manual de categorías** por registro
- **Carga batch** de múltiples gastos
- **Integración completa** con sistema de costos

#### **Archivos Técnicos**
```
src/utils/xmlParser/xmlCostParser.ts    # Parser principal
src/components/costs/XMLCostUpload.tsx  # Componente UI
src/types/costs.ts                      # Tipos e interfaces
```

#### **Flujo de Trabajo**
1. **Selección**: Drag & drop o click para XML
2. **Análisis**: Parser detecta estructura automáticamente
3. **Vista Previa**: Muestra datos extraídos
4. **Ajustes**: Usuario puede mapear categorías
5. **Confirmación**: Carga masiva a base de datos
6. **Resultado**: Actualización automática de costos

#### **Formatos XML Soportados**
- **DTEs Chilenos**: Soporte nativo completo
- **XML Genéricos**: Gastos y facturas estándar
- **Detección Automática**: Para estructuras desconocidas

### 🎯 Casos de Uso Implementados

✅ **HDI Seguros**: Procesamiento automático completo
✅ **Combustibles**: Shell, Copec, Petrobras
✅ **Mantenimiento**: Talleres y proveedores de repuestos
✅ **Servicios Diversos**: Categorización inteligente
✅ **Facturas Genéricas**: Estructura XML estándar

---

## 📞 Soporte y Contacto

### Canales de Soporte
- **Email**: soporte@tmsgruas.com
- **Documentación**: Ver carpeta docs/
- **Issues**: Reportar problemas técnicos en GitHub

### Horarios de Atención
- **Lunes a Viernes**: 9:00 - 18:00 (CLT)
- **Emergencias**: Bajo solicitud

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

## 📦 Sistema de Inventario v2.1.0 - Funcionalidades Completas

### ✅ **Gestión de Productos y Catálogo**
- Catálogo completo con categorías jerárquicas
- Códigos SKU únicos y códigos de barra
- Control de stock mínimo, máximo y punto de reorden
- Gestión de unidades de medida personalizable
- Clasificación de productos críticos
- Control de productos con fecha de vencimiento

### ✅ **Control de Stock en Tiempo Real**
- Stock por ubicación con múltiples bodegas
- Seguimiento de lotes y números de serie
- Control de stock reservado vs disponible
- Alertas automáticas de stock bajo/crítico
- Historial completo de movimientos
- Conciliación automática de diferencias

### ✅ **Movimientos de Inventario Avanzados**
- **Entradas**: Compras, devoluciones, ajustes positivos
- **Salidas**: Consumos, ventas, ajustes negativos, mermas
- **Transferencias**: Entre ubicaciones con trazabilidad
- **Ajustes**: Corrección de diferencias con justificación
- Trazabilidad completa con usuario, fecha y motivo
- Estados de movimiento (activo, anulado, pendiente)

### ✅ **Sistema de Alertas Inteligente**
- **Stock bajo**: Configurable por producto y ubicación
- **Stock crítico**: Alertas de emergencia para productos esenciales
- **Productos sin movimiento**: Detección de stock obsoleto
- **Próximos a vencer**: Para productos con fecha de caducidad
- **Sobrestock**: Alertas de exceso de inventario
- Dashboard visual con alertas en tiempo real

### ✅ **Dashboard de Inventario Especializado**
- Métricas en tiempo real: valor total, productos activos, alertas
- Gráficos de valorización por categoría
- Top productos más/menos movidos
- Indicadores de rotación de inventario
- Alertas visuales con códigos de color
- Resumen ejecutivo de estado general

### ✅ **Reportes y Análisis Avanzados**
- **Reporte de valorización**: Valor total por ubicación/categoría
- **Análisis de movimientos**: Consumo por período y tipo
- **Productos de baja rotación**: Identificación de stock obsoleto
- **Análisis ABC**: Clasificación por valor y rotación
- **Consumo por grúa/operador**: Análisis de costos operativos
- **Proyecciones de compra**: Basado en consumo histórico

### ✅ **Integración con Sistema Operativo**
- Consumos automáticos por servicios y grúas
- Vinculación con mantenimientos programados
- Control de costos por centro de costo
- Integración con sistema de órdenes de trabajo
- Seguimiento de consumos por operador
- Reportes integrados con facturación

---

**Sistema TMS Grúas v2.1.0 - Versión Completa con Inventario**

✅ **Sistema Operativo Completo**: Todas las funcionalidades principales incluido el nuevo módulo de inventario están implementadas y funcionando correctamente.
