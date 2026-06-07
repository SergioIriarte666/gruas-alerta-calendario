import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crane } from '@/types';
import { CraneTabsWithCounters } from './CraneTabsWithCounters';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';

interface CraneDetailsModalProps {
  crane: Crane | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (crane: Crane) => void;
}

export const CraneDetailsModal = ({ 
  crane, 
  isOpen, 
  onClose, 
  onEdit 
}: CraneDetailsModalProps) => {
  if (!crane) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="cranes-modal cranes-modal--details max-h-[90vh] max-w-7xl overflow-hidden flex flex-col border-border/70 bg-card p-0">
        <DialogHeader className="cranes-modal__header border-b border-border/70 p-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-bold text-foreground">
                Grúa {crane.licensePlate}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                {crane.brand} {crane.model} • {crane.type}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => onEdit(crane)} variant="outline" className="border-border/70 bg-background/60">
                Editar Grúa
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <CraneTabsWithCounters crane={crane} />
        </div>

        {/* Footer con información de creación */}
        <div className="cranes-modal__meta flex justify-between border-t border-border/70 px-6 py-4 text-sm text-muted-foreground">
          <span>
            Creado: {formatForDisplayWithTime(crane.createdAt)}
            {crane.creatorName && ` por ${crane.creatorName}`}
          </span>
          <span>Actualizado: {formatForDisplayWithTime(crane.updatedAt)}</span>
        </div>

        <div className="cranes-modal__actions flex justify-end px-6 pb-4">
          <Button onClick={onClose} variant="outline" className="border-border/70 bg-background/60">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
