import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crane } from '@/types';
import { CraneTabsWithCounters } from './CraneTabsWithCounters';

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
      <DialogContent className="bg-card border max-w-7xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-4 border-b">
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
              <Button onClick={() => onEdit(crane)} variant="outline">
                Editar Grúa
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 pb-6 cranes-scope">
          <CraneTabsWithCounters crane={crane} />
        </div>

        <div className="flex justify-end px-6 py-4 border-t">
          <Button onClick={onClose} variant="outline">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};