import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Cost, CostFormData } from '@/types/costs';
import { useAddCost, useUpdateCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCranes } from '@/hooks/useCranes';
import { LOWBOY_CRANE_IDS } from '@/lib/entities';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServices } from '@/hooks/useServices';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useCostCenters } from '@/hooks/useCostCenters';
import { costSchema, CostFormValues } from '@/schemas/costSchema';
import { ServiceExpenseModals } from './ServiceExpenseModals';
import { ManualCostXmlImportDialog } from './ManualCostXmlImportDialog';
import { CostFormStepNavigation, getCostFormSteps, CostFormStep } from './form/CostFormStepNavigation';
import { CostSummaryPanel } from './form/CostSummaryPanel';
import { CostFormStep1 } from './form/CostFormStep1';
import { CostFormStep2 } from './form/CostFormStep2';
import { CostFormStep3 } from './form/CostFormStep3';
import { CostFormStep4 } from './form/CostFormStep4';
import { toast } from 'sonner';
import { getCurrentChileDateString, formatForInput } from '@/utils/timezoneUtils';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Save, Loader2, FileUp } from 'lucide-react';
import { UnifiedPurchaseService } from '@/services/UnifiedPurchaseService';
import { supabase } from '@/integrations/supabase/client';
import { useQuickEntry } from '@/hooks/useQuickEntry';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CostForm");
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

export const CostForm = React.memo(({ isOpen, onClose, cost, prefilledData, onInventoryCostCreated }: CostFormProps) => {
    const queryClient = useQueryClient();
    const { mutate: addCost, isPending: isAdding } = useAddCost();
    const { mutate: updateCost, isPending: isUpdating } = useUpdateCost();
    const { deleteEntry } = useQuickEntry();
    
    const [currentStep, setCurrentStep] = useState(1);
    const [showServiceExpenseModals, setShowServiceExpenseModals] = useState(false);
    const [isManualXmlImportOpen, setIsManualXmlImportOpen] = useState(false);
    const [calculatedServiceTotal, setCalculatedServiceTotal] = useState(0);
    const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
    const isInitialMount = useRef(true);
    
    const { data: categories = [], isLoading: isLoadingCategories } = useCostCategories();
    const { cranes, operationalCranes, loading: isLoadingCranes } = useCranes();
    const { data: operators = [], isLoading: isLoadingOperators } = useOperatorsData();
    const { getServicesForCosts, services, loading: isLoadingServices } = useServices();
    const { suppliers = [] } = useSuppliers();
    const { data: costCenters = [] } = useCostCenters();

    const servicesForCosts = getServicesForCosts();

    const isQuickEntryPrefill = Boolean((prefilledData as Record<string, unknown>)?.quickEntryId);
    const receiptPhotoPaths = useMemo(
        () => ((((prefilledData as Record<string, unknown>)?.receipt_photo_paths as string[] | undefined) || []).filter(Boolean)),
        [prefilledData],
    );
    const receiptPhotoPathsKey = useMemo(() => receiptPhotoPaths.join('|'), [receiptPhotoPaths]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!isOpen || !isQuickEntryPrefill || receiptPhotoPaths.length === 0) {
                setReceiptUrls([]);
                return;
            }

            const results = await Promise.all(
                receiptPhotoPaths.map(async (path) => {
                    const { data } = await supabase.storage
                        .from('quick-entry-photos')
                        .createSignedUrl(path, 60 * 60 * 24 * 7);
                    return data?.signedUrl || '';
                }),
            );

            if (!cancelled) setReceiptUrls(results.filter(Boolean));
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [isOpen, isQuickEntryPrefill, receiptPhotoPathsKey]);

    const form = useForm<CostFormValues>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            date: getCurrentChileDateString(),
            description: '',
            amount: 0,
            category_id: '',
            entity: 'gruas_5_norte',
            paid_by: 'gruas_5_norte',
            crane_id: 'none',
            operator_id: 'none',
            service_id: 'none',
            service_folio: '',
            subcategory: '',
            notes: '',
            document_type: 'none',
            document_number: '',
            location_text: '',
            other_reason: '',
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

    // Grúas elegibles en el selector: operacionales + la grúa actual del costo en edición
    // aunque esté vendida/dada de baja (para no vaciar el campo). Si la entidad es LowBoy,
    // se restringe SOLO a los equipos LowBoy del maestro (nunca al revés: entity no se infiere de crane_id).
    const selectableCranes = useMemo(() => {
        if (watchedValues.entity === 'lowboy') {
            return cranes.filter(c => (LOWBOY_CRANE_IDS as readonly string[]).includes(c.id));
        }
        const currentCrane = cost?.crane_id ? cranes.find(c => c.id === cost.crane_id) : undefined;
        if (currentCrane && !operationalCranes.some(c => c.id === currentCrane.id)) {
            return [...operationalCranes, currentCrane];
        }
        return operationalCranes;
    }, [cranes, operationalCranes, cost?.crane_id, watchedValues.entity]);

    // Auto-fill fields when service is selected
    useEffect(() => {
        // En modo edición (cost existe), no auto-rellenar al montar —
        // los valores ya fueron cargados en el reset inicial.
        // Solo auto-rellenar cuando el usuario cambia activamente el servicio.
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

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
            isInitialMount.current = true; // reset para la próxima apertura
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
            const hasImmediateConsumptionAssociation = Boolean(
                cost.immediate_consumption ||
                (cost.crane_parts && cost.crane_parts.length > 0)
            );

            reset({
                date: dateValue,
                description: cost.description,
                amount: Number(cost.amount),
                category_id: cost.category_id,
                entity: (((cost as Record<string, unknown>).entity as 'gruas_5_norte' | 'lowboy') || 'gruas_5_norte'),
                paid_by: (((cost as Record<string, unknown>).paid_by as 'gruas_5_norte' | 'lowboy') || 'gruas_5_norte'),
                crane_id: cost.crane_id || 'none',
                operator_id: cost.operator_id || 'none',
                service_id: cost.service_id || 'none',
                service_folio: cost.service_folio || '',
                subcategory: cost.subcategory || '',
                notes: cost.notes || '',
                document_type: ((cost as Record<string, unknown>).document_type as string | null) || 'none',
                document_number: ((cost as Record<string, unknown>).document_number as string | null) || '',
                location_text: ((cost as Record<string, unknown>).location_text as string | null) || '',
                other_reason: ((cost as Record<string, unknown>).other_reason as string | null) || '',
                cost_center_id: cost.cost_center_id || 'none',
                part_name: cost.crane_parts?.[0]?.part_name || '',
                supplier: cost.crane_parts?.[0]?.supplier || '',
                supplier_phone: cost.crane_parts?.[0]?.phone || '',
                quantity: cost.crane_parts?.[0]?.quantity || null,
                unit_price: cost.crane_parts?.[0]?.unit_price || null,
                kilometraje: cost.crane_parts?.[0]?.kilometraje || null,
                purchase_quantity: cost.purchase_quantity || null,
                purchase_unit_cost: cost.purchase_unit_cost || null,
                immediate_consumption: hasImmediateConsumptionAssociation,
                supplier_id: cost.supplier_id || 'none',
                is_paid: !!cost.payment_date,
                payment_date: cost.payment_date ? formatForInput(cost.payment_date as any) : '',
            });
        } else if (prefilledData) {
            const dateValue = (prefilledData as Record<string, unknown>)?.date
                ? formatForInput((prefilledData as Record<string, unknown>).date)
                : getCurrentChileDateString();
            reset({
                date: dateValue,
                description: prefilledData.description || '',
                amount: Number(prefilledData.amount) || 0,
                category_id: prefilledData.category_id || '',
                entity: (((prefilledData as Record<string, unknown>).entity as 'gruas_5_norte' | 'lowboy') || 'gruas_5_norte'),
                paid_by: (((prefilledData as Record<string, unknown>).paid_by as 'gruas_5_norte' | 'lowboy') || 'gruas_5_norte'),
                crane_id: prefilledData.crane_id || 'none',
                operator_id: prefilledData.operator_id || 'none',
                service_id: prefilledData.service_id || 'none',
                service_folio: prefilledData.service_folio || '',
                subcategory: prefilledData.subcategory || '',
                notes: prefilledData.notes || '',
                document_type: (prefilledData as Record<string, unknown>).document_type || 'none',
                document_number: (prefilledData as Record<string, unknown>).document_number || '',
                location_text: (prefilledData as Record<string, unknown>).location_text || '',
                other_reason: (prefilledData as Record<string, unknown>).other_reason || '',
                cost_center_id: prefilledData.cost_center_id || 'none',
                purchase_quantity: prefilledData.purchase_quantity ?? null,
                purchase_unit_cost: prefilledData.purchase_unit_cost ?? null,
                immediate_consumption: Boolean(prefilledData.immediate_consumption),
                supplier_id: prefilledData.supplier_id || 'none',
                // Auto-marcar como pagado cuando hay un servicio preseleccionado
                // (regla de negocio: gastos operativos de servicios se pagan por defecto)
                is_paid: !!prefilledData.service_id,
                payment_date: '',
            });
            setCalculatedServiceTotal(0);
        } else {
            reset({
                date: getCurrentChileDateString(),
                description: '',
                amount: 0,
                category_id: '',
                entity: 'gruas_5_norte',
                paid_by: 'gruas_5_norte',
                crane_id: 'none',
                operator_id: 'none',
                service_id: 'none',
                service_folio: '',
                subcategory: '',
                notes: '',
                document_type: 'none',
                document_number: '',
                location_text: '',
                other_reason: '',
                cost_center_id: 'none',
                purchase_quantity: null,
                purchase_unit_cost: null,
                immediate_consumption: false,
                supplier_id: 'none',
                is_paid: false,
                payment_date: '',
            });
            setCalculatedServiceTotal(0);
        }
    }, [cost, prefilledData, reset, isOpen]);
    
    const onSubmit = async (values: CostFormValues) => {
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

            if (values.subcategory) {
                const { data: subcategoryConfig, error: subcategoryError } = await supabase
                    .from('cost_subcategories')
                    .select('requires_crane, requires_operator, requires_supplier, requires_document, requires_location, requires_other_reason, routes_to_inventory')
                    .eq('category_id', values.category_id)
                    .eq('name', values.subcategory)
                    .maybeSingle();

                if (!subcategoryError && subcategoryConfig) {
                    if (subcategoryConfig.requires_crane && !values.crane_id) {
                        toast.error("Campo Requerido", { description: "Debe seleccionar una grúa" });
                        setCurrentStep(3);
                        return;
                    }
                    if (subcategoryConfig.requires_operator && !values.operator_id) {
                        toast.error("Campo Requerido", { description: "Debe seleccionar un operador" });
                        setCurrentStep(3);
                        return;
                    }
                    if (subcategoryConfig.requires_supplier && !values.supplier_id) {
                        toast.error("Campo Requerido", { description: "Debe seleccionar un proveedor" });
                        setCurrentStep(3);
                        return;
                    }
                    if (subcategoryConfig.requires_location && !values.location_text) {
                        toast.error("Campo Requerido", { description: "Debe indicar ubicación o tramo" });
                        setCurrentStep(2);
                        return;
                    }
                    if (subcategoryConfig.requires_document && !values.document_number) {
                        toast.error("Campo Requerido", { description: "Debe indicar número de documento" });
                        setCurrentStep(2);
                        return;
                    }
                    if (subcategoryConfig.requires_other_reason && !values.other_reason) {
                        toast.error("Campo Requerido", { description: "Debe seleccionar un motivo" });
                        setCurrentStep(2);
                        return;
                    }
                    if (subcategoryConfig.routes_to_inventory) {
                        if (!values.purchase_quantity || values.purchase_quantity <= 0) {
                            toast.error("Campo Requerido", { description: "Debe indicar cantidad de compra" });
                            setCurrentStep(2);
                            return;
                        }
                        if (!values.purchase_unit_cost || values.purchase_unit_cost <= 0) {
                            toast.error("Campo Requerido", { description: "Debe indicar costo unitario" });
                            setCurrentStep(2);
                            return;
                        }
                    }
                }
            }

            // Validación adicional: cualquier costo en categoría "Inventario" o con
            // "Consumo Inmediato" activo DEBE tener cantidad y costo unitario para
            // poder sincronizar con bodega y grúa. Esto cubre subcategorías que no
            // tienen routes_to_inventory marcado (ej. "Partes y Piezas").
            const selectedCategoryName = categories.find(c => c.id === values.category_id)?.name;
            const isInventoryCategory = selectedCategoryName === 'Inventario';
            const isFinancialCategory = selectedCategoryName === 'Deudas y Obligaciones'
                || selectedCategoryName === 'Comisiones'
                || selectedCategoryName === 'Impuestos';
            const requiresInventorySync = !isFinancialCategory && (isInventoryCategory || values.immediate_consumption === true);
            if (requiresInventorySync) {
                if (!values.purchase_quantity || values.purchase_quantity <= 0) {
                    toast.error("Cantidad requerida", {
                        description: "Para registrar entrada a bodega y consumo inmediato, debes indicar la cantidad comprada.",
                    });
                    setCurrentStep(2);
                    return;
                }
                if (!values.purchase_unit_cost || values.purchase_unit_cost <= 0) {
                    toast.error("Precio unitario requerido", {
                        description: "Debes indicar el precio unitario para sincronizar con bodega.",
                    });
                    setCurrentStep(2);
                    return;
                }
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
            
            const resolvedSupplierId = values.supplier_id === 'none' ? null : values.supplier_id || null;
            
            const { is_paid, payment_date: formPaymentDate, ...restValues } = values;
            
            const submissionData = {
                ...restValues,
                amount: validAmount,
                description: values.description.trim(),
                cost_center_id: values.cost_center_id === 'none' ? null : values.cost_center_id || null,
                supplier_id: resolvedSupplierId,
                part_name: values.part_name?.trim() || null,
                supplier: values.supplier?.trim() || null,
                supplier_phone: values.supplier_phone?.trim() || null,
                quantity: values.quantity || null,
                unit_price: values.unit_price || null,
                kilometraje: values.kilometraje || null,
                purchase_quantity: values.purchase_quantity || null,
                purchase_unit_cost: values.purchase_unit_cost || null,
                immediate_consumption: values.immediate_consumption || false,
                payment_date: is_paid
                    ? (formPaymentDate || cost?.payment_date || values.date)
                    : null,
            } as CostFormData;

            const previousImmediateConsumption = Boolean(
                cost?.immediate_consumption ||
                cost?.crane_id ||
                (cost?.crane_parts && cost.crane_parts.length > 0)
            );
            const previousCraneId = cost?.crane_id || null;
        
            if (cost && cost.id) {
                updateCost({ id: cost.id, ...submissionData }, {
                    onSuccess: async (data) => {
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        
                        const isInventoryPurchase = submissionData.purchase_quantity && 
                                                   submissionData.purchase_quantity > 0 &&
                                                   submissionData.purchase_unit_cost &&
                                                   submissionData.immediate_consumption;
                        const hasNoCraneSelected = !submissionData.crane_id || submissionData.crane_id === 'none';
                        const hasCraneSelected = submissionData.crane_id && submissionData.crane_id !== 'none';
                        
                        onClose();
                        
                        if (submissionData.purchase_quantity && submissionData.purchase_unit_cost) {
                            if (!submissionData.immediate_consumption || hasNoCraneSelected) {
                                await UnifiedPurchaseService.clearImmediateConsumptionForCost(cost.id);
                            }
                        }

                        if (isInventoryPurchase) {
                            if (hasNoCraneSelected && onInventoryCostCreated) {
                                // Multi-crane distribution dialog
                                onInventoryCostCreated({
                                    costId: cost.id,
                                    description: submissionData.description,
                                    quantity: submissionData.purchase_quantity!,
                                    unitCost: submissionData.purchase_unit_cost!,
                                    date: submissionData.date,
                                });
                            } else if (hasCraneSelected) {
                                if ((cost as Record<string, unknown>).supplier_invoice_id) {
                                    await UnifiedPurchaseService.syncImportedInvoiceConsumption({
                                        costId: cost.id,
                                        supplierInvoiceId: String((cost as Record<string, unknown>).supplier_invoice_id || ''),
                                        craneId: submissionData.crane_id!,
                                        date: submissionData.date,
                                        supplierId: submissionData.supplier_id,
                                    });
                                } else {
                                    // Direct consumption to specific crane - use existing cost, no duplicate
                                    await UnifiedPurchaseService.registerForExistingCost({
                                        costId: cost.id,
                                        itemName: submissionData.description,
                                        quantity: submissionData.purchase_quantity!,
                                        unitCost: submissionData.purchase_unit_cost!,
                                        date: submissionData.date,
                                        supplierId: submissionData.supplier_id,
                                        craneId: submissionData.crane_id!,
                                    });
                                }
                                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
                            }
                        }

                        const currentCraneLabel = cranes.find(crane => crane.id === submissionData.crane_id)?.licensePlate;
                        const previousCraneLabel = cranes.find(crane => crane.id === previousCraneId)?.licensePlate;

                        if (submissionData.purchase_quantity && submissionData.purchase_unit_cost) {
                            if (submissionData.immediate_consumption && hasCraneSelected) {
                                if (previousImmediateConsumption && previousCraneId && previousCraneId !== submissionData.crane_id) {
                                    toast.success("Consumo inmediato reasociado", {
                                        description: `La salida de bodega y el registro en grúa se reasociaron a ${currentCraneLabel || 'la grúa seleccionada'}.`,
                                    });
                                } else if (previousImmediateConsumption) {
                                    toast.success("Consumo inmediato actualizado", {
                                        description: `Se actualizó la asociación de consumo inmediato en ${currentCraneLabel || 'la grúa seleccionada'}.`,
                                    });
                                } else {
                                    toast.success("Consumo inmediato registrado", {
                                        description: `Se registró la salida de bodega y el consumo inmediato en ${currentCraneLabel || 'la grúa seleccionada'}.`,
                                    });
                                }
                            } else if (previousImmediateConsumption && (!submissionData.immediate_consumption || hasNoCraneSelected)) {
                                toast.success("Consumo inmediato eliminado", {
                                    description: `Se eliminó la asociación${previousCraneLabel ? ` con ${previousCraneLabel}` : ''} y el costo quedó sin consumo inmediato.`,
                                });
                            } else {
                                toast.success("Costo Actualizado", {
                                    description: "El costo se actualizó correctamente.",
                                });
                            }
                        } else {
                            toast.success("Costo Actualizado", {
                                description: "El costo se actualizó correctamente.",
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
                    onSuccess: async (data) => {
                        queryClient.invalidateQueries({ queryKey: ['costs'] });
                        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
                        
                        const quickEntryId = (prefilledData as Record<string, unknown>)?.quickEntryId;
                        const receiptPhotoPaths = (prefilledData as Record<string, unknown>)?.receipt_photo_paths as string[] | undefined;
                        if (receiptPhotoPaths?.length && data?.[0]?.id) {
                            try {
                                await supabase
                                    .from('costs')
                                    .update({ receipt_photo_paths: receiptPhotoPaths } as any)
                                    .eq('id', data[0].id);
                            } catch (error) {
                                logger.error('Error saving receipt photos to cost:', error);
                            }
                        }
                        if (quickEntryId) {
                            try {
                                await deleteEntry(quickEntryId);
                            } catch (error) {
                                logger.error('Error deleting quick entry after cost creation:', error);
                            }
                        }
                        
                        const isInventoryPurchase = submissionData.purchase_quantity && 
                                                   submissionData.purchase_quantity > 0 &&
                                                   submissionData.purchase_unit_cost &&
                                                   submissionData.immediate_consumption;
                        const hasNoCraneSelected = !submissionData.crane_id || submissionData.crane_id === 'none';
                        const hasCraneSelected = submissionData.crane_id && submissionData.crane_id !== 'none';
                        
                        if (isInventoryPurchase && data?.[0]) {
                            if (hasNoCraneSelected && onInventoryCostCreated) {
                                // Multi-crane distribution dialog
                                onInventoryCostCreated({
                                    costId: data[0].id,
                                    description: submissionData.description,
                                    quantity: submissionData.purchase_quantity!,
                                    unitCost: submissionData.purchase_unit_cost!,
                                    date: submissionData.date,
                                });
                            } else if (hasCraneSelected) {
                                // Direct consumption to specific crane - use existing cost, no duplicate
                                await UnifiedPurchaseService.registerForExistingCost({
                                    costId: data[0].id,
                                    itemName: submissionData.description,
                                    quantity: submissionData.purchase_quantity!,
                                    unitCost: submissionData.purchase_unit_cost!,
                                    date: submissionData.date,
                                    supplierId: submissionData.supplier_id,
                                    craneId: submissionData.crane_id!,
                                });
                                queryClient.invalidateQueries({ queryKey: ['inventory'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-parts'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-consumptions'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-metrics'] });
                                queryClient.invalidateQueries({ queryKey: ['crane-inventory-metrics'] });
                            }
                        }

                        if (isInventoryPurchase && hasCraneSelected) {
                            const currentCraneLabel = cranes.find(crane => crane.id === submissionData.crane_id)?.licensePlate;
                            toast.success("Compra registrada con consumo inmediato", {
                                description: `Se registró la entrada a bodega y la salida inmediata hacia ${currentCraneLabel || 'la grúa seleccionada'}.`,
                            });
                        } else if (submissionData.purchase_quantity && submissionData.purchase_unit_cost) {
                            toast.success("Compra registrada", {
                                description: "Se registró la compra y el ingreso a bodega correctamente.",
                            });
                        } else {
                            toast.success("Costo Agregado", {
                                description: "El nuevo costo se registró correctamente.",
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
        } catch (validationError: unknown) {
            const err = validationError as { message?: string };
            toast.error("Error de Validación", { 
                description: err.message || "Revise los datos ingresados" 
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
                <DialogContent className="flex h-[min(92vh,56rem)] w-[min(96vw,72rem)] max-w-6xl flex-col overflow-hidden border-border/70 bg-card p-0">
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* Header */}
                        <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <DialogTitle className="text-2xl font-bold text-foreground">
                                        {cost ? 'Editar Costo' : isQuickEntryPrefill ? 'Completar Registro Rápido' : prefilledData ? 'Duplicar Costo' : 'Registrar Nuevo Costo'}
                                    </DialogTitle>
                                    <p className="text-muted-foreground">
                                        {cost
                                            ? 'Modifica los datos del costo existente'
                                            : isQuickEntryPrefill
                                            ? 'Se ha pre-cargado la información del registro rápido.'
                                            : prefilledData
                                            ? 'Se ha pre-cargado la información del costo original.'
                                            : 'Completa la información del nuevo costo'}
                                    </p>
                                    {cost && form.formState.isDirty ? (
                                        <p className="mt-1 text-xs text-warning">
                                            Guarda o descarta los cambios del formulario antes de importar un XML manualmente.
                                        </p>
                                    ) : null}
                                </div>

                                {cost ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="gap-2"
                                        onClick={() => setIsManualXmlImportOpen(true)}
                                        disabled={form.formState.isDirty}
                                    >
                                        <FileUp className="size-4" />
                                        Importar XML manual
                                    </Button>
                                ) : null}
                            </div>
                        </DialogHeader>

                        {/* Main Content - 2 Column Layout */}
                        <div className="flex-1 overflow-hidden min-h-0">
                            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-4">
                                {/* Left Sidebar - Navigation & Summary */}
                                <div className="space-y-4 overflow-y-auto border-r border-border/70 bg-muted/30 p-4 lg:col-span-1">
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
                                <div className="lg:col-span-3 flex flex-col overflow-hidden min-h-0">
                                    <Form {...form}>
                                        <div className="flex flex-col flex-1 min-h-0">
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
                                                        isInventorySynced={Boolean(cost?.inventory_movement_id)}
                                                        onServiceExpenseSelect={!cost ? handleServiceExpenseSelect : undefined}
                                                        calculatedServiceTotal={calculatedServiceTotal}
                                                    />
                                                )}
                                                {currentStep === 3 && (
                                                    <CostFormStep3
                                                        form={form}
                                                        cranes={selectableCranes}
                                                        isLoadingCranes={isLoadingCranes}
                                                        operators={operators}
                                                        isLoadingOperators={isLoadingOperators}
                                                        services={servicesForCosts}
                                                        isLoadingServices={isLoadingServices}
                                                        hasCraneParts={Boolean(cost?.crane_parts && (cost.crane_parts as Array<Record<string, unknown>>).length > 0)}
                                                    />
                                                )}
                                                {currentStep === 4 && (
                                                    <CostFormStep4 form={form} receiptUrls={receiptUrls} />
                                                )}
                                            </div>

                                            {/* Footer - Navigation Buttons */}
                                            <div className="shrink-0 flex items-center justify-between border-t border-border/70 bg-muted/30 px-6 py-4">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={handlePrevStep}
                                                    disabled={currentStep === 1}
                                                    className="gap-2"
                                                >
                                                    <ChevronLeft className="size-4" />
                                                    Anterior
                                                </Button>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-muted-foreground">
                                                        Paso {currentStep} de 4
                                                    </span>
                                                </div>

                                                <div className="flex gap-2">
                                                    {/* Botón guardar persistente en modo edición */}
                                                    {cost && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            disabled={isSubmitting}
                                                            onClick={form.handleSubmit(onSubmit)}
                                                            className="gap-2 border-green-600 text-green-700 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950"
                                                        >
                                                            {isSubmitting ? (
                                                                <Loader2 className="size-4 animate-spin" />
                                                            ) : (
                                                                <Save className="size-4" />
                                                            )}
                                                            {isSubmitting ? 'Guardando...' : 'Guardar'}
                                                        </Button>
                                                    )}
                                                    {currentStep < 4 ? (
                                                        <Button
                                                            type="button"
                                                            onClick={handleNextStep}
                                                            className="gap-2"
                                                        >
                                                            Siguiente
                                                            <ChevronRight className="size-4" />
                                                        </Button>
                                                    ) : !cost ? (
                                                        <Button
                                                            type="button"
                                                            disabled={isSubmitting}
                                                            onClick={form.handleSubmit(onSubmit)}
                                                            className="gap-2"
                                                        >
                                                            {isSubmitting ? (
                                                                <>
                                                                    <Loader2 className="size-4 animate-spin" />
                                                                    Guardando...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Save className="size-4" />
                                                                    Guardar
                                                                </>
                                                            )}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                            {!cost && currentStep === 4 && (
                                                <div className="shrink-0 border-t border-border/70 bg-primary/5 px-6 py-2 text-[11px] text-primary/80">
                                                    💡 Si el proveedor enviará factura electrónica después, podrás vincularla automáticamente al subir el XML — solo asegúrate de asignar el proveedor.
                                                </div>
                                            )}
                                        </div>
                                    </Form>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {cost ? (
                <ManualCostXmlImportDialog
                    open={isManualXmlImportOpen}
                    onOpenChange={setIsManualXmlImportOpen}
                    cost={cost}
                    onImported={() => {
                        setIsManualXmlImportOpen(false);
                        onClose();
                    }}
                />
            ) : null}

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
});
