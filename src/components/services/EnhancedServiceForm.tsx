import React, { useState, useEffect } from 'react';
import { Service } from '@/types';
import { FolioSection } from './form/FolioSection';
import { DateSection } from './form/DateSection';
import { ClientServiceSection } from './form/ClientServiceSection';
import { VehicleSection } from './form/VehicleSection';
import { EnhancedLocationSection } from './form/EnhancedLocationSection';
import { MultipleOperatorsSection } from './form/MultipleOperatorsSection';
import { ServiceCostDetailsSection } from './form/ServiceCostDetailsSection';
import { EnhancedFinancialSection } from './form/EnhancedFinancialSection';
import { ObservationsSection } from './form/ObservationsSection';
import { FormActions } from './form/FormActions';
import { ServiceFormHeader } from './form/ServiceFormHeader';
import { CustodySection } from '../forms/CustodySection';
import { useServiceManager } from '@/hooks/services/useServiceManager';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useServiceDetailsForForm } from '@/hooks/useServiceDetailsGlobal';
import { useUser } from '@/contexts/UserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Truck, FileText, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnhancedServiceFormProps {
  service?: Service | null;
  prefilledData?: any;
  onSubmit: (serviceData: any) => void;
  onCancel: () => void;
  fromCalendarEvent?: boolean;
}

export const EnhancedServiceForm = ({ 
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
  const { user } = useUser();
  const { createService, updateService, isCreating, isUpdating } = useServiceManager();
  
  // Cargar datos completos del servicio para edición
  const { enhancedService, isLoading: loadingEnhancedService } = useServiceDetailsForForm(service?.id || null);

  const [folio, setFolio] = useState(service?.folio || '');
  const [isManualFolio, setIsManualFolio] = useState(false);
  const [formData, setFormData] = useState({
    requestDate: service?.requestDate || getCurrentChileDateString(),
    serviceDate: service?.serviceDate || getCurrentChileDateString(),
    client: service?.client?.id || '',
    purchaseOrder: service?.purchaseOrder || '',
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
    hasExcess: service?.hasExcess || false,
    clientCoveredAmount: service?.clientCoveredAmount || 0,
    excessAmount: service?.excessAmount || 0,
    status: service?.status || 'pending' as const,
    observations: service?.observations || '',
    // Custody fields - support both camelCase and snake_case
    custodyMode: service?.custodyMode || (service as any)?.custody_mode || 'none',
    custodyDays: service?.custodyDays || (service as any)?.custody_days || undefined,
    custodyDailyRate: service?.custodyDailyRate || (service as any)?.custody_daily_rate || undefined,
    custodyStartDate: service?.custodyStartDate || (service as any)?.custody_start_date || '',
    custodyEndDate: service?.custodyEndDate || (service as any)?.custody_end_date || '',
    custodyVehicleType: service?.custodyVehicleType || (service as any)?.custody_vehicle_type || '',
    custodyDiscountPercentage: (service?.custodyDiscountPercentage !== undefined ? service.custodyDiscountPercentage : (service as any)?.custody_discount_percentage) || 0,
    custodyTotalAmount: service?.custodyTotalAmount || (service as any)?.custody_total_amount || undefined,
    custodyNotes: service?.custodyNotes || (service as any)?.custody_notes || ''
  });

  // Generar folio automáticamente si es un servicio nuevo
  useEffect(() => {
    if (!service) {
      const generateAndSetFolio = async () => {
        try {
          const { data: newFolio, error } = await supabase.rpc('generate_service_folio');
          if (error) throw error;
          setFolio(newFolio);
          setIsManualFolio(false);
        } catch (error) {
          console.error('Error generando folio:', error);
          const fallbackFolio = 'SRV-TEMP-' + Date.now();
          setFolio(fallbackFolio);
          setIsManualFolio(true);
        }
      };
      
      generateAndSetFolio();
    }
  }, [service]);

  // Cargar datos completos del servicio desde el hook mejorado
  useEffect(() => {
    console.log('🔄 [FORM] useEffect triggered:', { 
      enhancedService: !!enhancedService, 
      serviceId: service?.id,
      loadingEnhancedService,
      operators: enhancedService?.operators?.length 
    });
    
    if (enhancedService && service?.id) {
      console.log('🔄 [FORM] Loading enhanced service data for editing:', enhancedService.folio);
      
      // Construir detalles de costos desde el servicio mejorado
      const costDetails = enhancedService.serviceCosts?.map(cost => ({
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

      // Actualizar estado del formulario con datos del servicio mejorado
      setFormData(prev => ({
        ...prev,
        operators: enhancedService.operators || [],
        costDetails,
        // Update custody fields from enhanced service if available
        custodyMode: enhancedService.custodyMode || enhancedService.custody_mode || prev.custodyMode,
        custodyDays: enhancedService.custodyDays || enhancedService.custody_days || prev.custodyDays,
        custodyDailyRate: enhancedService.custodyDailyRate || enhancedService.custody_daily_rate || prev.custodyDailyRate,
        custodyStartDate: enhancedService.custodyStartDate || enhancedService.custody_start_date || prev.custodyStartDate,
        custodyEndDate: enhancedService.custodyEndDate || enhancedService.custody_end_date || prev.custodyEndDate,
        custodyVehicleType: enhancedService.custodyVehicleType || enhancedService.custody_vehicle_type || prev.custodyVehicleType,
        custodyDiscountPercentage: (enhancedService.custodyDiscountPercentage !== undefined ? enhancedService.custodyDiscountPercentage : enhancedService.custody_discount_percentage) || prev.custodyDiscountPercentage,
        custodyTotalAmount: enhancedService.custodyTotalAmount || enhancedService.custody_total_amount || prev.custodyTotalAmount,
        custodyNotes: enhancedService.custodyNotes || enhancedService.custody_notes || prev.custodyNotes
      }));

      console.log('✅ [FORM] Enhanced service data loaded:', {
        operators: enhancedService.operators?.length || 0,
        costs: costDetails.length,
        totalCommissions: enhancedService.totalCommissions,
        totalCosts: enhancedService.totalCosts,
        custodyMode: enhancedService.custodyMode || enhancedService.custody_mode
      });
    }
  }, [enhancedService, service?.id, loadingEnhancedService]);

  // Efecto para cargar datos existentes del servicio (solo datos básicos, NO operadores)
  useEffect(() => {
    if (service && !enhancedService) {
      console.log('🔄 [FORM] Loading basic service data (no enhanced service yet)');
      setFolio(service.folio);
      setFormData({
        requestDate: service.requestDate,
        serviceDate: service.serviceDate,
        client: service.client?.id || '',
        purchaseOrder: service.purchaseOrder || '',
        quoteNumber: service.quoteNumber || '',
        serviceType: service.serviceType?.id || '',
        vehicleBrand: service.vehicleBrand,
        vehicleModel: service.vehicleModel,
        licensePlate: service.licensePlate,
        origin: service.origin,
        destination: service.destination,
        crane: service.crane?.id || '',
        operators: [], // Vacío hasta que se cargue el enhanced service
        value: service.value,
        costDetails: [], // Vacío hasta que se cargue el enhanced service
        hasExcess: service.hasExcess,
        clientCoveredAmount: service.clientCoveredAmount || 0,
        excessAmount: service.excessAmount || 0,
        status: service.status,
        observations: service.observations || '',
        // Custody fields - support both camelCase and snake_case
        custodyMode: service.custodyMode || (service as any)?.custody_mode || 'none',
        custodyDays: service.custodyDays || (service as any)?.custody_days || undefined,
        custodyDailyRate: service.custodyDailyRate || (service as any)?.custody_daily_rate || undefined,
        custodyStartDate: service.custodyStartDate || (service as any)?.custody_start_date || '',
        custodyEndDate: service.custodyEndDate || (service as any)?.custody_end_date || '',
        custodyVehicleType: service.custodyVehicleType || (service as any)?.custody_vehicle_type || '',
        custodyDiscountPercentage: (service.custodyDiscountPercentage !== undefined ? service.custodyDiscountPercentage : (service as any)?.custody_discount_percentage) || 0,
        custodyTotalAmount: service.custodyTotalAmount || (service as any)?.custody_total_amount || undefined,
        custodyNotes: service.custodyNotes || (service as any)?.custody_notes || ''
      });
      setIsManualFolio(true);
    }
  }, [service, enhancedService]);

  // Calculadores de totales
  const getTotalCommissions = () => {
    return formData.operators?.reduce((total, op) => total + (op.commission || 0), 0) || 0;
  };

  const getTotalCosts = () => {
    return formData.costDetails?.reduce((total, cost) => total + (cost.amount || 0), 0) || 0;
  };

  // Custody calculations - Manual mode
  useEffect(() => {
    if (formData.custodyMode === 'manual' && formData.custodyDays && formData.custodyDailyRate) {
      const subtotal = formData.custodyDays * formData.custodyDailyRate;
      const discount = (subtotal * (formData.custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      setFormData(prev => ({ ...prev, custodyTotalAmount: total }));
    }
  }, [formData.custodyDays, formData.custodyDailyRate, formData.custodyDiscountPercentage, formData.custodyMode]);

  // Custody calculations - Calendar mode
  useEffect(() => {
    if (formData.custodyMode === 'calendar' && formData.custodyStartDate && formData.custodyEndDate && formData.custodyDailyRate) {
      const start = new Date(formData.custodyStartDate);
      const end = new Date(formData.custodyEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      const subtotal = diffDays * formData.custodyDailyRate;
      const discount = (subtotal * (formData.custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      
      setFormData(prev => ({ 
        ...prev, 
        custodyDays: diffDays,
        custodyTotalAmount: total 
      }));
    }
  }, [formData.custodyStartDate, formData.custodyEndDate, formData.custodyDailyRate, formData.custodyDiscountPercentage, formData.custodyMode]);

  // Sync custody total amount with main service value for rental equipment
  useEffect(() => {
    if (formData.custodyTotalAmount && formData.custodyTotalAmount > 0) {
      // Update main service value to match custody total for rental services
      setFormData(prev => ({ 
        ...prev, 
        value: formData.custodyTotalAmount 
      }));
    }
  }, [formData.custodyTotalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!folio || folio.trim() === '') {
      toast.error('Error: El folio no puede estar vacío');
      return;
    }

    if (isCreating || isUpdating) {
      return;
    }

    try {
      console.log('🔄 Form submission started:', { folio, serviceType: formData.serviceType });
      
      // Preparar datos finales
      const finalData = {
        ...formData,
        folio,
        operators: formData.operators || [],
        costDetails: formData.costDetails || [],
        // Ensure value is set from custodyTotalAmount for rental services
        value: formData.custodyTotalAmount && formData.custodyTotalAmount > 0 
          ? formData.custodyTotalAmount 
          : formData.value
      };

      console.log('📤 Final data prepared:', finalData);

      let result: Service;
      
      if (service) {
        console.log('🔄 Updating existing service...');
        result = await updateService(service.id, finalData);
      } else {
        console.log('🔄 Creating new service...');
        result = await createService(finalData);
      }

      console.log('✅ Service operation completed:', { id: result.id, folio: result.folio });

      // Notificar éxito
      const action = service ? 'actualizado' : 'creado';
      toast.success(`Servicio ${action} exitosamente: ${result.folio}`);
      
      console.log('📞 Calling onSubmit callback...');
      // Llamar callback
      onSubmit?.(result);
      
      console.log('✅ Form submission completed successfully');
      
    } catch (error) {
      console.error('❌ Error en envío del formulario:', error);
      console.error('❌ Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      
      let errorMessage = 'Error desconocido';
      
      if (error?.message) {
        // Si el error viene de Supabase/PostgreSQL
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
      
      toast.error(`Error al ${service ? 'actualizar' : 'crear'} el servicio: ${errorMessage}`);
    }
  };

  const selectedServiceType = serviceTypes?.find(st => st.id === formData.serviceType);

  return (
    <div className="space-y-6">
      <ServiceFormHeader service={service} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Información Básica */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Información Básica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FolioSection
              folio={folio}
              onFolioChange={setFolio}
              isManualFolio={isManualFolio}
              onManualFolioChange={setIsManualFolio}
              onGenerateNewFolio={async () => {
                try {
                  const { data, error } = await supabase.rpc('generate_service_folio');
                  if (error) throw error;
                  setFolio(data);
                } catch (error) {
                  console.error('Error generando folio:', error);
                  toast.error('Error generando folio');
                }
              }}
              isEditing={!!service}
              serviceId={service?.id}
              isLoading={false}
              disabled={false}
              onValidationChange={() => {}}
            />

            <DateSection
              requestDate={formData.requestDate}
              serviceDate={formData.serviceDate}
              onRequestDateChange={(date) => setFormData(prev => ({ ...prev, requestDate: date }))}
              onServiceDateChange={(date) => setFormData(prev => ({ ...prev, serviceDate: date }))}
              disabled={false}
            />

            <ClientServiceSection
              clientId={formData.client}
              onClientChange={(value) => setFormData(prev => ({ ...prev, client: value }))}
              clients={clients}
              purchaseOrder={formData.purchaseOrder}
              onPurchaseOrderChange={(value) => setFormData(prev => ({ ...prev, purchaseOrder: value }))}
              quoteNumber={formData.quoteNumber}
              onQuoteNumberChange={(value) => setFormData(prev => ({ ...prev, quoteNumber: value }))}
              serviceTypeId={formData.serviceType}
              onServiceTypeChange={(value) => setFormData(prev => ({ ...prev, serviceType: value }))}
              serviceTypes={serviceTypes}
              serviceTypesLoading={serviceTypesLoading}
              disabled={false}
              invoiceFolio={service?.invoiceFolio}
              invoiceNumeroFiscal={service?.invoiceNumeroFiscal}
            />
          </CardContent>
        </Card>

        {/* Información del Vehículo y Ubicación */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Vehículo y Ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
            />

            <EnhancedLocationSection
              origin={formData.origin}
              onOriginChange={(value) => setFormData(prev => ({ ...prev, origin: value }))}
              destination={formData.destination}
              onDestinationChange={(value) => setFormData(prev => ({ ...prev, destination: value }))}
              originRequired={selectedServiceType?.originRequired || false}
              destinationRequired={selectedServiceType?.destinationRequired || false}
              disabled={false}
            />
          </CardContent>
        </Card>

        {/* Recursos Asignados */}
        <Card>
          <CardHeader>
            <CardTitle>Recursos Asignados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="crane">
                Grúa {selectedServiceType?.craneRequired && <span className="text-red-500">*</span>}
                {!selectedServiceType?.craneRequired && <span className="text-muted-foreground text-sm">(Opcional)</span>}
              </Label>
               <Select 
                value={formData.crane} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, crane: value === "unassigned" ? "" : value }))} 
                disabled={false}
              >
                <SelectTrigger>
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
            </div>
          </CardContent>
        </Card>

        {/* Operadores */}
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
        />

        {/* Costos del Servicio */}
        <ServiceCostDetailsSection
          costDetails={formData.costDetails || []}
          onCostDetailsChange={(costs) => setFormData(prev => ({ ...prev, costDetails: costs }))}
          serviceId={service?.id}
          disabled={false}
        />

        {/* Financiero */}
        <EnhancedFinancialSection
          value={formData.value}
          onValueChange={(value) => setFormData(prev => ({ ...prev, value }))}
          totalCommissions={getTotalCommissions()}
          totalCosts={getTotalCosts()}
          hasExcess={formData.hasExcess}
          onHasExcessChange={(value) => setFormData(prev => ({ ...prev, hasExcess: value }))}
          clientCoveredAmount={formData.clientCoveredAmount}
          onClientCoveredAmountChange={(value) => setFormData(prev => ({ ...prev, clientCoveredAmount: value }))}
          excessAmount={formData.excessAmount}
          onExcessAmountChange={(value) => setFormData(prev => ({ ...prev, excessAmount: value }))}
          disabled={false}
        />

        {/* Custodia/Arriendo de Equipos */}
        {(formData.custodyMode !== 'none' || selectedServiceType?.name === 'Arriendo de Equipos') && (
          <CustodySection 
            serviceTypeName={selectedServiceType?.name}
            custodyMode={formData.custodyMode}
            custodyDays={formData.custodyDays}
            custodyDailyRate={formData.custodyDailyRate}
            custodyStartDate={formData.custodyStartDate}
            custodyEndDate={formData.custodyEndDate}
            custodyVehicleType={formData.custodyVehicleType}
            custodyDiscountPercentage={formData.custodyDiscountPercentage}
            custodyTotalAmount={formData.custodyTotalAmount}
            custodyNotes={formData.custodyNotes}
            onCustodyModeChange={(value) => setFormData(prev => ({ ...prev, custodyMode: value }))}
            onCustodyDaysChange={(value) => setFormData(prev => ({ ...prev, custodyDays: value }))}
            onCustodyDailyRateChange={(value) => setFormData(prev => ({ ...prev, custodyDailyRate: value }))}
            onCustodyStartDateChange={(value) => setFormData(prev => ({ ...prev, custodyStartDate: value }))}
            onCustodyEndDateChange={(value) => setFormData(prev => ({ ...prev, custodyEndDate: value }))}
            onCustodyVehicleTypeChange={(value) => setFormData(prev => ({ ...prev, custodyVehicleType: value }))}
            onCustodyDiscountPercentageChange={(value) => setFormData(prev => ({ ...prev, custodyDiscountPercentage: value }))}
            onCustodyTotalAmountChange={(value) => setFormData(prev => ({ ...prev, custodyTotalAmount: value }))}
            onCustodyNotesChange={(value) => setFormData(prev => ({ ...prev, custodyNotes: value }))}
          />
        )}

        {/* Observaciones */}
        <ObservationsSection
          status={formData.status}
          onStatusChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          observations={formData.observations}
          onObservationsChange={(value) => setFormData(prev => ({ ...prev, observations: value }))}
          disabled={false}
        />

        {/* Acciones del Formulario */}
        <FormActions 
          onCancel={onCancel} 
          isEditing={!!service} 
          disabled={false}
          loading={isCreating || isUpdating}
        />
      </form>
    </div>
  );
};
