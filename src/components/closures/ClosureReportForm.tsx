
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import { useToast } from '@/hooks/use-toast';
import { generateServiceReport } from '@/utils/serviceReportGenerator';
import { Loader2 } from 'lucide-react';

interface ClosureReportFormProps {
  onClose: () => void;
}

const ClosureReportForm = ({ onClose }: ClosureReportFormProps) => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [clientId, setClientId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async (format: 'pdf' | 'excel') => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Por favor, selecciona un rango de fechas.",
        variant: "destructive",
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast({
        title: "Error",
        description: "La fecha 'desde' no puede ser posterior a la fecha 'hasta'.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateServiceReport({
        format,
        filters: {
          dateFrom,
          dateTo,
          clientId: clientId || undefined,
        }
      });
      toast({
        title: "Informe generado",
        description: `El informe se ha descargado en formato ${format.toUpperCase()}.`,
      });
      onClose();
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error al generar informe",
        description: "No se pudo generar el informe. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="py-4 space-y-6">
      <DateRangePicker
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
      />
      <ClientSelector
        clientId={clientId}
        onClientChange={setClientId}
      />
      <div className="flex justify-end space-x-2 pt-4 border-t border-gray-700">
        <Button variant="ghost" onClick={onClose} disabled={isGenerating}>Cancelar</Button>
        <Button onClick={() => handleGenerate('excel')} disabled={isGenerating} className="bg-tms-green text-white hover:bg-tms-green/90">
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Excel
        </Button>
        <Button onClick={() => handleGenerate('pdf')} disabled={isGenerating} variant="destructive">
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          PDF
        </Button>
      </div>
    </div>
  );
};

export default ClosureReportForm;
