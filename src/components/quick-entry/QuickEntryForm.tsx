import React, { useState } from 'react';
import { X, Loader2, Truck, Receipt, Package, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Textarea } from '@/components/ui/textarea';
import { useQuickEntry, QuickEntry } from '@/hooks/useQuickEntry';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useQuickEntryContext } from '@/contexts/QuickEntryContext';
import { useFrequentQuickEntryDescriptions } from '@/hooks/useFrequentFormData';
import { QuickPhotoCapture } from './QuickPhotoCapture';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

import { getTodayLocal } from '@/utils/timezoneUtils';
import { createLogger } from "@/lib/logger";


const logger = createLogger("QuickEntryForm");
interface QuickEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENTRY_TYPES = [
  { value: 'service', label: 'Servicio', Icon: Truck, color: '#378ADD' },
  { value: 'cost', label: 'Costo/Gasto', Icon: Receipt, color: '#E24B4A' },
  { value: 'inventory', label: 'Bodega', Icon: Package, color: '#639922' },
  { value: 'maintenance', label: 'Mantenimiento', Icon: Wrench, color: '#BA7517' },
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
    date: getTodayLocal(),
    notes: '',
  });
  const [photos, setPhotos] = useState<Array<{ path: string; signedUrl: string; file?: File }>>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const extractReceiptData = async (imageUrl: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('parse-receipt-image', {
        body: { imageUrl },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      logger.error('Receipt extraction failed:', err);
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
      // La columna date es NOT NULL: si se limpió el selector, usar hoy en vez de enviar "".
      if (!finalData.date) {
        finalData.date = getTodayLocal();
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
      handleClose();
    } catch (error) {
      // Error handled in hook
    }
  };


  const handleClose = () => {
    onClose();
    setStep(1);
    setFormData({
      type: 'service',
      description: '',
      amount: undefined,
      date: getTodayLocal(),
      notes: '',
    });
    setPhotos([]);
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
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Registro Rápido · Paso {step} de 2</h2>
            <div className="w-full h-1 bg-muted rounded-full mt-2">
              <div
                className="h-1 bg-primary rounded-full transition-all duration-300"
                style={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="ml-2 shrink-0">
            <X className="size-4" />
          </Button>
        </div>

        {/* Step 1 — Type selection */}
        {step === 1 && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">Selecciona el tipo de registro</p>
            <div className="grid grid-cols-2 gap-3">
              {ENTRY_TYPES.map(({ value, label, Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: value }))}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-all',
                    formData.type === value
                      ? 'ring-2 ring-primary bg-primary/10'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <Icon size={24} style={{ color }} />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={() => setStep(2)}>
                Siguiente →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — Fields */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <div className="relative">
                <Input
                  id="description"
                  list="quick-entry-suggestions"
                  placeholder="Describe brevemente..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
                <datalist id="quick-entry-suggestions">
                  {quickEntrySuggestions.map(s => (
                    <option key={s.value} value={s.value} />
                  ))}
                </datalist>
              </div>
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
                    amount: e.target.value ? parseFloat(e.target.value) : undefined,
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

            {/* Navigation buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                ← Atrás
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isExtracting || !formData.description}
                className="flex-1"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Extrayendo datos...
                  </>
                ) : isLoading ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
