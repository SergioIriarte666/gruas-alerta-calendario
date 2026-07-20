import { z } from 'zod';
import { validateRut } from '@/utils/csvValidations';

export const lowboySaleFormSchema = z
  .object({
    sale_type: z.enum(['producto', 'flete']),
    client_rut: z.string().trim().refine(validateRut, 'Use un RUT con formato 12.345.678-9'),
    client_name: z.string().trim().min(1, 'Ingrese la razón social'),
    description: z.string().trim().min(1, 'Ingrese una descripción'),
    origin: z.string().trim(),
    destination: z.string().trim(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha válida').or(z.literal('')),
    net_amount: z.coerce.number().nonnegative('El monto no puede ser negativo'),
    notes: z.string().trim(),
    // Vehículos/maquinarias trasladados (solo flete, opcional). Cada fila es válida si
    // aporta al menos un campo; las filas totalmente vacías se descartan al enviar.
    vehicles: z
      .array(
        z.object({
          plate: z.string().default(''),
          make: z.string().default(''),
          model: z.string().default(''),
        }),
      )
      .default([]),
  })
  .superRefine((values, ctx) => {
    if (values.sale_type !== 'flete') return;
    if (!values.origin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: 'Ingrese el origen' });
    if (!values.destination) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination'], message: 'Ingrese el destino' });
  });

export const lowboySaleInitialStateSchema = z.object({
  status: z.enum(['ejecutada', 'facturada', 'pagada']),
  executed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha de ejecución válida'),
});
