import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Plus } from 'lucide-react';

interface OperatorsHeaderProps {
  onNewOperator: () => void;
}

export const OperatorsHeader = ({ onNewOperator }: OperatorsHeaderProps) => {
  return (
    <PageHeader
      title="Operadores"
      description="Gestiona dotación operativa, licencias y personal administrativo desde una vista única."
      actions={
        <Button onClick={onNewOperator}>
          <Plus className="mr-2 size-4" />
          Nuevo Operador
        </Button>
      }
    />
  );
};
