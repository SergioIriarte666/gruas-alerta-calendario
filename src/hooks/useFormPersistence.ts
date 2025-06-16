
import { useEffect, useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { InspectionFormValues } from '@/schemas/inspectionSchema';

export const useFormPersistence = (
  form: UseFormReturn<InspectionFormValues>,
  serviceId: string
) => {
  const storageKey = `inspection-form-${serviceId}`;

  const saveFormData = useCallback(() => {
    const formData = form.getValues();
    localStorage.setItem(storageKey, JSON.stringify(formData));
    console.log('Form data saved to localStorage:', formData);
  }, [form, storageKey]);

  const loadFormData = useCallback(() => {
    const savedData = localStorage.getItem(storageKey);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        console.log('Loading saved form data:', parsedData);
        
        // Restaurar cada campo individualmente
        Object.keys(parsedData).forEach((key) => {
          if (parsedData[key] !== undefined && parsedData[key] !== null) {
            form.setValue(key as keyof InspectionFormValues, parsedData[key]);
          }
        });
        
        return parsedData;
      } catch (error) {
        console.error('Error parsing saved form data:', error);
        localStorage.removeItem(storageKey);
      }
    }
    return null;
  }, [form, storageKey]);

  const clearFormData = useCallback(() => {
    localStorage.removeItem(storageKey);
    console.log('Form data cleared from localStorage');
  }, [storageKey]);

  // Auto-save en cambios del formulario
  useEffect(() => {
    const subscription = form.watch(() => {
      saveFormData();
    });

    return () => subscription.unsubscribe();
  }, [form, saveFormData]);

  return {
    loadFormData,
    saveFormData,
    clearFormData
  };
};
