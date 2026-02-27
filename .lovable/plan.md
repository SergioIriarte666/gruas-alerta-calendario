
# Plan: Ampliar Autocompletado Inteligente a Todos los Campos de Texto Relevantes

## Problema Actual

El autocompletado solo funciona en 3 lugares:
- **Ubicaciones** (origen/destino) en servicios -- `LocationCombobox`
- **Nombre asegurado** en servicios -- `InsuredNameCombobox`
- **Descripcion/proveedor/pieza/subcategoria** en costos -- `CostCombobox`

Hay muchos otros campos de texto libre que se beneficiarían del autocompletado pero usan `<Input>` plano sin sugerencias.

## Bug Detectado en InsuredNameCombobox

El componente actual busca solo entre los nombres ya frecuentes (top 10). Si el nombre no esta en ese top, no aparece como sugerencia aunque exista en servicios anteriores. Esto se corregira para buscar en **todos** los nombres, no solo los top 10.

## Campos que Recibirán Autocompletado

### Modulo Servicios (formulario)
1. **Descripcion de costo** (`ServiceCostDetailsSection.tsx`) -- campo "Descripcion" de detalle de costos del servicio
2. **Observaciones** (`ObservationsSection.tsx`) -- sugerencias de observaciones frecuentes

### Modulo Proveedores
3. **Descripcion del pago** (`PaymentForm.tsx`) -- campo "Descripcion del pago o servicio"
4. **Nombre de pieza** (`PaymentForm.tsx`) -- campo "Nombre de la Pieza"
5. **Referencia bancaria** (`RegisterPaymentModal.tsx`) -- campo "Referencia Bancaria"

### Modulo Quick Entry
6. **Descripcion** (`QuickEntryForm.tsx`) -- campo "Descripcion" de entrada rapida

## Enfoque Tecnico

### 1. Crear hook generico `useFrequentValues`
Un hook reutilizable que recibe un array de datos y un campo, y devuelve valores frecuentes + funcion de busqueda. Esto evita crear un hook por cada campo.

### 2. Crear componente generico `AutocompleteInput`
Un componente combobox reutilizable (basado en el patron de `CostCombobox`) que se pueda usar en cualquier formulario. Recibirá:
- `value` / `onValueChange`
- `suggestions` (array de `{value, count}`)
- `placeholder`
- Compatible con `react-hook-form` via `register` o `Controller`

### 3. Corregir InsuredNameCombobox
- Ampliar la busqueda para que `searchInsuredNames` busque en **todos** los servicios, no solo en el top 10 frecuentes.

### 4. Crear hooks de datos frecuentes para proveedores
- `useFrequentSupplierData` -- extrae descripciones, nombres de piezas y referencias frecuentes de `supplier_payments`.

### 5. Integrar AutocompleteInput en cada campo identificado
Reemplazar los `<Input>` planos por `<AutocompleteInput>` en los 6 campos listados.

## Secuencia de Implementacion

1. Crear `AutocompleteInput` generico (componente reutilizable)
2. Crear `useFrequentValues` (hook generico)
3. Corregir `useFrequentInsuredNames` (buscar en todos, no solo top 10)
4. Crear `useFrequentSupplierData` (hook para datos de proveedores)
5. Integrar autocompletado en `ServiceCostDetailsSection` (descripcion de costos)
6. Integrar autocompletado en `PaymentForm` (descripcion + pieza)
7. Integrar autocompletado en `QuickEntryForm` (descripcion)
