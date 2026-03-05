import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toTitleCase } from '@/lib/utils';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  DollarSign,
  Calendar,
  User,
  Truck,
  Package,
  X,
  Check
} from 'lucide-react';
import { Service } from '@/types';

interface ServiceIssue {
  type: 'warning' | 'error';
  message: string;
  field: string;
}

interface ServiceWithIssues extends Service {
  issues: ServiceIssue[];
  canInclude: boolean;
}

interface ServiceReviewPanelProps {
  clientName: string;
  services: ServiceWithIssues[];
  totalAmount: number;
  onBack: () => void;
  onCreateClosure: (selectedServices: ServiceWithIssues[]) => void;
  onCompleteService: (serviceId: string) => void;
}

const ServiceReviewPanel = ({
  clientName,
  services,
  totalAmount,
  onBack,
  onCreateClosure,
  onCompleteService
}: ServiceReviewPanelProps) => {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(services.filter(s => s.canInclude).map(s => s.id))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-CL').format(new Date(dateString));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'Completado', variant: 'default' as const, color: 'bg-green-500/10 text-green-700' },
      with_purchase_order: { label: 'Con O.C.', variant: 'secondary' as const, color: 'bg-blue-500/10 text-blue-700' },
      pending: { label: 'Pendiente', variant: 'outline' as const, color: 'bg-yellow-500/10 text-yellow-700' },
      failed: { label: 'Fallido', variant: 'destructive' as const, color: 'bg-red-500/10 text-red-700' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getIssueSeverity = (issues: ServiceIssue[]) => {
    return issues.some(i => i.type === 'error') ? 'error' : 'warning';
  };

  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const selectedServicesData = services.filter(s => selectedServices.has(s.id));
  const selectedTotal = selectedServicesData.reduce((sum, s) => sum + s.value, 0);

  const canCreateClosure = selectedServices.size > 0 && 
    selectedServicesData.every(s => s.canInclude);

  return (
    <Card className="bg-background border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl text-foreground">
              Revisar Servicios - {toTitleCase(clientName)}
            </CardTitle>
          </div>
          <Badge variant="outline" className="bg-muted">
            {services.length} servicio(s)
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Revisa y selecciona los servicios para incluir en el cierre
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-muted-foreground">Seleccionados:</span>
            <span className="font-medium text-foreground">{selectedServices.size}</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="font-medium text-foreground">{formatCurrency(selectedTotal)}</span>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => onCreateClosure(selectedServicesData)}
              disabled={!canCreateClosure}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              Crear Cierre ({selectedServices.size})
            </Button>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          {services.map((service) => {
            const severity = getIssueSeverity(service.issues);
            const isSelected = selectedServices.has(service.id);
            
            return (
              <Card 
                key={service.id} 
                className={`border-2 transition-all ${
                  severity === 'error' 
                    ? 'border-red-200 bg-red-50/30' 
                    : service.issues.length > 0
                    ? 'border-yellow-200 bg-yellow-50/30'
                    : 'border-green-200 bg-green-50/30'
                } ${isSelected ? 'ring-2 ring-primary/20' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleService(service.id)}
                      disabled={!service.canInclude}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-foreground">
                            {service.folio}
                          </h4>
                          {getStatusBadge(service.status)}
                          {service.issues.length === 0 && (
                            <Badge className="bg-green-500/10 text-green-700">
                              <Check className="h-3 w-3 mr-1" />
                              Sin problemas
                            </Badge>
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {formatCurrency(service.value)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Fecha:</span>
                          <span className="text-foreground">{formatDate(service.serviceDate)}</span>
                        </div>
                        
                        {service.operator && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Operador:</span>
                            <span className="text-foreground">{service.operator.name}</span>
                          </div>
                        )}
                        
                        {service.crane && (
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Grúa:</span>
                            <span className="text-foreground">{service.crane.licensePlate}</span>
                          </div>
                        )}
                        
                        {service.purchaseOrderNumber && (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">O.C.:</span>
                            <span className="text-foreground">{service.purchaseOrderNumber}</span>
                          </div>
                        )}
                      </div>

                      {service.issues.length > 0 && (
                        <div className={`p-3 rounded-md border ${
                          severity === 'error' 
                            ? 'bg-red-50/50 border-red-200' 
                            : 'bg-yellow-50/50 border-yellow-200'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {severity === 'error' ? (
                              <X className="h-4 w-4 text-red-600" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className={`text-sm font-medium ${
                              severity === 'error' ? 'text-red-800' : 'text-yellow-800'
                            }`}>
                              {severity === 'error' ? 'Errores encontrados:' : 'Advertencias:'}
                            </span>
                          </div>
                          <ul className={`text-xs space-y-1 ${
                            severity === 'error' ? 'text-red-700' : 'text-yellow-700'
                          }`}>
                            {service.issues.map((issue, index) => (
                              <li key={index}>• {issue.message}</li>
                            ))}
                          </ul>
                          
                          {service.status === 'pending' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onCompleteService(service.id)}
                              className="mt-2"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Marcar como completado
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceReviewPanel;