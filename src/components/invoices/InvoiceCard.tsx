import { Invoice } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  FileText, 
  Calendar, 
  Building2, 
  MoreVertical, 
  Edit, 
  Trash2, 
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InvoiceCardProps {
  invoice: Invoice;
  clientName?: string;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(amount);
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Borrador', variant: 'secondary' as const, icon: FileText, color: 'text-gray-600' };
    case 'sent':
      return { label: 'Enviada', variant: 'default' as const, icon: Clock, color: 'text-blue-600' };
    case 'paid':
      return { label: 'Pagada', variant: 'default' as const, icon: CheckCircle, color: 'text-green-600' };
    case 'overdue':
      return { label: 'Vencida', variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-600' };
    case 'cancelled':
      return { label: 'Anulada', variant: 'outline' as const, icon: FileText, color: 'text-gray-400' };
    default:
      return { label: status, variant: 'secondary' as const, icon: FileText, color: 'text-gray-600' };
  }
};

const getDaysUntilDue = (dueDate: string | null, status: string) => {
  if (!dueDate || status === 'paid' || status === 'cancelled') return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

export const InvoiceCard = ({ 
  invoice, 
  clientName, 
  onEdit, 
  onDelete, 
  onMarkAsPaid 
}: InvoiceCardProps) => {
  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;
  const daysUntilDue = getDaysUntilDue(invoice.dueDate, invoice.status);

  return (
    <Card className="hover:shadow-md transition-all duration-200 hover:border-violet-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md bg-violet-50`}>
              <FileText className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{invoice.folio}</p>
              {invoice.numeroFiscal && (
                <p className="text-xs text-muted-foreground">#{invoice.numeroFiscal}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={statusConfig.variant}
              className={`gap-1 ${statusConfig.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(invoice)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                  <DropdownMenuItem onClick={() => onMarkAsPaid(invoice.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marcar como Pagada
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                  onClick={() => onDelete(invoice.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Client */}
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground font-medium">{clientName || 'Sin cliente'}</span>
        </div>
        
        {/* Dates */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {invoice.issueDate 
                ? format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: es })
                : '-'
              }
            </span>
          </div>
          {daysUntilDue !== null && (
            <Badge 
              variant={daysUntilDue < 0 ? 'destructive' : daysUntilDue <= 7 ? 'default' : 'secondary'}
              className={`text-xs ${
                daysUntilDue < 0 
                  ? 'bg-red-100 text-red-700' 
                  : daysUntilDue <= 7 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {daysUntilDue < 0 
                ? `${Math.abs(daysUntilDue)} días vencida` 
                : daysUntilDue === 0 
                  ? 'Vence hoy'
                  : `${daysUntilDue} días`
              }
            </Badge>
          )}
        </div>
        
        {/* Total */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-violet-600">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceCard;
