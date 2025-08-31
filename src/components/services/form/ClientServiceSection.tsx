
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
  quoteNumber?: string;
  onQuoteNumberChange?: (value: string) => void;
  serviceTypeId: string;
  onServiceTypeChange: (serviceTypeId: string) => void;
  serviceTypes: ServiceType[];
  serviceTypesLoading: boolean;
  disabled?: boolean;
  // Invoice information
  invoiceFolio?: string;
  invoiceNumeroFiscal?: string;
}

export const ClientServiceSection = ({
  clientId,
  onClientChange,
  clients,
  purchaseOrder,
  onPurchaseOrderChange,
  quoteNumber = '',
  onQuoteNumberChange,
  serviceTypeId,
  onServiceTypeChange,
  serviceTypes,
  serviceTypesLoading,
  disabled = false,
  invoiceFolio,
  invoiceNumeroFiscal
}: ClientServiceSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Cliente */}
      <div className="space-y-2">
        <Label htmlFor="client">Cliente</Label>
        <Select value={clientId} onValueChange={onClientChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.filter(c => c.isActive).map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name} - {client.department}
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
          disabled={disabled}
        />
      </div>

      {/* Número de Cotización */}
      <div className="space-y-2">
        <Label htmlFor="quoteNumber">Número de Cotización (Opcional)</Label>
        <Input
          id="quoteNumber"
          value={quoteNumber}
          onChange={(e) => onQuoteNumberChange?.(e.target.value)}
          placeholder="Ej: COT-24-001"
          disabled={disabled}
        />
      </div>

      {/* Información de Facturación - Solo mostrar si existe */}
      {(invoiceFolio || invoiceNumeroFiscal) && (
        <>
          {invoiceFolio && (
            <div className="space-y-2">
              <Label htmlFor="invoiceFolio">Folio Factura</Label>
              <Input
                id="invoiceFolio"
                value={invoiceFolio}
                readOnly
                className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                placeholder="Sin facturar"
              />
            </div>
          )}

          {invoiceNumeroFiscal && (
            <div className="space-y-2">
              <Label htmlFor="invoiceNumeroFiscal">Número Fiscal</Label>
              <Input
                id="invoiceNumeroFiscal"
                value={invoiceNumeroFiscal}
                readOnly
                className="bg-gray-100 dark:bg-gray-800 cursor-not-allowed"
                placeholder="Sin número fiscal"
              />
            </div>
          )}
        </>
      )}

      {/* Tipo de Servicio */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="serviceType">Tipo de Servicio</Label>
        <Select value={serviceTypeId} onValueChange={onServiceTypeChange} disabled={disabled || serviceTypesLoading}>
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
