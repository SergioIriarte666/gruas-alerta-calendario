

# Plan: Generar SKUs para productos sin código

## Análisis

De los 45 items sin SKU, hay tres grupos:

1. **Productos legítimos** (~30): Aceite Hidráulico, Cables 3/8, Neumáticos, etc.
2. **Nombres basura** (~10): Items con nombres tipo "Compra de inventario: Aceite Hidráulico (19 unidades a $2,736 c/u)" o "Factura Electrónica N° 3720 - OIFLEX SPA" — estos NO son nombres de producto reales.
3. **Duplicados evidentes**: "Aceite Hidraulico" vs "Aceite Hidráulico", "Manguera Hidraulica" vs "Mangueras Hidráulicas", "Terminal de Bateria" vs "Terminal de Baterias", etc.

## Formato de SKU propuesto

Patrón: `CAT-NOMBRE-NNN`

Ejemplos:
- Aceite Hidráulico → `ACE-HID-001`
- Cable 3/8 → `CAB-3/8-001`
- Neumáticos 265/65/R17 → `NEU-265R17-001`
- Filtro de Aceite → `FIL-ACE-001`
- Manguera Hidráulica → `MAN-HID-001`
- Parabrisas → `PAR-BRI-001`
- Botella de Levante → `BOT-LEV-001`

## Acciones

### 1. Generar SKUs via UPDATE (usando insert tool)
- Asignar SKU a cada uno de los 45 items basándose en su nombre.
- Para los items con nombres tipo "Compra de inventario:..." se generará un SKU basado en el producto real mencionado dentro del nombre.
- Para duplicados, se usará sufijo incremental (-001, -002).

### 2. Sin cambios de esquema
Solo es un UPDATE de datos existentes, no se modifica estructura.

## Archivos a modificar
- Ninguno. Solo operación de base de datos.

