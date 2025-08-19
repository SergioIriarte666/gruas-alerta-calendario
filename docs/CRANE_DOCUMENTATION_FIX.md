# Problema: Sección de Documentación Desaparecida en Grúas

## Fecha: 2025-07-22

### Problema Reportado
La sección de "Documentación" en el detalle de las grúas no aparece. Anteriormente funcionaba correctamente.

### Análisis Técnico
1. **Datos disponibles**: Las network requests confirman que los datos llegan correctamente:
   - `circulation_permit_expiry: "2025-09-30"`
   - `insurance_expiry: "2025-09-30"`
   - `technical_review_expiry: "2026-01-07"`

2. **Código presente**: La sección de documentación está en `CraneMetricsOverview.tsx` líneas 210-235

3. **Causa probable**: Error en el cálculo de días que evita el renderizado completo del componente

### Solución Aplicada
1. **Corregido el problema de zona horaria** en fechas de documentación
2. **Integrado con configuración global** de zona horaria del usuario
3. **Actualizado formateo** para usar `formatForDisplay` en lugar de `format` directo
4. **Mejorado cálculo de días** usando `parseFromDatabase` y `getCurrentChileDate`

### Código Actualizado
- Archivo: `src/components/cranes/CraneDocumentsSection.tsx`
- Funciones: `getDaysUntilExpiry()` y formateo de fechas actualizados
- Integración: Uso de `timezoneUtils.ts` para manejo consistente de fechas
- Imports: Migración de `date-fns` a `timezoneUtils` personalizado

### Prevención Futura
- Usar siempre `timezoneUtils.ts` para manejo de fechas
- Evitar uso directo de `new Date()` y `date-fns` en componentes
- Mantener consistencia con configuración global del usuario
- Documentar cambios en el sistema de documentación