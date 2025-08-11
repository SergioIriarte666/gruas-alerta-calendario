import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Edit, Eye, Users } from 'lucide-react';
import { CostCenterWithStats } from '@/types/costCenters';

interface CostCentersTableProps {
  costCenters: CostCenterWithStats[];
  onEdit: (costCenter: CostCenterWithStats) => void;
  loading?: boolean;
}

export const CostCentersTable = ({ costCenters, onEdit, loading }: CostCentersTableProps) => {
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

  const renderCenterRow = (center: CostCenterWithStats, level = 0) => {
    const rows = [];
    const paddingLeft = level * 24;

    rows.push(
      <TableRow key={center.id}>
        <TableCell style={{ paddingLeft: `${paddingLeft + 16}px` }}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{center.code}</span>
            {center.children && center.children.length > 0 && (
              <Users className="w-4 h-4 text-muted-foreground" />
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
              <Progress 
                value={Math.min(center.budget_used_percentage, 100)} 
                className="h-2"
              />
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(center)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
            >
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );

    // Render children
    if (center.children) {
      center.children.forEach(child => {
        rows.push(...renderCenterRow(child as CostCenterWithStats, level + 1));
      });
    }

    return rows;
  };

  const hierarchicalCenters = buildHierarchy(costCenters);

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (costCenters.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No hay centros de costo registrados</p>
      </div>
    );
  }

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