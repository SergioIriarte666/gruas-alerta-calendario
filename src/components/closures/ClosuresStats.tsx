
import { FileText, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceClosure } from '@/types';

interface ClosuresStatsProps {
  closures: ServiceClosure[];
}

const ClosuresStats = ({ closures }: ClosuresStatsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Cierres Abiertos</p>
              <p className="text-2xl font-bold text-foreground">
                {closures.filter(c => c.status === 'open').length}
              </p>
            </div>
            <FileText className="size-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Cierres Cerrados</p>
              <p className="text-2xl font-bold text-foreground">
                {closures.filter(c => c.status === 'closed').length}
              </p>
            </div>
            <Calendar className="size-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Facturado</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(closures.filter(c => c.status === 'invoiced').reduce((sum, c) => sum + c.total, 0))}
              </p>
            </div>
            <DollarSign className="size-8 text-green-500" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClosuresStats;
