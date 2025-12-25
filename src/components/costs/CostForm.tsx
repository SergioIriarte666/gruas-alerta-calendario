import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Cost, CostFormData } from '@/types/costs';
import { useAddCost, useUpdateCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServices } from '@/hooks/useServices';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCenters } from '@/hooks/useCostCenters';
import { costSchema, CostFormValues } from '@/schemas/costSchema';
import { ServiceExpenseModals } from './ServiceExpenseModals';
import { CostFormStepNavigation, getCostFormSteps, CostFormStep } from './form/CostFormStepNavigation';
import { CostSummaryPanel } from './form/CostSummaryPanel';
import { CostFormStep1 } from './form/CostFormStep1';
import { CostFormStep2 } from './form/CostFormStep2';
import { CostFormStep3 } from './form/CostFormStep3';
import { CostFormStep4 } from './form/CostFormStep4';
import { toast } from 'sonner';
import { getCurrentChileDateString, formatForInput } from '@/utils/timezoneUtils';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';

interface CostFormProps {
    isOpen: boolean;
    onClose: () => void;
    cost: Cost | null;
    prefilledData?: ReturnType<typeof import('@/utils/costHelpers').prepareCostForDuplication> | null;
    onInventoryCostCreated?: (data: {
        costId: string;
        description: string;
        quantity: number;
        unitCost: number;
        date: string;
    }) => void;
}

export const CostForm = ({ isOpen, onClose, cost, prefilledData, onInventoryCostCreated }: CostFormProps) => {
    const queryClient = useQueryClient();
    const { mutate: addCost, isPending: isAdding } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating } = useUpdateCost();
    
    const [currentStep, setCurrentStep] = useState(1);
    const [showServiceExpenseModals, setShowServiceExpenseModals] = useState(false);
    const [calculatedServiceTotal, setCalculatedServiceTotal] = useState(0);
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, loading: isLoadingCranes } = useCranes();
    const { data: operators = [], isLoading: isLoadingOperators } = useOperatorsData();
    const { getServicesForCosts, services, loading: isLoadingServices } = useServices();
    const { suppliers = [] } = useSuppliers();
    const { data: costCenters = [] } = useCostCenters();

    const servicesForCosts = getServicesForCosts();

    const form = useForm<CostFormValues>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            date: getCurrentChileDateString(),
            description: '',
            amount: 0,
            category_id: '',
            crane_id: 'none',
            operator_id: 'none',
            service_id: 'none',
            service_folio: '',
            subcategory: '',
            notes: '',
            cost_center_id: 'none',
            purchase_quantity: null,
            purchase_unit_cost: null,
            immediate_consumption: false,
            supplier_id: 'none',
        },
    });
    const { reset, watch, setValue } = form;

    const selectedServiceId = watch('service_id');
    const selectedCategoryId = watch('category_id');
    const watchedValues = watch();

    // Auto-fill fields when service is selected
    useEffect(() => {
        if (selectedServiceId && selectedServiceId !== 'none') {
            const selectedService = services.find(service => service.id === selectedServiceId);
            if (selectedService) {
                setValue('crane_id', selectedService.crane?.id || 'none');
                setValue('operator_id', selectedService.operator?.id || 'none');
                setValue('service_folio', selectedService.folio);
                toast.success("Campos Completados", { 
                    description: "Se han llenado automáticamente los campos relacionados al servicio" 
                });
            }
        }
    }, [selectedServiceId, services, setValue]);

    // Reset step when opening
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1);
        }
    }, [isOpen]);

    // Get derived data for summary panel
    const summaryData = useMemo(() => {
        const category = categories.find(c => c.id === watchedValues.category_id);
        const crane = cranes.find(c => c.id === watchedValues.crane_id);
        const operator = operators.find(o => o.id === watchedValues.operator_id);
        const supplier = suppliers.find(s => s.id === watchedValues.supplier_id);
        const costCenter = costCenters.find(cc => cc.id === watchedValues.cost_center_id);
        const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
        const isPiezasYRepuestos = selectedCategory?.name === 'Mantenimiento' && watchedValues.subcategory === 'Piezas y Repuestos';

        return {
            date: watchedValues.date || '',
            categoryName: category?.name || '',
            subcategory: watchedValues.subcategory || '',
            description: watchedValues.description || '',
            amount: Number(watchedValues.amount) || 0,
            craneName: crane?.licensePlate || '',
            operatorName: operator?.name || '',
            serviceFolio: watchedValues.service_folio || '',
            costCenterName: costCenter ? `${costCenter.code} - ${costCenter.name}` : '',
            supplierName: supplier?.name || '',
            notes: watchedValues.notes || '',
            isEditing: !!cost,
            isPiezasYRepuestos,
            partName: watchedValues.part_name || '',
            quantity: watchedValues.quantity || undefined,
            unitPrice: watchedValues.unit_price || undefined,
        };
    }, [watchedValues, categories, cranes, operators, suppliers, costCenters, cost, selectedCategoryId]);

    // Calculate step completion
    const steps = useMemo((): CostFormStep[] => {
        const baseSteps = getCostFormSteps();
        
        const step1Complete = !!watchedValues.date && !!watchedValues.category_id && !!watchedValues.description?.trim();
        const step2Complete = (watchedValues.amount || 0) > 0;
        const step3Complete = true; // Associations are optional
        const step4Complete = true; // Notes are optional

        const completionStatus = [step1Complete, step2Complete, step3Complete, step4Complete];
        
        return baseSteps.map((step, index) => ({
            ...step,
            isCompleted: completionStatus[index],
            hasError: false,
        }));
    }, [watchedValues]);

    const handleServiceExpenseSelect = () => {
        const currentServiceId = form.getValues('service_id');
        if (!currentServiceId || currentServiceId === 'none') {
            toast.error("Servicio Requerido", { 
                description: "Primero debe seleccionar un servicio para desglosar los gastos" 
            });
            return;
        }
        setShowServiceExpenseModals(true);
    };

    const handleServiceExpenseComplete = (totalAmount?: number) => {
        setShowServiceExpenseModals(false);
        if (totalAmount && totalAmount > 0) {
            setCalculatedServiceTotal(totalAmount);
            setValue('amount', totalAmount);
            toast.success("Gastos Desglosados", { 
                description: `Se crearon los costos desglosados por un total de $${totalAmount.toLocaleString()}` 
            });
            onClose();
        } else {
            toast.info("Desglose Cancelado", { 
                description: "Puede continuar ingresando el monto manualmente" 
            });
        }
    };

    useEffect(() => {
        if (cost) {
            const dateValue = (cost.date && typeof cost.date === 'string')
                ? formatForInput(cost.date)
                : getCurrentChileDateString();

            reset({
                date: dateValue,
                description: cost.description,
                amount: Number(cost.amount),
                category_id: cost.category_id,
                crane_id: cost.crane_id || 'none',
                operator_id: cost.operator_id || 'none',
                service_id: cost.service_id || 'none',
                service_folio: cost.service_folio || '',
                subcategory: cost.subcategory || '',
                notes: cost.notes || '',
                cost_center_id: cost.cost_center_id || 'none',
                part_name: cost.crane_parts?.[0]?.part_name || '',
                supplier: cost.crane_parts?.[0]?.supplier || '',
                supplier_phone: cost.crane_parts?.[0]?.phone || '',
                quantity: cost.crane_parts?.[0]?.quantity || null,
                unit_price: cost.crane_parts?.[0]?.unit_price || null,
                kilometraje: cost.crane_parts?.[0]?.kilometraje || null,
                purchase_quantity: cost.purchase_quantity || null,
                purchase_unit_cost: cost.purchase_unit_cost || null,
                immediate_consumption: cost.immediate_consumption || false,
                supplier_id: cost.supplier_id || 'none',
            });
        } else if (prefilledData) {
            reset({
                date: prefilledData.date,
                description: prefilledData.description,
                amount: prefilledData.amount,
                category_id: prefilledData.category_id,
                crane_id: prefilledData.crane_id,
                operator_id: prefilledData.operator_id,
                service_id: prefilledData.service_id,
                service_folio: prefilledData.service_folio,
                subcategory: prefilledData.subcategory,
                notes: prefilledData.notes,
                cost_center_id: prefilledData.cost_center_id,
                purchase_quantity: prefilledData.purchase_quantity,
                purchase_unit_cost: prefilledData.purchase_unit_cost,
                immediate_consumption: prefilledData.immediate_consumption,
                supplier_id: prefilledData.supplier_id,
            });
            setCalculatedServiceTotal(0);
        } else {
            reset({
                date: getCurrentChileDateString(),
                description: '',
                amount: 0,
                category_id: '',
                crane_id: 'none',
                operator_id: 'none',
                service_id: 'none',
                service_folio: '',
                subcategory: '',
                notes: '',
                cost_center_id: 'none',
                purchase_quantity: null,
                purchase_unit_cost: null,
                immediate_consumption: false,
                supplier_id: 'none',
            });
            setCalculatedServiceTotal(0);
        }
    }, [cost, prefilledData, reset, isOpen]);
    
    const onSubmit = (values: CostFormValues) => {
        try {
            if (!values.category_id) {
                toast.error("Campo Requerido", { description: "Debe seleccionar una categoría" });
                setCurrentStep(1);
                return;
            }
            
            if (!values.description || values.description.trim() === '') {
                toast.error("Campo Requerido", { description: "La descripción es obligatoria" });
                setCurrentStep(1);
                return;
            }
            
            const validAmount = typeof values.amount === 'number' ? values.amount : parseFloat(String(values.amount)) || 0;
            if (validAmount <= 0) {
                toast.error("Valor Inválido", { description: "El monto debe ser mayor a 0" });
                setCurrentStep(2);
                return;
            }
            
            if (values.subcategory === 'Piezas y Repuestos') {
                if (!values.part_name || values.part_name.trim() === '') {
                    toast.error("Campo Requerido", { description: "El nombre de la pieza es obligatorio" });
                    setCurrentStep(2);
                    return;
                }
                if (!values.supplier || values.supplier.trim() === '') {
                    toast.error("Campo Requerido", { description: "El proveedor es obligatorio" });
                    setCurrentStep(2);
                    return;
                }
                if (!values.quantity || values.quantity <= 0) {
                    toast.error("Valor Inválido", { description: "La cantidad debe ser mayor a 0" });
                    setCurrentStep(2);
                    return;
                }
                if (!values.unit_price || values.unit_price <= 0) {
                    toast.error("Valor Inválido", { description: "El precio unitario debe ser mayor a 0" });
                    setCurrentStep(2);
                    return;
                }
            }
            
            const submissionData = {
                ...values,
                amount: validAmount,
                description: values.description.trim(),
                cost_center_id: values.cost_center_id === 'none' ? null : values.cost_center_id || null,
                supplier_id: values.supplier_id === 'none' ? null : values.supplier_id || null,
                part_name: values.part_name?.trim() || null,
                supplier: values.supplier?.trim() || null,
                supplier_phone: values.supplier_phone?.trim() || null,
                quantity: values.quantity || null,
                unit_price: values.unit_price || null,
                kilometraje: values.kilometraje || null,
                purchase_quantity: values.purchase_quantity || null,
                purchase_unit_cost: values.purchase_unit_cost || null,
                immediate_consumption: values.immediate_consumption || false,
            } as CostFormData;
        
            if (cost && cost.id) {
                updateCost({ id: cost.id, ...submissionData }, {
                    onSuccess: (data) => {
                        toast.success("Costo Actualizado", { description: "El costo se ha actualizado correctamente." });
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        
                        const isInventoryPurchase = submissionData.purchase_quantity && 
                                                   submissionData.purchase_quantity > 0 &&
                                                   submissionData.purchase_unit_cost &&
                                                   submissionData.immediate_consumption;
                        const hasNoCraneSelected = !submissionData.crane_id || submissionData.crane_id === 'none';
                        
                        onClose();
                        
                        if (isInventoryPurchase && hasNoCraneSelected && onInventoryCostCreated) {
                            onInventoryCostCreated({
                                costId: cost.id,
                                description: submissionData.description,
                                quantity: submissionData.purchase_quantity!,
                                unitCost: submissionData.purchase_unit_cost!,
                                date: submissionData.date,
                            });
                        }
                    },
                    onError: (error) => {
                        const errorMessage = error?.message || 'Error desconocido';
                        toast.error("Error al Actualizar", { 
                            description: `No se pudo actualizar el costo: ${errorMessage}` 
                        });
                    },
                });
            } else {
                addCost(submissionData, {
                    onSuccess: (data) => {
                        toast.success("Costo Agregado", { description: "El nuevo costo se ha registrado correctamente." });
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        
                        const isInventoryPurchase = submissionData.purchase_quantity && 
                                                   submissionData.purchase_quantity > 0 &&
                                                   submissionData.purchase_unit_cost &&
                                                   submissionData.immediate_consumption;
                        const hasNoCraneSelected = !submissionData.crane_id || submissionData.crane_id === 'none';
                        
                        if (isInventoryPurchase && hasNoCraneSelected && onInventoryCostCreated && data?.[0]) {
                            onInventoryCostCreated({
                                costId: data[0].id,
                                description: submissionData.description,
                                quantity: submissionData.purchase_quantity!,
                                unitCost: submissionData.purchase_unit_cost!,
                                date: submissionData.date,
                            });
                        }
                        
                        onClose();
                    },
                    onError: (error) => {
                        const errorMessage = error?.message || 'Error desconocido';
                        toast.error("Error al Agregar", { 
                            description: `No se pudo registrar el nuevo costo: ${errorMessage}` 
                        });
                    },
                });
            }
        } catch (validationError: any) {
            toast.error("Error de Validación", { 
                description: validationError.message || "Revise los datos ingresados" 
            });
        }
    };

    const handleNextStep = () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const isSubmitting = isAdding || isUpdating;

    return (
        <>
            <Dialog open={isOpen && !showServiceExpenseModals} onOpenChange={onClose}>
                <DialogContent className="bg-card border max-w-6xl max-h-[90vh] overflow-hidden p-0">
                    <div className="flex flex-col h-full max-h-[90vh]">
                        {/* Header */}
                        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
                            <DialogTitle className="text-2xl font-bold text-foreground">
                                {cost ? 'Editar Costo' : prefilledData ? 'Duplicar Costo' : 'Registrar Nuevo Costo'}
                            </DialogTitle>
                            <p className="text-muted-foreground">
                                {cost ? 'Modifica los datos del costo existente' : prefilledData ? 'Se ha pre-cargado la información del costo original.' : 'Completa la información del nuevo costo'}
                            </p>
                        </DialogHeader>

                        {/* Main Content - 2 Column Layout */}
                        <div className="flex-1 overflow-hidden">
                            <div className="grid grid-cols-1 lg:grid-cols-4 h-full">
                                {/* Left Sidebar - Navigation & Summary */}
                                <div className="lg:col-span-1 border-r bg-muted/30 p-4 overflow-y-auto space-y-4">
                                    <CostFormStepNavigation
                                        steps={steps}
                                        currentStep={currentStep}
                                        onStepClick={setCurrentStep}
                                    />
                                    
                                    <div className="hidden lg:block">
                                        <CostSummaryPanel {...summaryData} />
                                    </div>
                                </div>

                                {/* Right Content - Form Steps */}
                                <div className="lg:col-span-3 flex flex-col overflow-hidden">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
                                            {/* Step Content */}
                                            <div className="flex-1 overflow-y-auto p-6">
                                                {currentStep === 1 && (
                                                    <CostFormStep1
                                                        form={form}
                                                        categories={categories}
                                                        isLoadingCategories={isLoadingCategories}
                                                        isNewCost={!cost}
                                                        onServiceExpenseSelect={!cost ? handleServiceExpenseSelect : undefined}
                                                    />
                                                )}
                                                {currentStep === 2 && (
                                                    <CostFormStep2
                                                        form={form}
                                                        categories={categories}
                                                        isNewCost={!cost}
                                                        onServiceExpenseSelect={!cost ? handleServiceExpenseSelect : undefined}
                                                        calculatedServiceTotal={calculatedServiceTotal}
                                                    />
                                                )}
                                                {currentStep === 3 && (
                                                    <CostFormStep3
                                                        form={form}
                                                        cranes={cranes}
                                                        isLoadingCranes={isLoadingCranes}
                                                        operators={operators}
                                                        isLoadingOperators={isLoadingOperators}
                                                        services={servicesForCosts}
                                                        isLoadingServices={isLoadingServices}
                                                    />
                                                )}
                                                {currentStep === 4 && (
                                                    <CostFormStep4 form={form} />
                                                )}
                                            </div>

                                            {/* Footer - Navigation Buttons */}
                                            <div className="border-t bg-muted/30 px-6 py-4 flex items-center justify-between">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevStep}
                                                    disabled={currentStep === 1}
                                                    className="gap-2"
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                    Anterior
                                                </Button>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Paso {currentStep} de 4
                                                    </span>
                                                </div>

                                                <div className="flex gap-2">
                                                    {currentStep < 4 ? (
                                                        <Button
                                                            type="button"
                                                            onClick={handleNextStep}
                                                            className="gap-2 bg-violet-600 hover:bg-violet-700"
                                                        >
                                                            Siguiente
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            type="submit"
                                                            disabled={isSubmitting}
                                                            className="gap-2 bg-violet-600 hover:bg-violet-700"
                                                        >
                                                            {isSubmitting ? (
                                                                <>
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                    Guardando...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Save className="h-4 w-4" />
                                                                    {cost ? 'Actualizar' : 'Guardar'}
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </form>
                                    </Form>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ServiceExpenseModals
                isOpen={showServiceExpenseModals}
                onClose={() => setShowServiceExpenseModals(false)}
                onComplete={(totalAmount) => handleServiceExpenseComplete(totalAmount)}
                baseData={{
                    date: form.getValues('date'),
                    category_id: categories.find(cat => cat.name === 'Gastos de Servicios')?.id || '',
                    crane_id: form.getValues('crane_id'),
                    operator_id: form.getValues('operator_id'),
                    service_id: form.getValues('service_id'),
                    service_folio: form.getValues('service_folio'),
                }}
            />
        </>
    );
};
