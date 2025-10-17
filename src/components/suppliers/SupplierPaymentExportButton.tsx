import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, Clock } from 'lucide-react';
import { SupplierPaymentWithDetails, SupplierPaymentReportFilters } from '@/types/suppliers';
import { useSupplierPaymentExport } from '@/hooks/suppliers/useSupplierPaymentExport';

interface SupplierPaymentExportButtonProps {
  payments: SupplierPaymentWithDetails[];
  suppliers: any[];
  categories: any[];
  filters: SupplierPaymentReportFilters;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export const SupplierPaymentExportButton: React.FC<SupplierPaymentExportButtonProps> = ({
  payments,
  suppliers,
  categories,
  filters,
  size = 'default',
  variant = 'outline',
  className = ''
}) => {
  const { exportPayments, isExporting } = useSupplierPaymentExport();

  const handleExport = (format: 'pdf' | 'excel', reportType: 'current' | 'future') => {
    exportPayments(payments, suppliers, categories, { ...filters, reportType }, format);
  };

  const isDisabled = isExporting || payments.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          disabled={isDisabled}
          className={className}
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => handleExport('pdf', 'current')}
          disabled={isDisabled}
        >
          <FileText className="h-4 w-4 mr-2" />
          Listado Completo (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('excel', 'current')}
          disabled={isDisabled}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Listado Completo (Excel)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => handleExport('pdf', 'future')}
          disabled={isDisabled}
        >
          <Clock className="h-4 w-4 mr-2" />
          Pagos Futuros (PDF)
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('excel', 'future')}
          disabled={isDisabled}
        >
          <Clock className="h-4 w-4 mr-2" />
          Pagos Futuros (Excel)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};