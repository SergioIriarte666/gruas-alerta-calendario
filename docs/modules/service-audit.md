# Auditoría de servicios

Acceso de administradores: **Servicios → Auditoría**, o `/services/audit`.
Consulta de solo lectura; no requiere migración ni modifica servicios/costos.

## Informe

- Período inicial: mes actual. Las fechas filtran el momento del cambio en la zona horaria configurada del negocio.
- Búsqueda por folio o patente de referencia; reconoce valores anteriores/nuevos en cambios de esos campos.
- Filtros por cliente, tipo de cambio y responsable. Cliente usa el vínculo actual del servicio; en cambios de cliente reconoce también ambos extremos del cambio. Los registros sin cliente recuperable se pueden consultar con «Cliente no identificado». El CSV incluye los clientes de referencia y respeta el filtro.
- Una fila por campo modificado, con antes/después, acción, responsable y detalle.
- Paginación visual de 50 filas. El CSV UTF-8 descarga **todos** los resultados filtrados, no solo la página visible. Neutraliza fórmulas en textos ingresados por usuarios.
- Estados de carga, error, período inválido y ausencia de resultados. No se permite descargar un informe fallido o incompleto.

## Fuentes y límites

`service_change_history` conserva los cambios del servicio y sus recursos. Se reutilizan las etiquetas y reglas de cambios significativos de la ficha del servicio.

`recovery_audit_entries` del módulo `costs` contiene snapshots antes/después; se calculan diferencias de los campos de negocio. `cost_change_history` complementa el historial cuando no existe un snapshot equivalente, incluidos períodos anteriores o posteriores a su retención. La combinación evita contar dos veces el mismo cambio registrado por ambos triggers.

Un costo trasladado conserva ambos vínculos cuando están disponibles en el evento. Los costos eliminados pueden identificarse por sus snapshots, sin depender de que siga existiendo la fila en `costs`. Para registros antiguos sin vínculo histórico se usa una asociación de referencia (actual o recuperada del borrado en `audit_log`), explícitamente señalada. Los costos sin servicio identificable no se incluyen. No se reconstruyen datos anteriores al registro ni se atribuye una utilidad histórica a partir de los valores actuales.

Las patentes de referencia pueden proceder del servicio actual o del valor guardado en el cambio; no equivalen a una captura histórica de la patente para todas las filas. Los UUID de campos relacionados se conservan en antes/después; el resumen de los triggers aporta los nombres cuando existen.

Las consultas están limitadas por fecha en el servidor y recorren todas las páginas por ID. Se respetan las políticas RLS existentes. Cualquier error de una fuente interrumpe el informe completo. Las consultas se cancelan al cambiar el período y la caché está separada por usuario y fechas.

## Comprobación

Pruebas: `src/lib/__tests__/serviceAudit.test.ts` y `src/hooks/services/__tests__/useServiceAudit.test.ts`. Cubren deduplicación, diferencias monetarias, búsquedas históricas, cambios de vínculo, eliminaciones, paginación completa y CSV.
