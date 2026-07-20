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
    // El neto se valida de forma condicional en el superRefine: si el flete tiene
    // desglose, debe cuadrar con la suma; en caso contrario no puede ser negativo.
    net_amount: z.coerce.number(),
    notes: z.string().trim(),
    // Vehículos/maquinarias trasladados (solo flete, opcional). Cada fila es válida si
    // aporta al menos un campo (patente, marca, modelo, notas o valor); las filas
    // totalmente vacías se descartan al enviar. `service_value` es texto: '' = sin
    // valor, y admite signo negativo para líneas de ajuste comercial.
    vehicles: z
      .array(
        z.object({
          plate: z.string().default(''),
          make: z.string().default(''),
          model: z.string().default(''),
          notes: z.string().default(''),
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
  })
  .superRefine((values, ctx) => {
    const isFlete = values.sale_type === 'flete';
    if (isFlete) {
      if (!values.origin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['origin'], message: 'Ingrese el origen' });
      if (!values.destination) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destination'], message: 'Ingrese el destino' });
    }

    // ¿El flete tiene desglose por línea? (al menos una fila con valor cargado).
    const valuedRows = isFlete
      ? values.vehicles.filter((vehicle) => vehicle.service_value.trim() !== '')
      : [];

    if (valuedRows.length > 0) {
      const sum = valuedRows.reduce((total, vehicle) => total + Number(vehicle.service_value), 0);
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
