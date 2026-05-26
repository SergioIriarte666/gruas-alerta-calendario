import { CheckCircle2, AlertTriangle, XCircle, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
    <Card className="w-full sm:min-w-[320px]">
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-sm ${accentClassName}`}>
          <FileText className="size-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
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
      </CardContent>
    </Card>
  );
};
