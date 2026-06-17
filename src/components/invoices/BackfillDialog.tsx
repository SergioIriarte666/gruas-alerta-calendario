import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import type { BackfillPreview, BackfillResults } from '@/hooks/invoices/usePaymentReconciliation';

interface BackfillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historicalMonth: string;
  onHistoricalMonthChange: (month: string) => void;
  showAllBackfillClients: boolean;
  onShowAllBackfillClientsChange: (checked: boolean) => void;
  selectedBackfillClientIds: string[];
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
  onToggleClient: (clientId: string, checked: boolean) => void;
  backfillIsRunning: boolean;
  backfillPreview: BackfillPreview | null;
  backfillResults: BackfillResults | null;
  onBuildPreview: () => void;
  onRunBackfill: () => void;
}

export const BackfillDialog: React.FC<BackfillDialogProps> = ({
  open, onOpenChange, historicalMonth, onHistoricalMonthChange,
  showAllBackfillClients, onShowAllBackfillClientsChange,
  selectedBackfillClientIds, onSelectAll, onDeselectAll, onToggleClient,
  backfillIsRunning, backfillPreview, backfillResults,
  onBuildPreview, onRunBackfill,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
      <DialogHeader className="shrink-0">
        <DialogTitle>Backfill histórico (cierre → factura → conciliación)</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Mes</Label>
            <Input type="month" value={historicalMonth} onChange={e => onHistoricalMonthChange(e.target.value)} disabled={backfillIsRunning} />
          </div>
          <div className="space-y-2">
            <Label>Regla</Label>
            <Input value="1 factura por cliente" disabled />
          </div>
        </div>

        {backfillPreview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previsualización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={showAllBackfillClients}
                    onCheckedChange={checked => onShowAllBackfillClientsChange(Boolean(checked))}
                    disabled={backfillIsRunning}
                  />
                  <span>Mostrar todos los clientes</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Seleccionados: {selectedBackfillClientIds.length}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Clientes: {backfillPreview.clientCount} · Servicios: {backfillPreview.serviceCount} · Neto: {formatCurrency(backfillPreview.totalNet)}
              </div>
              <div className="max-h-48 overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]">
                        <Checkbox
                          checked={
                            backfillPreview.clientTotals.length > 0 &&
                            backfillPreview.clientTotals.every(row => selectedBackfillClientIds.includes(row.clientId))
                          }
                          onCheckedChange={checked => {
                            if (checked === true) onSelectAll(backfillPreview.clientTotals.map(r => r.clientId));
                            else onDeselectAll();
                          }}
                          disabled={backfillIsRunning}
                        />
                      </TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="text-right">Servicios</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backfillPreview.clientTotals.map(row => (
                      <TableRow key={row.clientId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedBackfillClientIds.includes(row.clientId)}
                            onCheckedChange={checked => onToggleClient(row.clientId, checked === true)}
                            disabled={backfillIsRunning}
                          />
                        </TableCell>
                        <TableCell>{row.clientName}</TableCell>
                        <TableCell className="text-right">{row.serviceCount}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.net)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {backfillResults && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                Procesados: {backfillResults.processedClients} · Conciliadas: {backfillResults.reconciledInvoices} · Omitidos: {backfillResults.skippedClients}
              </div>
              <div>
                Cierres: {backfillResults.createdClosures} · Facturas: {backfillResults.createdInvoices} · Pagos: {backfillResults.createdPayments}
              </div>
              {backfillResults.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-destructive">Errores ({backfillResults.errors.length})</div>
                  <div className="max-h-40 overflow-auto border rounded p-2 space-y-1">
                    {backfillResults.errors.map((err, idx) => (
                      <div key={`${err.clientId}-${idx}`}>
                        {err.clientName}: {err.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onBuildPreview} disabled={backfillIsRunning || !historicalMonth}>
          Previsualizar
        </Button>
        <Button type="button" onClick={onRunBackfill} disabled={backfillIsRunning || !historicalMonth}>
          Ejecutar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
