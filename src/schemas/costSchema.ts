
import * as z from 'zod';

export const costSchema = z.object({
    date: z.string().nonempty('La fecha es requerida'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    amount: z.coerce.number().positive('El monto debe ser un número positivo'),
    category_id: z.string().nonempty('La categoría es requerida'),
    
    crane_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().uuid("ID de grúa inválido").nullable().optional()
    ),
    operator_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().uuid("ID de operador inválido").nullable().optional()
    ),
    service_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().uuid("ID de servicio inválido").nullable().optional()
    ),
    
    service_folio: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    notes: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
});

export type CostFormValues = z.infer<typeof costSchema>;
