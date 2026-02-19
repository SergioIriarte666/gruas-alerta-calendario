
# Refinamiento del Importador de OC desde PDF

## Mejoras propuestas

### 1. Nuevo estado: "OC ya asignada" (misma OC)
Cuando un servicio ya tiene asignada **la misma OC** que se esta importando, mostrar un estado especial "Ya asignada" en color azul/gris, indicando que no necesita accion. Esto se diferencia del caso donde tiene **otra OC distinta**.

### 2. Estado "Ya tiene OC" mejorado (OC diferente)
Cuando el servicio ya tiene una OC **diferente**, mostrar cual es la OC actual y permitir seleccionar el checkbox para sobrescribirla si el usuario lo desea.

### 3. Columna "OC Actual" en la tabla
Agregar una columna que muestre la OC que ya tiene asignada el servicio (si la tiene), para que el usuario pueda comparar antes de decidir.

### 4. Mostrar mas informacion del servicio
En la columna "Servicio", ademas del folio, mostrar la fecha del servicio para facilitar la identificacion.

### 5. Resumen mejorado con 4 badges
- Coincidencias (verde) -- listos para asignar
- Ya asignada (azul) -- misma OC, no requiere accion
- OC diferente (amarillo) -- tiene otra OC, seleccionable para sobrescribir
- Sin match (rojo) -- no se encontro servicio

## Detalle tecnico

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

- Agregar nuevo estado `'same_oc'` al tipo `MatchedService.status`
- En la logica de matching, cuando el servicio ya tiene OC:
  - Si `service.purchaseOrder === oc.ocNumber` -> estado `'same_oc'`
  - Si tiene otra OC diferente -> estado `'already_has_oc'`
- Permitir que `applyMatches` tambien procese items con estado `'already_has_oc'` (sobrescribir)

### Archivo: `src/components/vip/PurchaseOrderPDFImporter.tsx`

- Agregar columna "OC Actual" que muestre `match.service?.purchaseOrder` cuando existe
- Agregar badge azul para estado `'same_oc'` con icono de check doble
- Habilitar checkbox para items `'already_has_oc'` (permitir sobrescribir)
- En columna "Servicio", mostrar folio + fecha: `SRV-1234 (15/02/2026)`
- Agregar badge de resumen para `'same_oc'`

### Flujo visual actualizado

```text
Patente   | Servicio              | OC Actual    | N OC Nueva   | Estado
VHZJ75    | SRV-1234 (15/02)      | 4701665314   | 4701665314   | Ya asignada (azul)
VLSV92    | SRV-1235 (16/02)      | —            | 4701665314   | Match (verde)
VLZF95    | SRV-1236 (14/02)      | 4701555000   | 4701665314   | OC diferente (amarillo)
ABCD12    | —                     | —            | 4701665314   | Sin match (rojo)
```

### Sin cambios en
- Edge function (ya funciona correctamente)
- Hook de servicios
