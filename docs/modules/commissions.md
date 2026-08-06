# commissions

## Resumen
Modulo de **comisiones** para revisar comisiones calculadas, agruparlas por operador, exportarlas y generar lotes de pago.

El servicio define la comisión en `service_resources`; `costs` es su proyección contable para listado y pago. El flujo de lectura usa `useCommissions` con estrategia `RPC + fallback a costs`.

## Entrypoints vigentes
- Pagina: [Commissions](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Commissions.tsx)
- Componentes: [src/components/commissions](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/commissions)

## Ruta
- `/commissions`

## Arquitectura actual
La pagina actual organiza 2 vistas principales:
- `Todas las Comisiones`
- `Por Operador`

Ademas integra:
- `CommissionTable`
- exportacion
- seleccion masiva
- creacion de lotes de pago
- dialogo de edicion de fecha de pago

## Hooks y servicios clave
- `useCommissions`
- `useCreatePaymentBatch`
- `useCommissionExport`
- `useCommissionPayments`

## Datos y dependencias principales
- RPC `get_commissions_with_details`
- RPC transaccional `create_commission_payment_batch`
- fallback sobre `costs` cuando la RPC falla o no retorna datos
- tabla `commission_batches` para trazabilidad del lote
- relacion con servicios y detalle desde `ServiceDetailsModal`

## Flujos vigentes
### 1. Consulta de comisiones
- `useCommissions` intenta obtener datos via RPC.
- Si falla o vuelve vacio, cae a un flujo alternativo basado en costos.

### 2. Vistas de trabajo
- La pantalla permite trabajar por listado general o por operador.
- Ambas vistas soportan exportacion y acciones operativas relacionadas.

### 3. Lotes y pagos
- Toda comisión del servicio se proyecta inicialmente sin `payment_date`, independientemente del estado del servicio.
- Se pueden seleccionar registros pendientes de un solo operador y generar un lote de pago persistente.
- La creación del lote y el cambio a pagado ocurren en una única transacción.
- La edición posterior de fecha solo acepta comisiones ya pagadas y conserva el identificador del lote original.

### 4. Elegibilidad
- `operators.commission_exempt` define si el trabajador recibe comisiones.
- Cambiar esa condición reconcilia automáticamente sus comisiones no pagadas.
- Las ya pagadas se conservan como historial contable.

### 5. Navegacion a servicio
- Desde la tabla se puede abrir `ServiceDetailsModal`.
- Ese detalle puede disparar sincronizacion relacionada con comisiones.

## Consideraciones de mantenimiento
- No documentar `useCommissionSync` como eje principal si no participa de la UI actual.
- Mantener separadas la fuente operacional (`service_resources`) y la proyección contable/pago (`costs`).
