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
import { getServiceDisplayValue } from '@/utils/serviceValueCalculations';

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
        <div className="text-white">Cargando historial de servicios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Servicios</p>
                <p className="text-white text-2xl font-bold">{services.length}</p>
              </div>
              <FileText className="w-8 h-8 text-tms-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Completados</p>
                <p className="text-white text-2xl font-bold">
                  {services.filter(s => s.status === 'completed').length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Ingresos Totales</p>
                <p className="text-white text-2xl font-bold">
                  ${totalRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-tms-green" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por folio, cliente u operador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black border-tms-green/30 text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
                className={filterStatus === 'all' 
                  ? 'bg-tms-green text-black' 
                  : 'border-tms-green/50 text-tms-green hover:bg-tms-green/10'
                }
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('completed')}
                className={filterStatus === 'completed' 
                  ? 'bg-tms-green text-black' 
                  : 'border-tms-green/50 text-tms-green hover:bg-tms-green/10'
                }
              >
                Completados
              </Button>
              <Button
                variant={filterStatus === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('pending')}
                className={filterStatus === 'pending' 
                  ? 'bg-tms-green text-black' 
                  : 'border-tms-green/50 text-tms-green hover:bg-tms-green/10'
                }
              >
                Pendientes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Servicios */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white">Historial de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredServices.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No se encontraron servicios</h3>
              <p className="text-gray-400">
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
                  className="border border-gray-700 rounded-lg p-4 hover:border-tms-green/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-tms-green font-medium">{service.folio}</span>
                        {getStatusBadge(service.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-4 h-4" />
                            {formatForDisplay(service.serviceDate)}
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <User className="w-4 h-4" />
                            {service.operatorName}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-300">
                            <MapPin className="w-4 h-4" />
                            {service.origin} → {service.destination}
                          </div>
                          <div className="text-white font-medium">
                            {service.clientName}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-tms-green">
                        ${getServiceDisplayValue(service).toLocaleString()}
                      </div>
                      <div className="text-gray-400 text-sm">
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