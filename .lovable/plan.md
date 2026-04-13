

# Plan: Aplicar formateo automático de RUT en todos los formularios

## Archivos a modificar (6 archivos, 1 línea cada uno)

### 1. `src/components/suppliers/form/SupplierFormStep1.tsx` (línea 54)
```typescript
onChange={(e) => onRutChange(formatRut(e.target.value))}
```

### 2. `src/components/suppliers/QuickSupplierModal.tsx` (línea 96)
```typescript
onChange={(e) => setRut(formatRut(e.target.value))}
```

### 3. `src/components/operators/OperatorForm.tsx` (línea 152)
```typescript
onChange={(e) => handleChange('rut', formatRut(e.target.value))}
```

### 4. `src/components/settings/CompanySettingsTab.tsx` (línea 341)
```typescript
onChange={(e) => setProfileForm(prev => ({ ...prev, rut: formatRut(e.target.value) }))}
```

### 5. `src/components/cranes/CraneForm.tsx` (línea 118)
```typescript
onChange={(e) => handleChange('ownerCompanyRut', formatRut(e.target.value))}
```

### 6. `src/components/finance/historical/PurchaseHistoryImport.tsx` (línea 1480)
```typescript
onChange={e => setNewSupplierData({...newSupplierData, rut: formatRut(e.target.value)})}
```

Cada archivo solo necesita agregar `import { formatRut } from '@/utils/rutFormatter';` y envolver el valor en `formatRut()`. No se requieren cambios en backend ya que todas las funciones ya limpian el RUT antes de usarlo.

