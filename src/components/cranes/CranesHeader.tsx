
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CranesHeaderProps {
  onNewCrane: () => void;
}

export const CranesHeader = ({ onNewCrane }: CranesHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Grúas</h1>
        <p className="text-muted-foreground mt-1">Gestión del parque de grúas</p>
      </div>
      <Button
        onClick={onNewCrane}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
      >
        <Plus className="w-4 h-4 mr-2" />
        Nueva Grúa
      </Button>
    </div>
  );
};
