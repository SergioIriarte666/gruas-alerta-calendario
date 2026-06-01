import { useState } from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuditLog, AuditEntry, AuditFilters } from '@/hooks/useAuditLog';
import { AuditFiltersPanel } from './audit/AuditFiltersPanel';
import { AuditTimeline } from './audit/AuditTimeline';
import { AuditEntityDrawer } from './audit/AuditEntityDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Shield } from 'lucide-react';

const defaultFilters: AuditFilters = {
  dateFrom: new Date().toISOString().slice(0, 10),
  dateTo: null,
  modules: [],
  operations: [],
  userId: null,
  search: '',
};

export const AuditTab = () => {
  const { isAdmin } = useUserPermissions();
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const { entries, loading, total, hasMore, availableUsers } = useAuditLog(filters, page);

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Shield className="mx-auto mb-3 size-8 opacity-40" />
          <p className="text-sm">No tienes permisos para ver el registro de auditoría.</p>
        </CardContent>
      </Card>
    );
  }

  const handleFiltersChange = (f: AuditFilters) => {
    setFilters(f);
    setPage(1);
  };

  return (
    <div className="flex gap-5 min-h-[600px]">
      {/* Panel de filtros */}
      <div className="w-52 shrink-0">
        <AuditFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          availableUsers={availableUsers}
          entries={entries}
        />
      </div>

      {/* Timeline */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{total.toLocaleString('es-CL')} eventos</span>
          {filters.dateFrom && <span>· desde {filters.dateFrom}</span>}
          {filters.dateTo && <span>hasta {filters.dateTo}</span>}
        </div>
        <AuditTimeline
          entries={entries}
          loading={loading}
          onEntryClick={setSelectedEntry}
          selectedEntryId={selectedEntry?.id ?? null}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      </div>

      {/* Drawer de detalle */}
      <AuditEntityDrawer
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
};
