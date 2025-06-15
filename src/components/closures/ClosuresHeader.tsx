
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClosuresHeaderProps {
  onCreateClosure: () => void;
  onGenerateReport: () => void;
}

const ClosuresHeader = ({ onCreateClosure, onGenerateReport }: ClosuresHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">Cierres de Servicios</h1>
        <p className="text-gray-400 mt-1">Gestión de cierres por períodos</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onGenerateReport}
          variant="outline"
          className="border-gray-600 text-white hover:bg-gray-800 hover:text-white"
          title="Generar informe de servicios"
        >
          <FileText className="w-4 h-4 mr-2" />
          Generar Informe
        </Button>
        <Button
          onClick={onCreateClosure}
          className="bg-tms-green hover:bg-tms-green/90 text-white"
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
