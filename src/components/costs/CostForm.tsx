
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Cost, CostFormData } from '@/types/costs';
import { useAddCost, useUpdateCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useServices } from '@/hooks/useServices';
import { costSchema, CostFormValues } from '@/schemas/costSchema';
import { CostFormInputs } from './form/CostFormInputs';
import { CostFormActions } from './form/CostFormActions';

interface CostFormProps {
    isOpen: boolean;
    onClose: () => void;
    cost: Cost | null;
}

export const CostForm = ({ isOpen, onClose, cost }: CostFormProps) => {
    console.log(`CostForm rendered. isOpen: ${isOpen}`);
    const { mutate: addCost, isPending: isAdding } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating } = useUpdateCost();
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, loading: isLoadingCranes } = useCranes();
    const { operators, loading: isLoadingOperators } = useOperators();
    const { services, loading: isLoadingServices } = useServices();

    const form = useForm<CostFormValues>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            amount: 0,
            category_id: '',
            crane_id: null,
            operator_id: null,
            service_id: null,
            service_folio: null,
            notes: null,
        },
    });
    const { reset } = form;

    useEffect(() => {
        console.log('CostForm useEffect triggered.', { isOpen, costExists: !!cost });
        if (cost) {
            const dateValue = (cost.date && typeof cost.date === 'string')
                ? cost.date.split('T')[0]
                : new Date().toISOString().split('T')[0];

            reset({
                date: dateValue,
                description: cost.description,
                amount: Number(cost.amount),
                category_id: cost.category_id,
                crane_id: cost.crane_id || null,
                operator_id: cost.operator_id || null,
                service_id: cost.service_id || null,
                service_folio: cost.service_folio || null,
                notes: cost.notes || null,
            });
        } else {
            reset({
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                category_id: '',
                crane_id: null,
                operator_id: null,
                service_id: null,
                service_folio: null,
                notes: null,
            });
        }
    }, [cost, reset, isOpen]);
    
    const onSubmit = (values: CostFormValues) => {
        console.log("Submitting validated values:", values);
        const submissionData = values as CostFormData;
        if (cost) {
            updateCost({ id: cost.id, ...submissionData }, {
                onSuccess: onClose,
                onError: (error) => {
                    console.error("Update cost failed:", error);
                    console.error("Data that failed:", submissionData);
                },
            });
        } else {
            addCost(submissionData, {
                onSuccess: onClose,
                onError: (error) => {
                    console.error("Add cost failed:", error);
                    console.error("Data that failed:", submissionData);
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
