

# Plan: Previsualización Editable para Carga de XML

## Problema Identificado

El componente `XMLCostUpload.tsx` actualmente muestra una tabla de previsualización donde solo se puede editar la **categoría**, pero los demás campos son de solo lectura:

| Campo | Estado Actual | Necesidad |
|-------|--------------|-----------|
| Fecha | Solo lectura | Editable |
| Descripción | Solo lectura | Editable |
| Monto | Solo lectura | Editable |
| Proveedor | Solo lectura | Editable |
| Categoría | Editable (Select) | Ya funciona |
| Subcategoría | No existe | Agregar |

**Caso de uso real:** El usuario carga facturas XML de enero pero las está procesando en febrero. Necesita ajustar las fechas antes de importar para que los costos queden en el mes correcto.

---

## Solución Propuesta

### Vista General del Componente Mejorado

```text
┌─────────────────────────────────────────────────────────────────┐
│  Cargar Gastos desde XML                                    [X] │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📂 archivo_facturas.xml (45 KB)   [Analizar] [Limpiar]  │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ACCIONES MASIVAS                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Ajustar todas las fechas:                                │  │
│  │ [📅 27/01/2026]  [Aplicar a seleccionados]              │  │
│  │                                                          │  │
│  │ Ajustar todos los montos: [ +/- % ] [Aplicar]           │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Vista Previa (15 gastos)                      [✓] Seleccionar │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ [✓] │ 27/01  📅│ Combustible Copec    │ $45,000 │ ▼Cat. │  │
│  │ [✓] │ 27/01  📅│ Peaje Ruta 5         │ $12,000 │ ▼Cat. │  │
│  │ [✓] │ 28/01  📅│ Viáticos operador    │ $35,000 │ ▼Cat. │  │
│  └──────────────────────────────────────────────────────────┘  │
│  Cada fila es editable inline                                   │
├─────────────────────────────────────────────────────────────────┤
│  [Cancelar]                   [Cargar 15 Gastos Seleccionados] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cambios Técnicos Detallados

### 1. Agregar Estado para Datos Editados

Actualmente solo existe `categoryMappings`. Agregar estado para todos los campos editables:

```typescript
// Estado actual
const [categoryMappings, setCategoryMappings] = useState<{ [key: string]: string }>({});

// Estados nuevos
const [editedData, setEditedData] = useState<{ [key: string]: Partial<XMLCostData> }>({});
const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
const [bulkDate, setBulkDate] = useState<string>('');
const [bulkAmountAdjustment, setBulkAmountAdjustment] = useState<number>(0);
```

### 2. Crear Función para Obtener Valor Final

```typescript
const getEditedValue = <K extends keyof XMLCostData>(
  index: number, 
  field: K, 
  original: XMLCostData[K]
): XMLCostData[K] => {
  return (editedData[index]?.[field] ?? original) as XMLCostData[K];
};
```

### 3. Crear Funciones de Edición Individual

```typescript
const handleFieldChange = (
  index: number, 
  field: keyof XMLCostData, 
  value: any
) => {
  setEditedData(prev => ({
    ...prev,
    [index]: {
      ...prev[index],
      [field]: value
    }
  }));
};
```

### 4. Crear Funciones de Edición Masiva

```typescript
const handleBulkDateChange = () => {
  if (!bulkDate) return;
  
  const updates: typeof editedData = {};
  selectedRows.forEach(index => {
    updates[index] = {
      ...editedData[index],
      fecha: bulkDate
    };
  });
  
  setEditedData(prev => ({ ...prev, ...updates }));
  toast.success(`Fecha actualizada en ${selectedRows.size} registros`);
};

const handleBulkAmountAdjustment = () => {
  if (bulkAmountAdjustment === 0) return;
  
  const updates: typeof editedData = {};
  selectedRows.forEach(index => {
    const original = parseResult.data[index];
    const currentAmount = getEditedValue(index, 'monto', original.monto);
    const newAmount = currentAmount * (1 + bulkAmountAdjustment / 100);
    
    updates[index] = {
      ...editedData[index],
      monto: Math.round(newAmount)
    };
  });
  
  setEditedData(prev => ({ ...prev, ...updates }));
};
```

### 5. Actualizar Tabla con Campos Editables

Reemplazar la tabla de solo lectura con inputs editables:

```tsx
<TableBody>
  {parseResult.data.slice(0, 20).map((item, index) => {
    const isSelected = selectedRows.has(index);
    const editedFecha = getEditedValue(index, 'fecha', item.fecha);
    const editedMonto = getEditedValue(index, 'monto', item.monto);
    const editedDescripcion = getEditedValue(index, 'descripcion', item.descripcion);
    
    return (
      <TableRow key={index} className={isSelected ? 'bg-muted/50' : ''}>
        {/* Checkbox de selección */}
        <TableCell>
          <Checkbox 
            checked={isSelected}
            onCheckedChange={() => toggleRowSelection(index)}
          />
        </TableCell>
        
        {/* Fecha editable */}
        <TableCell>
          <DatePickerInput
            value={typeof editedFecha === 'string' ? editedFecha : format(editedFecha, 'yyyy-MM-dd')}
            onChange={(date) => handleFieldChange(index, 'fecha', date)}
            className="w-32"
          />
        </TableCell>
        
        {/* Descripción editable */}
        <TableCell>
          <Input
            value={editedDescripcion}
            onChange={(e) => handleFieldChange(index, 'descripcion', e.target.value)}
            className="min-w-[200px]"
          />
        </TableCell>
        
        {/* Monto editable */}
        <TableCell>
          <Input
            type="number"
            value={editedMonto}
            onChange={(e) => handleFieldChange(index, 'monto', parseFloat(e.target.value) || 0)}
            className="w-28"
          />
        </TableCell>
        
        {/* Categoría (ya existe) */}
        <TableCell>
          <Select ...>
        </TableCell>
      </TableRow>
    );
  })}
</TableBody>
```

### 6. Agregar Panel de Acciones Masivas

Nuevo componente antes de la tabla:

```tsx
{parseResult && parseResult.data.length > 0 && (
  <Card className="border-violet-200 bg-violet-50/50">
    <CardHeader className="py-3">
      <CardTitle className="text-sm flex items-center gap-2">
        <Wand2 className="w-4 h-4" />
        Acciones Masivas ({selectedRows.size} seleccionados)
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {/* Ajuste de fecha */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-32">Cambiar fecha:</span>
        <DatePickerInput
          value={bulkDate}
          onChange={setBulkDate}
          placeholder="Nueva fecha"
          className="w-40"
        />
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleBulkDateChange}
          disabled={!bulkDate || selectedRows.size === 0}
        >
          Aplicar
        </Button>
      </div>
      
      {/* Ajuste de monto */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-32">Ajustar montos:</span>
        <Input
          type="number"
          value={bulkAmountAdjustment}
          onChange={(e) => setBulkAmountAdjustment(parseFloat(e.target.value) || 0)}
          placeholder="+/- %"
          className="w-24"
        />
        <span className="text-xs text-muted-foreground">%</span>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleBulkAmountAdjustment}
          disabled={bulkAmountAdjustment === 0 || selectedRows.size === 0}
        >
          Aplicar
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

### 7. Actualizar Función de Upload

Modificar `handleUploadCosts` para usar los valores editados:

```typescript
const handleUploadCosts = async () => {
  // ...
  
  for (let i = 0; i < parseResult.data.length; i++) {
    if (!selectedRows.has(i)) continue; // Solo subir seleccionados
    
    const xmlCost = parseResult.data[i];
    const edited = editedData[i] || {};
    
    const finalDate = edited.fecha ?? xmlCost.fecha;
    const finalMonto = edited.monto ?? xmlCost.monto;
    const finalDescripcion = edited.descripcion ?? xmlCost.descripcion;
    
    const costData = {
      date: typeof finalDate === 'string' ? finalDate : finalDate.toISOString().split('T')[0],
      description: finalDescripcion,
      amount: finalMonto,
      category_id: categoryMappings[`${i}-categoria`] || getDefaultCategoryId(xmlCost.categoria),
      // ... resto igual
    };
    
    // ... subir
  }
};
```

---

## Archivos a Modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/costs/XMLCostUpload.tsx` | Agregar estados, UI editable, acciones masivas |
| 2 | `src/types/costs.ts` | Agregar tipo `EditedXMLCostData` (opcional) |

---

## Mejoras Adicionales Incluidas

1. **Checkbox de selección por fila** - Permite elegir qué registros importar
2. **"Seleccionar todos / Ninguno"** - Toggle rápido
3. **Indicador visual de cambios** - Badge cuando un campo fue modificado
4. **Contador dinámico** - "Cargar X de Y gastos seleccionados"
5. **Mostrar más registros** - Paginación o "Ver todos" en lugar de límite de 10

---

## Resultado Esperado

Después de la implementación:

1. El usuario carga un XML con 50 facturas de enero
2. Ve la previsualización con todos los datos
3. Selecciona las 50 filas con "Seleccionar todos"
4. Usa "Cambiar fecha" para poner todas en 27/01/2026
5. Opcionalmente ajusta montos individuales
6. Hace clic en "Cargar 50 Gastos"
7. Los costos se crean con las fechas y montos corregidos

