import { supabase } from '@/integrations/supabase/client';

export const VENTA_PRODUCTOS_SERVICE_TYPE_ID = '3e695d47-aa5a-4937-ab86-1e8557a1ba17'; // Venta de Productos

export const ITEMS_SERVICE_TYPES = [
  'Apoyo Logistico',
  'Servicios Mecánicos y De Apoyo',
  'Venta de Productos',
];

export const isItemsServiceType = (serviceType?: { id?: string | null; name?: string | null } | null) =>
  ITEMS_SERVICE_TYPES.includes(serviceType?.name || '') ||
  serviceType?.id === VENTA_PRODUCTOS_SERVICE_TYPE_ID;

export interface ServiceItemRow {
  glosa: string;
  cantidad: number;
  valor_unitario: number;
}

export interface ServiceItemsBreakdown {
  items: ServiceItemRow[];
  subtotal: number;
  iva: number;
  total: number;
}

export const fetchServiceItemsBreakdown = async (
  serviceId: string,
): Promise<ServiceItemsBreakdown | null> => {
  const { data: items, error } = await supabase
    .from('service_items')
    .select('*')
    .eq('service_id', serviceId)
    .order('created_at', { ascending: true });

  if (error || !items || items.length === 0) return null;

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.cantidad) * Number(item.valor_unitario),
    0,
  );
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;

  return { items, subtotal, iva, total };
};
