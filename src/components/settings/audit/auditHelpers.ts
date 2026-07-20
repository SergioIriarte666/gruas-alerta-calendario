import { AuditEntry, AuditModule, tableToModule } from '@/hooks/useAuditLog';

export { tableToModule };

const FIELD_LABELS: Record<string, string> = {
  folio: 'Folio',
  value: 'Valor del servicio',
  purchase_order: 'Orden de compra',
  purchase_order_number: 'N° orden de compra',
  quote_number: 'N° cotización',
  status: 'Estado',
  operator_commission: 'Comisión operador',
  client_covered_amount: 'Monto cubierto por cliente',
  excess_amount: 'Excedente',
  insured_name: 'Nombre asegurado',
  origin: 'Origen',
  destination: 'Destino',
  observations: 'Observaciones',
  vehicle_brand: 'Marca vehículo',
  vehicle_model: 'Modelo vehículo',
  license_plate: 'Patente',
  service_type_id: 'Tipo de servicio',
  client_id: 'Cliente',
  operator_id: 'Operador',
  crane_id: 'Grúa',
  has_excess: 'Tiene excedente',
  outsourced_cost: 'Costo tercerización',
  custody_mode: 'Modo de custodia',
  custody_days: 'Días de custodia',
  custody_daily_rate: 'Tarifa diaria de custodia',
  custody_start_date: 'Fecha inicio custodia',
  custody_end_date: 'Fecha término custodia',
  custody_vehicle_type: 'Tipo de vehículo (custodia)',
  custody_discount_percentage: 'Descuento custodia (%)',
  custody_total_amount: 'Total custodia',
  custody_notes: 'Notas de custodia',
  custody_rate_type: 'Tipo de tarifa custodia',
  event_type: 'Tipo de evento',
  path: 'Ruta',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  invoiced: 'Facturado',
  in_progress: 'En progreso',
  quoted: 'Cotizado',
  purchase_order_pending: 'Orden de compra pendiente',
  with_purchase_order: 'Con orden de compra',
};

function titleCaseWords(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ');
}

export function formatFieldLabel(fieldName: string | null | undefined): string {
  if (!fieldName) return 'Campo';
  const label = FIELD_LABELS[fieldName];
  if (label) return label;
  return titleCaseWords(fieldName.replace(/_/g, ' '));
}

export function formatFieldValue(fieldName: string | null | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';

  const stringValue =
    typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : null;

  if (
    fieldName &&
    ['value', 'operator_commission', 'client_covered_amount', 'excess_amount', 'outsourced_cost', 'custody_daily_rate', 'custody_total_amount'].includes(
      fieldName,
    )
  ) {
    const numValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isNaN(numValue)) {
      return `$${numValue.toLocaleString('es-CL')}`;
    }
  }

  if (fieldName === 'status' && stringValue) {
    return STATUS_LABELS[stringValue] || stringValue;
  }

  if (stringValue !== null) return stringValue;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatAuditDescription(entry: AuditEntry): string {
  const { source, operation, module, entityFolio, fieldName, changeSummary, newData, tableName } = entry;

  if (source === 'user_activity_log') {
    const data = newData as any;
    const eventType = String(data?.event_type || changeSummary || '').toLowerCase();
    const path = data?.path ? String(data.path) : '';

    if (eventType === 'login') return 'Inicio de sesión';
    if (eventType === 'logout') return 'Cierre de sesión';
    if (eventType === 'page_view') return path ? `Visita: ${path}` : 'Visita';
    return path ? `Actividad: ${eventType} · ${path}` : `Actividad: ${eventType || 'evento'}`;
  }

  if (source === 'backup_logs') {
    const data = newData as any;
    return `Backup ${data?.backup_type || ''} — ${data?.status || ''}`;
  }

  if (source === 'notification_logs') {
    const data = newData as any;
    return `Notificación ${data?.type || ''} enviada a ${data?.recipient || ''}`;
  }

  if (source === 'service_change_history') {
    if (operation === 'INSERT') {
      return entityFolio ? `Servicio ${entityFolio} creado` : 'Servicio creado';
    }
    if (operation === 'DELETE') {
      return entityFolio ? `Servicio ${entityFolio} eliminado` : 'Servicio eliminado';
    }
    if (entityFolio && fieldName) {
      return `Servicio ${entityFolio}: ${formatFieldLabel(fieldName)} modificado`;
    }
    if (entityFolio) {
      return changeSummary || `Servicio ${entityFolio} actualizado`;
    }
    return changeSummary || 'Cambio en servicio';
  }

  // audit_log entries
  switch (operation) {
    case 'INSERT': {
      const folio = entry.newData?.folio || entry.newData?.service_folio;
      switch (module) {
        case 'services':
          return folio ? `Servicio ${folio} creado` : 'Servicio creado';
        case 'clients':
          return 'Cliente creado';
        case 'operators':
          return 'Operador creado';
        case 'cranes':
          return 'Grúa creada';
        case 'costs':
          return 'Costo registrado';
        case 'invoices':
          return 'Factura creada';
        case 'settings':
          return 'Configuración actualizada';
        case 'users':
          return 'Usuario creado';
        default:
          return `Registro creado en ${tableName}`;
      }
    }
    case 'UPDATE': {
      const folio = entry.newData?.folio || entry.newData?.service_folio || entry.oldData?.folio;
      switch (module) {
        case 'services':
          return folio ? `Servicio ${folio} actualizado` : 'Servicio actualizado';
        case 'clients':
          return 'Cliente actualizado';
        case 'operators':
          return 'Operador actualizado';
        case 'cranes':
          return 'Grúa actualizada';
        case 'costs':
          return 'Costo actualizado';
        case 'invoices':
          return 'Factura actualizada';
        case 'settings':
          return 'Configuración modificada';
        case 'users':
          return 'Usuario modificado';
        default:
          return `Registro actualizado en ${tableName}`;
      }
    }
    case 'DELETE':
      return `Registro eliminado de ${moduleLabel(module)}`;
    default:
      return changeSummary || `Evento en ${tableName}`;
  }
}

export function moduleLabel(module: AuditModule): string {
  const labels: Record<AuditModule, string> = {
    services: 'Servicios',
    clients: 'Clientes',
    operators: 'Operadores',
    cranes: 'Grúas',
    costs: 'Costos',
    invoices: 'Facturas',
    settings: 'Configuración',
    users: 'Usuarios',
    activity: 'Actividad',
    backup: 'Backup',
    notifications: 'Notificaciones',
    other: 'Otros',
  };
  return labels[module] ?? module;
}

export function moduleNavigationPath(module: AuditModule): string {
  const paths: Record<AuditModule, string> = {
    services: '/services',
    clients: '/clients',
    operators: '/operators',
    cranes: '/cranes',
    costs: '/costs',
    invoices: '/invoices',
    settings: '/settings',
    users: '/settings',
    activity: '/settings',
    backup: '/settings',
    notifications: '/settings',
    other: '/',
  };
  return paths[module] ?? '/';
}

export function formatDateGroupLabel(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTimeLabel(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function getDateKey(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export function buildCsvContent(entries: AuditEntry[]): string {
  const headers = ['Fecha', 'Hora', 'Módulo', 'Operación', 'Descripción', 'Usuario', 'Email', 'Tabla'];
  const rows = entries.map((e) => [
    e.timestamp.slice(0, 10),
    formatTimeLabel(e.timestamp),
    moduleLabel(e.module),
    e.operation,
    formatAuditDescription(e),
    e.userName || 'Sistema',
    e.userEmail || '',
    e.tableName,
  ]);
  return [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
