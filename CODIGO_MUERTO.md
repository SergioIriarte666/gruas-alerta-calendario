# Código muerto — TMS Grúas 5 Norte

> **ANTES DE EDITAR CUALQUIER ARCHIVO DE ESTA LISTA: está muerto.**
> **No lo usa nadie. Si un refactor lo toca, es trabajo perdido.**
> **Verificar alcanzabilidad antes de editar.**

Son **161 archivos, 26.608 LOC** — el 10,4% de `src/`. Ninguno es alcanzable desde
los entry points (`index.html`, `src/main.tsx`, `vite.config.ts`, `tailwind.config.ts`,
`capacitor.config.ts`). No se borra ninguno: este archivo existe para que nadie les
siga haciendo mantenimiento por error.

**Por qué existe este documento.** El commit `87ef9761` (2026-07-28) escribió el mismo
blindaje de categorías bloqueadas dos veces: en `CostFormStep1.tsx`, que está vivo, y en
`CostFormInputs.tsx`, que lleva muerto desde el 25-12-2025. Seis líneas idénticas, la
mitad al vacío. No se detectó al escribirlas ni al revisarlas.

## Atajos

- [Muertos desactualizados — peligrosos de revivir](#muertos-desactualizados--peligrosos-de-revivir)
- [Alertas de inventario — muertos, se reemplazan por algo más chico](#alertas-de-inventario--muertos-se-reemplazan-por-algo-más-chico)
- [Los 161, por módulo](#los-161-por-módulo)
- [Baseline y chequeo automático](#baseline-y-chequeo-automático)

## Cómo leer la fecha de muerte

La columna **Murió** no es la fecha del último commit que tocó el archivo. Esa fecha
miente: un formateo masivo, un cambio de lint o un reemplazo de import la mueve a ayer
sobre un archivo que nadie alcanza desde hace un año. `CostFormInputs.tsx` figura como
editado el 2026-07-28 y murió el 2025-12-25.

**Murió = el commit que eliminó el último import que llegaba al archivo.** Se obtuvo
recorriendo toda la historia de `src/` (`git log -p`), resolviendo cada specifier
(`@/...`, `./...`, `import()` dinámico) al archivo real y llevando cuenta neta por
commit: si un commit agrega y quita el mismo import — una renombrada — el neto es cero
y no cuenta como muerte.

La columna **Cómo murió** dice cuál de los tres casos aplica:

| Valor | Significa |
|:---|:---|
| último import eliminado | Un commit concreto lo desconectó. Es la fecha exacta. |
| quedó colgando de otro muerto | Hoy solo lo importan archivos muertos. Murió cuando murió el último de ellos: la fecha es la de ese commit. |
| nunca lo importó nadie | No hay un solo commit en toda la historia que lo importe. Nació muerto; la fecha es la de su entrada al repositorio. |

Único punto ciego del método: un import eliminado dentro de la resolución de un merge
(*evil merge*), no en un commit propio. No se encontró ninguno, pero no se puede
descartar del todo.

## Muertos desactualizados — peligrosos de revivir

No basta con que estén muertos: además quedaron atrás respecto del esquema o de las
reglas de negocio actuales. Copiar código desde acá, o reconectarlos "porque ya está
escrito", introduce un bug que el archivo vivo ya no tiene.

### `src/components/costs/form/CostFormInputs.tsx`

- **Murió:** 2025-12-25 (`d4c5065d`), 529 LOC.
- **Le faltan `entity` y `paid_by`.** Es el formulario de costo de una sola pantalla,
  anterior a la separación LowBoy / G5N. Su payload no lleva ninguno de los dos campos.
  `addCost` rechaza los costos que no traen `entity`/`paid_by`, así que revivirlo rompe
  el alta de costos. Hoy esos campos se resuelven en `CostForm.tsx`, `CostFormStep3.tsx`
  y `useCosts.ts`, ninguno de los cuales tiene equivalente adentro de este archivo.
- **Ya cobró una víctima:** las 6 líneas del blindaje de categorías bloqueadas que
  `87ef9761` escribió acá, en paralelo a `CostFormStep1.tsx`. El vivo es
  `CostFormStep1.tsx`.

## Alertas de inventario — muertos, se reemplazan por algo más chico

**Estos 16 archivos (4.009 LOC) no se van a revivir.** En su lugar se construirá un
indicador simple de stock bajo dentro de la página de Bodega.

El sistema viejo traía panel de configuración de alertas, historial, modal de detalle y
dashboard propio, más una tabla `inventory_alerts` con filas de configuración. El
requerimiento real es mucho más chico: mostrar en pantalla, en Bodega, los productos que
están bajo su mínimo. Nada más.

**Se rescata una sola cosa:** la consulta que compara stock actual contra stock mínimo,
en `src/hooks/useInventoryAlerts.ts`, líneas 168-196.
Todo el resto — configuración, historial, notificaciones, dashboard, modal — se descarta.

Casi todos murieron el mismo día y por el mismo commit: `4a207cf8`, *"Refactor: Simplify
inventory module"* (2025-10-17), que sacó la pestaña "Alertas" de la página de Bodega y
dejó el subsistema entero colgando. Llevan **más de nueve meses** inalcanzables.

| Murió | Commit | LOC | Archivo |
|:---|:---|---:|:---|
| 2025-10-17 | `4a207cf8` | 588 | `src/hooks/useInventoryAlerts.ts` |
| 2025-10-17 | `4a207cf8` | 364 | `src/components/inventory/alerts/AlertConfigurationPanel.tsx` |
| 2025-10-17 | `4a207cf8` | 329 | `src/components/inventory/PurchaseGroupingView.tsx` |
| 2025-10-17 | `4a207cf8` | 313 | `src/components/inventory/ProductCatalogTable.tsx` |
| 2025-10-17 | `4a207cf8` | 286 | `src/components/inventory/PurchaseModal.tsx` |
| 2025-10-17 | `4a207cf8` | 285 | `src/components/inventory/alerts/AlertConfigurationForm.tsx` |
| 2025-10-17 | `4a207cf8` | 273 | `src/components/inventory/alerts/AlertHistoryView.tsx` |
| 2025-10-17 | `4a207cf8` | 260 | `src/components/inventory/alerts/AlertDashboard.tsx` |
| 2025-10-17 | `4a207cf8` | 252 | `src/components/inventory/alerts/ActiveAlertsList.tsx` |
| 2025-10-17 | `4a207cf8` | 222 | `src/components/inventory/alerts/AlertDetailModal.tsx` |
| 2025-10-17 | `4a207cf8` | 219 | `src/components/inventory/alerts/InventoryAlertsPage.tsx` |
| 2025-08-27 | `730c36a0` | 205 | `src/components/inventory/InventorySyncDashboard.tsx` |
| 2025-10-17 | `4a207cf8` | 160 | `src/components/inventory/alerts/AuthErrorHandler.tsx` |
| 2026-02-25 | `2075da55` | 128 | `src/components/suppliers/detail/SupplierInventoryTab.tsx` |
| 2025-10-17 | `4a207cf8` | 84 | `src/components/inventory/InventoryFixPanel.tsx` |
| 2025-10-17 | `4a207cf8` | 41 | `src/hooks/useInventoryFix.ts` |

Precisión sobre el bloque: 9 de los 16 son estrictamente el subsistema de alertas
(`src/components/inventory/alerts/*` + `useInventoryAlerts.ts`, 2.623 LOC). Los otros 7
son el resto del módulo Bodega que quedó muerto en la misma limpieza o cerca de ella, y
se listan juntos porque comparten destino: no se reviven.

Dos efectos colaterales de la misma muerte, fuera de Bodega:
`src/components/auth/QuickLogin.tsx` y `src/components/auth/SessionVerifier.tsx` figuran
en la lista general con fecha 2025-10-17 porque sus únicos importadores eran
`AlertConfigurationPanel.tsx` e `InventoryAlertsPage.tsx`.

## Rescatado antes de que se pierda

Código muerto que valía la pena conservar fuera del árbol de compilación, con su
contexto:

- [`docs/referencias/paginacion-server-side-servicios.md`](docs/referencias/paginacion-server-side-servicios.md)
  — `usePagedServices`, la paginación server-side de Servicios que se retiró en
  `074013f9` y se reemplazó por `.slice()` en cliente. Es el mismo patrón que causó el
  "solo 8" de Bodega → Movimientos.

## Los 161, por módulo

Dentro de cada módulo, del más recientemente muerto al más antiguo: mientras más fresca
la muerte, más fácil es confundirlo con código vivo.

### Transversal / otros — 85 archivos, 11.530 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-07-29 | `e815aa28` | 89 | `src/hooks/useOriginSearchCascade.ts` | último import eliminado |
| 2026-07-29 | `e815aa28` | 63 | `src/hooks/useMapboxGeocode.ts` | quedó colgando de otro muerto |
| 2026-07-29 | `e815aa28` | 2 | `src/lib/geoConstants.ts` | quedó colgando de otro muerto |
| 2026-07-14 | `9bd257ea` | 225 | `src/utils/commissionSync.ts` | último import eliminado |
| 2026-07-04 | `1d8e0d0b` | 37 | `src/components/icons/TowTruckIcon.tsx` | nunca lo importó nadie |
| 2026-06-30 | `9e4df943` | 255 | `src/components/shared/AddressAutocomplete.tsx` | último import eliminado |
| 2026-06-17 | `8462b789` | 230 | `src/data/userManualContent.ts` | quedó colgando de otro muerto |
| 2026-06-17 | `8462b789` | 175 | `src/utils/pdf/userManualPdfGenerator.ts` | quedó colgando de otro muerto |
| 2026-06-17 | `8462b789` | 161 | `src/pages/UserManual.tsx` | último import eliminado |
| 2026-06-08 | `63043c08` | 2 | `src/hooks/usePendingUsers.ts` | nunca lo importó nadie |
| 2026-05-25 | `50152a66` | 283 | `src/components/reports/maintenance/MaintenanceTables.tsx` | quedó colgando de otro muerto |
| 2026-05-25 | `50152a66` | 231 | `src/components/reports/shared/ReportFilters.tsx` | último import eliminado |
| 2026-05-25 | `50152a66` | 169 | `src/components/reports/maintenance/MaintenanceCharts.tsx` | quedó colgando de otro muerto |
| 2026-05-25 | `50152a66` | 166 | `src/components/reports/MaintenanceReport.tsx` | último import eliminado |
| 2026-05-25 | `50152a66` | 166 | `src/components/reports/maintenance/MaintenanceFilters.tsx` | quedó colgando de otro muerto |
| 2026-05-25 | `50152a66` | 142 | `src/components/reports/dashboard/ReportsDashboard.tsx` | último import eliminado |
| 2026-05-25 | `50152a66` | 141 | `src/components/settings/UserSettingsTab.tsx` | último import eliminado |
| 2026-05-25 | `50152a66` | 109 | `src/components/reports/maintenance/MaintenanceMetrics.tsx` | quedó colgando de otro muerto |
| 2026-05-25 | `50152a66` | 102 | `src/components/dashboard/MetricCard.tsx` | último import eliminado |
| 2026-05-23 | `b32540da` | 30 | `src/utils/iconMapper.ts` | último import eliminado |
| 2026-03-29 | `a265ccb1` | 241 | `src/utils/localReceiptOcr.ts` | último import eliminado |
| 2026-03-24 | `d8b8ac95` | 556 | `src/hooks/useCraneParts.ts` | quedó colgando de otro muerto |
| 2026-03-24 | `d8b8ac95` | 358 | `src/components/cranes/forms/PartsForm.tsx` | último import eliminado |
| 2026-03-24 | `d8b8ac95` | 247 | `src/components/cranes/PartsTraceabilityDashboard.tsx` | último import eliminado |
| 2026-03-24 | `d8b8ac95` | 80 | `src/hooks/useCranePartsDataMigration.ts` | último import eliminado |
| 2026-03-24 | `d8b8ac95` | 11 | `src/components/cranes/CranePartsDataMigration.tsx` | último import eliminado |
| 2026-03-23 | `6d2c4424` | 104 | `src/components/common/XMLPaymentConfig.tsx` | último import eliminado |
| 2026-03-06 | `06ac66de` | 2 | `src/hooks/finance/useSuppliers.ts` | nunca lo importó nadie |
| 2026-02-27 | `935a9969` | 51 | `src/hooks/useFrequentValues.ts` | nunca lo importó nadie |
| 2026-02-25 | `2075da55` | 103 | `src/components/suppliers/detail/SupplierPartsTab.tsx` | último import eliminado |
| 2025-12-30 | `01359ed8` | 262 | `src/hooks/usePWACapabilities.ts` | quedó colgando de otro muerto |
| 2025-12-30 | `01359ed8` | 182 | `src/components/pwa/InstallPrompt.tsx` | quedó colgando de otro muerto |
| 2025-12-30 | `01359ed8` | 154 | `src/components/pwa/SyncIndicator.tsx` | quedó colgando de otro muerto |
| 2025-12-30 | `01359ed8` | 41 | `src/components/pwa/ConnectionStatus.tsx` | quedó colgando de otro muerto |
| 2025-12-30 | `01359ed8` | 20 | `src/components/pwa/PWAWrapper.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 122 | `src/components/auth/QuickLogin.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 110 | `src/components/auth/SessionVerifier.tsx` | quedó colgando de otro muerto |
| 2025-09-12 | `8088514e` | 7 | `src/hooks/useTheme.ts` | último import eliminado |
| 2025-08-31 | `12e1837d` | 321 | `src/components/vip/WorkflowTimeline.tsx` | nunca lo importó nadie |
| 2025-08-31 | `8c4c8c37` | 225 | `src/components/vip/ServiceStatusTransition.tsx` | nunca lo importó nadie |
| 2025-08-31 | `92f98901` | 190 | `src/components/vip/ServiceCard.tsx` | quedó colgando de otro muerto |
| 2025-08-31 | `92f98901` | 136 | `src/components/vip/KanbanBoard.tsx` | último import eliminado |
| 2025-08-31 | `92f98901` | 123 | `src/components/vip/KanbanColumn.tsx` | quedó colgando de otro muerto |
| 2025-08-31 | `bea5b089` | 82 | `src/components/clients/ClientDetailModal.tsx` | nunca lo importó nadie |
| 2025-08-20 | `4beb3163` | 567 | `src/components/suppliers/XMLSupplierUpload.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 451 | `src/components/reports/ReportFilters.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 372 | `src/components/cranes/CraneDocumentation.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 317 | `src/components/cranes/CraneStatistics.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 262 | `src/components/cranes/forms/DocumentSettingsForm.tsx` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 236 | `src/hooks/useOfflineStorage.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 221 | `src/components/cranes/DocumentUploadModal.tsx` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 193 | `src/hooks/useCSVUpload.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 192 | `src/utils/authDiagnostic.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 174 | `src/components/cranes/CraneInformation.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 149 | `src/hooks/useDocumentAlerts.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 139 | `src/hooks/useCraneStatistics.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 127 | `src/utils/testUnifiedSystem.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 120 | `src/utils/csvUpload/serviceUploader.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 120 | `src/utils/csvUpload/templateGenerator.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 116 | `src/utils/connectionManager.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 102 | `src/components/reports/ReportsHeader.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 95 | `src/hooks/useFormPersistence.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 88 | `src/utils/csvUpload/serviceCreator.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 85 | `src/components/pwa/UpdateNotification.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 75 | `src/components/reports/DetailTables.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 75 | `src/utils/csvUpload/csvParser.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 74 | `src/components/clients/ClientGeneralInfo.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 66 | `src/components/reports/DistributionCharts.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 66 | `src/components/shared/ConnectionStatus.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 60 | `src/hooks/useSmartFormAlerts.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 56 | `src/components/auth/ErrorDisplay.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 51 | `src/components/reports/PrimaryCharts.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 49 | `src/utils/supabaseErrorHandler.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 45 | `src/utils/csvUpload/types.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 41 | `src/components/reports/MainMetrics.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 39 | `src/components/reports/operational/MainMetrics.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 38 | `src/hooks/useNetworkStatus.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 35 | `src/components/reports/ProfitabilityMetrics.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 33 | `src/components/reports/operational/ProfitabilityMetrics.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 25 | `src/components/reports/ReportMetricCard.tsx` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 24 | `src/components/forms/CustodyFormProvider.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 19 | `src/hooks/useRealtimeSync.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 12 | `src/utils/csvUpload/index.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 11 | `src/types/equipment.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 4 | `src/integrations/supabase/enhancedClient.ts` | nunca lo importó nadie |

### Bodega — 16 archivos, 4.009 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-02-25 | `2075da55` | 128 | `src/components/suppliers/detail/SupplierInventoryTab.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 588 | `src/hooks/useInventoryAlerts.ts` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 364 | `src/components/inventory/alerts/AlertConfigurationPanel.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 329 | `src/components/inventory/PurchaseGroupingView.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 313 | `src/components/inventory/ProductCatalogTable.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 286 | `src/components/inventory/PurchaseModal.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 285 | `src/components/inventory/alerts/AlertConfigurationForm.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 273 | `src/components/inventory/alerts/AlertHistoryView.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 260 | `src/components/inventory/alerts/AlertDashboard.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 252 | `src/components/inventory/alerts/ActiveAlertsList.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 222 | `src/components/inventory/alerts/AlertDetailModal.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 219 | `src/components/inventory/alerts/InventoryAlertsPage.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 160 | `src/components/inventory/alerts/AuthErrorHandler.tsx` | quedó colgando de otro muerto |
| 2025-10-17 | `4a207cf8` | 84 | `src/components/inventory/InventoryFixPanel.tsx` | último import eliminado |
| 2025-10-17 | `4a207cf8` | 41 | `src/hooks/useInventoryFix.ts` | quedó colgando de otro muerto |
| 2025-08-27 | `730c36a0` | 205 | `src/components/inventory/InventorySyncDashboard.tsx` | último import eliminado |

### Costos — 12 archivos, 2.779 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-03-24 | `8b0c7ecd` | 443 | `src/utils/xmlParser/xmlCostParser.ts` | último import eliminado |
| 2026-02-05 | `d8c94b11` | 486 | `src/components/costs/CostDetailsModal.tsx` | último import eliminado |
| 2026-02-05 | `d8c94b11` | 423 | `src/components/costs/CostsTableView.tsx` | último import eliminado |
| 2026-02-05 | `d8c94b11` | 250 | `src/components/costs/CostsHeader.tsx` | último import eliminado |
| 2026-02-05 | `d8c94b11` | 168 | `src/components/costs/CostTraceabilityPanel.tsx` | quedó colgando de otro muerto |
| 2026-02-05 | `d8c94b11` | 59 | `src/components/costs/QuickDateFilters.tsx` | quedó colgando de otro muerto |
| 2025-12-25 | `d4c5065d` | 529 | `src/components/costs/form/CostFormInputs.tsx` | último import eliminado |
| 2025-12-25 | `d4c5065d` | 20 | `src/components/costs/form/CostFormActions.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 166 | `src/components/costs/CostsTable.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 96 | `src/hooks/costs/useAutoCommissionCosts.ts` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 75 | `src/components/reports/CostAnalysis.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 64 | `src/components/reports/CostCharts.tsx` | nunca lo importó nadie |

### shadcn/ui — 15 archivos, 2.263 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-06-05 | `f5d71735` | 168 | `src/components/ui/input-group.tsx` | último import eliminado |
| 2026-06-05 | `f5d71735` | 83 | `src/components/ui/button-group.tsx` | último import eliminado |
| 2026-06-05 | `f5d71735` | 28 | `src/components/ui/kbd.tsx` | último import eliminado |
| 2026-06-05 | `f5d71735` | 16 | `src/components/ui/spinner.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 761 | `src/components/ui/sidebar.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 260 | `src/components/ui/carousel.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 240 | `src/components/ui/menubar.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 204 | `src/components/ui/context-menu.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 128 | `src/components/ui/navigation-menu.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 116 | `src/components/ui/drawer.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 115 | `src/components/ui/breadcrumb.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 69 | `src/components/ui/input-otp.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 43 | `src/components/ui/resizable.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 27 | `src/components/ui/hover-card.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 5 | `src/components/ui/aspect-ratio.tsx` | nunca lo importó nadie |

### Facturas — 8 archivos, 1.920 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-07-07 | `0aa42024` | 135 | `src/components/invoices/InvoiceOverdueNotifyDialog.tsx` | último import eliminado |
| 2026-07-07 | `0aa42024` | 85 | `src/hooks/useInvoiceEmail.ts` | último import eliminado |
| 2026-01-05 | `8a9a714a` | 193 | `src/components/suppliers/form/SupplierInvoiceSelector.tsx` | último import eliminado |
| 2026-01-05 | `8a9a714a` | 154 | `src/hooks/useSupplierInvoices.ts` | quedó colgando de otro muerto |
| 2025-12-22 | `84f21ccf` | 227 | `src/components/invoices/InvoiceEmergencyActions.tsx` | último import eliminado |
| 2025-08-22 | `ebf13a5c` | 559 | `src/components/invoices/PaymentReconciliationUpdated.tsx` | nunca lo importó nadie |
| 2025-08-22 | `ebf13a5c` | 139 | `src/components/invoices/SystemHealthIndicator.tsx` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 428 | `src/components/invoices/PaymentForm.tsx` | nunca lo importó nadie |

### Servicios — 8 archivos, 1.536 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-07-29 | `e815aa28` | 170 | `src/components/services/MapboxAddressInput.tsx` | último import eliminado |
| 2026-06-15 | `1a63a4b9` | 66 | `src/components/services/form/FormActions.tsx` | último import eliminado |
| 2026-06-15 | `1a63a4b9` | 29 | `src/components/services/form/ServiceFormHeader.tsx` | último import eliminado |
| 2026-06-10 | `074013f9` | 447 | `src/hooks/services/useServiceQueries.ts` | último import eliminado |
| 2026-05-25 | `50152a66` | 42 | `src/components/services/GlobalRefreshButton.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 383 | `src/components/services/CSVUploadServices.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 372 | `src/components/services/ServicesPageContent.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 27 | `src/hooks/services/useServiceDeletion.ts` | nunca lo importó nadie |

### Cierres — 5 archivos, 768 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-04-16 | `8aedca78` | 359 | `src/hooks/useClosureAutomation.ts` | último import eliminado |
| 2025-12-25 | `d6899d9d` | 42 | `src/components/closures/FormActions.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 172 | `src/components/closures/ClosureEmergencyActions.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 114 | `src/components/invoices/ClosureSelector.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 81 | `src/components/closures/ServicesSelector.tsx` | nunca lo importó nadie |

### Portal Cliente — 1 archivos, 703 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-07-23 | `0a746629` | 703 | `src/design/portal-alternatives.tsx` | nunca lo importó nadie |

### Ubicaciones — 4 archivos, 445 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-06-29 | `c02d4c17` | 155 | `src/components/services/form/LocationCombobox.tsx` | último import eliminado |
| 2026-06-29 | `c02d4c17` | 82 | `src/hooks/services/useFrequentLocations.ts` | quedó colgando de otro muerto |
| 2025-08-27 | `f49dae89` | 59 | `src/components/services/form/LocationSection.tsx` | último import eliminado |
| 2025-08-19 | `2c974bab` | 149 | `src/components/quick-entry/LocationCapture.tsx` | nunca lo importó nadie |

### Comisiones — 2 archivos, 274 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2025-08-19 | `2c974bab` | 223 | `src/utils/forceCommissionSync.ts` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 51 | `src/utils/testCommissionSync.ts` | nunca lo importó nadie |

### Portal Operador — 3 archivos, 271 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2025-08-19 | `2c974bab` | 149 | `src/components/operator/PhotoCapture.tsx` | nunca lo importó nadie |
| 2025-08-19 | `2c974bab` | 86 | `src/components/operator/PhotoCaptureControls.tsx` | quedó colgando de otro muerto |
| 2025-08-19 | `2c974bab` | 36 | `src/components/operator/PhotoGrid.tsx` | quedó colgando de otro muerto |

### Inspecciones — 2 archivos, 110 LOC

| Murió | Commit | LOC | Archivo | Cómo murió |
|:---|:---|---:|:---|:---|
| 2026-07-13 | `0cfb4174` | 65 | `src/hooks/inspection/useInspectionEmail.ts` | último import eliminado |
| 2025-08-19 | `2c974bab` | 45 | `src/hooks/inspection/usePartialPDF.ts` | nunca lo importó nadie |

## Baseline y chequeo automático

**Baseline: 161 archivos muertos** (26.608 LOC), medido con knip 6.31 y verificado sobre
`8bb2c6ba` (2026-08-02). La configuración vive en `knip.json`.

Para reproducirlo en local:

```bash
npx knip --include files --reporter markdown
```

El workflow `.github/workflows/knip.yml` corre ese mismo comando en cada push y en cada
pull request. **No bloquea el merge**: compara el total contra el baseline y escribe el
resultado en el resumen del job.

- **Si el número sube en un PR**, ese PR dejó restos nuevos: un archivo que se dejó de
  importar y no se borró. Revisarlo ahí mismo, que es cuando cuesta cinco minutos.
- **Si el número baja**, se limpió algo. Actualizar el baseline en este archivo, en la
  misma línea de arriba, dentro del mismo PR.

El chequeo no reemplaza la lectura: knip encuentra archivos inalcanzables, no archivos
equivocados. Un archivo puede estar vivo y ser el equivocado — que es exactamente lo que
pasó con `CostFormInputs.tsx` antes de morir.
