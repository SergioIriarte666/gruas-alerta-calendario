
# Corregir ordenamiento de sub-grupos en Pipeline VIP

## Problema
Al hacer clic en los encabezados de columna (Fecha, Valor, Folio, etc.), solo se reordenan los servicios **dentro** de cada sub-grupo (cotizacion, OC, factura). Los sub-grupos mismos siempre se ordenan alfabeticamente por su numero, ignorando el campo de ordenamiento seleccionado por el usuario.

## Solucion

### Archivo: `src/components/vip/PipelineListView.tsx`

Modificar la funcion `groupByField` para que reciba el campo y direccion de ordenamiento actuales, y ordene los sub-grupos segun ese criterio:

1. **Cambiar la firma de `groupByField`** (linea 89): agregar parametros `sortField` y `sortDirection`
2. **Cambiar la logica de ordenamiento de sub-grupos** (lineas 97-101): en lugar de `poNumber.localeCompare`, ordenar los sub-grupos segun el campo activo:
   - `serviceDate`: por la fecha mas reciente/antigua del sub-grupo
   - `value`: por el valor total del sub-grupo
   - `folio`: por el primer folio del sub-grupo
   - `daysInStatus`: por el promedio de dias del sub-grupo
   - Default (incluyendo `quoteNumber`, `purchaseOrder`, `invoiceNumeroFiscal`): mantener el orden alfabetico actual por numero
3. **Actualizar la llamada a `groupByField`** (linea 691): pasar `sortField` y `sortDirection` como argumentos

### Detalle tecnico

```text
groupByField(services, config)  -->  groupByField(services, config, sortField, sortDirection)
```

Logica de ordenamiento de sub-grupos:
- Los sub-grupos "Sin X" (vacios) siempre van al final
- Para `serviceDate`: se toma la fecha max/min de cada sub-grupo segun direccion
- Para `value`: se usa `totalValue` del sub-grupo
- Para `folio`/`serviceType`: se usa el valor del primer servicio (ya ordenado)
- Para `daysInStatus`: se calcula el promedio de dias del sub-grupo

Un solo archivo, una funcion modificada.
