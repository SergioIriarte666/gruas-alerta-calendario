
# Plan: Mejora estética de la UI de Bodega (sin tocar funcionalidad)

## Objetivo
Alinear visualmente la pagina de Bodega con el modulo de Costos: colores violet, filtros con chips, badges con alto contraste, tarjetas de stats con iconos coloridos, y tabs mas limpios.

## Cambios

### 1. Pagina principal `src/pages/Inventory.tsx`
- **Header**: Boton "Importar XML" con estilo `bg-violet-600 hover:bg-violet-700 text-white` (igual que Costos).
- **Stat Cards**: Agregar bordes laterales de color por tipo (violet para Total Productos, yellow para Stock Bajo, red para Sin Stock, violet para Valor Total). Iconos con fondos circulares coloreados en vez de iconos planos.
- **Tabs**: Estilizar TabsList con fondo sutil y TabsTrigger activo en violet (`data-[state=active]:bg-violet-600 data-[state=active]:text-white`). Reemplazar emojis por iconos Lucide (Package, ArrowUpDown, BarChart3).
- **Valor Total**: Mostrar en `text-violet-600 font-bold` en vez de negro (patron de accesibilidad del proyecto).

### 2. Stock View `src/components/inventory/InventoryStockView.tsx`
- **Botones de accion**: "Nueva Entrada" en `bg-violet-600`, "Nueva Salida" mantiene destructive.
- **Barra de busqueda**: Agregar `focus:ring-2 focus:ring-violet-500` al input (igual que Costos).
- **Filtros**: Convertir botones "Ocultar sin stock" y "Vista Tabla/Tarjetas" en chips con estilo violet cuando estan activos (`bg-violet-600 text-white`).
- **Panel Movimiento rapido**: Borde izquierdo violet (`border-l-4 border-violet-500`) y fondo mas limpio.
- **Tabla de productos**: Usar componente `Table` de shadcn en vez de `<table>` nativo. Badges de estado con colores de alto contraste: "Sin Stock" rojo, "Stock Bajo" amarillo, "Normal" violet.
- **Contador**: "Mostrando X de Y" con badge violet.

### 3. Movimientos `src/components/inventory/MovementsHistoryTable.tsx`
- **Badges de tipo**: Entrada en `bg-violet-100 text-violet-700` (no verde), Salida en `bg-red-100 text-red-700`.
- **Cantidades**: Entradas en `text-violet-600 font-bold`, Salidas en `text-red-600 font-bold` (reemplazar verde por violet).
- **Costos**: Mismo patron violet/rojo.
- **Input de busqueda**: `focus:ring-violet-500`.
- **Boton Exportar**: Estilo outline con acento violet.

### Archivos a modificar
- `src/pages/Inventory.tsx` (header, stats, tabs)
- `src/components/inventory/InventoryStockView.tsx` (botones, filtros, tabla)
- `src/components/inventory/MovementsHistoryTable.tsx` (badges, colores)

### Lo que NO se toca
- Logica de importacion XML
- Hooks de datos (useInventory*)
- Sincronizacion con costos/proveedores/gruas
- Formularios de entrada/salida
- Modales existentes
