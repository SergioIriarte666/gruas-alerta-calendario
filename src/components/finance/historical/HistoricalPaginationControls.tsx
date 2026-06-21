import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS, PageSize } from './useHistoricalPagination';

interface HistoricalPaginationControlsProps {
  page: number;
  pageSize: PageSize;
  totalPages: number;
  rangeLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export const HistoricalPaginationControls = ({
  page,
  pageSize,
  totalPages,
  rangeLabel,
  onPageChange,
  onPageSizeChange,
}: HistoricalPaginationControlsProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Mostrar:</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}>
          <SelectTrigger className="w-[80px] h-9" aria-label="Registros por página">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Mostrando {rangeLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm text-foreground whitespace-nowrap">
          Página {page} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
};
