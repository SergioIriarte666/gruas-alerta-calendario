import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Plus } from 'lucide-react';

interface CranesHeaderProps {
  onNewCrane: () => void;
}

export const CranesHeader = ({ onNewCrane }: CranesHeaderProps) => {
  return (
    <PageHeader
      title="Grúas"
      description="Administra flota, vigencias documentales y datos operativos del parque."
      actions={
        <Button onClick={onNewCrane}>
          <Plus className="mr-2 size-4" />
          Nueva Grúa
        </Button>
      }
    />
  );
};
