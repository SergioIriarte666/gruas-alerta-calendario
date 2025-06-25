
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { inspectionFormSchema, InspectionFormValues } from '@/schemas/inspectionSchema';
import { validateFormBeforeSubmit } from '@/utils/inspectionValidation';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { InspectionFormSections } from '@/components/operator/InspectionFormSections';
import { Download } from 'lucide-react';
import { useToast } from '@/components/ui/custom-toast';
import { Service } from '@/types';

interface InspectionFormProps {
  service: Service;
  serviceId: string;
  onSubmit: (values: InspectionFormValues) => void;
  isProcessing: boolean;
  isGeneratingPDF: boolean;
  isUpdatingStatus: boolean;
}

export const InspectionForm = ({ 
  service, 
  serviceId, 
  onSubmit, 
  isProcessing, 
  isGeneratingPDF, 
  isUpdatingStatus 
}: InspectionFormProps) => {
  const { toast } = useToast();
  
  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues: {
      equipment: [],
      vehicleObservations: '',
      operatorSignature: '',
      clientName: '',
      clientRut: '',
      photosBeforeService: [],
      photosClientVehicle: [],
      photosEquipmentUsed: [],
    },
  });

  const { loadFormData } = useFormPersistence(form, serviceId);

  useEffect(() => {
    const savedData = loadFormData();
    if (savedData) {
      toast({ type: 'info', title: 'Datos del formulario restaurados' });
    }
  }, [serviceId, loadFormData, toast]);

  const handleSubmit = (values: InspectionFormValues) => {
    const validationErrors = validateFormBeforeSubmit(values);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => toast({ type: 'error', title: error }));
      return;
    }
    
    onSubmit(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <InspectionFormSections form={form} />

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isProcessing || isUpdatingStatus || isGeneratingPDF}
          >
            <Download className="w-4 h-4 mr-2" />
            {isGeneratingPDF ? 'Generando PDF...' : 
             isProcessing ? 'Procesando...' : 
             isUpdatingStatus ? 'Iniciando Servicio...' : 
             'Generar PDF e Iniciar Servicio'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
