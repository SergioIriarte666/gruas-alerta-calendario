import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types';
import { toast } from 'sonner';
import { formatInvoiceData } from '@/utils/invoiceUtils';

export const useClientInvoices = (clientId: string | null) => {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchInvoicesByClient = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select(`*, invoice_services(service_id)`)
                .eq('client_id', id)
                .order('issue_date', { ascending: false });

            if (error) throw error;
            
            const formattedInvoices = data.map(formatInvoiceData);
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

