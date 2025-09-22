import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData, updateOverdueInvoices } from '@/utils/invoiceUtils';

export const useClientInvoices = (clientId: string | null) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvoicesByClient = useCallback(async (id: string) => {
        setLoading(true);
        try {
            console.log('Fetching invoices for client ID:', id);
            
            const { data, error } = await supabase
                .from('invoices')
                .select(`*, invoice_services(service_id)`)
                .eq('client_id', id)
                .order('issue_date', { ascending: false });

            if (error) {
                console.error('Supabase error fetching client invoices:', error);
                throw new Error(`Error en consulta: ${error.message}`);
            }

            console.log('Client invoices fetched:', data?.length || 0, 'for client:', id);
            
            // Format invoices and detect overdue ones
            const formattedInvoices: Invoice[] = [];
            const overdueInvoiceIds: string[] = [];

            (data || []).forEach(invoice => {
                const formattedInvoice = formatInvoiceData(invoice);
                
                // Track invoices that were updated to overdue status
                if (invoice.status === 'sent' && formattedInvoice.status === 'overdue') {
                    overdueInvoiceIds.push(invoice.id);
                }
                
                formattedInvoices.push(formattedInvoice);
            });

            // Update overdue invoices in database if any were detected
            if (overdueInvoiceIds.length > 0) {
                await updateOverdueInvoices(overdueInvoiceIds);
            }

            setInvoices(formattedInvoices);
        } catch (error: any) {
            console.error('Error fetching client invoices:', error);
            toast.error("Error", {
                description: "No se pudieron cargar las facturas del cliente.",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (clientId) {
            fetchInvoicesByClient(clientId);
        } else {
            setInvoices([]);
            setLoading(false);
        }
    }, [clientId, fetchInvoicesByClient]);
    
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;

    const invoiceMetrics = {
        totalInvoiced,
        totalPaid,
        pendingAmount,
        overdueInvoices,
    };

    return { invoices, loading, metrics: invoiceMetrics, refetch: () => clientId && fetchInvoicesByClient(clientId) };
};

