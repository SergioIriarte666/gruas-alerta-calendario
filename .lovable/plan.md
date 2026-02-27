

# Plan: Soporte para multiples patentes por item en Cotizaciones

## Problema
Cuando una linea de la cotizacion tiene multiples patentes separadas por "/" (ej: "Toyota Hilux TKFL-65/TKFL-67"), el sistema las trata como una sola patente y solo genera 1 match en vez de 2.

## Solucion (dos niveles de proteccion)

### 1. Edge Function: Mejorar prompt para separar items con multiples patentes
**Archivo:** `supabase/functions/parse-quote-pdf/index.ts`

Agregar al prompt del sistema:
- "Si un item tiene MULTIPLES patentes separadas por '/' o ',' (ej: TKFL-65/TKFL-67), genera UN ITEM SEPARADO por cada patente, con el mismo detalle y dividiendo el monto proporcionalmente por la cantidad."
- Esto hace que la IA devuelva items ya separados desde la extraccion.

### 2. Hook: Fallback para separar patentes multiples en el matching
**Archivo:** `src/hooks/vip/useQuotePDFImport.ts`

En el loop de matching (linea ~168), antes de normalizar la patente:
- Detectar si `item.patente` contiene "/" o ","
- Si es asi, dividir en multiples patentes y crear un match entry por cada una
- Dividir el monto proporcionalmente (amount / cantidad de patentes)
- Esto actua como red de seguridad si la IA no separa los items correctamente

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/parse-quote-pdf/index.ts` | Agregar instruccion al prompt para separar items con multiples patentes |
| `src/hooks/vip/useQuotePDFImport.ts` | Agregar logica de split de patentes multiples en el matching loop |

## Resultado esperado
- Un item con "TKFL-65/TKFL-67" genera 2 matches separados (uno por patente)
- El monto se divide proporcionalmente entre las patentes
- Los 4 servicios aparecen correctamente en la tabla de preview

