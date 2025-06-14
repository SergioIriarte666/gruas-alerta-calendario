import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Service } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';
import { useServiceTypes } from '@/hooks/useServiceTypes';

interface ServiceFormProps {
  service?: Service | null;
  onSubmit: (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const ServiceForm = ({ service, onSubmit, onCancel }: ServiceFormProps) => {
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();
  const { serviceTypes, loading: serviceTypesLoading } = useServiceTypes();

  const [formData, setFormData] = useState({
    requestDate: service?.requestDate || format(new Date(), 'yyyy-MM-dd'),
    serviceDate: service?.serviceDate || format(new Date(), 'yyyy-MM-dd'),
    clientId: service?.client.id || '',
    purchaseOrder: service?.purchaseOrder || '',
    vehicleBrand: service?.vehicleBrand || '',
    vehicleModel: service?.vehicleModel || '',
    licensePlate: service?.licensePlate || '',
    origin: service?.origin || '',
    destination: service?.destination || '',
    serviceTypeId: service?.serviceType.id || '',
    value: service?.value || 0,
    craneId: service?.crane.id || '',
    operatorId: service?.operator.id || '',
    operatorCommission: service?.operatorCommission || 0,
    status: service?.status || 'pending' as const,
    observations: service?.observations || ''
  });

  const [requestDate, setRequestDate] = useState<Date>(
    service?.requestDate ? new Date(service.requestDate) : new Date()
  );
  const [serviceDate, setServiceDate] = useState<Date>(
    service?.serviceDate ? new Date(service.serviceDate) : new Date()
  );

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      requestDate: format(requestDate, 'yyyy-MM-dd'),
      serviceDate: format(serviceDate, 'yyyy-MM-dd')
    }));
  }, [requestDate, serviceDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedClient = clients.find(c => c.id === formData.clientId);
    const selectedCrane = cranes.find(c => c.id === formData.craneId);
    const selectedOperator = operators.find(o => o.id === formData.operatorId);
    const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);

    if (!selectedClient || !selectedCrane || !selectedOperator || !selectedServiceType) {
      alert('Por favor, selecciona todos los campos requeridos');
      return;
    }

    onSubmit({
      requestDate: formData.requestDate,
      serviceDate: formData.serviceDate,
      client: selectedClient,
      purchaseOrder: formData.purchaseOrder,
      vehicleBrand: formData.vehicleBrand,
      vehicleModel: formData.vehicleModel,
      licensePlate: formData.licensePlate,
      origin: formData.origin,
      destination: formData.destination,
      serviceType: {
        id: selectedServiceType.id,
        name: selectedServiceType.name,
        description: selectedServiceType.description || '',
        isActive: selectedServiceType.isActive,
        createdAt: selectedServiceType.createdAt,
        updatedAt: selectedServiceType.updatedAt
      },
      value: formData.value,
      crane: selectedCrane,
      operator: selectedOperator,
      operatorCommission: formData.operatorCommission,
      status: formData.status,
      observations: formData.observations
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fecha de Solicitud */}
        <div className="space-y-2">
          <Label htmlFor="requestDate">Fecha de Solicitud</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !requestDate && "text-muted-foreground"
                )}
                title="Seleccionar fecha de solicitud"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {requestDate ? format(requestDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={requestDate}
                onSelect={(date) => date && setRequestDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Fecha de Servicio */}
        <div className="space-y-2">
          <Label htmlFor="serviceDate">Fecha de Servicio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !serviceDate && "text-muted-foreground"
                )}
                title="Seleccionar fecha de servicio"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {serviceDate ? format(serviceDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={serviceDate}
                onSelect={(date) => date && setServiceDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Cliente */}
        <div className="space-y-2">
          <Label htmlFor="client">Cliente</Label>
          <Select value={formData.clientId} onValueChange={(value) => setFormData(prev => ({ ...prev, clientId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.filter(c => c.isActive).map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orden de Compra */}
        <div className="space-y-2">
          <Label htmlFor="purchaseOrder">Orden de Compra (Opcional)</Label>
          <Input
            id="purchaseOrder"
            value={formData.purchaseOrder}
            onChange={(e) => setFormData(prev => ({ ...prev, purchaseOrder: e.target.value }))}
            placeholder="Ej: OC-12345"
          />
        </div>

        {/* Marca del Vehículo */}
        <div className="space-y-2">
          <Label htmlFor="vehicleBrand">Marca del Vehículo</Label>
          <Input
            id="vehicleBrand"
            value={formData.vehicleBrand}
            onChange={(e) => setFormData(prev => ({ ...prev, vehicleBrand: e.target.value }))}
            placeholder="Ej: Volvo"
            required
          />
        </div>

        {/* Modelo del Vehículo */}
        <div className="space-y-2">
          <Label htmlFor="vehicleModel">Modelo del Vehículo</Label>
          <Input
            id="vehicleModel"
            value={formData.vehicleModel}
            onChange={(e) => setFormData(prev => ({ ...prev, vehicleModel: e.target.value }))}
            placeholder="Ej: FH16"
            required
          />
        </div>

        {/* Patente */}
        <div className="space-y-2">
          <Label htmlFor="licensePlate">Patente</Label>
          <Input
            id="licensePlate"
            value={formData.licensePlate}
            onChange={(e) => setFormData(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
            placeholder="Ej: AB-CD-12"
            required
          />
        </div>

        {/* Tipo de Servicio */}
        <div className="space-y-2">
          <Label htmlFor="serviceType">Tipo de Servicio</Label>
          <Select value={formData.serviceTypeId} onValueChange={(value) => setFormData(prev => ({ ...prev, serviceTypeId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder={serviceTypesLoading ? "Cargando..." : "Seleccionar tipo"} />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grúa */}
        <div className="space-y-2">
          <Label htmlFor="crane">Grúa</Label>
          <Select value={formData.craneId} onValueChange={(value) => setFormData(prev => ({ ...prev, craneId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar grúa" />
            </SelectTrigger>
            <SelectContent>
              {cranes.filter(c => c.isActive).map((crane) => (
                <SelectItem key={crane.id} value={crane.id}>
                  {crane.licensePlate} - {crane.brand} {crane.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Operador */}
        <div className="space-y-2">
          <Label htmlFor="operator">Operador</Label>
          <Select value={formData.operatorId} onValueChange={(value) => setFormData(prev => ({ ...prev, operatorId: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar operador" />
            </SelectTrigger>
            <SelectContent>
              {operators.filter(o => o.isActive).map((operator) => (
                <SelectItem key={operator.id} value={operator.id}>
                  {operator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Valor del Servicio */}
        <div className="space-y-2">
          <Label htmlFor="value">Valor del Servicio (CLP)</Label>
          <Input
            id="value"
            type="number"
            value={formData.value}
            onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) }))}
            placeholder="150000"
            required
          />
        </div>

        {/* Comisión del Operador */}
        <div className="space-y-2">
          <Label htmlFor="operatorCommission">Comisión Operador (CLP)</Label>
          <Input
            id="operatorCommission"
            type="number"
            value={formData.operatorCommission}
            onChange={(e) => setFormData(prev => ({ ...prev, operatorCommission: Number(e.target.value) }))}
            placeholder="15000"
            required
          />
        </div>

        {/* Estado */}
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Origen */}
      <div className="space-y-2">
        <Label htmlFor="origin">Origen</Label>
        <Input
          id="origin"
          value={formData.origin}
          onChange={(e) => setFormData(prev => ({ ...prev, origin: e.target.value }))}
          placeholder="Dirección de origen del servicio"
          required
        />
      </div>

      {/* Destino */}
      <div className="space-y-2">
        <Label htmlFor="destination">Destino</Label>
        <Input
          id="destination"
          value={formData.destination}
          onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
          placeholder="Dirección de destino del servicio"
          required
        />
      </div>

      {/* Observaciones */}
      <div className="space-y-2">
        <Label htmlFor="observations">Observaciones</Label>
        <Textarea
          id="observations"
          value={formData.observations}
          onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
          placeholder="Observaciones adicionales sobre el servicio..."
          rows={3}
        />
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          title="Cancelar la creación o edición del servicio"
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="bg-tms-green hover:bg-tms-green-dark text-white"
          title={service ? 'Actualizar los datos del servicio' : 'Crear el nuevo servicio'}
        >
          {service ? 'Actualizar Servicio' : 'Crear Servicio'}
        </Button>
      </div>
    </form>
  );
};
