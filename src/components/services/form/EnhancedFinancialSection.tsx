import React, { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, AlertCircle, Shield, Calculator } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getServiceValueBreakdown, getCompleteServiceValue } from '@/utils/serviceValueCalculations';

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
  disabled?: boolean;
  isCustodyService?: boolean;
  custodyTotalAmount?: number;
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
  disabled = false,
  isCustodyService = false,
  custodyTotalAmount = 0
}: EnhancedFinancialSectionProps) => {
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
          <DollarSign className="h-5 w-5" />
          Información Financiera
          {isCustodyService && <Shield className="h-4 w-4 text-blue-500" />}
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
            <div className="p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="h-5 w-5 text-blue-600" />
                <Label className="text-lg font-semibold text-blue-800">Desglose del Valor Total</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-white rounded-md border">
                  <Label className="text-sm text-muted-foreground block mb-1">Valor Base</Label>
                  <div className="text-xl font-bold text-blue-600">
                    ${serviceBreakdown.baseValue.toLocaleString('es-CL')}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-md border">
                  <Label className="text-sm text-muted-foreground block mb-1">Custodia</Label>
                  <div className="text-xl font-bold text-green-600">
                    ${serviceBreakdown.custodyValue.toLocaleString('es-CL')}
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-r from-blue-100 to-green-100 rounded-md border-2 border-primary">
                  <Label className="text-sm text-primary font-medium block mb-1">TOTAL</Label>
                  <div className="text-2xl font-bold text-violet-600">
                    ${serviceBreakdown.totalValue.toLocaleString('es-CL')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Valor único del servicio - mostrar input normal */
          <div className="space-y-2">
            <Label htmlFor="value" className="text-base font-semibold">
              Valor del Servicio (CLP) 
              {!isCustodyService && <span className="text-red-500"> *</span>}
              {isCustodyService && (
                <span className="text-muted-foreground text-sm"> (Opcional para custodia)</span>
              )}
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => onValueChange(Number(e.target.value))}
              placeholder={isCustodyService ? "0 (opcional)" : "150000"}
              required={!isCustodyService}
              disabled={disabled}
              className="!text-2xl !font-bold h-14"
            />
            {isCustodyService && custodyTotalAmount > 0 && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
                <Shield className="h-4 w-4 text-blue-600" />
                <p className="text-sm text-blue-700">
                  Valor de custodia: <span className="font-semibold">${custodyTotalAmount.toLocaleString('es-CL')}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Resumen de costos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Total Comisiones</Label>
            <div className="text-lg font-semibold text-orange-600">
              ${totalCommissions.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Total Costos</Label>
            <div className="text-lg font-semibold text-red-600">
              ${totalCosts.toLocaleString('es-CL')}
            </div>
          </div>
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Ganancia Neta</Label>
            <div className={`text-lg font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${profit.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* Margen de ganancia */}
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <div>
            <Label className="text-sm text-muted-foreground">Margen de Ganancia</Label>
            <div className={`text-xl font-bold ${profitMargin >= 20 ? 'text-green-600' : profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
          <div className="ml-auto text-right">
            <Label className="text-sm font-medium text-muted-foreground">Valor Total Servicio</Label>
            <div className="text-2xl font-bold text-violet-600">
              ${serviceBreakdown.totalValue.toLocaleString('es-CL')}
            </div>
          </div>
        </div>

        {/* Alerta de margen bajo */}
        {profitMargin < 10 && serviceBreakdown.totalValue > 0 && (
          <Alert className="border-yellow-500 bg-yellow-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              El margen de ganancia es bajo ({profitMargin.toFixed(1)}%). 
              Considera revisar los costos o el valor del servicio.
            </AlertDescription>
          </Alert>
        )}

        {/* Información especial para custodia */}
        {isCustodyService && (
          <Alert className="border-blue-500 bg-blue-50">
            <Shield className="h-4 w-4" />
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
        <div className="flex items-center space-x-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-l-4 border-blue-200 pl-4 bg-blue-50/30 py-4 rounded-r-lg">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
};