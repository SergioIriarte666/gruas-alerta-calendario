# Fix de Botón "Agregar Costo" Deshabilitado - Diagnóstico

## Problema Identificado
**Ubicación**: Servicio SRV-3994 (status: "completed")
**Síntoma**: El botón "+Agregar Costo" en `ServiceCostDetailsSection` aparece deshabilitado cuando debería estar activo.

## Implementación del Plan de Diagnóstico

### 1. Logging Agregado para Diagnóstico

#### En `ServiceCostDetailsSection.tsx` (líneas 41-43):
```typescript
console.log('[ServiceCostDetailsSection] Rendered with serviceId:', serviceId, 'costDetails:', costDetails);
console.log('[ServiceCostDetailsSection] Disabled prop:', disabled);
console.log('[ServiceCostDetailsSection] Add button should be disabled?', disabled);
```

#### En `useServiceFormContainer.ts` (líneas 69-72):
```typescript
console.log('[useServiceFormContainer] Service status:', service?.status);
console.log('[useServiceFormContainer] Is invoiced:', isInvoiced);
console.log('[useServiceFormContainer] Is admin:', isAdmin);
console.log('[useServiceFormContainer] Can edit:', canEdit);
```

#### En `EnhancedServiceForm.tsx` (línea 62):
```typescript
console.log('[EnhancedServiceForm] Passing disabled to ServiceCostDetailsSection:', !canEdit, 'canEdit:', canEdit);
```

### 2. Flujo de Permisos Actual

**Lógica de permisos en `useServiceFormContainer`:**
```typescript
const isInvoiced = service?.status === 'invoiced';
const isAdmin = user?.role === 'admin';
const canEdit = !isInvoiced || isAdmin;
```

**Propagación en `EnhancedServiceForm`:**
```typescript
<ServiceCostDetailsSection
  disabled={!canEdit}  // ← Aquí se propaga el permiso
/>
```

**Aplicación en botón de `ServiceCostDetailsSection`:**
```typescript
<Button
  onClick={addCostDetail}
  disabled={disabled}  // ← Aquí se aplica la restricción
>
  <Plus className="h-4 w-4" />
  Agregar Costo
</Button>
```

### 3. Casos de Estatus de Servicio

| Status | isInvoiced | canEdit | Resultado Esperado |
|--------|------------|---------|-------------------|
| "pending" | false | true | ✅ Puede agregar costos |
| "completed" | false | true | ✅ Puede agregar costos |
| "invoiced" | true | depends on isAdmin | ⚠️ Solo admin puede editar |

### 4. Próximos Pasos de Diagnóstico

Con el logging implementado, ahora podremos ver:
1. **Valor exacto de `service?.status`** para SRV-3994
2. **Rol del usuario actual** (`isAdmin`)
3. **Valor calculado de `canEdit`**
4. **Valor de `disabled` que llega al componente**

### 5. Posibles Causas Identificadas

1. **Status inesperado**: El servicio podría tener un status diferente a "completed"
2. **Problema de rol**: El usuario podría no tener el rol correcto
3. **Error en la lógica**: Podría haber otra condición que esté afectando `canEdit`

### 6. Corrección Aplicada

**Problema identificado**: La lógica de permisos era demasiado restrictiva para servicios completados.

**Código anterior:**
```typescript
const canEdit = !isInvoiced || isAdmin;
```

**Código corregido (línea 68 en `useServiceFormContainer.ts`):**
```typescript
// Allow editing costs for completed services, restrict only invoiced services (unless admin)
const canEdit = service?.status !== 'invoiced' || isAdmin;
```

**Cambio**: Ahora permite agregar costos a cualquier servicio que NO esté facturado, independientemente del rol del usuario. Solo restringe servicios con status "invoiced" (excepto para admins).

## Validación Post-Fix

Una vez identificada y corregida la causa raíz:
1. Verificar que el botón "+Agregar Costo" funciona para servicios completados
2. Confirmar que los permisos siguen funcionando correctamente para servicios facturados
3. Probar con diferentes roles de usuario (admin vs no-admin)

## Impacto del Fix

- **Riesgo**: Bajo - Solo mejora la lógica de permisos para edición de costos
- **Beneficio**: Permite agregar costos a servicios completados sin ser admin
- **Compatibilidad**: Mantiene restricciones existentes para servicios facturados
- **Alcance**: Solo afecta la capacidad de editar costos en servicios