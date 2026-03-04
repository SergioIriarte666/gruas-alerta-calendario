
import { Button } from '@/components/ui/button';
import { Plus, FileDown, Upload } from 'lucide-react';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
  onOpenImportHistory?: () => void;
}

const InvoicesHeader = ({ onCreateInvoice, onOpenExportModal, onOpenImportHistory }: InvoicesHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Facturas</h1>
        <p className="text-muted-foreground mt-1">Gestión de facturación y pagos</p>
      </div>
      <div className="flex gap-2">
        {onOpenImportHistory && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenImportHistory}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar Historial
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onOpenExportModal}
          className="gap-2"
        >
          <FileDown className="h-4 w-4" />
          Exportar Facturas
        </Button>
        <Button
          onClick={onCreateInvoice}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Crear nueva factura"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Factura
        </Button>
      </div>
    </div>
  );
};

export default InvoicesHeader;
