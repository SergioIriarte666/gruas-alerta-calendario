
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PendingCategoryCard } from './PendingCategoryCard';
import { usePendingSummary } from '@/hooks/usePendingSummary';
import { 
  FileWarning, 
  Clock, 
  AlertTriangle, 
  Shield,
  Bell,
  CalendarClock
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { toTitleCase } from '@/lib/utils';
import { businessClock } from '@/utils/businessClock';

const SESSION_KEY = 'pending_summary_dismissed';

const getDismissKey = () => `${SESSION_KEY}_${businessClock.today()}`;

export const PendingSummaryModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(false);
  const { data, isLoading } = usePendingSummary();

  useEffect(() => {
    if (isLoading || !data) return;
    
    const dismissed = sessionStorage.getItem(SESSION_KEY) === 'true' 
      || localStorage.getItem(getDismissKey()) === 'true';
    
    if (!dismissed && data.hasCriticalItems) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, data]);

  const handleClose = () => {
    sessionStorage.setItem(SESSION_KEY, 'true');
    if (dontShowToday) {
      localStorage.setItem(getDismissKey(), 'true');
    }
    setOpen(false);
  };

  if (!data) return null;

  const { servicesWithoutOC, pendingClosures, overdueInvoices, expiringDocuments, upcomingServices } = data;

  const criticalDocs = expiringDocuments.filter(d => d.daysUntil <= 7);
  const warningDocs = expiringDocuments.filter(d => d.daysUntil > 7);
  const urgentUpcoming = upcomingServices.filter(s => s.daysUntil <= 3).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold text-foreground">
              <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Bell className="size-5 text-violet-600" />
              </div>
              Resumen de Pendientes
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Tienes elementos que requieren tu atención
            </p>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 gap-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : (
              <>
                <PendingCategoryCard
                  icon={FileWarning}
                  title="Servicios sin O.C."
                  count={servicesWithoutOC.length}
                  description={servicesWithoutOC.length > 0 
                    ? "Servicios completados sin orden de compra registrada" 
                    : "Todos los servicios tienen O.C. — ¡Todo al día!"}
                  severity={servicesWithoutOC.length > 10 ? 'error' : servicesWithoutOC.length > 0 ? 'warning' : 'success'}
                  linkTo="/services"
                  details={servicesWithoutOC.map(s => ({
                    id: s.id,
                    label: s.folio,
                    sublabel: toTitleCase(s.clientName),
                    extra: `${s.daysSince}d`,
                  }))}
                  onNavigate={handleClose}
                />

                <PendingCategoryCard
                  icon={Clock}
                  title="Pendientes de Cierre"
                  count={pendingClosures.length}
                  description={pendingClosures.length > 0 
                    ? "Completados hace +30 días sin incluir en cierre" 
                    : "Sin servicios pendientes de cierre"}
                  severity={pendingClosures.length > 5 ? 'error' : pendingClosures.length > 0 ? 'warning' : 'success'}
                  linkTo="/closures"
                  details={pendingClosures.map(s => ({
                    id: s.id,
                    label: s.folio,
                    sublabel: toTitleCase(s.clientName),
                    extra: `${s.daysSince}d`,
                  }))}
                  onNavigate={handleClose}
                />

                <PendingCategoryCard
                  icon={AlertTriangle}
                  title="Facturas Vencidas"
                  count={overdueInvoices.length}
                  description={overdueInvoices.length > 0 
                    ? "Facturas que ya pasaron su fecha de vencimiento" 
                    : "Sin facturas vencidas — ¡Todo al día!"}
                  severity={overdueInvoices.length > 0 ? 'error' : 'success'}
                  linkTo="/invoices?status=overdue"
                  details={overdueInvoices.map(inv => ({
                    id: inv.id,
                    label: inv.folio,
                    sublabel: toTitleCase(inv.clientName),
                    extra: `${inv.daysOverdue}d vencida`,
                  }))}
                  onNavigate={handleClose}
                />

                <PendingCategoryCard
                  icon={Shield}
                  title="Documentos por Vencer"
                  count={expiringDocuments.length}
                  description={expiringDocuments.length > 0 
                    ? `${criticalDocs.length > 0 ? `${criticalDocs.length} críticos, ` : ''}${warningDocs.length} por vencer` 
                    : "Todos los documentos vigentes"}
                  severity={criticalDocs.length > 0 ? 'error' : expiringDocuments.length > 0 ? 'warning' : 'success'}
                  linkTo="/cranes"
                  details={expiringDocuments.map(d => ({
                    id: `${d.entityType}-${d.id}-${d.documentType}`,
                    label: toTitleCase(d.entityName),
                    sublabel: d.documentType,
                    extra: d.daysUntil <= 0 ? 'Vencido' : `${d.daysUntil}d`,
                  }))}
                  onNavigate={handleClose}
                />

                <PendingCategoryCard
                  icon={CalendarClock}
                  title="Próximos Servicios"
                  count={upcomingServices.length}
                  description={upcomingServices.length > 0
                    ? `${urgentUpcoming > 0 ? `${urgentUpcoming} en ≤3 días, ` : ''}${upcomingServices.length} programados`
                    : "Sin servicios programados próximamente"}
                  severity={urgentUpcoming > 0 ? 'warning' : 'success'}
                  linkTo="/calendar"
                  details={upcomingServices.map(s => ({
                    id: s.id,
                    label: s.folio,
                    sublabel: toTitleCase(s.clientName),
                    extra: s.daysUntil === 0 ? 'Hoy' : s.daysUntil === 1 ? 'Mañana' : `en ${s.daysUntil}d`,
                  }))}
                  onNavigate={handleClose}
                />
              </>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-3 border-t bg-muted/30 flex-row items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={dontShowToday}
                onCheckedChange={(v) => setDontShowToday(!!v)}
              />
              <span className="text-xs text-muted-foreground">No mostrar de nuevo hoy</span>
            </label>
            <Button onClick={handleClose} className="bg-violet-600 hover:bg-violet-700 text-white">
              Entendido
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
