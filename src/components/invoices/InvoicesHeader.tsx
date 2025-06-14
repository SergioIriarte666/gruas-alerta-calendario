
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
}

const InvoicesHeader = ({ onCreateInvoice }: InvoicesHeaderProps) => {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-white">Facturas</h1>
        <p className="text-gray-300 mt-2">Gestiona las facturas de servicios</p>
      </div>
      <Button 
        onClick={onCreateInvoice} 
        className="bg-tms-green hover:bg-tms-green/90"
        title="Crear una nueva factura"
      >
        <Plus className="w-4 h-4 mr-2" />
        Nueva Factura
      </Button>
    </div>
  );
};

export default InvoicesHeader;
