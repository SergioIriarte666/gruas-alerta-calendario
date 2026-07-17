import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Client } from '@/types';
import { ChevronLeft, ChevronRight, Save, Building2 } from 'lucide-react';
import { ClientFormStepNavigation, getClientFormSteps, ClientFormStep } from './form/ClientFormStepNavigation';
import { ClientSummaryPanel } from './form/ClientSummaryPanel';
import { ClientFormStep1 } from './form/ClientFormStep1';
import { ClientFormStep2 } from './form/ClientFormStep2';
import { ClientFormStep3 } from './form/ClientFormStep3';
import { toast } from 'sonner';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> & { departments?: string[] }) => void;
  onCancel: () => void;
}

export const ClientForm = ({ client, onSubmit, onCancel }: ClientFormProps) => {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    name: client?.name || '',
    rut: client?.rut || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    department: client?.department || '',
    contactName: client?.contactName || '',
    isActive: client?.isActive ?? true,
    billingType: (client?.billingType as 'standard' | 'monthly') || 'standard',
  });

  const [departments, setDepartments] = React.useState<string[]>(
    client ? [] : ['']
  );

  const [isAddingDepartment, setIsAddingDepartment] = React.useState(false);
  const [newDepartmentName, setNewDepartmentName] = React.useState('');

  const isEditing = !!client;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (client) {
      if (isAddingDepartment && newDepartmentName.trim()) {
        onSubmit({
          ...formData,
          department: newDepartmentName.trim(),
          departments: [newDepartmentName.trim()],
          _isAddingDepartment: true
        } as any);
      } else {
        onSubmit(formData);
      }
    } else {
      const validDepartments = departments.filter(dep => dep.trim() !== '');
      if (validDepartments.length === 0) {
        toast.error('Debe ingresar al menos un departamento');
        return;
      }
      
      onSubmit({
        ...formData,
        departments: validDepartments
      });
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Step validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.name.trim() !== '' && formData.rut.trim() !== '';
      case 2:
        return true; // Optional fields
      case 3:
        if (isEditing) {
          return !isAddingDepartment || newDepartmentName.trim() !== '';
        }
        return departments.some(d => d.trim() !== '');
      default:
        return true;
    }
  };

  const canGoNext = validateStep(currentStep);
  const canSubmit = validateStep(1) && validateStep(2) && validateStep(3);

  const steps: ClientFormStep[] = getClientFormSteps().map(step => ({
    ...step,
    isCompleted: step.id < currentStep || (step.id === currentStep && validateStep(step.id)),
    hasError: false,
  }));

  const goToNextStep = () => {
    if (currentStep < 3 && canGoNext) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <ClientFormStep1
            name={formData.name}
            rut={formData.rut}
            onChange={handleChange}
            onSreData={(data) => {
              setFormData(prev => ({
                ...prev,
                name: data.name || prev.name,
                phone: data.phone || prev.phone,
                email: data.email || prev.email,
                address: data.address || prev.address,
              }));
            }}
          />
        );
      case 2:
        return (
          <ClientFormStep2
            phone={formData.phone}
            email={formData.email}
            address={formData.address}
            contactName={formData.contactName}
            onChange={handleChange}
          />
        );
      case 3:
        return (
          <ClientFormStep3
            department={formData.department}
            departments={departments}
            isActive={formData.isActive}
            billingType={formData.billingType}
            isEditing={isEditing}
            isAddingDepartment={isAddingDepartment}
            newDepartmentName={newDepartmentName}
            onDepartmentChange={(value) => handleChange('department', value)}
            onDepartmentsChange={setDepartments}
            onIsActiveChange={(value) => handleChange('isActive', value)}
            onBillingTypeChange={(value) => handleChange('billingType', value)}
            onIsAddingDepartmentChange={setIsAddingDepartment}
            onNewDepartmentNameChange={setNewDepartmentName}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card border flex flex-col max-h-[85vh]">
      {/* Header */}
      <CardHeader className="client-form-header flex-shrink-0 rounded-t-lg text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Building2 className="size-5" />
            {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
          </CardTitle>
        </div>
        <p className="mt-1 text-sm text-white/70">
          {isEditing ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left column - Navigation and Summary */}
            <div className="lg:col-span-1 space-y-4">
              <ClientFormStepNavigation
                steps={steps}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
              />
              
              <ClientSummaryPanel
                name={formData.name}
                rut={formData.rut}
                phone={formData.phone}
                email={formData.email}
                address={formData.address}
                contactName={formData.contactName}
                departments={isEditing ? [formData.department] : departments}
                isActive={formData.isActive}
                isEditing={isEditing}
              />
            </div>

            {/* Right column - Step Content */}
            <div className="lg:col-span-2">
              {renderStepContent()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
              >
                Cancelar
              </Button>

              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={goToNextStep}
                  disabled={!canGoNext}
                  className="gap-2"
                >
                  Siguiente
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="gap-2"
                >
                  <Save className="size-4" />
                  {isEditing ? 'Actualizar' : 'Crear'} Cliente
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
