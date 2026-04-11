

# Plan: Actualizar Edge Function para Plan Premium SRE

## Problema
1. El token SRE no está activo (403 en todos los requests) — esto se resuelve activándolo en el panel de SRE.cl
2. La Edge Function actual solo captura campos del plan público. Con el plan premium hay más datos disponibles.

## Campos premium a agregar

Según la documentación de SRE (captura adjunta):

| Campo Premium | Uso en formulario |
|---|---|
| email (contacto) | email del cliente |
| telefono | teléfono del cliente |
| direccion completa | dirección del cliente |
| actividades_economicas | mostrar en panel de resultados |
| fecha_resolucion | mostrar en panel de resultados |
| logo | posible uso futuro |
| tags | posible uso futuro |
| info geográfica | posible uso futuro |

## Cambios

### 1. `supabase/functions/sre-lookup/index.ts`
- Agregar log del body de respuesta completo para debug (ya existe)
- Agregar mapeo de campos premium adicionales: `actividades_economicas`, `fecha_resolucion`, `dte_email` (separado del email de contacto)
- Mejorar log de error para incluir el body de la respuesta 403 (útil para diagnosticar)

### 2. `src/components/clients/form/ClientFormStep1.tsx`
- Agregar visualización de campos premium en el panel de resultados (actividades económicas, fecha resolución, DTE email)
- Mantener el botón "Aplicar datos" con los campos relevantes para el formulario

## Alcance
- 2 archivos modificados
- Sin cambios de lógica de negocio ni base de datos
- Compatible hacia atrás: si los campos premium vienen vacíos (plan público), simplemente no se muestran

