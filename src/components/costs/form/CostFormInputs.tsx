import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CostCategory } from '@/types/costs';
import { CostFormValues } from '@/schemas/costSchema';
import { Crane, Operator, Service } from '@/types';

interface CostFormInputsProps {
    form: UseFormReturn<CostFormValues>;
    categories: CostCategory[];
    isLoadingCategories: boolean;
    cranes: Crane[];
    isLoadingCranes: boolean;
    operators: Operator[];
    isLoadingOperators: boolean;
    services: Service[];
    isLoadingServices: boolean;
}

export const CostFormInputs = ({
    form,
    categories,
    isLoadingCategories,
    cranes,
    isLoadingCranes,
    operators,
    isLoadingOperators,
    services,
    isLoadingServices
}: CostFormInputsProps) => {
    return (
        <>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="crane_id" control={form.control} render={({ field }) => (
                    <FormItem>
                        <Label>Grúa (Opcional)</Label>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value ?? 'none'}
                            disabled={isLoadingCranes}
                        >
                            <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">Sin asociar</SelectItem>
                                {cranes.map(c => <SelectItem key={c.id} value={c.id}>{c.licensePlate}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField name="operator_id" control={form.control} render={({ field }) => (
                    <FormItem>
                        <Label>Operador (Opcional)</Label>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value ?? 'none'}
                            disabled={isLoadingOperators}
                        >
                            <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">Sin asociar</SelectItem>
                                {operators.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField name="service_id" control={form.control} render={({ field }) => (
                    <FormItem>
                        <Label>Servicio (Opcional)</Label>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value ?? 'none'}
                            disabled={isLoadingServices}
                        >
                            <FormControl><SelectTrigger className="bg-white/10"><SelectValue placeholder="Sin asociar" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="none">Sin asociar</SelectItem>
                                {services.map(s => <SelectItem key={s.id} value={s.id}>{s.folio}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </FormItem>
                )} />
                <FormField name="service_folio" control={form.control} render={({ field }) => (
                    <FormItem>
                        <Label>Folio de Servicio (Opcional)</Label>
                        <FormControl><Input {...field} value={field.value ?? ''} className="bg-white/10" placeholder="Ej: F-1234" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            <FormField name="notes" control={form.control} render={({ field }) => (
                <FormItem>
                    <Label>Notas (Opcional)</Label>
                    <FormControl><Textarea {...field} value={field.value ?? ''} className="bg-white/10" /></FormControl>
                </FormItem>
            )} />
        </>
    );
};
