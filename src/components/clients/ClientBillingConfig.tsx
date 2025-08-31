import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClientBillingConfig } from '@/types/deferredBilling';
import { Calendar, Clock, Settings, DollarSign } from 'lucide-react';

interface ClientBillingConfigProps {
  config: ClientBillingConfig;
  onChange: (config: ClientBillingConfig) => void;
  onSave: () => void;
  loading?: boolean;
}

export const ClientBillingConfigComponent: React.FC<ClientBillingConfigProps> = ({
  config,
  onChange,
  onSave,
  loading = false,
}) => {
  const [previewDate, setPreviewDate] = useState<string>('');

  const calculateExampleBillingDate = () => {
    const today = new Date();
    const serviceDate = new Date(today);
    serviceDate.setDate(serviceDate.getDate() - 5); // Ejemplo: servicio hace 5 días
    
    if (config.billingCycleType === 'immediate') {
      return serviceDate.toISOString().split('T')[0];
    }
    
    const billingDate = new Date(serviceDate);
    billingDate.setDate(billingDate.getDate() + config.billingDelayDays);
    
    if (config.billingCycleDay && config.billingCycleDay > 0) {
      billingDate.setDate(config.billingCycleDay);
    }
    
    return billingDate.toISOString().split('T')[0];
  };

  const updateConfig = (updates: Partial<ClientBillingConfig>) => {
    onChange({ ...config, ...updates });
  };

  React.useEffect(() => {
    setPreviewDate(calculateExampleBillingDate());
  }, [config]);

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Configuración de Facturación
        </CardTitle>
        <CardDescription className="text-white/70">
          Configura el período y tipo de facturación para este cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tipo de Facturación */}
        <div className="space-y-3">
          <Label className="text-white">Tipo de Facturación</Label>
          <Select 
            value={config.billingCycleType} 
            onValueChange={(value: 'immediate' | 'deferred') => updateConfig({ billingCycleType: value })}
          >
            <SelectTrigger className="glass-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Inmediata - Facturar al completar servicios
                </div>
              </SelectItem>
              <SelectItem value="deferred">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Diferida - Facturar después de un período
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Configuración de Facturación Diferida */}
        {config.billingCycleType === 'deferred' && (
          <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-white/5">
            <h4 className="text-white font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Configuración de Período Diferido
            </h4>
            
            {/* Días de Diferimiento */}
            <div className="space-y-2">
              <Label className="text-white">Días de Diferimiento</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={config.billingDelayDays}
                onChange={(e) => updateConfig({ billingDelayDays: parseInt(e.target.value) || 0 })}
                className="glass-input"
                placeholder="Ej: 30 para facturar al mes siguiente"
              />
              <div className="text-xs text-white/60">
                Los servicios se facturarán después de este número de días desde la fecha del servicio.
              </div>
            </div>

            {/* Día del Mes (Opcional) */}
            <div className="space-y-2">
              <Label className="text-white">Día del Mes para Facturación (Opcional)</Label>
              <Select 
                value={config.billingCycleDay?.toString() || ''} 
                onValueChange={(value) => updateConfig({ billingCycleDay: value ? parseInt(value) : undefined })}
              >
                <SelectTrigger className="glass-input">
                  <SelectValue placeholder="Seleccionar día específico del mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin día específico</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      Día {day} del mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-white/60">
                Si se especifica, las facturas se generarán en este día del mes correspondiente.
              </div>
            </div>

            {/* Generación Automática */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-white">Generación Automática de Facturas</Label>
                <div className="text-xs text-white/60">
                  Generar facturas automáticamente cuando se cumple el período de diferimiento.
                </div>
              </div>
              <Switch
                checked={config.autoInvoiceGeneration}
                onCheckedChange={(checked) => updateConfig({ autoInvoiceGeneration: checked })}
              />
            </div>
          </div>
        )}

        {/* Notas de Facturación */}
        <div className="space-y-2">
          <Label className="text-white">Notas de Facturación (Opcional)</Label>
          <Textarea
            value={config.billingNotes || ''}
            onChange={(e) => updateConfig({ billingNotes: e.target.value })}
            className="glass-input"
            placeholder="Notas adicionales sobre el proceso de facturación..."
            rows={3}
          />
        </div>

        {/* Vista Previa */}
        <div className="p-4 rounded-lg border border-primary/20 bg-primary/10">
          <h4 className="text-white font-medium mb-2 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Vista Previa de Facturación
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/70">Ejemplo servicio realizado:</span>
              <span className="text-white">
                {new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString('es-CL')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Fecha de facturación:</span>
              <Badge variant="outline">
                {new Date(previewDate).toLocaleDateString('es-CL')}
              </Badge>
            </div>
            {config.billingCycleType === 'deferred' && (
              <div className="flex justify-between">
                <span className="text-white/70">Diferimiento:</span>
                <span className="text-white">
                  {config.billingDelayDays} día{config.billingDelayDays !== 1 ? 's' : ''}
                  {config.billingCycleDay && ` (día ${config.billingCycleDay} del mes)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Botón de Guardar */}
        <div className="flex justify-end">
          <Button 
            onClick={onSave} 
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};