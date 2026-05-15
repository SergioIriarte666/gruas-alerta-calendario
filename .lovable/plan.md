## Problema

Al usar **Liberar Factura** en `Configuración → Liberación`, hoy ocurre esto:

1. Se borra la factura y sus relaciones (`invoice_services`, `invoice_closures`).
2. Los cierres vinculados **se devuelven a estado "Cerrado"** en vez de eliminarse.
3. Los servicios vuelven a "Con OC".

Resultado: el usuario tiene que hacer una **segunda búsqueda por `CIE-XXX`** y volver a confirmar para liberar realmente los servicios y poder reprocesar el cierre. Doble paso innecesario.

Referencia: `src/hooks/useServiceLiberation.ts` líneas 211-218 (revierte el cierre en lugar de eliminarlo).

## Cambio propuesto

Hacer que **Liberar Factura** sea una operación en **cascada completa**: factura + cierres vinculados + relaciones, en una sola confirmación.

### Lógica nueva en `liberateInvoice` (`src/hooks/useServiceLiberation.ts`)

Reemplazar el paso 3 (revertir status) por una eliminación en cascada de los cierres vinculados:

```text
1. Borrar invoice_services (igual)
2. Borrar invoice_closures (igual)
3. Para cada closureId vinculado:
     a. Borrar closure_services del cierre
     b. Borrar service_closures del cierre  ← NUEVO (antes solo update status)
4. Borrar la factura (igual)
5. Reset de servicios a 'with_purchase_order' (igual)
```

Orden seguro respecto a FKs: primero hijos (`*_services`, `invoice_closures`), luego padres (`service_closures`, `invoices`), luego servicios.

### Cambio en UI (`src/components/admin/ServiceLiberationTool.tsx`)

Actualizar la "Vista previa del impacto" cuando `result.type === 'invoice'` y haya cierres vinculados:

- Antes: `"{N} cierre(s) volverán a estado Cerrado"`
- Después: `"Se eliminará(n) {N} cierre(s) vinculado(s): CIE-XXX, CIE-YYY"`

Y en el diálogo de confirmación, agregar una línea explícita:
> "Esto también eliminará los cierres vinculados ({folios}). Los servicios quedarán libres para crear un nuevo cierre y factura."

El botón sigue siendo único: **"Liberar Factura"** (no requiere acción adicional sobre el cierre).

### Sin cambios

- `liberateClosure` (cuando se busca un CIE- directamente) sigue igual.
- Permisos/RLS: la operación ya corre como `admin`, no requiere migración.
- No se tocan triggers, ni `services`/`costs`/`invoices` schema.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cierre vinculado a **otra** factura además de la que se libera | Antes de eliminar cada cierre, verificar que ya no quedan filas en `invoice_closures` para ese `closure_id` (después del paso 2). Si quedan, **no** eliminar ese cierre y solo revertirlo a `closed` (comportamiento actual como fallback). Se reporta en el toast. |
| Servicios del cierre que no estén también en la factura | El paso 5 actualiza solo los `serviceIds` de la factura. Hay que unir `serviceIds` de la factura ∪ servicios de los cierres eliminados antes del update final, para que ningún servicio quede en estado `invoiced` huérfano. |
| Auditoría | Mantener el flujo actual de `setLiberating`/toast. No se requiere log adicional (la herramienta ya es de admin/emergencia). |

## Resumen para el usuario

Con un solo clic en **Liberar Factura** se elimina la factura **y** los cierres vinculados, los servicios vuelven a "Con OC" listos para rearmar el cierre y refacturar. Si un cierre estuviera compartido con otra factura, ese cierre se mantiene (solo se revierte a "Cerrado") y se avisa.
