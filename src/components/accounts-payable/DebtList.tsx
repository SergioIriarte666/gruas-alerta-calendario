import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebtsWithProgress, DebtWithProgress } from '@/hooks/useDebts';
import { Plus, Eye } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DebtListProps {
  onCreateDebt: () => void;
  onViewDebt: (debt: DebtWithProgress) => void;
}

export const DebtList = ({ onCreateDebt, onViewDebt }: DebtListProps) => {
  const { data: debts, isLoading } = useDebtsWithProgress();

  const getStatusBadge = (debt: DebtWithProgress) => {
    if (debt.overdue_count > 0)
      return <Badge variant="destructive" className="text-xs">Vencida</Badge>;
    if (debt.status === 'completed')
      return <Badge className="bg-green-100 text-green-800 text-xs">Completada</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 text-xs">Activa</Badge>;
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case 'monthly': return 'Mensual';
      case 'weekly': return 'Semanal';
      case 'biweekly': return 'Quincenal';
      default: return freq;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between py-4 px-6">
        <CardTitle className="text-base font-semibold text-foreground">Deudas Activas</CardTitle>
        <Button size="sm" onClick={onCreateDebt}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Deuda
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acreedor</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Monto Total</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Progreso</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[60px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!debts || debts.length === 0) ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No hay deudas registradas
                </TableCell>
              </TableRow>
            ) : (
              debts.map((debt) => {
                const progress = debt.installments_count > 0
                  ? (debt.paid_count / debt.installments_count) * 100
                  : 0;
                return (
                  <TableRow key={debt.id}>
                    <TableCell className="font-medium text-foreground">
                      {debt.creditors?.name || '-'}
                      <span className="block text-xs text-muted-foreground">
                        {debt.creditors?.type || ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground">{debt.description}</TableCell>
                    <TableCell className="text-foreground font-medium">
                      ${Number(debt.total_amount).toLocaleString('es-CL')}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {getFrequencyLabel(debt.frequency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2 w-20" />
                        <span className="text-xs text-muted-foreground">
                          {debt.paid_count}/{debt.installments_count}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(debt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => onViewDebt(debt)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
