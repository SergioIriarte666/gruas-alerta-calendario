import { Users, Building2, UserCheck, Activity } from 'lucide-react';

interface ClientsMetricsCardsProps {
  totalClients: number;
  activeClients: number;
  uniqueCompanies: number;
  multiDepartmentCompanies: number;
  activePercentage: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  description: string;
  iconColor: string;
  iconBgColor: string;
}

const MetricCard = ({ icon: Icon, title, value, description, iconColor, iconBgColor }: MetricCardProps) => (
  <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-violet-600 mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <div className={`p-2 rounded-lg ${iconBgColor}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  </div>
);

export const ClientsMetricsCards = ({
  totalClients,
  activeClients,
  uniqueCompanies,
  multiDepartmentCompanies,
  activePercentage,
}: ClientsMetricsCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        icon={Users}
        title="Total Clientes"
        value={totalClients}
        description={`${activeClients} activos`}
        iconColor="text-blue-600"
        iconBgColor="bg-blue-50"
      />
      <MetricCard
        icon={Building2}
        title="Empresas"
        value={uniqueCompanies}
        description={multiDepartmentCompanies > 0 ? `${multiDepartmentCompanies} multi-departamento` : 'Sin multi-departamentos'}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-50"
      />
      <MetricCard
        icon={UserCheck}
        title="Clientes Activos"
        value={activeClients}
        description={`De ${totalClients} registrados`}
        iconColor="text-green-600"
        iconBgColor="bg-green-50"
      />
      <MetricCard
        icon={Activity}
        title="Tasa de Actividad"
        value={`${activePercentage}%`}
        description="Clientes activos"
        iconColor="text-amber-600"
        iconBgColor="bg-amber-50"
      />
    </div>
  );
};
