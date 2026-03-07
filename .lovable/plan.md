

## Plan: Sub-agrupar por departamento dentro de cada cliente

### Situación actual
La jerarquía actual es: **Cliente (RUT) → Mes → Facturas**. Los departamentos solo se listan como texto en el header del cliente.

### Cambio propuesto
Nueva jerarquía: **Cliente (RUT) → Departamento → Mes → Facturas**

Solo se agrega el nivel de departamento si el cliente tiene más de un departamento. Si tiene uno solo (o "General"), se mantiene la estructura actual sin nivel extra.

### Cambios en `HistoricalSalesPipelineView.tsx`

1. **Nueva interfaz `DepartmentGroup`**: contiene `department`, `invoices`, `totalAmount`, `count`, y `months: MonthGroup[]`.

2. **Modificar `ClientGroup`**: agregar campo `departmentGroups: DepartmentGroup[]` y un flag `hasMultipleDepartments`.

3. **Lógica de agrupación**: dentro de cada `ClientGroup`, sub-agrupar facturas por `inv.client?.department`. Luego, dentro de cada departamento, sub-agrupar por mes (mismo patrón actual).

4. **Renderizado condicional**:
   - Si `hasMultipleDepartments`: Cliente → Departamento (collapsible con icono `Building2`) → Mes → Facturas
   - Si no: Cliente → Mes → Facturas (como actualmente)

5. **Estado de expansión**: nuevo `expandedDepartments` Set para controlar los collapsibles de departamento. Se integra con expandAll/collapseAll.

6. **UI del departamento**: usar `DepartmentBadge` existente o un estilo similar con icono `Building2`, mostrando nombre del departamento, cantidad de facturas y total.

### Estructura visual

```text
▼ Arrendadora (76.xxx.xxx-x)          $15.000.000 · 3 departamentos
  ▼ Sucursal Norte                     $8.000.000 (12)
    ▼ marzo 2026                       $3.000.000 (4)
      [tarjeta] [tarjeta] [tarjeta] [tarjeta]
    ▶ febrero 2026                     $5.000.000 (8)
  ▶ Sucursal Sur                       $4.000.000 (6)
  ▶ General                            $3.000.000 (5)
```

### Archivo a modificar
- `src/components/finance/historical/HistoricalSalesPipelineView.tsx`

