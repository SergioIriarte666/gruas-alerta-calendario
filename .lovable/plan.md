

# Plan: Hacer "Descripción de Producto o Servicio" Opcional en Facturas

## Resumen
Eliminar la obligatoriedad del campo en el formulario de facturas y en la lógica de guardado/actualización. Si se llena, máximo 500 caracteres. Si queda vacío, se guarda vacío.

## Cambios

### 1. `src/components/invoices/form/InvoiceFormStep1.tsx`
- Quitar `required` del `ColoredSectionCard`
- Cambiar texto de ayuda de "Obligatorio. Entre 10 y 500 caracteres." a "Opcional. Máximo 500 caracteres."

### 2. `src/hooks/invoices/useInvoiceOperations.ts`
- **Creación (~líneas 61-64)**: Eliminar validación de mínimo 10 caracteres. Solo validar máximo 500 si tiene contenido.
- **Actualización (~líneas 291-296)**: Misma lógica — solo validar máximo 500 si hay texto.

### 3. `src/utils/validationUtils.ts`
- `getProductServiceDescriptionError`: Quitar chequeo de mínimo 10. Solo validar max 500 si hay texto.
- `normalizeProductServiceDescription`: Si está vacío, retornar string vacío en vez de "Descripción no registrada".

### 4. `src/components/finance/historical/EditHistoricalInvoiceModal.tsx`
- Quitar validación de mínimo 10 caracteres (~línea 114).

## Sin riesgo funcional
Solo se relaja la validación del campo. No hay cambios en base de datos ni en lógica de negocio.

