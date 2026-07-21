import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DisputeReportRow } from '@/hooks/reports/useDisputesReport';
import { DISPUTE_TYPE_LABELS } from '@/utils/serviceDisputeUtils';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

interface DisputeDetailModalProps {
  dispute: DisputeReportRow | null;
  onOpenChange: (open: boolean) => void;
}

export const DisputeDetailModal = ({ dispute, onOpenChange }: DisputeDetailModalProps) => {
  return (
    <Dialog open={!!dispute} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {dispute?.serviceFolio} — {dispute ? DISPUTE_TYPE_LABELS[dispute.disputeType] : ''}
          </DialogTitle>
        </DialogHeader>

        {dispute && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant={dispute.status === 'open' ? 'destructive' : 'secondary'}>
                {dispute.status === 'open' ? 'Abierta' : 'Resuelta'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium text-foreground">{dispute.clientName}</span>
            </div>
            {dispute.referenceDoc && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Referencia</span>
                <span className="font-medium text-foreground">{dispute.referenceDoc}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monto en disputa</span>
              <span className="font-medium text-foreground">
                ${(dispute.disputedAmount ?? dispute.serviceValue).toLocaleString('es-CL')}
              </span>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Descripción</p>
              <p className="text-foreground whitespace-pre-wrap">{dispute.description}</p>
            </div>

            <div className="text-xs text-muted-foreground">
              Marcada el {formatForDisplayWithTime(dispute.createdAt)}
              {dispute.createdByName && ` por ${dispute.createdByName}`}
            </div>

            {dispute.status === 'resolved' && (
              <>
                <div className="text-xs text-muted-foreground">
                  Resuelta el {dispute.resolvedAt ? formatForDisplayWithTime(dispute.resolvedAt) : ''}
                  {dispute.resolvedByName && ` por ${dispute.resolvedByName}`}
                </div>
                {dispute.resolutionNotes && (
                  <div className="rounded-lg border border-success/30 bg-success-soft p-3">
                    <p className="text-xs text-muted-foreground mb-1">Notas de resolución</p>
                    <p className="text-foreground whitespace-pre-wrap">{dispute.resolutionNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
