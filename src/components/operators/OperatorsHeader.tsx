
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface OperatorsHeaderProps {
  onNewOperator: () => void;
}

export const OperatorsHeader = ({ onNewOperator }: OperatorsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Operadores</h1>
        <p className="text-muted-foreground mt-1">Gestión de operadores de grúas</p>
      </div>
      <Button
        onClick={onNewOperator}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
      >
        <Plus className="w-4 h-4 mr-2" />
        Nuevo Operador
      </Button>
    </div>
  );
};
