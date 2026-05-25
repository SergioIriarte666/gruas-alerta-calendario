
import { Button } from '@/components/ui/button';
import { Plus, FileDown } from 'lucide-react';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
}

const InvoicesHeader = ({ onCreateInvoice, onOpenExportModal }: InvoicesHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Facturas</h1>
        <p className="text-muted-foreground mt-1">Gestión de facturación y pagos</p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onOpenExportModal}
          className="gap-2"
        >
          <FileDown className="size-4" />
          Exportar Facturas
        </Button>
        <Button
          onClick={onCreateInvoice}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Crear nueva factura"
        >
          <Plus className="size-4 mr-2" />
          Nueva Factura
        </Button>
      </div>
    </div>
  );
};

export default InvoicesHeader;
