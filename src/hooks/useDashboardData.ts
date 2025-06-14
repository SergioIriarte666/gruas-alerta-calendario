
import { useState, useEffect } from 'react';
import { DashboardMetrics, Service, Invoice, CalendarEvent } from '@/types';

// Mock data - En producción esto vendría de Supabase
const mockServices: Service[] = [
  {
    id: '1',
    folio: 'G5N-001',
    requestDate: '2024-06-14',
    serviceDate: '2024-06-14',
    client: {
      id: '1',
      name: 'Transportes ABC Ltda.',
      rut: '76.123.456-7',
      phone: '+56 9 8765 4321',
      email: 'contacto@transportesabc.cl',
      address: 'Av. Principal 123, Santiago',
      isActive: true,
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15'
    },
    vehicleBrand: 'Volvo',
    vehicleModel: 'FH12',
    licensePlate: 'ABCD-12',
    origin: 'Santiago Centro',
    destination: 'Puente Alto',
    serviceType: {
      id: '1',
      name: 'Grúa Pesada',
      description: 'Servicio de grúa para vehículos pesados',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    value: 150000,
    crane: {
      id: '1',
      licensePlate: 'GRUA-01',
      brand: 'Mercedes',
      model: 'Actros',
      type: 'heavy',
      circulationPermitExpiry: '2024-12-31',
      insuranceExpiry: '2024-11-30',
      technicalReviewExpiry: '2024-10-15',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    operator: {
      id: '1',
      name: 'Carlos Rodríguez',
      rut: '12.345.678-9',
      phone: '+56 9 1234 5678',
      licenseNumber: 'A123456',
      examExpiry: '2025-03-15',
      isActive: true,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    operatorCommission: 15000,
    status: 'pending',
    observations: 'Vehículo en pana por sobrecalentamiento',
    createdAt: '2024-06-14',
    updatedAt: '2024-06-14'
  }
];

const mockInvoices: Invoice[] = [
  {
    id: '1',
    folio: 'F-001',
    serviceIds: ['1'],
    clientId: '1',
    issueDate: '2024-05-15',
    dueDate: '2024-06-14',
    subtotal: 150000,
    vat: 28500,
    total: 178500,
    status: 'overdue',
    createdAt: '2024-05-15',
    updatedAt: '2024-05-15'
  }
];

export const useDashboardData = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    const loadData = async () => {
      try {
        // Calcular métricas
        const currentMonth = new Date().getMonth();
        const monthlyServices = mockServices.filter(s => 
          new Date(s.serviceDate).getMonth() === currentMonth
        ).length;

        const monthlyRevenue = mockServices
          .filter(s => new Date(s.serviceDate).getMonth() === currentMonth)
          .reduce((sum, s) => sum + s.value, 0);

        const overdueInvoices = mockInvoices.filter(i => i.status === 'overdue').length;

        const calculatedMetrics: DashboardMetrics = {
          totalServices: mockServices.length,
          monthlyServices,
          activeClients: 1,
          monthlyRevenue,
          pendingInvoices: mockInvoices.filter(i => i.status === 'pending').length,
          overdueInvoices,
          servicesByStatus: {
            pending: mockServices.filter(s => s.status === 'pending').length,
            closed: mockServices.filter(s => s.status === 'closed').length,
            invoiced: mockServices.filter(s => s.status === 'invoiced').length,
          },
          upcomingExpirations: 3
        };

        // Generar eventos de calendario
        const events: CalendarEvent[] = [
          {
            id: '1',
            title: 'Vencimiento Seguro Grúa GRUA-01',
            date: '2024-11-30',
            type: 'document_expiry',
            status: 'warning',
            entityId: '1',
            entityType: 'crane'
          },
          {
            id: '2',
            title: 'Factura F-001 vencida',
            date: '2024-06-14',
            type: 'invoice_due',
            status: 'urgent',
            entityId: '1',
            entityType: 'invoice'
          }
        ];

        setMetrics(calculatedMetrics);
        setRecentServices(mockServices);
        setUpcomingEvents(events);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    metrics,
    recentServices,
    upcomingEvents,
    loading
  };
};
