# commissions

## Resumen
Modulo de **comisiones** para revisar comisiones calculadas, agruparlas por operador, exportarlas y generar lotes de pago.

La fuente de datos vigente no es solo una RPC: el flujo actual usa `useCommissions` con estrategia `RPC + fallback a costs`.

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
- fallback sobre `costs` cuando la RPC falla o no retorna datos
- relacion con servicios y detalle desde `ServiceDetailsModal`

## Flujos vigentes
### 1. Consulta de comisiones
- `useCommissions` intenta obtener datos via RPC.
- Si falla o vuelve vacio, cae a un flujo alternativo basado en costos.

### 2. Vistas de trabajo
- La pantalla permite trabajar por listado general o por operador.
- Ambas vistas soportan exportacion y acciones operativas relacionadas.

### 3. Lotes y pagos
- Se pueden seleccionar registros y generar lotes de pago.
- Existe edicion de fecha de pago para registros relacionados.

### 4. Navegacion a servicio
- Desde la tabla se puede abrir `ServiceDetailsModal`.
- Ese detalle puede disparar sincronizacion relacionada con comisiones.

## Consideraciones de mantenimiento
- No documentar `useCommissionSync` como eje principal si no participa de la UI actual.
- Mantener claro que la fuente real es `RPC + fallback`, no solo RPC pura.
