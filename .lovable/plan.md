

# Plan: Corregir Fecha de Pago en Importador XML de Costos

## Problema
Cuando se importa un XML con condición de crédito (pago a futuro), el sistema **siempre** asigna un `payment_date` al costo — incluso cuando la fecha es futura. Esto causa:
1. El trigger `create_supplier_payment_from_cost` marca el pago como `status: 'paid'` (porque `payment_date IS NOT NULL`), cuando debería ser `pending`
2. El costo aparece como "programado" en la tabla, pero en proveedores aparece como "pagado"

Además, el importador **no aprovecha** la fecha de vencimiento (`FchVenc`) ni la forma de pago (`FmaPago`) que vienen en el XML del SII.

## Cambios

### 1. Modificar `src/components/costs/XMLCostUpload.tsx` — Lógica de payment_date
En la función de upload (línea ~719), cambiar la lógica para que:
- **Condición "Contado"** (`none`): `payment_date = emissionDate` (pagado al contado)
- **Condición "Crédito"** (fecha futura): `payment_date = null` (no está pagado aún)

Esto respeta la semántica: `payment_date` = "fecha en que se pagó", no "fecha en que se debería pagar".

### 2. Modificar `src/utils/xmlParser/xmlSupplierParser.ts` — Extraer FmaPago y FchVenc
Agregar extracción del campo `FmaPago` del XML del SII:
- `FmaPago = 1` → Contado
- `FmaPago = 2` → Crédito
- `FmaPago = 3` → Sin costo

Mapear `payment_terms` en el resultado del parser para que el importador pueda auto-detectar si es crédito.

### 3. Modificar `src/components/costs/XMLCostUpload.tsx` — Auto-detectar condición desde XML
Cuando el XML trae `FmaPago = 2` (crédito) y tiene `FchVenc`, auto-configurar:
- Condición del proveedor: `'credit'`
- Fecha de vencimiento: `FchVenc` del XML
- `payment_date` del costo: `null` (pendiente)

Cuando `FmaPago = 1` (contado):
- `payment_date = emissionDate` (pagado inmediatamente)

### 4. Migración SQL — Ajustar trigger para pagos futuros
Modificar `create_supplier_payment_from_cost` para que cuando `payment_date` sea `null`, cree el pago como `pending` con `due_date` tomado de un campo adicional o calculado:

```sql
effective_status := CASE 
  WHEN NEW.payment_date IS NOT NULL THEN 'paid' 
  ELSE 'pending' 
END;
```
Esta lógica ya existe y es correcta — el problema es que el importador siempre envía `payment_date` con valor.

## Archivos a modificar
- `src/utils/xmlParser/xmlSupplierParser.ts` — extraer `FmaPago`
- `src/components/costs/XMLCostUpload.tsx` — lógica de payment_date y auto-detección
- Migración SQL (opcional) — si se necesita un campo `due_date` en costs

## Resultado esperado
- Crédito → costo con `payment_date = null`, pago de proveedor `status: 'pending'`, icono rojo (pendiente)
- Contado → costo con `payment_date = fecha emisión`, pago `status: 'paid'`, icono verde

