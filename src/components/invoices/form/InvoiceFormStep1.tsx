import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Textarea } from '@/components/ui/textarea';
import { Settings, FileText, AlignLeft } from 'lucide-react';
import { InvoiceStatus } from '@/types';

interface InvoiceFormStep1Props {
  status: InvoiceStatus;
  numeroFiscal: string;
  productServiceDescription: string;
  canEditStatus: boolean;
  canEditNumeroFiscal: boolean;
  onStatusChange: (value: InvoiceStatus) => void;
  onNumeroFiscalChange: (value: string) => void;
  onProductServiceDescriptionChange: (value: string) => void;
  errors: {
    status?: string;
    numeroFiscal?: string;
    productServiceDescription?: string;
    [key: string]: string | undefined;
  };
}

export const InvoiceFormStep1 = ({ 
  status, 
  numeroFiscal, 
  productServiceDescription,
  canEditStatus,
  canEditNumeroFiscal,
  onStatusChange, 
  onNumeroFiscalChange,
  onProductServiceDescriptionChange,
  errors 
}: InvoiceFormStep1Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Estado de la Factura"
        icon={<Settings className="h-5 w-5" />}
        color="purple"
        hasError={!!errors.status}
      >
        <div className="space-y-2">
          <Label htmlFor="status" className="text-foreground">Estado</Label>
          <Select 
            onValueChange={(value) => onStatusChange(value as InvoiceStatus)}
            value={status}
            disabled={!canEditStatus}
          >
            <SelectTrigger className="bg-background disabled:opacity-50 disabled:cursor-not-allowed">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="paid">Pagada</SelectItem>
              <SelectItem value="overdue">Vencida</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status}</p>
          )}
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Número Fiscal"
        icon={<FileText className="h-5 w-5" />}
        color="blue"
        hasError={!!errors.numeroFiscal}
      >
        <div className="space-y-2">
          <Label htmlFor="numeroFiscal" className="text-foreground">Número Fiscal (Opcional)</Label>
          <Input
            id="numeroFiscal"
            type="text"
            placeholder="Ej: 123456789"
            value={numeroFiscal}
            onChange={(e) => onNumeroFiscalChange(e.target.value)}
            disabled={!canEditNumeroFiscal}
            className="bg-background disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {errors.numeroFiscal && (
            <p className="text-sm text-destructive">{errors.numeroFiscal}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Número fiscal para registro SII (opcional)
          </p>
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Descripción de Producto o Servicio"
        icon={<AlignLeft className="h-5 w-5" />}
        color="green"
        hasError={!!errors.productServiceDescription}
        required
      >
        <div className="space-y-2">
          <Label htmlFor="productServiceDescription" className="text-foreground">Descripción</Label>
          <Textarea
            id="productServiceDescription"
            value={productServiceDescription}
            onChange={(e) => onProductServiceDescriptionChange(e.target.value)}
            placeholder="Describe el motivo o razón que originó la creación del documento..."
            className="min-h-[100px] bg-background"
          />
          {errors.productServiceDescription && (
            <p className="text-sm text-destructive">{errors.productServiceDescription}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Obligatorio. Entre 10 y 500 caracteres.
          </p>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
