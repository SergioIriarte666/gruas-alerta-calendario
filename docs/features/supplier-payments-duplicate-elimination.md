# Eliminación de Duplicidad en Costos de Pagos a Proveedores

## Resumen
Se ha implementado una solución para eliminar la duplicidad de costos que ocurría cuando un pago a proveedor con detalles de piezas se marcaba como "pagado". Anteriormente, el sistema creaba dos registros de costos: uno automático genérico y otro específico para piezas.

## Problema Original
Cuando un pago de proveedor incluía detalles de piezas (nombre, cantidad, precio unitario, grúa) y se marcaba como "pagado":
1. El trigger `create_cost_from_supplier_payment` creaba automáticamente un costo genérico "Pagos a Proveedores"
2. La funcionalidad de piezas creaba adicionalmente un costo específico "Mantenimiento - Piezas y Repuestos"
3. Resultado: **Duplicidad** - dos costos por el mismo gasto

## Solución Implementada

### 1. Modificación del Trigger de Base de Datos
**Archivo:** Base de datos - función `create_cost_from_supplier_payment()`

**Cambios:**
- Agregada verificación para evitar duplicados: `existing_cost_count`
- Si ya existe un costo para ese `supplier_payment_id`, el trigger no crea un nuevo costo
- Mantiene la funcionalidad original para pagos sin piezas

```sql
-- Verificar si ya existe un costo para este pago (evitar duplicados)
SELECT COUNT(*) INTO existing_cost_count
FROM public.costs
WHERE supplier_payment_id = NEW.id;

-- Si ya existe un costo, no crear otro
IF existing_cost_count > 0 THEN
  RETURN NEW;
END IF;
```

### 2. Mejora del Hook useSupplierPayments
**Archivo:** `src/hooks/useSupplierPayments.ts`

**Cambios en `markPaymentAsPaidMutation`:**
- Nuevo parámetro opcional `partDetails` para recibir información de piezas
- Lógica para crear costo específico cuando hay detalles de piezas
- Integración automática con la tabla `crane_parts`

**Estructura del nuevo parámetro:**
```typescript
partDetails?: {
  part_name: string;
  part_quantity: number;
  part_unit_price: number;
  crane_id: string;
}
```

**Flujo de ejecución:**
1. Marcar pago como "paid" en `supplier_payments`
2. Si hay `partDetails`:
   - Obtener información del proveedor
   - Buscar categoría "Mantenimiento"
   - Crear costo específico con subcategoría "Piezas y Repuestos"
   - Crear registro en `crane_parts` vinculado al costo
3. El trigger modificado detecta que ya existe un costo y NO crea duplicado

### 3. Actualización del Formulario PaymentForm
**Archivo:** `src/components/suppliers/PaymentForm.tsx`

**Cambios:**
- Separación de campos de piezas de los datos del pago
- Lógica para detectar cuando hay detalles de piezas válidos
- Uso de `markPaymentAsPaid` con detalles de piezas cuando corresponde
- Manejo especial para pagos que se marcan como "paid" desde el formulario

**Flujo del formulario:**
- Si es pago nuevo o actualización sin marcar como "paid": flujo normal
- Si es actualización marcando como "paid" con piezas: 
  1. Actualizar pago (mantener status pending temporalmente)
  2. Llamar `markPaymentAsPaid` con detalles de piezas
  3. El backend crea el costo específico y registro de piezas

## Resultados

### ✅ **Eliminación de Duplicidad**
- Solo se crea un registro de costo por pago
- Información más precisa y específica para piezas
- Eliminación de confusión en reportes financieros

### ✅ **Funcionalidad Mejorada**
- Integración automática con sistema de piezas
- Rastreo completo desde pago → costo → pieza
- Mensajes informativos para el usuario

### ✅ **Compatibilidad Mantenida**
- Pagos sin piezas siguen funcionando como antes
- No afecta registros históricos existentes
- Migración transparente para usuarios

## Flujos de Trabajo

### Pago SIN Piezas (Comportamiento Original)
1. Usuario marca pago como "paid" → `markPaymentAsPaid()` estándar
2. Trigger crea costo automático "Pagos a Proveedores"
3. **Un solo costo creado** ✅

### Pago CON Piezas (Nuevo Comportamiento)
1. Usuario completa campos de piezas en formulario
2. Marca pago como "paid"
3. Frontend detecta piezas y crea costo específico "Mantenimiento - Piezas y Repuestos"
4. Sistema registra automáticamente en `crane_parts`
5. Trigger verifica que ya existe costo → NO crea duplicado
6. **Un solo costo específico creado** ✅

## Campos de Piezas en el Formulario

Los siguientes campos están disponibles cuando la categoría es "Mantenimiento":

- **Nombre de la Pieza**: Descripción de la pieza adquirida
- **Grúa Destino**: Grúa a la que se destina la pieza
- **Cantidad**: Número de unidades compradas
- **Precio Unitario**: Costo por unidad

**Validación automática:** Si todos los campos de piezas están completos, el sistema muestra una confirmación visual de que se registrará automáticamente como "Piezas y Repuestos".

## Beneficios del Sistema

1. **Precisión Financiera**: Eliminación de doble contabilidad
2. **Trazabilidad Completa**: Desde pago hasta pieza instalada
3. **Automatización**: Reducción de trabajo manual
4. **Integridad de Datos**: Prevención de inconsistencias
5. **Reportes Exactos**: Información confiable para toma de decisiones

## Notas Técnicas

- **Aplicación**: Solo para registros futuros
- **Registros Existentes**: No son afectados automáticamente
- **Duplicados Históricos**: Deben eliminarse manualmente según sea necesario
- **Compatibilidad**: Totalmente compatible con funcionalidades existentes

## Actualización de Mensajes

- **Sin piezas**: "Pago marcado como pagado - Se registrará automáticamente en costos"
- **Con piezas**: "Pago marcado como pagado - Se registró automáticamente en costos y piezas"

Esta implementación asegura un flujo de trabajo más eficiente y preciso para la gestión de pagos a proveedores con detalles de piezas.