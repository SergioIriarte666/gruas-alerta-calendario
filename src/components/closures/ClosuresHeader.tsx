import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

interface ClosuresHeaderProps {
  onCreateClosure: () => void;
  onOpenReport?: () => void;
}

const ClosuresHeader = ({ onCreateClosure, onOpenReport }: ClosuresHeaderProps) => {
  return (
    <PageHeader
      title="Cierres de Servicios"
      description="Gestiona cierres por periodo, revisión operativa y preparación de facturación."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {onOpenReport && (
            <Button
              variant="outline"
              onClick={onOpenReport}
              className="border-border/70 bg-card/70"
            >
              <FileText className="mr-2 size-4" />
              Informe
            </Button>
          )}
          <Button
            onClick={onCreateClosure}
            title="Crear un nuevo cierre de servicios"
          >
            <Plus className="mr-2 size-4" />
            Nuevo Cierre
          </Button>
        </div>
      }
    />
  );
};

export default ClosuresHeader;
