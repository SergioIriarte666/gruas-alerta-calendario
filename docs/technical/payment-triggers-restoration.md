# Restauración del Sistema de Triggers de Pagos

**Fecha**: 24 de octubre de 2025  
**Estado**: ✅ Resuelto

## Problema Reportado

El usuario aplicó un pago manualmente, pero el sistema seguía mostrando:
- Estado: `pending` (pendiente)
- Monto aplicado: $0
- El pago NO se reflejaba en las facturas

## Causa Raíz

Los triggers automáticos críticos **NO estaban activos** en la base de datos:
1. `maintain_payment_consistency_trigger`
2. `payment_applications_auto_update_invoice_status`

Esto causaba que:
- ✅ Se creaban registros en `payment_applications`
- ❌ Los `payments` NO se actualizaban
- ❌ Las `invoices` NO cambiaban de estado

## Solución Implementada

### Migración: `20251024_fix_payment_triggers_and_inconsistencies.sql`

#### Paso 1: Recreación de Funciones de Trigger
```sql
-- maintain_payment_consistency(): Actualiza payments cuando cambian payment_applications
-- update_invoice_status_from_payments(): Actualiza invoices cuando cambian payment_applications
```

#### Paso 2: Recreación de Triggers
```sql
CREATE TRIGGER maintain_payment_consistency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION maintain_payment_consistency();

CREATE TRIGGER payment_applications_auto_update_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON payment_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_status_from_payments();
```

#### Paso 3: Corrección de Datos Existentes

Se crearon funciones para corregir inconsistencias:
- `fix_existing_payment_inconsistencies()`: Corrige todos los pagos con datos incorrectos
- `fix_existing_invoice_inconsistencies()`: Corrige todas las facturas con datos incorrectos

La migración ejecuta automáticamente estas funciones para limpiar el sistema.

#### Paso 4: Validación Automática

La migración valida que ambos triggers estén activos, lanzando una excepción si falta alguno.

## Flujo de Datos Correcto (Después de la Corrección)

```
Usuario aplica pago → payment_applications (INSERT)
                     ↓
          maintain_payment_consistency_trigger (ACTIVO)
                     ↓
          Actualiza payments:
          - applied_amount = SUM(applications)
          - status = 'partial' | 'applied'
          - remaining_amount (calculado automáticamente)
                     ↓
    payment_applications_auto_update_invoice_status (ACTIVO)
                     ↓
          Actualiza invoices:
          - paid_amount = SUM(applications)
          - status = 'partial' | 'paid'
          - remaining_amount (calculado automáticamente)
```

## Estados Automáticos

### Para Payments
- `pending`: Sin aplicaciones (`applied_amount = 0`)
- `partial`: Aplicado parcialmente (`0 < applied_amount < amount`)
- `applied`: Completamente aplicado (`applied_amount >= amount`)

### Para Invoices
- `partial`: Pagada parcialmente (`0 < paid_amount < total`)
- `paid`: Completamente pagada (`paid_amount >= total`)

## Validación Post-Corrección

✅ **Triggers activos verificados**: 2 triggers únicos en `payment_applications`  
✅ **Datos corregidos**: Todos los pagos y facturas inconsistentes fueron actualizados  
✅ **Sistema funcional**: Nuevas aplicaciones se procesan automáticamente

## Funciones de Mantenimiento Disponibles

Estas funciones pueden ejecutarse manualmente si se detectan inconsistencias futuras:

```sql
-- Corregir todos los pagos
SELECT * FROM fix_existing_payment_inconsistencies();

-- Corregir todas las facturas
SELECT * FROM fix_existing_invoice_inconsistencies();
```

## Prevención Futura

1. **Nunca deshabilitar estos triggers** - Son críticos para la integridad del sistema
2. **Si se detecta un pago en `pending` con aplicaciones**, ejecutar las funciones de corrección
3. **Monitorear el estado de los triggers** periódicamente con:
   ```sql
   SELECT COUNT(DISTINCT trigger_name)
   FROM information_schema.triggers
   WHERE trigger_name IN (
     'maintain_payment_consistency_trigger',
     'payment_applications_auto_update_invoice_status'
   ) AND event_object_table = 'payment_applications';
   -- Debe devolver: 2
   ```

## Notas Técnicas

- **Columnas Generadas**: `remaining_amount` en `payments` e `invoices` son calculadas automáticamente y NUNCA deben actualizarse manualmente
- **UPSERT de Triggers**: Los triggers se crean con `DROP IF EXISTS` para evitar duplicados
- **SET search_path**: Todas las funciones incluyen `SET search_path = public` para prevenir schema hijacking
- **Validación en Migración**: La migración falla si los triggers no se crean correctamente, previniendo despliegues incompletos

## Referencias

- Ver también: `docs/technical/payment-reconciliation-fix.md`
- Ver también: `docs/technical/payment-system.md`
