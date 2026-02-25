

# Correccion de Decimales Flotantes en toda la App

## Problema
Al sumar valores de servicios (ej: 650000), JavaScript produce errores de punto flotante como `650000.00000021`. Esto se muestra en formularios, tablas y metricas en toda la app.

## Causa raiz
Las funciones `calculateClosureTotal`, `getServiceValueForClosure`, y multiples `.reduce()` acumulan errores de precision de punto flotante de JavaScript. Ningun punto de la cadena aplica redondeo.

## Solucion
Aplicar `Math.round()` en los puntos centrales de calculo y formato, lo que corrige el problema en cascada para toda la app.

## Cambios

### 1. `src/utils/serviceValueCalculations.ts`
- `calculateClosureTotal`: envolver el resultado del `.reduce()` con `Math.round()`
- `getCompleteServiceValue`: aplicar `Math.round()` al resultado
- `getServiceValueForClosure`: aplicar `Math.round()` al resultado
- `getDisplayServiceValue`: aplicar `Math.round()` al resultado
- `getServiceValueForProfit`: aplicar `Math.round()` al resultado

### 2. `src/lib/utils.ts` - `formatCurrency`
- Aplicar `Math.round(amount)` antes de formatear, ya que los montos en CLP no tienen centavos
- Para USD/EUR mantener 2 decimales pero con redondeo limpio

### 3. `src/components/closures/ClosureForm.tsx`
- Linea 138: aplicar `Math.round()` al total calculado antes de guardarlo en formData

### 4. `src/hooks/closures/useEditClosure.ts`
- Linea 187: aplicar `Math.round()` al `newTotal` antes de guardarlo en la base de datos

### 5. `src/hooks/closures/useClosureOperations.ts`
- En la creacion del cierre, aplicar `Math.round()` al total

### 6. `src/components/closures/automation/AutomatedClosureWorkflow.tsx`
- Linea 85: aplicar `Math.round()` al total calculado

### 7. `src/hooks/services/useServicesMetrics.ts`
- Aplicar `Math.round()` a `totalRevenue`, `totalCosts`, `netProfit` en los calculos de metricas

### 8. `src/hooks/useReports.ts`
- Aplicar `Math.round()` a los totales calculados con reduce (totalRevenue, etc.)

## Seccion tecnica

La correccion principal esta en `serviceValueCalculations.ts` ya que es el modulo central. Al redondear ahi, la mayoria de los valores derivados quedan limpios automaticamente. Los demas cambios son defensivos para cubrir reduce() directo en otros archivos.

Patron aplicado:
```text
// Antes
return services.reduce((sum, s) => sum + getValue(s), 0);

// Despues  
return Math.round(services.reduce((sum, s) => sum + getValue(s), 0));
```

Para `formatCurrency` en CLP (sin centavos):
```text
// Antes
new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount)

// Despues
new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Math.round(amount))
```
