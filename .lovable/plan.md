

# Fix: Soporte de VIN en importador de OC (y Cotizaciones)

## Problema
La OC contiene identificadores VIN de 17 caracteres (ej: `LZWADAGA9SF003022`) en la columna "Detalle", no patentes chilenas. El prompt de la IA solo busca patrones de patente chilena (XXXX-99, XX-9999), asi que los VINs no se extraen. Los items quedan sin patente y caen al fallback por monto ($30.000), matcheando servicios incorrectos.

## Solucion

### 1. Edge Function - Reconocer VINs como identificadores de vehiculo

**Archivo: `supabase/functions/parse-purchase-order-pdf/index.ts`**

Agregar al prompt del sistema instrucciones para reconocer VINs:
- VIN = exactamente 17 caracteres alfanumericos (ej: `LZWADAGA9SF003022`, `LZWADAGA1TB047976`)
- Si un item no tiene patente chilena pero tiene un VIN en la descripcion, extraerlo como `patente`
- Los VINs suelen aparecer junto a marcas/modelos: "Sail LZWADAGA9SF003022", "Groove LZWADAGA0TB047712"

Texto a agregar al prompt:
```
- VEHICULOS SIN PATENTE PERO CON VIN: Algunos vehiculos se identifican por su numero VIN 
  (Vehicle Identification Number) de exactamente 17 caracteres alfanumericos en lugar de patente.
  Ejemplo: "Sail LZWADAGA9SF003022" -> patente = "LZWADAGA9SF003022"
  Si no hay patente chilena pero hay un codigo de 17 caracteres alfanumericos, usalo como patente.
```

### 2. Edge Function Cotizaciones - Mismo cambio

**Archivo: `supabase/functions/parse-quote-pdf/index.ts`**

Agregar la misma instruccion de reconocimiento de VIN al prompt para mantener consistencia entre ambos importadores.

### 3. Matching en hook OC - Comparar VINs contra licensePlate de servicios

**Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`**

La logica actual de matching por patente ya funciona para VINs porque `normalizePatente` solo hace uppercase y quita guiones/espacios. Los servicios almacenan VINs en el campo `licensePlate`. No se necesitan cambios en la logica de matching del hook, solo asegurar que el VIN llegue desde la edge function.

### 4. Matching en hook Cotizaciones - Mismo soporte

**Archivo: `src/hooks/vip/useQuotePDFImport.ts`**

Verificar que la logica de matching tambien funcione con VINs (ya deberia por la misma razon).

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/parse-purchase-order-pdf/index.ts` | Agregar reconocimiento de VIN al prompt |
| `supabase/functions/parse-quote-pdf/index.ts` | Agregar reconocimiento de VIN al prompt |

## Resultado esperado
- La IA extrae `LZWADAGA9SF003022` como patente del item "Sail LZWADAGA9SF003022"
- El matching compara contra `licensePlate` de los servicios y encuentra el servicio correcto
- La columna "Patente" en el preview muestra el VIN
- Funciona tanto en importador de OC como de Cotizaciones
