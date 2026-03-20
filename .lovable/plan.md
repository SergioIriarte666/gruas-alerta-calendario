

## Plan: Módulo de Cuentas por Pagar (Deudas y Cuotas)

### Contexto

Las tablas ya existen en la base de datos (`debts`, `debt_installments`, `debt_payments`, `creditors`) pero **no hay ninguna UI construida** para ellas. Este plan crea el módulo completo desde cero.

### Arquitectura

```text
/accounts-payable (nueva ruta en sidebar)
├── Dashboard KPIs (total deuda, cuotas del mes, vencidas, pagado)
├── Tab: Deudas (listado de deudas activas con progreso)
├── Tab: Cuotas del Mes (vista mensual de cuotas pendientes)
├── Tab: Calendario (vencimientos en vista calendario)
└── Modales:
    ├── Crear/Editar Deuda (acreedor, monto, cuotas, frecuencia, interés)
    ├── Crear/Editar Acreedor
    └── Registrar Pago de Cuota → crea costo automáticamente
```

### Flujo principal

1. **Crear Acreedor** (SII, banco, leasing, etc.) — se guarda en `creditors`, opcionalmente vinculado a un `inventory_supplier`
2. **Crear Deuda** — se define monto total, cantidad de cuotas, frecuencia, fecha primera cuota, interés opcional. Se generan automáticamente los registros en `debt_installments`
3. **Vista mensual** — muestra todas las cuotas del mes actual con montos y estados
4. **Registrar pago de cuota** — marca la cuota como pagada, crea registro en `debt_payments`, y **crea un costo** en la tabla `costs` con la categoría correspondiente y `payment_date` establecida

### Archivos a crear

| Archivo | Propósito |
|---------|-----------|
| `src/pages/AccountsPayable.tsx` | Página principal con tabs y KPIs |
| `src/hooks/useDebts.ts` | CRUD de deudas con cuotas |
| `src/hooks/useCreditors.ts` | CRUD de acreedores |
| `src/hooks/useDebtInstallments.ts` | Consulta y pago de cuotas |
| `src/components/accounts-payable/APDashboardCards.tsx` | KPIs: total deuda, cuotas mes, vencidas |
| `src/components/accounts-payable/DebtList.tsx` | Tabla de deudas con barra de progreso |
| `src/components/accounts-payable/MonthlyInstallments.tsx` | Cuotas del mes con acciones de pago |
| `src/components/accounts-payable/DebtForm.tsx` | Modal crear/editar deuda + generar cuotas |
| `src/components/accounts-payable/CreditorForm.tsx` | Modal crear/editar acreedor |
| `src/components/accounts-payable/PayInstallmentModal.tsx` | Registrar pago → crear costo |
| `src/components/accounts-payable/DebtCalendar.tsx` | Calendario de vencimientos |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/constants/modules.ts` | Agregar módulo `accounts-payable` |
| `src/App.tsx` | Agregar ruta `/accounts-payable` |
| Sidebar/navegación | Agregar link al nuevo módulo |

### Sincronización con Costos

Al registrar el pago de una cuota:
1. Se actualiza `debt_installments.status = 'paid'`, `paid_date`, `paid_amount`
2. Se inserta en `debt_payments` el registro del pago
3. Se crea un **costo** en `costs` con:
   - `description`: "Cuota N de [descripción deuda] - [acreedor]"
   - `amount`: monto de la cuota
   - `date`: fecha del pago
   - `payment_date`: fecha del pago (marcado como pagado)
   - `category_id`: categoría "Deudas y Obligaciones" (se busca o crea)

### Migración de datos

- Crear categoría de costos "Deudas y Obligaciones" si no existe
- No se requieren cambios de schema — todas las tablas ya existen

### KPIs del Dashboard

- **Deuda Total Vigente**: suma de cuotas pendientes de todas las deudas activas
- **Cuotas este Mes**: cantidad y monto de cuotas con vencimiento en el mes actual
- **Vencidas**: cuotas con `due_date < hoy` y `status = 'pending'`
- **Pagado este Mes**: cuotas pagadas en el mes actual

