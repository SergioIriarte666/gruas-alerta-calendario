import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, FileDown } from 'lucide-react';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
}

const InvoicesHeader = ({ onCreateInvoice, onOpenExportModal }: InvoicesHeaderProps) => {
  return (
    <PageHeader
      title="Facturas"
      description="Gestión de facturación, cobranzas y seguimiento de estados de pago."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExportModal}
            className="gap-2 border-border/70 bg-card/70"
          >
            <FileDown className="size-4" />
            Exportar
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
      }
    />
  );
};

export default InvoicesHeader;
