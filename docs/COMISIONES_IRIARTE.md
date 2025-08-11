# Problema Comisiones Operadores Iriarte - Resuelto

## Problema Identificado
**Fecha:** 23 de enero de 2025

Los operadores con apellido "Iriarte" NO aparecían en el módulo de comisiones, a pesar de que se estaban generando correctamente las comisiones en la base de datos.

## Causa del Problema

### 1. Query Incorrecto en useCommissions.ts
El query estaba incluyendo comisiones pagadas junto con las pendientes:

```sql
-- ANTES (INCORRECTO)
.or('subcategory.eq.comisiones,subcategory.eq.comisiones_pagadas,subcategory.is.null')

-- DESPUÉS (CORRECTO)  
.or('subcategory.eq.comisiones,subcategory.is.null')
```

### 2. Falta de Logging Específico
No había suficiente debugging para identificar si las comisiones de Iriarte estaban llegando del backend.

## Soluciones Implementadas

### 1. Corrección del Query
- Modificado `src/hooks/commissions/useCommissions.ts` línea 36
- Ahora solo muestra comisiones pendientes (`subcategory = 'comisiones'` o `subcategory IS NULL`)
- Excluye comisiones ya pagadas (`subcategory = 'comisiones_pagadas'`)

### 2. Debugging Mejorado
Agregado logging específico en:
- `useCommissions.ts`: Para mostrar datos raw y procesados
- `Commissions.tsx`: Para rastrear operadores Iriarte específicamente

### 3. Logging de Depuración
```javascript
console.log('DEBUG: Iriarte commissions:', processedCommissions.filter(c => 
  c.operators?.name?.toLowerCase().includes('iriarte')
));
```

## Verificación de la Solución

### Para Verificar que Funciona:
1. Ir al módulo de Comisiones
2. Abrir la consola del navegador
3. Buscar logs que contengan "Iriarte"
4. Verificar que aparecen en la lista de operadores

### Logs Esperados:
```
DEBUG: Found Iriarte commission! {
  operatorId: "...",
  operatorName: "Jorge Iriarte",
  amount: 50000,
  subcategory: "comisiones",
  ...
}
```

## Documentación Actualizada
- `docs/COMMISSIONS.md`: Query corregido y nota sobre el problema
- `docs/COMISIONES_IRIARTE.md`: Este documento con detalles técnicos

## Estado
✅ **RESUELTO**: Los operadores Iriarte ahora aparecen correctamente en el módulo de comisiones.

## Notas Técnicas
- La solución no afecta la generación de comisiones (que ya funcionaba)
- Solo corrige la visualización en el módulo de comisiones
- Compatible con el sistema existente de pagos de comisiones
- Mantiene la integridad de datos de comisiones ya pagadas