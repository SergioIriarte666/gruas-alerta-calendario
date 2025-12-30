import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, FileDown, Car } from 'lucide-react';
import { useVehicleFullHistory } from '@/hooks/useVehicleFullHistory';
import { VehicleFullHistory } from './VehicleFullHistory';
import { generateVehicleHistoryPDF } from '@/utils/pdf/vehicleHistoryPdfGenerator';
import { toast } from 'sonner';

interface VehicleHistoryLookupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPlate?: string;
}

export const VehicleHistoryLookupModal: React.FC<VehicleHistoryLookupModalProps> = ({
  open,
  onOpenChange,
  initialPlate = ''
}) => {
  const [searchPlate, setSearchPlate] = useState(initialPlate);
  const [activePlate, setActivePlate] = useState(initialPlate);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data, isLoading, error } = useVehicleFullHistory(activePlate);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchPlate.trim().length >= 4) {
      setActivePlate(searchPlate.trim().toUpperCase());
    }
  };

  const handleExportPDF = async () => {
    if (!data || data.services.length === 0) {
      toast.error('No hay datos para exportar');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const blob = await generateVehicleHistoryPDF(data);
      
      // Descargar automáticamente
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Historial-Vehiculo-${data.licensePlate.toUpperCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF generado exitosamente');
    } catch (err) {
      console.error('Error generando PDF:', err);
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Actualizar cuando cambia initialPlate
  React.useEffect(() => {
    if (initialPlate) {
      setSearchPlate(initialPlate);
      setActivePlate(initialPlate);
    }
  }, [initialPlate]);

  // Limpiar al cerrar
  React.useEffect(() => {
    if (!open) {
      setSearchPlate('');
      setActivePlate('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Historial Completo del Vehículo
          </DialogTitle>
          <DialogDescription>
            Consulta todos los servicios, cotizaciones, órdenes de compra y facturas asociadas a una patente
          </DialogDescription>
        </DialogHeader>

        {/* Barra de búsqueda */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Ingresa patente (ej: ABCD-12 o ABCD12)"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
              className="pl-10 font-mono"
              maxLength={8}
            />
          </div>
          <Button type="submit" disabled={isLoading || searchPlate.trim().length < 4}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Buscar'
            )}
          </Button>
          {data && data.services.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="gap-2"
            >
              {isGeneratingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              Exportar PDF
            </Button>
          )}
        </form>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          {!activePlate ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Car className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Ingresa una patente para consultar el historial completo del vehículo
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                La búsqueda es flexible con guiones (ABC-123 = ABC123)
              </p>
            </div>
          ) : (
            <VehicleFullHistory 
              data={data} 
              isLoading={isLoading} 
              error={error as Error | null} 
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
