# incomes

## Resumen
Modulo de **ingresos** para registrar cobros, asociarlos a clientes y facturas, y exportar informacion financiera.

La implementacion actual combina tabla, formulario, exportacion y una vista tipo pipeline agrupada por cliente.

## Entrypoints vigentes
- Pagina: [Incomes](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/Incomes.tsx)
- Componentes: [src/components/incomes](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/incomes)
- Exportador: [incomeReportExporter](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/utils/reports/incomeReportExporter.ts)

## Ruta
- `/incomes`

## Arquitectura actual
La pagina principal se apoya en:
- `IncomesTable`
- `IncomeForm`
- `IncomesPipelineView`
- exportacion PDF y Excel
- consulta de `company_data` para reportes

## Hooks y servicios clave
- `useIncomes`
- `useIncomeCategories`

Notas:
- `useIncomeSubcategories` y `useIncomeCategoryManager` no son hooks del flujo operativo principal de la pagina.
- `subcategory` hoy se maneja como texto libre en el formulario operativo.

## Datos y dependencias principales
- `incomes`
- `income_categories`
- `clients`
- `invoices`
- `payments`
- `company_data`

## Flujos vigentes
### 1. Registro de ingreso
- El formulario permite asociar cliente y factura.
- Si corresponde, crea pago manualmente en `payments` y luego aplica `apply_payment_manual`.

### 2. Edicion
- La asociacion a factura y creacion de pago ocurre en el flujo de alta, no como comportamiento general de edicion.

### 3. Pipeline
- La vista pipeline actual agrupa por cliente y resume montos o categorias.
- No debe documentarse como pipeline de estados de negocio.

### 4. Exportacion
- La pagina usa `company_data` y exportadores especificos para PDF y Excel.

## Consideraciones de mantenimiento
- No documentar `create_payment_from_existing_income` como flujo vigente si no esta cableado en la pagina.
- Aclarar que la subcategoria operativa actual es texto libre.
