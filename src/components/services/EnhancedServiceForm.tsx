import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { playRetroSuccessSound, playRetroErrorSound } from '@/lib/sounds';
import { Service, ServiceSnakeCase, ServiceItemDraft } from '@/types';
import { FolioSection } from './form/FolioSection';
import { DateSection } from './form/DateSection';
import { ClientServiceSection } from './form/ClientServiceSection';
import { VehicleSection } from './form/VehicleSection';
import { EnhancedLocationSection } from './form/EnhancedLocationSection';
import { MultipleOperatorsSection } from './form/MultipleOperatorsSection';
import { OutsourcedProviderSection } from './form/OutsourcedProviderSection';
import { ServiceCostDetailsSection } from './form/ServiceCostDetailsSection';
import { ProductSalesSection } from './form/ProductSalesSection';
import { EnhancedFinancialSection } from './form/EnhancedFinancialSection';
import { ObservationsSection } from './form/ObservationsSection';
import { ServiceValidationAlerts } from './form/ServiceValidationAlerts';
import { CustodySection } from '../forms/CustodySection';
import { FormStepNavigation, getDefaultSteps, FormStep } from './form/FormStepNavigation';
import { FormSummaryPanel } from './form/FormSummaryPanel';
import { ColoredSectionCard } from './form/ColoredSectionCard';
import { useServiceManager } from '@/hooks/services/useServiceManager';
import { useInventoryDeduction } from '@/hooks/useInventoryDeduction';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useServiceDetailsForForm } from '@/hooks/useServiceDetailsGlobal';
import { useEnhancedFolioGeneration } from '@/hooks/services/useEnhancedFolioGeneration';
import { useServiceFormValidation } from '@/hooks/services/useServiceFormValidation';
import { useServiceRateLookup } from '@/hooks/useServiceRateLookup';
import { useOperatorNotificationFlow } from '@/hooks/services/useOperatorNotificationFlow';
import { useServiceItems } from '@/hooks/services/useServiceItems';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Truck, FileText, Shield, Copy, AlertTriangle, ChevronLeft, ChevronRight, Sparkles, Users, DollarSign, MapPin, Building2, Save, Trash2, Plus } from 'lucide-react';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { isCustodyService } from '@/utils/serviceValueCalculations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { OperatorNotificationDialogs } from './OperatorNotificationDialogs';

const logger = createLogger('EnhancedServiceForm');

interface EnhancedServiceFormProps {
  service?: Service | null;
  prefilledData?: Partial<ServiceSnakeCase>;
  onSubmit: (serviceData: Service) => void;
  onCancel: () => void;
  fromCalendarEvent?: boolean;
}

export const EnhancedServiceForm = React.memo(({ 
  service, 
  prefilledData, 
  onSubmit, 
  onCancel, 
  fromCalendarEvent = false 
}: EnhancedServiceFormProps) => {
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { serviceTypes, loading: serviceTypesLoading } = useServiceTypes();
  const { suppliers } = useSuppliers();
  const { createService, updateService, isCreating, isUpdating } = useServiceManager();
  const { processInventoryDeduction } = useInventoryDeduction();
  const { generateUniqueValidFolio } = useEnhancedFolioGeneration();
  const { matchedRate, lookupRate, clearMatchedRate } = useServiceRateLookup();
  const { items: existingServiceItems, isLoading: loadingServiceItems } = useServiceItems(service?.id);
  const queryClient = useQueryClient();
  
  // Step navigation state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Cargar datos completos del servicio para edición
  const { enhancedService, isLoading: loadingEnhancedService } = useServiceDetailsForForm(service?.id || null);

  const [folio, setFolio] = useState(service?.folio || '');
  const [isManualFolio, setIsManualFolio] = useState(false);
  const [enableCustody, setEnableCustody] = useState(false);
  const [enableItems, setEnableItems] = useState(false);
  const [valueFromRate, setValueFromRate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreationFlowComplete = useCallback((createdService: Service) => {
    logger.debug('📞 Calling onSubmit callback...');
    onSubmit?.(createdService);
    onCancel?.();
  }, [onCancel, onSubmit]);

  const {
    confirmOpen: operatorNotificationConfirmOpen,
    retryOpen: operatorNotificationRetryOpen,
    isSending: isSendingOperatorNotification,
    openNotificationPrompt,
    confirmNotification,
    retryNotification,
    declineNotification,
    cancelRetry,
  } = useOperatorNotificationFlow({
    onComplete: handleCreationFlowComplete,
  });
  
  // Detectar si está duplicando
  const isDuplicating = prefilledData?._isDuplicating;
  const originalFolio = prefilledData?._originalFolio;

  // Skip patent lookup when duplicating or when calendar prefilled a plate
  const skipPatentLookup = !!(
    isDuplicating ||
    (fromCalendarEvent && prefilledData?.licensePlate)
  );
  const [formData, setFormData] = useState({
    requestDate: service?.requestDate || getCurrentChileDateString(),
    serviceDate: service?.serviceDate || getCurrentChileDateString(),
    startTime: service?.startTime,
    endTime: service?.endTime,
    craneMileage: service?.craneMileage,
    client: service?.client?.id || '',
    purchaseOrder: (service as ServiceSnakeCase)?.purchaseOrderNumber || service?.purchaseOrder || '',
    quoteNumber: service?.quoteNumber || '',
    serviceType: service?.serviceType?.id || '',
    vehicleBrand: service?.vehicleBrand || '',
    vehicleModel: service?.vehicleModel || '',
    licensePlate: service?.licensePlate || '',
    origin: service?.origin || '',
    destination: service?.destination || '',
    crane: service?.crane?.id || '',
    operators: service?.operator ? [{
      id: 'legacy-1',
      operatorId: service.operator.id,
      commission: service.operatorCommission || 0,
      role: 'Principal',
      hours: 8
    }] : [],
    value: service?.value || 0,
    costDetails: [],
    markCostsPaidOnCreate: true,
    salesItems: [],
    serviceItems: [] as ServiceItemDraft[],
    hasExcess: service?.hasExcess || false,
    clientCoveredAmount: service?.clientCoveredAmount || 0,
    excessAmount: service?.excessAmount || 0,
    thirdPartyClientId: service?.thirdPartyClientId || '',
    status: service?.status || 'pending' as const,
    observations: service?.observations || '',
    custodyMode: service?.custodyMode || (service as ServiceSnakeCase)?.custody_mode || 'none',
    custodyDays: service?.custodyDays || (service as ServiceSnakeCase)?.custody_days || undefined,
    custodyDailyRate: service?.custodyDailyRate || (service as ServiceSnakeCase)?.custody_daily_rate || undefined,
    custodyRateType: (service as ServiceSnakeCase)?.custodyRateType || (service as ServiceSnakeCase)?.custody_rate_type || 'daily',
    custodyStartDate: service?.custodyStartDate || (service as ServiceSnakeCase)?.custody_start_date || '',
    custodyEndDate: service?.custodyEndDate || (service as ServiceSnakeCase)?.custody_end_date || '',
    custodyVehicleType: service?.custodyVehicleType || (service as ServiceSnakeCase)?.custody_vehicle_type || '',
    custodyDiscountPercentage: (service?.custodyDiscountPercentage !== undefined ? service.custodyDiscountPercentage : (service as ServiceSnakeCase)?.custody_discount_percentage) || 0,
    custodyTotalAmount: service?.custodyTotalAmount || (service as ServiceSnakeCase)?.custody_total_amount || undefined,
    custodyNotes: service?.custodyNotes || (service as ServiceSnakeCase)?.custody_notes || '',
    insuredName: service?.insuredName || (service as ServiceSnakeCase)?.insured_name || '',
    contactPerson: service?.contactPerson || (service as ServiceSnakeCase)?.contact_person || '',
    contactPhone: service?.contactPhone || (service as ServiceSnakeCase)?.contact_phone || '',
    // Outsourced/Third-party service fields
    outsourcedProviderId: service?.outsourcedProviderId || (service as ServiceSnakeCase)?.outsourced_provider_id || '',
    outsourcedCost: service?.outsourcedCost || (service as ServiceSnakeCase)?.outsourced_cost || 0,
    outsourcedNotes: service?.outsourcedNotes || (service as ServiceSnakeCase)?.outsourced_notes || ''
  });

  // Map prefilledData to formData when duplicating
  useEffect(() => {
    if (prefilledData && !service) {
      logger.debug('🔄 [FORM] Mapping prefilledData to formData:', prefilledData);
      setFormData({
        requestDate: prefilledData.requestDate || getCurrentChileDateString(),
        serviceDate: prefilledData.serviceDate || getCurrentChileDateString(),
        startTime: prefilledData.startTime,
        endTime: prefilledData.endTime,
        craneMileage: undefined,
        client: prefilledData.clientId || '',
        purchaseOrder: prefilledData.purchaseOrder || '',
        quoteNumber: prefilledData.quoteNumber || '',
        serviceType: prefilledData.serviceTypeId || '',
        vehicleBrand: prefilledData.vehicleBrand || '',
        vehicleModel: prefilledData.vehicleModel || '',
        licensePlate: prefilledData.licensePlate || '',
        origin: prefilledData.origin || '',
        destination: prefilledData.destination || '',
        crane: prefilledData.craneId || '',
        operators: prefilledData.operators || [],
        value: 0,
        costDetails: [],
        markCostsPaidOnCreate: true,
        salesItems: [],
        serviceItems: [],
        hasExcess: false,
        clientCoveredAmount: 0,
        excessAmount: 0,
        thirdPartyClientId: '',
        status: prefilledData.status || 'pending',
        observations: prefilledData.observations || '',
        custodyMode: prefilledData.inCustody ? 'entry_exit' : 'none',
        custodyDays: prefilledData.custodyDetails?.estimatedDays,
        custodyDailyRate: prefilledData.custodyDetails?.dailyRate,
        custodyRateType: 'daily',
        custodyStartDate: prefilledData.custodyDetails?.entryDate || '',
        custodyEndDate: prefilledData.custodyDetails?.exitDate || '',
        custodyVehicleType: '',
        custodyDiscountPercentage: 0,
        custodyTotalAmount: prefilledData.custodyDetails?.totalAmount,
        custodyNotes: '',
        insuredName: '',
        contactPerson: '',
        contactPhone: '',
        outsourcedProviderId: '',
        outsourcedCost: 0,
        outsourcedNotes: ''
      });

      setEnableCustody(prefilledData.inCustody || false);
    }
  }, [prefilledData, service]);

  // Initialize "Venta de Productos" service type when coming from inventory
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isFromInventory = urlParams.get('newSale') === 'true';
    
    if (isFromInventory && !service && serviceTypes.length > 0) {
      const productSalesType = serviceTypes.find(st => st.name === 'Venta de Productos');
      if (productSalesType) {
        setFormData(prev => ({ 
          ...prev, 
          serviceType: productSalesType.id 
        }));
        toast.success('Formulario preparado para registro de venta');
      }
    }
  }, [serviceTypes, service]);

  // Rate lookup: buscar tarifa predefinida cuando cambia cliente, origen o tipo de servicio
  const isEditingRef = useRef<boolean>(!!service?.id && !isDuplicating);
  useEffect(() => {
    if (isEditingRef.current) return;
    if (service?.id && !isDuplicating) return;
    
    const performLookup = async () => {
      if (formData.client) {
        const rate = await lookupRate({
          clientId: formData.client,
          origin: formData.origin?.trim() || '',
          serviceTypeId: formData.serviceType || null,
        });
        
        if (rate && !valueFromRate) {
          setFormData(prev => ({ ...prev, value: Number(rate.value) }));
          setValueFromRate(true);
          toast.info(`Tarifa aplicada: ${Number(rate.value).toLocaleString('es-CL')} CLP`, {
            description: rate.origin 
              ? `Tarifa predefinida para ${rate.origin}` 
              : `Tarifa genérica del cliente`,
            duration: 3000,
          });
        }
      } else {
        clearMatchedRate();
        setValueFromRate(false);
      }
    };
    
    performLookup();
  }, [formData.client, formData.origin, formData.serviceType, service?.id, isDuplicating]);

  // Cargar datos completos del servicio desde el hook mejorado
  useEffect(() => {
    logger.debug('🔄 [FORM] useEffect triggered:', { 
      enhancedService: !!enhancedService, 
      serviceId: service?.id,
      loadingEnhancedService,
      operators: enhancedService?.operators?.length 
    });
    
    if (enhancedService && service?.id) {
      logger.debug('🔄 [FORM] Loading enhanced service data for editing:', enhancedService.folio);
      
      const costDetails = enhancedService.serviceCosts?.map((cost: { id: string; description: string; amount?: number; notes?: string; category_id?: string; subcategory?: string }) => ({
        id: cost.id,
        description: cost.description,
        amount: cost.amount || 0,
        quantity: 1,
        unitPrice: cost.amount || 0,
        notes: cost.notes || '',
        category_id: cost.category_id,
        subcategory: cost.subcategory || '',
        isExisting: true
      })) || [];

      const pickFirstNonEmpty = (...values: Array<string | null | undefined>) => {
        for (const value of values) {
          if (typeof value === 'string' && value.trim() !== '') return value;
        }
        return '';
      };

      setFormData(prev => ({
        ...prev,
        // 🔒 Sincronización robusta de campos críticos comerciales en edición
        purchaseOrder: pickFirstNonEmpty(
          enhancedService.purchaseOrder,
          (enhancedService as any).purchase_order,
          enhancedService.purchaseOrderNumber,
          (enhancedService as any).purchase_order_number,
          prev.purchaseOrder
        ),
        quoteNumber: pickFirstNonEmpty(
          enhancedService.quoteNumber,
          prev.quoteNumber
        ),
        operators: enhancedService.operators || [],
        costDetails,
        markCostsPaidOnCreate: false,
        // Normalizar a HH:MM — Postgres TIME devuelve HH:MM:SS
        startTime: enhancedService.startTime ? enhancedService.startTime.substring(0, 5) : undefined,
        endTime: enhancedService.endTime ? enhancedService.endTime.substring(0, 5) : undefined,
        craneMileage: enhancedService.craneMileage,
        insuredName: enhancedService.insuredName || (enhancedService as ServiceSnakeCase).insured_name || prev.insuredName,
        contactPerson: enhancedService.contactPerson || (enhancedService as ServiceSnakeCase).contact_person || prev.contactPerson,
        contactPhone: enhancedService.contactPhone || (enhancedService as ServiceSnakeCase).contact_phone || prev.contactPhone,
        custodyMode: enhancedService.custodyMode || enhancedService.custody_mode || prev.custodyMode,
        custodyDays: enhancedService.custodyDays || enhancedService.custody_days || prev.custodyDays,
        custodyDailyRate: enhancedService.custodyDailyRate || enhancedService.custody_daily_rate || prev.custodyDailyRate,
        custodyRateType: enhancedService.custodyRateType || (enhancedService as any).custody_rate_type || prev.custodyRateType,
        custodyStartDate: enhancedService.custodyStartDate || enhancedService.custody_start_date || prev.custodyStartDate,
        custodyEndDate: enhancedService.custodyEndDate || enhancedService.custody_end_date || prev.custodyEndDate,
        custodyVehicleType: enhancedService.custodyVehicleType || enhancedService.custody_vehicle_type || prev.custodyVehicleType,
        custodyDiscountPercentage: (enhancedService.custodyDiscountPercentage !== undefined ? enhancedService.custodyDiscountPercentage : enhancedService.custody_discount_percentage) || prev.custodyDiscountPercentage,
        custodyTotalAmount: enhancedService.custodyTotalAmount || enhancedService.custody_total_amount || prev.custodyTotalAmount,
        custodyNotes: enhancedService.custodyNotes || enhancedService.custody_notes || prev.custodyNotes
      }));

      logger.debug('✅ [FORM] Enhanced service data loaded:', {
        operators: enhancedService.operators?.length || 0,
        costs: costDetails.length,
        totalCommissions: enhancedService.totalCommissions,
        totalCosts: enhancedService.totalCosts,
        custodyMode: enhancedService.custodyMode || enhancedService.custody_mode
      });
    }
  }, [enhancedService, service?.id, loadingEnhancedService]);

  // Efecto para cargar datos existentes del servicio
  useEffect(() => {
    if (service && !enhancedService && !loadingEnhancedService) {
      logger.debug('🔄 [FORM] Loading basic service data (no enhanced service yet)');
      setFolio(service.folio);
      setFormData({
        requestDate: service.requestDate,
        serviceDate: service.serviceDate,
        startTime: service.startTime,
        endTime: service.endTime,
        craneMileage: service.craneMileage,
        client: service.client?.id || '',
        purchaseOrder: (service as ServiceSnakeCase)?.purchaseOrderNumber || service.purchaseOrder || '',
        quoteNumber: service.quoteNumber || '',
        serviceType: service.serviceType?.id || '',
        vehicleBrand: service.vehicleBrand,
        vehicleModel: service.vehicleModel,
        licensePlate: service.licensePlate,
        origin: service.origin,
        destination: service.destination,
        crane: service.crane?.id || '',
        operators: service.operator ? [{
          id: 'legacy-1',
          operatorId: service.operator.id,
          commission: service.operator.commissionExempt ? 0 : (service.operatorCommission || 0),
          role: 'Principal',
          hours: 8
        }] : [],
        value: service.value,
        costDetails: [],
        markCostsPaidOnCreate: false,
        salesItems: [],
        serviceItems: [],
        hasExcess: service.hasExcess,
        clientCoveredAmount: service.clientCoveredAmount || 0,
        excessAmount: service.excessAmount || 0,
        thirdPartyClientId: service.thirdPartyClientId || '',
        status: service.status,
        observations: service.observations || '',
        custodyMode: service.custodyMode || (service as ServiceSnakeCase)?.custody_mode || 'none',
        custodyDays: service.custodyDays || (service as ServiceSnakeCase)?.custody_days || undefined,
        custodyDailyRate: service.custodyDailyRate || (service as ServiceSnakeCase)?.custody_daily_rate || undefined,
        custodyRateType: (service as any)?.custodyRateType || (service as any)?.custody_rate_type || service?.custodyRateType || 'daily',
        custodyStartDate: service.custodyStartDate || (service as ServiceSnakeCase)?.custody_start_date || '',
        custodyEndDate: service.custodyEndDate || (service as ServiceSnakeCase)?.custody_end_date || '',
        custodyVehicleType: service.custodyVehicleType || (service as ServiceSnakeCase)?.custody_vehicle_type || '',
        custodyDiscountPercentage: (service.custodyDiscountPercentage !== undefined ? service.custodyDiscountPercentage : (service as ServiceSnakeCase)?.custody_discount_percentage) || 0,
        custodyTotalAmount: service.custodyTotalAmount || (service as ServiceSnakeCase)?.custody_total_amount || undefined,
        custodyNotes: service.custodyNotes || (service as ServiceSnakeCase)?.custody_notes || '',
        insuredName: service.insuredName || (service as ServiceSnakeCase)?.insured_name || '',
        contactPerson: service.contactPerson || (service as ServiceSnakeCase)?.contact_person || '',
        contactPhone: service.contactPhone || (service as ServiceSnakeCase)?.contact_phone || '',
        outsourcedProviderId: service.outsourcedProviderId || (service as ServiceSnakeCase)?.outsourced_provider_id || '',
        outsourcedCost: service.outsourcedCost || (service as ServiceSnakeCase)?.outsourced_cost || 0,
        outsourcedNotes: service.outsourcedNotes || (service as ServiceSnakeCase)?.outsourced_notes || ''
      });
      setIsManualFolio(true);
    }
  }, [service, enhancedService, loadingEnhancedService]);

  // Obtener el tipo de servicio seleccionado
  const selectedServiceType = serviceTypes?.find(st => st.id === formData.serviceType);

  const ITEMS_SERVICE_TYPES = ['Apoyo Logistico', 'Servicios Mecánicos y De Apoyo'];
  const isItemsServiceType = ITEMS_SERVICE_TYPES.includes(selectedServiceType?.name ?? '');

  // Cargar ítems existentes una sola vez por servicio al editar, antes de que
  // el efecto de auto-toggle pueda limpiarlos
  const itemsLoadedRef = useRef<string | null>(null);
  useEffect(() => {
    if (service?.id && !loadingServiceItems && itemsLoadedRef.current !== service.id) {
      setFormData(prev => ({
        ...prev,
        serviceItems: (existingServiceItems || []).map(i => ({
          id: i.id,
          glosa: i.glosa,
          cantidad: i.cantidad,
          valor_unitario: i.valor_unitario,
        }))
      }));
      if ((existingServiceItems || []).length > 0) {
        setEnableItems(true);
      }
      itemsLoadedRef.current = service.id;
    }
  }, [service?.id, loadingServiceItems, existingServiceItems]);

  useEffect(() => {
    if (isItemsServiceType) {
      setEnableItems(true);
      return;
    }
    // Mientras se edita un servicio existente, no limpiar los ítems hasta
    // que terminen de cargarse desde la base de datos
    if (service?.id && itemsLoadedRef.current !== service.id) {
      return;
    }
    setEnableItems(false);
    setFormData(prev => (prev.serviceItems?.length === 0 ? prev : { ...prev, serviceItems: [] }));
  }, [isItemsServiceType, service?.id]);

  const addServiceItem = () => {
    setFormData(prev => ({
      ...prev,
      serviceItems: [...(prev.serviceItems ?? []),
        { id: crypto.randomUUID(), glosa: '', cantidad: 1, valor_unitario: 0 }]
    }));
  };
  const removeServiceItem = (id: string) => {
    setFormData(prev => ({
      ...prev,
      serviceItems: (prev.serviceItems ?? []).filter(i => i.id !== id)
    }));
  };
  const updateServiceItem = (id: string, field: keyof ServiceItemDraft, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      serviceItems: (prev.serviceItems ?? []).map(i =>
        i.id === id ? { ...i, [field]: value } : i
      )
    }));
  };

  // Hook de validación del formulario
  const validationFormData = useMemo(() => ({
      serviceType: formData.serviceType,
      crane: formData.crane,
      operators: formData.operators,
      origin: formData.origin,
      destination: formData.destination,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel,
      licensePlate: formData.licensePlate,
      purchaseOrder: formData.purchaseOrder
    }), [
      formData.serviceType,
      formData.crane,
      formData.operators,
      formData.origin,
      formData.destination,
      formData.vehicleBrand,
      formData.vehicleModel,
      formData.licensePlate,
      formData.purchaseOrder
    ]);

  const { validationErrors, hasErrors, isFieldInvalid, getFieldError } = useServiceFormValidation({
    formData: validationFormData,
    selectedServiceType
  });

  // Calculadores de totales
  const totalCommissions = useMemo(
    () => formData.operators?.reduce((total, op) => total + (op.commission || 0), 0) || 0,
    [formData.operators]
  );

  const totalCosts = useMemo(
    () => formData.costDetails?.reduce((total, cost) => total + (cost.amount || 0), 0) || 0,
    [formData.costDetails]
  );

  // Custody calculations - Manual mode
  useEffect(() => {
    if (formData.custodyMode === 'manual' && formData.custodyDays && formData.custodyDailyRate) {
      let effectiveDailyRate = formData.custodyDailyRate;
      
      if (formData.custodyRateType === 'weekly') {
        effectiveDailyRate = formData.custodyDailyRate / 7;
      } else if (formData.custodyRateType === 'monthly') {
        effectiveDailyRate = formData.custodyDailyRate / 30;
      }
      
      const subtotal = formData.custodyDays * effectiveDailyRate;
      const discount = (subtotal * (formData.custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      setFormData(prev =>
        prev.custodyTotalAmount === total
          ? prev
          : { ...prev, custodyTotalAmount: total }
      );
    }
  }, [formData.custodyDays, formData.custodyDailyRate, formData.custodyRateType, formData.custodyDiscountPercentage, formData.custodyMode]);

  // Custody calculations - Calendar mode
  useEffect(() => {
    if (formData.custodyMode === 'calendar' && formData.custodyStartDate && formData.custodyEndDate && formData.custodyDailyRate) {
      const start = new Date(formData.custodyStartDate);
      const end = new Date(formData.custodyEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      let effectiveDailyRate = formData.custodyDailyRate;
      
      if (formData.custodyRateType === 'weekly') {
        effectiveDailyRate = formData.custodyDailyRate / 7;
      } else if (formData.custodyRateType === 'monthly') {
        effectiveDailyRate = formData.custodyDailyRate / 30;
      }
      
      const subtotal = diffDays * effectiveDailyRate;
      const discount = (subtotal * (formData.custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      
      setFormData(prev =>
        prev.custodyDays === diffDays && prev.custodyTotalAmount === total
          ? prev
          : { ...prev, custodyDays: diffDays, custodyTotalAmount: total }
      );
    }
  }, [formData.custodyStartDate, formData.custodyEndDate, formData.custodyDailyRate, formData.custodyRateType, formData.custodyDiscountPercentage, formData.custodyMode]);

  // Auto-calculate service value for product sales
  useEffect(() => {
    if (selectedServiceType?.name === 'Venta de Productos' && formData.salesItems?.length > 0) {
      const totalSales = formData.salesItems.reduce((total, item) => total + (item.totalPrice || 0), 0);
      setFormData(prev =>
        prev.value === totalSales
          ? prev
          : { ...prev, value: totalSales }
      );
    }
  }, [formData.salesItems, selectedServiceType?.name]);

  // Auto-initialize custody mode for "Custodia de Vehículos" service type
  useEffect(() => {
    if (selectedServiceType?.name === 'Custodia de Vehículos ' && formData.custodyMode === 'none') {
      setFormData(prev => ({ 
        ...prev, 
        custodyMode: 'manual' 
      }));
    }
  }, [selectedServiceType?.name, formData.custodyMode]);

  // Auto-enable custody toggle for specific service types and existing services
  useEffect(() => {
    const shouldEnableCustody = 
      selectedServiceType?.name === 'Arriendo de Equipos' || 
      selectedServiceType?.name === 'Custodia de Vehículos ' ||
      (service && formData.custodyMode !== 'none');
    
    setEnableCustody(shouldEnableCustody);
  }, [selectedServiceType?.name, service, formData.custodyMode]);

  // Get summary data for panel
  const selectedClient = useMemo(
    () => clients.find(c => c.id === formData.client),
    [clients, formData.client]
  );
  const selectedCrane = useMemo(
    () => cranes.find(c => c.id === formData.crane),
    [cranes, formData.crane]
  );

  // Step validation - check if current step has required fields filled
  const getStepValidation = useMemo(() => {
    const step1Valid = true; // Folio is optional, dates have defaults
    const step2Valid = true; // Vehicle info is optional unless required by service type
    const step3Valid = !isFieldInvalid('crane') && !isFieldInvalid('operators');
    const step4Valid = true; // Financial is optional
    
    return { step1Valid, step2Valid, step3Valid, step4Valid };
  }, [isFieldInvalid]);

  // Build steps with completion status
  const steps: FormStep[] = useMemo(() => {
    const defaultSteps = getDefaultSteps();
    return defaultSteps.map(step => ({
      ...step,
      isCompleted: step.id < currentStep,
      hasError: step.id === 3 && (isFieldInvalid('crane') || isFieldInvalid('operators'))
    }));
  }, [currentStep, isFieldInvalid]);

  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return getStepValidation.step1Valid;
      case 2: return getStepValidation.step2Valid;
      case 3: return getStepValidation.step3Valid;
      case 4: return getStepValidation.step4Valid;
      default: return true;
    }
  };

  const formContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    formContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps && canGoNext()) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, totalSteps, canGoNext]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  // Fase en la que vive cada campo validable, para navegar al primer error
  const FIELD_STEP_MAP: Record<string, number> = {
    purchaseOrder: 1,
    vehicleBrand: 2,
    vehicleModel: 2,
    licensePlate: 2,
    origin: 2,
    destination: 2,
    crane: 3,
    operators: 3,
  };

  const getFirstErrorStep = (): number | null => {
    const errorSteps = validationErrors
      .filter(err => err.severity === 'error')
      .map(err => FIELD_STEP_MAP[err.field] ?? 1);
    return errorSteps.length > 0 ? Math.min(...errorSteps) : null;
  };

  const summaryPanelProps = useMemo(() => ({
    folio,
    clientName: selectedClient?.name || '',
    serviceTypeName: selectedServiceType?.name || '',
    value: formData.value,
    totalCommissions,
    totalCosts,
    operatorsCount: formData.operators?.length || 0,
    craneName: selectedCrane?.licensePlate || '',
    origin: formData.origin,
    destination: formData.destination,
    status: formData.status,
    isEditing: !!service,
  }), [
    folio,
    selectedClient?.name,
    selectedServiceType?.name,
    formData.value,
    totalCommissions,
    totalCosts,
    formData.operators?.length,
    selectedCrane?.licensePlate,
    formData.origin,
    formData.destination,
    formData.status,
    service,
  ]);

  // Sincroniza el desglose de ítems (creación, edición y eliminación) tanto
  // al crear como al actualizar un servicio
  const syncServiceItems = async (resultId: string) => {
    const drafts = formData.serviceItems || [];
    if (drafts.length === 0 && (existingServiceItems || []).length === 0) {
      return;
    }

    const draftIds = new Set(drafts.map(i => i.id));
    const toDelete = (existingServiceItems || [])
      .filter(i => !draftIds.has(i.id))
      .map(i => i.id);
    const toUpsert = drafts
      .filter(item => item.glosa.trim() !== '')
      .map(item => ({
        id: item.id,
        service_id: resultId,
        glosa: item.glosa,
        cantidad: item.cantidad,
        valor_unitario: item.valor_unitario,
      }));

    if (toDelete.length > 0) {
      const { error } = await supabase.from('service_items').delete().in('id', toDelete);
      if (error) logger.warn('Error eliminando service_items:', error);
    }
    if (toUpsert.length > 0) {
      const { error } = await supabase.from('service_items').upsert(toUpsert, { onConflict: 'id' });
      if (error) logger.warn('Error guardando service_items:', error);
    }

    queryClient.invalidateQueries({ queryKey: ['service-items', resultId] });
  };

  // Handler único de guardado: usado por el submit del form (fase 4)
  // y por el botón "Guardar" persistente disponible en todas las fases
  const performSave = async () => {
    if (isCreating || isUpdating || isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    try {
      // Validación completa del formulario antes de cualquier persistencia:
      // no se permite guardado parcial desde ninguna fase
      if (hasErrors) {
        playRetroErrorSound();
        toast.error('Faltan campos obligatorios. Revisa los campos marcados antes de guardar.');
        const errorStep = getFirstErrorStep();
        if (errorStep && errorStep !== currentStep) {
          setCurrentStep(errorStep);
        }
        return;
      }

      // Servicios con excedente requieren indicar quién paga el excedente
      if (formData.hasExcess && !formData.thirdPartyClientId) {
        playRetroErrorSound();
        toast.error('Debes indicar quién paga el excedente');
        setCurrentStep(4);
        return;
      }

      let finalFolio = folio;
      
      if (!service && !isManualFolio && (!folio || folio.trim() === '')) {
        logger.debug('🔄 Generating folio at submission time...');
        try {
          finalFolio = await generateUniqueValidFolio();
          setFolio(finalFolio);
          logger.debug('✅ Folio generated successfully:', finalFolio);
        } catch (error) {
          logger.error('❌ Error generating folio:', error);
          playRetroErrorSound();
          toast.error('Error al generar el folio. Por favor, intenta nuevamente.');
          return;
        }
      }
      
      if (!finalFolio || finalFolio.trim() === '') {
        playRetroErrorSound();
        toast.error('Error: El folio no puede estar vacío');
        return;
      }

      logger.debug('🔄 Form submission started:', { folio: finalFolio, serviceType: formData.serviceType });
      
      const finalData = {
        ...formData,
        folio: finalFolio,
        operators: formData.operators || [],
        costDetails: formData.costDetails || []
      };

      logger.debug('📤 Final data prepared:', finalData);

      let result: Service;
      
      if (service) {
        logger.debug('🔄 Updating existing service...');
        result = await updateService(service.id, finalData);
        
        if (selectedServiceType?.name === 'Venta de Productos' && 
            finalData.status === 'completed' && 
            service.status !== 'completed' &&
            finalData.salesItems?.length > 0) {
          
          logger.debug('🔄 Processing inventory deduction for completed service update...');
          const deductionResult = await processInventoryDeduction({
            serviceId: result.id,
            serviceFolio: result.folio,
            salesItems: finalData.salesItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          });
          
          if (deductionResult.success) {
            toast.success(deductionResult.message);
          }
        }

        await syncServiceItems(result.id);
      } else {
        logger.debug('🔄 Creating new service...');
        result = await createService(finalData);

        if (!finalData.value || finalData.value === 0) {
          supabase.functions
            .invoke('send-whatsapp-admin', {
              body: {
                event: 'servicio_sin_cotizacion',
                data: {
                  folio: result.folio,
                  clientName: result.client?.name || '',
                  fechaServicio: new Date(result.serviceDate).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }),
                },
              },
            })
            .then(({ error }) => {
              if (error) logger.warn('WhatsApp admin no enviado:', error);
            });
        }
        
        if (selectedServiceType?.name === 'Venta de Productos' && 
            finalData.salesItems?.length > 0) {
          
          logger.debug('🔄 Processing inventory deduction for new product sale...');
          const deductionResult = await processInventoryDeduction({
            serviceId: result.id,
            serviceFolio: result.folio,
            salesItems: finalData.salesItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            }))
          });
          
          if (deductionResult.success) {
            toast.success(deductionResult.message);
          }
        }

        await syncServiceItems(result.id);
      }

      const action = service ? 'actualizado' : 'creado';
      logger.debug('✅ Service operation completed:', { id: result.id, folio: result.folio });

      playRetroSuccessSound();
      toast.success(`Servicio ${action} exitosamente: ${result.folio}`);

      if (!service) {
        const assignedOperator = finalData.operators?.[0];
        const operatorId = assignedOperator?.operatorId ||
          (finalData as any).operator?.id ||
          result?.operator?.id ||
          null;

        openNotificationPrompt(result, operatorId);
        logger.debug('✅ Form submission completed successfully, pending operator notification decision');
        return;
      }

      handleCreationFlowComplete(result);
      logger.debug('✅ Form submission completed successfully');
      
    } catch (error) {
      logger.error('❌ Error en envío del formulario:', error);
      logger.error('❌ Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      let errorMessage = 'Error desconocido';
      
      if (error?.message) {
        if (error.code) {
          switch (error.code) {
            case '23505':
              errorMessage = 'Ya existe un servicio con este folio';
              break;
            case '23503':
              errorMessage = 'Error: Cliente, grúa u operador seleccionado no válido';
              break;
            case 'PGRST116':
              errorMessage = 'Error: No se encontró el servicio a actualizar';
              break;
            default:
              errorMessage = `Error de base de datos: ${error.message}`;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      playRetroErrorSound();
      toast.error(`Error al ${service ? 'actualizar' : 'crear'} el servicio: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSave();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header con progreso */}
      <div className="flex-shrink-0 pb-4 border-b border-border/50 mb-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "p-3 rounded-xl",
            service ? "bg-amber-500/10" : "bg-violet-500/10"
          )}>
            {service ? (
              <FileText className="size-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <Sparkles className="size-6 text-violet-600 dark:text-violet-400" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">
              {service ? `Editando ${folio || service.folio}` : 'Nuevo Servicio'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Paso {currentStep} de {totalSteps}: {steps[currentStep - 1]?.title}
            </p>
          </div>
          {isDuplicating && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg">
              <Copy className="size-4 text-secondary-foreground" />
              <span className="text-sm font-medium text-secondary-foreground">
                Duplicando {originalFolio}
              </span>
            </div>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="mt-4">
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Main content - Two columns on desktop, single on mobile */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
        {/* Left Panel - Navigation & Summary (hidden on mobile) */}
        <div className="hidden md:flex w-72 flex-shrink-0 flex-col gap-4 overflow-y-auto pr-2">
          <FormStepNavigation
            steps={steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
          
          <FormSummaryPanel
            {...summaryPanelProps}
          />
        </div>

        {/* Right Panel - Form Content */}
        <div
          ref={formContentRef}
          className="flex-1 overflow-y-auto overscroll-contain pr-0 md:pr-2 min-w-0"
        >
          {/* Alertas de Validación */}
          {selectedServiceType && validationErrors.length > 0 && (
            <ServiceValidationAlerts errors={validationErrors} />
          )}

          <form id="enhanced-service-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Step 1: Información Básica */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <ColoredSectionCard
                  title="Identificación"
                  icon={<FileText className="size-5" />}
                  color="blue"
                >
                  <FolioSection
                    folio={folio}
                    onFolioChange={setFolio}
                    isManualFolio={isManualFolio}
                    onManualFolioChange={setIsManualFolio}
                    onGenerateNewFolio={async () => {
                      try {
                        const newFolio = await generateUniqueValidFolio();
                        setFolio(newFolio);
                      } catch (error) {
                        logger.error('Error generando folio:', error);
                        toast.error('Error generando folio');
                      }
                    }}
                    isEditing={!!service}
                    serviceId={service?.id}
                    isLoading={false}
                    disabled={false}
                  />
                </ColoredSectionCard>

                <ColoredSectionCard
                  title="Fechas y Horarios"
                  icon={<FileText className="size-5" />}
                  color="cyan"
                >
                  <DateSection
                    requestDate={formData.requestDate}
                    serviceDate={formData.serviceDate}
                    startTime={formData.startTime}
                    endTime={formData.endTime}
                    craneMileage={formData.craneMileage}
                    onRequestDateChange={(date) => setFormData(prev => ({ ...prev, requestDate: date }))}
                    onServiceDateChange={(date) => setFormData(prev => ({ ...prev, serviceDate: date }))}
                    onStartTimeChange={(time) => setFormData(prev => ({ ...prev, startTime: time }))}
                    onEndTimeChange={(time) => setFormData(prev => ({ ...prev, endTime: time }))}
                    onCraneMileageChange={(mileage) => setFormData(prev => ({ ...prev, craneMileage: mileage }))}
                    disabled={false}
                  />
                </ColoredSectionCard>

                <ColoredSectionCard
                  title="Cliente y Servicio"
                  icon={<Users className="size-5" />}
                  color="purple"
                >
                  <ClientServiceSection
                    clientId={formData.client}
                    onClientChange={(value) => setFormData(prev => ({ ...prev, client: value }))}
                    clients={clients}
                    purchaseOrder={formData.purchaseOrder}
                    onPurchaseOrderChange={(value) => setFormData(prev => ({ ...prev, purchaseOrder: value }))}
                    quoteNumber={formData.quoteNumber}
                    onQuoteNumberChange={(value) => setFormData(prev => ({ ...prev, quoteNumber: value }))}
                    insuredName={formData.insuredName}
                    onInsuredNameChange={(value) => setFormData(prev => ({ ...prev, insuredName: value }))}
                    contactPerson={formData.contactPerson}
                    onContactPersonChange={(value) => setFormData(prev => ({ ...prev, contactPerson: value }))}
                    contactPhone={formData.contactPhone}
                    onContactPhoneChange={(value) => setFormData(prev => ({ ...prev, contactPhone: value }))}
                    serviceTypeId={formData.serviceType}
                    onServiceTypeChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
                    serviceTypes={serviceTypes}
                    serviceTypesLoading={serviceTypesLoading}
                    disabled={false}
                    invoiceFolio={service?.invoiceFolio}
                    invoiceNumeroFiscal={service?.invoiceNumeroFiscal}
                  />
                </ColoredSectionCard>
              </div>
            )}

            {/* Step 2: Vehículo y Ubicación */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <ColoredSectionCard
                  title="Datos del Vehículo"
                  icon={<Truck className="size-5" />}
                  color="green"
                  hasError={isFieldInvalid('vehicleBrand') || isFieldInvalid('vehicleModel') || isFieldInvalid('licensePlate')}
                >
                  <VehicleSection
                    vehicleBrand={formData.vehicleBrand}
                    onVehicleBrandChange={(value) => setFormData(prev => ({ ...prev, vehicleBrand: value }))}
                    vehicleModel={formData.vehicleModel}
                    onVehicleModelChange={(value) => setFormData(prev => ({ ...prev, vehicleModel: value }))}
                    licensePlate={formData.licensePlate}
                    onLicensePlateChange={(value) => setFormData(prev => ({ ...prev, licensePlate: value }))}
                    vehicleBrandRequired={selectedServiceType?.vehicleBrandRequired || false}
                    vehicleModelRequired={selectedServiceType?.vehicleModelRequired || false}
                    licensePlateRequired={selectedServiceType?.licensePlateRequired || false}
                    disabled={false}
                    vehicleBrandError={isFieldInvalid('vehicleBrand')}
                    vehicleModelError={isFieldInvalid('vehicleModel')}
                    licensePlateError={isFieldInvalid('licensePlate')}
                    isEditing={!!service}
                    skipLookup={skipPatentLookup}
                  />
                </ColoredSectionCard>

                <ColoredSectionCard
                  title="Ubicación"
                  icon={<MapPin className="size-5" />}
                  color="orange"
                  hasError={isFieldInvalid('origin') || isFieldInvalid('destination')}
                >
                  <EnhancedLocationSection
                    origin={formData.origin}
                    onOriginChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
                    destination={formData.destination}
                    onDestinationChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
                    originRequired={selectedServiceType?.originRequired || false}
                    destinationRequired={selectedServiceType?.destinationRequired || false}
                    disabled={false}
                    originError={isFieldInvalid('origin')}
                    destinationError={isFieldInvalid('destination')}
                  />
                </ColoredSectionCard>
              </div>
            )}

            {/* Step 3: Recursos Asignados */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                {/* Sección de Proveedor Tercero - Solo para servicios subcontratados */}
                {selectedServiceType?.isOutsourced && (
                  <ColoredSectionCard
                    title="Proveedor Tercero"
                    icon={<Building2 className="size-5" />}
                    color="orange"
                    required={true}
                  >
                    <OutsourcedProviderSection
                      providerId={formData.outsourcedProviderId}
                      cost={formData.outsourcedCost}
                      notes={formData.outsourcedNotes}
                      onProviderChange={(providerId) => setFormData(prev => ({ ...prev, outsourcedProviderId: providerId }))}
                      onCostChange={(cost) => setFormData(prev => ({ ...prev, outsourcedCost: cost }))}
                      onNotesChange={(notes) => setFormData(prev => ({ ...prev, outsourcedNotes: notes }))}
                      serviceValue={formData.value}
                      suppliers={suppliers}
                      disabled={false}
                    />
                  </ColoredSectionCard>
                )}

                {/* Grúa - Solo para servicios NO subcontratados */}
                {!selectedServiceType?.isOutsourced && (
                  <ColoredSectionCard
                    title="Grúa Asignada"
                    icon={<Truck className="size-5" />}
                    color="amber"
                    hasError={isFieldInvalid('crane')}
                    required={selectedServiceType?.craneRequired}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="crane">
                        Grúa {selectedServiceType?.craneRequired && <span className="text-destructive">*</span>}
                        {!selectedServiceType?.craneRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
                      </Label>
                      <Select 
                        value={formData.crane} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, crane: value === "unassigned" ? "" : value }))} 
                        disabled={false}
                      >
                        <SelectTrigger className={isFieldInvalid('crane') ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Seleccionar grúa" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Sin asignar</SelectItem>
                          {cranes.filter(c => c.isActive).map((crane) => (
                            <SelectItem key={crane.id} value={crane.id}>
                              {crane.licensePlate} - {crane.brand} {crane.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isFieldInvalid('crane') && (
                        <p className="text-sm text-destructive flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          {getFieldError('crane')?.message}
                        </p>
                      )}
                    </div>
                  </ColoredSectionCard>
                )}

                {/* Operadores - Solo para servicios NO subcontratados */}
                {!selectedServiceType?.isOutsourced && (
                  <ColoredSectionCard
                    title="Operadores"
                    icon={<Users className="size-5" />}
                    color="pink"
                    hasError={isFieldInvalid('operators')}
                    required={selectedServiceType?.operatorRequired}
                  >
                    <MultipleOperatorsSection
                      operators={formData.operators || []}
                      onOperatorsChange={(operators) => setFormData(prev => ({ 
                        ...prev, 
                        operators: operators.map(op => ({
                          id: op.id,
                          operatorId: op.operatorId,
                          commission: op.commission || 0,
                          role: op.role || 'Principal',
                          hours: op.hours || 8
                        }))
                      }))}
                      availableOperators={operators}
                      operatorRequired={selectedServiceType?.operatorRequired || false}
                      disabled={false}
                      hasValidationError={isFieldInvalid('operators')}
                      validationMessage={getFieldError('operators')?.message}
                    />
                  </ColoredSectionCard>
                )}

                {/* Product Sales Section */}
                {selectedServiceType?.name === 'Venta de Productos' && (
                  <ProductSalesSection
                    salesItems={formData.salesItems || []}
                    onSalesItemsChange={(items) => setFormData(prev => ({ ...prev, salesItems: items }))}
                    disabled={false}
                  />
                )}

                {/* Costos del Servicio */}
                {selectedServiceType?.name !== 'Venta de Productos' && (
                  <ServiceCostDetailsSection
                    costDetails={formData.costDetails || []}
                    onCostDetailsChange={(costs) => setFormData(prev => ({ ...prev, costDetails: costs }))}
                    serviceId={service?.id}
                    serviceDate={formData.serviceDate}
                    disabled={false}
                  />
                )}
                
                {/* Marcar como pagado al crear */}
                <ColoredSectionCard
                  title="Pago de costos al crear"
                  icon={<DollarSign className="size-5" />}
                  color="orange"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        Marcar costos como pagados al crear
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        Si está activado, los costos del servicio se registran como pagados usando la fecha del servicio
                      </div>
                    </div>
                    <Switch
                      checked={!!formData.markCostsPaidOnCreate}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, markCostsPaidOnCreate: !!checked }))}
                    />
                  </div>
                </ColoredSectionCard>
              </div>
            )}

            {/* Step 4: Financiero y Final */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-fade-in">
                <ColoredSectionCard
                  title="Información Financiera"
                  icon={<DollarSign className="size-5" />}
                  color="green"
                >
                  <EnhancedFinancialSection
                    value={formData.value}
                    onValueChange={(value) => {
                      setFormData(prev => ({ ...prev, value }));
                      setValueFromRate(false);
                    }}
                    totalCommissions={totalCommissions}
                    totalCosts={totalCosts}
                    hasExcess={formData.hasExcess}
                    onHasExcessChange={(value) => setFormData(prev => ({ ...prev, hasExcess: value }))}
                    clientCoveredAmount={formData.clientCoveredAmount}
                    onClientCoveredAmountChange={(value) => setFormData(prev => ({ ...prev, clientCoveredAmount: value }))}
                    excessAmount={formData.excessAmount}
                    onExcessAmountChange={(value) => setFormData(prev => ({ ...prev, excessAmount: value }))}
                    thirdPartyClientId={formData.thirdPartyClientId}
                    onThirdPartyClientIdChange={(value) => setFormData(prev => ({ ...prev, thirdPartyClientId: value || '' }))}
                    clients={clients.filter(c => c.isActive)}
                    disabled={false}
                    isCustodyService={isCustodyService(formData)}
                    custodyTotalAmount={formData.custodyTotalAmount || 0}
                    matchedRateOrigin={matchedRate?.origin}
                    valueFromRate={valueFromRate}
                    onClearRate={() => setValueFromRate(false)}
                  />
                </ColoredSectionCard>

                {/* Toggle para habilitar Custodia/Arriendo */}
                <ColoredSectionCard
                  title="Configuración Adicional"
                  icon={<Shield className="size-5" />}
                  color="purple"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        Habilitar Custodia/Arriendo
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        Activar para incluir servicios de custodia o arriendo de equipos
                      </div>
                    </div>
                    <Switch
                      checked={enableCustody || selectedServiceType?.name === 'Arriendo de Equipos' || selectedServiceType?.name === 'Custodia de Vehículos '}
                      onCheckedChange={(checked) => {
                        setEnableCustody(checked);
                        if (checked && formData.custodyMode === 'none') {
                          setFormData(prev => ({ ...prev, custodyMode: 'manual' }));
                        } else if (!checked && formData.custodyMode !== 'none' && selectedServiceType?.name !== 'Arriendo de Equipos' && selectedServiceType?.name !== 'Custodia de Vehículos ') {
                          setFormData(prev => ({ ...prev, custodyMode: 'none' }));
                        }
                      }}
                      disabled={selectedServiceType?.name === 'Arriendo de Equipos' || selectedServiceType?.name === 'Custodia de Vehículos '}
                    />
                  </div>

                  {/* Toggle para habilitar Desglose de Trabajos */}
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Habilitar Desglose de Trabajos</Label>
                      <div className="text-sm text-muted-foreground">
                        Activar para registrar ítems con glosa, cantidad y valor
                      </div>
                    </div>
                    <Switch
                      checked={enableItems || isItemsServiceType}
                      onCheckedChange={(checked) => {
                        setEnableItems(checked);
                        if (!checked) setFormData(prev => ({ ...prev, serviceItems: [] }));
                      }}
                      disabled={isItemsServiceType}
                    />
                  </div>

                  {/* Tabla de ítems */}
                  {(enableItems || isItemsServiceType) && (
                    <div className="space-y-3 pt-2">
                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Glosa</th>
                              <th className="w-20 px-3 py-2 text-center font-medium text-muted-foreground">Cant.</th>
                              <th className="w-32 px-3 py-2 text-right font-medium text-muted-foreground">Valor unit.</th>
                              <th className="w-32 px-3 py-2 text-right font-medium text-muted-foreground">Total neto</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(formData.serviceItems ?? []).map((item) => (
                              <tr key={item.id} className="bg-card">
                                <td className="px-3 py-2">
                                  <Input value={item.glosa} placeholder="Descripción del trabajo"
                                    className="h-8 min-w-[160px]"
                                    onChange={(e) => updateServiceItem(item.id, 'glosa', e.target.value)} />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" min="0.01" step="0.01" value={item.cantidad}
                                    className="h-8 w-20 text-right"
                                    onChange={(e) => updateServiceItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)} />
                                </td>
                                <td className="px-3 py-2">
                                  <Input type="number" min="0" step="1" value={item.valor_unitario}
                                    className="h-8 w-32 text-right"
                                    onChange={(e) => updateServiceItem(item.id, 'valor_unitario', parseFloat(e.target.value) || 0)} />
                                </td>
                                <td className="px-3 py-2 text-right font-medium tabular-nums">
                                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.cantidad * item.valor_unitario)}
                                </td>
                                <td className="px-2 py-2">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    type="button" onClick={() => removeServiceItem(item.id)}>
                                    <Trash2 className="size-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Button variant="outline" size="sm" type="button"
                        className="flex items-center gap-1.5" onClick={addServiceItem}>
                        <Plus className="size-4" /> Agregar ítem
                      </Button>
                    </div>
                  )}
                </ColoredSectionCard>

                {/* Custodia/Arriendo de Equipos */}
                {(enableCustody || formData.custodyMode !== 'none' || selectedServiceType?.name === 'Arriendo de Equipos' || selectedServiceType?.name === 'Custodia de Vehículos ') && (
                  <CustodySection 
                    serviceTypeName={selectedServiceType?.name}
                    custodyMode={formData.custodyMode}
                    custodyDays={formData.custodyDays}
                    custodyDailyRate={formData.custodyDailyRate}
                    custodyRateType={formData.custodyRateType}
                    custodyStartDate={formData.custodyStartDate}
                    custodyEndDate={formData.custodyEndDate}
                    custodyVehicleType={formData.custodyVehicleType}
                    custodyDiscountPercentage={formData.custodyDiscountPercentage}
                    custodyTotalAmount={formData.custodyTotalAmount}
                    custodyNotes={formData.custodyNotes}
                    onCustodyModeChange={(value) => setFormData(prev => ({ ...prev, custodyMode: value }))}
                    onCustodyDaysChange={(value) => setFormData(prev => ({ ...prev, custodyDays: value }))}
                    onCustodyDailyRateChange={(value) => setFormData(prev => ({ ...prev, custodyDailyRate: value }))}
                    onCustodyRateTypeChange={(value) => setFormData(prev => ({ ...prev, custodyRateType: value }))}
                    onCustodyStartDateChange={(value) => setFormData(prev => ({ ...prev, custodyStartDate: value }))}
                    onCustodyEndDateChange={(value) => setFormData(prev => ({ ...prev, custodyEndDate: value }))}
                    onCustodyVehicleTypeChange={(value) => setFormData(prev => ({ ...prev, custodyVehicleType: value }))}
                    onCustodyDiscountPercentageChange={(value) => setFormData(prev => ({ ...prev, custodyDiscountPercentage: value }))}
                    onCustodyTotalAmountChange={(value) => setFormData(prev => ({ ...prev, custodyTotalAmount: value }))}
                    onCustodyNotesChange={(value) => setFormData(prev => ({ ...prev, custodyNotes: value }))}
                  />
                )}

                {/* Observaciones */}
                <ColoredSectionCard
                  title="Estado y Observaciones"
                  icon={<FileText className="size-5" />}
                  color="cyan"
                >
                  <ObservationsSection
                    status={formData.status}
                    onStatusChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    observations={formData.observations}
                    onObservationsChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
                    disabled={false}
                  />
                </ColoredSectionCard>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Footer - Navigation & Actions */}
      <div className="flex-shrink-0 pt-3 mt-3 border-t border-border/50 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          {/* Left buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isCreating || isUpdating}
              className="text-xs sm:text-sm px-2 sm:px-3"
            >
              Cancelar
            </Button>

            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={isCreating || isUpdating}
                className="text-xs sm:text-sm px-2 sm:px-3"
              >
                <ChevronLeft className="size-4 mr-0.5 sm:mr-1" />
                Anterior
              </Button>
            )}
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Guardar persistente en edición: type="button" (no submit) para
                evitar doble guardado; valida el formulario completo desde cualquier fase */}
            {service && (
              <Button
                key="save"
                type="button"
                size="sm"
                onClick={performSave}
                disabled={isCreating || isUpdating || isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 sm:px-3"
              >
                <Save className="size-4 mr-0.5 sm:mr-1" />
                {isUpdating || isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            )}

            {currentStep < totalSteps ? (
              <Button
                key="next"
                type="button"
                size="sm"
                variant={service ? 'outline' : 'default'}
                onClick={(e) => {
                  e.preventDefault();
                  handleNext();
                }}
                disabled={!canGoNext()}
                className="text-xs sm:text-sm px-2 sm:px-3"
              >
                Siguiente
                <ChevronRight className="size-4 ml-0.5 sm:ml-1" />
              </Button>
            ) : !service ? (
              <Button
                key="submit"
                type="submit"
                form="enhanced-service-form"
                size="sm"
                disabled={hasErrors || isCreating || isUpdating || isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm px-2 sm:px-3"
              >
                {isCreating || isUpdating ? 'Guardando...' : 'Crear Servicio'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <OperatorNotificationDialogs
        confirmOpen={operatorNotificationConfirmOpen}
        retryOpen={operatorNotificationRetryOpen}
        isSending={isSendingOperatorNotification}
        onConfirmSend={confirmNotification}
        onDecline={declineNotification}
        onRetry={retryNotification}
        onRetryCancel={cancelRetry}
      />
    </div>
  );
});
