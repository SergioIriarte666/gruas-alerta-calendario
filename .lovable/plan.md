

# Aplicar filtro mensual a Sin OC y Sin Cotizacion (con logica de mes vencido)

## Contexto
Actualmente el filtro de "facturacion mensual" solo se aplica a "Pendientes de Facturar" y excluye **todos** los servicios de clientes mensuales sin importar la fecha. El usuario necesita:
1. Aplicar el mismo criterio a "Sin OC" y "Sin Cotizacion"
2. Solo ocultar servicios del **mes en curso** -- al pasar el ultimo dia del mes, los servicios deben reaparecer como pendientes

## Logica del filtro
Un servicio de cliente mensual se oculta solo si su `service_date` pertenece al mes actual. Servicios de meses anteriores siempre se muestran como pendientes.

```text
Ejemplo (hoy = 25 febrero 2026):
- Servicio del 10/02/2026, cliente mensual --> OCULTO (mes actual)
- Servicio del 15/01/2026, cliente mensual --> VISIBLE (mes anterior, ya vencio)
- Servicio del 10/02/2026, cliente standard --> VISIBLE (siempre)
```

## Archivos a modificar

### 1. `src/hooks/usePendingSummary.ts`
- Cambiar el filtro existente en "servicesWithoutOC" (linea 101): en vez de excluir todos los `billing_type === 'monthly'`, solo excluir si el servicio es del mes actual
- Aplicar la misma logica de filtro mensual a la seccion de pendientes de facturacion (consistencia)
- No aplica a Sin Cotizacion porque este hook no tiene esa seccion

### 2. `src/utils/pdf/pendingReportPDF.ts`
- Agregar `billing_type` al select de las queries de Sin OC (linea 78) y Sin Cotizacion (linea 84)
- Aplicar filtro de mes actual a las 3 secciones: Pendientes de Facturar, Sin OC, Sin Cotizacion
- Cambiar el filtro existente de facturacion para usar la misma logica de mes actual

### 3. `supabase/functions/send-daily-pending-report/index.ts`
- Agregar `billing_type` al select de las queries de Sin OC (linea 88) y Sin Cotizacion (linea 97)
- Aplicar filtro de mes actual a las 3 secciones
- Redesplegar la funcion

## Detalle tecnico

### Funcion auxiliar de filtro (se agrega en cada archivo)
```typescript
// Retorna true si el servicio debe ocultarse (cliente mensual + servicio del mes actual)
const isCurrentMonthMonthly = (service: any) => {
  if (service.client?.billing_type !== 'monthly') return false;
  const serviceDate = new Date(service.service_date);
  const today = new Date();
  return serviceDate.getFullYear() === today.getFullYear() 
      && serviceDate.getMonth() === today.getMonth();
};
```

Se usa como `.filter(s => !isCurrentMonthMonthly(s))` en las 3 secciones afectadas de cada archivo.

