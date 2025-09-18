import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, AlertCircle, Shield, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QuickClientCreateModal } from '@/components/clients/QuickClientCreateModal';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/utils/statusHelpers';

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
  disabled?: boolean;
  isCustodyService?: boolean;
  custodyTotalAmount?: number;
  currentClientId?: string;
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
  thirdPartyClientId,
  onThirdPartyClientIdChange,
  disabled = false,
  isCustodyService = false,
  custodyTotalAmount = 0,
  currentClientId
}: EnhancedFinancialSectionProps) => {
  
  const [clients, setClients] = useState<Array<{ id: string; name: string; rut: string }>>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);

  // Load clients when excess is enabled
  useEffect(() => {
    if (hasExcess) {
      loadClients();
    }
  }, [hasExcess]);

  const loadClients = async () => {
    setLoadingClients(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, rut')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      
      // Exclude current client from the list
      const filteredClients = data.filter(client => client.id !== currentClientId);
      setClients(filteredClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleClientCreated = (newClient: { id: string; name: string; rut: string }) => {
    setClients(prev => [...prev, newClient]);
    onThirdPartyClientIdChange?.(newClient.id);
  };
  
  // Calculate excess amount automatically
  useEffect(() => {
    if (hasExcess && clientCoveredAmount !== undefined && onExcessAmountChange) {
      const calculatedExcess = value - clientCoveredAmount;
      onExcessAmountChange(Math.max(0, calculatedExcess));
    }
  }, [hasExcess, value, clientCoveredAmount, onExcessAmountChange]);

  // Reset third-party client when excess is disabled
  useEffect(() => {
    if (!hasExcess && onThirdPartyClientIdChange) {
      onThirdPartyClientIdChange(null);
    }
  }, [hasExcess, onThirdPartyClientIdChange]);

  // Calcular margen de ganancia
  const calculateProfit = () => {
    // Para servicios de custodia, usar custodyTotalAmount si value es 0
    const effectiveValue = isCustodyService && value === 0 && custodyTotalAmount > 0 
      ? custodyTotalAmount 
      : value;
    return effectiveValue - totalCommissions - totalCosts;
  };

  const calculateProfitMargin = () => {
    const effectiveValue = isCustodyService && value === 0 && custodyTotalAmount > 0 
      ? custodyTotalAmount 
      : value;
    if (effectiveValue === 0) return 0;
    return ((calculateProfit() / effectiveValue) * 100);
  };

  const profit = calculateProfit();
  const profitMargin = calculateProfitMargin();
  const effectiveValue = isCustodyService && value === 0 && custodyTotalAmount > 0 
    ? custodyTotalAmount 
    : value;

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
        {/* Valor del Servicio - Condicional para custodia */}
        <div className="space-y-2">
          <Label htmlFor="value">
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
            className="text-lg font-semibold"
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

        {/* Valor efectivo para custodia */}
        {isCustodyService && custodyTotalAmount > 0 && value !== custodyTotalAmount && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <Label className="text-sm font-medium text-blue-800">Valor Efectivo del Servicio</Label>
            </div>
            <div className="text-xl font-bold text-blue-700">
              ${effectiveValue.toLocaleString('es-CL')}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {value === 0 ? 'Usando valor de custodia' : 'Valor del servicio + custodia'}
            </p>
          </div>
        )}

        {/* Margen de ganancia */}
        <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <div>
            <Label className="text-sm text-muted-foreground">Margen de Ganancia</Label>
            <div className={`text-xl font-bold ${profitMargin >= 20 ? 'text-green-600' : profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Alerta de margen bajo */}
        {profitMargin < 10 && effectiveValue > 0 && (
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
              <strong>Servicio de Custodia:</strong> Los cálculos financieros consideran el valor de custodia 
              {value > 0 ? ' además del valor base del servicio' : ' como valor principal'}.
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
                max={effectiveValue}
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
                type="text"
                value={formatCurrency(excessAmount)}
                readOnly
                disabled
                className="bg-muted text-muted-foreground font-semibold"
              />
            </div>

            {/* Third-party client selector */}
            {excessAmount > 0 && (
              <div className="col-span-full space-y-2">
                <Label className="text-sm font-medium">
                  Cliente para Servicio de Excedente *
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={thirdPartyClientId || ""}
                    onValueChange={(value) => {
                      if (value === "create-new") {
                        setShowQuickCreate(true);
                      } else {
                        onThirdPartyClientIdChange?.(value);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={loadingClients ? "Cargando clientes..." : "Seleccionar cliente"} />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 pointer-events-auto">
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} - {client.rut}
                        </SelectItem>
                      ))}
                      <SelectItem value="create-new" className="font-medium text-primary">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Crear nuevo cliente
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowQuickCreate(true)}
                    title="Crear nuevo cliente"
                    disabled={disabled}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {thirdPartyClientId && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Servicio de Excedente:</strong> Se creará automáticamente un servicio EXE-0000 
                      por {formatCurrency(excessAmount)} para el cliente seleccionado.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Quick Client Create Modal */}
      <QuickClientCreateModal
        open={showQuickCreate}
        onOpenChange={setShowQuickCreate}
        onClientCreated={handleClientCreated}
      />
    </Card>
  );
};