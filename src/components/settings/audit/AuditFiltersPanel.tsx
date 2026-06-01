import { AuditFilters, AuditModule, AuditOperation, AuditUser } from '@/hooks/useAuditLog';
import { moduleLabel } from './auditHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Truck,
  Users,
  HardHat,
  Wrench,
  DollarSign,
  FileText,
  Settings,
  Shield,
  Activity,
  Database,
  Bell,
  MoreHorizontal,
  Download,
} from 'lucide-react';
import { downloadTextFile } from '@/utils/fileDownload';
import { AuditEntry } from '@/hooks/useAuditLog';
import { buildCsvContent } from './auditHelpers';

const MODULE_ICONS: Record<AuditModule, React.ElementType> = {
  services: Truck,
  clients: Users,
  operators: HardHat,
  cranes: Wrench,
  costs: DollarSign,
  invoices: FileText,
  settings: Settings,
  users: Shield,
  activity: Activity,
  backup: Database,
  notifications: Bell,
  other: MoreHorizontal,
};

const ALL_MODULES: AuditModule[] = [
  'services',
  'clients',
  'operators',
  'cranes',
  'costs',
  'invoices',
  'settings',
  'users',
  'activity',
  'backup',
  'notifications',
  'other',
];

const OPERATION_STYLES: Record<AuditOperation, string> = {
  INSERT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  UPDATE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const OPERATION_LABELS: Record<AuditOperation, string> = {
  INSERT: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
};

const ALL_OPERATIONS: AuditOperation[] = ['INSERT', 'UPDATE', 'DELETE'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

interface AuditFiltersPanelProps {
  filters: AuditFilters;
  onFiltersChange: (f: AuditFilters) => void;
  availableUsers: AuditUser[];
  entries: AuditEntry[];
}

export const AuditFiltersPanel = ({
  filters,
  onFiltersChange,
  availableUsers,
  entries,
}: AuditFiltersPanelProps) => {
  const set = (partial: Partial<AuditFilters>) => onFiltersChange({ ...filters, ...partial });

  const toggleModule = (m: AuditModule) => {
    const next = filters.modules.includes(m)
      ? filters.modules.filter((x) => x !== m)
      : [...filters.modules, m];
    set({ modules: next });
  };

  const toggleOperation = (op: AuditOperation) => {
    const next = filters.operations.includes(op)
      ? filters.operations.filter((x) => x !== op)
      : [...filters.operations, op];
    set({ operations: next });
  };

  const handleClear = () => {
    onFiltersChange({
      dateFrom: today(),
      dateTo: null,
      modules: [],
      operations: [],
      userId: null,
      search: '',
    });
  };

  const handleExportCsv = () => {
    const csv = buildCsvContent(entries);
    downloadTextFile({
      content: csv,
      fileName: `auditoria-${today()}.csv`,
      contentType: 'text/csv;charset=utf-8;',
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/80 p-4 text-sm">
      {/* Rango de fechas */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Rango de fechas</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            onClick={() => set({ dateFrom: today(), dateTo: null })}
          >
            Hoy
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 flex-1 px-2 text-xs"
            onClick={() => set({ dateFrom: daysAgo(7), dateTo: today() })}
          >
            7 días
          </Button>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Desde</Label>
          <Input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => set({ dateFrom: e.target.value || null })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Hasta</Label>
          <Input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => set({ dateTo: e.target.value || null })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Módulo */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Módulo</p>
        <div className="space-y-1.5">
          {ALL_MODULES.map((m) => {
            const Icon = MODULE_ICONS[m];
            return (
              <label key={m} className="flex cursor-pointer items-center gap-2 hover:text-foreground">
                <Checkbox
                  checked={filters.modules.includes(m)}
                  onCheckedChange={() => toggleModule(m)}
                  className="size-3.5"
                />
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{moduleLabel(m)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Operación */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Operación</p>
        <div className="flex flex-col gap-1.5">
          {ALL_OPERATIONS.map((op) => (
            <label key={op} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={filters.operations.includes(op)}
                onCheckedChange={() => toggleOperation(op)}
                className="size-3.5"
              />
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OPERATION_STYLES[op]}`}>
                {OPERATION_LABELS[op]}
              </span>
            </label>
          ))}
        </div>
      </div>

      <hr className="border-border/50" />

      {/* Usuario */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Usuario</p>
        <Select
          value={filters.userId ?? 'all'}
          onValueChange={(v) => set({ userId: v === 'all' ? null : v })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {availableUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border/50" />

      {/* Búsqueda */}
      <div className="space-y-2">
        <p className="font-medium text-foreground">Buscar</p>
        <Input
          placeholder="Folio, campo, usuario…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      <hr className="border-border/50" />

      {/* Botones */}
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={handleClear}>
          Limpiar filtros
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full gap-1.5 text-xs"
          onClick={handleExportCsv}
        >
          <Download className="size-3.5" />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
};
