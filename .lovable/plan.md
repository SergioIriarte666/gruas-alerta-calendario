
# Prompt: Módulo "+Nuevo Servicio" (TMS Grúas)

Copia este prompt en un nuevo proyecto Lovable para reconstruir el formulario completo de creación/edición de servicios.

---

## Objetivo
Construir un formulario multi-paso `EnhancedServiceForm` para crear, editar y duplicar **servicios** de una empresa de grúas. Stack: React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Lovable Cloud (Supabase). Idioma es-CL, moneda CLP, TZ America/Santiago, fecha DD/MM/YYYY. Paleta violet-600 (sin verde). Patrón visual: módulo de Costos (cards, badges, modales, toggles).

## Estructura: wizard de 4 pasos
1. **Identificación y fechas** — folio, fecha de solicitud, fecha de servicio, hora inicio/fin, kilometraje grúa.
2. **Cliente y vehículo** — cliente, tipo de servicio, OC, cotización, marca/modelo/patente, asegurado, origen/destino.
3. **Recursos y costos** — grúa, operadores múltiples con comisiones, subcontratación, costos del servicio, venta de productos (inventario), custodia/arriendo.
4. **Valores y resumen** — valor del servicio, exceso, totales calculados, observaciones, estado.

Navegación: `FormStepNavigation` con barra de progreso, validación por paso (no avanza si hay errores en el actual), botones Anterior/Siguiente/Guardar. Panel lateral `FormSummaryPanel` con resumen en vivo (cliente, tipo, valor, comisiones totales, costos totales, margen).

## Funcionalidades detalladas

### 1. Folio (`FolioSection` + `FolioInput`)
- **Automático por defecto**: hook `useEnhancedFolioGeneration` genera folio único validando contra DB (`services.folio`). Formato configurable (ej. `SRV-YYYYMMDD-XXXX`).
- **Toggle "Folio manual"** (Switch): habilita input editable. Validación: 3+ caracteres, solo `[A-Za-z0-9\-_]`, único en DB (chequeo async con debounce, indicador visual disponible/ocupado).
- **Botón "Regenerar"** visible solo en modo automático y creación.
- En edición: folio bloqueado salvo permiso admin.
- En duplicación: genera nuevo folio automático, conserva `_originalFolio` en metadata.

### 2. Fechas (`DateSection`)
- `requestDate` y `serviceDate` con `DatePickerInput`. Default = hoy en TZ de la app (`getCurrentChileDateString()` desde `businessClock` — fuente única de verdad de timezone).
- Hora inicio/fin opcionales (HH:mm).
- `craneMileage` numérico opcional (para bitácora de grúa).
- **Crítico**: usar `safeParseDateOnly` para evitar shifts UTC.

### 3. Cliente y tipo de servicio (`ClientServiceSection`)
- Combobox de clientes activos (`isActive: true`), con búsqueda por nombre/RUT, formato RUT chileno automático.
- Select de tipo de servicio (`service_types` activos). Cada tipo trae config: `operatorRequired`, `craneRequired`, `originRequired`, `destinationRequired`, `vehicleBrandRequired`, `vehicleModelRequired`, `licensePlateRequired`, `purchaseOrderRequired`. El schema (`createServiceFormSchema`) aplica validaciones condicionales dinámicas.
- **Orden de compra** (`purchaseOrder`): input texto. Obligatorio si tipo lo exige o si cliente tiene flag `requires_po`. Se persiste también como `purchaseOrderNumber` para compatibilidad.
- **Cotización** (`quoteNumber`): input texto opcional. Si viene desde Pipeline VIP se rellena automáticamente.
- **Asegurado** (`InsuredNameCombobox`): autocomplete con valores frecuentes para el cliente (hook de autocompletado inteligente).

### 4. Vehículo (`VehicleSection`)
- Marca, modelo, patente (formato chileno auto-mayúscula).
- Lookup de patente vía GetAPI (botón "Buscar patente") → autorrellena marca/modelo/VIN. VIN 17 chars.
- Validación condicional según `serviceTypeConfig`.

### 5. Ubicaciones (`EnhancedLocationSection` + `LocationCombobox`)
- Origen y destino con autocomplete (valores históricos + Mapbox geocoding).
- Botón "Calcular ruta" abre TripCalculator (Mapbox + GetAPI peajes) y retorna distancia/peaje sugeridos como costos.

### 6. Tarifa automática
- Hook `useServiceRateLookup`: al cambiar cliente + origen + tipo de servicio, busca en `service_rates` por jerarquía: **(cliente + tipo + origen) → (cliente + tipo) → (cliente) → (default por tipo)**.
- Si encuentra, autollena `value` y muestra toast informativo. Bandera `valueFromRate` permite override manual.
- No se aplica en edición de servicio existente.

### 7. Grúa (`crane`)
- Select de grúas activas. Filtrable por tipo (liviana/pesada/plataforma). Obligatorio si `craneRequired`.

### 8. Operadores múltiples (`MultipleOperatorsSection`)
- Array dinámico: agregar/quitar operadores. Cada uno: `operatorId`, `role` (Principal/Asistente), `hours`, `commission` (CLP).
- Operadores con flag `commission_exempt` en DB fuerzan comisión = 0 (visual: badge "Exento").
- Al menos uno requerido si `operatorRequired`.
- Suma de comisiones se muestra en resumen y se persiste en tabla `service_operators` (o JSON en `services.operators`).

### 9. Subcontratación (`OutsourcedProviderSection`)
- Toggle "Servicio subcontratado a tercero".
- Si activo: select de proveedor (`inventory_suppliers`), `outsourcedCost` (lo que pagamos al tercero), `outsourcedNotes`.
- Genera automáticamente un costo asociado al cierre del servicio.

### 10. Costos del servicio (`ServiceCostDetailsSection`)
- Array de costos: descripción (Textarea para textos largos), categoría (`cost_categories`), subcategoría dinámica, cantidad, precio unitario, monto, notas.
- Toggle **"Marcar costos como pagados al crear"** (`markCostsPaidOnCreate`, default true). Comisiones nunca se auto-pagan.
- Costos heredan `serviceDate` (no modificable desde aquí — preserva consistencia).
- Cada costo se inserta en tabla `costs` con `service_id` FK al crear.

### 11. Venta de productos / Inventario (`ProductSalesSection`)
- Solo visible si tipo de servicio = "Venta de Productos" (auto-seleccionado si llega con `?newSale=true`).
- Array de items: select de `inventory_items` (filtra activos), cantidad, precio unitario (autollena desde item), descuento %.
- Al guardar: `useInventoryDeduction` descuenta stock y crea `inventory_movements` tipo "salida".
- Validación: stock disponible >= cantidad solicitada.

### 12. Custodia / Arriendo (`CustodySection`)
- Toggle "Habilitar custodia/arriendo".
- Modos: `none` | `manual` (días + tarifa diaria) | `calendar` (fechas inicio/fin auto-calculan días) | `entry_exit`.
- Campos: `custodyVehicleType` (obligatorio), `custodyDailyRate`, `custodyDays`, `custodyStartDate`, `custodyEndDate`, `custodyDiscountPercentage`, `custodyTotalAmount` (auto = días × tarifa × (1-descuento)), `custodyNotes`.
- Tipo "Arriendo de Equipos" exige fechas + tipo equipo + tarifa.
- Validación: fin >= inicio.

### 13. Valores financieros (`EnhancedFinancialSection`)
- `value` (CLP, formateado en vivo).
- Toggle **"Servicio con exceso"** (`hasExcess`): si activo, muestra `clientCoveredAmount` (lo que paga cliente) y `excessAmount` (auto = value - clientCovered). Validación: cubierto <= valor.
- Cálculo en vivo de **margen**: `value - sum(costos) - sum(comisiones) - outsourcedCost`.

### 14. Observaciones (`ObservationsSection`)
- Textarea libre. Persiste en `services.observations`.

### 15. Estado del servicio
- Enum: `pending | in_progress | completed | cancelled | invoiced | quoted | purchase_order_pending | with_purchase_order`.
- Transiciones protegidas por triggers SQL (no permite saltar de `pending` directo a `invoiced`).
- Default al crear: `pending` (o `quoted`/`with_purchase_order` si viene desde Pipeline VIP).

## Flujos contextuales (prefill)
El form acepta `prefilledData` desde:
- **Calendario**: evento → servicio (`fromCalendarEvent`).
- **Inventario**: `?newSale=true` → preselecciona tipo "Venta de Productos".
- **Duplicación**: `_isDuplicating: true`, copia todo menos folio y costos.
- **Pipeline VIP**: con OC/cotización preprocesada por OCR.
- **Portal cliente**: solicitud de servicio → prellena cliente, vehículo, origen/destino.

## Validación
- Hook `useServiceFormValidation`: schema Zod dinámico (`createServiceFormSchema(serviceTypeConfig)`).
- `ServiceValidationAlerts`: muestra errores agrupados por paso.
- Bloqueo de submit si hay errores. Sonido `playRetroErrorSound` en error, `playRetroSuccessSound` en éxito.

## Persistencia (`useServiceManager`)
- `createService(data)`: inserta en `services`, luego en cascada `service_operators`, `costs`, `inventory_movements`, `calendar_events` (si tiene fecha futura).
- `updateService(id, data)`: update con audit log (`service_audit_log` vía trigger).
- Sincronización automática:
  - Costo creado → si `markCostsPaidOnCreate`, crea `supplier_payments` ligado.
  - Subcontratación → costo a proveedor.
  - Estado `completed` → habilita facturación.
  - Estado `invoiced` → sincronización forzada con factura (`force_commission_sync_for_service`).

## Tablas Supabase mínimas
`services`, `service_operators`, `service_types`, `service_rates`, `clients`, `cranes`, `operators`, `costs`, `cost_categories`, `inventory_items`, `inventory_movements`, `inventory_suppliers`, `service_audit_log`. Todas con RLS y `created_by`.

## UI / Diseño
- Cards con `ColoredSectionCard` (header con icono Lucide + color por sección: violeta, azul, ámbar).
- Badges de estado violeta para positivos, rojo para errores, ámbar para pendientes.
- Mobile-first: tabla → cards, wizard ocupa pantalla completa en móvil con sticky footer de acciones.
- Modal de creación: ancho `max-w-5xl`, scroll interno, header con folio + estado.

## Reglas críticas
- Nunca `new Date()` para lógica de negocio — usar helpers de `businessClock` / `timezoneUtils`.
- Operadores exentos: comisión forzada a 0 a nivel DB.
- Costos heredan `serviceDate` siempre.
- 1:1 estricto Costo ↔ Factura.
- Folio único global, validado en cliente y DB.

---

Construir en este orden: schemas Zod → hooks de datos → secciones del form → wizard navigation → integración persistencia → flujos contextuales.
