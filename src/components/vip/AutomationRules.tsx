import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Bell, 
  Clock, 
  Zap, 
  Mail, 
  MessageCircle, 
  CheckCircle2,
  AlertTriangle,
  Timer,
  Workflow
} from 'lucide-react';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  isActive: boolean;
  conditions: Record<string, any>;
  clientId?: string;
}

interface AutomationRulesProps {
  clientId: string;
  clientName: string;
}

export const AutomationRules: React.FC<AutomationRulesProps> = ({
  clientId,
  clientName
}) => {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Auto-notificar OC pendiente',
      trigger: 'service_status_change',
      action: 'send_notification',
      isActive: true,
      conditions: {
        fromStatus: 'quoted',
        toStatus: 'purchase_order_pending',
        notifyAfterHours: 2
      }
    },
    {
      id: '2',
      name: 'Escalamiento OC demorada',
      trigger: 'time_based',
      action: 'escalate_notification',
      isActive: true,
      conditions: {
        status: 'purchase_order_pending',
        waitingDays: 3,
        escalateTo: 'manager'
      }
    },
    {
      id: '3',
      name: 'Confirmación servicio completado',
      trigger: 'service_status_change',
      action: 'send_completion_report',
      isActive: false,
      conditions: {
        fromStatus: 'in_progress',
        toStatus: 'completed',
        includePhotos: true
      }
    }
  ]);

  const [showNewRuleForm, setShowNewRuleForm] = useState(false);

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId 
        ? { ...rule, isActive: !rule.isActive }
        : rule
    ));
    
    const rule = rules.find(r => r.id === ruleId);
    toast.success(`Regla "${rule?.name}" ${rule?.isActive ? 'desactivada' : 'activada'}`);
  };

  const getRuleIcon = (trigger: string) => {
    switch (trigger) {
      case 'service_status_change': return <Workflow className="w-4 h-4" />;
      case 'time_based': return <Timer className="w-4 h-4" />;
      case 'manual': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'send_notification': return <Bell className="w-4 h-4" />;
      case 'send_email': return <Mail className="w-4 h-4" />;
      case 'escalate_notification': return <AlertTriangle className="w-4 h-4" />;
      case 'send_completion_report': return <MessageCircle className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    const labels = {
      'service_status_change': 'Cambio de Estado',
      'time_based': 'Basado en Tiempo',
      'manual': 'Manual',
      'client_request': 'Solicitud Cliente'
    };
    return labels[trigger] || trigger;
  };

  const getActionLabel = (action: string) => {
    const labels = {
      'send_notification': 'Enviar Notificación',
      'send_email': 'Enviar Email',
      'escalate_notification': 'Escalar Notificación',
      'send_completion_report': 'Enviar Reporte',
      'auto_transition': 'Transición Automática'
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            Reglas de Automatización
          </h3>
          <p className="text-sm text-gray-400">
            Configura automatizaciones personalizadas para {clientName}
          </p>
        </div>
        
        <Button
          onClick={() => setShowNewRuleForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Zap className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {rules.filter(r => r.isActive).length}
                </p>
                <p className="text-xs text-green-400">Reglas Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {rules.filter(r => r.trigger === 'time_based').length}
                </p>
                <p className="text-xs text-amber-400">Temporales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Bell className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {rules.filter(r => r.action.includes('notification')).length}
                </p>
                <p className="text-xs text-blue-400">Notificaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getRuleIcon(rule.trigger)}
                      <span className="font-medium text-white">{rule.name}</span>
                    </div>
                    
                    <Badge 
                      variant={rule.isActive ? "default" : "secondary"}
                      className={rule.isActive ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400"}
                    >
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-300">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Trigger:</span>
                      <Badge variant="outline" className="text-xs">
                        {getTriggerLabel(rule.trigger)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Acción:</span>
                      <div className="flex items-center gap-1">
                        {getActionIcon(rule.action)}
                        <span>{getActionLabel(rule.action)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rule Conditions Preview */}
                  <div className="text-xs text-gray-400">
                    {rule.trigger === 'service_status_change' && (
                      <span>
                        Cuando: {rule.conditions.fromStatus} → {rule.conditions.toStatus}
                        {rule.conditions.notifyAfterHours && ` (después de ${rule.conditions.notifyAfterHours}h)`}
                      </span>
                    )}
                    {rule.trigger === 'time_based' && (
                      <span>
                        Estado: {rule.conditions.status} por {rule.conditions.waitingDays} días
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  <Button variant="ghost" size="sm">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Metrics */}
      <Card className="glass-card border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Rendimiento de Automatizaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">142</p>
              <p className="text-xs text-gray-400">Ejecutadas Hoy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">98.5%</p>
              <p className="text-xs text-gray-400">Tasa de Éxito</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">2.3s</p>
              <p className="text-xs text-gray-400">Tiempo Promedio</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-400">5</p>
              <p className="text-xs text-gray-400">Errores (24h)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};