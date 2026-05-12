# accounts-payable

## Resumen
Modulo de **cuentas por pagar** para administrar acreedores, deudas, cuotas, pagos y calendario financiero.

La implementacion actual incluye dashboard cards, tabs operativas y una integracion importante con `costs`: pagar cuotas o registrar ciertos pies genera costos automaticamente.

## Entrypoints vigentes
- Pagina: [AccountsPayable](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/AccountsPayable.tsx)
- Componentes: [src/components/accounts-payable](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/accounts-payable)

## Ruta
- `/accounts-payable`

## Arquitectura actual de la pagina
La pagina principal organiza la experiencia mediante:

- `APDashboardCards`
- tabs para cuotas del mes, deudas, calendario y acreedores
- `DebtList`
- `DebtForm`
- `DebtDetailModal`
- `MonthlyInstallments`
- `PayInstallmentModal`
- `CreditorList`
- `CreditorForm`
- `DebtCalendar`

## Hooks y servicios clave
- `useDebtsWithProgress`
- `useMonthlyInstallments`
- `usePayInstallment`
- `useCreditors`
- `useCreditorTypes`
- `useDebts`
- `useDebtInstallments`
- `useCostCategories`
- `useCostSubcategories`

Nota:
- `usePendingPayments` no corresponde al flujo principal de cuentas por pagar; pertenece al dominio de proveedores.

## Datos y dependencias principales
Tablas y relaciones frecuentes:

- `creditors`
- `debts`
- `debt_installments`
- `debt_payments`
- `costs`

Dependencias contables u operativas frecuentes:

- categorias y subcategorias de costo
- centro de costo, grua u operador cuando aplica al registrar pagos

## Flujos vigentes

### 1. Acreedores y deudas
- Se pueden crear acreedores y registrar deudas estructuradas.
- La gestion actual contempla metadata contable y tipos dinamicos de acreedor.

### 2. Cuotas del mes y calendario
- La pagina separa claramente cuotas proximas o del mes del listado general de deudas.
- El calendario complementa la vista tabular.

### 3. Pago de cuotas
- Pagar una cuota no solo actualiza estado.
- Tambien crea registro en `debt_payments` y un costo en `costs`.

### 4. Pie pagado y costos automaticos
- Al crear ciertas deudas con pie pagado tambien se puede generar costo automaticamente.

### 5. Soporte UF y herencia contable
- El flujo actual contempla pagos en UF.
- Puede heredar informacion contable u operativa como categoria, subcategoria, grua u operador al registrar el pago.

## Consideraciones de mantenimiento
- Si un cambio toca pagos de cuotas, revisar siempre la creacion automatica de costos.
- No documentar `scheduled_payments` como base del flujo actual sin confirmar su uso real en la pagina.
- Mantener separada la documentacion de AP respecto al dominio de proveedores, aunque ambos toquen pagos.
