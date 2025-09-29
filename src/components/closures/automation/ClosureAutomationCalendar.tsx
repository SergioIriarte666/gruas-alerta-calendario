import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Users, AlertTriangle, CheckCircle } from 'lucide-react';

interface ClosureAutomationCalendarProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  clientsSummary: {
    ready: number;
    needsAttention: number;
    total: number;
  };
}

const ClosureAutomationCalendar = ({ 
  selectedMonth, 
  onMonthChange, 
  clientsSummary 
}: ClosureAutomationCalendarProps) => {
  return (
    <Card className="bg-background border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl text-foreground">Seleccionar Período</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecciona el mes para automatizar cierres de servicios
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedMonth}
            onSelect={(date) => date && onMonthChange(date)}
            className="rounded-md border-border"
          />
        </div>
        
        {clientsSummary.total > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{clientsSummary.total}</p>
                <p className="text-xs text-muted-foreground">Clientes totales</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium text-foreground">{clientsSummary.ready}</p>
                <p className="text-xs text-muted-foreground">Listos para cierre</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-foreground">{clientsSummary.needsAttention}</p>
                <p className="text-xs text-muted-foreground">Requieren atención</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClosureAutomationCalendar;