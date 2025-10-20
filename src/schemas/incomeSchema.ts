import { z } from 'zod';

export const incomeSchema = z.object({
  income_date: z.string().min(1, 'La fecha es requerida'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres').max(500),
  category_id: z.string().min(1, 'La categoría es requerida'),
  subcategory: z.string().max(100).optional(),
  payment_method: z.enum([
    'transferencia',
    'efectivo',
    'cheque',
    'deposito',
    'tarjeta_credito',
    'tarjeta_debito',
    'otro'
  ]),
  bank_reference: z.string().max(100).optional(),
  client_id: z.string()
    .transform(val => val === 'none' ? undefined : val)
    .optional(),
  occasional_client_name: z.string()
    .max(200, 'El nombre no puede exceder 200 caracteres')
    .optional(),
  invoice_id: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
}).refine(data => {
  // Si hay occasional_client_name, client_id debe ser 'none' o undefined
  if (data.occasional_client_name && data.client_id && data.client_id !== 'none') {
    return false;
  }
  return true;
}, {
  message: "No puedes seleccionar un cliente registrado y un cliente ocasional al mismo tiempo",
  path: ["occasional_client_name"]
}).refine(data => {
  // invoice_id requiere client_id
  if (data.invoice_id && !data.client_id) {
    return false;
  }
  return true;
}, {
  message: "Debes seleccionar un cliente para asociar una factura",
  path: ["invoice_id"]
}).refine(data => {
  // invoice_id incompatible con occasional_client_name
  if (data.invoice_id && data.occasional_client_name) {
    return false;
  }
  return true;
}, {
  message: "No puedes asociar una factura a un cliente ocasional",
  path: ["invoice_id"]
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;
