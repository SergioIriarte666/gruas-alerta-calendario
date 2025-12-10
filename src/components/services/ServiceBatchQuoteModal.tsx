import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Service } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ServiceBatchQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServices: Service[];
  onSuccess: () => void;
}

export const ServiceBatchQuoteModal = ({
  open,
  onOpenChange,
  selectedServices,
  onSuccess,
}: ServiceBatchQuoteModalProps) => {
  const [quoteNumber, setQuoteNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientName = selectedServices[0]?.client?.name || 'Cliente';
  const clientId = selectedServices[0]?.client?.id;

  const allSameClient = useMemo(() => {
    if (selectedServices.length === 0) return false;
    return selectedServices.every(s => s.client?.id === clientId);
  }, [selectedServices, clientId]);

  const totalAmount = useMemo(() => {
    return selectedServices.reduce((sum, service) => sum + (service.value || 0), 0);
  }, [selectedServices]);

  const handleSubmit = async () => {
    if (!allSameClient) {
      toast.error('Todos los servicios deben ser del mismo cliente');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create a service closure for the quote
      const today = new Date().toISOString().split('T')[0];
      const { data: closure, error: closureError } = await supabase
        .from('service_closures')
        .insert({
          folio: quoteNumber || `COT-${Date.now()}`,
          status: 'quoted',
          client_id: clientId,
          total: totalAmount,
          purchase_order: null,
          date_from: today,
          date_to: today,
        })
        .select()
        .single();

      if (closureError) throw closureError;

      // Link services to the closure
      const closureServices = selectedServices.map(s => ({
        closure_id: closure.id,
        service_id: s.id,
      }));

      const { error: linkError } = await supabase
        .from('closure_services')
        .insert(closureServices);

      if (linkError) throw linkError;

      // Update services status to 'quoted'
      const serviceIds = selectedServices.map(s => s.id);
      const { error: updateError } = await supabase
        .from('services')
        .update({ status: 'quoted' })
        .in('id', serviceIds);

      if (updateError) throw updateError;

      toast.success(`Cotización ${closure.folio} generada exitosamente`);
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating quote:', error);
      toast.error(`Error al generar cotización: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setQuoteNumber('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Cotización
          </DialogTitle>
          <DialogDescription>
            Crear una cotización agrupando los servicios seleccionados.
          </DialogDescription>
        </DialogHeader>

        {!allSameClient && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Todos los servicios deben pertenecer al mismo cliente para generar una cotización.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary */}
        <Card className="bg-muted/20">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Cliente</span>
                <span className="font-medium">{clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Servicios</span>
                <span className="font-medium">{selectedServices.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-violet-600">
                  ${totalAmount.toLocaleString('es-CL')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services list */}
        <div className="max-h-40 overflow-y-auto space-y-2">
          {selectedServices.map((service) => (
            <div key={service.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
              <Badge variant="outline">{service.folio}</Badge>
              <span className="text-muted-foreground">
                ${(service.value || 0).toLocaleString('es-CL')}
              </span>
            </div>
          ))}
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quote-number">Número de Cotización (opcional)</Label>
            <Input
              id="quote-number"
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              placeholder="COT-001 (se generará automáticamente si se deja vacío)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-notes">Notas</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales para la cotización..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!allSameClient || isSubmitting}>
            {isSubmitting ? 'Generando...' : 'Generar Cotización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
