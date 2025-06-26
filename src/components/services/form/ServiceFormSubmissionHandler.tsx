
import React from 'react';

interface ServiceFormSubmissionHandlerProps {
  handleSubmit: (e: React.FormEvent, folio: string, formData: any, isManualFolio: boolean) => Promise<void>;
  folio: string;
  formData: any;
  isManualFolio: boolean;
  markAsSubmittedRef: React.MutableRefObject<(() => void) | null>;
  toast: any;
  children: React.ReactNode;
}

export const ServiceFormSubmissionHandler = ({
  handleSubmit,
  folio,
  formData,
  isManualFolio,
  markAsSubmittedRef,
  toast,
  children
}: ServiceFormSubmissionHandlerProps) => {
  const handleFormSubmit = async (e: React.FormEvent) => {
    try {
      await handleSubmit(e, folio, formData, isManualFolio);
      
      // Limpiar datos de persistencia después del envío exitoso
      if (markAsSubmittedRef.current) {
        markAsSubmittedRef.current();
      }
      
      toast({
        type: 'success',
        title: 'Servicio guardado',
        description: 'El servicio se ha guardado correctamente'
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        type: 'error',
        title: 'Error al guardar',
        description: 'No se pudo guardar el servicio. Los datos se mantienen guardados localmente.'
      });
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      {children}
    </form>
  );
};
