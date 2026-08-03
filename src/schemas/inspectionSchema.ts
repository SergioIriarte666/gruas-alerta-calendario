
import { z } from 'zod';
import { validateRut } from '@/utils/csvValidations';

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
  /**
   * Identidad de quien ENTREGA el vehículo en el retiro. Lo escribe el operador
   * a mano: NUNCA se prellena con la razón social del cliente (así el acta del
   * folio 3266120-1 terminó firmada por "Auxilia Club Asistencia S.A."). Viaja
   * a inspections.client_name / client_rut.
   */
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  vehicleReceptionSignature: z.string().optional(),
  /**
   * Identidad de quien RECIBE el vehículo en la entrega. Par independiente del
   * anterior — son dos personas distintas. Viaja a inspections.receiver_name /
   * receiver_rut.
   */
  receptionPersonName: z.string().optional(),
  receptionPersonRut: z.string().optional(),
  photographicSet: z.array(z.object({
    fileName: z.string().min(1, 'El nombre del archivo es requerido'),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor']),
    storageUrl: z.string().optional(),
  })).optional().default([]),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

type SignerField = 'clientName' | 'clientRut' | 'receptionPersonName' | 'receptionPersonRut';

const requireSigner = (
  ctx: z.RefinementCtx,
  values: InspectionFormValues,
  nameField: Extract<SignerField, 'clientName' | 'receptionPersonName'>,
  rutField: Extract<SignerField, 'clientRut' | 'receptionPersonRut'>,
  nameLabel: string,
  rutLabel: string,
) => {
  if (!values[nameField]?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [nameField], message: nameLabel });
  }

  const rut = values[rutField]?.trim();
  if (!rut) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [rutField], message: rutLabel });
  } else if (!validateRut(rut)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [rutField],
      message: 'RUT inválido. Use el formato 12.345.678-9',
    });
  }
};

/**
 * El acta es un documento probatorio: quien firma tiene nombre y RUT, y sin
 * ellos no se envía. Cada fase exige SU firmante —el que entrega en el retiro,
 * el que recibe en la entrega— porque el otro par pertenece a la otra fase y no
 * está en pantalla.
 */
export const buildInspectionFormSchema = (phase: 'initial' | 'final') =>
  inspectionFormSchema.superRefine((values, ctx) => {
    if (phase === 'initial') {
      requireSigner(
        ctx,
        values,
        'clientName',
        'clientRut',
        'El nombre de quien entrega el vehículo es obligatorio',
        'El RUT de quien entrega el vehículo es obligatorio',
      );
      return;
    }

    requireSigner(
      ctx,
      values,
      'receptionPersonName',
      'receptionPersonRut',
      'El nombre de quien recibe el vehículo es obligatorio',
      'El RUT de quien recibe el vehículo es obligatorio',
    );
  });
