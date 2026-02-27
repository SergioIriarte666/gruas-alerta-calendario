

# Fix: VIN truncado y prioridad de matching en importador OC

## Problema 1 - VINs truncados
El PDF contiene items como `Colorado9BG148K0TC427662` donde el VIN real es `9BG148K0TC427662` (empieza con "9BG" - VIN brasileno de Chevrolet). La IA confunde el "9" como parte del nombre del modelo ("Colorado9") y extrae `BG148K0TC427662` (15-16 chars), que no coincide con el servicio almacenado.

Casos afectados en el PDF:
- `Colorado9BG148K0TC427662` -> AI extrajo `BG148K0TC427662` (incorrecto, deberia ser `9BG148K0TC427662`)
- `Colorado9BG148PK0SC413076` -> AI extrajo `BG148PK0SC413076` (incorrecto, deberia ser `9BG148PK0SC413076`)

## Problema 2 - Sin prioridad de matching
El importador de OC procesa items en orden secuencial. Si un item sin patente aparece antes que uno con patente, puede "consumir" servicios incorrectamente via fallback por monto (mismo bug ya corregido en el importador de cotizaciones).

## Solucion

### 1. Mejorar prompt de la Edge Function OC

**Archivo: `supabase/functions/parse-purchase-order-pdf/index.ts`**

Reemplazar la instruccion actual de VIN con una mas detallada que cubra el caso de VINs pegados al nombre del modelo:

```
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN 
  (Vehicle Identification Number) de 16-17 caracteres alfanumericos.
  CRITICO: El VIN frecuentemente aparece PEGADO al nombre del modelo sin espacio. 
  Los VINs brasileños empiezan con "9B" (ej: 9BG, 9BD). 
  Ejemplo: "Colorado9BG148K0TC427662" -> modelo="Colorado", patente="9BG148K0TC427662"
  Ejemplo: "Sail LZWADAGA9SF003022" -> patente="LZWADAGA9SF003022"
  Ejemplo: "GrooveLZWADAGA3TN041614" -> patente="LZWADAGA3TN041614"
  NUNCA incluyas letras del nombre del modelo como parte del VIN.
  Si no hay patente chilena pero hay un codigo largo alfanumerico (16-17 chars), usalo como patente.
```

### 2. Mejorar prompt de la Edge Function Cotizaciones (consistencia)

**Archivo: `supabase/functions/parse-quote-pdf/index.ts`**

Aplicar la misma mejora al prompt de cotizaciones para mantener consistencia.

### 3. Agregar prioridad de matching al importador OC

**Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`**

Aplicar el mismo patron de prioridad que ya tiene el importador de cotizaciones:
1. Recolectar todos los items de todas las OCs en una lista plana
2. Ordenar: items CON patente/VIN primero, items SIN patente despues
3. Ejecutar el loop de matching sobre la lista ordenada

Cambio en lineas ~204-358: reestructurar el loop de matching para usar la lista ordenada en lugar del loop anidado `for oc / for item`.

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/parse-purchase-order-pdf/index.ts` | Mejorar instrucciones VIN en prompt (especialmente VINs brasileños pegados al modelo) |
| `supabase/functions/parse-quote-pdf/index.ts` | Misma mejora de VIN para consistencia |
| `src/hooks/vip/usePurchaseOrderPDFImport.ts` | Agregar prioridad de matching (patente primero, fallback despues) |

## Resultado esperado
- `Colorado9BG148K0TC427662` se extrae correctamente como patente `9BG148K0TC427662`
- `Colorado9BG148PK0SC413076` se extrae como `9BG148PK0SC413076`
- Ambos matchean con los servicios correctos en el sistema
- Items con patente/VIN se procesan antes que items sin identificador
