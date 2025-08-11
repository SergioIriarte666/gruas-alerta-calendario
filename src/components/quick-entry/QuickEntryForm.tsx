import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuickEntry, QuickEntry } from '@/hooks/useQuickEntry';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useQuickEntryContext } from '@/contexts/QuickEntryContext';

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
  
  const [formData, setFormData] = useState<Omit<QuickEntry, 'id'>>({
    type: 'service',
    description: '',
    amount: undefined,
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createQuickEntry(formData);
      triggerRefresh(); // Trigger refresh for PendingEntriesView
      onClose();
      setFormData({
        type: 'service',
        description: '',
        amount: undefined,
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
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
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe brevemente..."
              required
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
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              required
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