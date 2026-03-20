

## Plan: Carga Masiva de Costos por Excel/CSV

### Contexto

Ya existe un sistema de carga masiva para **servicios** (`EnhancedCSVUploadServices.tsx`) con CSV/Excel, y un sistema de carga de costos por **XML** (`XMLCostUpload.tsx`). El objetivo es agregar una opción de carga masiva de costos desde **Excel/CSV**, siguiendo los mismos patrones.

### Flujo propuesto

```text
1. Usuario hace clic en "Cargar Excel" (nuevo botón en CostsHeader)
2. Se abre modal con zona de drag & drop para archivo CSV/Excel
3. Se parsea el archivo y se muestra previsualización
4. Se validan los datos (categorías, montos, fechas)
5. Se muestra resumen de validación (válidos, errores, advertencias)
6. Usuario confirma → se insertan los costos en lote
7. Progreso visual con barra animada
```

### Columnas del template Excel/CSV

| Columna | Requerida | Ejemplo |
|---------|-----------|---------|
| Fecha | Sí | 2026-03-20 |
| Descripción | Sí | Combustible grúa |
| Monto | Sí | 150000 |
| Categoría | Sí | Gastos Operacionales |
| Subcategoría | No | Combustible |
| Notas | No | Factura #123 |
| Pagado (Sí/No) | No | Sí |
| Fecha Pago | No | 2026-03-20 |

### Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `src/components/costs/CSVCostUpload.tsx` | Modal principal con drag & drop, previsualización, validación y carga |
| `src/hooks/useCostCSVUpload.ts` | Hook que maneja parseo, validación contra categorías existentes, e inserción en lote |
| `src/utils/costCsvTemplate.ts` | Generador de template CSV/Excel descargable |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/CostsHeader.tsx` | Agregar botón "Cargar Excel" junto al botón "Cargar XML" existente |
| `src/pages/Costs.tsx` (o donde se renderiza) | Agregar estado y modal `CSVCostUpload` |

### Validaciones incluidas

- Formato de fecha válido
- Monto numérico > 0
- Categoría existente en `cost_categories` (match por nombre)
- Detección de duplicados (misma fecha + monto + descripción)
- Filas vacías ignoradas

### Lógica de inserción

- Se usa `supabase.from('costs').insert()` en lotes de 50 registros
- Si "Pagado = Sí", se establece `payment_date`
- Se busca `category_id` por nombre de categoría
- Barra de progreso durante la inserción
- Resumen final: insertados, errores, advertencias

### UX

- Reutiliza componentes existentes: `BatchProgressModal`, zona drag & drop similar a servicios
- Template descargable en CSV y Excel
- Previsualización de datos antes de confirmar

