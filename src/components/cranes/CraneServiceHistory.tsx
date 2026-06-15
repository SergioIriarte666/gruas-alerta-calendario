import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Calendar, 
  MapPin, 
  User, 
  DollarSign,
  FileText,
  Filter
} from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useCraneServices } from '@/hooks/useCraneServices';

interface CraneServiceHistoryProps {
  crane: Crane;
}

export const CraneServiceHistory = ({ crane }: CraneServiceHistoryProps) => {
  const { data: services = [], isLoading } = useCraneServices(crane.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400">Completado</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Pendiente</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500/20 text-blue-400">En Proceso</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.operatorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || service.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalRevenue = services
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + s.value, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-foreground">Cargando historial de servicios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-muted/30 border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Servicios</p>
                <p className="text-foreground text-2xl font-bold">{services.length}</p>
              </div>
              <FileText className="size-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Completados</p>
                <p className="text-foreground text-2xl font-bold">
                  {services.filter(s => s.status === 'completed').length}
                </p>
              </div>
              <Calendar className="size-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Ingresos Totales</p>
                <p className="text-foreground text-2xl font-bold">
                  ${totalRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="size-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-muted/30 border-border/70">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Buscar por folio, cliente u operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border/70 text-foreground"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
                className={filterStatus === 'all' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'border-border text-primary hover:bg-primary/10'
                }
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('completed')}
                className={filterStatus === 'completed' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'border-border text-primary hover:bg-primary/10'
                }
              >
                Completados
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('pending')}
                className={filterStatus === 'pending' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'border-border text-primary hover:bg-primary/10'
                }
              >
                Pendientes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Servicios */}
      <Card className="bg-muted/30 border-border/70">
        <CardHeader>
          <CardTitle className="text-foreground">Historial de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron servicios</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Esta grúa aún no tiene servicios registrados'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="border border-border/70 rounded-lg p-4 hover:border-border transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-medium">{service.folio}</span>
                        {getStatusBadge(service.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="size-4" />
                            {formatForDisplay(service.serviceDate)}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <User className="size-4" />
                            {service.operatorName}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="size-4" />
                            {service.origin} → {service.destination}
                          </div>
                          <div className="text-foreground font-medium">
                            {service.clientName}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-primary">
                        ${service.value.toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        Valor del servicio
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};