import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Commission, CommissionFilters } from '@/types/commissions';
import { useCommissionExport } from '@/hooks/commissions/useCommissionExport';

interface CommissionExportButtonProps {
  commissions: Commission[];
  filters: CommissionFilters;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export const CommissionExportButton: React.FC<CommissionExportButtonProps> = ({
  commissions,
  filters,
  size = 'default',
  variant = 'outline',
  className = ''
}) => {
  const { exportCommissions, isExporting } = useCommissionExport();

  const handleExport = (format: 'pdf' | 'excel') => {
    exportCommissions(commissions, filters, format);
  };

  const isDisabled = isExporting || commissions.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          disabled={isDisabled}
          className={className}
        >
          <Download className="size-4 mr-2" />
          {isExporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => handleExport('pdf')}
          disabled={isDisabled}
        >
          <FileText className="size-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport('excel')}
          disabled={isDisabled}
        >
          <FileSpreadsheet className="size-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};