import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, AlertCircle, Shield, Calculator, Sparkles, Plus } from 'lucide-react';
import { ClientForm } from '@/components/clients/ClientForm';
import { useClients } from '@/hooks/useClients';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Client } from '@/types';
import { getServiceValueBreakdown } from '@/utils/serviceValueCalculations';

interface EnhancedFinancialSectionProps {
  value: number;
  onValueChange: (value: number) => void;
  totalCommissions: number;
  totalCosts: number;
  hasExcess?: boolean;
  onHasExcessChange?: (value: boolean) => void;
  clientCoveredAmount?: number;
  onClientCoveredAmountChange?: (value: number) => void;
  excessAmount?: number;
  onExcessAmountChange?: (value: number) => void;
  thirdPartyClientId?: string | null;
  onThirdPartyClientIdChange?: (value: string | null) => void;
  clients?: Client[];
  disabled?: boolean;
  isCustodyService?: boolean;
  custodyTotalAmount?: number;
  // Rate lookup props
  matchedRateOrigin?: string | null;
  valueFromRate?: boolean;
  onClearRate?: () => void;
}

export const EnhancedFinancialSection = ({
  value,
  onValueChange,
  totalCommissions,
  totalCosts,
  hasExcess = false,
  onHasExcessChange,
  clientCoveredAmount = 0,
  onClientCoveredAmountChange,
  excessAmount = 0,
  onExcessAmountChange,
  thirdPartyClientId = null,
  onThirdPartyClientIdChange,
  clients = [],
  disabled = false,
  isCustodyService = false,
  custodyTotalAmount = 0,
  matchedRateOrigin,
  valueFromRate = false,
  onClearRate
}: EnhancedFinancialSectionProps) => {
  const { createClient } = useClients();
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);

  // Get service value breakdown for display
  const serviceBreakdown = getServiceValueBreakdown({
    value,
    custody_total_amount: custodyTotalAmount,
    custodyTotalAmount
  });
  
  // Calculate excess amount automatically
  useEffect(() => {
    if (hasExcess && clientCoveredAmount !== undefined && onExcessAmountChange) {
      const calculatedExcess = serviceBreakdown.totalValue - clientCoveredAmount;
      onExcessAmountChange(Math.max(0, calculatedExcess));
    }
  }, [hasExcess, serviceBreakdown.totalValue, clientCoveredAmount, onExcessAmountChange]);

  // Calcular margen de ganancia usando el valor total del servicio
  const calculateProfit = () => {
    return serviceBreakdown.totalValue - totalCommissions - totalCosts;
  };

  const calculateProfitMargin = () => {
    if (serviceBreakdown.totalValue === 0) return 0;
    return ((calculateProfit() / serviceBreakdown.totalValue) * 100);
  };

  const profit = calculateProfit();
  const profitMargin = calculateProfitMargin();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-5" />
          Información Financiera
          {isCustodyService && <Shield className="size-4 text-info" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Valor total del servicio - Mostrar desglose cuando hay ambos valores */}
        {serviceBreakdown.hasBothValues ? (
          <div className="space-y-4">
            {/* Valor base del servicio */}
            <div className="space-y-2">
              <Label htmlFor="value">
                Valor Base del Servicio (CLP) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="value"
                type="number"
                value={value}
                onChange={(e) => onValueChange(Number(e.target.value))}
                placeholder="25000"
                required
                disabled={disabled}
              className="text-xl font-bold"
              />
            </div>

            {/* Mostrar desglose de valores */}
            <div className="rounded-lg border border-border/70 bg-gradient-to-r from-info/10 to-success/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="size-5 text-info" />
                <Label className="text-lg font-semibold text-foreground">Desglose del Valor Total</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="rounded-md border border-border/70 bg-background/70 p-3">
                  <Label className="text-sm text-muted-foreground block mb-1">Valor Base</Label>
                  <div className="text-xl font-bold text-info">
                    ${serviceBreakdown.baseValue.toLocaleString('es-CL')}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/70 p-3">
                  <Label className="text-sm text-muted-foreground block mb-1">Custodia</Label>
                  <div className="text-xl font-bold text-success">
                    ${serviceBreakdown.custodyValue.toLocaleString('es-CL')}
                  </div>
                </div>
                <div className="rounded-md border-2 border-primary/30 bg-gradient-to-r from-info/10 to-success/10 p-3">
                  <Label className="text-sm text-primary font-medium block mb-1">TOTAL</Label>
                  <div className="text-2xl font-bold text-primary">
                    ${serviceBreakdown.totalValue.toLocaleString('es-CL')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Valor único del servicio - mostrar input normal */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="value" className="text-base font-semibold">
                Valor del Servicio (CLP) 
                {!isCustodyService && <span className="text-red-500"> *</span>}
                {isCustodyService && (
                  <span className="text-muted-foreground text-sm"> (Opcional para custodia)</span>
                )}
              </Label>
              {valueFromRate && matchedRateOrigin && (
                <Badge variant="secondary" className="flex items-center gap-1 border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="size-3" />
                  Tarifa: {matchedRateOrigin}
                </Badge>
              )}
            </div>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => {
                onValueChange(Number(e.target.value));
                // Si el usuario cambia manualmente el valor, limpiar indicador de tarifa
                if (onClearRate) onClearRate();
              }}
              placeholder={isCustodyService ? "0 (opcional)" : "150000"}
              required={!isCustodyService}
              disabled={disabled}
              className={`!text-2xl !font-bold h-14 ${valueFromRate ? 'border-primary/30 bg-primary/10' : ''}`}
            />
            {valueFromRate && (
              <p className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="size-3" />
                Valor aplicado automáticamente desde tarifa predefinida
              </p>
            )}
            {isCustodyService && custodyTotalAmount > 0 && (
              <div className="flex items-center gap-2 rounded-md bg-info/10 p-2">
                <Shield className="size-4 text-info" />
                <p className="text-sm text-info">
                  Valor de custodia: <span className="font-semibold">${custodyTotalAmount.toLocaleString('es-CL')}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resumen de costos */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-border/70 bg-muted/30 p-4 md:grid-cols-3">
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Total Comisiones</Label>
            <div className="text-lg font-semibold text-warning">
              ${totalCommissions.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Total Costos</Label>
            <div className="text-lg font-semibold text-danger">
              ${totalCosts.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Ganancia Neta</Label>
            <div className={`text-lg font-semibold ${profit >= 0 ? 'text-success' : 'text-danger'}`}>
              ${profit.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* Margen de ganancia */}
        <div className="flex items-center gap-4 rounded-lg border border-border/70 bg-background/50 p-3">
          <TrendingUp className="size-5 text-info" />
          <div>
            <Label className="text-sm text-muted-foreground">Margen de Ganancia</Label>
            <div className={`text-xl font-bold ${profitMargin >= 20 ? 'text-success' : profitMargin >= 10 ? 'text-warning' : 'text-danger'}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
          <div className="ml-auto text-right">
            <Label className="text-sm font-medium text-muted-foreground">Valor Total Servicio</Label>
            <div className="text-2xl font-bold text-primary">
              ${serviceBreakdown.totalValue.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* Alerta de margen bajo */}
        {profitMargin < 10 && serviceBreakdown.totalValue > 0 && (
          <Alert className="border-warning/30 bg-warning/10">
            <AlertCircle className="size-4 text-warning" />
            <AlertDescription>
              El margen de ganancia es bajo ({profitMargin.toFixed(1)}%). 
              Considera revisar los costos o el valor del servicio.
            </AlertDescription>
          </Alert>
        )}

        {/* Información especial para custodia */}
        {isCustodyService && (
          <Alert className="border-info/30 bg-info/10">
            <Shield className="size-4 text-info" />
            <AlertDescription>
              <strong>Servicio de Custodia:</strong> {serviceBreakdown.hasBothValues 
                ? 'Los cálculos financieros consideran el valor total (base + custodia).'
                : value > 0 
                  ? 'Los cálculos consideran el valor base del servicio más el valor de custodia.'
                  : 'Los cálculos consideran únicamente el valor de custodia.'
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Toggle para excedente */}
        <div className="flex items-center gap-x-3">
          <Switch
            id="hasExcess"
            checked={hasExcess}
            onCheckedChange={onHasExcessChange}
            disabled={disabled}
          />
          <Label htmlFor="hasExcess" className="text-sm font-medium">
            ¿Servicio con excedente?
          </Label>
        </div>

        {/* Campos condicionales de excedente */}
        {hasExcess && (
          <div className="grid grid-cols-1 gap-6 rounded-r-lg border-l-4 border-info/30 bg-info/5 py-4 pl-4 md:grid-cols-2">
            {/* Monto Cubierto por Cliente */}
            <div className="space-y-2">
              <Label htmlFor="clientCoveredAmount">Monto Cubierto por Cliente (CLP)</Label>
              <Input
                id="clientCoveredAmount"
                type="number"
                value={clientCoveredAmount}
                onChange={(e) => onClientCoveredAmountChange?.(Number(e.target.value))}
                placeholder="100000"
                max={serviceBreakdown.totalValue}
                disabled={disabled}
              />
            </div>

            {/* Excedente Cliente Final (Solo lectura) */}
            <div className="space-y-2">
              <Label htmlFor="excessAmount" className="text-muted-foreground">
                Excedente Cliente Final (CLP)
              </Label>
              <Input
                id="excessAmount"
                type="number"
                value={excessAmount}
                readOnly
                disabled
                className="bg-muted text-muted-foreground font-semibold"
              />
            </div>

            {/* Tercero pagador del excedente */}
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="thirdPartyClient">
                  Quién paga el excedente <span className="text-red-500">*</span>
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="flex items-center gap-1 text-xs"
                  disabled={disabled}
                  onClick={() => setIsClientFormOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Agregar Cliente
                </Button>
              </div>
              <Select
                value={thirdPartyClientId || ''}
                onValueChange={(value) => onThirdPartyClientIdChange?.(value || null)}
                disabled={disabled}
              >
                <SelectTrigger id="thirdPartyClient">
                  <SelectValue placeholder="Seleccionar cliente o tercero..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.rut ? `· ${c.rut}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Empresa o persona que pagará el excedente de ${(excessAmount || 0).toLocaleString('es-CL')}
              </p>

              {/* Modal de creación rápida de cliente; al crear se auto-selecciona */}
              <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border/70 bg-popover/95 p-0">
                  <ClientForm
                    onSubmit={async (data) => {
                      try {
                        const result = await createClient(data);
                        const newClientId = (result as any)?.clients?.[0]?.id;
                        if (newClientId) {
                          onThirdPartyClientIdChange?.(newClientId);
                        }
                        setIsClientFormOpen(false);
                      } catch {
                        // El error ya se notifica vía toast en useClients
                      }
                    }}
                    onCancel={() => setIsClientFormOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
