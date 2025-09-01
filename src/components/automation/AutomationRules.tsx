import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Bell, 
  Clock, 
  RefreshCw, 
  Plus,
  Zap,
  Mail,
  AlertTriangle,
  FileText,
  Timer
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: {
    type: 'state_change' | 'time_based' | 'condition';
    value: string;
    delay?: number;
  };
  action: {
    type: 'notification' | 'email' | 'escalation' | 'report';
    config: any;
  };
  icon: any;
}

const TRIGGER_TYPES = [
  { value: 'state_change', label: 'Cambio de Estado', icon: RefreshCw },
  { value: 'time_based', label: 'Basado en Tiempo', icon: Timer },
  { value: 'condition', label: 'Condición Específica', icon: AlertTriangle }
];

const ACTION_TYPES = [
  { value: 'notification', label: 'Enviar Notificación', icon: Bell },
  { value: 'email', label: 'Enviar Email', icon: Mail },
  { value: 'escalation', label: 'Escalar Notificación', icon: AlertTriangle },
  { value: 'report', label: 'Enviar Reporte', icon: FileText }
];

const defaultRules: AutomationRule[] = [
  {
    id: '1',
    name: 'Auto-notificar OC pendiente',
    description: 'Notifica cuando una cotización cambia a estado pendiente de OC',
    isActive: true,
    trigger: {
      type: 'state_change',
      value: 'quoted → purchase_order_pending',
      delay: 2
    },
    action: {
      type: 'notification',
      config: {
        title: 'OC Pendiente',
        message: 'Se requiere orden de compra para continuar con el servicio'
      }
    },
    icon: Bell
  },
  {
    id: '2',
    name: 'Escalamiento OC demorada',
    description: 'Escala notificación cuando una OC está pendiente por mucho tiempo',
    isActive: true,
    trigger: {
      type: 'time_based',
      value: 'purchase_order_pending por 3 días'
    },
    action: {
      type: 'escalation',
      config: {
        escalateTo: 'supervisor',
        priority: 'high'
      }
    },
    icon: AlertTriangle
  },
  {
    id: '3',
    name: 'Confirmación servicio completado',
    description: 'Envía reporte automático cuando un servicio se completa',
    isActive: false,
    trigger: {
      type: 'state_change',
      value: 'in_progress → completed'
    },
    action: {
      type: 'report',
      config: {
        template: 'service_completion',
        recipients: ['client', 'operator']
      }
    },
    icon: FileText
  }
];

export const AutomationRules = () => {
  const [rules, setRules] = useState<AutomationRule[]>(defaultRules);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isNewRuleDialogOpen, setIsNewRuleDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const activeRules = rules.filter(r => r.isActive);
  const temporalRules = rules.filter(r => r.trigger.type === 'time_based');
  const notificationRules = rules.filter(r => r.action.type === 'notification' || r.action.type === 'escalation');

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    ));
  };

  const createNewRule = () => {
    const newRule: AutomationRule = {
      id: Date.now().toString(),
      name: 'Nueva Regla',
      description: 'Describe qué hace esta regla',
      isActive: false,
      trigger: {
        type: 'state_change',
        value: 'pending → in_progress'
      },
      action: {
        type: 'notification',
        config: {
          title: 'Nueva Notificación',
          message: 'Mensaje de la notificación'
        }
      },
      icon: Bell
    };
    setEditingRule(newRule);
    setIsEditDialogOpen(true);
  };

  const saveRule = (rule: AutomationRule) => {
    if (rules.find(r => r.id === rule.id)) {
      // Update existing rule
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    } else {
      // Add new rule
      setRules(prev => [...prev, rule]);
    }
    setIsEditDialogOpen(false);
    setEditingRule(null);
  };

  const deleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const RuleCard = ({ rule }: { rule: AutomationRule }) => {
    const Icon = rule.icon;
    
    return (
      <Card className="border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{rule.name}</h3>
                <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                  {rule.isActive ? 'Activa' : 'Inactiva'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditingRule(rule);
                  setIsEditDialogOpen(true);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Switch 
                checked={rule.isActive}
                onCheckedChange={() => toggleRule(rule.id)}
              />
            </div>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="font-medium">Trigger:</span>
              <Badge variant="outline" className="text-xs">
                {TRIGGER_TYPES.find(t => t.value === rule.trigger.type)?.label}
              </Badge>
              <span>{rule.trigger.value}</span>
              {rule.trigger.delay && (
                <span className="text-xs">(después de {rule.trigger.delay}h)</span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Acción:</span>
              <Badge variant="outline" className="text-xs">
                {ACTION_TYPES.find(a => a.value === rule.action.type)?.label}
              </Badge>
            </div>

            <p className="text-xs">{rule.description}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const RuleConfigForm = ({ rule, onSave, onDelete }: { 
    rule: AutomationRule; 
    onSave: (rule: AutomationRule) => void;
    onDelete?: (ruleId: string) => void;
  }) => {
    const [formData, setFormData] = useState(rule);

    const handleSave = () => {
      onSave(formData);
    };

    const handleDelete = () => {
      if (onDelete && rule.id) {
        onDelete(rule.id);
        setIsEditDialogOpen(false);
        setEditingRule(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ruleName">Nombre de la Regla</Label>
            <Input
              id="ruleName"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Estado</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch 
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
              <span className="text-sm text-muted-foreground">
                {formData.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Trigger</Label>
            <Select 
              value={formData.trigger.type}
              onValueChange={(value: any) => setFormData(prev => ({
                ...prev,
                trigger: { ...prev.trigger, type: value }
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo de Acción</Label>
            <Select 
              value={formData.action.type}
              onValueChange={(value: any) => setFormData(prev => ({
                ...prev,
                action: { ...prev.action, type: value }
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="triggerValue">Condición del Trigger</Label>
          <Input
            id="triggerValue"
            value={formData.trigger.value}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              trigger: { ...prev.trigger, value: e.target.value }
            }))}
            placeholder="ej: quoted → purchase_order_pending"
          />
        </div>

        {formData.trigger.type === 'time_based' && (
          <div>
            <Label htmlFor="delay">Retraso (horas)</Label>
            <Input
              id="delay"
              type="number"
              value={formData.trigger.delay || 0}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                trigger: { ...prev.trigger, delay: parseInt(e.target.value) }
              }))}
            />
          </div>
        )}

        <div className="flex justify-between pt-4">
          <div>
            {onDelete && rule.id && rules.find(r => r.id === rule.id) && (
              <Button variant="destructive" onClick={handleDelete}>
                Eliminar Regla
              </Button>
            )}  
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingRule(null);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {rule.id && rules.find(r => r.id === rule.id) ? 'Guardar Cambios' : 'Crear Regla'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reglas de Automatización</h1>
            <p className="text-muted-foreground">Configura automatizaciones personalizadas para Amphos 21</p>
          </div>
        </div>
        <Button onClick={createNewRule} className="gap-2">
          <Zap className="h-4 w-4" />
          Nueva Regla
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <RefreshCw className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeRules.length}</p>
                <p className="text-sm text-muted-foreground">Reglas Activas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{temporalRules.length}</p>
                <p className="text-sm text-muted-foreground">Temporales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Bell className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{notificationRules.length}</p>
                <p className="text-sm text-muted-foreground">Notificaciones</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.map(rule => (
          <RuleCard key={rule.id} rule={rule} />
        ))}
      </div>

      {/* Edit Rule Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule && rules.find(r => r.id === editingRule.id) 
                ? `Configurar Regla: ${editingRule.name}` 
                : 'Nueva Regla de Automatización'
              }
            </DialogTitle>
          </DialogHeader>
          {editingRule && (
            <RuleConfigForm 
              rule={editingRule} 
              onSave={saveRule}
              onDelete={deleteRule}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};