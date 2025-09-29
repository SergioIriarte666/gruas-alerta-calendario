import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  DollarSign,
  Calendar,
  ArrowRight,
  Eye
} from 'lucide-react';
import { Client, Service } from '@/types';

interface ClientClosureData {
  client: Client;
  services: Service[];
  completedServices: number;
  pendingServices: number;
  totalAmount: number;
  hasIssues: boolean;
  issues: string[];
}

interface ClientClosureDashboardProps {
  selectedMonth: Date;
  clientsData: ClientClosureData[];
  loading: boolean;
  onReviewClient: (clientData: ClientClosureData) => void;
  onCreateClosure: (clientData: ClientClosureData) => void;
}

const ClientClosureDashboard = ({
  selectedMonth,
  clientsData,
  loading,
  onReviewClient,
  onCreateClosure
}: ClientClosureDashboardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const formatMonth = (date: Date) => {
    return new Intl.DateTimeFormat('es-CL', {
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <Card className="bg-background border-border">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Cargando información de clientes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl text-foreground">
              Dashboard de Clientes - {formatMonth(selectedMonth)}
            </CardTitle>
          </div>
          <Badge variant="outline" className="bg-muted">
            {clientsData.length} cliente(s)
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Revisa el estado de servicios por cliente y procede con la automatización
        </p>
      </CardHeader>
      <CardContent>
        {clientsData.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No hay servicios para el período seleccionado</p>
            <p className="text-sm text-muted-foreground">
              Selecciona un mes diferente o verifica que existan servicios completados
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {clientsData.map((clientData) => (
              <Card 
                key={clientData.client.id} 
                className={`border-2 transition-all hover:shadow-md ${
                  clientData.hasIssues 
                    ? 'border-yellow-500/30 bg-yellow-50/30' 
                    : 'border-green-500/30 bg-green-50/30'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-foreground">
                          {clientData.client.name}
                        </h3>
                        {clientData.client.department && (
                          <Badge variant="outline" className="text-xs">
                            {clientData.client.department}
                          </Badge>
                        )}
                        <Badge 
                          variant={clientData.hasIssues ? "destructive" : "default"}
                          className="text-xs"
                        >
                          {clientData.hasIssues ? (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Requiere atención
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Listo para cierre
                            </>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Servicios:</span>
                          <span className="font-medium text-foreground">
                            {clientData.services.length}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-muted-foreground">Completados:</span>
                          <span className="font-medium text-foreground">
                            {clientData.completedServices}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-muted-foreground">Pendientes:</span>
                          <span className="font-medium text-foreground">
                            {clientData.pendingServices}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(clientData.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {clientData.hasIssues && (
                        <div className="mt-3 p-2 bg-yellow-50/50 border border-yellow-200/50 rounded-md">
                          <p className="text-sm font-medium text-yellow-800 mb-1">
                            Problemas detectados:
                          </p>
                          <ul className="text-xs text-yellow-700 space-y-1">
                            {clientData.issues.map((issue, index) => (
                              <li key={index}>• {issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onReviewClient(clientData)}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        Revisar
                      </Button>
                      
                      {!clientData.hasIssues && clientData.completedServices > 0 && (
                        <Button
                          size="sm"
                          onClick={() => onCreateClosure(clientData)}
                          className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                        >
                          <ArrowRight className="h-4 w-4" />
                          Crear Cierre
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientClosureDashboard;