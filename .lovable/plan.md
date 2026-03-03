

## Problema confirmado

Las fotos prueban que los dos vehículos son distintos con VINs reales:
- `LZWCDAGA5TC811556`
- `LZWCDAGA7TC811557`

Ambos están registrados en la base de datos. Sin embargo, la IA que lee el PDF extrajo el segundo VIN como `LZWCDAGA**7**TC811557` cuando en la BD está como `LZWCDAGA**5**TC811557` — es decir, la IA confundió el dígito 5 con 7 al leer el PDF. Esto es un error de OCR/lectura, no un problema de vehículos diferentes.

El matching actual es estrictamente exacto, por lo que ese 1 carácter de diferencia genera "Sin match".

## Solución: Matching fuzzy para VINs (dos capas)

### Capa 1 — Mejorar el prompt de la IA (backend)
En `supabase/functions/parse-purchase-order-pdf/index.ts`, agregar instrucción al prompt para que la IA sea más cuidadosa con dígitos similares (5/6, 7/1, 0/O, etc.) y que intente verificar consistencia interna del VIN.

### Capa 2 — Fuzzy matching en frontend (tolerancia a errores de OCR)
En `src/hooks/vip/usePurchaseOrderPDFImport.ts` y `src/hooks/vip/useQuotePDFImport.ts`:

1. Agregar función Levenshtein (~15 líneas).
2. Cuando `matchingServices.length === 0` y el identificador tiene ≥16 caracteres (VIN):
   - Buscar en `clientServices` el candidato con menor distancia de edición (≤2).
   - Si hay exactamente 1 candidato claro, usarlo como match.
   - Si hay ambigüedad o distancia >2, mantener "Sin match".

```text
Flujo:
  VIN del PDF → normalizar → match exacto → ✅ usar
                                           → ❌ sin match
    → si VIN ≥ 16 chars → buscar fuzzy (Levenshtein ≤ 2)
      → 1 candidato → match
      → 0 o ambiguo → "Sin match"
```

### Archivos a modificar
- `supabase/functions/parse-purchase-order-pdf/index.ts` — Agregar instrucción de cuidado con dígitos similares en VINs al system prompt.
- `src/hooks/vip/usePurchaseOrderPDFImport.ts` — Agregar función Levenshtein y segunda pasada fuzzy tras fallo de match exacto.
- `src/hooks/vip/useQuotePDFImport.ts` — Misma mejora para consistencia.

