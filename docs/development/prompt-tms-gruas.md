# Prompt Maestro: TMS para Empresas de Grúas y Remolque

> **Propósito:** Este prompt le entrega a cualquier IA el contexto completo para construir un TMS (Transport Management System) adaptado a empresas de grúas, remolque y asistencia en ruta. Cubre arquitectura, módulos, modelo de datos, flujos de negocio y automatizaciones.

---

## INSTRUCCIÓN PRINCIPAL

Construye un sistema web de gestión operacional (TMS) para empresas de grúas y servicios de remolque. El sistema debe cubrir desde el despacho de servicios hasta la facturación, control de costos y comisiones de operadores.

---

## STACK TECNOLÓGICO

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS v3 + lucide-react
- **Estado servidor:** TanStack Query v5 (staleTime 5min, refetchOnWindowFocus: false)
- **Tablas:** TanStack Table v8
- **Routing:** React Router v6 con lazy loading por ruta
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions + Realtime)
- **Deploy:** Cloudflare Pages
- **Formularios:** react-hook-form + zod
- **PDF:** jsPDF + jspdf-autotable
- **Notificaciones:** WhatsApp Business API (Meta) + Push Notifications (web-push)
- **IA:** Claude API para clasificación automática de costos y OCR de boletas

---

## ROLES DE USUARIO

| Rol | Acceso |
|-----|--------|
| `admin` | Acceso total, configuración, reportes financieros |
| `viewer` | Lectura de todos los módulos, sin edición |
| `operator` | Solo portal de operador: ver servicios asignados, completar inspecciones |
| `client` | Solo portal cliente: ver sus servicios e facturas, solicitar servicios |

---

## MODELO DE DATOS COMPLETO

### Entidades principales

```
services               — Servicio de grúa/remolque (entidad central)
clients                — Clientes (empresas o personas naturales)
operators              — Operadores de grúa
cranes                 — Equipos/grúas de la flota
vehicles               — Vehículos de apoyo (no grúas)
service_types          — Tipos de servicio (remolque, traslado, izaje, etc.)
service_rates          — Tarifas por cliente + tipo de servicio + tramo
service_closures       — Cierres de facturación por cliente (agrupa servicios)
invoices               — Facturas emitidas
payments               — Pagos recibidos de clientes
payment_applications   — Aplicación de pagos a facturas específicas
costs                  — Todos los costos operacionales (tabla unificada)
cost_categories        — Categorías de costos (8 categorías fijas)
cost_subcategories     — Subcategorías configurables por categoría
cost_centers           — Centros de costo con presupuesto y período
inventory_products     — Catálogo de productos/repuestos
inventory_movements    — Movimientos de bodega (entrada/salida/ajuste)
inventory_suppliers    — Proveedores de insumos
supplier_invoices      — Facturas de proveedores (XML DTE Chile)
supplier_payments      — Pagos a proveedores
commission_batches     — Lotes de pago de comisiones a operadores
calendar_events        — Eventos de calendario (servicios futuros, alertas)
profiles               — Perfiles de usuario del sistema
audit_log              — Auditoría de cambios en entidades críticas
user_activity_log      — Log de navegación por usuario
backup_logs            — Registro de respaldos generados
notification_logs      — Historial de notificaciones enviadas
```

### Campos clave de `services`

```sql
id, folio (auto-generado SRV-XXXX), request_date, service_date,
start_time, end_time, crane_mileage,
client_id, third_party_client_id (asegurado distinto al pagador),
purchase_order, purchase_order_number, quote_number,
vehicle_brand, vehicle_model, license_plate,
origin, destination,
service_type_id, value,
crane_id, operator_id, operator_commission,
status (enum: pending|in_progress|inspection_completed|completed|
        cancelled|invoiced|quoted|purchase_order_pending|
        with_purchase_order|failed),
observations, has_excess, client_covered_amount, excess_amount,
invoice_folio, invoice_numero_fiscal,
company_rut, company_name (para facturar a empresa distinta del cliente),
insured_name, contact_person, contact_phone,
outsourced_provider_id, outsourced_cost, outsourced_notes,
custody_mode (manual|calendar|none), custody_days, custody_daily_rate,
custody_start_date, custody_end_date, custody_vehicle_type,
custody_discount_percentage, custody_total_amount, custody_notes,
created_by, created_at, updated_at
```

### Campos clave de `costs`

```sql
id, date, description, amount,
category_id, subcategory,
service_id, service_folio (FK + desnorm),
crane_id, operator_id, supplier_id,
cost_center_id,
payment_date (null = pendiente de pago),
payment_batch_id (FK a commission_batches),
document_type, document_number,
location_text, other_reason,
purchase_quantity, purchase_unit_cost,
inventory_movement_id (FK → sincronización con bodega),
immediate_consumption (bool → descuento inmediato del stock),
supplier_invoice_id (FK → factura del proveedor),
supplier_payment_id,
receipt_photo_paths (array de rutas en Storage),
created_by, created_at, updated_at
```

### Categorías de costos (4 BLOQUEADAS + configurables)

Las siguientes 4 tienen nombre hardcodeado en triggers SQL y no se pueden renombrar:
1. **Gastos de Servicios** — costos dentro de un servicio (combustible en ruta, viáticos, etc.). Se marcan como pagados automáticamente. Vinculados a folio de servicio.
2. **Mantenimiento** — mantención de flota (código centro MANT)
3. **Comisión Operador** — creadas automáticamente por trigger cuando servicio pasa a `completed`
4. **Inventario** — sincronizadas con módulo de bodega

Categorías configurables adicionales: Salarios, Seguros y Permisos, Administrativos, Impuestos, Combustible equipos aux., Cuentas por Pagar.

---

## FLUJOS DE NEGOCIO

### Flujo principal de un servicio

```
1. SOLICITUD → Cliente llama / Portal cliente / Teléfono
2. CREACIÓN → Admin crea servicio (folio auto SRV-XXXX)
              Asigna: cliente, tipo, origen, destino, grúa, operador
              Estado: pending
3. DESPACHO → Estado: in_progress
              WhatsApp automático al operador con datos del servicio
              WhatsApp al cliente confirmando despacho
4. INSPECCIÓN → Operador completa formulario desde /operator
                Checklist de equipamiento del vehículo
                Foto del vehículo, firma del cliente, firma del operador
                Se genera PDF de inspección → sube a Storage
                Estado: inspection_completed
5. EJECUCIÓN → Se registran costos del servicio (combustible, peajes, etc.)
               en la tab "Costos" del formulario de edición del servicio
6. COMPLETADO → Estado: completed
                Trigger SQL genera automáticamente un costo de
                "Comisión Operador" = operator_commission del servicio
                WhatsApp de notificación al administrador
7. CIERRE → Se agrupa en un ServiceClosure con otros servicios del mismo cliente
             Estado servicio: invoiced
8. FACTURA → Se emite factura desde el cierre (PDF descargable)
              Estado cierre: invoiced
              Estado factura: draft → sent → paid
9. PAGO → Cliente paga. Se aplica a facturas (FIFO, manual o proporcional)
```

### Flujo de custodia de vehículo

Cuando un vehículo queda en custodia (almacenaje):
- Modo `calendar`: sistema calcula días automáticamente entre fecha inicio y fin
- Modo `manual`: admin ingresa días y tarifa diaria
- El valor de custodia se suma al valor del servicio
- Descuento opcional por porcentaje configurado por tipo de vehículo

### Flujo especial clientes corporativos (VIP)

```
Cliente envía OC (Orden de Compra) →
Sistema importa OC desde PDF (IA extrae: número, monto, fechas) →
Servicios vinculados a esa OC quedan en estado `with_purchase_order` →
Al facturar: se valida que los servicios estén dentro del monto de la OC →
Pipeline visual de seguimiento por cliente (/clients/:id/pipeline)
```

### Flujo de costos e inventario

```
Admin registra compra de insumo →
Si tiene purchase_quantity + purchase_unit_cost → ingresa a bodega automáticamente →
Si immediate_consumption = true → sale de bodega inmediatamente hacia la grúa →
Si no: queda en stock, se descuenta después con movimiento manual
```

---

## MÓDULOS DEL SISTEMA

### 1. Dashboard (`/dashboard`)
- Métricas del mes: ingresos, servicios, comparación mes anterior con % de cambio
- Servicios futuros programados
- Alertas de vencimiento de documentos de flota (permisos, seguros, revisión técnica)
- Facturas vencidas y por vencer
- Tabla de servicios recientes con acceso rápido al detalle
- Descarga de informe de pendientes en PDF

### 2. Servicios (`/services`)
- Tabla con paginación + vista pipeline kanban
- Estados expresados con roles semánticos (`warning`, `info`, `success`, `neutral`) según `docs/design-system.md`, siempre acompañados de texto o icono.
- Selección múltiple con acciones batch: cerrar, actualizar estado, duplicar, eliminar
- Filtros avanzados: estado, fecha, cliente, operador, grúa, OC
- Vista móvil adaptada
- Formulario multistep (4 pasos): Datos básicos → Vehículo y tramo → Operador y grúa → Costos y detalles
- Duplicar servicio (nuevo folio)
- Importar desde CSV con validación
- Exportar servicios pendientes con PDF descargable
- Dentro del formulario: sub-sección de costos del servicio con autocompletado de descripción

### 3. Clientes (`/clients`)
- Tabla con búsqueda y filtros por departamento
- Formulario multistep (3 pasos): Datos → Facturación → Configuración
- Tipo de facturación: estándar o mensual
- Plazo de pago configurable por cliente
- Logo del cliente (upload)
- Detalle modal con tabs: Info, Historial de servicios, Historial de cierres, Métricas
- Pipeline VIP con análisis predictivo, OCs y reportes ejecutivos

### 4. Calendario (`/calendar`)
- Vista mensual, semanal y diaria
- Eventos = servicios futuros + eventos manuales
- Convertir evento a servicio directamente desde el calendario
- Alertas visuales de servicios para hoy/mañana en sidebar

### 5. Grúas (`/cranes`)
- Ficha técnica: patente, marca, modelo, tipo (light/medium/heavy/taxi/horquilla)
- Documentos con fecha de vencimiento: permiso de circulación, seguro, revisión técnica
- Alerta automática 30 días antes del vencimiento
- Detalle de mantenciones, consumo de repuestos y métricas de uso
- Propietario: puede ser la empresa o tercero (outsourcing)

### 6. Operadores (`/operators`)
- Ficha: nombre, RUT, teléfono, tipo (conductor/administrativo), cargo
- Licencia de conducir con fecha de vencimiento del examen
- Flag: exento de comisiones
- Historial de servicios y comisiones

### 7. Vehículos (`/vehicles`)
- Vehículos de apoyo (no grúas)
- Historial de revisiones por patente (consulta SRE)

### 8. Costos (`/costs`)
- Vista tabla + vista tarjetas
- Filtros: categoría, subcategoría, fecha, operador, grúa, monto, centro de costo
- Filtro rápido por semana/mes/todo
- Acceso por parámetro URL ?costId= para destacar un costo específico
- Importación desde XML DTE (facturas electrónicas Chile)
- Importación desde CSV
- Clasificación automática con IA (Claude API)
- Formulario multistep (4 pasos): Info básica → Monto y detalles → Asociaciones → Notas y fotos
- Exportar a Excel
- Subir fotos de boleta/comprobante (Storage)
- Formulario rápido de costo (QuickCostForm) para registro express

### 9. Comisiones (`/commissions`)
- Fuente operacional: comisión configurada en el servicio (`service_resources`)
- Proyección para listado y pago: tabla `costs`, categoría "Comisión Operador"
- Vista "Todas" y "Por Operador"
- Selección múltiple para crear lote de pago
- Lotes de pago con método (efectivo, transferencia, cheque)
- Estados: pendiente / pagado
- Exportar a Excel
- Botón de enlace directo al registro en módulo Costos

### 10. Cierres (`/closures`)
- Agrupación de servicios completados por cliente para facturar
- Estados: abierto → cerrado → cotizado → OC pendiente → facturado
- Vista agrupada por cliente
- Reporte de cierre en PDF
- Confirmación de facturación con número fiscal

### 11. Facturas (`/invoices`)
- Emisión desde cierres
- PDF de factura descargable (con logo empresa, RUT, detalle de servicios)
- Estados: borrador → enviada → pagada → vencida → cancelada
- Registro de pagos con aplicación a facturas (FIFO / manual / proporcional)
- Alertas de facturas vencidas y por vencer en dashboard
- Conciliación de pagos
- Importación de historial de ventas desde CSV/Excel

### 12. Cuentas por Pagar (`/accounts-payable`)
- Gestión de deudas con proveedores y acreedores
- Cuotas mensuales con calendario de vencimientos
- Estados por cuota: pendiente / pagado / vencido

### 13. Centros de Costo (`/settings#cost-centers`; `/cost-centers` redirige)
- Jerarquía de centros (parent/child)
- Presupuesto por período (mensual/trimestral/anual)
- Métricas de uso vs presupuesto
- Códigos de referencia (ej: OPER-SERV, MANT, REMU, ADMIN)

### 14. Bodega (`/inventory`)
- Catálogo de productos/repuestos con SKU auto-generado
- Stock actual por producto
- Movimientos: entrada, salida, ajuste, transferencia
- Alertas de stock mínimo
- Sincronización automática con costos (compra → entrada bodega)
- Importación desde XML (facturas proveedor)
- Informes: rotación, valorización, movimientos por período

### 15. Proveedores (`/suppliers`)
- Ficha de proveedor con RUT, giro, contacto, plazo de pago
- Registro de facturas recibidas (importación XML DTE)
- Pagos a proveedores con fechas y referencias
- Historial de compras

### 16. Reportes (`/reports`)
- Módulo con tabs: Operacional, Análisis de Costos, Mantenimiento
- Reportes operacionales: servicios por período, por operador, por grúa, por cliente, por tipo
- Reportes financieros: ingresos vs costos, margen por servicio, tendencias
- Análisis de costos: distribución por categoría, centro de costo, grúa
- Exportar a Excel y PDF
- Filtros: fecha, cliente, operador, grúa, categoría

### 17. Proyección de Ingresos (`/income-projections`)
- Facturas pendientes de cobro organizadas por fecha de vencimiento
- Flujo de caja proyectado
- Informe de aging (0-30, 31-60, 61-90, +90 días)
- Top deudores

### 18. Históricos (`/historical`)
- Historial de ventas (importado desde Excel/CSV del sistema anterior)
- Historial de compras a proveedores
- Resultados: P&L por período comparado

### 19. Cálculo de Viajes (`/trip-calculator`)
- Calculadora de costo de viaje: distancia, combustible, peajes
- Precios de combustible configurables por tipo
- Tasas de consumo por tipo de grúa
- Integración con API de peajes (tollroutes)
- Historial de estimaciones
- Guardar rutas frecuentes

### 20. Registros Rápidos (`/quick-entries`)
- Captura express desde móvil: foto de boleta → OCR → pre-llenado formulario
- Cola de registros pendientes de completar
- Cuando se completa, el registro rápido se elimina y crea un costo formal

### 21. Configuración (`/settings`)
- Tabs: Empresa, Sistema, Notificaciones, Usuarios, Zona Horaria, Categorías, Permisos, Auditoría
- Datos empresa: nombre, RUT, logo, dirección, teléfono, email
- Zona horaria del negocio (crítico para fechas correctas)
- Usuarios: invitar, asignar roles, permisos granulares por módulo
- Categorías: gestión de subcategorías (categorías raíz bloqueadas)
- WhatsApp: configurar teléfonos de admin, activar/desactivar alertas por tipo
- Auditoría: timeline de cambios con filtros por entidad y usuario
- Respaldos: generación manual, respaldo automático programado, descarga

### 22. Portal del Operador (`/operator`)
- Vista simplificada: lista de servicios asignados con estado
- Acceso al formulario de inspección por servicio
- Checklist de equipamiento del vehículo (luces, cinturones, gata, etc.)
- Captura de km, nivel de combustible, llaves, documentación
- Firma digital del operador y del cliente en pantalla táctil
- Generación de PDF de inspección
- Notificaciones push cuando se asigna un nuevo servicio

### 23. Portal del Cliente (`/portal`)
- Dashboard: resumen de servicios e facturas activas
- Historial de servicios con estados y detalles
- Facturas pendientes y pagadas (descarga PDF)
- Órdenes de compra: subir OC, ver estado
- Solicitar nuevo servicio con formulario
- Notificación WhatsApp cuando se procesa su OC

---

## AUTOMATIZACIONES Y TRIGGERS

### Triggers SQL (PostgreSQL)

```sql
-- Al configurar una comisión en el servicio → proyectarla no pagada en costs,
-- sin depender del estado del servicio.
TRIGGERS: trigger_services_commission_sync / trigger_service_resources_commission_sync
  → sync_service_commissions(service_id)

-- Al cambiar la elegibilidad desde Operadores → reconciliar los servicios del trabajador.
TRIGGER: trigger_operator_commission_eligibility_sync
  ON operators AFTER UPDATE OF commission_exempt
  → sync_service_commissions(service_id)

-- Solo el lote de Comisiones marca costos como pagados.
RPC: create_commission_payment_batch
  → INSERT commission_batches + UPDATE costs(payment_date, payment_batch_id)
  en una única transacción

-- Auditoría: capturar cambios en services, invoices, costs, closures
TRIGGER: audit_log_trigger ON services/invoices/costs/closures
  → INSERT INTO audit_log (old_data, new_data, changed_by, changed_at)
```

### Edge Functions (Supabase / Deno)

| Función | Disparador | Acción |
|---------|-----------|--------|
| `send-whatsapp-operator` | Nuevo servicio asignado | WhatsApp al operador con datos del servicio |
| `send-whatsapp-admin` | Servicio completado | WhatsApp al admin con resumen |
| `send-whatsapp-retiro` | Vehículo listo para retiro | WhatsApp al cliente |
| `whatsapp-daily-alerts` | pg_cron 08:00 Chile | Resumen diario de pendientes al admin |
| `send-inspection-email` | Inspección completada | Email con PDF al cliente |
| `send-invoice-email` | Factura emitida | Email con PDF al cliente |
| `send-document-alerts` | pg_cron semanal | Alertas de documentos de flota próximos a vencer |
| `send-payment-reminder` | Facturas vencidas | Recordatorio de pago al cliente |
| `parse-receipt-image` | Sube foto de boleta | OCR con IA → extrae monto, fecha, descripción |
| `parse-purchase-order-pdf` | Sube PDF de OC | IA extrae número OC, monto, vigencia |
| `parse-quote-pdf` | Sube PDF cotización | IA extrae número, cliente, total |
| `classify-cost` | Costo sin categoría | IA sugiere categoría y subcategoría |
| `check-vehicle-patent` | Consulta patente | SRE lookup → historial del vehículo |
| `generate-backup` | Manual o pg_cron | Genera JSON de todas las tablas → Storage |
| `tollroutes-proxy` | Cálculo de viaje | Consulta API de peajes para la ruta |
| `sre-lookup` | Input de patente | Consulta registro de vehículos |

### pg_cron (trabajos programados)

```
- 08:00 Chile (11:00 UTC) diario → whatsapp-daily-alerts
- 08:00 Chile lunes → whatsapp-weekly-summary (métricas de la semana)
- 00:00 diario → check vencimientos de documentos → send-document-alerts
- 02:00 diario → generate-backup automático
```

---

## REGLAS DE NEGOCIO CRÍTICAS

1. **Folio de servicio:** auto-generado como SRV-XXXX, único, no editable.
2. **Comisiones:** se crean automáticamente al completar un servicio. La fuente de verdad es la tabla `costs`. No existe tabla separada de comisiones.
3. **Gastos de Servicios:** cualquier costo ingresado desde el formulario del servicio hereda el folio del servicio, se marca automáticamente como pagado y se vincula a la categoría "Gastos de Servicios".
4. **Zona horaria:** toda operación de fechas debe usar la zona horaria del negocio (configurable, default America/Santiago). No usar UTC para fechas de servicio.
5. **Custodia:** el valor de custodia se suma al valor base del servicio, no es un servicio separado.
6. **Cliente pagador vs asegurado:** un servicio puede tener un cliente que paga (empresa de seguros) y un cliente asegurado distinto (dueño del vehículo).
7. **Outsourcing:** un servicio puede subcontratarse a un proveedor externo con costo separado. El margen = value - outsourced_cost.
8. **Inventario y costos:** toda compra de insumo con cantidad y precio unitario debe crear automáticamente un movimiento de entrada en bodega.
9. **Cierre y factura:** un servicio solo puede facturarse a través de un cierre. No hay factura directa por servicio individual.
10. **Exceso:** si el servicio tiene `has_excess = true`, el exceso es pagado por el asegurado, no por la aseguradora. El campo `excess_amount` es el monto que paga el asegurado.

---

## CONFIGURACIÓN WHATSAPP

- API: Meta WhatsApp Business API (no Twilio)
- Endpoint: `https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages`
- Autenticación: Bearer token (WHATSAPP_TOKEN env var)
- Templates preaprobados por Meta para mensajes estructurados
- Hasta 3 números de admin configurables
- Toggles por tipo de alerta en panel de configuración

---

## ESTRUCTURA DE ARCHIVOS

```
src/
├── pages/              → Una página por módulo (lazy loaded)
├── components/
│   ├── {modulo}/       → Componentes del módulo (Table, Form, Filters, Header, Dialogs)
│   ├── ui/             → Componentes base (shadcn/ui extendidos)
│   ├── layout/         → Layout principal, sidebar, header
│   ├── portal/         → Layout y componentes del portal cliente
│   └── operator/       → Layout y componentes del portal operador
├── hooks/
│   ├── use{Modulo}.ts          → Hook principal por módulo
│   └── {modulo}/
│       ├── use{Modulo}Fetcher.ts   → React Query: fetcheo
│       └── use{Modulo}Manager.ts  → Mutaciones: create/update/delete
├── types/              → Interfaces TypeScript por dominio
├── utils/
│   ├── pdf/            → Generadores de PDF por tipo de documento
│   ├── reports/        → Exportadores de reportes
│   └── timezoneUtils.ts → Utilidades de fecha con TZ del negocio
├── contexts/           → AuthContext, UserContext, NotificationContext, ThemeContext
├── integrations/supabase/ → Cliente, tipos generados, helpers
└── lib/
    ├── logger.ts       → Logger silencioso en producción
    └── utils.ts        → cn(), formatCurrency(), etc.
```

---

## VARIABLES DE ENTORNO

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_MAPBOX_TOKEN=          # Para mapas en cálculo de viajes
VITE_TURNSTILE_SITE_KEY=    # Cloudflare Turnstile en login

# Solo en Edge Functions (Supabase secrets):
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
ANTHROPIC_API_KEY=          # Para clasificación IA de costos y OCR
RESEND_API_KEY=              # Para envío de emails
TOLLROUTES_API_KEY=
```

---

## CONSIDERACIONES DE MERCADO (Chile)

- **RUT chileno:** validar con algoritmo de dígito verificador (módulo 11)
- **Formato moneda:** CLP sin decimales, separador de miles con punto
- **Facturación electrónica:** importar XML DTE (SII Chile) de proveedores
- **Zona horaria:** America/Santiago (UTC-3 en invierno, UTC-4 en verano)
- **IVA:** 19%
- **SRE:** Registro de vehículos del Registro Civil (consulta de patente)
- **Nombre empresa:** incluir "SpA", "Ltda.", "S.A." según constitución
- **Soporte PWA:** instalable en móvil para operadores en terreno

---

## PRIORIDAD DE IMPLEMENTACIÓN (orden sugerido para MVP)

**Fase 1 — Core operacional (semanas 1-4):**
1. Auth (login, roles, sesión)
2. Dashboard básico
3. Servicios (CRUD + estados + formulario completo)
4. Clientes (CRUD)
5. Grúas y Operadores (CRUD)
6. Tipos de Servicio (CRUD)

**Fase 2 — Finanzas básicas (semanas 5-8):**
7. Costos (registro, categorías, filtros)
8. Cierres y Facturas (flujo completo)
9. Comisiones (visualización y pago)
10. WhatsApp básico (asignación y completado)

**Fase 3 — Portales y automatización (semanas 9-12):**
11. Portal operador (inspección + firma)
12. Portal cliente (historial + facturas)
13. Inventario y Bodega
14. Reportes y exportaciones PDF/Excel

**Fase 4 — Inteligencia y diferenciación (semanas 13+):**
15. OCR de boletas
16. Cálculo de viajes con peajes
17. Pipeline VIP + OC automático desde PDF
18. Proyección de ingresos y análisis predictivo
19. Históricos y resultados financieros
20. PWA + notificaciones push

---

## ARQUITECTURA MULTITENANT

El sistema debe soportar múltiples empresas (tenants) completamente aisladas en una sola base de datos. Cada empresa tiene sus propios datos, usuarios, configuración y subdomain — sin posibilidad de ver datos de otra empresa.

### Modelo de tenant

```sql
-- Tabla central de tenants (una fila por empresa cliente del SaaS)
CREATE TABLE public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,        -- "gruas5norte", "remolques-atacama"
  name        TEXT NOT NULL,               -- "Grúas 5 Norte SpA"
  rut         TEXT UNIQUE NOT NULL,        -- RUT de la empresa
  plan        TEXT NOT NULL DEFAULT 'starter', -- starter | professional | enterprise
  is_active   BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Agregar tenant_id a profiles (vincula usuario → empresa)
ALTER TABLE public.profiles
  ADD COLUMN tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Agregar tenant_id a TODAS las tablas operacionales
ALTER TABLE public.services        ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.clients         ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.operators       ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.cranes          ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.costs           ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.cost_categories ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.invoices        ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.service_closures ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
ALTER TABLE public.inventory_products ADD COLUMN tenant_id UUID NOT NULL REFERENCES public.tenants(id);
-- ... idem para todas las tablas del modelo
```

### Función helper de tenant (RLS)

```sql
-- Obtener el tenant_id del usuario autenticado actual
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;
```

### Política RLS por tenant (patrón uniforme)

Todas las tablas operacionales usan el mismo patrón de política:

```sql
-- Ejemplo para 'services' — replicar en todas las tablas
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- SELECT: solo ves servicios de tu empresa
CREATE POLICY "tenant_isolation_select" ON public.services
  FOR SELECT USING (tenant_id = public.get_tenant_id());

-- INSERT: solo puedes insertar en tu empresa
CREATE POLICY "tenant_isolation_insert" ON public.services
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- UPDATE/DELETE: solo en tu empresa
CREATE POLICY "tenant_isolation_modify" ON public.services
  FOR ALL USING (tenant_id = public.get_tenant_id());

-- Dentro del tenant, aplicar restricciones de rol (admin/viewer/operator)
CREATE POLICY "role_restriction" ON public.services
  FOR ALL USING (
    tenant_id = public.get_tenant_id()
    AND (
      public.get_user_role(auth.uid()) IN ('admin', 'viewer')
      OR (
        public.get_user_role(auth.uid()) = 'operator'
        AND operator_id = public.get_operator_id_by_user(auth.uid())
      )
    )
  );
```

### Routing por subdominio

Cada empresa tiene su subdominio propio:

```
gruas5norte.tuapp.cl      → tenant slug: "gruas5norte"
remolques-atacama.tuapp.cl → tenant slug: "remolques-atacama"
app.tuapp.cl               → landing/login general
```

En el frontend, al cargar la app se detecta el slug del subdominio, se resuelve el `tenant_id` y se almacena en contexto global:

```typescript
// src/contexts/TenantContext.tsx
const TenantContext = createContext<{ tenantId: string; tenant: Tenant } | null>(null);

export const TenantProvider = ({ children }) => {
  const slug = window.location.hostname.split('.')[0]; // "gruas5norte"
  const { data: tenant } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(r => r.data),
  });

  // tenant_id viaja en el JWT claim (ver abajo) — no en cada request
  return <TenantContext.Provider value={{ tenantId: tenant.id, tenant }}>
    {children}
  </TenantContext.Provider>;
};
```

### tenant_id en el JWT (claim personalizado)

Para que RLS pueda leer el tenant_id sin un query extra en cada request, se inyecta en el JWT de Supabase mediante un hook:

```sql
-- Hook de Supabase Auth: al hacer login, agregar tenant_id al JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  SELECT tenant_id, role INTO v_tenant_id, v_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  RETURN jsonb_set(
    jsonb_set(event, '{claims, tenant_id}', to_jsonb(v_tenant_id::text)),
    '{claims, user_role}', to_jsonb(v_role)
  );
END;
$$;
```

Con el claim en el JWT, la función RLS puede simplificarse a:

```sql
CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$;
```

### Índices compuestos obligatorios

Con multitenant, **todos los índices deben incluir `tenant_id` como primera columna**:

```sql
CREATE INDEX idx_services_tenant_date    ON services (tenant_id, service_date DESC);
CREATE INDEX idx_services_tenant_status  ON services (tenant_id, status);
CREATE INDEX idx_services_tenant_client  ON services (tenant_id, client_id);
CREATE INDEX idx_costs_tenant_date       ON costs (tenant_id, date DESC);
CREATE INDEX idx_costs_tenant_category   ON costs (tenant_id, category_id);
CREATE INDEX idx_clients_tenant_active   ON clients (tenant_id, is_active);
-- ... idem para todas las tablas
```

### Datos globales vs datos por tenant

| Tipo | Estrategia |
|------|-----------|
| **Tipos de servicio** | Copias por tenant (cada empresa configura los suyos) |
| **Categorías de costo base** | Seed global al crear tenant (las 4 bloqueadas + defaults) |
| **Subcategorías** | Por tenant (configurables) |
| **Centros de costo** | Por tenant |
| **Configuración empresa** | `company_data` tiene `tenant_id` |
| **Perfiles de usuario** | `profiles` tiene `tenant_id` |
| **Storage (fotos, PDFs)** | Buckets separados por tenant: `{tenant_id}/receipts/...` |

### Onboarding de un nuevo tenant

Al registrarse una nueva empresa, un proceso automático debe:

```typescript
// Edge Function: onboard-tenant
async function onboardTenant(data: {
  companyName: string;
  rut: string;
  adminEmail: string;
  plan: string;
}) {
  // 1. Crear registro en tenants
  const { tenant } = await supabase.from('tenants').insert({ ... });

  // 2. Crear usuario admin en Supabase Auth
  const { user } = await supabase.auth.admin.createUser({ email, password });

  // 3. Crear perfil con tenant_id y rol admin
  await supabase.from('profiles').insert({
    id: user.id, tenant_id: tenant.id, role: 'admin', ...
  });

  // 4. Seed de categorías de costo base (las 4 bloqueadas + defaults)
  await seedCostCategories(tenant.id);

  // 5. Seed de tipos de servicio por defecto
  await seedServiceTypes(tenant.id);

  // 6. Crear registro company_data inicial
  await supabase.from('company_data').insert({ tenant_id: tenant.id, ... });

  // 7. Configurar subdominio en Cloudflare via API (o instrucción manual)
  // 8. Enviar email de bienvenida con credenciales
}
```

### Planes y límites

```typescript
const PLANS = {
  starter: {
    price_clp: 49_000,          // por mes
    max_cranes: 3,
    max_users: 5,
    whatsapp: false,
    ai_classification: false,
    portal_client: false,
  },
  professional: {
    price_clp: 119_000,
    max_cranes: 10,
    max_users: 15,
    whatsapp: true,
    ai_classification: true,
    portal_client: true,
  },
  enterprise: {
    price_clp: 'custom',
    max_cranes: -1,             // ilimitado
    max_users: -1,
    whatsapp: true,
    ai_classification: true,
    portal_client: true,
    custom_domain: true,        // empresa.sudominio.cl
    sla: '99.9%',
  },
};
```

Los límites se validan en Edge Functions antes de crear recursos:

```typescript
// Antes de crear una grúa, verificar límite del plan
const { count } = await supabase
  .from('cranes')
  .select('id', { count: 'exact', head: true })
  .eq('tenant_id', tenantId);

if (count >= plan.max_cranes) {
  return new Response('Plan limit reached', { status: 402 });
}
```

### Tabla de administración SaaS (super-admin)

```sql
-- Solo accesible con service_role key, nunca desde el frontend
CREATE TABLE public.saas_admin_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id),
  action      TEXT NOT NULL,   -- 'plan_change', 'suspend', 'delete'
  performed_by TEXT NOT NULL,  -- email del super-admin
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- Sin RLS intencionalmente — solo acceso vía service_role
```

### Consideraciones de migración (single → multi tenant)

Si el sistema ya existe como single-tenant (como en este caso), la migración implica:

1. Crear tabla `tenants` e insertar el tenant inicial
2. Agregar columna `tenant_id` con valor por defecto = el tenant inicial (evita NOT NULL constraint violation)
3. Crear función `get_tenant_id()` 
4. Reemplazar todas las políticas RLS existentes con las nuevas que incluyen `tenant_id`
5. Crear índices compuestos
6. Eliminar el valor por defecto de `tenant_id` (ahora es requerido)
7. Actualizar el frontend para leer el tenant del subdominio

---

## DIFERENCIADORES VS COMPETENCIA

- **Inspección digital con firma:** elimina papeles en terreno
- **WhatsApp nativo:** no SMS, usa el canal que ya usa la industria
- **Custodia de vehículos:** módulo específico para depósitos temporales
- **Multi-cliente por servicio:** asegurado vs pagador (crítico para grúas de seguros)
- **Comisiones automáticas:** se generan solas al completar el servicio
- **OC desde PDF:** importación automática de órdenes de compra corporativas
- **Calculadora de viajes:** cotiza en segundos con combustible y peajes reales
- **Stock integrado:** la compra de un repuesto entra directo a bodega
- **Portal cliente con OC:** flujo completo B2B para clientes corporativos
```
