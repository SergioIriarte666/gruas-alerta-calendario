
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClosuresHeaderProps {
  onCreateClosure: () => void;
}

const ClosuresHeader = ({ onCreateClosure }: ClosuresHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Cierres de Servicios</h1>
        <p className="text-muted-foreground mt-1">Gestión de cierres por períodos</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onCreateClosure}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Crear un nuevo cierre de servicios"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cierre
        </Button>
      </div>
    </div>
  );
};

export default ClosuresHeader;
