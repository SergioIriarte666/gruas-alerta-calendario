

# Plan: Eliminar Duplicados y Prevenir Futuros en Pagos de Proveedores

## Problema Detectado

Se encontraron registros duplicados en la tabla `supplier_payments` con el mismo `reference_number` (folio 504448). La causa es que:

1. La detección de duplicados **solo se aplica en importación XML**
2. **No hay validación** al crear pagos manualmente desde el formulario
3. El sistema permite crear pagos con el mismo número de referencia múltiples veces

### Datos Actuales
| Registro | Creado | Estado | Referencia |
|----------|--------|--------|------------|
| Original | 05/11/2025 | Vencido | 504448 |
| Duplicado | 08/02/2026 | Pagado | 504448 |

Hay **4 grupos de duplicados** en total en la base de datos.

---

## Solución

### Parte 1: Limpiar Duplicados Existentes

Crear una herramienta en el panel de proveedores para detectar y resolver duplicados existentes.

**Archivo:** `src/components/suppliers/DuplicatePaymentsDetector.tsx`

- Botón en PaymentList para "Detectar Duplicados"
- Modal que muestra grupos de pagos con el mismo `reference_number`
- Opciones para cada grupo:
  - Conservar el más reciente (eliminar antiguos)
  - Conservar el más antiguo (eliminar nuevos)
  - Fusionar: conservar uno y marcar los otros como cancelados
  - Ignorar (no hacer nada)

### Parte 2: Prevenir Duplicados en Creación Manual

**Archivo:** `src/components/suppliers/PaymentForm.tsx`

Agregar validación antes de guardar:

1. Verificar si ya existe un pago con el mismo `reference_number` para el mismo proveedor
2. Si existe, mostrar advertencia con opciones:
   - "Ya existe un pago con referencia 504448 para este proveedor. ¿Desea continuar?"
   - Mostrar detalles del pago existente (monto, fecha, estado)
3. Permitir al usuario decidir si crear de todas formas o cancelar

### Parte 3: Mejorar la Detección en Importación XML

**Archivo:** `src/components/suppliers/XMLDocumentUpload.tsx`

- Hacer la detección de duplicados más visible
- Bloquear importación de documentos con duplicados exactos (actualmente solo los deselecciona)
- Agregar badge rojo más prominente en cada tarjeta de documento duplicado

---

## Cambios Técnicos

### 1. Hook para Detección de Duplicados

```typescript
// src/hooks/usePaymentDuplicateCheck.ts
export const usePaymentDuplicateCheck = () => {
  const checkDuplicate = async (referenceNumber: string, supplierId: string) => {
    const { data } = await supabase
      .from('supplier_payments')
      .select('*')
      .eq('reference_number', referenceNumber)
      .eq('supplier_id', supplierId);
    
    return data && data.length > 0 ? data[0] : null;
  };
  
  return { checkDuplicate };
};
```

### 2. Modificar PaymentForm.tsx

- Antes del `onSubmit`, llamar a `checkDuplicate`
- Si hay duplicado, mostrar `AlertDialog` de confirmación
- Mostrar detalles del pago existente

### 3. Componente Detector de Duplicados

- Query para encontrar todos los grupos con `COUNT(*) > 1`
- Interfaz para seleccionar acción por grupo
- Ejecutar eliminaciones/actualizaciones en batch

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `src/hooks/usePaymentDuplicateCheck.ts` | Crear |
| `src/components/suppliers/PaymentForm.tsx` | Modificar - agregar validación |
| `src/components/suppliers/DuplicatePaymentsDetector.tsx` | Crear |
| `src/components/suppliers/PaymentList.tsx` | Modificar - agregar botón "Detectar Duplicados" |

---

## Resultado Esperado

1. Los duplicados existentes se pueden limpiar desde la UI
2. La creación manual de pagos advierte si ya existe uno con la misma referencia
3. Menor probabilidad de duplicados accidentales
4. Integridad de datos mejorada

