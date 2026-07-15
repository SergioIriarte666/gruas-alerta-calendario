import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Wrench } from 'lucide-react';
import { calculateCustodyTotal, isCustodyDataComplete, type CustodyData } from '@/utils/custodyCalculations';
import DatePickerInput from '@/components/common/DatePickerInput';

interface CustodySectionProps {
  serviceTypeName?: string;
  custodyMode?: string;
  custodyDays?: number;
  custodyDailyRate?: number;
  custodyRateType?: string;
  custodyStartDate?: string;
  custodyEndDate?: string;
  custodyVehicleType?: string;
  custodyDiscountPercentage?: number;
  custodyTotalAmount?: number;
  custodyNotes?: string;
  onCustodyModeChange?: (value: string) => void;
  onCustodyDaysChange?: (value: number) => void;
  onCustodyDailyRateChange?: (value: number) => void;
  onCustodyRateTypeChange?: (value: string) => void;
  onCustodyStartDateChange?: (value: string) => void;
  onCustodyEndDateChange?: (value: string) => void;
  onCustodyVehicleTypeChange?: (value: string) => void;
  onCustodyDiscountPercentageChange?: (value: number) => void;
  onCustodyTotalAmountChange?: (value: number) => void;
  onCustodyNotesChange?: (value: string) => void;
}

export const CustodySection = ({ 
  serviceTypeName,
  custodyMode,
  custodyDays,
  custodyDailyRate,
  custodyRateType,
  custodyStartDate,
  custodyEndDate,
  custodyVehicleType,
  custodyDiscountPercentage,
  custodyTotalAmount,
  custodyNotes,
  onCustodyModeChange,
  onCustodyDaysChange,
  onCustodyDailyRateChange,
  onCustodyRateTypeChange,
  onCustodyStartDateChange,
  onCustodyEndDateChange,
  onCustodyVehicleTypeChange,
  onCustodyDiscountPercentageChange,
  onCustodyTotalAmountChange,
  onCustodyNotesChange
}: CustodySectionProps) => {
  // Determinar si es servicio de arriendo de equipos
  const isEquipmentRental = serviceTypeName === 'Arriendo de Equipos';
  
  // Para arriendo de equipos, forzar modo calendar si está en none
  useEffect(() => {
    if (isEquipmentRental && custodyMode === 'none') {
      onCustodyModeChange?.('calendar');
    }
  }, [isEquipmentRental, custodyMode, onCustodyModeChange]);

  // Cálculo automático para modo manual usando utility centralizada
  useEffect(() => {
    if (custodyMode === 'manual' && custodyDays && custodyDailyRate) {
      const custodyData: CustodyData = {
        mode: 'manual',
        originalRate: custodyDailyRate,
        rateType: (custodyRateType as 'daily' | 'weekly' | 'monthly') || 'daily',
        days: custodyDays,
        discountPercentage: custodyDiscountPercentage || 0
      };

      if (isCustodyDataComplete(custodyData)) {
        const result = calculateCustodyTotal(custodyData);
        onCustodyTotalAmountChange?.(result.total);
      }
    }
  }, [custodyDays, custodyDailyRate, custodyRateType, custodyDiscountPercentage, custodyMode, onCustodyTotalAmountChange]);

  // Cálculo automático para modo calendario usando utility centralizada
  useEffect(() => {
    if (custodyMode === 'calendar' && custodyStartDate && custodyEndDate && custodyDailyRate) {
      const custodyData: CustodyData = {
        mode: 'calendar',
        originalRate: custodyDailyRate,
        rateType: (custodyRateType as 'daily' | 'weekly' | 'monthly') || 'daily',
        startDate: custodyStartDate,
        endDate: custodyEndDate,
        discountPercentage: custodyDiscountPercentage || 0
      };

      if (isCustodyDataComplete(custodyData)) {
        const result = calculateCustodyTotal(custodyData);
        onCustodyDaysChange?.(result.totalDays);
        onCustodyTotalAmountChange?.(result.total);
      }
    }
  }, [custodyStartDate, custodyEndDate, custodyDailyRate, custodyRateType, custodyDiscountPercentage, custodyMode, onCustodyDaysChange, onCustodyTotalAmountChange]);

  // Si es "none" y no es arriendo de equipos, no mostrar
  if (custodyMode === 'none' && !isEquipmentRental) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEquipmentRental ? (
            <>
              <Wrench className="size-5" />
              Información de Arriendo
            </>
          ) : (
            <>
              <Shield className="size-5" />
              Información de Custodia
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="custodyMode">
              {isEquipmentRental ? 'Modo de Arriendo' : 'Modo de Custodia'}
            </Label>
            <Select 
              onValueChange={(value) => onCustodyModeChange?.(value)} 
              value={custodyMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar modo" />
              </SelectTrigger>
              <SelectContent>
                {!isEquipmentRental && <SelectItem value="none">Sin custodia</SelectItem>}
                <SelectItem value="manual">Manual (días específicos)</SelectItem>
                <SelectItem value="calendar">
                  {isEquipmentRental ? 'Por fechas' : 'Calendario (fechas)'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="custodyVehicleType">
              {isEquipmentRental ? 'Tipo de Equipo' : 'Tipo de Vehículo'}
            </Label>
            <Input
              value={custodyVehicleType || ''}
              onChange={(e) => onCustodyVehicleTypeChange?.(e.target.value)}
              placeholder={isEquipmentRental ? "Ej: Grúa, Montacarga, Excavadora" : "Ej: Automóvil, Camioneta, Motocicleta"}
            />
          </div>
        </div>

        {custodyMode === 'manual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="custodyDays">
                {isEquipmentRental ? 'Días de Arriendo' : 'Días de Custodia'}
              </Label>
              <Input
                type="number"
                value={custodyDays || ''}
                onChange={(e) => onCustodyDaysChange?.(parseInt(e.target.value) || 0)}
                placeholder="Número de días"
              />
            </div>

            <div>
              <Label htmlFor="custodyRateType">Tipo de Tarifa</Label>
              <Select 
                onValueChange={(value) => onCustodyRateTypeChange?.(value)} 
                value={custodyRateType || 'daily'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Tarifa Diaria</SelectItem>
                  <SelectItem value="weekly">Tarifa Semanal</SelectItem>
                  <SelectItem value="monthly">Tarifa Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custodyDailyRate">
                {custodyRateType === 'weekly' ? 'Tarifa Semanal' : 
                 custodyRateType === 'monthly' ? 'Tarifa Mensual' : 'Tarifa Diaria'}
              </Label>
              <Input
                type="number"
                value={custodyDailyRate || ''}
                onChange={(e) => onCustodyDailyRateChange?.(parseFloat(e.target.value) || 0)}
                placeholder={
                  custodyRateType === 'weekly' ? 'Tarifa por semana' : 
                  custodyRateType === 'monthly' ? 'Tarifa por mes' : 'Tarifa por día'
                }
              />
            </div>
          </div>
        )}

        {custodyMode === 'calendar' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="custodyStartDate">
                  {isEquipmentRental ? 'Fecha de Inicio del Arriendo' : 'Fecha de Inicio'}
                </Label>
                <DatePickerInput
                  id="custodyStartDate"
                  value={custodyStartDate || ''}
                  onChange={(value) => onCustodyStartDateChange?.(value)}
                  placeholder="Seleccionar fecha"
                />
              </div>

              <div>
                <Label htmlFor="custodyEndDate">
                  {isEquipmentRental ? 'Fecha de Fin del Arriendo' : 'Fecha de Fin'}
                </Label>
                <DatePickerInput
                  id="custodyEndDate"
                  value={custodyEndDate || ''}
                  onChange={(value) => onCustodyEndDateChange?.(value)}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="custodyRateType">Tipo de Tarifa</Label>
                <Select 
                  onValueChange={(value) => onCustodyRateTypeChange?.(value)} 
                  value={custodyRateType || 'daily'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Tarifa Diaria</SelectItem>
                    <SelectItem value="weekly">Tarifa Semanal</SelectItem>
                    <SelectItem value="monthly">Tarifa Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="custodyDailyRate">
                  {custodyRateType === 'weekly' ? 'Tarifa Semanal' : 
                   custodyRateType === 'monthly' ? 'Tarifa Mensual' : 'Tarifa Diaria'}
                </Label>
                <Input
                  type="number"
                  value={custodyDailyRate || ''}
                  onChange={(e) => onCustodyDailyRateChange?.(parseFloat(e.target.value) || 0)}
                  placeholder={
                    custodyRateType === 'weekly' ? 'Tarifa por semana' : 
                    custodyRateType === 'monthly' ? 'Tarifa por mes' : 'Tarifa por día'
                  }
                />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="custodyDiscountPercentage">Descuento (%)</Label>
            <Input
              type="number"
              value={custodyDiscountPercentage || ''}
              onChange={(e) => onCustodyDiscountPercentageChange?.(parseFloat(e.target.value) || 0)}
              placeholder="0"
              min="0"
              max="100"
            />
          </div>

          <div>
            <Label htmlFor="custodyTotalAmount">
              {isEquipmentRental ? 'Total Arriendo' : 'Total Custodia'}
            </Label>
            <Input
              type="number"
              value={custodyTotalAmount || ''}
              placeholder="Total calculado"
              readOnly
              className="bg-muted"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="custodyNotes">
            {isEquipmentRental ? 'Notas del Arriendo' : 'Notas de Custodia'}
          </Label>
          <Textarea
            value={custodyNotes || ''}
            onChange={(e) => onCustodyNotesChange?.(e.target.value)}
            placeholder={isEquipmentRental ? "Observaciones adicionales sobre el arriendo" : "Observaciones adicionales sobre la custodia"}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};