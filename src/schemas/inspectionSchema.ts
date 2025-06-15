
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  keysCollected: z.array(z.string()).default([]),
  documentsCollected: z.array(z.string()).default([]),
  clientExclusiveUse: z.array(z.string()).default([]),
  vehicleObservations: z.string().optional(),
  operatorSignature: z.string().min(1, 'La firma es requerida'),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  photosBeforeService: z.array(z.string()).default([]),
  photosClientVehicle: z.array(z.string()).default([]),
  photosEquipmentUsed: z.array(z.string()).default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
