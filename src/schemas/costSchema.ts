
import * as z from 'zod';

export const costSchema = z.object({
    date: z.string().nonempty('La fecha es requerida'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    amount: z.coerce.number().positive('El monto debe ser un número positivo'),
    category_id: z.string().nonempty('La categoría es requerida'),
    crane_id: z.string().optional().nullable().transform(val => (val === 'none' || !val) ? null : val),
    operator_id: z.string().optional().nullable().transform(val => (val === 'none' || !val) ? null : val),
    service_id: z.string().optional().nullable().transform(val => (val === 'none' || !val) ? null : val),
    notes: z.string().optional().nullable(),
});

export type CostFormValues = z.infer<typeof costSchema>;
