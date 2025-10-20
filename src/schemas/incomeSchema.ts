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
  notes: z.string().max(1000).optional(),
});

export type IncomeFormValues = z.infer<typeof incomeSchema>;
