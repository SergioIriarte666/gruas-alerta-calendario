
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CostCategory, MAINTENANCE_SUBCATEGORIES } from '@/types/costs';
import { CostFormValues } from '@/schemas/costSchema';
import { Crane, Operator, Service } from '@/types';
import { ServiceSelector } from './ServiceSelector';
import { CostAmountSection } from './CostAmountSection';
import { useCostCenters } from '@/hooks/useCostCenters';
import { Package, User, Phone, Hash, DollarSign, Gauge, Calendar, FileText, Tag, Building2 } from 'lucide-react';

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
    isNewCost?: boolean;
    onServiceExpenseSelect?: () => void;
    calculatedServiceTotal?: number;
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
    isLoadingServices,
    isNewCost = false,
    onServiceExpenseSelect,
    calculatedServiceTotal = 0
}: CostFormInputsProps) => {
    const { data: costCenters = [] } = useCostCenters();
    const selectedCategoryId = form.watch('category_id');
    const selectedSubcategory = form.watch('subcategory');
    const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);
    const isGastosDeServicios = selectedCategory?.name === 'Gastos de Servicios';
    const isMantenimiento = selectedCategory?.name === 'Mantenimiento';
    const isPiezasYRepuestos = isMantenimiento && selectedSubcategory === 'Piezas y Repuestos';

    const subcategorias = ['Combustible', 'Peajes', 'Otros'];

    const quantity = form.watch('quantity');
    const unitPrice = form.watch('unit_price');
    
    // Calcular automáticamente el monto total para piezas y repuestos
    React.useEffect(() => {
        if (isPiezasYRepuestos && quantity && unitPrice) {
            const total = quantity * unitPrice;
            form.setValue('amount', total);
        }
    }, [quantity, unitPrice, isPiezasYRepuestos, form]);

    return (
        <div className="space-y-6">
            {/* Sección Principal - Información Básica */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5" />
                        Información Básica
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField name="date" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Fecha
                                </Label>
                                <FormControl>
                                    <Input type="date" {...field} className="bg-white/10" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField name="category_id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label className="flex items-center gap-2">
                                    <Tag className="w-4 h-4" />
                                    Categoría *
                                </Label>
                                <Select 
                                    onValueChange={(value) => {
                                        const category = categories.find(cat => cat.id === value);
                                        field.onChange(value);
                                        
                                        // Si es nuevo costo y selecciona "Gastos de Servicios", preparar para desglose
                                        if (category?.name === 'Gastos de Servicios' && isNewCost && onServiceExpenseSelect) {
                                            // No abrir inmediatamente, solo preparar la interfaz
                                            form.setValue('amount', 0);
                                        }
                                    }}
                                    value={field.value} 
                                    disabled={isLoadingCategories}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-white/10">
                                            <SelectValue placeholder="Seleccione una categoría" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField name="description" control={form.control} render={({ field }) => (
                        <FormItem>
                            <Label className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Descripción *
                            </Label>
                            <FormControl>
                                <Input {...field} className="bg-white/10" placeholder="Describe el costo o gasto..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            {/* Sección de Monto - Usando el nuevo componente */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <DollarSign className="w-5 h-5" />
                        Monto
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CostAmountSection
                        form={form}
                        isServiceExpense={isGastosDeServicios}
                        onServiceExpenseClick={onServiceExpenseSelect}
                        calculatedTotal={calculatedServiceTotal}
                        showServiceButton={isNewCost && isGastosDeServicios && !!onServiceExpenseSelect}
                    />
                </CardContent>
            </Card>

            {/* Subcategorías */}
            {(isGastosDeServicios || isMantenimiento) && (
                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Tag className="w-5 h-5" />
                            Subcategoría
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isGastosDeServicios && (
                            <FormField name="subcategory" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Tipo de Gasto</Label>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/10">
                                                <SelectValue placeholder="Seleccione tipo de gasto" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {subcategorias.map(sub => (
                                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}

                        {isMantenimiento && (
                            <FormField name="subcategory" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label>Tipo de Mantenimiento</Label>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                        <FormControl>
                                            <SelectTrigger className="bg-white/10">
                                                <SelectValue placeholder="Seleccione tipo de mantenimiento" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {MAINTENANCE_SUBCATEGORIES.map(sub => (
                                                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Campos específicos para Piezas y Repuestos */}
            {isPiezasYRepuestos && (
                <Card className="bg-blue-900/20 border-blue-600">
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-blue-200">
                            <Package className="w-5 h-5" />
                            Información de Piezas y Repuestos
                        </CardTitle>
                        <p className="text-sm text-blue-300">
                            Complete los detalles específicos de la pieza o repuesto
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField name="part_name" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Nombre de la Pieza *
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="Ej: Filtro de aceite, Pastillas de freno..."
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="supplier" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Proveedor *
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="Nombre del proveedor"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="supplier_phone" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <Phone className="w-4 h-4" />
                                        Teléfono del Proveedor
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="Ej: +56 9 1234 5678"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="quantity" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <Hash className="w-4 h-4" />
                                        Cantidad *
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            min="1" 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="1"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="unit_price" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        Precio Unitario *
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            step="0.01" 
                                            min="0" 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="0.00"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField name="kilometraje" control={form.control} render={({ field }) => (
                                <FormItem>
                                    <Label className="flex items-center gap-2">
                                        <Gauge className="w-4 h-4" />
                                        Kilometraje (Opcional)
                                    </Label>
                                    <FormControl>
                                        <Input 
                                            type="number" 
                                            min="0" 
                                            {...field} 
                                            value={field.value || ''} 
                                            className="bg-white/10" 
                                            placeholder="Ej: 50000"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    </CardContent>
                </Card>
            )}
            
            {/* Asociaciones - Grúa, Operador, Servicio */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2 className="w-5 h-5" />
                        Asociaciones (Opcional)
                    </CardTitle>
                    <p className="text-sm text-gray-400">
                        Asocia este costo con grúas, operadores o servicios específicos
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField name="crane_id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Grúa</Label>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value ?? 'none'}
                                    disabled={isLoadingCranes}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-white/10">
                                            <SelectValue placeholder="Sin asociar" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Sin asociar</SelectItem>
                                        {cranes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.licensePlate}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />

                        <FormField name="operator_id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Operador</Label>
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value ?? 'none'}
                                    disabled={isLoadingOperators}
                                >
                                    <FormControl>
                                        <SelectTrigger className="bg-white/10">
                                            <SelectValue placeholder="Sin asociar" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">Sin asociar</SelectItem>
                                        {operators.map(op => (
                                            <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField name="service_id" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Servicio</Label>
                                <ServiceSelector
                                    services={services}
                                    value={field.value ?? 'none'}
                                    onValueChange={field.onChange}
                                    isLoading={isLoadingServices}
                                />
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField name="service_folio" control={form.control} render={({ field }) => (
                            <FormItem>
                                <Label>Folio de Servicio</Label>
                                <FormControl>
                                    <Input 
                                        {...field} 
                                        value={field.value ?? ''} 
                                        className="bg-white/10" 
                                        placeholder="Ej: F-1234" 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    <FormField name="cost_center_id" control={form.control} render={({ field }) => (
                        <FormItem>
                            <Label>Centro de Costo</Label>
                            <Select 
                                onValueChange={field.onChange} 
                                value={field.value || 'none'} 
                                disabled={!costCenters.length}
                            >
                                <FormControl>
                                    <SelectTrigger className="bg-white/10">
                                        <SelectValue placeholder="Sin centro de costo" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Sin centro de costo</SelectItem>
                                    {costCenters
                                        .filter(center => center.is_active)
                                        .map((center) => (
                                            <SelectItem key={center.id} value={center.id}>
                                                {center.code} - {center.name}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
            </Card>

            {/* Notas adicionales */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <FileText className="w-5 h-5" />
                        Información Adicional
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <FormField name="notes" control={form.control} render={({ field }) => (
                        <FormItem>
                            <Label>Notas y Observaciones</Label>
                            <FormControl>
                                <Textarea 
                                    {...field} 
                                    value={field.value ?? ''} 
                                    className="bg-white/10 min-h-[80px]" 
                                    placeholder="Agrega notas adicionales, observaciones o detalles importantes..."
                                />
                            </FormControl>
                        </FormItem>
                    )} />
                </CardContent>
            </Card>
        </div>
    );
};
