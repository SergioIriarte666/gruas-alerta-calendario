import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useInvoiceReport } from '@/hooks/reports/useInvoiceReport';

interface InvoiceReportExportProps {
  clientId?: string;
  clientName?: string;
  invoices: any[];
  metrics?: {
    totalInvoiced: number;
    totalPaid: number;
    pendingAmount: number;
    overdueInvoices: number;
  };
}

export const InvoiceReportExport = ({ 
  clientId, 
  clientName, 
  invoices, 
  metrics 
}: InvoiceReportExportProps) => {
  const { handleExportInvoiceReport } = useInvoiceReport({ invoices, metrics });

  const handleExport = (format: 'pdf' | 'excel', includePaymentHistory?: boolean) => {
    handleExportInvoiceReport(format, {
      clientId,
      clientName,
      includePaymentHistory
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileDown className="size-4" />
          Exportar Facturas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('pdf')}>
          <FileText className="mr-2 size-4" />
          <span>Exportar PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          <FileSpreadsheet className="mr-2 size-4" />
          <span>Exportar Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel', true)}>
          <FileSpreadsheet className="mr-2 size-4" />
          <span>Excel con Historial de Pagos</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
