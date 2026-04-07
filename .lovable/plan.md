

# Plan: Reordenar pestañas en Gestión de Proveedores

## Cambio

En `src/pages/Suppliers.tsx`:

1. Cambiar el estado inicial de `activeTab` de `'suppliers'` a `'payments'` (línea 17), para que Pagos sea la primera vista al entrar.

2. Reordenar los `CustomTabsTrigger` (líneas 150-161) y los `CustomTabsContent` (líneas 164-174) en este orden:
   - **Pagos** → **Proveedores** → **Calendario**

## Archivo a modificar
- `src/pages/Suppliers.tsx` — solo reordenar elementos, sin cambios de lógica.

