
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  equipment: z.array(z.string()).optional().default([]),
  /**
   * Estado explícito {item_id: true|false} de TODOS los ítems del catálogo
   * evaluados. No lo llena el usuario: se deriva del catálogo al enviar
   * (ver inspectionSubmission) y viaja hasta el PDF y la columna
   * inspections.equipment_status. `equipment` sigue siendo solo los presentes.
   */
  equipmentStatus: z.record(z.boolean()).optional(),
  vehicleObservations: z.string().optional(),
  kilometraje: z.string().optional().default(''),
  combustible: z.enum(['0', '1/4', '1/2', '3/4', 'full']).optional(),
  llaves: z.enum(['si', 'no']).optional(),
  documentacion: z.enum(['si', 'no']).optional(),
  operatorSignature: z.string().optional(),
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
