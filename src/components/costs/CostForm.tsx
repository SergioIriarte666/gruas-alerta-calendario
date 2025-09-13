import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Cost, CostFormData } from '@/types/costs';
import { useAddCost, useUpdateCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServices } from '@/hooks/useServices';
import { costSchema, CostFormValues } from '@/schemas/costSchema';
import { CostFormInputs } from './form/CostFormInputs';
import { CostFormActions } from './form/CostFormActions';
import { ServiceExpenseModals } from './ServiceExpenseModals';
import { toast } from 'sonner';
import { getCurrentChileDateString, formatForInput } from '@/utils/timezoneUtils';
import { useQueryClient } from '@tanstack/react-query';

interface CostFormProps {
    isOpen: boolean;
    onClose: () => void;
    cost: Cost | null;
}

export const CostForm = ({ isOpen, onClose, cost }: CostFormProps) => {
    console.log('[CostForm] Rendered with cost:', cost, 'isNewCost:', !cost);
    const queryClient = useQueryClient();
    const { mutate: addCost, isPending: isAdding, error: addError } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating, error: updateError } = useUpdateCost();
    
    const [showServiceExpenseModals, setShowServiceExpenseModals] = React.useState(false);
    const [calculatedServiceTotal, setCalculatedServiceTotal] = React.useState(0);
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, loading: isLoadingCranes } = useCranes();
    const { data: operators = [], isLoading: isLoadingOperators } = useOperatorsData();
    const { getServicesForCosts, services, loading: isLoadingServices } = useServices();

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
        },
    });
    const { reset, watch, setValue } = form;

    const selectedServiceId = watch('service_id');
    const selectedCategoryId = watch('category_id');

    useEffect(() => {
        if (selectedServiceId && selectedServiceId !== 'none') {
            const selectedService = services.find(service => service.id === selectedServiceId);
            if (selectedService) {
                console.log('[CostForm] Auto-filling fields for selected service:', selectedService.folio);
                
                setValue('crane_id', selectedService.crane?.id || 'none');
                setValue('operator_id', selectedService.operator?.id || 'none');
                setValue('service_folio', selectedService.folio);
                
                toast.success("Campos Completados", { 
                    description: "Se han llenado automáticamente los campos relacionados al servicio" 
                });
            }
        }
    }, [selectedServiceId, services, setValue]);

    const handleServiceExpenseSelect = () => {
        console.log('[CostForm] Service expense selected - opening specialized modals');
        
        // Validar que se haya seleccionado un servicio primero
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
        console.log('[CostForm] Service expense completed - total:', totalAmount);
        setShowServiceExpenseModals(false);
        
        if (totalAmount && totalAmount > 0) {
            setCalculatedServiceTotal(totalAmount);
            setValue('amount', totalAmount);
            toast.success("Gastos Desglosados", { 
                description: `Se crearon los costos desglosados por un total de $${totalAmount.toLocaleString()}` 
            });
            
            // Cerrar el formulario principal después del desglose exitoso
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

            const initialValues = {
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
            };
            console.log('[CostForm] Setting form values for editing:', initialValues);
            reset(initialValues);
        } else {
            const defaultValues = {
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
            };
            console.log('[CostForm] Setting default values for new cost:', defaultValues);
            reset(defaultValues);
            setCalculatedServiceTotal(0);
        }
    }, [cost, reset, isOpen]);
    
    const onSubmit = (values: CostFormValues) => {
        console.log('[CostForm] Submitting form with values:', values);
        
        try {
            if (!values.category_id) {
                toast.error("Campo Requerido", { description: "Debe seleccionar una categoría" });
                return;
            }
            
            if (!values.description || values.description.trim() === '') {
                toast.error("Campo Requerido", { description: "La descripción es obligatoria" });
                return;
            }
            
            const validAmount = typeof values.amount === 'number' ? values.amount : parseFloat(String(values.amount)) || 0;
            if (validAmount <= 0) {
                toast.error("Valor Inválido", { description: "El monto debe ser mayor a 0" });
                return;
            }
            
            if (values.subcategory === 'Piezas y Repuestos') {
                if (!values.part_name || values.part_name.trim() === '') {
                    toast.error("Campo Requerido", { description: "El nombre de la pieza es obligatorio" });
                    return;
                }
                if (!values.supplier || values.supplier.trim() === '') {
                    toast.error("Campo Requerido", { description: "El proveedor es obligatorio" });
                    return;
                }
                if (!values.quantity || values.quantity <= 0) {
                    toast.error("Valor Inválido", { description: "La cantidad debe ser mayor a 0" });
                    return;
                }
                if (!values.unit_price || values.unit_price <= 0) {
                    toast.error("Valor Inválido", { description: "El precio unitario debe ser mayor a 0" });
                    return;
                }
            }
            
            const submissionData = {
                ...values,
                amount: validAmount,
                description: values.description.trim(),
                cost_center_id: values.cost_center_id === 'none' ? null : values.cost_center_id || null,
                part_name: values.part_name?.trim() || null,
                supplier: values.supplier?.trim() || null,
                supplier_phone: values.supplier_phone?.trim() || null,
                quantity: values.quantity || null,
                unit_price: values.unit_price || null,
                kilometraje: values.kilometraje || null,
            } as CostFormData;
            
            console.log('[CostForm] Final submission data after validation:', submissionData);
        
            if (cost && cost.id) {
                updateCost({ id: cost.id, ...submissionData }, {
                    onSuccess: (data) => {
                        console.log('[CostForm] Update cost success:', data);
                        toast.success("Costo Actualizado", { description: "El costo se ha actualizado correctamente." });
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        onClose();
                    },
                    onError: (error) => {
                        console.error("[CostForm] Update cost failed:", error);
                        const errorMessage = error?.message || 'Error desconocido';
                        toast.error("Error al Actualizar", { 
                            description: `No se pudo actualizar el costo: ${errorMessage}` 
                        });
                    },
                });
            } else {
                addCost(submissionData, {
                    onSuccess: (data) => {
                        console.log('[CostForm] Add cost success:', data);
                        toast.success("Costo Agregado", { description: "El nuevo costo se ha registrado correctamente." });
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        onClose();
                    },
                    onError: (error) => {
                        console.error("[CostForm] Add cost failed:", error);
                        const errorMessage = error?.message || 'Error desconocido';
                        toast.error("Error al Agregar", { 
                            description: `No se pudo registrar el nuevo costo: ${errorMessage}` 
                        });
                    },
                });
            }
        } catch (validationError: any) {
            console.error("[CostForm] Validation error:", validationError);
            toast.error("Error de Validación", { 
                description: validationError.message || "Revise los datos ingresados" 
            });
        }
    };

    return (
        <>
            <Dialog open={isOpen && !showServiceExpenseModals} onOpenChange={onClose}>
                <DialogContent className="bg-card border max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-foreground">
                            {cost ? 'Editar Costo' : 'Registrar Nuevo Costo'}
                        </DialogTitle>
                        <p className="text-muted-foreground">
                            {cost ? 'Modifica los datos del costo existente' : 'Completa la información del nuevo costo'}
                        </p>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <CostFormInputs
                                form={form}
                                categories={categories}
                                isLoadingCategories={isLoadingCategories}
                                cranes={cranes}
                                isLoadingCranes={isLoadingCranes}
                                operators={operators}
                                isLoadingOperators={isLoadingOperators}
                                services={servicesForCosts}
                                isLoadingServices={isLoadingServices}
                                isNewCost={!cost}
                                onServiceExpenseSelect={!cost ? handleServiceExpenseSelect : undefined}
                                calculatedServiceTotal={calculatedServiceTotal}
                            />
                            <CostFormActions onClose={onClose} isSubmitting={isAdding || isUpdating} />
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>

            <ServiceExpenseModals
                isOpen={showServiceExpenseModals}
                onClose={() => {
                    console.log('[CostForm] Closing service expense modals');
                    setShowServiceExpenseModals(false);
                }}
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
