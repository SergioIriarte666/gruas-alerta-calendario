import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Service } from '@/types';
import { usePurchaseOrderPDFImport, MatchedService } from '@/hooks/vip/usePurchaseOrderPDFImport';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { toTitleCase, formatCurrency } from '@/lib/utils';
import { getUserCurrencySync } from '@/utils/currencyUtils';

interface PurchaseOrderPDFImporterProps {
  clientId: string;
  clientName: string;
  services: Service[];
  onComplete: () => void;
}

export const PurchaseOrderPDFImporter: React.FC<PurchaseOrderPDFImporterProps> = ({
  clientId,
  clientName,
  services,
  onComplete,
}) => {
  const { state, processFiles, applyMatches, reset } = usePurchaseOrderPDFImport(clientId, services);
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

  // Auto-select matched items when preview loads
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
  const sameOCCount = state.matches.filter(m => m.status === 'same_oc').length;
  const noMatchCount = state.matches.filter(m => m.status === 'no_match').length;
  const alreadyHasOCCount = state.matches.filter(m => m.status === 'already_has_oc').length;

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2 text-base">
          <Upload className="w-5 h-5" />
          Importar OC desde PDF - {toTitleCase(clientName)}
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
            <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium mb-1">
              Arrastra PDFs de órdenes de compra aquí
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
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
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
            {/* Summary badges */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-violet-600/10 text-violet-600 border-violet-600/20">
                <CheckCircle className="w-3 h-3 mr-1" />
                {matchedCount} coincidencias
              </Badge>
              {sameOCCount > 0 && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                  <CheckCheck className="w-3 h-3 mr-1" />
                  {sameOCCount} ya asignada
                </Badge>
              )}
              {alreadyHasOCCount > 0 && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {alreadyHasOCCount} OC diferente
                </Badge>
              )}
              {noMatchCount > 0 && (
                <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="w-3 h-3 mr-1" />
                  {noMatchCount} sin match
                </Badge>
              )}
              {state.parsedOCs.length > 0 && (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  💰 Total OC: {formatCurrency(state.parsedOCs[0]?.totals.neto || 0, getUserCurrencySync())}
                </Badge>
              )}
            </div>

            {/* Matches table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="text-xs">Patente</TableHead>
                    <TableHead className="text-xs">Servicio</TableHead>
                    <TableHead className="text-xs">OC Actual</TableHead>
                    <TableHead className="text-xs">N° OC Nueva</TableHead>
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
                          disabled={match.status === 'no_match' || match.status === 'same_oc'}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        {match.parsedItem.patente}
                      </TableCell>
                      <TableCell className="text-xs">
                        {match.service ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewService(match.service!); }}
                            className="text-violet-600 underline hover:text-violet-600/80 cursor-pointer font-medium"
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
                        {match.service?.purchaseOrder || match.service?.purchaseOrderNumber ? (
                          <span className="text-foreground">{match.service.purchaseOrder || match.service.purchaseOrderNumber}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{match.ocNumber}</TableCell>
                      <TableCell>
                        {match.status === 'matched' && (
                          <Badge variant="secondary" className="bg-violet-600/10 text-violet-600 text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Match
                          </Badge>
                        )}
                        {match.status === 'same_oc' && (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 text-xs">
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Ya asignada
                          </Badge>
                        )}
                        {match.status === 'already_has_oc' && (
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            OC diferente
                          </Badge>
                        )}
                        {match.status === 'no_match' && (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            Sin match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="w-3 h-3 mr-2" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={selectedMatches.size === 0}
              >
                Aplicar {selectedMatches.size} OC
                <ArrowRight className="w-3 h-3 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step: Applying */}
        {state.step === 'applying' && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
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
            <CheckCircle className="w-10 h-10 text-primary mx-auto" />
            <p className="text-sm text-foreground font-medium">Importación completada</p>
            <Button size="sm" onClick={handleDone}>
              <RotateCcw className="w-3 h-3 mr-2" />
              Importar más
            </Button>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <XCircle className="w-4 h-4" />
            {state.error}
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
