
import { z } from 'zod';

export const portalRequestServiceSchema = z.object({
  origin: z.string()
    .min(1, { message: 'Debe ingresar el lugar de origen para continuar' })
    .min(3, { message: 'El origen debe tener al menos 3 caracteres' }),
  
  destination: z.string()
    .min(1, { message: 'Debe ingresar el lugar de destino para continuar' })
    .min(3, { message: 'El destino debe tener al menos 3 caracteres' }),
  
  service_type_id: z.string()
    .min(1, { message: 'Debe seleccionar un tipo de servicio para continuar' }),
  
  service_date: z.string()
    .min(1, { message: 'Debe seleccionar una fecha de servicio para continuar' }),
  
  license_plate: z.string().optional(),
  vehicle_brand: z.string().trim().optional(),
  vehicle_model: z.string().trim().optional(),

  contact_phone: z.string()
    .optional()
    .refine((value) => !value || value.length >= 8, { message: 'Telefono debe tener al menos 8 digitos' }),
  preferred_time: z.string().optional(),
  urgency: z.enum(['normal', 'urgent']).default('normal'),
  observations: z.string().optional(),
});

export type PortalRequestServiceSchema = z.infer<typeof portalRequestServiceSchema>;
