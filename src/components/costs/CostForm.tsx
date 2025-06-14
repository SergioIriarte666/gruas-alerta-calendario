
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Cost, CostFormData } from '@/types/costs';
import { useAddCost, useUpdateCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useServices } from '@/hooks/useServices';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';


interface CostFormProps {
    isOpen: boolean;
    onClose: () => void;
    cost: Cost | null;
}

const costSchema = z.object({
    date: z.string().nonempty('La fecha es requerida'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    amount: z.coerce.number().positive('El monto debe ser un número positivo'),
    category_id: z.string().nonempty('La categoría es requerida'),
    crane_id: z.string().optional().nullable().transform(val => val || null),
    operator_id: z.string().optional().nullable().transform(val => val || null),
    service_id: z.string().optional().nullable().transform(val => val || null),
    notes: z.string().optional().nullable(),
});

export const CostForm = ({ isOpen, onClose, cost }: CostFormProps) => {
    const { mutate: addCost, isPending: isAdding } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating } = useUpdateCost();
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, loading: isLoadingCranes } = useCranes();
    const { operators, loading: isLoadingOperators } = useOperators();
    const { services, isLoading: isLoadingServices } = useServices();

    const form = useForm<z.infer<typeof costSchema>>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            date: new Date().toISOString().split('T')[0],
            description: '',
            amount: 0,
            category_id: '',
            crane_id: null,
            operator_id: null,
            service_id: null,
            notes: '',
        },
    });

    useEffect(() => {
        if (cost) {
            form.reset({
                ...cost,
                date: new Date(cost.date).toISOString().split('T')[0],
                amount: Number(cost.amount),
                crane_id: cost.crane_id || null,
                operator_id: cost.operator_id || null,
                service_id: cost.service_id || null,
            });
        } else {
            form.reset({
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: 0,
                category_id: '',
                crane_id: null,
                operator_id: null,
                service_id: null,
                notes: '',
            });
        }
    }, [cost, form, isOpen]);
    
    const onSubmit = (values: z.infer<typeof costSchema>) => {
        const submissionData = values as CostFormData;
        if (cost) {
            updateCost({ id: cost.id, ...submissionData }, {
                onSuccess: onClose,
            });
        } else {
            addCost(submissionData, {
                onSuccess: onClose,
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField name="date" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Fecha</Label>
                                    <FormControl><Input type="date" {...field} className="bg-white/10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField name="amount" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Monto</Label>
                                    <FormControl><Input type="number" step="0.01" {...field} className="bg-white/10" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField name="description" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Descripción</Label>
                                <FormControl><Input {...field} className="bg-white/10" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField name="category_id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Categoría</Label>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                                    <FormControl>
                                        <SelectTrigger className="bg-white/10"><SelectValue placeholder="Seleccione una categoría" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField name="crane_id" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Grúa (Opcional)</Label>
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingCranes}>
                                        <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">Sin asociar</SelectItem>
                                            {cranes.map(c => <SelectItem key={c.id} value={c.id}>{`${c.brand} ${c.model}`}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="operator_id" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Operador (Opcional)</Label>
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingOperators}>
                                        <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">Sin asociar</SelectItem>
                                            {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField name="service_id" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Servicio (Opcional)</Label>
                                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingServices}>
                                        <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="">Sin asociar</SelectItem>
                                            {services.map(s => <SelectItem key={s.id} value={s.id}>{s.folio}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <FormField name="notes" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Notas (Opcional)</Label>
                                <FormControl><Textarea {...field} value={field.value ?? ''} className="bg-white/10" /></FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="outline" className="text-white hover:bg-white/20" onClick={onClose}>Cancelar</Button>
                            <Button type="submit" className="bg-tms-green hover:bg-tms-green/90" disabled={isAdding || isUpdating}>
                                {isAdding || isUpdating ? 'Guardando...' : 'Guardar Costo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
