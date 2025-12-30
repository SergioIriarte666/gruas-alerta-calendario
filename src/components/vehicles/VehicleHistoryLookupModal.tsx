import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Eye, EyeOff, X, Car } from 'lucide-react';
import { useVehicleFullHistory } from '@/hooks/useVehicleFullHistory';
import { VehicleFullHistory } from './VehicleFullHistory';
import { downloadVehicleHistoryPDF } from '@/utils/pdf/vehicleHistoryPdfGenerator';
import { toast } from 'sonner';

interface VehicleHistoryLookupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLicensePlate?: string;
}

export const VehicleHistoryLookupModal: React.FC<VehicleHistoryLookupModalProps> = ({
  open,
  onOpenChange,
  initialLicensePlate = ''
}) => {
  const [licensePlate, setLicensePlate] = useState(initialLicensePlate);
  const [searchedPlate, setSearchedPlate] = useState('');
  const [showSensitiveData, setShowSensitiveData] = useState(() => {
    const stored = localStorage.getItem('vehicle-history-show-sensitive-data');
    return stored !== 'false';
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { history, summary, isLoading, error, refetch } = useVehicleFullHistory(searchedPlate);

  const handleSearch = useCallback(() => {
    const normalized = licensePlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (normalized.length < 4) {
      toast.error('Ingrese al menos 4 caracteres de la patente');
      return;
    }
    setSearchedPlate(normalized);
  }, [licensePlate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setLicensePlate('');
    setSearchedPlate('');
  };

  const handleToggleSensitiveData = () => {
    setShowSensitiveData(prev => {
      const newValue = !prev;
      localStorage.setItem('vehicle-history-show-sensitive-data', String(newValue));
      return newValue;
    });
  };

  const handleGeneratePDF = async () => {
    if (!summary || history.length === 0) {
      toast.error('No hay datos para generar el informe');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      await downloadVehicleHistoryPDF({ history, summary });
      toast.success('Informe PDF generado exitosamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el informe PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Car className="h-5 w-5 text-violet-600" />
            Historial Completo de Vehículo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Barra de búsqueda */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Input
                placeholder="Ingrese la patente del vehículo (ej: ABCD12)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="pr-10 font-mono uppercase text-lg tracking-wider"
              />
              {licensePlate && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button 
              onClick={handleSearch}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              disabled={licensePlate.length < 4 || isLoading}
            >
              <Search className="h-4 w-4 mr-2" />
              Buscar Historial
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleSensitiveData}
              className="shrink-0"
              title={showSensitiveData ? 'Ocultar valores' : 'Mostrar valores'}
            >
              {showSensitiveData ? (
                <Eye className="h-4 w-4 text-violet-600" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>

          {/* Contenido */}
          {searchedPlate && (
            <VehicleFullHistory
              history={history}
              summary={summary}
              isLoading={isLoading}
              error={error}
              showSensitiveData={showSensitiveData}
              onGeneratePDF={handleGeneratePDF}
              isGeneratingPDF={isGeneratingPDF}
            />
          )}

          {/* Estado inicial */}
          {!searchedPlate && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-16 w-16 mx-auto mb-4 text-violet-200" />
              <p className="text-lg font-medium">Buscar historial de vehículo</p>
              <p className="text-sm mt-1">
                Ingrese una patente para ver todos los servicios, cotizaciones, órdenes de compra y facturas asociadas.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
