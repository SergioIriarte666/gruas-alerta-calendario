import { useState } from 'react';
import { Button } from '@/components/ui/button';
import DateRangePicker from './DateRangePicker';
import ClientSelector from './ClientSelector';
import { toast } from "sonner";
import { generateServiceReport } from '@/utils/serviceReportGenerator';
import { parseFromDatabase, formatForDatabase } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageCircle } from 'lucide-react';
import { ServiceClosure } from '@/types';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ClosureReportForm");
interface ClosureReportFormProps {
  closures: ServiceClosure[];
  onClose: () => void;
}

const ClosureReportForm = ({ closures, onClose }: ClosureReportFormProps) => {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [clientId, setClientId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const handleGenerate = async (format: 'pdf' | 'excel') => {
    if (!dateFrom || !dateTo) {
      toast.error("Error", {
        description: "Por favor, selecciona un rango de fechas.",
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("Error", {
        description: "La fecha 'desde' no puede ser posterior a la fecha 'hasta'.",
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateServiceReport({
        format,
        filters: {
          dateFrom: formatForDatabase(dateFrom),
          dateTo: formatForDatabase(dateTo),
          clientId: clientId || undefined,
        }
      });
      toast.success("Informe generado", {
        description: `El informe se ha descargado en formato ${format.toUpperCase()}.`,
      });
      onClose();
    } catch (error) {
      logger.error('Error generating report:', error);
      toast.error("Error al generar informe", {
        description: "No se pudo generar el informe. Inténtalo de nuevo.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMonthlySummary = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Error", {
        description: "Por favor, selecciona un rango de fechas.",
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("Error", {
        description: "La fecha 'desde' no puede ser posterior a la fecha 'hasta'.",
      });
      return;
    }

    const relevantClosures = closures.filter((c) => {
      const from = parseFromDatabase(c.dateRange.from);
      const to = parseFromDatabase(c.dateRange.to);
      const matchesClient = !clientId || c.clientId === clientId;
      return matchesClient && from >= dateFrom && to <= dateTo;
    });

    const baseDate = dateFrom ?? new Date();
    const rawMonth = baseDate.toLocaleString('es-CL', { month: 'long' });
    const mes = rawMonth ? `${rawMonth.charAt(0).toUpperCase()}${rawMonth.slice(1)}` : '';
    const anio = baseDate.getFullYear().toString();
    const totalServicios = relevantClosures.length;
    const totalIngresos = relevantClosures
      .reduce((sum, c) => sum + (c.total || 0), 0)
      .toLocaleString('es-CL');

    setIsSendingWhatsApp(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-admin', {
        body: {
          event: 'cierre_mensual',
          data: {
            mes,
            anio,
            totalServicios,
            totalIngresos: totalIngresos || '0',
          },
        },
      });

      if (error) {
        logger.warn('WhatsApp admin no enviado:', error);
        toast.error('No se pudo enviar el resumen');
        return;
      }

      toast.success('Resumen enviado a administradores por WhatsApp');
    } catch (error) {
      logger.warn('WhatsApp admin no enviado:', error);
      toast.error('No se pudo enviar el resumen');
    } finally {
      setIsSendingWhatsApp(false);
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
      <div className="flex justify-end gap-x-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={handleSendMonthlySummary}
          disabled={isGenerating || isSendingWhatsApp}
        >
          {isSendingWhatsApp && <Loader2 className="mr-2 size-4 animate-spin" />}
          <MessageCircle className="mr-2 size-4" />
          Enviar resumen por WhatsApp
        </Button>
        <Button variant="outline" onClick={onClose} disabled={isGenerating || isSendingWhatsApp}>Cancelar</Button>
        <Button onClick={() => handleGenerate('excel')} disabled={isGenerating || isSendingWhatsApp} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isGenerating && <Loader2 className="mr-2 size-4 animate-spin" />}
          Excel
        </Button>
        <Button onClick={() => handleGenerate('pdf')} disabled={isGenerating || isSendingWhatsApp} variant="destructive">
          {isGenerating && <Loader2 className="mr-2 size-4 animate-spin" />}
          PDF
        </Button>
      </div>
    </div>
  );
};

export default ClosureReportForm;
