import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Save, Loader2, Building2 } from 'lucide-react';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useSupplierCategories } from '@/hooks/useSupplierCategories';
import { SupplierFormData, Supplier } from '@/types/suppliers';
import { SupplierFormStepNavigation, getSupplierFormSteps, SupplierFormStep } from './form/SupplierFormStepNavigation';
import { SupplierSummaryPanel } from './form/SupplierSummaryPanel';
import { SupplierFormStep1 } from './form/SupplierFormStep1';
import { SupplierFormStep2 } from './form/SupplierFormStep2';
import { SupplierFormStep3 } from './form/SupplierFormStep3';
import { buildSupplierFormValues, resolveSupplierCategoryValue } from './form/supplierFormUtils';

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  rut: z.string().min(1, 'El RUT es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  contact_name: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  subcategory: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  is_active: z.boolean()
});

type FormData = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  supplier?: Supplier;
  onClose: () => void;
  onSave?: () => void;
}

export const SupplierForm: React.FC<SupplierFormProps> = ({ 
  supplier, 
  onClose, 
  onSave 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const { createSupplier, updateSupplier, isCreating, isUpdating } = useSuppliers();
  const { data: supplierCategoriesData = [], isLoading: categoriesLoading } = useSupplierCategories();
  const activeCategories = useMemo(
    () => supplierCategoriesData.filter(c => c.is_active).map(c => ({ id: c.id, label: c.label, name: c.name })),
    [supplierCategoriesData]
  );
  const isEditing = !!supplier;

  const form = useForm<FormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      rut: '',
      email: '',
      phone: '',
      address: '',
      contact_name: '',
      category: '',
      subcategory: '',
      notes: '',
      is_active: true
    }
  });

  const normalizedSupplierValues = useMemo(
    () => buildSupplierFormValues(supplier, activeCategories),
    [supplier, activeCategories]
  );

  useEffect(() => {
    form.reset(normalizedSupplierValues);
  }, [form, normalizedSupplierValues]);

  const formValues = form.watch();
  const errors = form.formState.errors;

  const onSubmit = (data: FormData) => {
    const normalizedCategory = resolveSupplierCategoryValue(
      activeCategories,
      data.category || supplier?.category || ''
    );

    const supplierData: SupplierFormData = {
      name: data.name,
      rut: data.rut,
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      contact_name: data.contact_name || '',
      category: normalizedCategory,
      subcategory: normalizedCategory ? data.subcategory || '' : '',
      notes: data.notes || '',
      is_active: data.is_active
    };
    
    if (supplier) {
      updateSupplier({ id: supplier.id, data: supplierData }, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    } else {
      createSupplier(supplierData, {
        onSuccess: () => {
          onSave?.();
          onClose();
        }
      });
    }
  };

  const isSubmitting = isCreating || isUpdating;

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formValues.name?.trim() !== '' && formValues.rut?.trim() !== '';
      case 2:
        return true;
      case 3:
        if (categoriesLoading) return false;
        return activeCategories.length === 0 ? true : formValues.category?.trim() !== '';
      default:
        return true;
    }
  };

  const canGoNext = validateStep(currentStep);
  const canSubmit = validateStep(1) && validateStep(2) && validateStep(3);

  const steps: SupplierFormStep[] = getSupplierFormSteps().map(step => ({
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

  const getCategoryLabel = (categoryId: string) => {
    const cat = activeCategories.find(c => c.id === categoryId);
    return cat?.label || '';
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <SupplierFormStep1
            name={formValues.name}
            rut={formValues.rut}
            onNameChange={(value) => form.setValue('name', value)}
            onRutChange={(value) => form.setValue('rut', value)}
            errors={{
              name: errors.name?.message,
              rut: errors.rut?.message,
            }}
          />
        );
      case 2:
        return (
          <SupplierFormStep2
            email={formValues.email || ''}
            phone={formValues.phone}
            address={formValues.address}
            contactName={formValues.contact_name}
            onEmailChange={(value) => form.setValue('email', value)}
            onPhoneChange={(value) => form.setValue('phone', value)}
            onAddressChange={(value) => form.setValue('address', value)}
            onContactNameChange={(value) => form.setValue('contact_name', value)}
            errors={{
              email: errors.email?.message,
              phone: errors.phone?.message,
              address: errors.address?.message,
              contact_name: errors.contact_name?.message,
            }}
          />
        );
      case 3:
        return (
          <SupplierFormStep3
            category={formValues.category}
            subcategory={formValues.subcategory || ''}
            notes={formValues.notes || ''}
            isActive={formValues.is_active}
            categories={activeCategories}
            categoriesLoading={categoriesLoading}
            onCategoryChange={(value) => form.setValue('category', value)}
            onSubcategoryChange={(value) => form.setValue('subcategory', value)}
            onNotesChange={(value) => form.setValue('notes', value)}
            onIsActiveChange={(value) => form.setValue('is_active', value)}
            errors={{
              category: errors.category?.message,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="supplier-dialog max-w-6xl overflow-hidden flex flex-col gap-0 border-border/70 bg-card p-0">
        <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            {isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del proveedor' : 'Ingresa los datos del nuevo proveedor'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8 xl:p-8">
              <div className="space-y-4 xl:sticky xl:top-0 xl:self-start">
                <SupplierFormStepNavigation
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={setCurrentStep}
                />

                <SupplierSummaryPanel
                  name={formValues.name}
                  rut={formValues.rut}
                  phone={formValues.phone}
                  email={formValues.email || ''}
                  address={formValues.address}
                  contactName={formValues.contact_name}
                  category={formValues.category}
                  categoryLabel={getCategoryLabel(formValues.category)}
                  notes={formValues.notes || ''}
                  isActive={formValues.is_active}
                  isEditing={isEditing}
                />
              </div>

              <div className="min-h-0">
                {renderStepContent()}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 border-t bg-muted/30 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousStep}
                disabled={currentStep === 1 || isSubmitting}
                className="gap-2"
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>

                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={!canGoNext || isSubmitting}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={!canSubmit || isSubmitting}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {isEditing ? 'Actualizando...' : 'Creando...'}
                      </>
                    ) : (
                      <>
                        <Save className="size-4" />
                        {isEditing ? 'Actualizar' : 'Crear'}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
