import { z } from 'zod';
import { validateRut } from '@/utils/csvValidations';
import { computeFleteNeto } from '@/utils/lowboyFleteNeto';

export const lowboySaleFormSchema = z
  .object({
    sale_type: z.enum(['producto', 'flete']),
    client_rut: z.string().trim().refine(validateRut, 'Use un RUT con formato 12.345.678-9'),
    client_name: z.string().trim().min(1, 'Ingrese la razón social'),
    description: z.string().trim().min(1, 'Ingrese una descripción'),
    origin: z.string().trim(),
    destination: z.string().trim(),
    scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha válida').or(z.literal('')),
    // El neto se valida de forma condicional en el superRefine: si el flete tiene
    // desglose, debe cuadrar con la suma; en caso contrario no puede ser negativo.
    net_amount: z.coerce.number(),
    notes: z.string().trim(),
    // Vehículos/maquinarias trasladados (solo flete, opcional). Cada fila es válida si
    // aporta al menos un campo (patente, marca, modelo o valor); las filas totalmente
    // vacías se descartan al enviar. `service_value` es texto: '' = sin valor, y admite
    // signo negativo. El ajuste comercial ya NO es una fila: es el campo `adjustment`.
    vehicles: z
      .array(
        z.object({
          plate: z.string().default(''),
          make: z.string().default(''),
          model: z.string().default(''),
          service_value: z
            .string()
            .default('')
            .refine(
              (value) => value.trim() === '' || /^-?\d+$/.test(value.trim()),
              'Ingrese un monto entero (puede ser negativo)',
            ),
        }),
      )
      .default([]),
    // Ajuste comercial único del flete (descuento − / recargo +). Texto entero opcional.
    adjustment: z
      .string()
      .trim()
      .default('')
      .refine(
        (value) => value === '' || /^-?\d+$/.test(value),
        'Ingrese un monto entero (puede ser negativo)',
      ),
  })
  .superRefine((values, ctx) => {
    const isFlete = values.sale_type === 'flete';
    if (isFlete) {
      if (!values.origin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: 'Ingrese el origen' });
      if (!values.destination) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination'], message: 'Ingrese el destino' });
    }

    // ¿El flete tiene desglose? (algún valor de línea O un ajuste distinto de 0). La
    // suma algebraica —valores + ajuste, con signo— sale de la fuente única compartida
    // con la UI y el manager.
    const { hasBreakdown, sum } = computeFleteNeto(
      isFlete ? values.vehicles : [],
      isFlete ? values.adjustment : '',
    );

    if (hasBreakdown) {
      if (sum < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['net_amount'],
          message: 'El neto no puede ser negativo. Revisa las líneas de ajuste.',
        });
      }
    } else if (values.net_amount < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['net_amount'], message: 'El monto no puede ser negativo' });
    }
  });

export const lowboySaleInitialStateSchema = z.object({
  status: z.enum(['ejecutada', 'facturada', 'pagada']),
  executed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingrese una fecha de ejecución válida'),
});
