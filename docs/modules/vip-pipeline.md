# vip-pipeline

## Resumen
Modulo de **VIP pipeline** para operacion avanzada por cliente, con pipeline de servicios, ordenes de compra, analitica, reportes e importacion PDF inteligente.

La implementacion actual va bastante mas alla de un pipeline simple: integra matching heuristico, fallback local cuando falla IA remota y herramientas operativas sobre servicios del cliente.

## Entrypoints vigentes
- Pagina: [VipClientPipeline](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/VipClientPipeline.tsx)
- Hooks: [src/hooks/vip](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/hooks/vip)
- Ruta relacionada desde clientes: `/clients/:clientId/pipeline`

## Ruta
- `/clients/:clientId/pipeline`

## Arquitectura actual
La pagina actual organiza 4 tabs:
- `pipeline`
- `purchase-orders`
- `analytics`
- `reports`

Ademas integra:
- `PipelineListView`
- `PipelineMetrics`
- `PurchaseOrderManager`
- `ClientAnalytics`
- `PredictiveInsights`
- `ExecutiveReports`
- `PurchaseOrderDialog`
- `ServiceDetailsModal`
- `ServicesDialogs`

## Hooks y servicios clave
- `useClientServices`
- `useQuotePDFImport`
- `usePurchaseOrderPDFImport`

## Datos y dependencias principales
- servicios del cliente
- matching por patente, VIN, cotizacion, monto, fecha y glosa
- actualizacion de estados operativos del pipeline
- importacion PDF con estrategia IA remota + fallback local

## Flujos vigentes
### 1. Pipeline operativo
- Permite crear, editar y actualizar servicios del cliente dentro del flujo VIP.
- Soporta batch update con progreso visible.

### 2. Importacion de cotizaciones y ordenes
- Los hooks intentan primero un parser con IA remota.
- Si falla el gateway, desactivan IA en sesion y hacen fallback a parser local.

### 3. Matching y actualizacion de estado
- El sistema valida RUT, recarga servicios y aplica heuristicas de matching.
- Puede actualizar automaticamente estados como `quoted` o `with_purchase_order`.

### 4. Tabs analiticas y reportes
- El modulo incluye analitica y reportes ejecutivos, no solo pipeline visual.

## Consideraciones de mantenimiento
- Documentar siempre el flujo hibrido IA/local de importacion PDF.
- No reducir el modulo a “pipeline + importador PDF” porque hoy incluye gestion operativa y analitica adicional.
