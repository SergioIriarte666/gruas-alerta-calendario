import React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Eye, Users } from 'lucide-react';
import { CostCenterWithStats } from '@/types/costCenters';
import { useIsMobile } from '@/hooks/use-mobile';

interface CostCentersTableProps {
  costCenters: CostCenterWithStats[];
  onEdit: (costCenter: CostCenterWithStats) => void;
  loading?: boolean;
}

export const CostCentersTable = ({ costCenters, onEdit, loading }: CostCentersTableProps) => {
  const isMobile = useIsMobile();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 100) return 'text-destructive';
    if (percentage > 80) return 'text-warning';
    return 'text-success';
  };

  const buildHierarchy = (centers: CostCenterWithStats[]): CostCenterWithStats[] => {
    const centerMap = new Map(centers.map(center => [center.id, { ...center, children: [] }]));
    const rootCenters: CostCenterWithStats[] = [];

    centers.forEach(center => {
      const centerWithChildren = centerMap.get(center.id)!;
      if (center.parent_id) {
        const parent = centerMap.get(center.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(centerWithChildren);
        } else {
          rootCenters.push(centerWithChildren);
        }
      } else {
        rootCenters.push(centerWithChildren);
      }
    });

    return rootCenters;
  };

  if (loading) return <div>Cargando...</div>;

  if (costCenters.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay centros de costo registrados</p>
      </div>
    );
  }

  const hierarchicalCenters = buildHierarchy(costCenters);

  const flattenHierarchy = (centers: CostCenterWithStats[], level = 0): Array<{ center: CostCenterWithStats; level: number }> => {
    const result: Array<{ center: CostCenterWithStats; level: number }> = [];
    centers.forEach(center => {
      result.push({ center, level });
      if (center.children) {
        result.push(...flattenHierarchy(center.children as CostCenterWithStats[], level + 1));
      }
    });
    return result;
  };

  if (isMobile) {
    const flatList = flattenHierarchy(hierarchicalCenters);
    return (
      <div className="space-y-3">
        {flatList.map(({ center, level }) => (
          <Card key={center.id} className="border bg-card" style={{ marginLeft: `${level * 12}px` }}>
            <CardContent className="p-4 space-y-2">
              {/* Code + Name + Status */}
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{center.code}</span>
                    {center.children && center.children.length > 0 && (
                      <Users className="size-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-semibold text-foreground text-sm truncate">{center.name}</p>
                  {center.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{center.description}</p>
                  )}
                </div>
                <Badge variant={center.is_active ? 'default' : 'secondary'} className="text-xs flex-shrink-0 ml-2">
                  {center.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              {/* Budget info */}
              {center.budget_amount > 0 ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Presupuesto: <span className="text-foreground font-medium">{formatCurrency(Number(center.budget_amount))}</span>
                    </span>
                    <span className={`font-semibold ${getUsageColor(center.budget_used_percentage)}`}>
                      {center.budget_used_percentage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(center.budget_used_percentage, 100)} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    Gastado: <span className="text-foreground font-medium">{formatCurrency(center.total_costs)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Gastado: <span className="text-foreground font-medium">{formatCurrency(center.total_costs)}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={() => onEdit(center)}>
                  <Edit className="size-4 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm">
                  <Eye className="size-4 mr-1" /> Ver
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const renderCenterRow = (center: CostCenterWithStats, level = 0) => {
    const rows = [];
    const paddingLeft = level * 24;

    rows.push(
      <TableRow key={center.id}>
        <TableCell style={{ paddingLeft: `${paddingLeft + 16}px` }}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{center.code}</span>
            {center.children && center.children.length > 0 && (
              <Users className="size-4 text-muted-foreground" />
            )}
          </div>
        </TableCell>
        <TableCell>
          <div>
            <div className="font-medium">{center.name}</div>
            {center.description && (
              <div className="text-sm text-muted-foreground">{center.description}</div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={center.is_active ? 'default' : 'secondary'}>
            {center.is_active ? 'Activo' : 'Inactivo'}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
          {center.budget_amount > 0 ? formatCurrency(Number(center.budget_amount)) : '-'}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(center.total_costs)}
        </TableCell>
        <TableCell>
          {center.budget_amount > 0 ? (
            <div className="space-y-1">
              <div className={`text-sm font-medium ${getUsageColor(center.budget_used_percentage)}`}>
                {center.budget_used_percentage.toFixed(1)}%
              </div>
              <Progress value={Math.min(center.budget_used_percentage, 100)} className="h-2" />
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(center)}>
              <Edit className="size-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Eye className="size-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );

    if (center.children) {
      center.children.forEach(child => {
        rows.push(...renderCenterRow(child as CostCenterWithStats, level + 1));
      });
    }

    return rows;
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead className="text-right">Gastado</TableHead>
            <TableHead>Uso (%)</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {hierarchicalCenters.map(center => renderCenterRow(center))}
        </TableBody>
      </Table>
    </div>
  );
};
