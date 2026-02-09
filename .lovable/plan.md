

# Plan: Quitar "Ingresos" del módulo Finanzas en el Sidebar

## Cambio

Eliminar la entrada "Ingresos" (`/incomes`) del grupo Finanzas en el sidebar. La ruta y el módulo seguirán existiendo en el código pero no será accesible desde la navegación principal.

## Detalle Técnico

### Archivo: `src/components/layout/Sidebar.tsx`

Eliminar la línea 131:
```typescript
{ name: 'Ingresos', href: '/incomes', icon: DollarSign, adminOnly: false },
```

El grupo Finanzas quedará con:
- Costos
- Comisiones
- Cierres
- Facturas
- Proyección de Ingresos

No se eliminan componentes ni rutas para no romper nada; solo se oculta del menú.

