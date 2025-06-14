
import { useState, useEffect } from 'react';
import { Invoice } from '@/types';
import { useServices } from './useServices';
import { useClients } from './useClients';

// Mock data para desarrollo
const mockInvoices: Invoice[] = [
  {
    id: '1',
    folio: 'FACT-001',
    serviceIds: ['1', '2'],
    clientId: '1',
    issueDate: '2024-01-15',
    dueDate: '2024-02-14',
    subtotal: 420000,
    vat: 79800,
    total: 499800,
    status: 'paid',
    paymentDate: '2024-01-20',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z'
  },
  {
    id: '2',
    folio: 'FACT-002',
    serviceIds: ['3', '4'],
    clientId: '2',
    issueDate: '2024-01-25',
    dueDate: '2024-02-24',
    subtotal: 350000,
    vat: 66500,
    total: 416500,
    status: 'pending',
    createdAt: '2024-01-25T11:00:00Z',
    updatedAt: '2024-01-25T11:00:00Z'
  },
  {
    id: '3',
    folio: 'FACT-003',
    serviceIds: ['5'],
    clientId: '3',
    issueDate: '2024-01-10',
    dueDate: '2024-02-09',
    subtotal: 180000,
    vat: 34200,
    total: 214200,
    status: 'overdue',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-10T09:00:00Z'
  }
];

export const useInvoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { services } = useServices();
  const { clients } = useClients();

  useEffect(() => {
    // Simular carga de datos
    setTimeout(() => {
      setInvoices(mockInvoices);
      setLoading(false);
    }, 500);
  }, []);

  const createInvoice = (invoiceData: Omit<Invoice, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    const newInvoice: Invoice = {
      ...invoiceData,
      id: Date.now().toString(),
      folio: `FACT-${String(invoices.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  };

  const updateInvoice = (id: string, invoiceData: Partial<Invoice>) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id 
        ? { ...invoice, ...invoiceData, updatedAt: new Date().toISOString() }
        : invoice
    ));
  };

  const deleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(invoice => invoice.id !== id));
  };

  const markAsPaid = (id: string) => {
    setInvoices(prev => prev.map(invoice => 
      invoice.id === id 
        ? { 
            ...invoice, 
            status: 'paid' as const, 
            paymentDate: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString() 
          }
        : invoice
    ));
  };

  const getInvoiceWithDetails = (invoice: Invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const invoiceServices = services.filter(s => invoice.serviceIds.includes(s.id));
    
    return {
      ...invoice,
      client,
      services: invoiceServices
    };
  };

  return {
    invoices,
    loading,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    markAsPaid,
    getInvoiceWithDetails
  };
};
