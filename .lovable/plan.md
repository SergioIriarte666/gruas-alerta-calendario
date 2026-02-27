
Objetivo: eliminar de forma definitiva el congelamiento al finalizar cierre y emitir factura, atacando la causa raíz de carga masiva y bloqueos de UI tras la creación de factura.

Resumen del diagnóstico (con evidencia):
1) En el flujo “finalizar cierre → emitir factura”, al crear una factura se invalidan queries globales (incluyendo ['services']).
2) La query ['services'] usa `useServiceFetcher` con paginación manual de toda la tabla (`fetchAllPages` de 1000 en 1000) y joins amplios; actualmente hay ~1040 servicios y seguirá creciendo.
3) Esa recarga completa se dispara desde múltiples lugares (invoice create/update/delete + realtime + otros módulos), y mientras ocurre, la UI principal queda pesada/congelada.
4) El problema no parece ser error SQL/timeout en backend (sin errores críticos recientes en logs), sino saturación del cliente por refetch global innecesario.
5) En el wizard de factura, además hay un trigger secundario de carga pesada: `EnhancedClosureSelector` llama `useClients()` (trae todos los clientes) aunque ya se dispone de `clientName` en el closure; esto agrega costo al render del formulario.

Causa raíz:
- Acoplamiento excesivo entre facturación y refetch global del módulo de servicios (dataset grande + joins + múltiples invalidaciones).
- Carga redundante en el paso de selección de cierre (clientes completos para resolver nombre).

Plan de corrección definitiva (implementación):
Fase 1 — Contención inmediata del congelamiento en flujo factura
1. Ajustar invalidaciones en `src/hooks/invoices/useInvoiceOperations.ts`:
   - `createInvoice`: eliminar invalidación de `['services']`, `['operatorServices']`, `['crane-services']`.
   - Mantener invalidación enfocada: `['invoices']`, `['closures']`.
   - Razonamiento: en este flujo el usuario está en `/invoices`; no necesita recargar todo servicios al crear factura.
2. `updateInvoice` y `deleteInvoice`:
   - Mismo enfoque de invalidación mínima por contexto de facturación.
   - Solo mantener invalidaciones de servicios cuando realmente cambie relación de cierre o haya reversión de estado de servicios.
   - En esos casos, usar invalidación granular (si existe key por id) o una invalidación diferida/no bloqueante.
3. Evitar refresh duplicado en `useInvoices.ts`:
   - Actualmente se hace update optimista + `refetch()` inmediato.
   - Cambiar a una sola estrategia (preferible invalidación React Query y confiar en cache update), para evitar doble trabajo de red/render.

Fase 2 — Reducir carga del formulario de factura
4. Optimizar `src/components/invoices/EnhancedClosureSelector.tsx`:
   - Eliminar dependencia de `useClients()` para resolver nombre.
   - Mostrar `closure.clientName` proveniente de `useClosuresForInvoices` (ya disponible).
   - Resultado: menos query global y menos render costoso al abrir “Nueva Factura”.
5. Corregir detalle visual/textual en ese componente:
   - texto “incluye cierres texto facturados” → “incluye cierres facturados” (limpieza).

Fase 3 — Endurecimiento de arquitectura para no reintroducir el problema
6. Blindar `useServiceFetcher` (`src/hooks/services/useServiceFetcher.ts`) para que no sea un “hot path” del flujo facturas:
   - Mantener fetch full solo cuando el usuario está en módulos que realmente lo requieren (services/costs/reports).
   - Para invalidaciones provenientes de facturas, usar “soft invalidate” (marcar stale sin refetch inmediato) o refetch bajo demanda en pantalla de servicios.
7. Revisar `useUnifiedRealtimeManager` para evitar invalidaciones cruzadas agresivas:
   - No disparar recargas globales de servicios por eventos de facturas si el usuario no está en pantallas dependientes de servicios.

Validación (criterio de aceptación):
1. Desde /closures:
   - Crear cierre → confirmar “crear factura” → completar wizard y guardar.
2. Resultado esperado:
   - No congelamiento ni bloqueo perceptible (>1–2 s de UI freeze).
   - Navegación fluida al volver/listar facturas.
   - Cierre pasa a “invoiced” y factura creada correctamente.
3. Prueba de regresión:
   - /services sigue mostrando estado correcto tras entrar manualmente o refrescar.
   - /invoices mantiene datos coherentes (resumen, detalle, estado).
4. Prueba de volumen:
   - Repetir con cierres de muchos servicios para confirmar estabilidad.

Riesgos y mitigación:
- Riesgo: que servicios no reflejen estado inmediatamente en otras vistas.
  Mitigación: invalidación diferida en background al entrar a /services + botón refresh explícito ya existente.
- Riesgo: dependencia oculta de `useClients()` en selector.
  Mitigación: fallback “Cliente desconocido” si `clientName` no viene.

Archivos a intervenir:
1) `src/hooks/invoices/useInvoiceOperations.ts`
   - recorte de invalidaciones globales de servicios en create/update/delete.
2) `src/hooks/useInvoices.ts`
   - eliminar `refetch()` redundante post operación cuando ya se actualiza cache.
3) `src/components/invoices/EnhancedClosureSelector.tsx`
   - quitar `useClients`, usar `closure.clientName`, reducir costo de render.
4) (Opcional endurecimiento) `src/hooks/services/useServiceFetcher.ts`
   - estrategia de refetch menos agresiva para query ['services'] fuera de pantalla de servicios.
5) (Opcional endurecimiento) `src/hooks/useUnifiedRealtimeManager.ts`
   - desacoplar invalidaciones cruzadas no críticas.

Notas técnicas importantes:
- Este enfoque corrige la causa sistémica (tormenta de refetch de servicios completos) y no solo “parcha” síntomas.
- Respeta patrones existentes y minimiza impacto funcional.
- El estilo UI no cambia; solo comportamiento y performance.
