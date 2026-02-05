# Fecha de Pago en Carga XML - COMPLETADO ✅

## Resumen de Cambios Implementados

### 1. XMLCostUpload.tsx (Costos)

**Nuevas funcionalidades:**
- RadioGroup para seleccionar modo de pago: "Pagado Inmediato", "A Crédito", o "Fecha Específica"
- Botones rápidos para días de crédito (30, 45, 60, 90) + input personalizado
- DatePicker para fecha de pago específica con botón "Aplicar a seleccionados"
- Nueva columna "F. Pago" editable en la tabla de previsualización
- Indicador ✓ verde cuando la fecha de pago es igual a la de emisión (pago inmediato)
- Badge "mod" para indicar fechas de pago personalizadas individualmente

**Estados agregados:**
```typescript
const [paymentDateMode, setPaymentDateMode] = useState<'immediate' | 'credit' | 'custom'>('immediate');
const [creditDays, setCreditDays] = useState<number>(30);
const [bulkPaymentDate, setBulkPaymentDate] = useState<string>('');
const [paymentDateOverrides, setPaymentDateOverrides] = useState<Record<number, string>>({});
```

### 2. XMLDocumentUpload.tsx (Proveedores)

**Nuevas funcionalidades:**
- RadioGroup para seleccionar tipo de pago: "A Crédito (Pendiente)" o "Contado / Ya Pagado"
- Si es Crédito: botones rápidos para días (30, 45, 60, 90) + input personalizado
- Si es Pagado: DatePicker para fecha de pago + botón "Aplicar a todos"
- Los documentos se importan con estado correcto y fecha de pago

**Estados agregados:**
```typescript
const [paymentType, setPaymentType] = useState<'credit' | 'paid'>('credit');
const [bulkPaidDate, setBulkPaidDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
```

## Uso

### Escenario 1: Cargar gastos ya pagados
1. Subir XML
2. Seleccionar "Pagado Inmediato" (por defecto) - usa misma fecha de emisión
3. O seleccionar "Fecha Específica" y elegir la fecha de pago
4. Cargar gastos

### Escenario 2: Cargar gastos a crédito
1. Subir XML
2. Seleccionar "A Crédito"
3. Elegir días (30, 45, 60, 90 o personalizado)
4. La fecha de pago se calcula automáticamente

### Escenario 3: Mezcla de fechas
1. Usar edición individual en la columna F.Pago para casos específicos
2. Los overrides individuales tienen prioridad sobre la configuración global
