
import { Button } from '@/components/ui/button';
import { Plus, FileDown, FileText, FileSpreadsheet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onExport: (format: 'pdf' | 'excel', includePaymentHistory?: boolean) => void;
}

const InvoicesHeader = ({ onCreateInvoice, onExport }: InvoicesHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Facturas</h1>
        <p className="text-muted-foreground mt-1">Gestión de facturación y pagos</p>
      </div>
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport('pdf')}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Exportar PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('excel')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span>Exportar Excel</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport('excel', true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              <span>Excel con Historial de Pagos</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
