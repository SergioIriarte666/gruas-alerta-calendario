

## Plan: Sugerencia Automática de Datos del Vehículo al Ingresar Patente

### Objetivo
Integrar la consulta de patentes de GetAPI Chile en el formulario de nuevo servicio para sugerir automáticamente la marca y modelo del vehículo cuando el usuario ingresa una patente.

---

### Flujo Propuesto

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE SUGERENCIA DE VEHÍCULO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. Usuario ingresa patente (ej: "AB-CD-12")                              │
│                      │                                                      │
│                      ▼                                                      │
│   2. Después de 500ms sin escribir, se consulta la API                     │
│                      │                                                      │
│                      ▼                                                      │
│   3. API retorna: { marca: "Peugeot", modelo: "208", año: 2020 }           │
│                      │                                                      │
│                      ▼                                                      │
│   4. Se muestra diálogo de sugerencia:                                     │
│      ┌────────────────────────────────────────────────────────────┐        │
│      │  💡 Datos del Vehículo Encontrados                         │        │
│      │  ──────────────────────────────────────────────────────────│        │
│      │  Patente: AB-CD-12                                         │        │
│      │  Marca: Peugeot                                            │        │
│      │  Modelo: 208                                               │        │
│      │  Año: 2020                                                 │        │
│      │                                                            │        │
│      │  [Ignorar]                         [Aplicar Sugerencia]    │        │
│      └────────────────────────────────────────────────────────────┘        │
│                      │                                                      │
│                      ▼                                                      │
│   5. Si "Aplicar":                                                         │
│      a) Buscar marca en la BD                                              │
│      b) Si no existe → crearla automáticamente                             │
│      c) Buscar modelo para esa marca                                       │
│      d) Si no existe → crearlo automáticamente                             │
│      e) Asignar marca y modelo a los campos del formulario                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Cambios a Realizar

#### 1. Modificar `VehicleSection.tsx`

**a) Importar el hook de consulta de patentes:**
```typescript
import { usePatentLookup } from '@/hooks/usePatentLookup';
```

**b) Agregar estados para la sugerencia:**
```typescript
// Estados para sugerencia de patente
const [showSuggestionDialog, setShowSuggestionDialog] = useState(false);
const [suggestionApplied, setSuggestionApplied] = useState(false);
const appliedPlatesRef = useRef<Set<string>>(new Set());

// Hook de consulta de patentes
const { data: patentData, loading: patentLoading, lookupPatent, reset: resetPatent } = usePatentLookup();
```

**c) Consultar patente cuando cambia (debounced):**
```typescript
useEffect(() => {
  const timer = setTimeout(async () => {
    const cleanPlate = licensePlate.replace(/[-\s]/g, '').toUpperCase();
    if (
      cleanPlate.length >= 6 && 
      !appliedPlatesRef.current.has(cleanPlate) &&
      !vehicleBrand && // Solo sugerir si no hay marca seleccionada
      !isEditing
    ) {
      await lookupPatent(cleanPlate);
    }
  }, 800);
  return () => clearTimeout(timer);
}, [licensePlate, vehicleBrand, isEditing]);
```

**d) Mostrar diálogo cuando llega data:**
```typescript
useEffect(() => {
  if (patentData && !suggestionApplied && !appliedPlatesRef.current.has(debouncedPlate)) {
    setShowSuggestionDialog(true);
  }
}, [patentData, suggestionApplied, debouncedPlate]);
```

**e) Función para aplicar sugerencia:**
```typescript
const handleApplySuggestion = async () => {
  if (!patentData) return;
  
  setIsApplyingSuggestion(true);
  try {
    // 1. Buscar o crear la marca
    let brandId = brands.find(
      b => b.name.toLowerCase() === patentData.marca.toLowerCase()
    )?.id;
    
    if (!brandId && patentData.marca !== 'No disponible') {
      const newBrand = await createBrandAsync({ name: patentData.marca });
      brandId = newBrand.id;
    }
    
    if (brandId) {
      setSelectedBrandId(brandId);
      onVehicleBrandChange(patentData.marca);
      
      // 2. Esperar a que carguen los modelos, luego buscar o crear
      // (Usamos un efecto separado para esto)
      setPendingModel(patentData.modelo);
    }
    
    appliedPlatesRef.current.add(debouncedPlate);
    setSuggestionApplied(true);
    setShowSuggestionDialog(false);
    toast.success('Datos del vehículo aplicados');
  } catch (error) {
    console.error('Error applying suggestion:', error);
    toast.error('Error al aplicar sugerencia');
  } finally {
    setIsApplyingSuggestion(false);
  }
};
```

**f) Nuevo diálogo de sugerencia (estilo similar al historial):**
```tsx
<Dialog open={showSuggestionDialog} onOpenChange={setShowSuggestionDialog}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2 text-blue-600">
        <Lightbulb className="h-5 w-5" />
        Datos del Vehículo Encontrados
      </DialogTitle>
      <DialogDescription>
        Encontramos información para la patente <span className="font-semibold">{licensePlate}</span>
      </DialogDescription>
    </DialogHeader>
    
    <div className="bg-blue-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Marca:</span>
          <p className="font-medium">{patentData?.marca}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Modelo:</span>
          <p className="font-medium">{patentData?.modelo}</p>
        </div>
        {patentData?.año && (
          <div>
            <span className="text-muted-foreground">Año:</span>
            <p className="font-medium">{patentData.año}</p>
          </div>
        )}
        {patentData?.color && (
          <div>
            <span className="text-muted-foreground">Color:</span>
            <p className="font-medium">{patentData.color}</p>
          </div>
        )}
      </div>
    </div>
    
    <p className="text-sm text-muted-foreground">
      ¿Desea aplicar esta información al formulario?
    </p>
    
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="outline" onClick={handleIgnoreSuggestion}>
        Ignorar
      </Button>
      <Button 
        type="button" 
        onClick={handleApplySuggestion}
        disabled={isApplyingSuggestion}
      >
        {isApplyingSuggestion ? 'Aplicando...' : 'Aplicar Sugerencia'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

#### 2. Indicador Visual de Carga

Mostrar un indicador junto al input de patente mientras se consulta:

```tsx
<div className="relative">
  <Input
    id="licensePlate"
    value={licensePlate}
    onChange={(e) => onLicensePlateChange(e.target.value.toUpperCase())}
    placeholder="Ej: AB-CD-12"
    className={cn(
      licensePlateError ? 'border-destructive' : '',
      patentLoading ? 'pr-10' : ''
    )}
  />
  {patentLoading && (
    <div className="absolute right-3 top-1/2 -translate-y-1/2">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )}
</div>
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/services/form/VehicleSection.tsx` | Integrar `usePatentLookup`, agregar diálogo de sugerencia, auto-crear marca/modelo |

---

### Comportamiento Esperado

1. Usuario ingresa patente "AB-CD-12"
2. Después de 800ms, sistema consulta GetAPI Chile
3. Si encuentra datos (Peugeot 208), muestra diálogo de sugerencia
4. Usuario hace clic en "Aplicar Sugerencia"
5. Sistema busca "Peugeot" en marcas existentes:
   - Si existe → la selecciona
   - Si no existe → la crea automáticamente
6. Sistema busca "208" en modelos de Peugeot:
   - Si existe → lo selecciona
   - Si no existe → lo crea automáticamente
7. Campos de marca y modelo quedan pre-llenados
8. Usuario puede modificar si lo desea

---

### Casos Especiales

| Caso | Comportamiento |
|------|----------------|
| Patente no encontrada | No mostrar diálogo, consulta silenciosa |
| Error de API | Log en consola, no interrumpir flujo |
| Usuario ya seleccionó marca | No mostrar sugerencia |
| Modo edición | No consultar API |
| Marca/modelo ya aplicados | No volver a sugerir para misma patente |

