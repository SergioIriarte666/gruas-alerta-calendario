import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Plus, FileDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
}

const InvoicesHeader = ({ onCreateInvoice, onOpenExportModal }: InvoicesHeaderProps) => {
  const isMobile = useIsMobile();

  return (
    <PageHeader
      title="Facturas"
      description="Gestión de facturación, cobranzas y seguimiento de estados de pago."
      actions={
        <div className={`flex gap-2 ${isMobile ? 'w-full flex-col' : 'flex-wrap'}`}>
          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            className={`gap-2 border-border/70 bg-card/70 ${isMobile ? 'w-full' : ''}`}
            onClick={onOpenExportModal}
          >
            <FileDown className="size-4" />
            Exportar
          </Button>
          <Button
            onClick={onCreateInvoice}
            className={`bg-primary hover:bg-primary/90 text-primary-foreground ${isMobile ? 'w-full' : ''}`}
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
