
import * as z from 'zod';

export const costSchema = z.object({
    date: z.string().nonempty('La fecha es requerida'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    amount: z.coerce.number().positive('El monto debe ser un número positivo'),
    category_id: z.string().nonempty('La categoría es requerida'),
    
    crane_id: z.preprocess(
        (val) => {
            console.log('[Schema Preprocess] crane_id - Input:', val, `(Type: ${typeof val})`);
            const result = (val === 'none' || val === '' || !val) ? null : val;
            console.log('[Schema Preprocess] crane_id - Output:', result);
            return result;
        },
        z.string().uuid("ID de grúa inválido").nullable().optional()
    ),
    operator_id: z.preprocess(
        (val) => {
            console.log('[Schema Preprocess] operator_id - Input:', val, `(Type: ${typeof val})`);
            const result = (val === 'none' || val === '' || !val) ? null : val;
            console.log('[Schema Preprocess] operator_id - Output:', result);
            return result;
        },
        z.string().uuid("ID de operador inválido").nullable().optional()
    ),
    service_id: z.preprocess(
        (val) => {
            console.log('[Schema Preprocess] service_id - Input:', val, `(Type: ${typeof val})`);
            const result = (val === 'none' || val === '' || !val) ? null : val;
            console.log('[Schema Preprocess] service_id - Output:', result);
            return result;
        },
        z.string().uuid("ID de servicio inválido").nullable().optional()
    ),
    
    service_folio: z.preprocess(
        (val) => {
            console.log('[Schema Preprocess] service_folio - Input:', val, `(Type: ${typeof val})`);
            const result = (val === '' || !val) ? null : val;
            console.log('[Schema Preprocess] service_folio - Output:', result);
            return result;
        },
        z.string().nullable().optional()
    ),
    notes: z.preprocess(
        (val) => {
            console.log('[Schema Preprocess] notes - Input:', val, `(Type: ${typeof val})`);
            const result = (val === '' || !val) ? null : val;
            console.log('[Schema Preprocess] notes - Output:', result);
            return result;
        },
        z.string().nullable().optional()
    ),
});

export type CostFormValues = z.infer<typeof costSchema>;
