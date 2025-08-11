# Corrección del Estado de Servicios Facturados

## Problema Identificado
Los servicios no cambiaban automáticamente su estado a `'invoiced'` cuando se creaba o actualizaba una factura.

## Solución Implementada

### Archivos Modificados
- `src/hooks/invoices/useInvoiceOperations.ts`

### Cambios Realizados

#### 1. Función `createInvoice` (líneas 78-84)
**Antes:**
```typescript
const { error: updateServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: folio,
    invoice_numero_fiscal: invoiceData.numeroFiscal || null
  })
```

**Después:**
```typescript
const { error: updateServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: folio,
    invoice_numero_fiscal: invoiceData.numeroFiscal || null,
    status: 'invoiced'  // ← Agregado
  })
```

#### 2. Función `updateInvoice` (líneas 277-283)
**Antes:**
```typescript
const { error: updateServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: currentInvoice.folio,
    invoice_numero_fiscal: finalNumeroFiscal
  })
```

**Después:**
```typescript
const { error: updateServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: currentInvoice.folio,
    invoice_numero_fiscal: finalNumeroFiscal,
    status: 'invoiced'  // ← Agregado
  })
```

#### 3. Limpieza de servicios antiguos (líneas 205-211)
**Antes:**
```typescript
const { error: clearOldServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: null,
    invoice_numero_fiscal: null
  })
```

**Después:**
```typescript
const { error: clearOldServicesError } = await supabase
  .from('services')
  .update({ 
    invoice_folio: null,
    invoice_numero_fiscal: null,
    status: 'completed'  // ← Agregado (revierte a completado)
  })
```

## Resultado
- ✅ Los servicios cambian automáticamente a estado `'invoiced'` al crear factura
- ✅ Los servicios cambian automáticamente a estado `'invoiced'` al actualizar factura
- ✅ Los servicios revierten a `'completed'` cuando se remueven de una factura
- ✅ Se mantiene toda la funcionalidad existente de protección y validación

## Fecha de Implementación
2025-01-30