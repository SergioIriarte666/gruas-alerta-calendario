import { MetricCard } from '@/components/ui/metric-card';
import { Invoice } from '@/types';
import { DollarSign, FileText, AlertTriangle, BadgeCheck } from 'lucide-react';

interface InvoicesStatsProps {
  invoices: Invoice[];
}

const InvoicesStats = ({ invoices }: InvoicesStatsProps) => {
  const totalInvoices = invoices.length;
  const pendingAmount = invoices
    .filter(inv => inv.status === 'draft' || inv.status === 'sent')
    .reduce((sum, inv) => sum + inv.total, 0);
  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
      <MetricCard
        title="Total Facturas"
        value={totalInvoices}
        description="Registros disponibles en la vista actual"
        icon={FileText}
        tone="primary"
      />
      <MetricCard
        title="Pendientes"
        value={`$${pendingAmount.toLocaleString('es-CL')}`}
        description="Borradores y enviadas pendientes de pago"
        icon={DollarSign}
        tone="warning"
      />
      <MetricCard
        title="Vencidas"
        value={`$${overdueAmount.toLocaleString('es-CL')}`}
        description="Facturas fuera de plazo de cobro"
        icon={AlertTriangle}
        tone="danger"
      />
      <MetricCard
        title="Cobradas"
        value={`$${paidAmount.toLocaleString('es-CL')}`}
        description="Facturación ya conciliada"
        icon={BadgeCheck}
        tone="success"
      />
    </div>
  );
};

export default InvoicesStats;
