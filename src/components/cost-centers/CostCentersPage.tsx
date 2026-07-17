import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCostCentersWithStats } from '@/hooks/useCostCenters';
import { CostCenterForm } from './CostCenterForm';
import { CostCenter, CostCenterWithStats } from '@/types/costCenters';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Eye, Edit, ChevronDown, ChevronRight, AlertTriangle, BookOpen, Loader2, Target } from 'lucide-react';
import { usePDFGeneration } from '@/hooks/usePDFGeneration';
import { generateCostManualPDF } from '@/utils/pdf/costManualPdfGenerator';
import { cn } from '@/lib/utils';
import { createLogger } from '@/lib/logger';

const _logger = createLogger('CostCentersPage');

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return fmt(n);
};

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'mensual',
  quarterly: 'trimestral',
  yearly: 'anual',
};

type CenterNode = CostCenterWithStats & { children: CenterNode[] };

function buildTree(centers: CostCenterWithStats[]): CenterNode[] {
  const map = new Map<string, CenterNode>();
  centers.forEach(c => map.set(c.id, { ...c, children: [] }));
  const roots: CenterNode[] = [];
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function usageColor(pct: number) {
  if (pct > 100) return 'text-destructive';
  if (pct > 80) return 'text-warning';
  return 'text-success';
}

function barColor(pct: number) {
  if (pct > 100) return 'bg-destructive';
  if (pct > 80) return 'bg-warning';
  return 'bg-success';
}

interface CenterRowProps {
  node: CenterNode;
  level: number;
  onEdit: (c: CostCenterWithStats) => void;
  onDrillDown: (c: CostCenterWithStats) => void;
}

function CenterRow({ node, level, onEdit, onDrillDown }: CenterRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const hasBudget = Number(node.budget_amount) > 0;
  const pct = node.budget_used_percentage;
  const isOver = pct > 100;
  const isWarn = pct > 80 && pct <= 100;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors',
          level > 0 && 'bg-muted/10',
          isOver && 'border-l-2 border-l-destructive',
          isWarn && 'border-l-2 border-l-warning',
        )}
        style={{ paddingLeft: `${16 + level * 28}px` }}
      >
        {/* Expand toggle */}
        <button
          className="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={() => hasChildren && setExpanded(e => !e)}
          aria-label={expanded ? 'Contraer' : 'Expandir'}
        >
          {hasChildren
            ? expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />
            : <span className="size-4" />}
        </button>

        {/* Code badge */}
        <span className="font-mono text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0 min-w-[44px] text-center">
          {node.code}
        </span>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{node.name}</div>
          {node.description && (
            <div className="text-xs text-muted-foreground truncate">{node.description}</div>
          )}
        </div>

        {/* Status badge */}
        {isOver ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1 flex-shrink-0">
            <AlertTriangle className="size-3" /> Excedido
          </span>
        ) : isWarn ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning flex-shrink-0">
            {Math.round(pct)}%
          </span>
        ) : (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full flex-shrink-0',
            node.is_active
              ? 'bg-success/10 text-success'
              : 'bg-muted text-muted-foreground'
          )}>
            {node.is_active ? 'Activo' : 'Inactivo'}
          </span>
        )}

        {/* Budget bar */}
        <div className="flex-shrink-0 w-48">
          {hasBudget ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground font-medium">{fmtCompact(node.total_costs)}</span>
                <span className={cn('font-medium', usageColor(pct))}>
                  {Math.round(pct)}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor(pct))}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {fmtCompact(Number(node.budget_amount))} · {PERIOD_LABEL[node.budget_period || 'monthly'] || 'mensual'}
              </div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">{fmtCompact(node.total_costs)}</div>
              <div className="text-xs text-muted-foreground">sin presupuesto</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onDrillDown(node)}
            title="Ver costos de este centro"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onEdit(node)}
            title="Editar"
          >
            <Edit className="size-4" />
          </Button>
        </div>
      </div>

      {expanded && node.children.map(child => (
        <CenterRow
          key={child.id}
          node={child}
          level={level + 1}
          onEdit={onEdit}
          onDrillDown={onDrillDown}
        />
      ))}
    </>
  );
}

export const CostCentersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState<CostCenter | null>(null);
  const [search, setSearch] = useState('');

  const { data: costCenters = [], isLoading } = useCostCentersWithStats();
  const { isGenerating, generateAndDownload } = usePDFGeneration();

  const handleDownloadManual = () => generateAndDownload(generateCostManualPDF, 'Manual de Costos');

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel('cost-center-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cost_centers' }, () => {
        queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
        queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
      });
    channel.subscribe();
    return () => { void channel.unsubscribe(); };
  }, [queryClient]);

  const handleEdit = (center: CostCenterWithStats) => {
    setSelectedCenter(center);
    setIsFormOpen(true);
  };

  const handleDrillDown = (center: CostCenterWithStats) => {
    navigate(`/costs?costCenter=${center.id}`);
  };

  // Métricas globales
  const metrics = useMemo(() => {
    const active = costCenters.filter(c => c.is_active);
    const withBudget = costCenters.filter(c => Number(c.budget_amount) > 0);
    const totalBudget = withBudget.reduce((s, c) => s + Number(c.budget_amount), 0);
    const totalSpent = costCenters.reduce((s, c) => s + c.total_costs, 0);
    const over = costCenters.filter(c => Number(c.budget_amount) > 0 && c.budget_used_percentage > 100);
    return { active: active.length, total: costCenters.length, totalBudget, totalSpent, over: over.length };
  }, [costCenters]);

  const filtered = useMemo(() => {
    if (!search.trim()) return costCenters;
    const q = search.toLowerCase();
    return costCenters.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [costCenters, search]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="cost-centers-concept space-y-5 pb-6">

      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><Target className="size-3.5" />Estructura presupuestaria</span>
          <h1 className="dashboard-section-title">Centros de Costo</h1>
          <p className="dashboard-section-description">Control presupuestario por área y periodo activo.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadManual}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating
              ? <Loader2 className="size-4 animate-spin" />
              : <BookOpen className="size-4" />}
            Manual PDF
          </Button>
          <Button onClick={() => { setSelectedCenter(null); setIsFormOpen(true); }} className="dashboard-report-button gap-2">
            <Plus className="size-4" />
            Nuevo centro
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="dashboard-kpi relative rounded-xl p-4" data-tone="primary"><span className="dashboard-kpi__accent" aria-hidden="true" />
          <div className="text-xs text-muted-foreground">Centros activos</div>
          <div className="text-2xl font-semibold text-foreground mt-1">{metrics.active}</div>
          <div className="text-xs text-muted-foreground">de {metrics.total} totales</div>
        </div>
        <div className="dashboard-kpi relative rounded-xl p-4" data-tone="info"><span className="dashboard-kpi__accent" aria-hidden="true" />
          <div className="text-xs text-muted-foreground">Presupuesto período</div>
          <div className="text-xl font-semibold text-foreground mt-1">{fmtCompact(metrics.totalBudget)}</div>
          <div className="text-xs text-muted-foreground">con presupuesto asignado</div>
        </div>
        <div className="dashboard-kpi relative rounded-xl p-4" data-tone="warning"><span className="dashboard-kpi__accent" aria-hidden="true" />
          <div className="text-xs text-muted-foreground">Gasto período</div>
          <div className="text-xl font-semibold text-foreground mt-1">{fmtCompact(metrics.totalSpent)}</div>
          {metrics.totalBudget > 0 && (
            <div className="text-xs text-muted-foreground">
              {Math.round((metrics.totalSpent / metrics.totalBudget) * 100)}% del presupuesto
            </div>
          )}
        </div>
        <div className={cn('dashboard-kpi relative rounded-xl p-4', metrics.over > 0 && 'bg-destructive/10')} data-tone="danger"><span className="dashboard-kpi__accent" aria-hidden="true" />
          <div className={cn('text-xs', metrics.over > 0 ? 'text-destructive' : 'text-muted-foreground')}>
            Centros excedidos
          </div>
          <div className={cn('text-2xl font-semibold mt-1', metrics.over > 0 ? 'text-destructive' : 'text-foreground')}>
            {metrics.over}
          </div>
          <div className="text-xs text-muted-foreground">
            {metrics.over > 0 ? 'requieren atención' : 'todo dentro del presupuesto'}
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="configuration-filter-panel relative p-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, nombre o descripción..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Tabla jerárquica */}
      {costCenters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No hay centros de costo registrados</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setIsFormOpen(true)}>
            <Plus className="size-4" /> Crear el primero
          </Button>
        </div>
      ) : (
        <div className="configuration-panel border border-border/60 rounded-xl overflow-hidden bg-card">
          {/* Cabecera de columnas */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground">
            <div style={{ width: 20 }} />
            <div style={{ minWidth: 44 }}>Código</div>
            <div className="flex-1">Centro</div>
            <div style={{ width: 80 }}>Estado</div>
            <div style={{ width: 192 }}>Uso del presupuesto</div>
            <div style={{ width: 64 }}>Acciones</div>
          </div>

          {tree.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{search}&rdquo;
            </div>
          ) : (
            tree.map(node => (
              <CenterRow
                key={node.id}
                node={node}
                level={0}
                onEdit={handleEdit}
                onDrillDown={handleDrillDown}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de formulario */}
      <CostCenterForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setSelectedCenter(null); }}
        costCenter={selectedCenter}
      />
    </div>
  );
};
