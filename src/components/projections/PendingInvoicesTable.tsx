import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface PendingInvoicesTableProps {
  invoices: ProjectedInvoice[];
  isLoading?: boolean;
}

export const PendingInvoicesTable = ({ invoices, isLoading }: PendingInvoicesTableProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy', { locale: es });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { label: 'Enviada', variant: 'default' as const },
      partial: { label: 'Parcial', variant: 'secondary' as const },
      overdue: { label: 'Vencida', variant: 'destructive' as const },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDaysUntilDueBadge = (invoice: ProjectedInvoice) => {
    if (invoice.status === 'overdue') {
      return (
        <Badge variant="destructive" className="whitespace-nowrap">
          Vencida {invoice.days_overdue}d
        </Badge>
      );
    }

    if (invoice.days_until_due <= 7) {
      return (
        <Badge variant="secondary" className="whitespace-nowrap bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
          Vence en {invoice.days_until_due}d
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="whitespace-nowrap">
        {invoice.days_until_due}d
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center text-muted-foreground">
          Cargando facturas...
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-md border">
        <div className="p-8 text-center text-muted-foreground">
          No hay facturas pendientes en el rango seleccionado
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Emisión</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Monto Pendiente</TableHead>
            <TableHead>Días</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">
                <div>
                  <div className="font-semibold">{invoice.folio}</div>
                  {invoice.numero_fiscal && (
                    <div className="text-xs text-muted-foreground">
                      {invoice.numero_fiscal}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{invoice.client_name}</div>
                  <div className="text-xs text-muted-foreground">{invoice.client_rut}</div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(invoice.issue_date)}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(invoice.due_date)}
              </TableCell>
              <TableCell>
                {getStatusBadge(invoice.status)}
              </TableCell>
              <TableCell className="text-right font-semibold">
                {formatCurrency(invoice.remaining_amount)}
              </TableCell>
              <TableCell>
                {getDaysUntilDueBadge(invoice)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
