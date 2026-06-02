import { useToast } from '@/components/ui/custom-toast';
import { translateDatabaseError, translateValidationError, isRequiredFieldError, extractRequiredField } from '@/utils/errorTranslation';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useErrorHandler");
export interface ErrorHandlerOptions {
  /**
   * Mensaje personalizado para mostrar en lugar del error traducido
   */
  customMessage?: string;
  
  /**
   * Título del toast (por defecto: "Error")
   */
  title?: string;
  
  /**
   * Si debe mostrar el toast automáticamente (por defecto: true)
   */
  showToast?: boolean;
  
  /**
   * Función callback que se ejecuta después de manejar el error
   */
  onError?: (error: any, translatedMessage: string) => void;
  
  /**
   * Contexto adicional para logging
   */
  context?: string;
}

/**
 * Hook centralizado para manejo de errores con traducción automática
 */
export const useErrorHandler = () => {
  const { toast } = useToast();

  /**
   * Maneja un error y muestra un mensaje amigable al usuario
   */
  const handleError = (error: any, options: ErrorHandlerOptions = {}): string => {
    const {
      customMessage,
      title = 'Error',
      showToast = true,
      onError,
      context
    } = options;

    // Log del error para debugging
    if (context) {
      logger.error(`[${context}] Error:`, error);
    } else {
      logger.error('Error:', error);
    }

    // Determinar el mensaje a mostrar
    let message: string;
    
    if (customMessage) {
      message = customMessage;
    } else {
      // Intentar traducir el error de base de datos primero
      const dbMessage = translateDatabaseError(error);
      
      // Si no se encontró traducción específica y es un error de campo requerido,
      // intentar extraer el campo y usar traducción de validación
      if (dbMessage === 'Error al procesar la solicitud. Por favor, verifique los datos e intente nuevamente' && 
          isRequiredFieldError(error)) {
        const fieldName = extractRequiredField(error);
        if (fieldName) {
          message = translateValidationError(fieldName);
        } else {
          message = dbMessage;
        }
      } else {
        message = dbMessage;
      }
    }

    // Mostrar toast si está habilitado
    if (showToast) {
      toast({
        type: 'error',
        title,
        description: message,
        priority: 'high'
      });
    }

    // Ejecutar callback si está definido
    if (onError) {
      onError(error, message);
    }

    return message;
  };

  /**
   * Maneja errores de validación de formularios (Zod)
   */
  const handleValidationError = (field: string, zodMessage?: string, options: Omit<ErrorHandlerOptions, 'customMessage'> = {}): string => {
    const message = translateValidationError(field, zodMessage);
    
    return handleError(null, {
      ...options,
      customMessage: message
    });
  };

  /**
   * Maneja errores de mutación de React Query
   */
  const createMutationErrorHandler = (options: ErrorHandlerOptions = {}) => {
    return (error: any) => handleError(error, options);
  };

  /**
   * Maneja errores de conexión/red
   */
  const handleNetworkError = (error: any, options: ErrorHandlerOptions = {}): string => {
    const defaultMessage = 'Error de conexión. Por favor, verifique su conexión a internet e intente nuevamente';
    
    return handleError(error, {
      ...options,
      customMessage: options.customMessage || defaultMessage,
      title: options.title || 'Error de Conexión'
    });
  };

  /**
   * Maneja errores de permisos
   */
  const handlePermissionError = (error: any, options: ErrorHandlerOptions = {}): string => {
    const defaultMessage = 'No tiene permisos para realizar esta acción. Contacte al administrador';
    
    return handleError(error, {
      ...options,
      customMessage: options.customMessage || defaultMessage,
      title: options.title || 'Sin Permisos'
    });
  };

  return {
    handleError,
    handleValidationError,
    createMutationErrorHandler,
    handleNetworkError,
    handlePermissionError
  };
};