import { IncomeWithDetails } from '@/types/incomes';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, Trash2, Calendar, CreditCard, Building2, User, Hash } from 'lucide-react';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface IncomePipelineCardProps {
  income: IncomeWithDetails;
  onEdit: () => void;
  onDelete: () => void;
}

export const IncomePipelineCard = ({ income, onEdit, onDelete }: IncomePipelineCardProps) => {
  const paymentMethodLabels: Record<string, string> = {
    transferencia: 'Transferencia',
    efectivo: 'Efectivo',
    cheque: 'Cheque',
    deposito: 'Depósito',
    tarjeta_credito: 'Tarjeta de Crédito',
    tarjeta_debito: 'Tarjeta de Débito',
    otro: 'Otro',
  };

  const clientDisplay = income.client?.name || income.occasional_client_name || 'Sin cliente';
  const categoryColor = income.category?.color || '#9ca3af';

  return (
    <div 
      className="bg-card border rounded-lg p-4 hover:shadow-lg transition-all space-y-3"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: categoryColor,
      }}
    >
      {/* Header - Descripción */}
      <div className="space-y-1">
        <h4 className="font-semibold text-foreground text-sm line-clamp-2">
          {income.description}
        </h4>
        {income.category && (
          <span 
            className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
            }}
          >
            {income.category.name}
          </span>
        )}
      </div>

      {/* Monto principal */}
      <div className="py-2">
        <p className="text-2xl font-bold text-green-400">
          ${income.amount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      </div>

      {/* Detalles */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatForDisplay(parseFromDatabase(income.income_date))}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          {income.client ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
          <span className="truncate">{clientDisplay}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>{paymentMethodLabels[income.payment_method]}</span>
        </div>

        {income.bank_reference && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="h-4 w-4" />
            <span className="truncate">{income.bank_reference}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="flex-1"
        >
          <Pencil className="h-3 w-3 mr-1" />
          Editar
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar ingreso?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. El ingreso será eliminado permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};
