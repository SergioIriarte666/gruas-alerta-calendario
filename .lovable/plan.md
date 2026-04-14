

# Plan: Corregir problema de zona horaria en toda la app

## Problema
La app usa `toISOString().split('T')[0]` en **37 archivos (322 ocurrencias)** para convertir fechas a formato `YYYY-MM-DD`. El método `toISOString()` convierte a UTC, lo que en Chile (UTC-3/UTC-4) puede restar un día. Por ejemplo, si seleccionas 13/04/2026 a las 23:00 Chile, `toISOString()` devuelve `2026-04-14T...`, y si es medianoche, puede retroceder al día anterior.

También `new Date(dateString)` sin hora (ej: `new Date("2026-04-13")`) interpreta como UTC medianoche, causando desfase similar.

## Solución

### 1. Agregar helper `toLocalDateString` en `src/utils/timezoneUtils.ts`
```typescript
/** Convert a Date to YYYY-MM-DD using LOCAL time (not UTC) */
export const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Get today as YYYY-MM-DD in local time */
export const getTodayLocal = (): string => toLocalDateString(new Date());
```

### 2. Reemplazar todas las ocurrencias en 37 archivos
Cambiar cada `someDate.toISOString().split('T')[0]` → `toLocalDateString(someDate)` y cada `new Date().toISOString().split('T')[0]` → `getTodayLocal()`.

**Archivos principales afectados** (los más críticos primero):
- `src/components/closures/ClosureForm.tsx` — fechas de cierre (el bug visible en la captura)
- `src/components/closures/automation/AutomatedClosureWorkflow.tsx` — cierre automático
- `src/hooks/useClosureAutomation.ts` — consultas con rango de fechas
- `src/components/invoices/InvoiceForm.tsx` — fechas de facturas
- `src/components/invoices/SmartPaymentForm.tsx` — fecha de pago
- `src/hooks/invoices/useInvoiceFormData.ts` — defaults de factura
- `src/hooks/useDashboardData.ts` — rango de consulta dashboard
- `src/hooks/services/useServiceManager.ts` — fecha de costos
- `src/hooks/useSupplierPayments.ts` — fechas de pagos
- `src/utils/calendarHelpers.ts` — comparación de fechas calendario
- `src/utils/invoiceUtils.ts` — conversión de fechas
- `src/utils/xmlParser/xmlSupplierParser.ts` — parsing XML
- Y los ~25 archivos restantes con el mismo patrón

### 3. Corregir `new Date(dateString)` sin hora
En `src/utils/calendarHelpers.ts` línea 11 y otros lugares donde se hace `new Date(event.date)` con un string `YYYY-MM-DD`, usar `safeParseDateOnly` en su lugar.

### 4. Corregir `DatePickerInput` 
Ya usa mediodía local — está correcto. No requiere cambios.

## Detalle técnico
- `toISOString()` siempre emite en UTC. En Chile (UTC-4), las 23:00 del 13/04 = 03:00 UTC del 14/04. Split da "2026-04-14" en vez de "2026-04-13".
- `format(date, 'yyyy-MM-dd')` de date-fns SÍ usa hora local — esos casos están bien.
- La solución `toLocalDateString` usa `getFullYear/getMonth/getDate` que son siempre locales.

## Archivos
- `src/utils/timezoneUtils.ts` (agregar 2 helpers)
- ~37 archivos con reemplazo de patrón

