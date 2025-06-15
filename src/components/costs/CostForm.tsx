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
import { useToast } from '@/hooks/use-toast';

interface CostFormProps {
    isOpen: boolean;
    onClose: () => void;
    cost: Cost | null;
}

export const CostForm = ({ isOpen, onClose, cost }: CostFormProps) => {
    const { mutate: addCost, isPending: isAdding } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating } = useUpdateCost();
    const { toast } = useToast();
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, loading: isLoadingCranes } = useCranes();
    const { data: operators = [], isLoading: isLoadingOperators } = useOperatorsData();
    const { services, loading: isLoadingServices } = useServices();

    const form = useForm<CostFormValues>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            amount: 0,
            category_id: '',
            crane_id: 'none',
            operator_id: 'none',
            service_id: 'none',
            service_folio: '',
            notes: '',
        },
    });
    const { reset } = form;

    useEffect(() => {
        if (cost) {
            const dateValue = (cost.date && typeof cost.date === 'string')
                ? cost.date.split('T')[0]
                : new Date().toISOString().split('T')[0];

            const initialValues = {
                date: dateValue,
                description: cost.description,
                amount: Number(cost.amount),
                category_id: cost.category_id,
                crane_id: cost.crane_id || 'none',
                operator_id: cost.operator_id || 'none',
                service_id: cost.service_id || 'none',
                service_folio: cost.service_folio || '',
                notes: cost.notes || '',
            };
            reset(initialValues);
        } else {
            const defaultValues = {
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                category_id: '',
                crane_id: 'none',
                operator_id: 'none',
                service_id: 'none',
                service_folio: '',
                notes: '',
            };
            reset(defaultValues);
        }
    }, [cost, reset, isOpen]);
    
    const onSubmit = (values: CostFormValues) => {
        const submissionData = values as CostFormData;
        if (cost && cost.id) {
            updateCost({ id: cost.id, ...submissionData }, {
                onSuccess: () => {
                    toast({ title: "Costo Actualizado", description: "El costo se ha actualizado correctamente." });
                    onClose();
                },
                onError: (error) => {
                    console.error("[CostForm] Update cost failed:", error);
                    toast({ title: "Error al Actualizar", description: "No se pudo actualizar el costo.", variant: "destructive" });
                },
            });
        } else {
            addCost(submissionData, {
                onSuccess: () => {
                    toast({ title: "Costo Agregado", description: "El nuevo costo se ha registrado correctamente." });
                    onClose();
                },
                onError: (error) => {
                    console.error("[CostForm] Add cost failed:", error);
                    toast({ title: "Error al Agregar", description: "No se pudo registrar el nuevo costo.", variant: "destructive" });
                },
            });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-tms-dark text-white border-gray-700">
                <DialogHeader>
                    <DialogTitle>{cost ? 'Editar Costo' : 'Registrar Nuevo Costo'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <CostFormInputs
                            form={form}
                            categories={categories}
                            isLoadingCategories={isLoadingCategories}
                            cranes={cranes}
                            isLoadingCranes={isLoadingCranes}
                            operators={operators}
                            isLoadingOperators={isLoadingOperators}
                            services={services}
                            isLoadingServices={isLoadingServices}
                        />
                        <CostFormActions onClose={onClose} isSubmitting={isAdding || isUpdating} />
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
