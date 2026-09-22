export const FIELD_LABELS: Record<string, string> = {
  folio: 'Folio',
  request_date: 'Fecha de Solicitud',
  service_date: 'Fecha del Servicio',
  start_time: 'Hora de Inicio',
  end_time: 'Hora de Término',
  crane_mileage: 'Kilometraje',
  value: 'Valor del Servicio',
  purchase_order: 'Orden de Compra',
  purchase_order_number: 'N° Orden de Compra',
  quote_number: 'Número de Cotización',
  status: 'Estado',
  operator_commission: 'Comisión Operador',
  client_covered_amount: 'Monto Cubierto Cliente',
  excess_amount: 'Excedente',
  insured_name: 'Nombre Asegurado',
  contact_person: 'Persona en el Lugar',
  contact_phone: 'Teléfono Persona en el Lugar',
  origin: 'Origen',
  destination: 'Destino',
  origin_lat: 'Latitud de Origen',
  origin_lng: 'Longitud de Origen',
  origin_location_source: 'Fuente de Ubicación de Origen',
  destination_lat: 'Latitud de Destino',
  destination_lng: 'Longitud de Destino',
  destination_location_source: 'Fuente de Ubicación de Destino',
  observations: 'Observaciones',
  vehicle_brand: 'Marca Vehículo',
  vehicle_model: 'Modelo Vehículo',
  license_plate: 'Patente',
  servicio: 'Servicio',
  service_type_id: 'Tipo de Servicio',
  client_id: 'Cliente',
  operator_id: 'Operador',
  crane_id: 'Grúa',
  has_excess: 'Tiene Excedente',
  outsourced_cost: 'Costo Tercerización',
  outsourced_notes: 'Notas de Tercerización',
  custody_mode: 'Modo de Custodia',
  custody_days: 'Días de Custodia',
  custody_daily_rate: 'Tarifa Diaria de Custodia',
  custody_start_date: 'Fecha Inicio Custodia',
  custody_end_date: 'Fecha Término Custodia',
  custody_vehicle_type: 'Tipo de Vehículo (Custodia)',
  custody_discount_percentage: 'Descuento Custodia (%)',
  custody_total_amount: 'Total Custodia',
  custody_notes: 'Notas de Custodia',
  custody_rate_type: 'Tipo de Tarifa Custodia',
  invoice_folio: 'Folio de Factura',
  invoice_numero_fiscal: 'Número Fiscal de Factura',
  company_rut: 'RUT Empresa',
  company_name: 'Empresa',
  preferred_time: 'Horario Preferido',
  urgency: 'Urgencia',
  service_relationship_type: 'Tipo de Relación',
  client_notifications_enabled: 'Notificaciones al Cliente',
  third_party_client_id: 'Tercero que Paga Excedente',
  outsourced_provider_id: 'Proveedor Tercerizado',
  related_service_id: 'Servicio Relacionado',
  service_resource: 'Recurso del Servicio',
  resource_commission: 'Comisión del Operador',
  resource_role: 'Rol del Operador',
  resource_primary: 'Recurso Principal',
};

// Campos FK cuyo old_value/new_value son UUIDs crudos — el nombre legible
// vive en change_summary (resuelto en el trigger vía join).
export const SUMMARY_RESOLVED_FIELDS = new Set([
  'crane_id',
  'operator_id',
  'client_id',
  'service_type_id',
  'third_party_client_id',
  'outsourced_provider_id',
  'related_service_id',
  'service_resource',
  'resource_commission',
  'resource_role',
  'resource_primary',
]);

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  invoiced: 'Facturado',
  in_progress: 'En Progreso',
  quoted: 'Cotizado',
  purchase_order_pending: 'Orden de compra pendiente',
  with_purchase_order: 'Con orden de compra',
  written_off: 'Castigado',
};

const MONEY_FIELDS = [
  'value', 'operator_commission', 'client_covered_amount', 'excess_amount',
  'outsourced_cost', 'custody_daily_rate', 'custody_total_amount', 'resource_commission',
];

export const formatValue = (fieldName: string, value: string | null): string => {
  if (value === null || value === '') return '(vacío)';

  // Formatear valores monetarios
  if (MONEY_FIELDS.includes(fieldName)) {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return `$${numValue.toLocaleString('es-CL')}`;
    }
  }

  // Formatear estados
  if (fieldName === 'status') {
    return STATUS_LABELS[value] || value;
  }

  // Formatear booleanos
  if (fieldName === 'has_excess' || fieldName === 'client_notifications_enabled') {
    return value === 'true' ? 'Sí' : 'No';
  }

  return value;
};

