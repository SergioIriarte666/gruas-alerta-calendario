
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, Plus, Truck, ArrowUpDown, ArrowUp, ArrowDown, Power } from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { CranesMobileView } from './CranesMobileView';
import { getCraneStatusLabel, isCranePermanentlyLocked } from '@/utils/craneStatus';
import { getCraneTypeLabel } from '@/utils/craneType';
import { ComplianceBadge } from '@/components/shared/ComplianceBadge';
import type { FleetComplianceRow } from '@/hooks/useFleetCompliance';

export type CraneSortField = 'licensePlate' | 'ownerCompanyRut' | 'brand' | 'type' | 'technicalReviewExpiry' | 'insuranceExpiry' | 'circulationPermitExpiry' | 'isActive';
export type SortDirection = 'asc' | 'desc';

interface CranesTableProps {
  cranes: Crane[];
  totalCranes: number;
  onEdit: (crane: Crane) => void;
  onDelete: (crane: Crane) => void;
  onToggleStatus: (crane: Crane) => void;
  onViewDetails: (crane: Crane) => void;
  onNewCrane: () => void;
  searchTerm: string;
  sortField?: CraneSortField;
  sortDirection?: SortDirection;
  onSort?: (field: CraneSortField) => void;
  fleetComplianceByResourceId?: Map<string, FleetComplianceRow>;
}

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: CraneSortField; 
  currentSortField?: CraneSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 size-4 text-primary" /> : 
    <ArrowDown className="ml-2 size-4 text-primary" />;
};

export const CranesTable = ({
  cranes,
  totalCranes,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewCrane,
  searchTerm,
  sortField,
  sortDirection,
  onSort,
  fleetComplianceByResourceId,
}: CranesTableProps) => {
  const { isMobile } = useDeviceType();

  // Render mobile view if on mobile device
  if (isMobile) {
    return (
      <CranesMobileView
        cranes={cranes}
        totalCranes={totalCranes}
        onEdit={onEdit}
        onDelete={onDelete}
        onViewDetails={onViewDetails}
        onNewCrane={onNewCrane}
        searchTerm={searchTerm}
        fleetComplianceByResourceId={fleetComplianceByResourceId}
      />
    );
  }

  // Desktop view (unchanged functionality)
  if (cranes.length === 0 && searchTerm) {
    return (
      <Card className="resources-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-8 text-center">
          <Truck className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">No se encontraron grúas</h3>
          <p className="mb-4 text-muted-foreground">
            No hay grúas que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewCrane}>
            <Plus className="size-4 mr-2" />
            Agregar Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cranes.length === 0) {
    return (
      <Card className="resources-panel border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-8 text-center">
          <Truck className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">No hay grúas registradas</h3>
          <p className="mb-4 text-muted-foreground">
            Comienza agregando tu primera grúa al sistema
          </p>
          <Button onClick={onNewCrane}>
            <Plus className="size-4 mr-2" />
            Agregar Primera Grúa
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="resources-panel border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-foreground flex items-center justify-between">
          <span>Grúas Registradas ({totalCranes})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('licensePlate')}
                >
                  <div className="flex items-center">
                    Patente
                    <SortIcon field="licensePlate" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                  onClick={() => onSort?.('ownerCompanyRut')}
                >
                  <div className="flex items-center">
                    Empresa
                    <SortIcon field="ownerCompanyRut" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('brand')}
                >
                  <div className="flex items-center">
                    Marca/Modelo
                    <SortIcon field="brand" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('type')}
                >
                  <div className="flex items-center">
                    Tipo
                    <SortIcon field="type" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('technicalReviewExpiry')}
                >
                  <div className="flex items-center">
                    Rev. Técnica
                    <SortIcon field="technicalReviewExpiry" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('insuranceExpiry')}
                >
                  <div className="flex items-center">
                    Seguro
                    <SortIcon field="insuranceExpiry" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('circulationPermitExpiry')}
                >
                  <div className="flex items-center">
                    Permiso Circ.
                    <SortIcon field="circulationPermitExpiry" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground">
                  Aptitud
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('isActive')}
                >
                  <div className="flex items-center">
                    Estado
                    <SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cranes.map((crane) => (
                <tr key={crane.id} className="border-b border-border/60 hover:bg-accent/20">
                  <td className="py-3 px-4 text-foreground font-medium">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {crane.licensePlate}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {crane.ownerCompanyName || crane.ownerCompanyRut || 'Sin empresa'}
                  </td>
                  <td className="py-3 px-4 text-foreground">{crane.brand} {crane.model}</td>
                  <td className="py-3 px-4 text-foreground">{getCraneTypeLabel(crane.type)}</td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.technicalReviewExpiry)}
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.insuranceExpiry)}
                  </td>
                  <td className="py-3 px-4 text-foreground">
                    {formatForDisplay(crane.circulationPermitExpiry)}
                  </td>
                  <td className="py-3 px-4">
                    {(() => {
                      const compliance = fleetComplianceByResourceId?.get(crane.id);
                      const tooltip = compliance?.next_item_label
                        ? `${compliance.next_item_label}${compliance.next_expiry_date ? ` · ${formatForDisplay(compliance.next_expiry_date)}` : ''}`
                        : undefined;

                      return compliance ? (
                        <ComplianceBadge
                          level={compliance.worst_level}
                          tooltip={tooltip}
                        />
                      ) : null;
                    })()}
                  </td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={crane.isActive ? "default" : "secondary"}
                      className={crane.isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                      }
                    >
                      {getCraneStatusLabel(crane.status)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(crane)}
                        className="border border-info/30 text-info hover:bg-info-soft/60 hover:text-info"
                        title="Ver detalles"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(crane)}
                        disabled={isCranePermanentlyLocked(crane)}
                        className="border border-primary/30 text-primary hover:bg-primary-soft hover:text-primary"
                        title="Editar grúa"
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(crane)}
                        disabled={isCranePermanentlyLocked(crane)}
                        className={crane.isActive ? "border border-warning/30 text-warning hover:bg-warning/10 hover:text-warning" : "border border-success/30 text-success hover:bg-success/10 hover:text-success"}
                        title={crane.isActive ? 'Desactivar grúa' : 'Activar grúa'}
                      >
                        <Power className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(crane)}
                        disabled={isCranePermanentlyLocked(crane)}
                        className="border border-danger/30 text-danger hover:bg-danger-soft/70 hover:text-danger"
                        title="Eliminar grúa"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
