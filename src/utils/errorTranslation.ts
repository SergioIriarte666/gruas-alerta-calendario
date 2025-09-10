/**
 * Sistema de traducción de errores técnicos a mensajes amigables para el usuario
 */

interface ErrorTranslation {
  pattern: RegExp;
  message: string;
  field?: string;
}

const DATABASE_ERROR_TRANSLATIONS: ErrorTranslation[] = [
  // Errores de NOT NULL constraints - Servicios
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
  
  // Errores de NOT NULL constraints - Grúas
  {
    pattern: /null value in column "license_plate"/i,
    message: 'Debe ingresar la patente de la grúa para continuar',
    field: 'license_plate'
  },
  {
    pattern: /null value in column "brand"/i,
    message: 'Debe ingresar la marca de la grúa para continuar',
    field: 'brand'
  },
  {
    pattern: /null value in column "model"/i,
    message: 'Debe ingresar el modelo de la grúa para continuar',
    field: 'model'
  },
  {
    pattern: /null value in column "type"/i,
    message: 'Debe seleccionar el tipo de grúa para continuar',
    field: 'type'
  },
  
  // Errores de NOT NULL constraints - Operadores
  {
    pattern: /null value in column "name"/i,
    message: 'Debe ingresar el nombre completo del operador',
    field: 'name'
  },
  {
    pattern: /null value in column "rut"/i,
    message: 'Debe ingresar el RUT del operador',
    field: 'rut'
  },
  {
    pattern: /null value in column "license_number"/i,
    message: 'Debe ingresar el número de licencia del operador',
    field: 'license_number'
  },
  {
    pattern: /null value in column "exam_expiry"/i,
    message: 'Debe ingresar la fecha de vencimiento del examen',
    field: 'exam_expiry'
  },
  
  // Errores de NOT NULL constraints - Costos
  {
    pattern: /null value in column "amount"/i,
    message: 'Debe ingresar el monto del costo',
    field: 'amount'
  },
  {
    pattern: /null value in column "date"/i,
    message: 'Debe seleccionar la fecha del costo',
    field: 'date'
  },
  {
    pattern: /null value in column "description"/i,
    message: 'Debe ingresar una descripción del costo',
    field: 'description'
  },
  {
    pattern: /null value in column "category_id"/i,
    message: 'Debe seleccionar una categoría de costo',
    field: 'category_id'
  },
  
  // Errores de NOT NULL constraints - Clientes
  {
    pattern: /null value in column "name"/i,
    message: 'Debe ingresar el nombre del cliente',
    field: 'name'
  },
  {
    pattern: /null value in column "department"/i,
    message: 'Debe seleccionar un departamento',
    field: 'department'
  },
  
  // Errores de NOT NULL constraints - Inventario
  {
    pattern: /null value in column "item_id"/i,
    message: 'Debe seleccionar un artículo del inventario',
    field: 'item_id'
  },
  {
    pattern: /null value in column "quantity"/i,
    message: 'Debe ingresar la cantidad',
    field: 'quantity'
  },
  {
    pattern: /null value in column "location_id"/i,
    message: 'Debe seleccionar una ubicación',
    field: 'location_id'
  },
  
  // Errores de NOT NULL constraints - Facturas
  {
    pattern: /null value in column "folio"/i,
    message: 'Error generando folio de factura. Intente nuevamente',
    field: 'folio'
  },
  {
    pattern: /null value in column "issue_date"/i,
    message: 'Debe seleccionar la fecha de emisión',
    field: 'issue_date'
  },
  {
    pattern: /null value in column "due_date"/i,
    message: 'Debe seleccionar la fecha de vencimiento',
    field: 'due_date'
  },
  
  // Errores de UNIQUE constraints
  {
    pattern: /duplicate key value violates unique constraint.*services_folio_key/i,
    message: 'Ya existe una solicitud con este folio. Por favor, intente nuevamente',
    field: 'folio'
  },
  {
    pattern: /duplicate key value violates unique constraint.*cranes.*license_plate/i,
    message: 'Ya existe una grúa registrada con esta patente',
    field: 'license_plate'
  },
  {
    pattern: /duplicate key value violates unique constraint.*operators.*rut/i,
    message: 'Ya existe un operador registrado con este RUT',
    field: 'rut'
  },
  {
    pattern: /duplicate key value violates unique constraint.*clients.*rut/i,
    message: 'Ya existe un cliente registrado con este RUT',
    field: 'rut'
  },
  {
    pattern: /duplicate key value violates unique constraint.*invoices.*folio/i,
    message: 'Ya existe una factura con este folio',
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
  {
    pattern: /insert or update on table "costs" violates foreign key constraint.*cost_categories/i,
    message: 'La categoría de costo seleccionada no es válida',
    field: 'category_id'
  },
  {
    pattern: /insert or update on table ".*" violates foreign key constraint.*crane/i,
    message: 'La grúa seleccionada no es válida o no está disponible',
    field: 'crane_id'
  },
  {
    pattern: /insert or update on table ".*" violates foreign key constraint.*operator/i,
    message: 'El operador seleccionado no es válido o no está disponible',
    field: 'operator_id'
  },
  
  // Errores de validación de tipos
  {
    pattern: /invalid input syntax for type uuid/i,
    message: 'Los datos enviados no son válidos. Por favor, verifique la información e intente nuevamente',
    field: 'general'
  },
  {
    pattern: /invalid input syntax for type numeric/i,
    message: 'El valor ingresado debe ser un número válido',
    field: 'numeric_field'
  },
  {
    pattern: /invalid input syntax for type date/i,
    message: 'La fecha ingresada no es válida',
    field: 'date_field'
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
  },
  
  // Errores de RLS (Row Level Security)
  {
    pattern: /new row violates row-level security policy/i,
    message: 'No tiene permisos para crear este registro. Contacte al administrador',
    field: 'permissions'
  },
  
  // Errores de CHECK constraints
  {
    pattern: /new row.*violates check constraint/i,
    message: 'Los datos ingresados no cumplen con las reglas de validación',
    field: 'validation'
  }
];

const VALIDATION_ERROR_TRANSLATIONS: Record<string, string> = {
  // Servicios
  'service_type_id': 'Debe seleccionar un tipo de servicio',
  'origin': 'Debe ingresar el lugar de origen',
  'destination': 'Debe ingresar el lugar de destino',
  'service_date': 'Debe seleccionar una fecha de servicio',
  'license_plate': 'Debe ingresar la patente del vehículo',
  'vehicle_brand': 'Debe ingresar la marca del vehículo',
  'vehicle_model': 'Debe ingresar el modelo del vehículo',
  
  // Grúas
  'brand': 'Debe ingresar la marca de la grúa',
  'model': 'Debe ingresar el modelo de la grúa',
  'type': 'Debe seleccionar el tipo de grúa',
  'technical_review_expiry': 'Debe ingresar la fecha de vencimiento de la revisión técnica',
  'circulation_permit_expiry': 'Debe ingresar la fecha de vencimiento del permiso de circulación',
  'insurance_expiry': 'Debe ingresar la fecha de vencimiento del seguro',
  
  // Operadores
  'name': 'Debe ingresar el nombre completo',
  'rut': 'Debe ingresar el RUT',
  'license_number': 'Debe ingresar el número de licencia',
  'exam_expiry': 'Debe ingresar la fecha de vencimiento del examen',
  
  // Costos
  'amount': 'Debe ingresar el monto',
  'date': 'Debe seleccionar la fecha',
  'description': 'Debe ingresar una descripción',
  'category_id': 'Debe seleccionar una categoría',
  
  // Clientes
  'department': 'Debe seleccionar un departamento',
  'contact_name': 'Debe ingresar un nombre de contacto',
  'email': 'Debe ingresar un email válido',
  'phone': 'Debe ingresar un teléfono',
  'address': 'Debe ingresar una dirección',
  
  // Inventario
  'item_id': 'Debe seleccionar un artículo',
  'quantity': 'Debe ingresar la cantidad',
  'location_id': 'Debe seleccionar una ubicación',
  'unit_cost': 'Debe ingresar el costo unitario',
  
  // Facturas
  'folio': 'Debe ingresar el folio',
  'issue_date': 'Debe seleccionar la fecha de emisión',
  'due_date': 'Debe seleccionar la fecha de vencimiento',
  'client_id': 'Debe seleccionar un cliente',
  'subtotal': 'Error calculando subtotal',
  'total': 'Error calculando total'
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