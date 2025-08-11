# Corrección de Validación de Campos de Vehículo

## Problema Identificado

La validación de campos de vehículo no respetaba las configuraciones individuales de cada campo (`vehicleBrandRequired`, `vehicleModelRequired`, `licensePlateRequired`). El sistema solo consideraba el flag general `vehicleInfoOptional`, causando que todos los campos fueran obligatorios cuando debían ser opcionales individualmente.

## Solución Implementada

### 1. Modificación de Validación (`useServiceFormValidation.ts`)

**Antes:**
```typescript
// Validación solo cuando NO es opcional en general
if (!selectedServiceType.vehicleInfoOptional) {
  if (selectedServiceType.vehicleBrandRequired && !formData.vehicleBrand?.trim()) {
    // Validación
  }
  // ...otros campos
}
```

**Después:**
```typescript
// Validación individual de cada campo según su configuración específica
if (selectedServiceType.vehicleBrandRequired && !formData.vehicleBrand?.trim()) {
  toast({
    type: "error",
    title: "Error", 
    description: "La marca del vehículo es requerida para este tipo de servicio",
  });
  return { isValid: false };
}

if (selectedServiceType.vehicleModelRequired && !formData.vehicleModel?.trim()) {
  // Validación individual del modelo
}

if (selectedServiceType.licensePlateRequired && !formData.licensePlate?.trim()) {
  // Validación individual de la patente
}
```

### 2. Actualización de Interfaz (`VehicleSection.tsx`)

**Cambios en Props:**
```typescript
interface VehicleSectionProps {
  // ... otros props
  vehicleBrandRequired?: boolean;
  vehicleModelRequired?: boolean; 
  licensePlateRequired?: boolean;
  // Removido: isVehicleInfoOptional?: boolean;
}
```

**Cambios en UI:**
- Asterisco rojo (*) solo aparece si el campo específico es requerido
- Mensaje "Opcional para este tipo de servicio" solo aparece si el campo NO es requerido
- Atributo `required` del input se basa en el flag específico del campo

### 3. Actualización de Formulario (`EnhancedServiceForm.tsx`)

**Antes:**
```typescript
<VehicleSection
  // ... otros props
  isVehicleInfoOptional={selectedServiceType?.vehicleInfoOptional || false}
/>
```

**Después:**
```typescript
<VehicleSection
  // ... otros props
  vehicleBrandRequired={selectedServiceType?.vehicleBrandRequired || false}
  vehicleModelRequired={selectedServiceType?.vehicleModelRequired || false}
  licensePlateRequired={selectedServiceType?.licensePlateRequired || false}
/>
```

## Beneficios

1. **Flexibilidad**: Cada campo puede ser configurado independientemente
2. **Claridad**: El usuario ve exactamente qué campos son obligatorios u opcionales
3. **Consistencia**: La validación respeta la configuración real del Service Type
4. **UX Mejorada**: Mensajes claros sobre el estado de cada campo

## Archivos Modificados

- `src/hooks/services/useServiceFormValidation.ts` - Validación backend
- `src/components/services/form/VehicleSection.tsx` - Componente de vehículo 
- `src/components/services/EnhancedServiceForm.tsx` - Formulario principal
- `src/pages/portal/PortalRequestService.tsx` - Portal del cliente

## Casos Corregidos

1. **Formulario Principal de Servicios**: Ahora respeta configuraciones individuales de cada campo
2. **Portal del Cliente**: Corregido para mostrar asteriscos solo en campos requeridos individualmente
3. **Validación**: Solo valida campos según su configuración específica (no el flag general)

## Testing Recomendado

1. Configurar un Service Type con:
   - Marca: Requerida
   - Modelo: Opcional  
   - Patente: Opcional

2. Verificar que:
   - Solo la marca muestre asterisco rojo
   - Solo marca y modelo muestren mensaje "Opcional"
   - La validación solo falle si falta la marca
   - El formulario se envíe correctamente sin modelo ni patente

## Fecha de Implementación

2025-07-28