import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  Eye, 
  CreditCard,
  FileText,
  Send,
  DollarSign,
  AlertTriangle,
  X,
  Calendar,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice } from '@/types';
import { InvoicesPipelineMetrics } from './InvoicesPipelineMetrics';

interface InvoiceGroup {
  count: number;
  totalValue: number;
  avgDays: number;
}

interface InvoicesPipelineViewProps {
  invoices: Invoice[];
  loading: boolean;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onView: (invoice: Invoice) => void;
  getInvoiceWithDetails: (invoice: Invoice) => Invoice;
}

export const InvoicesPipelineView: React.FC<InvoicesPipelineViewProps> = ({
  invoices,
  loading,
  onEdit,
  onDelete,
  onMarkAsPaid,
  onView,
  getInvoiceWithDetails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    draft: true,
    sent: true,
    paid: false,
    overdue: true,
    cancelled: false
  });

  // Pipeline status configuration
  const PIPELINE_STATUSES = [
    {
      key: 'draft',
      title: 'Borradores',
      description: 'Facturas en preparación',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      icon: FileText
    },
    {
      key: 'sent',
      title: 'Enviadas',
      description: 'Pendientes de pago',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      icon: Send
    },
    {
      key: 'paid',
      title: 'Pagadas',
      description: 'Cobradas exitosamente',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      icon: CreditCard
    },
    {
      key: 'overdue',
      title: 'Vencidas',
      description: 'Requieren atención urgente',
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      icon: AlertTriangle,
      urgent: true
    },
    {
      key: 'cancelled',
      title: 'Anuladas',
      description: 'Facturas canceladas',
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      icon: X
    }
  ];

  const serviceGroups = useMemo(() => {
    const filtered = invoices.filter(invoice =>
      invoice.folio.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groups: Record<string, { invoices: Invoice[]; stats: InvoiceGroup }> = {};
    const now = new Date();
    
    PIPELINE_STATUSES.forEach(status => {
      const statusInvoices = filtered.filter(invoice => invoice.status === status.key);
      
      const totalValue = statusInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      
      // Calculate average days (for different meanings per status)
      let avgDays = 0;
      if (statusInvoices.length > 0) {
        if (status.key === 'paid') {
          // For paid invoices: average days from issue to payment
          const paidWithDates = statusInvoices.filter(inv => inv.paymentDate);
          if (paidWithDates.length > 0) {
            avgDays = paidWithDates.reduce((sum, inv) => {
              const issueDate = new Date(inv.issueDate);
              const paymentDate = new Date(inv.paymentDate!);
              const diffTime = paymentDate.getTime() - issueDate.getTime();
              return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }, 0) / paidWithDates.length;
          }
        } else if (status.key === 'overdue') {
          // For overdue: average days overdue
          avgDays = statusInvoices.reduce((sum, inv) => {
            const dueDate = new Date(inv.dueDate);
            const diffTime = now.getTime() - dueDate.getTime();
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }, 0) / statusInvoices.length;
        } else if (status.key === 'sent') {
          // For sent: average days since issue
          avgDays = statusInvoices.reduce((sum, inv) => {
            const issueDate = new Date(inv.issueDate);
            const diffTime = now.getTime() - issueDate.getTime();
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }, 0) / statusInvoices.length;
        }
      }

      groups[status.key] = {
        invoices: statusInvoices,
        stats: {
          count: statusInvoices.length,
          totalValue,
          avgDays: Math.round(avgDays)
        }
      };
    });

    return groups;
  }, [invoices, searchTerm]);

  const toggleGroup = (statusKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [statusKey]: !prev[statusKey]
    }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CL');
  };

  const calculateDaysFromDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando pipeline de facturas...</div>
      </div>
    );
  }

  const hasInitialInvoices = invoices.length > 0;

  if (!hasInitialInvoices) {
    return (
      <div className="text-center py-12">
        <FileText className="size-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">No hay facturas</h3>
        <p className="text-gray-400">Crea tu primera factura para comenzar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <InvoicesPipelineMetrics invoices={invoices} />

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por folio o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Pipeline Columns */}
      <div className="space-y-6">
        {PIPELINE_STATUSES.map((status) => {
          const group = serviceGroups[status.key];
          const Icon = status.icon;
          const isExpanded = expandedGroups[status.key];

          return (
            <Card
              key={status.key}
              className={cn(
                "bg-card border-border transition-all duration-200",
                status.urgent && group.stats.count > 0 && "ring-2 ring-red-400/50"
              )}
            >
                <CardHeader
                  className="cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => toggleGroup(status.key)}
                >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn("p-2 rounded-lg", status.bgColor)}>
                      <Icon className={cn("size-5", status.color)} />
                    </div>
                    <div>
                      <CardTitle className={cn("text-lg", status.color)}>
                        {status.title}
                        {status.urgent && group.stats.count > 0 && (
                          <Badge variant="destructive" className="ml-2 animate-pulse">
                            ¡Urgente!
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">{status.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">{group.stats.count}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(group.stats.totalValue)}
                      </p>
                      {group.stats.avgDays > 0 && (
                        <p className="text-xs text-gray-500">
                          {status.key === 'paid' && `${group.stats.avgDays} días promedio pago`}
                          {status.key === 'overdue' && `${group.stats.avgDays} días vencidas`}
                          {status.key === 'sent' && `${group.stats.avgDays} días pendientes`}
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="size-5 text-gray-400" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                  {group.invoices.map((invoice) => {
                      const invoiceWithDetails = getInvoiceWithDetails(invoice);
                      const daysFromDue = calculateDaysFromDue(invoice.dueDate);
                      const isUrgent = daysFromDue <= 3 && invoice.status !== 'paid' && invoice.status !== 'cancelled';

                      return (
                        <Card
                          key={invoice.id}
                          className={cn(
                            "bg-muted/50 border-border hover:bg-muted transition-all duration-200",
                            isUrgent && "ring-1 ring-red-400/30"
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h4 className="font-semibold text-foreground truncate">
                                    {invoice.folio}
                                  </h4>
                                  {isUrgent && (
                                    <Badge variant="destructive" className="text-xs">
                                      Urgente
                                    </Badge>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                  <div className="flex items-center space-x-1">
                                    <User className="size-3" />
                                    <span className="truncate">
                                      {(invoiceWithDetails as any).client?.name || 'Cliente no especificado'}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="size-3" />
                                    <span>{formatDate(invoice.dueDate)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <DollarSign className="size-3" />
                                    <span className="font-medium text-foreground">
                                      {formatCurrency(invoice.total)}
                                    </span>
                                  </div>
                                </div>

                                {invoice.status === 'overdue' && (
                                  <p className="text-xs text-red-400 mt-1">
                                    Vencida hace {Math.abs(daysFromDue)} días
                                  </p>
                                )}
                                {invoice.status === 'sent' && daysFromDue <= 3 && (
                                  <p className="text-xs text-yellow-400 mt-1">
                                    Vence en {daysFromDue} días
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center space-x-2 ml-4">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onView(invoice)}
                                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                >
                                  <Eye className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onEdit(invoice)}
                                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                >
                                  <Edit className="size-4" />
                                </Button>
                                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onMarkAsPaid(invoice.id)}
                                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                  >
                                    <CreditCard className="size-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onDelete(invoice.id)}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {group.invoices.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        <Icon className="size-12 mx-auto mb-2 opacity-50" />
                        <p>No hay facturas en {status.title.toLowerCase()}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};