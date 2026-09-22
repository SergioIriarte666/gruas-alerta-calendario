import { IssuedInvoiceBatchImport } from '@/components/closures/IssuedInvoiceBatchImport';
import { Button } from '@/components/ui/button';
import { Plus, FileDown, ReceiptText } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
}

const InvoicesHeader = ({ onCreateInvoice, onOpenExportModal }: InvoicesHeaderProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <span className="dashboard-section-kicker"><ReceiptText className="size-3.5" />Facturación y cobranza</span>
        <h1 className="dashboard-section-title">Facturas</h1>
        <p className="dashboard-section-description">Emisión, vencimientos y seguimiento de pagos.</p>
      </div>
        <div className={`flex gap-2 ${isMobile ? 'w-full flex-col' : 'flex-wrap'}`}>
          <IssuedInvoiceBatchImport />
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
            className={`dashboard-report-button ${isMobile ? 'w-full' : ''}`}
          >
            <Plus className="size-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
    </div>
  );
};

export default InvoicesHeader;
