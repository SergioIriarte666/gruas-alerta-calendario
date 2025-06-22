import { z } from 'zod';

export const portalLoginSchema = z.object({
  email: z.string().email({ message: 'Por favor, ingrese un email válido.' }),
  password: z.string().min(1, { message: 'La contraseña no puede estar vacía.' }),
});

export type PortalLoginSchema = z.infer<typeof portalLoginSchema>; 