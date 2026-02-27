import * as React from 'react';
import { useState } from 'react';
import { ScanSearch, AlertTriangle, Wrench, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

interface Inconsistency {
  id: string;
  folio: string;
  type: 'invoiced_no_invoice' | 'closed_no_closure' | 'negative_remaining' | 'overpaid';
  description: string;
  currentStatus?: string;
  amount?: number;
}

export const BulkStatusRepairTool = () => {
  const [scanning, setScanning] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [issues, setIssues] = useState<Inconsistency[]>([]);
  const [scanned, setScanned] = useState(false);
  const [repairLog, setRepairLog] = useState<string[]>([]);

  const runScan = async () => {
    setScanning(true);
    setIssues([]);
    setRepairLog([]);
    const found: Inconsistency[] = [];

    try {
      // 1. Services marked as "invoiced" without any invoice link
      // Services can be linked via invoice_services OR via closure_services→invoice_closures
      const { data: invoicedServices } = await supabase
        .from('services')
        .select('id, folio, status')
        .eq('status', 'invoiced');

      if (invoicedServices && invoicedServices.length > 0) {
        const svcIds = invoicedServices.map(s => s.id);

        // Direct links via invoice_services
        const { data: directLinks } = await supabase
          .from('invoice_services')
          .select('service_id')
          .in('service_id', svcIds);
        const directLinkedIds = new Set((directLinks || []).map(r => r.service_id));

        // Indirect links via closure_services → invoice_closures
        const { data: closureLinks } = await supabase
          .from('closure_services')
          .select('service_id, closure_id')
          .in('service_id', svcIds);

        const indirectLinkedIds = new Set<string>();
        if (closureLinks && closureLinks.length > 0) {
          const closureIds = [...new Set(closureLinks.map(c => c.closure_id))];
          const { data: invClosures } = await supabase
            .from('invoice_closures')
            .select('closure_id')
            .in('closure_id', closureIds);
          const invoicedClosureIds = new Set((invClosures || []).map(ic => ic.closure_id));
          for (const cl of closureLinks) {
            if (invoicedClosureIds.has(cl.closure_id)) {
              indirectLinkedIds.add(cl.service_id);
            }
          }
        }

        for (const svc of invoicedServices) {
          if (!directLinkedIds.has(svc.id) && !indirectLinkedIds.has(svc.id)) {
            found.push({
              id: svc.id,
              folio: svc.folio || 'Sin folio',
              type: 'invoiced_no_invoice',
              description: `Servicio marcado como "facturado" sin factura vinculada (ni directa ni vía cierre)`,
              currentStatus: 'invoiced',
            });
          }
        }
      }

      // 2. Invoices with negative remaining_amount
      const { data: negInvoices } = await supabase
        .from('invoices')
        .select('id, folio, total, paid_amount, remaining_amount')
        .lt('remaining_amount', 0);

      for (const inv of negInvoices || []) {
        found.push({
          id: inv.id,
          folio: inv.folio,
          type: 'negative_remaining',
          description: `Factura con saldo negativo (remaining: ${formatCurrency(inv.remaining_amount || 0)})`,
          amount: inv.remaining_amount || 0,
        });
      }

      // 3. Invoices with paid_amount > total
      const { data: overpaidInvoices } = await supabase
        .from('invoices')
        .select('id, folio, total, paid_amount')
        .not('paid_amount', 'is', null);

      for (const inv of overpaidInvoices || []) {
        if ((inv.paid_amount || 0) > inv.total) {
          found.push({
            id: inv.id,
            folio: inv.folio,
            type: 'overpaid',
            description: `Factura sobre-pagada (pagado: ${formatCurrency(inv.paid_amount || 0)}, total: ${formatCurrency(inv.total)})`,
            amount: (inv.paid_amount || 0) - inv.total,
          });
        }
      }

      setIssues(found);
      setScanned(true);
    } catch (e: any) {
      toast.error('Error en escaneo', { description: e.message });
    } finally {
      setScanning(false);
    }
  };

  const repairIssue = async (issue: Inconsistency) => {
    try {
      if (issue.type === 'invoiced_no_invoice') {
        const { error } = await supabase
          .from('services')
          .update({ status: 'with_purchase_order', invoice_folio: null, updated_at: new Date().toISOString() })
          .eq('id', issue.id);
        if (error) throw error;
        return `✅ ${issue.folio}: Estado cambiado a "Con OC"`;
      }

      if (issue.type === 'negative_remaining' || issue.type === 'overpaid') {
        // Recalculate from payment_applications
        const { data: apps } = await supabase
          .from('payment_applications')
          .select('applied_amount')
          .eq('invoice_id', issue.id);
        
        const totalPaid = (apps || []).reduce((sum, a) => sum + (a.applied_amount || 0), 0);
        
        const { data: inv } = await supabase
          .from('invoices')
          .select('total')
          .eq('id', issue.id)
          .single();
        
        if (inv) {
          const remaining = inv.total - totalPaid;
          const { error } = await supabase
            .from('invoices')
            .update({ paid_amount: totalPaid, remaining_amount: remaining, updated_at: new Date().toISOString() })
            .eq('id', issue.id);
          if (error) throw error;
          return `✅ ${issue.folio}: Montos recalculados (pagado: ${formatCurrency(totalPaid)}, restante: ${formatCurrency(remaining)})`;
        }
      }

      return `⚠️ ${issue.folio}: Tipo de problema no reparable automáticamente`;
    } catch (e: any) {
      return `❌ ${issue.folio}: Error - ${e.message}`;
    }
  };

  const repairAll = async () => {
    setRepairing(true);
    const log: string[] = [];
    
    for (const issue of issues) {
      const result = await repairIssue(issue);
      log.push(result);
    }
    
    setRepairLog(log);
    setIssues([]);
    toast.success('Reparación completada', { description: `${log.length} problema(s) procesados` });
    setRepairing(false);
  };

  const repairSingle = async (issue: Inconsistency) => {
    setRepairing(true);
    const result = await repairIssue(issue);
    setRepairLog(prev => [...prev, result]);
    setIssues(prev => prev.filter(i => i.id !== issue.id));
    toast.success('Reparación aplicada');
    setRepairing(false);
  };

  const typeLabels: Record<string, { label: string; color: string }> = {
    invoiced_no_invoice: { label: 'Sin factura', color: 'bg-red-100 text-red-800' },
    closed_no_closure: { label: 'Sin cierre', color: 'bg-amber-100 text-amber-800' },
    negative_remaining: { label: 'Saldo negativo', color: 'bg-red-100 text-red-800' },
    overpaid: { label: 'Sobre-pagada', color: 'bg-amber-100 text-amber-800' },
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ScanSearch className="w-5 h-5 text-amber-600" />
            Reparación Masiva de Estados
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Escanea y repara inconsistencias en servicios y facturas automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runScan} disabled={scanning} className="w-full">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ScanSearch className="w-4 h-4 mr-2" />}
            {scanning ? 'Escaneando...' : 'Ejecutar Escaneo'}
          </Button>

          {scanned && issues.length === 0 && repairLog.length === 0 && (
            <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              No se encontraron inconsistencias. Todo está en orden.
            </div>
          )}

          {issues.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">
                  Problemas encontrados ({issues.length})
                </h4>
                <Button variant="destructive" size="sm" onClick={repairAll} disabled={repairing}>
                  {repairing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wrench className="w-3 h-3 mr-1" />}
                  Reparar todos
                </Button>
              </div>

              <div className="grid gap-2">
                {issues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono text-xs font-medium">{issue.folio}</span>
                      <Badge className={`text-[10px] ${typeLabels[issue.type]?.color}`}>
                        {typeLabels[issue.type]?.label}
                      </Badge>
                      <span className="text-muted-foreground truncate">{issue.description}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => repairSingle(issue)} disabled={repairing}>
                      <Wrench className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {repairLog.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Log de reparaciones</h4>
              <div className="p-3 rounded-md bg-muted/30 border text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
                {repairLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
