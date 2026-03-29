import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuickEntry, QuickEntry } from '@/hooks/useQuickEntry';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useQuickEntryContext } from '@/contexts/QuickEntryContext';
import { AutocompleteInput } from '@/components/common/AutocompleteInput';
import { useFrequentQuickEntryDescriptions } from '@/hooks/useFrequentFormData';
import { QuickPhotoCapture } from './QuickPhotoCapture';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuickEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENTRY_TYPES = [
  { value: 'service', label: 'Servicio' },
  { value: 'cost', label: 'Costo/Gasto' },
  { value: 'inventory', label: 'Bodega' },
  { value: 'maintenance', label: 'Mantenimiento' },
] as const;

export function QuickEntryForm({ isOpen, onClose }: QuickEntryFormProps) {
  const { createQuickEntry, isLoading } = useQuickEntry();
  const { isMobile } = useDeviceType();
  const { triggerRefresh } = useQuickEntryContext();
  const quickEntrySuggestions = useFrequentQuickEntryDescriptions();
  
  const [formData, setFormData] = useState<Omit<QuickEntry, 'id'>>({
    type: 'service',
    description: '',
    amount: undefined,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [photos, setPhotos] = useState<Array<{ path: string; signedUrl: string }>>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [lastExtractedPath, setLastExtractedPath] = useState<string | null>(null);
  const [receiptExtraction, setReceiptExtraction] = useState<any | null>(null);

  useEffect(() => {
    const first = photos[0];
    if (formData.type !== 'cost') return;
    if (!first?.signedUrl || !first?.path) {
      setLastExtractedPath(null);
      setReceiptExtraction(null);
      return;
    }
    if (first.path === lastExtractedPath) return;

    const run = async () => {
      setIsExtracting(true);
      try {
        const { data, error } = await supabase.functions.invoke('parse-receipt-image', {
          body: { imageUrl: first.signedUrl },
        });
        if (error) {
          const status = (error as any)?.context?.status;
          const body = (error as any)?.context?.body;
          const details =
            typeof body === 'string' ? body : body ? JSON.stringify(body) : '';
          const base = (error as any)?.message || 'Error desconocido';
          const message = status ? `${base} (HTTP ${status})` : base;
          throw new Error(details ? `${message}: ${details}` : message);
        }

        setReceiptExtraction(data || null);
        setLastExtractedPath(first.path);

        const extractedDate = data?.date || undefined;
        const extractedTotal = typeof data?.totals?.total === 'number' ? data.totals.total : undefined;
        const vendorName = (data?.vendorName || '').trim();
        const docType = (data?.documentType || '').trim();
        const docNumber = (data?.documentNumber || '').trim();

        const suggestedDescriptionParts = [vendorName, docType && docNumber ? `${docType} ${docNumber}` : ''].filter(Boolean);
        const suggestedDescription = suggestedDescriptionParts.join(' · ');
        const suggestedNotes = (data?.notes || '').trim();

        setFormData(prev => ({
          ...prev,
          date: extractedDate || prev.date,
          amount: extractedTotal ?? prev.amount,
          description: suggestedDescription || prev.description,
          notes: suggestedNotes || prev.notes,
          data: {
            ...(prev.data || {}),
            receipt_extraction: data || null,
          },
        }));
        toast.success('Comprobante analizado');
      } catch (error) {
        console.error('Error extracting receipt data:', error);
        const message = (error as any)?.message || 'Error desconocido';
        toast.error('No se pudo leer el comprobante', { description: message });
      } finally {
        setIsExtracting(false);
      }
    };

    run();
  }, [formData.type, lastExtractedPath, photos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createQuickEntry({
        ...formData,
        photo_url: photos[0]?.signedUrl,
        data: {
          ...(formData.data || {}),
          photos,
          receipt_extraction: receiptExtraction,
        },
      });
      triggerRefresh(); // Trigger refresh for PendingEntriesView
      onClose();
      setFormData({
        type: 'service',
        description: '',
        amount: undefined,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setPhotos([]);
      setIsExtracting(false);
      setLastExtractedPath(null);
      setReceiptExtraction(null);
    } catch (error) {
      // Error handled in hook
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
      <div className={`
        bg-background rounded-t-lg md:rounded-lg shadow-lg w-full max-w-md
        ${isMobile ? 'max-h-[90vh]' : 'max-h-[80vh]'}
        overflow-y-auto
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-background">
          <h2 className="text-lg font-semibold">Registro Rápido</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Registro</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {ENTRY_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <AutocompleteInput
              id="description"
              value={formData.description}
              onValueChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
              suggestions={quickEntrySuggestions}
              placeholder="Describe brevemente..."
            />
          </div>

          {/* Amount (conditional) */}
          {(formData.type === 'service' || formData.type === 'cost') && (
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  amount: e.target.value ? parseFloat(e.target.value) : undefined 
                }))}
                placeholder="0"
              />
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha</Label>
            <DatePickerInput
              id="date"
              value={formData.date}
              onChange={(value) => setFormData(prev => ({ ...prev, date: value }))}
              placeholder="Seleccionar fecha"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas Adicionales</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas opcionales..."
              rows={3}
            />
          </div>

          {/* Photo capture for cost entries */}
          {formData.type === 'cost' && (
            <div className="space-y-2">
              <Label>Evidencia (Fotos)</Label>
              <QuickPhotoCapture onPhotosChange={setPhotos} maxPhotos={3} />
              {isExtracting && (
                <div className="text-xs text-muted-foreground">
                  Analizando comprobante...
                </div>
              )}
            </div>
          )}


          {/* Submit Button */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.description}
              className="flex-1"
            >
              {isLoading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
