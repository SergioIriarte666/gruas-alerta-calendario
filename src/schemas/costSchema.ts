
import * as z from 'zod';

export const costSchema = z.object({
    date: z.string().nonempty('La fecha es requerida'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres').transform(val => val.trim()),
    amount: z.coerce.number().nonnegative('El monto no puede ser negativo').min(0, 'El monto debe ser 0 o mayor'),
    category_id: z.string().nonempty('La categoría es requerida'),
    
    cost_center_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    crane_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    operator_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    service_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    
    service_folio: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    subcategory: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    notes: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    
    // Campos específicos para piezas y repuestos
    part_name: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    supplier: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    supplier_phone: z.preprocess(
        (val) => (val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
    quantity: z.coerce.number().positive().nullable().optional(),
    unit_price: z.coerce.number().nonnegative().nullable().optional(),
    kilometraje: z.coerce.number().nonnegative().nullable().optional(),
    
    // Campos para compras de inventario (FASE 2)
    purchase_quantity: z.coerce.number().positive().nullable().optional(),
    purchase_unit_cost: z.coerce.number().nonnegative().nullable().optional(),
    
    // Campo para consumo inmediato
    immediate_consumption: z.boolean().optional().default(false),
    
    // Campo para proveedor
    supplier_id: z.preprocess(
        (val) => (val === 'none' || val === '' || !val) ? null : val,
        z.string().nullable().optional()
    ),
}).refine((data) => {
    // Si la subcategoría es "Piezas y Repuestos", validar campos requeridos
    if (data.subcategory === 'Piezas y Repuestos') {
        return data.part_name && data.supplier && data.quantity && data.unit_price;
    }
    return true;
}, {
    message: "Los campos de pieza, proveedor, cantidad y precio unitario son requeridos para piezas y repuestos",
    path: ["part_name"],
});

export type CostFormValues = z.infer<typeof costSchema>;
