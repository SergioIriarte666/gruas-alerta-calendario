

## Diagnóstico

### Problema 1: Proveedores — Botón "Actualizar" deshabilitado
En `SupplierForm.tsx`, la validación del paso 2 (`validateStep(2)`) exige que **teléfono, dirección y nombre de contacto** sean obligatorios:
```typescript
// Línea 107
return formValues.phone?.trim() !== '' && formValues.address?.trim() !== '' && formValues.contact_name?.trim() !== '';
```
Pero el esquema Zod define estos campos como **opcionales**. Para proveedores importados con solo nombre+RUT, el botón de guardar queda permanentemente deshabilitado porque `canSubmit` requiere `validateStep(2) === true`.

### Problema 2: Clientes — Dialog se cierra antes de confirmar
En `Clients.tsx`, `handleUpdateClient` cierra el diálogo y muestra toast de éxito **inmediatamente** (líneas 172-174), sin esperar a que la mutación termine. Si la mutación falla (por ejemplo, por RLS), el usuario ve "Cliente actualizado" pero los datos no se guardan realmente.

---

## Plan de corrección

### 1. `src/components/suppliers/SupplierForm.tsx`
- Cambiar `validateStep(2)` para retornar `true` (campos opcionales), consistente con el esquema Zod y los requisitos mínimos del proveedor.

### 2. `src/pages/Clients.tsx`
- Usar `await` en la llamada a `updateClient` y mover `setIsDialogOpen(false)` + `setSelectedClient(undefined)` + toast al bloque de éxito confirmado.
- Agregar `try/catch` para mostrar error si la mutación falla, en lugar de mostrar éxito prematuro.

### 3. `src/hooks/useClients.ts`
- Eliminar el toast duplicado del `onSuccess` de `updateClientMutation` (ya que el componente lo maneja).

