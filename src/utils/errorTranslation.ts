/**
 * Sistema de traducción de errores técnicos a mensajes amigables para el usuario
 */

interface ErrorTranslation {
  pattern: RegExp;
  message: string;
  field?: string;
}

const DATABASE_ERROR_TRANSLATIONS: ErrorTranslation[] = [
  // Errores de NOT NULL constraints
  {
    pattern: /null value in column "service_type_id"/i,
    message: 'Debe seleccionar un tipo de servicio para continuar',
    field: 'service_type_id'
  },
  {
    pattern: /null value in column "origin"/i,
    message: 'Debe ingresar el lugar de origen para continuar',
    field: 'origin'
  },
  {
    pattern: /null value in column "destination"/i,
    message: 'Debe ingresar el lugar de destino para continuar',
    field: 'destination'
  },
  {
    pattern: /null value in column "service_date"/i,
    message: 'Debe seleccionar una fecha de servicio para continuar',
    field: 'service_date'
  },
  {
    pattern: /null value in column "client_id"/i,
    message: 'Error de identificación de cliente. Por favor, inicie sesión nuevamente',
    field: 'client_id'
  },
  
  // Errores de UNIQUE constraints
  {
    pattern: /duplicate key value violates unique constraint.*services_folio_key/i,
    message: 'Ya existe una solicitud con este folio. Por favor, intente nuevamente',
    field: 'folio'
  },
  
  // Errores de FOREIGN KEY constraints
  {
    pattern: /insert or update on table "services" violates foreign key constraint.*service_types/i,
    message: 'El tipo de servicio seleccionado no es válido. Por favor, seleccione otro',
    field: 'service_type_id'
  },
  {
    pattern: /insert or update on table "services" violates foreign key constraint.*clients/i,
    message: 'Error de identificación de cliente. Por favor, inicie sesión nuevamente',
    field: 'client_id'
  },
  
  // Errores de validación de tipos
  {
    pattern: /invalid input syntax for type uuid/i,
    message: 'Los datos enviados no son válidos. Por favor, verifique la información e intente nuevamente',
    field: 'general'
  },
  
  // Errores de conexión
  {
    pattern: /connection.*refused|network.*error|timeout/i,
    message: 'Error de conexión. Por favor, verifique su conexión a internet e intente nuevamente',
    field: 'connection'
  },
  
  // Errores de permisos
  {
    pattern: /permission denied|insufficient.*privilege/i,
    message: 'No tiene permisos para realizar esta acción. Contacte al administrador',
    field: 'permissions'
  }
];

const VALIDATION_ERROR_TRANSLATIONS: Record<string, string> = {
  'service_type_id': 'Debe seleccionar un tipo de servicio',
  'origin': 'Debe ingresar el lugar de origen',
  'destination': 'Debe ingresar el lugar de destino',
  'service_date': 'Debe seleccionar una fecha de servicio',
  'license_plate': 'Debe ingresar la patente del vehículo',
  'vehicle_brand': 'Debe ingresar la marca del vehículo',
  'vehicle_model': 'Debe ingresar el modelo del vehículo'
};

/**
 * Traduce errores técnicos de la base de datos a mensajes amigables
 */
export const translateDatabaseError = (error: any): string => {
  if (!error || typeof error.message !== 'string') {
    return 'Ocurrió un error inesperado. Por favor, intente nuevamente';
  }
  
  const errorMessage = error.message;
  
  // Buscar traducciones para errores de base de datos
  for (const translation of DATABASE_ERROR_TRANSLATIONS) {
    if (translation.pattern.test(errorMessage)) {
      return translation.message;
    }
  }
  
  // Si no encuentra una traducción específica, devolver mensaje genérico
  return 'Error al procesar la solicitud. Por favor, verifique los datos e intente nuevamente';
};

/**
 * Traduce errores de validación de formulario
 */
export const translateValidationError = (field: string, zodErrorMessage?: string): string => {
  // Si hay una traducción específica para el campo, usarla
  if (VALIDATION_ERROR_TRANSLATIONS[field]) {
    return VALIDATION_ERROR_TRANSLATIONS[field];
  }
  
  // Si viene un mensaje de Zod y ya está en español, usarlo
  if (zodErrorMessage && zodErrorMessage.includes('requerido')) {
    return zodErrorMessage;
  }
  
  // Mensaje genérico
  return `El campo ${field} es requerido`;
};

/**
 * Determina si un error es de tipo "campo requerido"
 */
export const isRequiredFieldError = (error: any): boolean => {
  if (!error || typeof error.message !== 'string') {
    return false;
  }
  
  return error.message.includes('null value in column') || 
         error.message.includes('violates not-null constraint');
};

/**
 * Extrae el nombre del campo de un error de "campo requerido"
 */
export const extractRequiredField = (error: any): string | null => {
  if (!isRequiredFieldError(error)) {
    return null;
  }
  
  const match = error.message.match(/null value in column "([^"]+)"/i);
  return match ? match[1] : null;
};