import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
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
  const [photos, setPhotos] = useState<Array<{ path: string; signedUrl: string; file?: File }>>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const extractReceiptData = async (imageUrl: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('parse-receipt-image', {
        body: { imageUrl },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Receipt extraction failed:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let receiptExtraction = null;

      // Si hay fotos y es tipo costo, extraer datos con IA
      if (photos.length > 0 && formData.type === 'cost') {
        setIsExtracting(true);
        try {
          receiptExtraction = await extractReceiptData(photos[0].signedUrl);
        } catch {
          // Continuar sin extracción
        } finally {
          setIsExtracting(false);
        }
      }

      // Pre-llenar campos desde la extracción si el usuario no los completó
      const finalData = { ...formData };
      if (receiptExtraction) {
        if (!finalData.amount && receiptExtraction.totals?.total) {
          finalData.amount = receiptExtraction.totals.total;
        }
        if (!finalData.description && receiptExtraction.notes) {
          finalData.description = receiptExtraction.notes;
        }
        if (receiptExtraction.date && !finalData.date) {
          finalData.date = receiptExtraction.date;
        }
      }

      await createQuickEntry({
        ...finalData,
        photo_url: photos[0]?.signedUrl,
        data: {
          ...(finalData.data || {}),
          photos,
          receipt_extraction: receiptExtraction,
        },
      });
      triggerRefresh();
      onClose();
      setFormData({
        type: 'service',
        description: '',
        amount: undefined,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setPhotos([]);
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
