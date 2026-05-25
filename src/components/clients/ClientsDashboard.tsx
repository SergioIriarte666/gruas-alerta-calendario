import { Card, CardContent } from '@/components/ui/card';
import { Users, Building2, TrendingUp, DollarSign } from 'lucide-react';

interface ClientsDashboardProps {
  activeClients: number;
  inactiveClients: number;
  uniqueCompanies: number;
  activeServices: number;
  pendingInvoiceAmount: number;
}

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount);
};

export const ClientsDashboard = ({ activeClients, inactiveClients, uniqueCompanies, activeServices, pendingInvoiceAmount }: ClientsDashboardProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Clientes Activos - Primary violet card */}
      <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 border-violet-200 dark:border-violet-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Clientes Activos</p>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{activeClients}</p>
              <p className="text-xs text-muted-foreground mt-1">{inactiveClients} inactivos</p>
            </div>
            <div className="bg-violet-600/10 p-3 rounded-xl">
              <Users className="size-6 text-violet-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empresas Únicas */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Empresas Únicas</p>
              <p className="text-2xl font-bold text-foreground">{uniqueCompanies}</p>
              <p className="text-xs text-muted-foreground mt-1">por RUT único</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
              <Building2 className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Servicios Activos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Servicios Activos</p>
              <p className="text-2xl font-bold text-foreground">{activeServices}</p>
              <p className="text-xs text-muted-foreground mt-1">en pipeline</p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">
              <TrendingUp className="size-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Facturación Pendiente */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Fact. Pendiente</p>
              <p className="text-2xl font-bold text-foreground">{formatCompactCurrency(pendingInvoiceAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">por cobrar</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
              <DollarSign className="size-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
