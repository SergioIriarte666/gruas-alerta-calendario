
# Plan: Optimizacion Completa Mobile/Tablet - Todos los Modulos Pendientes

## Resumen

Auditoria completa de la aplicacion revela **14 componentes/paginas** que aun tienen problemas de visualizacion en movil y tablet. Los problemas principales son: tablas sin vista de tarjetas, headers con texto cortado, contenedores con padding fijo, selectores con ancho fijo, y la pagina de Perfil con colores hardcoded de tema oscuro.

---

## Modulos con Problemas Identificados

### 1. Ingresos (IncomesTable + IncomesHeader)
- **IncomesTable.tsx**: Tabla de 9 columnas sin mobile view. Se trunca completamente.
- **IncomesHeader.tsx**: Titulo `text-3xl` fijo, botones sin wrap, ancho fijo en toggle de vista.
- **Incomes.tsx (page)**: Container con `p-6` fijo sin ajuste mobile.

### 2. Proveedores (SupplierList + PaymentList)
- **SupplierList.tsx**: Tabla de 6 columnas sin mobile card view. Solo tiene `overflow-x-auto`.
- **PaymentList.tsx**: Tabla de 7 columnas sin mobile card view.

### 3. Comisiones (CommissionTable)
- **CommissionTable.tsx**: Tabla de 10 columnas sin mobile card view. Se renderiza dentro de Cards en Commissions.tsx que ya tienen algo de mobile handling pero la tabla interna sigue siendo una `<Table>` densa.

### 4. Proyeccion de Ingresos (IncomeProjections + PendingInvoicesTable)
- **IncomeProjections.tsx**: Header con `text-3xl` fijo, container `p-6` fijo, filtros no responsivos.
- **PendingInvoicesTable.tsx**: Tabla de 7 columnas sin mobile view.

### 5. Reportes (ReportsPage)
- **ReportsPage.tsx**: Los selectores del filter bar tienen ancho fijo (`w-[180px]`, `w-[220px]`, `w-[150px]`) que causan desbordamiento. La barra de tabs y filtros no tiene scroll horizontal.

### 6. Calendario (Calendar)
- **Calendar.tsx**: El `CardTitle` usa `text-white` hardcoded. El grid `lg:grid-cols-4` en pantallas medianas no tiene ajuste para tablet.

### 7. Perfil (Profile)
- **Profile.tsx**: Completamente estilizado con colores de tema oscuro hardcoded (`text-white`, `text-gray-400`, `bg-black/20`, `border-gray-800`, `bg-white/5`). No es responsivo en padding ni layout.

### 8. Reporte Diario (DailyReportPage)
- Necesita verificar tabs y contenido interno para mobile.

### 9. Entradas Rapidas (QuickEntries/PendingEntriesView)
- Container `py-6` fijo, contenido interno pendiente de revision.

---

## Cambios por Archivo

### A. `src/pages/Incomes.tsx`
- Agregar `useIsMobile`, ajustar padding `p-3` vs `p-6`

### B. `src/components/incomes/IncomesHeader.tsx`
- Titulo responsivo `text-xl`/`text-3xl`
- Botones con `flex-wrap`, labels condicionales en mobile
- Toggle de vista compacto

### C. `src/components/incomes/IncomesTable.tsx`
- Agregar `useIsMobile` y renderizar tarjetas en mobile
- Cada tarjeta: fecha, descripcion, categoria badge, cliente, monto, acciones

### D. `src/components/suppliers/SupplierList.tsx`
- Agregar `useIsMobile` y mobile card view
- Tarjetas con: nombre, RUT, contacto, categoria, estado, acciones

### E. `src/components/suppliers/PaymentList.tsx`
- Agregar `useIsMobile` y mobile card view
- Tarjetas con: proveedor, descripcion, monto, vencimiento, estado

### F. `src/components/commissions/CommissionTable.tsx`
- Agregar `useIsMobile` y mobile card view
- Tarjetas con: operador, folio, cliente, valor servicio, comision, estado

### G. `src/pages/IncomeProjections.tsx`
- Titulo responsivo, padding adaptativo
- Filtros en layout vertical en mobile

### H. `src/components/projections/PendingInvoicesTable.tsx`
- Mobile card view con: folio, cliente, vencimiento, monto, estado

### I. `src/components/reports/ReportsPage.tsx`
- Selectores con `w-full sm:w-[180px]` en vez de anchos fijos
- Filter bar con `overflow-x-auto` y `flex-wrap`
- Botones de exportar/actualizar compactos en mobile

### J. `src/pages/Calendar.tsx`
- Corregir `text-white` hardcoded a `text-foreground`
- Grid responsivo para tablet: `md:grid-cols-1 lg:grid-cols-4`

### K. `src/pages/Profile.tsx`
- Reemplazar todos los colores hardcoded de tema oscuro por tokens semanticos
- `text-white` -> `text-foreground`
- `text-gray-400` -> `text-muted-foreground`
- `bg-black/20` -> `bg-card`
- `border-gray-800` -> `border`
- `bg-white/5` -> `bg-background`
- Padding adaptativo
- Grid `md:grid-cols-3` -> `grid-cols-1 md:grid-cols-3` (ya esta, pero verificar)

### L. `src/pages/QuickEntries.tsx`
- Padding adaptativo en container

### M. `src/components/daily-report/DailyReportPage.tsx`
- Verificar y corregir tabs, botones y header para mobile

---

## Patron de Implementacion

Todos los cambios siguen el patron ya establecido en el proyecto (ejemplo del modulo de Costos):

```text
1. Importar useIsMobile
2. Detectar mobile: const isMobile = useIsMobile()
3. Condicional: if (isMobile) return <CardView /> else return <Table />
4. Tarjetas con: CardContent p-4, texto truncado, badges compactos
5. Headers: text-xl en mobile, text-3xl en desktop
6. Padding: p-3 en mobile, p-6 en desktop
7. Botones: size="sm", labels condicionales
```

---

## Secuencia de Implementacion

1. Pagina de Perfil (corregir colores hardcoded - rapido)
2. Calendario (fix `text-white`)
3. IncomesTable + IncomesHeader + Incomes page
4. SupplierList + PaymentList
5. CommissionTable
6. IncomeProjections + PendingInvoicesTable
7. ReportsPage (filter bar)
8. QuickEntries + DailyReport (ajustes menores)

---

## Detalles Tecnicos

- Se estima modificar **13-15 archivos**
- No se requieren nuevas dependencias
- Se reutiliza `useIsMobile` de `@/hooks/use-mobile`
- Se sigue el design system existente: violet-600, tokens semanticos, cards con `bg-card border`
- Las tarjetas mobile incluiran acciones con `DropdownMenu` o botones inline segun el patron de cada modulo
