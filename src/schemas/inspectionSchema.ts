
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).optional().default([]),
  vehicleObservations: z.string().optional(),
  kilometraje: z.string().optional().default(''),
  combustible: z.enum(['0', '1/4', '1/2', '3/4', 'full']).optional(),
  llaves: z.enum(['si', 'no']).optional(),
  documentacion: z.enum(['si', 'no']).optional(),
  operatorSignature: z.string().min(1, 'La firma del operador es requerida'),
  operatorName: z.string().optional(),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  vehicleReceptionSignature: z.string().optional(),
  receptionPersonName: z.string().optional(),
  photographicSet: z.array(z.object({
    fileName: z.string().min(1, 'El nombre del archivo es requerido'),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor']),
    storageUrl: z.string().optional(),
  })).optional().default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
