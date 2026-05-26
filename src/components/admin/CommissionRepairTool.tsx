import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Loader2, ScanSearch, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Herramienta de auditoría y reparación del sistema de comisiones.
 * Migrada desde el antiguo módulo de respaldos. Pertenece al panel
 * de emergencia de administración.
 */
export const CommissionRepairTool = () => {
  const [auditing, setAuditing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [confirmRepairOpen, setConfirmRepairOpen] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [repairData, setRepairData] = useState<any>(null);

  const auditCommissionSystem = async () => {
    try {
      setAuditing(true);
      const { data, error } = await supabase.rpc('audit_commission_system');
      if (error) throw error;
      setAuditData(data);
      toast.success('Auditoría completada');
    } catch (error: any) {
      console.error('Error in audit:', error);
      toast.error(error.message || 'Error al ejecutar auditoría');
    } finally {
      setAuditing(false);
    }
  };

  const repairCommissionSystem = async () => {
    try {
      setRepairing(true);
      const { data, error } = await supabase.rpc('repair_commission_system');
      if (error) throw error;
      const info = data as any;
      setRepairData(info);
      toast.success(`Sistema reparado: ${info.commissions_created} comisiones creadas, ${info.services_synced} servicios sincronizados`);
      await auditCommissionSystem();
    } catch (error: any) {
      console.error('Error in repair:', error);
      toast.error(error.message || 'Error al reparar sistema');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Card className="bg-card border">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Wrench className="size-5 text-primary" />
          Reparación del Sistema de Comisiones
        </CardTitle>
        <CardDescription>
          Audita y repara comisiones faltantes, servicios sin operador asignado y comisiones huérfanas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <Alert className="border-info/30 bg-info-soft">
          <AlertTriangle className="size-4 text-info" />
          <AlertDescription className="text-sm">
            <strong>Importante:</strong> antes de reparar, genera un respaldo desde
            {' '}<em>Configuración → Sistema → Gestión de Respaldos</em>.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button onClick={auditCommissionSystem} disabled={auditing} variant="outline">
            {auditing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <ScanSearch className="size-4 mr-2" />}
            Auditar Sistema
          </Button>
          <Button onClick={() => setConfirmRepairOpen(true)} disabled={repairing} variant="destructive">
            {repairing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <CheckCircle className="size-4 mr-2" />}
            Reparar Sistema
          </Button>
        </div>

        {auditData && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-foreground">Resultado de Auditoría</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium">Servicios</div>
                <div>Total: {auditData.services.total}</div>
                <div>Completados: {auditData.services.completed}</div>
                <div>Con Operador: {auditData.services.with_operator_id}</div>
                <div>Con Recursos: {auditData.services.with_resources}</div>
              </div>
              <div>
                <div className="font-medium">Comisiones</div>
                <div>Total: {auditData.commissions.total}</div>
                <div>Pendientes: {auditData.commissions.pending}</div>
                <div>Pagadas: {auditData.commissions.paid}</div>
                <div className="text-destructive">Faltantes: {auditData.commissions.missing}</div>
              </div>
              <div>
                <div className="font-medium">Problemas</div>
                <div className="text-amber-600">Sin Operador: {auditData.issues.services_without_operator_id}</div>
                <div className="text-destructive">Huérfanas: {auditData.commissions.orphaned}</div>
              </div>
              <div>
                <div className="font-medium">Estado</div>
                <Badge variant={auditData.commissions.missing > 0 ? 'destructive' : 'default'}
                       className={auditData.commissions.missing > 0 ? '' : 'bg-primary'}>
                  {auditData.commissions.missing > 0 ? 'Requiere Reparación' : 'Correcto'}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {repairData && (
          <Alert className="border-primary/30 bg-primary-soft">
            <CheckCircle className="size-4 text-primary" />
            <AlertDescription className="text-sm">
              <div className="font-medium mb-1">Reparación Completada</div>
              <ul className="space-y-0.5">
                <li>• {repairData.services_synced} servicios sincronizados</li>
                <li>• {repairData.commissions_created} comisiones creadas</li>
                <li>• Trigger actualizado: {repairData.trigger_updated ? 'Sí' : 'No'}</li>
                <li>• Total reparado: {repairData.total_repaired} elementos</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <AlertDialog open={confirmRepairOpen} onOpenChange={setConfirmRepairOpen}>
        <AlertDialogContent className="border-border/70 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-warning" />
              Confirmar reparación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta operación reparará el sistema de comisiones. Verifica que ya generaste un
              respaldo desde Configuración antes de continuar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={repairCommissionSystem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar reparación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
