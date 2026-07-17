import { Button } from '@/components/ui/button';
import { Plus, UsersRound } from 'lucide-react';

interface OperatorsHeaderProps {
  onNewOperator: () => void;
}

export const OperatorsHeader = ({ onNewOperator }: OperatorsHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="dashboard-section-kicker"><UsersRound className="size-3.5" />Dotación</span>
        <h1 className="dashboard-section-title">Operadores</h1>
        <p className="dashboard-section-description">Personal operativo, licencias y soporte administrativo.</p>
      </div>
      <Button onClick={onNewOperator} size="sm" className="dashboard-report-button">
        <Plus className="mr-2 size-4" />
        Nuevo operador
      </Button>
    </div>
  );
};
