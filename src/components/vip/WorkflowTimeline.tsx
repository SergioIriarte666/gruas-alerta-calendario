import { businessClock } from '@/utils/businessClock';
import React from 'react';
import { Service } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShoppingCart, 
  PlayCircle,
  Receipt,
  ArrowRight,
  Timer,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkflowStep {
  status: string;
  label: string;
  icon: React.ElementType;
  color: string;
  expectedDuration?: number; // hours
  actualDuration?: number; // hours
  completedAt?: string;
  isActive: boolean;
  isCompleted: boolean;
  hasWarning?: boolean;
  warningMessage?: string;
}

interface WorkflowTimelineProps {
  service: Service;
  onStepClick?: (step: WorkflowStep) => void;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  service,
  onStepClick
}) => {
  const getWorkflowSteps = (): WorkflowStep[] => {
    const currentStatus = service.status;
    const serviceDate = new Date(service.serviceDate);
    const now = businessClock.now();

    const steps: WorkflowStep[] = [
      {
        status: 'quoted',
        label: 'Cotización Enviada',
        icon: FileText,
        color: 'amber',
        expectedDuration: 24,
        isActive: currentStatus === 'quoted',
        isCompleted: ['purchase_order_pending', 'pending', 'in_progress', 'completed', 'invoiced'].includes(currentStatus),
        completedAt: currentStatus !== 'quoted' ? '2025-08-30T10:00:00Z' : undefined
      },
      {
        status: 'purchase_order_pending',
        label: 'Esperando O.C.',
        icon: ShoppingCart,
        color: 'orange',
        expectedDuration: 48,
        isActive: currentStatus === 'purchase_order_pending',
        isCompleted: ['pending', 'in_progress', 'completed', 'invoiced'].includes(currentStatus),
        completedAt: currentStatus !== 'purchase_order_pending' && currentStatus !== 'quoted' ? '2025-08-30T16:00:00Z' : undefined,
        hasWarning: currentStatus === 'purchase_order_pending' && differenceInHours(now, serviceDate) > 72,
        warningMessage: 'O.C. pendiente por más de 3 días'
      },
      {
        status: 'pending',
        label: 'Servicio Programado',
        icon: Calendar,
        color: 'blue',
        expectedDuration: 2,
        isActive: currentStatus === 'pending',
        isCompleted: ['in_progress', 'completed', 'invoiced'].includes(currentStatus),
        completedAt: ['in_progress', 'completed', 'invoiced'].includes(currentStatus) ? service.serviceDate : undefined
      },
      {
        status: 'in_progress',
        label: 'En Ejecución',
        icon: PlayCircle,
        color: 'purple',
        expectedDuration: 4,
        isActive: currentStatus === 'in_progress',
        isCompleted: ['completed', 'invoiced'].includes(currentStatus),
        completedAt: ['completed', 'invoiced'].includes(currentStatus) ? '2025-08-31T14:00:00Z' : undefined
      },
      {
        status: 'completed',
        label: 'Completado',
        icon: CheckCircle2,
        color: 'green',
        expectedDuration: 1,
        isActive: currentStatus === 'completed',
        isCompleted: currentStatus === 'invoiced',
        completedAt: currentStatus === 'invoiced' ? '2025-08-31T18:00:00Z' : undefined
      },
      {
        status: 'invoiced',
        label: 'Facturado',
        icon: Receipt,
        color: 'gray',
        isActive: currentStatus === 'invoiced',
        isCompleted: currentStatus === 'invoiced',
        completedAt: currentStatus === 'invoiced' ? '2025-08-31T20:00:00Z' : undefined
      }
    ];

    return steps;
  };

  const steps = getWorkflowSteps();
  const currentStepIndex = steps.findIndex(step => step.isActive);
  const totalExpectedDuration = steps.reduce((acc, step) => acc + (step.expectedDuration || 0), 0);

  const getStepColorClasses = (color: string, isActive: boolean, isCompleted: boolean, hasWarning?: boolean) => {
    if (hasWarning) {
      return {
        bg: 'bg-danger/10',
        text: 'text-danger',
        border: 'border-danger/20',
        icon: 'text-danger'
      };
    }

    if (isCompleted) {
      return {
        bg: 'bg-success/10',
        text: 'text-success',
        border: 'border-success/20',
        icon: 'text-success'
      };
    }

    if (isActive) {
      const colorMap = {
        amber: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', icon: 'text-warning' },
        orange: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20', icon: 'text-warning' },
        blue: { bg: 'bg-info/10', text: 'text-info', border: 'border-info/20', icon: 'text-info' },
        purple: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', icon: 'text-primary' },
        green: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20', icon: 'text-success' },
        gray: { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border/70', icon: 'text-muted-foreground' }
      };
      return colorMap[color] || colorMap.gray;
    }

    return {
      bg: 'bg-muted/20',
      text: 'text-muted-foreground',
      border: 'border-border/70',
      icon: 'text-muted-foreground'
    };
  };

  const calculateProgress = () => {
    const completedSteps = steps.filter(step => step.isCompleted).length;
    return (completedSteps / steps.length) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="glass-card border-border/70">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Timer className="size-5 text-primary" />
            Progreso del Workflow - {service.folio}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso del Servicio</span>
              <span className="text-foreground font-medium">{Math.round(calculateProgress())}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${calculateProgress()}%` }}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{currentStepIndex + 1}</p>
              <p className="text-xs text-muted-foreground">Etapa Actual</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{steps.filter(s => s.isCompleted).length}</p>
              <p className="text-xs text-muted-foreground">Completadas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{totalExpectedDuration}h</p>
              <p className="text-xs text-muted-foreground">Duración Est.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const colors = getStepColorClasses(step.color, step.isActive, step.isCompleted, step.hasWarning);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.status} className="relative">
              {/* Connector Line */}
              {!isLast && (
                <div className="absolute left-6 top-12 w-px h-8 bg-border" />
              )}

              <Card 
                className={`glass-card ${colors.border} transition-all duration-200 ${
                  step.isActive ? 'ring-1 ring-primary/20' : ''
                } ${onStepClick ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                onClick={() => onStepClick?.(step)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Step Icon */}
                    <div className={`flex-shrink-0 p-3 rounded-lg ${colors.bg}`}>
                      <StepIcon className={`size-5 ${colors.icon}`} />
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 gap-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className={`font-medium ${colors.text}`}>
                          {step.label}
                          {step.isActive && (
                            <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/30">
                              Actual
                            </Badge>
                          )}
                          {step.hasWarning && (
                            <Badge variant="outline" className="ml-2 bg-danger/10 text-danger border-danger/20">
                              <AlertTriangle className="size-3 mr-1" />
                              Atención
                            </Badge>
                          )}
                        </h4>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {step.expectedDuration && (
                            <span>{step.expectedDuration}h esperado</span>
                          )}
                          {step.completedAt && (
                            <span>
                              {formatDistanceToNow(new Date(step.completedAt), { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Warning Message */}
                      {step.hasWarning && step.warningMessage && (
                        <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 p-2 rounded">
                          <AlertTriangle className="size-4" />
                          <span>{step.warningMessage}</span>
                        </div>
                      )}

                      {/* Step Details */}
                      <div className="text-sm text-muted-foreground">
                        {step.status === 'purchase_order_pending' && service.purchaseOrderNumber && (
                          <span>O.C: {service.purchaseOrderNumber}</span>
                        )}
                        {step.completedAt && (
                          <span>
                            Completado: {format(new Date(step.completedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Next Arrow */}
                    {!isLast && step.isCompleted && (
                      <ArrowRight className="size-4 text-muted-foreground mt-3" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Service Purchase Order Info */}
      {service.purchaseOrderNumber && (
        <Card className="glass-card border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingCart className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Orden de Compra Registrada
                </p>
                <p className="text-xs text-muted-foreground">
                  {service.purchaseOrderNumber}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
