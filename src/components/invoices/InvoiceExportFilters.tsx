import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import DateRangePicker from '@/components/closures/DateRangePicker';
import ClientSelector from '@/components/closures/ClientSelector';
import { Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { InvoiceExportFiltersState } from './InvoiceExportModal';

interface InvoiceExportFiltersProps {
  filters: InvoiceExportFiltersState;
  onFilterChange: (key: keyof InvoiceExportFiltersState, value: any) => void;
  onQuickFilter: (days: number | 'all') => void;
}

const INVOICE_STATUSES = [
  { value: 'all', label: 'Todas las facturas' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviada' },
  { value: 'paid', label: 'Pagada' },
  { value: 'overdue', label: 'Vencida' },
  { value: 'cancelled', label: 'Anulada' }
];

const InvoiceExportFilters = ({ filters, onFilterChange, onQuickFilter }: InvoiceExportFiltersProps) => {
  return (
    <div className="space-y-6">
      {/* Quick Filters */}
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="size-4" />
          Filtros Rápidos
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickFilter(30)}
            className="text-xs"
          >
            Este mes
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickFilter(60)}
            className="text-xs"
          >
            Último mes
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickFilter(90)}
            className="text-xs"
          >
            Últimos 3 meses
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickFilter(365)}
            className="text-xs"
          >
            Este año
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickFilter('all')}
            className="text-xs"
          >
            Todo
          </Button>
        </div>
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">📅 PERÍODO</Label>
        <DateRangePicker 
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateFromChange={(date) => onFilterChange('dateFrom', date)}
          onDateToChange={(date) => onFilterChange('dateTo', date)}
        />
      </div>

      {/* Client Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">👤 CLIENTE (Opcional)</Label>
        <ClientSelector 
          clientId={filters.clientId}
          onClientChange={(clientId) => onFilterChange('clientId', clientId)}
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">📊 ESTADO</Label>
        <Select 
          value={filters.status} 
          onValueChange={(value) => onFilterChange('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Additional Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">✅ OPCIONES ADICIONALES</Label>
        <div className="space-y-3">
          <div className="flex items-center gap-x-2">
            <Checkbox 
              id="includePaymentHistory"
              checked={filters.includePaymentHistory}
              onCheckedChange={(checked) => onFilterChange('includePaymentHistory', checked)}
            />
            <label
              htmlFor="includePaymentHistory"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incluir historial de pagos detallado
            </label>
          </div>
          <div className="flex items-center gap-x-2">
            <Checkbox 
              id="groupByMonth"
              checked={filters.groupByMonth}
              onCheckedChange={(checked) => onFilterChange('groupByMonth', checked)}
            />
            <label
              htmlFor="groupByMonth"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Agrupar por mes
            </label>
          </div>
          <div className="flex items-center gap-x-2">
            <Checkbox 
              id="includeNotes"
              checked={filters.includeNotes}
              onCheckedChange={(checked) => onFilterChange('includeNotes', checked)}
            />
            <label
              htmlFor="includeNotes"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Incluir notas y observaciones
            </label>
          </div>
        </div>
      </div>

      {/* Format Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">📄 FORMATO DE EXPORTACIÓN</Label>
        <RadioGroup 
          value={filters.format} 
          onValueChange={(value) => onFilterChange('format', value as 'pdf' | 'excel')}
          className="flex gap-4"
        >
          <div className="flex items-center gap-x-2">
            <RadioGroupItem value="pdf" id="pdf" />
            <label
              htmlFor="pdf"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
            >
              <FileText className="size-4" />
              PDF
            </label>
          </div>
          <div className="flex items-center gap-x-2">
            <RadioGroupItem value="excel" id="excel" />
            <label
              htmlFor="excel"
              className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="size-4" />
              Excel
            </label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
};

export default InvoiceExportFilters;
