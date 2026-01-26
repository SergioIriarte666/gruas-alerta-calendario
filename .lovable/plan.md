
## Plan: Agregar Creación Rápida de Subcategorías en Actualización por Lotes

### Problema Identificado
El modal de "Actualización por Lotes" solo muestra un dropdown con subcategorías existentes. No hay forma de crear una nueva subcategoría desde este modal, a diferencia del patrón implementado para proveedores (`QuickSupplierModal`).

### Solución
Agregar la funcionalidad de crear subcategorías rápidamente directamente en el modal, usando el mismo patrón visual del `CostSubcategoryManager` (campo de texto + botón "Agregar").

---

### Cambios a Realizar

#### 1. Crear componente `QuickSubcategoryCreate.tsx`
Crear un componente inline simple para agregar subcategorías:
- Un campo de texto para el nombre
- Un botón con icono Plus para crear
- Usar el hook `useCostSubcategories` existente
- Seleccionar automáticamente la nueva subcategoría después de crearla

```text
┌───────────────────────────────────────────────┐
│  Subcategoría                         [ON]    │
│  ┌─────────────────────────────────────────┐  │
│  │ Seleccionar subcategoría           ▼   │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ➕ Nueva subcategoría:                       │
│  ┌─────────────────────────┐  ┌──────────┐   │
│  │ Nombre...               │  │ Agregar  │   │
│  └─────────────────────────┘  └──────────┘   │
└───────────────────────────────────────────────┘
```

#### 2. Modificar `CostBatchUpdateModal.tsx`
- Agregar estado para el nombre de nueva subcategoría
- Agregar función `handleCreateSubcategory`
- Integrar el input de creación rápida debajo del Select de subcategorías
- Auto-seleccionar la nueva subcategoría al crearla

---

### Sección Técnica

#### Nuevos estados en CostBatchUpdateModal:
```typescript
const [newSubcategoryName, setNewSubcategoryName] = useState('');
```

#### Modificar uso del hook:
```typescript
const { 
  subcategories: availableSubcategories = [],
  createSubcategory,
  isCreating: isCreatingSubcategory 
} = useCostSubcategories(
  enableCategory && categoryId ? categoryId : undefined
);
```

#### Nueva función de creación:
```typescript
const handleCreateSubcategory = () => {
  if (!newSubcategoryName.trim() || !categoryId) return;
  
  const maxOrder = availableSubcategories.reduce(
    (max, sub) => Math.max(max, sub.display_order), 0
  );
  
  createSubcategory({
    category_id: categoryId,
    name: newSubcategoryName.trim(),
    display_order: maxOrder + 1,
  }, {
    onSuccess: (data) => {
      setSubcategory(data.name);
      setNewSubcategoryName('');
    }
  });
};
```

#### Nuevo JSX después del Select de subcategorías:
```tsx
{enableSubcategory && enableCategory && categoryId && (
  <div className="flex gap-2 mt-2">
    <Input
      placeholder="Nueva subcategoría..."
      value={newSubcategoryName}
      onChange={(e) => setNewSubcategoryName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCreateSubcategory();
        }
      }}
      disabled={isCreatingSubcategory}
      className="flex-1"
    />
    <Button
      type="button"
      size="sm"
      onClick={handleCreateSubcategory}
      disabled={isCreatingSubcategory || !newSubcategoryName.trim()}
    >
      <Plus className="h-4 w-4 mr-1" />
      Agregar
    </Button>
  </div>
)}
```

---

### Archivos a Modificar
1. `src/components/costs/CostBatchUpdateModal.tsx` - Agregar creación rápida de subcategorías

### Resultado Esperado
- El usuario podrá crear subcategorías directamente desde el modal de Actualización por Lotes
- La nueva subcategoría quedará guardada en `cost_subcategories` y disponible para uso futuro
- Después de crear, la nueva subcategoría se selecciona automáticamente
- El patrón es consistente con la creación rápida de proveedores
