
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { costSchema, CostFormValues } from '@/schemas/costSchema';
import { CostFormData, SERVICE_SUBCATEGORIES } from '@/types/costs';
import { useAddCost } from '@/hooks/useCosts';
import { toast } from 'sonner';
import { Fuel, Car, Package, Calculator } from 'lucide-react';

// Mapeo explícito de subcategorías para consistencia
const getSubcategoryName = (section: string): string => {
  switch (section) {
    case 'combustible': return 'Combustible';
    case 'peajes': return 'Peajes';
    case 'otros': return 'Otros';
    default: return 'Otros';
  }
};

interface ServiceExpenseModalsProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (totalAmount?: number) => void;
  baseData: {
    date: string;
    category_id: string;
    crane_id?: string;
    operator_id?: string;
    service_id?: string;
    service_folio?: string;
  };
}

interface ServiceSectionData {
  amount: string;
}

export const ServiceExpenseModals = ({ isOpen, onClose, onComplete, baseData }: ServiceExpenseModalsProps) => {
  const { mutate: addCost } = useAddCost();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [sectionData, setSectionData] = useState<{
    combustible: ServiceSectionData;
    peajes: ServiceSectionData;
    otros: ServiceSectionData;
  }>({
    combustible: { amount: '' },
    peajes: { amount: '' },
    otros: { amount: '' }
  });

  const updateSectionData = (section: keyof typeof sectionData, value: string) => {
    setSectionData(prev => ({
      ...prev,
      [section]: { amount: value }
    }));
  };

  // Calcular total en tiempo real
  const calculateTotal = () => {
    return Object.values(sectionData).reduce((total, data) => {
      const amount = parseFloat(data.amount);
      return total + (isNaN(amount) ? 0 : amount);
    }, 0);
  };

  const currentTotal = calculateTotal();

  const getDefaultDescription = (section: string) => {
    const now = new Date();
    const dateString = now.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeString = now.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    const serviceInfo = baseData.service_folio ? ` - ${baseData.service_folio}` : '';
    
    switch (section) {
      case 'combustible': return `Combustible ${dateString} ${timeString}${serviceInfo}`;
      case 'peajes': return `Peajes ${dateString} ${timeString}${serviceInfo}`;
      case 'otros': return `Otros gastos ${dateString} ${timeString}${serviceInfo}`;
      default: return `${section.charAt(0).toUpperCase() + section.slice(1)} ${dateString} ${timeString}${serviceInfo}`;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const validSections = Object.entries(sectionData).filter(([_, data]) => {
      const amount = parseFloat(data.amount);
      return !isNaN(amount) && amount > 0;
    });

    if (validSections.length === 0) {
      toast.error("Error de Validación", { 
        description: "Debe ingresar al menos un monto mayor a 0." 
      });
      setIsSubmitting(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const totalCosts = validSections.length;
    const totalAmount = validSections.reduce((sum, [_, data]) => sum + parseFloat(data.amount), 0);

    const processNextCost = async (index: number) => {
      if (index >= validSections.length) {
        setIsSubmitting(false);
        
        if (successCount === totalCosts) {
          toast.success("Costos Guardados", { 
            description: `Se registraron ${successCount} costos correctamente por un total de $${totalAmount.toLocaleString()}.` 
          });
          
          setSectionData({
            combustible: { amount: '' },
            peajes: { amount: '' },
            otros: { amount: '' }
          });
          
          if (onComplete) {
            onComplete(totalAmount);
          } else {
            onClose();
          }
        } else if (successCount > 0) {
          toast.warning("Guardado Parcial", { 
            description: `Se guardaron ${successCount} de ${totalCosts} costos.` 
          });
          if (onComplete) {
            const partialTotal = validSections.slice(0, successCount).reduce((sum, [_, data]) => sum + parseFloat(data.amount), 0);
            onComplete(partialTotal);
          }
        } else {
          toast.error("Error al Guardar", { 
            description: "No se pudieron guardar los costos." 
          });
          if (onComplete) {
            onComplete(0);
          }
        }
        return;
      }

      const [subcategory, data] = validSections[index];
      const costData: CostFormData = {
        date: baseData.date,
        description: getDefaultDescription(subcategory),
        amount: parseFloat(data.amount),
        category_id: baseData.category_id,
        crane_id: baseData.crane_id === 'none' ? null : baseData.crane_id,
        operator_id: baseData.operator_id === 'none' ? null : baseData.operator_id,
        service_id: baseData.service_id === 'none' ? null : baseData.service_id,
        service_folio: baseData.service_folio || null,
        subcategory: getSubcategoryName(subcategory),
        notes: null,
      };

      addCost(costData, {
        onSuccess: (result) => {
          console.log(`[ServiceExpenseModals] ${subcategory} cost saved successfully:`, result);
          successCount++;
          processNextCost(index + 1);
        },
        onError: (error) => {
          console.error(`[ServiceExpenseModals] Add ${subcategory} cost failed:`, error);
          errorCount++;
          processNextCost(index + 1);
        },
      });
    };

    processNextCost(0);
  };

  const handleCancel = () => {
    setSectionData({
      combustible: { amount: '' },
      peajes: { amount: '' },
      otros: { amount: '' }
    });
    
    if (onComplete) {
      onComplete(0);
    } else {
      onClose();
    }
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'combustible': return <Fuel className="w-5 h-5 text-red-500" />;
      case 'peajes': return <Car className="w-5 h-5 text-orange-500" />;
      case 'otros': return <Package className="w-5 h-5 text-purple-500" />;
      default: return null;
    }
  };

  const getSectionTitle = (section: string) => {
    switch (section) {
      case 'combustible': return 'Combustible';
      case 'peajes': return 'Peajes';
      case 'otros': return 'Otros';
      default: return section;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="bg-tms-dark text-white border-gray-700 max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Desglosar Gastos de Servicios</DialogTitle>
          <p className="text-gray-400">
            Ingrese los montos específicos para cada tipo de gasto
          </p>
        </DialogHeader>
        
        {/* Total Calculator */}
        {currentTotal > 0 && (
          <Card className="bg-green-900/20 border-green-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-400" />
                  <span className="font-medium text-green-200">Total Calculado:</span>
                </div>
                <span className="text-2xl font-bold text-green-400">
                  ${currentTotal.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
          {Object.keys(sectionData).map((section) => (
            <Card key={section} className="bg-gray-800 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {getSectionIcon(section)}
                  {getSectionTitle(section)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-300">Monto</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sectionData[section as keyof typeof sectionData].amount}
                      onChange={(e) => updateSectionData(section as keyof typeof sectionData, e.target.value)}
                      className="bg-white/10 border-gray-600 text-white mt-1 pr-12"
                      placeholder="0.00"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                      CLP
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
          >
            {onComplete ? 'Cancelar Desglose' : 'Cancelar'}
          </Button>
          
          <div className="flex items-center gap-3">
            {currentTotal > 0 && (
              <span className="text-gray-300">
                Total: <span className="font-bold text-white">${currentTotal.toLocaleString()}</span>
              </span>
            )}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || currentTotal <= 0}
              className="bg-tms-green hover:bg-tms-green/80"
            >
              {isSubmitting ? 'Guardando...' : (onComplete ? 'Confirmar y Usar Total' : 'Guardar Gastos')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
