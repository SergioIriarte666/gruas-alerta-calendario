import { CheckCircle2, AlertTriangle, XCircle, FileClock, ChevronDown } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useImportHistoryLog, type ImportHistoryLogEntry } from '@/hooks/useImportHistoryLog';
import type { ImportType } from '@/hooks/useImportMappings';

interface RecentImportLogsCardProps {
  importType: ImportType;
  accentClassName: string;
  title: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const getStatusIcon = (status: string | null) => {
  if (status === 'success') return <CheckCircle2 className="size-4 text-green-600" />;
  if (status === 'partial') return <AlertTriangle className="size-4 text-amber-600" />;
  return <XCircle className="size-4 text-red-600" />;
};

const getSummary = (
  importedCount: number,
  errorCount: number,
  skippedCount: number,
  status: string | null
) => {
  if (status === 'success') {
    return `${importedCount} documentos importados`;
  }

  const parts = [`${importedCount} ok`, `${errorCount} errores`];
  if (skippedCount > 0) {
    parts.push(`${skippedCount} omitidos`);
  }
  return parts.join(', ');
};

export const RecentImportLogsCard = ({
  importType,
  accentClassName,
  title,
}: RecentImportLogsCardProps) => {
  const { logs } = useImportHistoryLog(importType, 5);

  if (logs.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between gap-2 bg-background sm:w-auto"
          aria-label={`${title}: ${logs.length} registros disponibles`}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FileClock className={accentClassName} />
            <span className="truncate">{title}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1.5 text-[10px]">
              {logs.length}
            </Badge>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(420px,calc(100vw-24px))] overflow-hidden p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className={`flex items-center gap-2 text-sm font-semibold ${accentClassName}`}>
            <FileClock className="size-4" />
            {title}
          </div>
          <span className="text-xs text-muted-foreground">Últimos {logs.length}</span>
        </div>

        <div className="max-h-[min(420px,var(--radix-popover-content-available-height))] overflow-y-auto px-4">
          <Accordion type="single" collapsible className="w-full">
            {logs.map((log: ImportHistoryLogEntry) => (
              <AccordionItem key={log.id} value={log.id} className="border-b last:border-b-0">
                <AccordionTrigger className="py-3 text-left hover:no-underline">
                  <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                    {getStatusIcon(log.status)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {formatDate(log.created_at)} - {log.file_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {getSummary(log.imported_count, log.error_count, log.skipped_count, log.status)}
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-1 pb-3 text-xs text-muted-foreground">
                  <div>Archivo: {log.file_name}</div>
                  <div>Rango: {formatDate(log.date_range_start)} - {formatDate(log.date_range_end)}</div>
                  <div>Importadas: {log.imported_count}</div>
                  <div>Errores: {log.error_count}</div>
                  <div>Omitidas: {log.skipped_count}</div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </PopoverContent>
    </Popover>
  );
};
