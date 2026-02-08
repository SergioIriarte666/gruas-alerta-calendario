
# Plan: Agregar Orden de Compra en Selector de Cierre

## Objetivo
Mostrar el número de Orden de Compra (OC) en el selector de cierre del formulario de facturas para identificar fácilmente qué cierre facturar.

## Análisis Actual

El selector ya muestra:
- Folio del cierre (CIE-293)
- Rango de fechas
- Cliente
- Monto total

El campo `purchaseOrder` **ya existe** en el tipo `ServiceClosure` y se mapea desde la base de datos, pero no se muestra en la UI.

## Cambios Propuestos

### Archivo: `src/components/invoices/EnhancedClosureSelector.tsx`

**1. Agregar icono para OC**
Importar el icono `ShoppingCart` de lucide-react (siguiendo el estilo visual del módulo de costos).

**2. Mostrar OC en el botón de selección (cuando hay cierre seleccionado)**
Agregar la OC en la línea de detalles junto a fecha, cliente y monto:
```
30/01/2026 - 30/01/2026 • Arrendadora S.A. • OC: 12345 • $80,000
```

**3. Mostrar OC en cada item del dropdown**
Agregar una fila nueva entre Cliente y Monto:
```
📄 CIE-293
📅 30/01/2026 - 30/01/2026
👤 Arrendadora S.A.
🛒 OC: 12345          <-- Nueva fila
💲 $80,000
```

Si no hay OC, mostrar "Sin OC" en gris para mantener consistencia visual.

**4. Actualizar la búsqueda**
Permitir buscar también por número de OC agregándolo al valor del `CommandItem`.

## Resultado Visual

| Campo | Antes | Después |
|-------|-------|---------|
| Botón | `30/01/2026 • Cliente • $80,000` | `30/01/2026 • Cliente • OC: 12345 • $80,000` |
| Dropdown | 4 filas | 5 filas (incluye OC) |
| Búsqueda | folio, cliente, fecha | folio, cliente, fecha, **OC** |
