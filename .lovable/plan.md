

# Optimizacion Integral de Vistas Moviles - Fase 1

## Problemas Identificados (desde las capturas de pantalla)

Los screenshots muestran claramente estos problemas:

1. **Servicios (IMG_2310)**: El header "Gestion de Servicios" ocupa demasiado espacio vertical. El titulo es enorme (text-3xl), los botones Tabla/Pipeline flotan desalineados, y las metricas se apilan en tarjetas individuales enormes que requieren mucho scroll.

2. **Facturas (IMG_2311)**: La tabla completa con 7 columnas (Folio, N Fiscal, Cliente, Fecha Emision, Fecha Vencimiento, Dias para Vencimiento, Total) se muestra en pantalla pequena, causando texto cortado y columnas comprimidas. Los tabs de estado (Todas, Borrador, Enviada, etc.) no tienen scroll horizontal. Las stat cards se apilan verticalmente ocupando mucho espacio.

3. **Dashboard (IMG_2309)**: La tabla "Servicios Recientes" muestra columnas que se cortan (Vehiculo truncado "Toyota Hilux VCLL-2..."), ocupando demasiado espacio vertical por fila.

## Solucion Propuesta

Implementar deteccion de dispositivo (`useDeviceType`) en las paginas criticas y reemplazar tablas por vistas de tarjetas compactas en movil, siguiendo el patron ya establecido en `ServicesMobileView`, `ClientsMobileView` y `CranesMobileView`.

---

### Cambio 1: Servicios - Header compacto en movil
**Archivo:** `src/components/services/ServicesHeader.tsx`

- Reducir titulo de `text-3xl` a `text-xl` en movil
- Apilar botones verticalmente, mostrar solo iconos en los secundarios
- Reducir padding de `p-6` a `p-3` en movil
- Metricas: grid `grid-cols-2` en movil en vez de `lg:grid-cols-4`

### Cambio 2: Facturas - Vista de tarjetas movil
**Archivos:** `src/pages/Invoices.tsx`, nuevo `src/components/invoices/InvoicesMobileView.tsx`

- Crear `InvoicesMobileView.tsx` siguiendo el patron de `ServicesMobileView`
- Cada tarjeta mostrara: Folio, Cliente, Monto, Estado, Dias para vencimiento, y botones de accion
- En `Invoices.tsx`: detectar `isMobile` y renderizar `InvoicesMobileView` en vez de `InvoicesTable`
- Tabs de estado: agregar `overflow-x-auto` y `whitespace-nowrap` para scroll horizontal
- Stats cards: cambiar grid a `grid-cols-2` en movil

### Cambio 3: Dashboard - Tabla de servicios recientes adaptada
**Archivo:** `src/components/dashboard/RecentServicesTable.tsx`

- Detectar `isMobile` con `useIsMobile()`
- En movil: reemplazar la tabla por tarjetas compactas mostrando Folio, Fecha, Cliente, Valor y Estado
- Ocultar columna Vehiculo en movil (informacion secundaria)

### Cambio 4: Facturas Stats compactas
**Archivo:** `src/components/invoices/InvoicesStats.tsx`

- Cambiar grid de `grid-cols-1 md:grid-cols-4` a `grid-cols-2 md:grid-cols-4`
- Reducir padding interno de las tarjetas en movil

### Cambio 5: Facturas filtros de estado scrollables
**Archivo:** `src/pages/Invoices.tsx` (seccion de filtros de estado)

- Envolver los botones de filtro en `overflow-x-auto` con `flex-nowrap`
- Asegurar que no se rompan en multiples lineas desordenadas

### Cambio 6: Cierres - Usar vista movil existente
**Archivo:** `src/pages/Closures.tsx`

- Verificar que la pagina de Closures ya detecta `isMobile` y usa `ClosuresMobileView` (ya existe el componente)
- Si no lo hace, agregar la deteccion y switch como en Services

---

## Detalle Tecnico

### Patron a seguir (ya establecido en el proyecto):

```text
// En la pagina principal:
import { useIsMobile } from '@/hooks/use-mobile';
const isMobile = useIsMobile();

// Render condicional:
{isMobile ? (
  <ModuleMobileView ... />
) : (
  <ModuleTable ... />
)}
```

### Archivos a crear:
| Archivo | Proposito |
|---------|-----------|
| `src/components/invoices/InvoicesMobileView.tsx` | Vista de tarjetas para facturas en movil |

### Archivos a modificar:
| Archivo | Cambio principal |
|---------|-----------------|
| `src/components/services/ServicesHeader.tsx` | Header compacto, titulo reducido, botones apilados |
| `src/pages/Invoices.tsx` | Deteccion movil, filtros scrollables, render condicional |
| `src/components/invoices/InvoicesStats.tsx` | Grid 2 columnas en movil |
| `src/components/dashboard/RecentServicesTable.tsx` | Tarjetas en movil en vez de tabla |
| `src/pages/Closures.tsx` | Verificar/agregar switch a vista movil |

### Estimacion: 6 archivos modificados/creados. Impacto inmediato en las 4 pantallas mas usadas del sistema.

