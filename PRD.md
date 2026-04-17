# Product Requirements Document (PRD)
## TMS Grúas - Sistema de Gestión de Servicios de Grúas

---

### 1. Resumen Ejecutivo
**Towing Manage System (TMS Grúas)** es un sistema integral de gestión (SaaS/Web App) diseñado específicamente para empresas de servicios de grúas. Su objetivo es digitalizar, centralizar y optimizar todos los aspectos operativos, administrativos y financieros del negocio. Desde la solicitud de un servicio hasta la facturación, incluyendo el control de inventario, mantenimiento de la flota y gestión de operadores a través de portales dedicados.

### 2. Objetivos del Producto
*   **Optimización Operativa:** Reducir el tiempo de asignación y despacho de grúas mediante automatización y seguimiento en tiempo real.
*   **Digitalización Total:** Eliminar el uso de papel mediante inspecciones digitales (con captura de fotos y firmas) y generación automática de PDFs.
*   **Control Financiero:** Facilitar la facturación automatizada y el control de gastos mediante la lectura de facturas electrónicas chilenas (XML DTEs).
*   **Gestión de Activos:** Mantener un control estricto sobre el inventario, repuestos y el mantenimiento preventivo de las grúas.
*   **Autoservicio:** Reducir la carga administrativa de atención al cliente mediante un Portal de Clientes independiente.

### 3. Usuarios Objetivo (Personas)
1.  **Administrador / Gerente:** Requiere control total, reportes financieros, gestión de usuarios, visualización del dashboard en tiempo real y toma de decisiones basada en métricas de rentabilidad y alertas de inventario.
2.  **Operador de Grúa:** Usuario móvil. Necesita una interfaz fácil (PWA) para recibir servicios asignados, realizar inspecciones digitales, subir fotografías del estado del vehículo y recolectar firmas en el lugar del siniestro.
3.  **Cliente (B2B / Aseguradoras / Particulares):** Requiere un portal de autoservicio para solicitar nuevos servicios, rastrear el estado de servicios en curso y descargar historiales e inspecciones.
4.  **Visualizador / Auditor:** Usuario de solo lectura para revisión de reportes y métricas de desempeño sin capacidad de alteración de datos.

### 4. Alcance y Funcionalidades Principales

#### 4.1. Dashboard Ejecutivo
*   Panel de métricas en tiempo real (servicios activos, ingresos, alertas).
*   Diseño "Mobile-first" y responsive.
*   Manejo estandarizado de zona horaria (Chile Timezone).

#### 4.2. Gestión de Servicios y Operaciones
*   Creación de servicios con numeración de folios automática.
*   Asignación inteligente de recursos (Grúa + Operador).
*   Seguimiento de estados del servicio.

#### 4.3. Portales Dedicados
*   **Portal del Operador (PWA):** Aplicación móvil web con soporte offline, checklist de equipamiento, captura fotográfica, firma digital nativa y generación de PDF en terreno.
*   **Portal de Clientes:** Autenticación independiente, formulario dinámico de solicitudes y visualización de historial/documentos.

#### 4.4. Módulo Financiero y Facturación
*   Cierres de servicios configurables por período.
*   Lector inteligente de XML para DTEs chilenos (Facturas 33, 34, Boletas 39).
*   Categorización automática de gastos (Combustible, Peajes, Seguros, Mantenimiento).
*   Reportes de rentabilidad.

#### 4.5. Sistema de Inventario y Bodega (v2.1.0)
*   Catálogo de productos (SKU, códigos de barra, categorías).
*   Control de stock multi-bodega con trazabilidad de movimientos (entradas, salidas, transferencias).
*   Alertas automáticas de stock (crítico, bajo, sobrestock, vencimientos).
*   Integración con consumos operativos (asociación de repuestos a mantenimientos de grúas).

#### 4.6. Gestión de Flota y Recursos Humanos
*   Fichas de grúas con historial de mantenimiento y documentación.
*   Control de operadores y vencimiento de licencias.
*   Sistema de invitaciones automatizado por correo electrónico (Resend).

### 5. Requisitos No Funcionales
*   **Rendimiento:** La aplicación debe cargar en menos de 3 segundos; el Dashboard debe actualizarse en tiempo real.
*   **Disponibilidad:** Arquitectura basada en la nube (Supabase) con alta disponibilidad.
*   **Seguridad:** Row Level Security (RLS) en la base de datos. Autenticación robusta y aislamiento de datos por roles.
*   **Usabilidad:** Interfaz intuitiva y adaptativa. El portal de operadores debe ser usable con una mano y en condiciones de alta luminosidad (exteriores).
*   **Compatibilidad:** Funcionalidad PWA requerida para que los operadores puedan interactuar con mala conexión a internet y sincronizar luego.

### 6. Arquitectura y Stack Tecnológico
*   **Frontend:** React 18, TypeScript, Vite.
*   **Estilos y UI:** Tailwind CSS, shadcn/ui.
*   **Estado y Fetching:** React Query, Zustand/Context API (según corresponda).
*   **Backend & Base de Datos:** Supabase (PostgreSQL), Edge Functions.
*   **Integraciones y Librerías Clave:**
    *   Generación de Documentos: `jsPDF`, `jsPDF AutoTable`.
    *   Formularios y Validación: `react-hook-form`, `zod`.
    *   Fechas y Timezones: `date-fns`, `date-fns-tz`.
    *   Firmas: `react-signature-canvas`.
    *   Emails: Integración con Resend.

### 7. Hitos de Desarrollo (Roadmap actual)
*   **Fase 1 (Completada):** Estructura base, Autenticación, Dashboard, Gestión básica de Servicios y Grúas.
*   **Fase 2 (Completada):** Portales (Operador y Cliente), Inspecciones Digitales, Generación de PDFs.
*   **Fase 3 (Completada):** Módulo Financiero, Cierres, Lector XML de DTEs chilenos.
*   **Fase 4 (Completada - v2.1.0):** Sistema integral de Inventario y Bodega, alertas automatizadas.
*   **Fase 5 (En progreso):** Optimizaciones de rendimiento, reportes avanzados, integraciones de terceros y analítica predictiva.