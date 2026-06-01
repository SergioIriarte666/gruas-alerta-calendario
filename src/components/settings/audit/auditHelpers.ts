import { AuditEntry, AuditModule, tableToModule } from '@/hooks/useAuditLog';

export { tableToModule };

export function formatAuditDescription(entry: AuditEntry): string {
  const { source, operation, module, entityFolio, fieldName, changeSummary, newData, tableName } = entry;

  if (source === 'backup_logs') {
    const data = newData as any;
    return `Backup ${data?.backup_type || ''} — ${data?.status || ''}`;
  }

  if (source === 'notification_logs') {
    const data = newData as any;
    return `Notificación ${data?.type || ''} enviada a ${data?.recipient || ''}`;
  }

  if (source === 'service_change_history') {
    if (entityFolio && fieldName) {
      return `Servicio ${entityFolio}: ${fieldName} modificado`;
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
