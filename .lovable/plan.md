

# Plan: Limpiar nombres basura + eliminar registros de prueba

## Resumen
Dos acciones: (1) renombrar 5 productos con nombres tipo "Compra de inventario:..." a nombres limpios, y (2) eliminar completamente los 3 registros basura (OIFLEX, TEST CONS, TEST ANTIDUP) junto con sus movimientos y stock asociados.

## Verificación de dependencias
- Los 3 registros a eliminar tienen stock = 0
- TEST CONS y TEST ANTIDUP solo tienen movimientos `cancelled`
- OIFLEX tiene 1 entry + 1 exit (saldo 0)
- Ninguno tiene referencias en `crane_parts` ni `cost_inventory_items`

## Cambios (solo datos, sin cambios de código)

### 1. Renombrar 5 productos con nombres sucios

| ID | Nombre actual | Nombre nuevo |
|---|---|---|
| a2604e0f... | Compra de inventario: Aceite Hidráulico (19 unidades a $2,736 c/u) | Aceite Hidráulico |
| 235d4cd8... | Compra de inventario: Ampolleta 12V H7 (2 unidades a $5,290 c/u) | Ampolleta 12V H7 |
| 6bd1cc96... | Compra de inventario: Botella de Levante (1 unidades a $600,000 c/u) | Botella de Levante |
| 84638536... | Compra de inventario: Mangueras y Adaptadores (1 unidades a $52,333 c/u) | Mangueras y Adaptadores |
| 9d07a97e... | Compra de inventario: Neumáticos 265/65/R17 (4 unidades a $25,000 c/u) | Neumáticos 265/65/R17 |

### 2. Eliminar 3 registros basura (en orden por dependencias)

Para cada uno de estos IDs: `325de5a8...`, `fc4d6784...`, `f6a0c5c1...`:

1. DELETE de `inventory_movements` donde `item_id = X`
2. DELETE de `inventory_stock` donde `item_id = X`
3. DELETE de `inventory_items` donde `id = X`

## Archivos a modificar
Ninguno. Solo operaciones de datos via migración SQL.

