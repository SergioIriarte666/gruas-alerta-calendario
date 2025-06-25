
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  vehicleObservations: z.string().optional(),
  operatorSignature: z.string().min(1, 'La firma del operador es requerida'),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  photographicSet: z.array(z.object({
    fileName: z.string(),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
  })).refine((value) => value.length > 0, {
    message: "Debes tomar al menos 1 fotografía para el set fotográfico.",
  }),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
