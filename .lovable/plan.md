

# Facturacion Mensual - Excluir Clientes del Reporte de Pendientes

## Problema
Algunos clientes se facturan una vez al mes (mes vencido), por lo que sus servicios completados siempre aparecen como "pendientes de facturar" en el resumen y reportes, generando ruido innecesario.

## Solucion
Agregar un campo `billing_type` a la tabla `clients` que permita marcar si un cliente tiene facturacion mensual. Los servicios de estos clientes se excluiran automaticamente de las listas de "pendientes de facturar" en todos los puntos del sistema.

## Cambios

### 1. Base de datos
- Agregar columna `billing_type` (text, default `'standard'`) a la tabla `clients`
- Valores posibles: `'standard'` (facturacion por servicio) y `'monthly'` (facturacion mensual vencida)

### 2. Tipo TypeScript
- Agregar `billingType?: 'standard' | 'monthly'` a la interfaz `Client` en `src/types/index.ts`

### 3. Ficha del Cliente - `ClientGeneralInfo.tsx`
- Agregar un toggle/selector visible en la informacion general del cliente con etiqueta "Facturacion Mensual"
- Cuando se activa, se guarda `billing_type = 'monthly'` en la base de datos
- Seguir el patron visual del modulo de Costos (badges, toggles)

### 4. Formulario de Cliente
- Agregar la opcion de facturacion mensual en el formulario de creacion/edicion de cliente (Step 3 o seccion de configuracion)

### 5. Filtrado en Pendientes
Excluir servicios de clientes con `billing_type = 'monthly'` en:
- `src/hooks/usePendingSummary.ts` - Seccion "servicesWithoutOC" y logica de pendientes de facturacion
- `src/utils/pdf/pendingReportPDF.ts` - Seccion "Servicios Pendientes de Facturar" del PDF manual
- `supabase/functions/send-daily-pending-report/index.ts` - Seccion equivalente del reporte por email

### 6. Indicador visual en tabla de clientes
- Mostrar un badge pequeno "Mensual" junto al nombre del cliente en `ClientsTable.tsx` cuando tenga facturacion mensual, para que sea facilmente identificable

## Detalle Tecnico

### Migracion SQL
```sql
ALTER TABLE clients ADD COLUMN billing_type text NOT NULL DEFAULT 'standard';
```

### Filtrado en queries
En cada consulta de servicios pendientes de facturar, se hara un JOIN con `clients` y se agregara la condicion `clients.billing_type != 'monthly'` (o se filtrara en el cliente despues del fetch, ya que la relacion ya existe en las queries).

### Hook useClients
Mapear el nuevo campo `billing_type` desde la base de datos al tipo `Client`.

