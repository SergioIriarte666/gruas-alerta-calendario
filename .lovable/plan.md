
# Corregir matching de patentes y OC en el importador PDF

## Problema

Dos diferencias de formato impiden el match:

1. **Patentes**: La base de datos almacena con guion (`VJYG-13`) pero el PDF extrae sin guion (`VJYG13`). La comparacion directa falla.
2. **Numero de OC**: La base de datos almacena con prefijo `OC-` (`OC-4701665309`) pero el PDF extrae solo el numero (`4701665309`). La comparacion de "misma OC" tambien falla.

## Solucion

Normalizar ambos valores antes de comparar, eliminando guiones y el prefijo `OC-`.

## Detalle tecnico

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

1. Agregar funcion de normalizacion de patentes que elimine guiones y espacios:
   ```
   normalizePatente("VJYG-13") -> "VJYG13"
   normalizePatente("VJYG13")  -> "VJYG13"
   ```

2. Agregar funcion de normalizacion de OC que elimine el prefijo `OC-`:
   ```
   normalizeOC("OC-4701665309") -> "4701665309"
   normalizeOC("4701665309")    -> "4701665309"
   ```

3. En la logica de matching (linea ~97), cambiar la comparacion de patentes:
   - Antes: `s.licensePlate?.toUpperCase() === patente`
   - Despues: `normalizePatente(s.licensePlate) === normalizePatente(patente)`

4. En la deteccion de "misma OC" (linea ~115), cambiar la comparacion:
   - Antes: `topService.purchaseOrder === oc.ocNumber`
   - Despues: `normalizeOC(topService.purchaseOrder) === normalizeOC(oc.ocNumber)`

### Sin cambios en
- Edge function (extrae correctamente los datos)
- Componente UI (ya soporta todos los estados)
