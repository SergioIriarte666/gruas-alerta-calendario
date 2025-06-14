
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client, ServiceType } from '@/types';

interface ClientServiceSectionProps {
  clientId: string;
  onClientChange: (clientId: string) => void;
  clients: Client[];
  purchaseOrder: string;
  onPurchaseOrderChange: (value: string) => void;
  serviceTypeId: string;
  onServiceTypeChange: (serviceTypeId: string) => void;
  serviceTypes: ServiceType[];
  serviceTypesLoading: boolean;
}

export const ClientServiceSection = ({
  clientId,
  onClientChange,
  clients,
  purchaseOrder,
  onPurchaseOrderChange,
  serviceTypeId,
  onServiceTypeChange,
  serviceTypes,
  serviceTypesLoading
}: ClientServiceSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Cliente */}
      <div className="space-y-2">
        <Label htmlFor="client">Cliente</Label>
        <Select value={clientId} onValueChange={onClientChange}>
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
          value={purchaseOrder}
          onChange={(e) => onPurchaseOrderChange(e.target.value)}
          placeholder="Ej: OC-12345"
        />
      </div>

      {/* Tipo de Servicio */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="serviceType">Tipo de Servicio</Label>
        <Select value={serviceTypeId} onValueChange={onServiceTypeChange}>
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
    </div>
  );
};
