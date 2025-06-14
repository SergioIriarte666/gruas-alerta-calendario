
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClosuresHeaderProps {
  onCreateClosure: () => void;
}

const ClosuresHeader = ({ onCreateClosure }: ClosuresHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">Cierres de Servicios</h1>
        <p className="text-gray-400 mt-1">Gestión de cierres por períodos</p>
      </div>
      <Button
        onClick={onCreateClosure}
        className="bg-tms-green hover:bg-tms-green/90 text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        Nuevo Cierre
      </Button>
    </div>
  );
};

export default ClosuresHeader;
