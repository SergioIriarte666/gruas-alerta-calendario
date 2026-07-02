import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Service, ClosureStatus } from '@/types';
import { useClients } from '@/hooks/useClients';
import { useClosureOperations } from '@/hooks/closures/useClosureOperations';
import { EXCESS_ROW_SUFFIX } from '@/hooks/useServicesForClosures';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { detectPurchaseOrders } from '@/utils/closureUtils';
import { safeParseDateOnly, toLocalDateString, formatForDisplay } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { toTitleCase } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('CreateClosureFromPipelineModal');

const formSchema = z.object({
  dateFrom: z.string().min(1, 'Fecha de inicio es requerida'),
  dateTo: z.string().min(1, 'Fecha de fin es requerida'),
  purchaseOrder: z.string().optional(),
  status: z.enum(['open', 'closed', 'invoiced', 'quoted', 'purchase_order_pending'] as const),
});

type FormValues = z.infer<typeof formSchema>;

interface AnalyzedRow {
  service: Service;
  valueType: 'covered' | 'excess';
  billingClientId: string;
  amount: number;
  usedInFolio?: string;
  disputeReason?: string;
}

interface CreateClosureFromPipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  clientId: string;
  onCreated: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

export const CreateClosureFromPipelineModal = ({
  open,
  onOpenChange,
  services,
  clientId,
  onCreated,
}: CreateClosureFromPipelineModalProps) => {
  const { clients = [] } = useClients();
  const { createClosure } = useClosureOperations();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [usedMap, setUsedMap] = useState<Map<string, string>>(new Map());
  const [disputedMap, setDisputedMap] = useState<Map<string, string>>(new Map());
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { dateFrom: '', dateTo: '', purchaseOrder: '', status: 'open' },
  });

  // Detectar servicios ya incluidos en otro cierre (mismo service_id + value_type)
  // y servicios con una disputa abierta — ambos se excluyen de los elegibles.
  useEffect(() => {
    if (!open || services.length === 0) {
      setUsedMap(new Map());
      setDisputedMap(new Map());
      return;
    }

    let cancelled = false;
    setLoadingUsage(true);
    setUsedMap(new Map());
    setDisputedMap(new Map());

    (async () => {
      const ids = services.map(s => s.id);
      const [usageResult, disputesResult] = await Promise.all([
        supabase
          .from('closure_services')
          .select('service_id, value_type, service_closures!closure_services_closure_id_fkey(folio)')
          .in('service_id', ids),
        supabase
          .from('service_disputes')
          .select('service_id, description')
          .eq('status', 'open')
          .in('service_id', ids),
      ]);

      if (cancelled) return;

      if (usageResult.error) {
        logger.error('Error checking service closure usage:', usageResult.error);
        setUsedMap(new Map());
      } else {
        const map = new Map<string, string>();
        (usageResult.data || []).forEach((row: any) => {
          const folio = row.service_closures?.folio;
          if (folio) {
            map.set(`${row.service_id}:${row.value_type || 'covered'}`, folio);
          }
        });
        setUsedMap(map);
      }

      if (disputesResult.error) {
        logger.error('Error checking open disputes:', disputesResult.error);
        setDisputedMap(new Map());
      } else {
        const map = new Map<string, string>();
        (disputesResult.data || []).forEach((row: any) => {
          map.set(row.service_id, row.description);
        });
        setDisputedMap(map);
      }

      setLoadingUsage(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, services]);

  const analyzedRows: AnalyzedRow[] = useMemo(() => {
    return services.map(service => {
      const isExcess = service.thirdPartyClientId === clientId && service.client?.id !== clientId;
      const valueType: 'covered' | 'excess' = isExcess ? 'excess' : 'covered';
      const billingClientId = isExcess ? (service.thirdPartyClientId as string) : service.client?.id || clientId;
      const amount = getDisplayServiceValue(service, clientId);
      const usedInFolio = usedMap.get(`${service.id}:${valueType}`);
      const disputeReason = disputedMap.get(service.id);
      return { service, valueType, billingClientId, amount, usedInFolio, disputeReason };
    });
  }, [services, clientId, usedMap, disputedMap]);

  const eligibleRows = useMemo(
    () => analyzedRows.filter(r => !r.usedInFolio && !r.disputeReason),
    [analyzedRows]
  );

  const valueTypesInEligible = useMemo(() => new Set(eligibleRows.map(r => r.valueType)), [eligibleRows]);
  const billingClientsInEligible = useMemo(() => new Set(eligibleRows.map(r => r.billingClientId)), [eligibleRows]);

  const validationError = useMemo(() => {
    if (loadingUsage || services.length === 0) return null;
    if (eligibleRows.length === 0) {
      return 'Todos los servicios seleccionados ya están incluidos en otro cierre o tienen una disputa abierta.';
    }
    if (valueTypesInEligible.size > 1) {
      return 'Un cierre no puede mezclar servicios cubiertos y excedentes. Crea un cierre separado para cada tipo.';
    }
    if (billingClientsInEligible.size > 1) {
      const names = [...billingClientsInEligible]
        .map(id => toTitleCase(clients.find(c => c.id === id)?.name || id))
        .join(', ');
      return `Los servicios seleccionados pertenecen a distintos clientes: ${names}. Selecciona servicios de un solo cliente.`;
    }
    return null;
  }, [loadingUsage, services.length, eligibleRows, valueTypesInEligible, billingClientsInEligible, clients]);

  // Auto-completar período y orden de compra desde los servicios elegibles
  useEffect(() => {
    if (!open) return;

    const dates = eligibleRows
      .map(r => safeParseDateOnly(r.service.serviceDate))
      .filter(d => !isNaN(d.getTime()));

    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;

    reset({
      dateFrom: minDate ? toLocalDateString(minDate) : '',
      dateTo: maxDate ? toLocalDateString(maxDate) : '',
      purchaseOrder: detectPurchaseOrders(eligibleRows.map(r => r.service)),
      status: 'open',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingUsage, eligibleRows.length]);

  const previewTotal = useMemo(() => eligibleRows.reduce((sum, r) => sum + r.amount, 0), [eligibleRows]);
  const closureTypeLabel = valueTypesInEligible.has('excess') && valueTypesInEligible.size === 1 ? 'Excedente' : 'Cubierto';
  const billingClientName = eligibleRows[0]
    ? toTitleCase(clients.find(c => c.id === eligibleRows[0].billingClientId)?.name || '')
    : '';

  const onFormSubmit = async (data: FormValues) => {
    if (validationError || eligibleRows.length === 0) return;

    setSubmitting(true);
    try {
      const serviceIds = eligibleRows.map(r =>
        r.valueType === 'excess' ? `${r.service.id}${EXCESS_ROW_SUFFIX}` : r.service.id
      );

      const newClosure = await createClosure(
        {
          dateRange: { from: data.dateFrom, to: data.dateTo },
          clientId: eligibleRows[0].billingClientId,
          serviceIds,
          total: previewTotal,
          status: data.status,
          purchaseOrder: data.purchaseOrder || undefined,
        },
        { silent: true }
      );

      queryClient.invalidateQueries({ queryKey: ['closures'] });
      queryClient.invalidateQueries({ queryKey: ['closures-for-invoices'] });

      toast.success(`Cierre ${newClosure.folio} creado`, {
        description: `${eligibleRows.length} servicio(s) · ${formatCurrency(newClosure.total)}`,
        action: {
          label: 'Facturar ahora',
          onClick: () => navigate('/invoices', { state: { preselectedClosureId: newClosure.id } }),
        },
        duration: 10000,
      });

      onOpenChange(false);
      onCreated();
    } catch (error) {
      logger.error('Error creating closure from pipeline:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear Cierre desde Pipeline</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          {loadingUsage ? (
            <div className="text-sm text-muted-foreground py-2">Verificando servicios...</div>
          ) : (
            <>
              {validationError && (
                <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              {!validationError && eligibleRows.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium text-foreground">{billingClientName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tipo</span>
                    <Badge variant="secondary">{closureTypeLabel}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Servicios</span>
                    <span className="font-medium text-foreground">{eligibleRows.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-foreground">{formatCurrency(previewTotal)}</span>
                  </div>
                </div>
              )}

              <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                {analyzedRows.map(row => (
                  <div
                    key={row.service.id}
                    className={`flex items-center justify-between px-3 py-2 text-sm ${(row.usedInFolio || row.disputeReason) ? 'text-muted-foreground opacity-60' : 'text-foreground'}`}
                  >
                    <div>
                      <span className="font-medium">{row.service.folio}</span>
                      <span className="text-muted-foreground ml-2">
                        {formatForDisplay(row.service.serviceDate)}
                      </span>
                    </div>
                    {row.disputeReason ? (
                      <Badge variant="destructive" className="text-xs">
                        En disputa: {row.disputeReason.slice(0, 40)}{row.disputeReason.length > 40 ? '…' : ''}
                      </Badge>
                    ) : row.usedInFolio ? (
                      <Badge variant="outline" className="text-xs">
                        Ya incluido en {row.usedInFolio}
                      </Badge>
                    ) : (
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-foreground">Fecha de Inicio</Label>
                  <DatePickerInput
                    value={watch('dateFrom') || ''}
                    onChange={(value) => setValue('dateFrom', value)}
                    className="mt-1"
                  />
                  {errors.dateFrom && <p className="text-sm text-destructive mt-1">{errors.dateFrom.message}</p>}
                </div>

                <div>
                  <Label className="text-foreground">Fecha de Fin</Label>
                  <DatePickerInput
                    value={watch('dateTo') || ''}
                    onChange={(value) => setValue('dateTo', value)}
                    className="mt-1"
                  />
                  {errors.dateTo && <p className="text-sm text-destructive mt-1">{errors.dateTo.message}</p>}
                </div>

                <div>
                  <Label className="text-foreground">Orden de Compra</Label>
                  <Input {...register('purchaseOrder')} placeholder="Ej: OC-2024-001" className="mt-1" />
                </div>

                <div>
                  <Label className="text-foreground">Estado</Label>
                  <Select value={watch('status')} onValueChange={(value: ClosureStatus) => setValue('status', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Abierto</SelectItem>
                      <SelectItem value="closed">Cerrado</SelectItem>
                      <SelectItem value="quoted">Cotizado</SelectItem>
                      <SelectItem value="purchase_order_pending">Esperando OC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting || loadingUsage || !!validationError || eligibleRows.length === 0}
              className="gap-2"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Crear Cierre
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
