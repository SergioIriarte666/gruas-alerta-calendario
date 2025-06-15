
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  vehicleObservations: z.string().optional(),
  operatorSignature: z.string().min(1, 'La firma es requerida'),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
