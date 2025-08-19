
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  vehicleObservations: z.string().optional(),
  // Campos existentes
  kilometraje: z.string().min(1, 'El kilometraje es requerido'),
  combustible: z.string().min(1, 'El nivel de combustible es requerido'),
  // Nuevos campos para llaves y documentación
  llaves: z.string().min(1, 'El estado de las llaves es requerido'),
  documentacion: z.string().min(1, 'El estado de la documentación es requerido'),
  operatorSignature: z.string().min(1, 'La firma del operador es requerida'),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  // Nuevos campos para recepción del vehículo
  vehicleReceptionSignature: z.string().optional(),
  receptionPersonName: z.string().optional(),
  photographicSet: z.array(z.object({
    fileName: z.string().min(1, 'El nombre del archivo es requerido'),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
  })).refine((value) => value.length > 0, {
    message: "Debes tomar al menos 1 fotografía para el set fotográfico.",
  }),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
