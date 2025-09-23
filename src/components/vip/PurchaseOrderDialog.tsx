import React from 'react';
import { Service } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  MapPin, 
  Building2,
  User,
  Send
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useState } from 'react';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  onUpdate: () => void;
}

export const PurchaseOrderDialog: React.FC<PurchaseOrderDialogProps> = ({
  open,
  onOpenChange,
  service,
  onUpdate
}) => {
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!service) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseOrderNumber.trim()) {
      toast.error('Ingresa el número de orden de compra');
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        purchase_order_number: purchaseOrderNumber.trim(),
        status: 'pending',
        updated_at: new Date().toISOString()
      };

      // Agregar quote_number solo si se proporcionó
      if (quoteNumber.trim()) {
        updateData.quote_number = quoteNumber.trim();
      }

      const { error } = await supabase
        .from('services')
        .update(updateData)
        .eq('id', service.id);

      if (error) throw error;

      toast.success('Información registrada correctamente');
      onUpdate();
      onOpenChange(false);
      setPurchaseOrderNumber('');
      setQuoteNumber('');
      setNotes('');
    } catch (error: any) {
      console.error('Error updating purchase order:', error);
      toast.error('Error al registrar la información');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Registrar Información del Servicio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Service Summary */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Resumen del Servicio</h3>
              <Badge variant="outline" className="text-blue-300 border-blue-500/30">
                {service.folio}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(service.serviceDate), 'dd/MM/yyyy', { locale: es })}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 className="w-4 h-4" />
                  <span>{service.serviceType.name}</span>
                </div>

                {service.operator && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <User className="w-4 h-4" />
                    <span>{service.operator.name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin className="w-4 h-4" />
                  <div className="truncate">
                    {service.origin}
                    {service.destination !== service.origin && (
                      <> → {service.destination}</>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-green-400">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">{formatCurrency(getDisplayServiceValue(service))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Order Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="purchase-order" className="text-white">
                Número de Orden de Compra *
              </Label>
              <Input
                id="purchase-order"
                value={purchaseOrderNumber}
                onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                placeholder="Ej: OC-2024-001234"
                className="bg-gray-800 border-gray-600 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-number" className="text-white">
                Número de Cotización (Opcional)
              </Label>
              <Input
                id="quote-number"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                placeholder="Ej: COT-24-001"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-white">
                Observaciones (opcional)
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre la orden de compra..."
                className="bg-gray-800 border-gray-600 text-white min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  'Registrando...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Registrar Información
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};