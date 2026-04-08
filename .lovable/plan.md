

# Plan: Clasificación Automática de Costos con IA

## Qué es
Cuando el usuario escribe la **descripción** de un costo (en el formulario principal, el QuickCostForm, o la carga masiva), el sistema sugiere automáticamente la **categoría** y **subcategoría** más probable usando IA, basándose en el texto ingresado y el catálogo real de categorías/subcategorías de la base de datos.

## Cómo funciona

```text
Usuario escribe descripción
        ↓
  Debounce 800ms
        ↓
  Edge Function "classify-cost"
  (recibe descripción + lista de categorías/subcategorías)
        ↓
  OpenAI gpt-4o-mini responde con category_id + subcategory
        ↓
  UI muestra sugerencia como chip/badge clickeable
  "¿Sugerir: Combustible > Diesel?"
        ↓
  Usuario acepta (1 click) o ignora
```

## Cambios

### 1. Nueva Edge Function `classify-cost`
- Recibe: `{ description: string, categories: { id, name, subcategories: string[] }[] }`
- Prompt del sistema: "Dado este catálogo de categorías, clasifica la descripción del gasto. Responde SOLO con el JSON `{ category_id, subcategory }` o `null` si no hay confianza suficiente."
- Usa `gpt-4o-mini` (mismo patrón que `parse-receipt-image`)
- Responde en <1s típicamente

### 2. Hook `useAutoClassify`
- Acepta la descripción como input
- Debounce de 800ms para no disparar en cada tecla
- Solo dispara si la descripción tiene ≥5 caracteres
- Retorna `{ suggestedCategoryId, suggestedSubcategory, isClassifying, confidence }`
- Cache por descripción para no repetir llamadas

### 3. UI — Badge de sugerencia en los formularios
- En `CostForm` (Step 1, debajo del campo descripción) y `QuickCostForm`
- Muestra un badge tipo: `💡 Sugerencia: Combustible → Diesel` con botón "Aplicar"
- Al hacer click, setea `category_id` y `subcategory` en el form
- Si el usuario ya seleccionó categoría manualmente, no se muestra
- Estilo consistente con los badges existentes del módulo de costos

### 4. Integración con carga masiva (XMLCostUpload / Excel)
- En la previsualización, para líneas sin categoría asignada, ejecutar clasificación en batch
- Mostrar la sugerencia en la columna de categoría con opción de aceptar/rechazar

### 5. Integración con `parse-receipt-image` (ya existente)
- Extender el prompt del receipt parser para que también devuelva `suggestedCategory` basándose en el nombre del vendor y los ítems
- Cuando el receipt parser devuelve datos, también pre-llenar la categoría

## Archivos a crear/modificar
- **Nuevo**: `supabase/functions/classify-cost/index.ts`
- **Nuevo**: `src/hooks/useAutoClassify.ts`
- **Modificar**: `src/components/costs/form/CostFormStep1.tsx` — agregar badge de sugerencia
- **Modificar**: `src/components/costs/QuickCostForm.tsx` — agregar badge de sugerencia
- **Opcional fase 2**: `src/components/costs/XMLCostUpload.tsx` — clasificación batch

## Consideraciones
- La clasificación es **sugerencia**, nunca forzada — el usuario siempre tiene control
- Se usa el catálogo real de categorías del usuario (no hardcodeado)
- Costo por llamada: ~0.001 USD (gpt-4o-mini con ~200 tokens)
- Si no hay API key configurada, la feature simplemente no aparece

