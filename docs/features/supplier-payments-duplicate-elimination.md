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

## Corrección Final del Trigger (Octubre 2025)

### Problema Detectado
El trigger `create_cost_from_supplier_payment()` contenía referencias a columnas que no existen en la tabla `supplier_payments`:
- ❌ `part_name`
- ❌ `part_quantity`
- ❌ `part_unit_price`
- ❌ `crane_id`

**Causa:** Estas columnas fueron parte de una implementación anterior que fue refactorizada. El trigger no se actualizó correctamente, causando errores al marcar pagos como pagados desde la UI.

**Error observado:**
```
ERROR: column "part_name" does not exist
```

### Solución Implementada

✅ **Eliminada lógica de `crane_parts` del trigger**
- El trigger ahora solo crea el costo base automáticamente
- No intenta acceder a columnas inexistentes

✅ **Creación de `crane_parts` permanece en `useSupplierPayments.ts`**
- Hook maneja la creación de registros de piezas cuando hay `partDetails` (líneas 132-177)
- Arquitectura clara: trigger = costo, hook = crane_parts

✅ **Protección anti-duplicados mantenida**
- Verificación `EXISTS` antes de crear costo
- Previene duplicados si el hook ya creó un costo

### Flujo Correcto Actual

```
1. Usuario marca pago como pagado (con o sin detalles de piezas)
   ↓
2. Hook actualiza supplier_payments.status = 'paid'
   ↓
3. Trigger detecta cambio y verifica si ya existe costo
   ↓
4. Si NO existe costo → Trigger crea costo base automáticamente
   ↓
5. Si hay partDetails → Hook crea registro en crane_parts
   ↓
6. ✅ Sin errores, sin duplicados
```

### Trigger Corregido

La función `create_cost_from_supplier_payment()` ahora:

1. ✅ Solo verifica `NEW.status = 'paid'`
2. ✅ Comprueba duplicados antes de crear
3. ✅ Crea costo con información del proveedor y categoría
4. ✅ NO intenta leer columnas de piezas
5. ✅ Registra mensajes NOTICE para debugging

### Resultado Final

- ✅ **Error eliminado** - Trigger no accede a columnas inexistentes
- ✅ **Funcionalidad mantenida** - Creación automática de costos funciona
- ✅ **Prevención de duplicados** - Check de existencia activo
- ✅ **Arquitectura clara** - Separación de responsabilidades
- ✅ **Retrocompatible** - No afecta registros existentes

---

## Corrección de Cast TEXT → UUID (Octubre 2025)

### Problema Detectado
El trigger fallaba con error `operator does not exist: uuid = text` al marcar pagos como pagados:

**Causa raíz:**
- Columna `supplier_payments.category` es de tipo **TEXT**
- Tabla `supplier_categories.id` es de tipo **UUID**
- El trigger intentaba comparar directamente `uuid = text` sin cast explícito
- **Datos mixtos**: registros antiguos tienen strings ("mantenimiento", "otros"), registros nuevos tienen UUIDs válidos

**Error observado:**
```
ERROR: operator does not exist: uuid = text
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.
```

### Solución Implementada

✅ **Bloque BEGIN/EXCEPTION para manejo robusto de tipos**
```sql
BEGIN
  -- Intentar como UUID primero (para registros nuevos)
  SELECT name INTO v_category_name
  FROM supplier_categories
  WHERE id = NEW.category::uuid;
EXCEPTION
  WHEN invalid_text_representation THEN
    -- Si falla el cast a UUID, usar el valor de texto directamente (registros antiguos)
    v_category_name := NEW.category;
  WHEN OTHERS THEN
    v_category_name := NULL;
END;
```

✅ **Retrocompatibilidad total**
- Registros con `category` como UUID válido → Busca en `supplier_categories`
- Registros con `category` como texto ("mantenimiento") → Usa el texto directamente
- Cualquier otro error → Establece `v_category_name` como NULL

✅ **Sin migración de datos requerida**
- No es necesario modificar registros existentes
- Funciona con datos antiguos y nuevos simultáneamente
- No hay riesgo de pérdida de información

### Beneficios
- ✅ **Resuelve el error actual** - Maneja conversión TEXT → UUID con excepciones
- ✅ **Robusto** - Manejo de casos edge y errores inesperados
- ✅ **Retrocompatible** - Funciona con todos los registros históricos
- ✅ **Sin downtime** - No requiere limpieza de datos previa
- ✅ **Prevención de futuros errores** - Cast explícito documentado

### Flujo de Ejecución del Trigger
```
1. Usuario marca pago como 'paid'
   ↓
2. Trigger verifica si ya existe costo (anti-duplicados)
   ↓
3. Intenta obtener nombre de categoría:
   a) Intenta cast a UUID → Busca en supplier_categories
   b) Si falla (EXCEPTION) → Usa valor TEXT directamente
   c) Si error diferente → v_category_name = NULL
   ↓
4. Crea costo con información obtenida
   ↓
5. ✅ Sin errores, sin duplicados, retrocompatible
```

### Alternativa Descartada

**Migrar todos los valores TEXT a UUID:**
- ❌ Requiere script complejo de migración de datos
- ❌ Riesgo de pérdida de datos si hay categorías no mapeadas
- ❌ Requiere mantenimiento de base de datos
- ❌ Mayor tiempo de implementación
- ❌ Potencial downtime durante migración

**Por qué la solución actual es mejor:**
- ✅ Implementación inmediata sin cambios de datos
- ✅ Cero riesgo de pérdida de información
- ✅ Funciona con cualquier valor en `category`
- ✅ Más simple y mantenible