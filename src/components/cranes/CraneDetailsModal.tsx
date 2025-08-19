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
      <DialogContent className="bg-black border-tms-green/30 max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 p-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-white">
                Grúa {crane.licensePlate}
              </DialogTitle>
              <DialogDescription className="text-gray-300 mt-1">
                {crane.brand} {crane.model} • {crane.type}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onEdit(crane)}
                variant="outline"
                className="border-tms-green/50 text-tms-green hover:bg-tms-green/10"
              >
                Editar Grúa
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <CraneTabsWithCounters crane={crane} />
        </div>
      </DialogContent>
    </Dialog>
  );
};