## Plan: Documentar la arquitectura de integración cruzada entre módulos

Crear un documento técnico-funcional que explique cómo la app cruza información entre módulos, con ejemplos reales tomados del código existente.

### Archivo a crear

**`docs/architecture/cross-module-integration.md`** — Documento maestro de referencia, en español, con tono mixto (técnico + ejecutivo) para que sirva tanto a desarrolladores como para explicar a clientes/socios.

### Estructura del documento

1. **Resumen ejecutivo** (1 párrafo)
   - Qué es y por qué es la característica principal de la app.

2. **Nombre técnico y conceptos clave**
   - ERP integrado / Cross-Module Data Integration
   - Single Source of Truth (SSOT)
   - Referential Integrity
   - Cascading Operations
   - Bidirectional Sync
   - Event-Driven Architecture
   - Data Orchestration
   - Domain-Driven Design (bounded contexts)

3. **Mapa de módulos y sus puntos de integración**
   - Diagrama Mermaid mostrando: Servicios ↔ Cierres ↔ Facturas ↔ Pagos ↔ Costos ↔ Inventario ↔ Proveedores ↔ Comisiones ↔ Grúas.

4. **Ejemplos reales de cada patrón** (con referencias a archivos del proyecto)

   - **Ejemplo 1 — Orquestación de datos (Data Orchestration)**
     `UnifiedPurchaseService.registerPurchase()`: una sola compra escribe en `inventory_items`, `inventory_stock`, `inventory_movements`, `costs`, `crane_parts`, `supplier_invoice_items`.

   - **Ejemplo 2 — Operaciones en cascada (Cascading Operations)**
     `useServiceLiberation.liberateInvoice()` (recién implementado): liberar factura → elimina `invoice_services`, `invoice_closures`, cierres no compartidos, y resetea `services` a `with_purchase_order`.

   - **Ejemplo 3 — Sincronización bidireccional (Bidirectional Sync)**
     Costos ↔ Pagos a Proveedor (memoria `supplier-payment-cost-sync-v2`): registrar un pago marca el costo como pagado, y editar el costo refleja el cambio en el pago.

   - **Ejemplo 4 — Single Source of Truth**
     Comisiones: la tabla `costs` es la fuente canónica (memoria `commissions-overhaul`); `services.operator_commission` es campo legacy mantenido en sync por `useAdvancedServiceSync`.

   - **Ejemplo 5 — Verificación de consistencia y auto-reparación**
     `useAdvancedServiceSync.verifyConsistency()` y `autoRepair()`: detectan y corrigen automáticamente desfases entre `services`, `service_resources` y `costs`.

   - **Ejemplo 6 — Sincronización en tiempo real (Realtime)**
     `useUnifiedRealtimeManager` + `useUniversalSync.invalidateAll()`: cuando un módulo escribe en BD, los demás módulos refrescan su UI sin recargar la página.

   - **Ejemplo 7 — Sincronización triangular (3 dominios)**
     Importador XML DTE (memoria `xml-triangular-synchronization`): un XML de factura de compra crea simultáneamente un `Costo`, un `Supplier Payment` y una `Supplier Invoice` enlazados entre sí.

   - **Ejemplo 8 — Status propagation (propagación de estados)**
     `service-invoice-status-sync`: cuando una factura cambia a "pagada", los servicios vinculados pasan a "facturado/pagado" automáticamente vía triggers de Postgres.

5. **Mecanismos técnicos que lo hacen posible**
   - Foreign keys + RLS en Supabase
   - Triggers de Postgres (status sync, auditoría)
   - RPC functions (`apply_payment_manual`, `smart_apply_payment`, `validate_payment_system_integrity`)
   - React Query + invalidación cruzada (`useUniversalSync`)
   - Realtime subscriptions
   - Servicios orquestadores en `src/services/*`
   - Hooks de sincronización en `src/hooks/*`

6. **Cómo explicarlo a una persona no técnica**
   - Analogía: "como un ERP — todos los módulos hablan entre sí en tiempo real, evitando doble ingreso y errores de inconsistencia".
   - Frase comercial lista para usar.

7. **Beneficios medibles**
   - Cero doble ingreso, integridad garantizada, trazabilidad end-to-end, auditoría automática, UX coherente.

8. **Referencias cruzadas**
   - Links a `docs/modules/*.md`, `docs/technical/payment-system.md`, memorias relevantes.

### Acciones adicionales

- Añadir entrada en `docs/README.md` apuntando al nuevo documento.
- Guardar memoria nueva: `mem://architecture/cross-module-integration` con la descripción canónica del patrón, para que futuras sesiones de IA lo apliquen como rule.

### Sin cambios de código

Esta tarea es 100% documentación. No se modifica ningún archivo bajo `src/`, `supabase/` ni configuración del proyecto.