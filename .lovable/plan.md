

# Plan: Clasificación de Costos por Historial

## Concepto
Crear un clasificador local que analice los costos **ya registrados** en la base de datos. Cuando el usuario escribe una descripción, el sistema busca descripciones similares en registros previos y sugiere la categoría/subcategoría que se usó más frecuentemente para esas descripciones parecidas.

**Ventajas vs el clasificador IA actual:**
- Instantáneo (sin llamadas a API externa)
- Sin costo (no consume tokens de OpenAI)
- Aprende del comportamiento real del usuario
- Funciona offline

## Flujo

```text
Usuario escribe: "combustible grúa 45"
         │
         ▼
   Hook busca en costos históricos
   descripciones que contengan palabras clave
         │
         ▼
   Encuentra 12 costos con "combustible" + "grúa"
   → 10 usaron categoría "Combustible" / subcategoría "Diesel"
   → 2 usaron categoría "Mantenimiento"
         │
         ▼
   Sugiere: "Combustible → Diesel" (confianza: 83%)
         │
         ▼
   Badge violeta: "Sugerencia: Combustible → Diesel" [Aplicar]
```

## Implementación

### 1. Nuevo hook `useHistoricalClassify`
- Reutiliza los datos de `useCosts()` (ya cacheados por React Query)
- Aplica debounce de 300ms (más rápido que el de IA porque es local)
- Tokeniza la descripción en palabras clave (mínimo 3 caracteres cada una)
- Busca costos históricos donde la descripción contenga al menos 1 palabra clave
- Agrupa por `category_id + subcategory` y calcula frecuencia relativa como confianza
- Si la combinación más frecuente tiene ≥60% de los matches, la sugiere
- Caché en memoria para evitar recálculos

### 2. Modificar `useAutoClassify`
- Integrar el resultado histórico como **primera línea de defensa**
- Si el historial encuentra un match con confianza ≥60%, usar esa sugerencia (instantánea)
- Si no hay match histórico suficiente, **entonces** llamar a la IA (comportamiento actual)
- El badge muestra un icono diferente para distinguir: historial (reloj) vs IA (sparkles)

### 3. Actualizar `AiCategorySuggestion`
- Agregar prop `source: 'history' | 'ai'` para mostrar icono correspondiente
- Historial: icono `History` + texto "Basado en registros previos"
- IA: icono `Sparkles` + texto "Sugerencia IA" (como está ahora)

## Archivos a crear/modificar
- **Crear**: `src/hooks/costs/useHistoricalClassify.ts` — lógica de matching por historial
- **Modificar**: `src/hooks/useAutoClassify.ts` — integrar historial como fallback prioritario
- **Modificar**: `src/components/costs/form/AiCategorySuggestion.tsx` — distinguir fuente visual
- **Modificar**: `src/components/costs/form/CostFormStep1.tsx` — pasar source al badge

## Sin riesgo funcional
- No modifica datos existentes
- El clasificador IA sigue funcionando como respaldo
- Si no hay historial suficiente, el comportamiento es idéntico al actual

