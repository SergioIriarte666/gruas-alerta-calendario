import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Wrench, Shield } from 'lucide-react';

interface RentalEquipmentSectionProps {
  serviceTypeName?: string;
  custodyMode: string;
  custodyDays?: number;
  custodyDailyRate?: number;
  custodyStartDate: string;
  custodyEndDate: string;
  custodyVehicleType: string;
  custodyDiscountPercentage: number;
  custodyTotalAmount?: number;
  custodyNotes: string;
  onCustodyModeChange: (value: string) => void;
  onCustodyDaysChange: (value: number) => void;
  onCustodyDailyRateChange: (value: number) => void;
  onCustodyStartDateChange: (value: string) => void;
  onCustodyEndDateChange: (value: string) => void;
  onCustodyVehicleTypeChange: (value: string) => void;
  onCustodyDiscountPercentageChange: (value: number) => void;
  onCustodyNotesChange: (value: string) => void;
}

export const RentalEquipmentSection = ({
  serviceTypeName,
  custodyMode,
  custodyDays,
  custodyDailyRate,
  custodyStartDate,
  custodyEndDate,
  custodyVehicleType,
  custodyDiscountPercentage,
  custodyTotalAmount,
  custodyNotes,
  onCustodyModeChange,
  onCustodyDaysChange,
  onCustodyDailyRateChange,
  onCustodyStartDateChange,
  onCustodyEndDateChange,
  onCustodyVehicleTypeChange,
  onCustodyDiscountPercentageChange,
  onCustodyNotesChange,
}: RentalEquipmentSectionProps) => {
  // Determinar si es servicio de arriendo de equipos
  const isEquipmentRental = serviceTypeName === 'Arriendo de Equipos';
  
  // Si es "none" y no es arriendo de equipos, no mostrar
  if (custodyMode === 'none' && !isEquipmentRental) return null;

  // Para arriendo de equipos, forzar modo calendar si está en none
  useEffect(() => {
    if (isEquipmentRental && custodyMode === 'none') {
      onCustodyModeChange('calendar');
    }
  }, [isEquipmentRental, custodyMode, onCustodyModeChange]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEquipmentRental ? (
            <>
              <Wrench className="h-5 w-5" />
              Información de Arriendo
            </>
          ) : (
            <>
              <Shield className="h-5 w-5" />
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
              value={custodyMode}
              onValueChange={onCustodyModeChange}
              disabled={isEquipmentRental} // Para arriendo siempre debe ser calendar
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
              value={custodyVehicleType}
              onChange={(e) => onCustodyVehicleTypeChange(e.target.value)}
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
                onChange={(e) => onCustodyDaysChange(Number(e.target.value))}
                placeholder="Número de días"
              />
            </div>

            <div>
              <Label htmlFor="custodyDailyRate">Tarifa Diaria</Label>
              <Input
                type="number"
                value={custodyDailyRate || ''}
                onChange={(e) => onCustodyDailyRateChange(Number(e.target.value))}
                placeholder="Tarifa por día"
              />
            </div>
          </div>
        )}

        {custodyMode === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="custodyStartDate">
                {isEquipmentRental ? 'Fecha de Inicio del Arriendo' : 'Fecha de Inicio'}
              </Label>
              <Input
                type="date"
                value={custodyStartDate}
                onChange={(e) => onCustodyStartDateChange(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="custodyEndDate">
                {isEquipmentRental ? 'Fecha de Fin del Arriendo' : 'Fecha de Fin'}
              </Label>
              <Input
                type="date"
                value={custodyEndDate}
                onChange={(e) => onCustodyEndDateChange(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="custodyDailyRate">Tarifa Diaria</Label>
              <Input
                type="number"
                value={custodyDailyRate || ''}
                onChange={(e) => onCustodyDailyRateChange(Number(e.target.value))}
                placeholder="Tarifa por día"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="custodyDiscountPercentage">Descuento (%)</Label>
            <Input
              type="number"
              value={custodyDiscountPercentage}
              onChange={(e) => onCustodyDiscountPercentageChange(Number(e.target.value))}
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
            value={custodyNotes}
            onChange={(e) => onCustodyNotesChange(e.target.value)}
            placeholder={isEquipmentRental ? "Observaciones adicionales sobre el arriendo" : "Observaciones adicionales sobre la custodia"}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};