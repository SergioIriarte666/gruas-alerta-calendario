import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, 
  Search, 
  Package,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  Bell,
  TrendingUp,
  Loader2
} from 'lucide-react';
import { useActiveAlerts } from '@/hooks/useInventoryAlerts';

export const AlertHistoryView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  
  const { data: activeAlerts = [], isLoading } = useActiveAlerts();

  // Filtrar alertas actuales (simulando historial con datos actuales)
  const filteredAlerts = activeAlerts.filter(item => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || item.severity === severityFilter;
    
    return matchesSearch && matchesType && matchesSeverity;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'low_stock':
        return 'Stock Bajo';
      case 'expiring_soon':
        return 'Próximo a Vencer';
      case 'overstock':
        return 'Sobrestock';
      case 'no_movement':
        return 'Sin Movimiento';
      default:
        return type;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Crítica</Badge>;
      case 'warning':
        return <Badge className="bg-warning text-warning-foreground">Advertencia</Badge>;
      case 'info':
        return <Badge variant="outline">Información</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const stats = {
    total: activeAlerts.length,
    critical: activeAlerts.filter(item => item.severity === 'critical').length,
    warning: activeAlerts.filter(item => item.severity === 'warning').length,
    info: activeAlerts.filter(item => item.severity === 'info').length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Actuales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Alertas</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <History className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Críticas</p>
                <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Advertencias</p>
                <p className="text-2xl font-bold text-warning">{stats.warning}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Información</p>
                <p className="text-2xl font-bold text-primary">{stats.info}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Alertas Actuales
          </CardTitle>
          <CardDescription>
            Vista de alertas detectadas en tiempo real
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por producto o mensaje..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="low_stock">Stock Bajo</SelectItem>
                <SelectItem value="expiring_soon">Próximo a Vencer</SelectItem>
                <SelectItem value="overstock">Sobrestock</SelectItem>
                <SelectItem value="no_movement">Sin Movimiento</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las severidades</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="info">Información</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Alertas */}
          <div className="space-y-4">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-8">
                {stats.total === 0 ? (
                  <>
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      ¡Excelente! No hay alertas activas
                    </h3>
                    <p className="text-muted-foreground">
                      Todos los productos están en niveles óptimos
                    </p>
                  </>
                ) : (
                  <>
                    <History className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No se encontraron registros
                    </h3>
                    <p className="text-muted-foreground">
                      Intenta ajustar los filtros para ver más resultados
                    </p>
                  </>
                )}
              </div>
            ) : (
              filteredAlerts.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-muted">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          {getSeverityIcon(item.severity)}
                          <h4 className="font-semibold text-foreground">{item.title}</h4>
                          {getSeverityBadge(item.severity)}
                          <Badge variant="outline">{getTypeLabel(item.type)}</Badge>
                        </div>
                        
                        <p className="text-muted-foreground">{item.message}</p>
                        
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            <span>{item.item_name}</span>
                          </div>
                          
                          {item.location_name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              <span>{item.location_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Detectada recientemente</span>
                          </div>
                        </div>

                        {item.threshold_value && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Valor actual: </span>
                            <span className="font-medium">{item.current_value}</span>
                            <span className="text-muted-foreground"> / Umbral: {item.threshold_value}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};