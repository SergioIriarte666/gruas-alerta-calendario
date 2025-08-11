# Corrección de Validación de Campos Según Tipo de Servicio

## Problema

Los campos de origen, destino, grúa y operador aparecían como requeridos de forma hardcodeada, sin considerar la configuración específica del tipo de servicio. Esto causaba problemas especialmente con servicios como "Custodia/Parking" donde estos campos deberían ser opcionales.

## Solución Implementada

### 1. LocationSection.tsx
- Agregado props `originRequired` y `destinationRequired`
- Asteriscos y validación HTML `required` ahora condicionales
- Mensaje "(Opcional)" cuando los campos no son requeridos

### 2. EnhancedServiceForm.tsx
- Pasando flags individuales de requerimientos a LocationSection
- Grúa ahora muestra asterisco solo si `craneRequired` es true
- Agregado mensaje "(Opcional)" para grúa cuando no es requerida

### 3. MultipleOperatorsSection.tsx
- Agregado prop `operatorRequired`
- Título del componente ahora incluye asterisco condicional
- Mensaje "(Opcional)" cuando operadores no son requeridos

### 4. PortalRequestService.tsx (Portal del Cliente)
- Corregidos asteriscos hardcodeados para origen y destino
- Usando `origin_required` y `destination_required` del tipo de servicio
- Mensajes "(Opcional)" agregados consistentemente

## Casos Validados

### Custodia/Parking
- ✅ Origen: Opcional (sin asterisco)
- ✅ Destino: Opcional (sin asterisco)  
- ✅ Grúa: Opcional (sin asterisco)
- ✅ Operador: Opcional (sin asterisco)

### Servicios Regulares
- ✅ Campos marcados según configuración del tipo de servicio
- ✅ Asteriscos solo en campos requeridos
- ✅ Validación consistente entre formulario principal y portal

## Archivos Modificados

- `src/components/services/form/LocationSection.tsx` - Campos de ubicación
- `src/components/services/EnhancedServiceForm.tsx` - Formulario principal  
- `src/components/services/form/MultipleOperatorsSection.tsx` - Sección de operadores
- `src/pages/portal/PortalRequestService.tsx` - Portal del cliente

## Beneficios

1. **Flexibilidad**: Cada tipo de servicio respeta su configuración específica
2. **UX Mejorada**: Los usuarios ven claramente qué campos son opcionales/requeridos
3. **Consistencia**: Misma lógica entre formulario principal y portal del cliente
4. **Validación Correcta**: Solo se validan campos efectivamente requeridos

## Testing Recomendado

1. Crear/editar tipo de servicio "Custodia" con todos los campos opcionales
2. Verificar que no aparezcan asteriscos en ningún campo
3. Probar envío de formulario con campos vacíos (debe pasar validación)
4. Verificar comportamiento en portal del cliente
5. Comparar con servicios regulares que tengan campos requeridos