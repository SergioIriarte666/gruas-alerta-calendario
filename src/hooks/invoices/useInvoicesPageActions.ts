import { MutableRefObject, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useInvoiceReport } from '@/hooks/reports/useInvoiceReport';
import { getTodayLocal } from '@/utils/timezoneUtils';
import { formatCurrency } from '@/lib/utils';
import { computeIvaToSeparate } from '@/utils/ivaF29Utils';
import { Invoice } from '@/types';
import { normalizeInvoiceStatusBeforeAutomaticPayment } from '@/utils/invoicePaymentCreation';
import { InvoicesProtectedDeleteDialogState } from '@/components/invoices/InvoicesProtectedDeleteDialog';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useInvoicesPageActions");
interface InvoiceFormStateLike {
  editingInvoice: Invoice | null;
}

interface UseInvoicesPageActionsParams {
  invoices: Invoice[];
  paginatedInvoices: Invoice[];
  selectedInvoiceIds: string[];
  formState: InvoiceFormStateLike;
  deleteDialogState: InvoicesProtectedDeleteDialogState;
  pendingDeleteIdRef: MutableRefObject<string | null>;
  batchProgress: any;
  createInvoice: (data: any) => Promise<any>;
  updateInvoice: (id: string, data: any) => Promise<any>;
  deleteInvoice: (id: string, options?: { force?: boolean }) => Promise<any>;
  markAsPaid: (id: string, paymentDate?: string) => Promise<any>;
  refetch: () => void;
  closeInvoiceForm: () => void;
  openEditInvoiceForm: (invoice: Invoice) => void;
  openProtectedDeleteDialog: (options: {
    pendingDeleteId?: string | null;
    pendingFolio: string;
    pendingBatchDeleteIds?: string[];
  }) => void;
  closeProtectedDeleteDialog: () => void;
  clearSelection: () => void;
  setDeleteError: (error: string) => void;
  setDeleteVerifying: (isVerifying: boolean) => void;
  setMarkAsPaidInvoice: (invoice: Invoice | null) => void;
  setSelectedInvoiceIds: (invoiceIds: string[]) => void;
  toggleInvoiceSelection: (invoiceId: string, checked: boolean) => void;
}

export const useInvoicesPageActions = ({
  invoices,
  paginatedInvoices,
  selectedInvoiceIds,
  formState,
  deleteDialogState,
  pendingDeleteIdRef,
  batchProgress,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markAsPaid,
  refetch,
  closeInvoiceForm,
  openEditInvoiceForm,
  openProtectedDeleteDialog,
  closeProtectedDeleteDialog,
  clearSelection,
  setDeleteError,
  setDeleteVerifying,
  setMarkAsPaidInvoice,
  setSelectedInvoiceIds,
  toggleInvoiceSelection,
}: UseInvoicesPageActionsParams) => {
  const invoiceById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const runBatchOperation = async (
    ids: string[],
    operation: (id: string) => Promise<unknown>,
  ) => {
    let completed = 0;

    const results = await Promise.allSettled(
      ids.map(async (id) => {
        try {
          await operation(id);
          return true;
        } catch {
          return false;
        } finally {
          completed += 1;
          const invoice = invoiceById.get(id);
          batchProgress.update(completed, invoice?.folio || id);
        }
      }),
    );

    return results.filter((result) => result.status === 'fulfilled' && result.value === false).length;
  };

  const handleCreateInvoice = async (data: any) => {
    try {
      const newInvoice = await createInvoice(data);
      closeInvoiceForm();
      if (data.status === 'paid' && newInvoice?.id) {
        try {
          const paymentDate = data.paymentDate || data.issueDate || getTodayLocal();
          await markAsPaid(newInvoice.id, paymentDate);
          setTimeout(() => {
            refetch();
          }, 500);
        } catch (payError) {
          logger.error('Error registering automatic payment:', payError);
          toast.warning("Factura creada", {
            description: "La factura se creó pero no se pudo registrar el pago automático.",
          });
          setTimeout(() => {
            refetch();
          }, 500);
          return;
        }
      }

      toast.success("Factura creada", {
        description: "La factura ha sido creada exitosamente.",
      });
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (error) {
      logger.error('Error creating invoice:', error);
    }
  };

  const handleUpdateInvoice = async (data: any) => {
    const { editingInvoice } = formState;
    if (!editingInvoice) return;

    try {
      const shouldRegisterPayment = data.status === 'paid' && editingInvoice.status !== 'paid';
      const updateData = shouldRegisterPayment
        ? { ...data, status: normalizeInvoiceStatusBeforeAutomaticPayment(data.status) }
        : data;

      await updateInvoice(editingInvoice.id, updateData);

      if (shouldRegisterPayment) {
        const paymentDate = data.paymentDate || data.issueDate || getTodayLocal();
        await markAsPaid(editingInvoice.id, paymentDate);
      }

      closeInvoiceForm();
    } catch (error) {
      logger.error('Invoices page - Error updating invoice:', error);
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    const invoice = invoiceById.get(id);
    const isHistorical = invoice?.folio?.startsWith('HIST-');

    if (isHistorical) {
      toast.warning('Eliminar factura histórica', {
        id: `delete-historical-invoice-${id}`,
        description: 'Se eliminará permanentemente esta factura histórica.',
        duration: 8000,
        action: {
          label: 'Eliminar',
          onClick: async () => {
            try {
              await deleteInvoice(id, { force: true });
              toast.success("Factura eliminada", {
                description: "La factura histórica ha sido eliminada.",
              });
            } catch (error) {
              logger.error('Error deleting invoice:', error);
              toast.error('No se pudo eliminar la factura histórica');
            }
          },
        },
        cancel: {
          label: 'Cancelar',
          onClick: () => {},
        },
      });
      return;
    }

    openProtectedDeleteDialog({
      pendingDeleteId: id,
      pendingFolio: invoice?.folio || '',
    });
  };

  const handleConfirmProtectedDelete = async () => {
    try {
      if (!deleteDialogState.password.trim()) {
        setDeleteError('Ingrese su contraseña');
        return;
      }
      setDeleteVerifying(true);
      setDeleteError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No se pudo obtener el email del usuario');
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deleteDialogState.password,
      });
      if (error) {
        setDeleteError('Contraseña incorrecta');
        setDeleteVerifying(false);
        return;
      }
      setDeleteVerifying(false);
      if (pendingDeleteIdRef.current) {
        await deleteInvoice(pendingDeleteIdRef.current, { force: true });
        toast.success("Factura eliminada", {
          description: "La factura ha sido eliminada exitosamente.",
        });
      } else if (deleteDialogState.pendingBatchDeleteIds.length > 0) {
        batchProgress.start('Eliminando Facturas Protegidas', deleteDialogState.pendingBatchDeleteIds.length);
        const errorCount = await runBatchOperation(
          deleteDialogState.pendingBatchDeleteIds,
          (id) => deleteInvoice(id, { force: true }),
        );
        clearSelection();
        if (errorCount === 0) {
          batchProgress.complete();
        } else {
          batchProgress.error(`${errorCount} factura(s) con error`);
        }
      }
    } catch (error) {
      logger.error('Error deleting protected invoice:', error);
    } finally {
      closeProtectedDeleteDialog();
    }
  };

  const handleMarkAsPaid = (id: string) => {
    const invoice = invoiceById.get(id);
    if (invoice) {
      setMarkAsPaidInvoice(invoice);
    }
  };

  const handleConfirmMarkAsPaid = async (invoiceId: string, paymentDate: string) => {
    await markAsPaid(invoiceId, paymentDate);
    setTimeout(() => {
      refetch();
    }, 500);
    toast.success("Factura marcada como pagada", {
      description: "El estado de la factura ha sido actualizado.",
    });

    // Recordatorio del IVA a apartar para el F29 (débito fiscal de la factura).
    const invoice = invoiceById.get(invoiceId);
    if (invoice) {
      const { total: ivaTotal } = computeIvaToSeparate([invoice]);
      if (ivaTotal > 0) {
        toast.info(`Separar ${formatCurrency(ivaTotal)} para pago de IVA (F29)`, {
          duration: 8000,
        });
      }
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    openEditInvoiceForm(invoice);
  };

  const handleRefresh = () => refetch();

  const handleInvoiceToggle = (invoiceId: string, checked: boolean) => {
    toggleInvoiceSelection(invoiceId, checked);
  };

  const handleSelectAllToggle = (checked: boolean) => {
    if (checked) {
      setSelectedInvoiceIds(invoices.map((invoice) => invoice.id));
      return;
    }

    clearSelection();
  };

  const handleBatchMarkAsPaid = async (invoiceIds: string[]) => {
    batchProgress.start('Marcando como Pagadas', invoiceIds.length);

    try {
      const errorCount = await runBatchOperation(invoiceIds, (id) => markAsPaid(id));
      clearSelection();
      setTimeout(() => {
        refetch();
      }, 500);

      if (errorCount === 0) {
        batchProgress.complete();

        // Recordatorio del IVA total a apartar para el F29, con desglose por folio.
        const paidInvoices = invoiceIds
          .map((id) => invoiceById.get(id))
          .filter((inv): inv is Invoice => Boolean(inv));
        const { total: ivaTotal, items } = computeIvaToSeparate(paidInvoices);
        if (ivaTotal > 0) {
          const breakdown = items
            .filter((item) => item.iva > 0)
            .map((item) => `${item.folio}: ${formatCurrency(item.iva)}`)
            .join(' · ');
          toast.info(`Separar ${formatCurrency(ivaTotal)} para pago de IVA (F29)`, {
            description: items.length > 1 ? breakdown : undefined,
            duration: 8000,
          });
        }
      } else {
        batchProgress.error(`${errorCount} factura(s) con error`);
      }
    } catch (error) {
      logger.error('Error marking invoices as paid:', error);
      batchProgress.error('Error al procesar');
    }
  };

  const handleBatchDelete = async (invoiceIds: string[]) => {
    const historicalIds = invoiceIds.filter((id) => invoiceById.get(id)?.folio?.startsWith('HIST-'));
    const protectedIds = invoiceIds.filter((id) => !invoiceById.get(id)?.folio?.startsWith('HIST-'));

    if (historicalIds.length > 0) {
      batchProgress.start('Eliminando Facturas Históricas', historicalIds.length);
      const errorCount = await runBatchOperation(
        historicalIds,
        (id) => deleteInvoice(id, { force: true }),
      );
      if (errorCount === 0) {
        batchProgress.complete();
      } else {
        batchProgress.error(`${errorCount} factura(s) con error`);
      }
    }

    if (protectedIds.length > 0) {
      const protectedFolios = protectedIds.flatMap((id) => {
        const folio = invoiceById.get(id)?.folio;
        return folio ? [folio] : [];
      });
      openProtectedDeleteDialog({
        pendingDeleteId: null,
        pendingFolio: protectedFolios.join(', '),
        pendingBatchDeleteIds: protectedIds,
      });
      return;
    }

    clearSelection();
  };

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)),
    [invoices, selectedInvoiceIds],
  );

  const selectedInvoiceMetrics = useMemo(() => {
    const totalInvoiced = selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const totalPaid = selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
    const pendingAmount = selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.remainingAmount || 0), 0);
    const overdueInvoices = selectedInvoices.filter((invoice) => invoice.status === 'overdue').length;

    return {
      totalInvoiced,
      totalPaid,
      pendingAmount,
      overdueInvoices,
    };
  }, [selectedInvoices]);

  const { handleExportInvoiceReport } = useInvoiceReport({
    invoices: selectedInvoices,
    metrics: selectedInvoiceMetrics,
  });

  const handleBatchExport = async (invoiceIds: string[]) => {
    const invoicesToExport = invoices.filter((invoice) => invoiceIds.includes(invoice.id));

    if (invoicesToExport.length === 0) {
      toast.error('Sin facturas seleccionadas', {
        description: 'Seleccione al menos una factura para exportar.',
      });
      return;
    }

    const issueDates = invoicesToExport
      .map((invoice) => invoice.issueDate)
      .filter((value): value is string => Boolean(value))
      .sort();

    await handleExportInvoiceReport('excel', {
      dateFrom: issueDates[0],
      dateTo: issueDates[issueDates.length - 1],
      status: invoicesToExport.length === 1 ? invoicesToExport[0].status : undefined,
      clientName: invoicesToExport.length === 1 ? invoicesToExport[0].client?.name : undefined,
    });
  };

  return {
    filteredInvoices: paginatedInvoices,
    selectedInvoices,
    handleCreateInvoice,
    handleUpdateInvoice,
    handleDeleteInvoice,
    handleConfirmProtectedDelete,
    handleMarkAsPaid,
    handleConfirmMarkAsPaid,
    handleEditInvoice,
    handleRefresh,
    handleInvoiceToggle,
    handleSelectAllToggle,
    handleBatchMarkAsPaid,
    handleBatchDelete,
    handleBatchExport,
  };
};
