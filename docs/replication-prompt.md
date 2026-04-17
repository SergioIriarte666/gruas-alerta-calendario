# Prompt para replicar TMS Grúas

Copia y pega este prompt en un nuevo proyecto Lovable para replicar la aplicación completa módulo por módulo.

---

## 🎯 Objetivo
Construir **TMS Grúas**, un sistema integral de gestión (Transport Management System) para empresas de grúas/remolque en Chile. Stack: **React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Lovable Cloud (Supabase)**.

## 🎨 Sistema de diseño (OBLIGATORIO antes de codear)
- **Paleta**: alto contraste centrado en **violeta (violet-600)**. Prohibido el verde (preferencia de accesibilidad del usuario).
- **Tokens HSL en `index.css`** y `tailwind.config.ts`. Nunca colores hardcodeados en componentes.
- **Tipografía**: sans-serif moderna, jerarquía clara (text-3xl títulos, text-sm body).
- **Componentes base**: shadcn/ui (Card, Tabs, Dialog, Badge, Button con variants).
- **Patrón de referencia**: el módulo de **Costos** define el estándar visual (modales, badges de estado, toggles, tablas con cards en mobile).
- **Responsive**: tablas → cards en mobile. PWA instalable, offline con IndexedDB.
- **Idioma**: Español (es-CL). Moneda: CLP. TZ: America/Santiago. Formato fecha: DD/MM/YYYY.

## 🔐 Autenticación y roles
- Supabase Auth (email/password) con perfil en tabla `profiles`.
- Roles en tabla **separada** `user_roles` (enum: `admin`, `viewer`, `operator`, `client`) + función `has_role()` SECURITY DEFINER.
- **RLS obligatorio** en todas las tablas.
- Permisos granulares por módulo configurables por admin.

## 📦 Módulos a construir (en este orden)

### Núcleo
1. **Auth** — login, registro, recuperación, perfil.
2. **Layout & Navegación** — sidebar colapsable, header, FAB de Quick Entry, breadcrumbs.
3. **Dashboard** — KPIs (servicios del mes, ingresos, vencidos), alertas, modal "Resumen de Pendientes" al login.

### Operaciones
4. **Servicios** — CRUD, estados protegidos (pending→in_progress→completed→closed), tarifas automáticas (jerarquía cliente→tipo→default), subcontratación con `outsourced_provider_id`, log de auditoría, operaciones por lote, duplicación, gastos auto-pagados (peajes/viáticos).
5. **Calendario** — hub multi-fuente (servicios + mantenciones + eventos remotos), vista mes/semana/día.
6. **Cierres** — agrupación de servicios por cliente, sincronización forzada con facturas.
7. **Clientes** — CRUD, RUT con verificación SRE/Ruts.info y formato chileno automático, departamentos, facturación mensual flag, historial.
8. **Operadores** — CRUD, flag `commission_exempt`, comisiones desde tabla `costs`.
9. **Grúas (Vehículos)** — CRUD, documentos con vencimientos (revisión técnica, permiso, seguro), bitácora técnica v3 (mantenciones + financiero + km), patentes con GetAPI.

### Inventario y Compras
10. **Inventario** — items, categorías, ubicaciones, movimientos, alertas de stock bajo, **Auto-SKU solo en importación XML** (`SKU-YYYYMMDD-HEX4`), valoración FIFO solo de status='active'.
11. **Proveedores** — pestañas Pagos/Proveedores/Calendario, **importador XML wizard** (modal 1600px) con detección de duplicados (folio+hash+contenido), fallback por RUT, asociación a costos existentes, sincronización triangular Costos↔Pagos↔Facturas.

### Finanzas
12. **Facturas** — CRUD, estado de pago (pagada/parcial/pendiente/vencida por saldo real), **anulación con Nota de Crédito obligatoria**, protección "ELIMINAR" en delete, conciliación automática al crear como pagada, importación histórica SII (CSV/XLSX prefijo HIST-), descripción opcional.
13. **Costos** — CRUD, importador XML, clasificación histórica por tokens, badge multi-item, fechas preservadas, eliminación con flujo seguro.
14. **Ingresos** — CRUD, vínculo opcional a facturas/clientes.
15. **Pagos** — conciliación inteligente **sin auto-asignación** (manual, prioridad por vencimiento).
16. **Comisiones** — desde `costs`, exclusión por flag, sincronización con servicios cerrados.
17. **Cuentas por Pagar** — deudas, créditos, intereses, cuotas (`debts`/`debt_installments`/`creditors`).
18. **Tarifas de Servicio** — jerarquía cliente→tipo→default.

### Herramientas
19. **Calculadora de Viajes** — Mapbox (ruta + previsualización) + GetAPI (peajes), estimación combustible por tipo de grúa.
20. **Reportes** — KPIs contextuales, exportación PDF/Excel, envío automático por Resend + pg_cron, filtros por departamento.
21. **Quick Entry / Registros Rápidos** — FAB flotante, captura de fotos, **auto-extracción con OpenAI gpt-4o-mini** para boletas.
22. **Pipeline VIP** — gestión post-servicio, importador OC/Cotizaciones con OCR fuzzy matching.
23. **Configuración** — datos empresa, plantillas, notificaciones WhatsApp (Meta Cloud API), permisos, **Panel de Emergencia** (admin), backup/restore.

### Móvil/PWA
24. **App Operador** — inspección, evidencia fotográfica, firma digital.
25. **Portal Cliente** — solicitudes, facturas, historial.
26. **PWA Offline v5** — IndexedDB con CRUD completo en Servicios/Costos/Clientes/Operadores/Grúas, sync al reconectar.

## 🗄️ Modelo de datos clave
Crear tablas (con RLS, `created_by`, timestamps): `profiles`, `user_roles`, `clients`, `services`, `cranes`, `operators`, `costs`, `cost_categories`, `cost_subcategories`, `incomes`, `invoices`, `inventory_items`, `inventory_movements`, `inventory_suppliers`, `supplier_payments`, `supplier_invoices`, `debts`, `debt_installments`, `creditors`, `service_closures`, `calendar_events`, `notifications`, `audit_log`, `company_data`.

## 🔌 Integraciones
- **Lovable AI Gateway** (gpt-4o-mini) para OCR/extracción.
- **Mapbox** para rutas.
- **GetAPI Chile** (llaves separadas) para peajes y verificación de patentes.
- **SRE/Ruts.info** para verificación de RUT.
- **Meta WhatsApp Cloud API** para notificaciones.
- **Resend** + pg_cron para reportes automáticos.

## ✅ Reglas de negocio críticas
- Relación 1:1 estricta Costos↔Facturas.
- Aislamiento Histórico (HIST-) vs Activo en finanzas.
- Vencimiento de facturas calculado por **saldo real**, no por estado.
- Sincronización bidireccional Costos↔Pagos↔Facturas vía triggers SQL.
- Solo admin puede escribir en `creditors`/`debts`/`debt_installments`/`debt_payments`.
- Quick Records de tipo "costo" con foto → auto-extracción y creación de costo.

## 🚀 Empieza por
1. Configurar Lovable Cloud + diseño violeta en `index.css`.
2. Auth + roles + Layout + Sidebar.
3. Dashboard vacío con KPIs mock.
4. Módulo de **Costos** (es el patrón visual de referencia).
5. Resto de módulos siguiendo el orden indicado.

Construye iterativamente: primero CRUDs básicos, luego sincronizaciones, luego importadores, luego integraciones externas.
