import { Landmark, Plus } from 'lucide-react';
import { IssuedInvoiceBatchImport } from './IssuedInvoiceBatchImport';
import { Button } from '@/components/ui/button';

interface ClosuresHeaderProps {
  onCreateClosure: () => void;
}

const ClosuresHeader = ({ onCreateClosure }: ClosuresHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <span className="dashboard-section-kicker"><Landmark className="size-3.5" />Consolidación financiera</span>
        <h1 className="dashboard-section-title">Cierres de Servicios</h1>
        <p className="dashboard-section-description">Revisión de periodos y preparación de la facturación.</p>
      </div>
        <div className="flex flex-wrap items-center gap-2">
          <IssuedInvoiceBatchImport />
          <Button
            onClick={onCreateClosure}
            title="Crear un nuevo cierre de servicios"
            className="dashboard-report-button"
          >
            <Plus className="mr-2 size-4" />
            Nuevo Cierre
          </Button>
        </div>
    </div>
  );
};

export default ClosuresHeader;
