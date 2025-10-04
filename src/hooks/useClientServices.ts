
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Service } from '@/types';
import { toast } from 'sonner';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

export const useClientServices = (clientId: string | null) => {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchServicesByClient = useCallback(async (id: string) => {
        setLoading(true);
        try {
            console.log('Fetching services for client ID:', id);
            
            // First, get basic service data
            const { data, error } = await supabase
                .from('services')
                .select(`
                    *,
                    cranes(id, license_plate, brand, model, type, is_active),
                    operators(id, name, rut, phone, license_number, is_active),
                    service_types(id, name, description, base_price, is_active, vehicle_info_optional, purchase_order_required, origin_required, destination_required, crane_required, operator_required, vehicle_brand_required, vehicle_model_required, license_plate_required, created_at, updated_at)
                `)
                .eq('client_id', id)
                .order('service_date', { ascending: false });

            if (error) {
                console.error('Supabase query error:', error);
                throw new Error(`Error en consulta: ${error.message}`);
            }

            if (!data) {
                console.log('No services found for client:', id);
                setServices([]);
                return;
            }

            console.log('Services fetched:', data.length);

            // Get client data separately for more robust error handling
            const { data: clientData, error: clientError } = await supabase
                .from('clients')
                .select('id, name, rut, phone, email, address, department, is_active')
                .eq('id', id)
                .single();

            if (clientError) {
                console.error('Client fetch error:', clientError);
                // Continue without client data rather than failing completely
            }
            
            const formattedServices: Service[] = data.map(service => ({
                id: service.id,
                folio: service.folio,
                requestDate: service.request_date,
                serviceDate: service.service_date,
                client: clientData ? {
                  id: clientData.id,
                  name: clientData.name,
                  rut: clientData.rut,
                  phone: clientData.phone || '',
                  email: clientData.email || '',
                  address: clientData.address || '',
                  department: clientData.department || 'General',
                  isActive: clientData.is_active,
                  createdAt: '',
                  updatedAt: ''
                } : {
                  id: id,
                  name: 'Cliente no encontrado',
                  rut: '',
                  phone: '',
                  email: '',
                  address: '',
                  department: 'General',
                  isActive: false,
                  createdAt: '',
                  updatedAt: ''
                },
                purchaseOrder: service.purchase_order,
                purchaseOrderNumber: service.purchase_order_number || '',
                quoteNumber: service.quote_number || '',
                vehicleBrand: service.vehicle_brand,
                vehicleModel: service.vehicle_model,
                licensePlate: service.license_plate,
                origin: service.origin,
                destination: service.destination,
                serviceType: {
                  id: service.service_types.id,
                  name: service.service_types.name,
                  description: service.service_types.description || '',
                  basePrice: service.service_types.base_price,
                  isActive: service.service_types.is_active,
                  vehicleInfoOptional: service.service_types.vehicle_info_optional || false,
                  purchaseOrderRequired: service.service_types.purchase_order_required || false,
                  originRequired: service.service_types.origin_required !== false,
                  destinationRequired: service.service_types.destination_required !== false,
                  craneRequired: service.service_types.crane_required !== false,
                  operatorRequired: service.service_types.operator_required !== false,
                  vehicleBrandRequired: service.service_types.vehicle_brand_required !== false,
                  vehicleModelRequired: service.service_types.vehicle_model_required !== false,
                  licensePlateRequired: service.service_types.license_plate_required !== false,
                  createdAt: service.service_types.created_at || '',
                  updatedAt: service.service_types.updated_at || ''
                },
                value: Number(service.value),
                custodyTotalAmount: service.custody_total_amount || 0,
                custodyMode: (service.custody_mode as "manual" | "none" | "calendar") || 'none',
                crane: service.cranes ? {
                  id: service.cranes.id,
                  licensePlate: service.cranes.license_plate,
                  brand: service.cranes.brand,
                  model: service.cranes.model,
                  type: service.cranes.type,
                  isActive: service.cranes.is_active,
                  createdAt: '',
                  updatedAt: '',
                  circulationPermitExpiry: '',
                  insuranceExpiry: '',
                  technicalReviewExpiry: ''
                } : null,
                operator: service.operators ? {
                  id: service.operators.id,
                  name: service.operators.name,
                  rut: service.operators.rut,
                  phone: service.operators.phone || '',
                  operatorType: 'crane_operator' as const,
                  licenseNumber: service.operators.license_number,
                  isActive: service.operators.is_active,
                  createdAt: '',
                  updatedAt: '',
                  examExpiry: ''
                } : null,
                operatorCommission: Number(service.operator_commission),
                status: service.status as Service['status'],
                observations: service.observations,
                createdAt: service.created_at,
                updatedAt: service.updated_at,
            }));

            setServices(formattedServices);
        } catch (error: any) {
            console.error('Error fetching client services:', error);
            toast.error("Error", {
                description: "No se pudieron cargar los servicios del cliente.",
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (clientId) {
            fetchServicesByClient(clientId);
        } else {
            setServices([]);
            setLoading(false);
        }
    }, [clientId, fetchServicesByClient]);

    const serviceMetrics = {
        totalServices: services.length,
        totalBilled: services.reduce((acc, s) => acc + getDisplayServiceValue(s), 0),
        averageTicket: services.length > 0 ? services.reduce((acc, s) => acc + getDisplayServiceValue(s), 0) / services.length : 0,
    };

    return { services, loading, metrics: serviceMetrics, refetch: () => clientId && fetchServicesByClient(clientId) };
};
