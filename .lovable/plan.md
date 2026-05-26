Diagnóstico: el desfase vuelve en el modal de cierre porque todavía hay conversiones con `new Date('YYYY-MM-DD')` y formateos con `toLocaleDateString` sobre fechas de solo día. En zonas UTC negativas eso puede mostrar/guardar el día anterior. Ya existe el estándar del proyecto: usar `safeParseDateOnly`/helpers locales para fechas `YYYY-MM-DD`.

Plan:
1. Corregir el auto-relleno de fechas al seleccionar servicios en `EnhancedServicesSelector` para parsear `service.serviceDate` con `safeParseDateOnly` en vez de `new Date(service.serviceDate)`.
2. Ajustar el resumen lateral de cierre para mostrar fechas con formato seguro y consistente, evitando `toLocaleDateString` cuando el valor representa un día comercial.
3. Revisar el flujo de guardado/filtro del cierre para mantener `toLocalDateString` y asegurar que el rango enviado a Supabase sea exactamente el día seleccionado.
4. Validar que seleccionar el servicio `2026-05-26` auto-complete y muestre `26/05/2026`, no `25/05/2026`, y que el filtro del rango incluya ese servicio correctamente.

Archivos a tocar:
- `src/components/closures/EnhancedServicesSelector.tsx`
- `src/components/closures/ClosureSummaryPanel.tsx`
- Si durante la implementación aparece otro uso directo en este flujo, aplicar el mismo helper seguro sin cambiar reglas de negocio.