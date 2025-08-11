
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
}

const InvoicesHeader = ({ onCreateInvoice }: InvoicesHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white">Facturas</h1>
        <p className="text-gray-400 mt-1">Gestión de facturación y pagos</p>
      </div>
      <Button
        onClick={onCreateInvoice}
        className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
        style={{
          backgroundColor: '#9cfa24',
          color: '#000000'
        }}
      >
        <Plus className="w-4 h-4 mr-2" />
        Nueva Factura
      </Button>
    </div>
  );
};

export default InvoicesHeader;
