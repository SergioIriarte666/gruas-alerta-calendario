import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Service } from '@/types';
import { useQuotePDFImport } from '@/hooks/vip/useQuotePDFImport';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  Loader2, RotateCcw, ArrowRight, CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { getUserCurrencySync } from '@/utils/currencyUtils';

interface QuotePDFImporterProps {
  clientId: string;
  clientName: string;
  services: Service[];
  onComplete: () => void;
}

export const QuotePDFImporter: React.FC<QuotePDFImporterProps> = ({
  clientId,
  clientName,
  services,
  onComplete,
}) => {
  const { state, processFiles, applyMatches, reset, reassignMatch } = useQuotePDFImport(clientId, services);
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set());
  const [previewService, setPreviewService] = useState<Service | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) return;
    setSelectedMatches(new Set());
    processFiles(pdfFiles);
  }, [processFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  React.useEffect(() => {
    if (state.step === 'preview') {
      const selectableIndices = new Set<number>();
      state.matches.forEach((m, i) => {
        if (m.status === 'matched') selectableIndices.add(i);
      });
      setSelectedMatches(selectableIndices);
    }
  }, [state.step, state.matches]);

  const toggleMatch = (index: number) => {
    setSelectedMatches(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleApply = () => {
    const selected = state.matches.filter((_, i) => selectedMatches.has(i));
    applyMatches(selected);
  };

  const handleDone = () => {
    reset();
    onComplete();
  };

  const matchedCount = state.matches.filter(m => m.status === 'matched').length;
  const sameQuoteCount = state.matches.filter(m => m.status === 'same_quote').length;
  const noMatchCount = state.matches.filter(m => m.status === 'no_match').length;
  const alreadyHasQuoteCount = state.matches.filter(m => m.status === 'already_has_quote').length;

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Upload className="size-5" />
          Importar Cotización desde PDF - {toTitleCase(clientName)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step: Idle - Dropzone */}
        {state.step === 'idle' && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <FileText className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">
              Arrastra PDFs de cotizaciones aquí
            </p>
            <p className="text-xs text-muted-foreground">
              o haz clic para seleccionar archivos • Solo PDF
            </p>
          </div>
        )}

        {/* Step: Uploading/Processing */}
        {(state.step === 'uploading' || state.step === 'matching') && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 text-primary animate-spin" />
              <span className="text-sm text-foreground">
                {state.step === 'uploading'
                  ? `Procesando PDF ${state.progress.current}/${state.progress.total}...`
                  : 'Buscando servicios coincidentes...'}
              </span>
            </div>
            {state.progress.fileName && (
              <p className="text-xs text-muted-foreground ml-8">{state.progress.fileName}</p>
            )}
            <Progress
              value={(state.progress.current / Math.max(state.progress.total, 1)) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Step: Preview Matches */}
        {state.step === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <CheckCircle className="size-3 mr-1" />
                {matchedCount} coincidencias
              </Badge>
              {state.parsedQuotes.length > 0 && (
                <Badge variant="secondary" className="bg-success/10 text-success-text border-success/20">
                  💰 Total Cot: {formatCurrency(state.parsedQuotes[0]?.totals.neto || 0, getUserCurrencySync())}
                </Badge>
              )}
              {sameQuoteCount > 0 && (
                <Badge variant="secondary" className="bg-info/10 text-info-text border-info/20">
                  <CheckCheck className="size-3 mr-1" />
                  {sameQuoteCount} ya asignada
                </Badge>
              )}
              {alreadyHasQuoteCount > 0 && (
                <Badge variant="secondary" className="bg-warning/10 text-warning-text border-warning/20">
                  <AlertTriangle className="size-3 mr-1" />
                  {alreadyHasQuoteCount} Cot. diferente
                </Badge>
              )}
              {noMatchCount > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="size-3 mr-1" />
                  {noMatchCount} sin match
                </Badge>
              )}
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">Patente</TableHead>
                    <TableHead className="text-xs">Servicio</TableHead>
                    <TableHead className="text-xs">Cot. Actual</TableHead>
                    <TableHead className="text-xs">N° Cot. Nueva</TableHead>
                    <TableHead className="text-xs text-right">Valor Servicio</TableHead>

                    <TableHead className="text-xs">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.matches.map((match, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMatches.has(index)}
                          onCheckedChange={() => toggleMatch(index)}
                          disabled={match.status === 'no_match' || match.status === 'same_quote'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {match.parsedItem.patente}
                      </TableCell>
                      <TableCell className="text-xs">
                        {match.candidates && match.candidates.length > 1 ? (
                          <div className="flex items-center gap-1">
                            <Select
                              value={match.service?.id ?? ''}
                              onValueChange={(val) => reassignMatch(index, val)}
                            >
                              <SelectTrigger className="h-7 text-xs font-mono w-44">
                                <SelectValue placeholder="Seleccionar..." />
                              </SelectTrigger>
                              <SelectContent>
                                {match.candidates.map((cand) => (
                                  <SelectItem key={cand.id} value={cand.id} className="text-xs font-mono">
                                    {cand.folio}
                                    {cand.serviceDate && ` (${format(new Date(cand.serviceDate), 'dd/MM')})`}
                                    {cand.quoteNumber ? ` · ${cand.quoteNumber}` : ' · sin cot.'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {match.service && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setPreviewService(match.service!); }}
                                className="text-primary hover:text-primary/80"
                                title="Ver detalle"
                              >
                                <Eye className="size-3.5" />
                              </button>
                            )}
                          </div>
                        ) : match.service ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewService(match.service!); }}
                            className="text-primary underline hover:text-primary/80 cursor-pointer font-medium"
                          >
                            {match.service.folio}
                            {match.service.serviceDate && (
                              <span className="text-muted-foreground ml-1 no-underline">
                                ({format(new Date(match.service.serviceDate), 'dd/MM')})
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {match.service?.quoteNumber ? (
                          <span className="text-foreground">{match.service.quoteNumber}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{match.quoteNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {match.parsedItem.amount > 0
                          ? formatCurrency(match.parsedItem.amount, getUserCurrencySync())
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {match.status === 'matched' && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                            <CheckCircle className="size-3 mr-1" />
                            Match
                          </Badge>
                        )}
                        {match.status === 'same_quote' && (
                          <Badge variant="secondary" className="bg-info/10 text-info-text text-xs">
                            <CheckCheck className="size-3 mr-1" />
                            Ya asignada
                          </Badge>
                        )}
                        {match.status === 'already_has_quote' && (
                          <Badge variant="secondary" className="bg-warning/10 text-warning-text text-xs">
                            <AlertTriangle className="size-3 mr-1" />
                            Cot. diferente
                          </Badge>
                        )}
                        {match.status === 'no_match' && (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                            <XCircle className="size-3 mr-1" />
                            Sin match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="size-3 mr-2" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={selectedMatches.size === 0}
              >
                Aplicar {selectedMatches.size} Cotizaciones
                <ArrowRight className="size-3 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Applying */}
        {state.step === 'applying' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 text-primary animate-spin" />
              <span className="text-sm text-foreground">
                Actualizando servicios {state.progress.current}/{state.progress.total}...
              </span>
            </div>
            <Progress
              value={(state.progress.current / Math.max(state.progress.total, 1)) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Step: Done */}
        {state.step === 'done' && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle className="size-10 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Importación completada</p>
            <Button size="sm" onClick={handleDone}>
              <RotateCcw className="size-3 mr-2" />
              Importar más
            </Button>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <XCircle className="size-4 shrink-0" />
              Error al importar cotización
            </div>
            <p className="text-xs text-muted-foreground ml-6">{state.error}</p>
            <Button variant="outline" size="sm" className="ml-6 mt-1" onClick={reset}>
              <RotateCcw className="size-3 mr-2" />
              Reintentar
            </Button>
          </div>
        )}
      </CardContent>

      {previewService && (
        <ServiceDetailsModal
          service={previewService}
          isOpen={!!previewService}
          onClose={() => setPreviewService(null)}
        />
      )}
    </Card>
  );
};
