

# Plan: Mejorar UX de Vista Previa Editable en XMLCostUpload

## Problema Identificado

La sección "Vista Previa Editable" tiene los siguientes problemas de usabilidad:

| Problema | Impacto |
|----------|---------|
| Inputs horizontales muy apretados | Difícil ver el contenido completo |
| Descripción truncada | No se puede leer el texto completo |
| Selectores truncados | No se ve el proveedor/categoría completo |
| Sin etiquetas visibles en móvil | Confuso saber qué campo es cual |
| Falta de espacio visual | Todo se ve comprimido |

---

## Solución: Diseño en Tarjetas por Registro

Cambiar de una tabla horizontal a un layout de **tarjetas expandibles** donde cada registro tenga espacio para editar cómodamente:

```text
┌─────────────────────────────────────────────────────────────────┐
│ Vista Previa Editable                    [Deseleccionar todos] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [✓] Registro 1 de 15                                    $25K │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Descripción:                                                │ │
│ │ [MANGUERAS HIDRAULICAS E INCENDIO PARA GRUA___________   ] │ │
│ │                                                             │ │
│ │ Proveedor:                                                  │ │
│ │ [IMPORTADORA Y COMERCIAL JOMIAL LIMITADA              ▼ ] │ │
│ │                                                             │ │
│ │ ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐  │ │
│ │ │ Fecha Emisión    │ │ Categoría        │ │ Monto       │  │ │
│ │ │ [📅 03/02/2026]  │ │ [Administrativo▼]│ │ [$25,479  ] │  │ │
│ │ └──────────────────┘ └──────────────────┘ └─────────────┘  │ │
│ │                                                             │ │
│ │ ┌──────────────────┐                                       │ │
│ │ │ Fecha de Pago    │  ✓ Pago inmediato                     │ │
│ │ │ [📅 03/02/2026]  │                                       │ │
│ │ └──────────────────┘                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [✓] Registro 2 de 15                                   $12K │ │
│ │ ... (colapsado o expandido)                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cambios Técnicos

### 1. Crear Componente `XMLCostPreviewCard`

Nuevo componente dedicado para cada registro editable:

```typescript
interface XMLCostPreviewCardProps {
  item: XMLCostData;
  index: number;
  isSelected: boolean;
  onToggleSelection: () => void;
  editedValues: Partial<XMLCostData>;
  onFieldChange: (field: keyof XMLCostData, value: any) => void;
  categoryValue: string;
  onCategoryChange: (value: string) => void;
  categories: CostCategory[];
  paymentDate: string;
  onPaymentDateChange: (date: string) => void;
  isImmediate: boolean;
}
```

### 2. Diseño del Card

Cada card tendrá:

- **Header**: Checkbox + número de registro + monto (badge)
- **Cuerpo organizado en grid**:
  - Descripción (ancho completo, textarea para textos largos)
  - Proveedor (ancho completo)
  - Grid 3 columnas: Fecha Emisión | Categoría | Monto
  - Fecha de Pago + indicador de pago inmediato

### 3. Vista Compacta/Expandida

Opción para alternar entre:
- **Vista expandida**: Todos los campos visibles (para edición detallada)
- **Vista compacta**: Solo header con resumen (para navegar rápido)

```typescript
const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
const [viewMode, setViewMode] = useState<'expanded' | 'compact'>('expanded');
```

### 4. Mejoras Adicionales

- **Labels claros** sobre cada input
- **Inputs de ancho completo** para descripción y proveedor
- **Formato de moneda** visual en el input de monto
- **Indicador visual** de campos modificados (badge "editado")
- **Scroll virtual** para listas largas (opcional)

---

## Archivos a Modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/costs/XMLCostUpload.tsx` | Reemplazar tabla por layout de cards |
| 2 | `src/components/costs/XMLCostPreviewCard.tsx` | Crear nuevo componente (opcional, o inline) |

---

## Detalle de Implementación

### Reemplazar la Tabla (líneas 740-886) con:

```tsx
{/* Cards View */}
<div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
  {visibleData.map((item, idx) => {
    const actualIndex = parseResult.data.indexOf(item);
    const isSelected = selectedRows.has(actualIndex);
    const editedFecha = getEditedValue(actualIndex, 'fecha', item.fecha);
    const editedMonto = getEditedValue(actualIndex, 'monto', item.monto);
    const editedDescripcion = getEditedValue(actualIndex, 'descripcion', item.descripcion);
    const editedProveedor = getEditedValue(actualIndex, 'proveedor', item.proveedor);
    const emissionDateStr = formatDateForInput(editedFecha);
    const computedPaymentDate = paymentDateOverrides[actualIndex] || getPaymentDate(actualIndex, emissionDateStr);
    const isImmediate = computedPaymentDate === emissionDateStr;
    
    return (
      <Card 
        key={actualIndex} 
        className={cn(
          "border transition-all",
          isSelected 
            ? "border-violet-300 bg-violet-50/30" 
            : "border-gray-200 bg-white"
        )}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50/50">
          <div className="flex items-center gap-3">
            <Checkbox 
              checked={isSelected}
              onCheckedChange={() => toggleRowSelection(actualIndex)}
            />
            <span className="text-sm font-medium text-gray-600">
              Registro {actualIndex + 1} de {parseResult.data.length}
            </span>
            {(isFieldModified(actualIndex, 'fecha') || 
              isFieldModified(actualIndex, 'descripcion') || 
              isFieldModified(actualIndex, 'monto') ||
              isFieldModified(actualIndex, 'proveedor')) && (
              <Badge variant="secondary" className="bg-violet-100 text-violet-700 text-xs">
                Editado
              </Badge>
            )}
          </div>
          <Badge className="bg-green-100 text-green-800 font-semibold">
            ${Number(editedMonto).toLocaleString('es-CL')}
          </Badge>
        </div>
        
        {/* Card Body */}
        <div className="p-4 space-y-4">
          {/* Descripción - Ancho completo */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Descripción</Label>
            <Textarea
              value={String(editedDescripcion)}
              onChange={(e) => handleFieldChange(actualIndex, 'descripcion', e.target.value)}
              className="w-full resize-none"
              rows={2}
            />
          </div>
          
          {/* Proveedor - Ancho completo */}
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Proveedor</Label>
            <Input
              value={String(editedProveedor || '')}
              onChange={(e) => handleFieldChange(actualIndex, 'proveedor', e.target.value)}
              placeholder="Sin proveedor"
              className="w-full"
            />
          </div>
          
          {/* Grid: Fecha Emisión | Categoría | Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Fecha Emisión</Label>
              <DatePickerInput
                value={formatDateForInput(editedFecha)}
                onChange={(date) => handleFieldChange(actualIndex, 'fecha', date)}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Categoría</Label>
              <Select
                value={categoryMappings[`${actualIndex}-categoria`] || getDefaultCategoryId(item.categoria)}
                onValueChange={(value) => handleCategoryChange(actualIndex, value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5 block">Monto</Label>
              <Input
                type="number"
                value={editedMonto}
                onChange={(e) => handleFieldChange(actualIndex, 'monto', parseFloat(e.target.value) || 0)}
                className="w-full"
              />
            </div>
          </div>
          
          {/* Fecha de Pago */}
          <div className="flex items-end gap-4 pt-2 border-t">
            <div className="flex-1 max-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1.5 block">Fecha de Pago</Label>
              <DatePickerInput
                value={computedPaymentDate || ''}
                onChange={(date) => setPaymentDateOverrides(prev => ({...prev, [actualIndex]: date}))}
                className="w-full"
              />
            </div>
            {isImmediate && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm pb-2">
                <CheckCircle className="w-4 h-4" />
                <span>Pago inmediato</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  })}
</div>
```

---

## Resultado Esperado

Después de la implementación:

1. Cada registro se muestra en una **tarjeta clara y espaciada**
2. Los campos tienen **etiquetas visibles** 
3. La descripción tiene **espacio suficiente** (textarea)
4. El proveedor se muestra **completo**
5. Los campos numéricos están **bien formateados**
6. El indicador de "Pago inmediato" es **visible y claro**
7. Se mantiene la funcionalidad de **selección múltiple**
8. Compatible con **móvil** (grid responsive)

