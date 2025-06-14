
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  dateRange: { from: string; to: string };
  onDateChange: (field: 'from' | 'to', value: string) => void;
  onUpdate: () => void;
}

export const DateRangeFilter = ({ dateRange, onDateChange, onUpdate }: DateRangeFilterProps) => (
  <Card className="bg-white/10 border-white/20">
    <CardHeader>
      <CardTitle className="text-white flex items-center">
        <Calendar className="w-5 h-5 mr-2" />
        Período de Análisis
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="from-date" className="text-gray-300">Fecha Inicio</Label>
          <Input
            id="from-date"
            type="date"
            value={dateRange.from}
            onChange={(e) => onDateChange('from', e.target.value)}
            className="bg-white/5 border-white/20 text-white"
          />
        </div>
        <div>
          <Label htmlFor="to-date" className="text-gray-300">Fecha Fin</Label>
          <Input
            id="to-date"
            type="date"
            value={dateRange.to}
            onChange={(e) => onDateChange('to', e.target.value)}
            className="bg-white/5 border-white/20 text-white"
          />
        </div>
        <Button onClick={onUpdate} className="bg-tms-green hover:bg-tms-green/90 md:col-span-2 lg:col-span-1">
          Actualizar
        </Button>
      </div>
    </CardContent>
  </Card>
);
