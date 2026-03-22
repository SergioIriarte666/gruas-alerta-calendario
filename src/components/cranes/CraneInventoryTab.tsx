
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Package, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  DollarSign,
  Calendar,
  ArrowUpDown,
  Warehouse,
  ShoppingCart,
  RefreshCw,
  Loader2,
  Activity,
  FileDown
} from 'lucide-react';
import { Crane } from '@/types';
import { useCraneInventoryMetrics } from '@/hooks/useCraneInventoryMetrics';
import { useInventoryMovements } from '@/hooks/useInventory';
import { usePartsTraceability, useInventorySyncStats, useMigrateUnsyncParts } from '@/hooks/useUnifiedParts';
import { useInventorySyncWatcher } from '@/hooks/useInventorySyncWatcher';
import DatePickerInput from '@/components/common/DatePickerInput';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';
import { createExportFileName } from '@/utils/reports/reportUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CraneInventoryTabProps {
  crane: Crane;
}

export const CraneInventoryTab = ({ crane }: CraneInventoryTabProps) => {
  // Activar watcher de sincronización en tiempo real
  useInventorySyncWatcher(crane.id);
  
  const { data: metrics, isLoading: metricsLoading } = useCraneInventoryMetrics(crane.id);
  const { data: movements, isLoading: movementsLoading } = useInventoryMovements(10);
  const { data: traceabilityData, isLoading: traceabilityLoading } = usePartsTraceability(crane.id);
  const { data: syncStats } = useInventorySyncStats();
  const migrateMutation = useMigrateUnsyncParts();
  const { settings } = useSettings();

  const [reportDateFrom, setReportDateFrom] = useState<string>('');
  const [reportDateTo, setReportDateTo] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const reportRange = useMemo(() => {
    if (!reportDateFrom || !reportDateTo) return null;
    const start = new Date(`${reportDateFrom}T00:00:00`);
    const end = new Date(`${reportDateTo}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start, end };
  }, [reportDateFrom, reportDateTo]);

  // Filtrar movimientos relacionados con esta grúa
  const craneMovements = movements?.filter(movement => movement.crane_id === crane.id) || [];
  const craneConsumptions = craneMovements.filter(movement => movement.movement_type === 'exit');

  if (metricsLoading || movementsLoading || traceabilityLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-400">Cargando información de inventario...</div>
      </div>
    );
  }

  const getLogoFormat = (logoUrl: string) => {
    const normalized = logoUrl.split('?')[0].toLowerCase();
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'JPEG';
    return 'PNG';
  };

  const loadImage = (url: string) =>
    new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img);
      img.src = url;
    });

  const getMovementTypeLabelForReport = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrada';
      case 'exit':
        return 'Salida';
      case 'transfer':
        return 'Transferencia';
      case 'adjustment':
        return 'Ajuste';
      default:
        return type;
    }
  };

  const getMaintenanceTypeLabel = (type: string) => {
    switch (type) {
      case 'preventive':
        return 'Preventiva';
      case 'corrective':
        return 'Correctiva';
      case 'emergency':
        return 'Emergencia';
      default:
        return type;
    }
  };

  const handleGeneratePdf = async () => {
    if (!reportRange) {
      toast.error('Rango de fechas inválido', {
        description: 'Selecciona una fecha "desde" y una fecha "hasta" para generar el reporte.',
      });
      return;
    }

    if (reportRange.start.getTime() > reportRange.end.getTime()) {
      toast.error('Rango de fechas inválido', {
        description: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
      });
      return;
    }

    if (!settings?.company) {
      toast.error('Error', { description: 'No se pudo cargar la configuración de la empresa.' });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const company = settings.company;
      const startIso = reportRange.start.toISOString();
      const endIso = reportRange.end.toISOString();

      const [inventoryRes, maintenanceRes] = await Promise.all([
        supabase
          .from('inventory_movements')
          .select(
            `
            id,
            item_id,
            location_id,
            movement_date,
            movement_type,
            quantity,
            unit_cost,
            total_cost,
            status,
            observations,
            reason,
            reference_document,
            created_at,
            created_by,
            supplier_name,
            cost_id,
            item:inventory_items(id, name, unit_of_measure),
            location:inventory_locations(id, name, code),
            supplier:inventory_suppliers(id, name),
            crane:cranes(id, license_plate),
            operator:operators(id, name),
            creator:profiles!inventory_movements_created_by_fkey(id, full_name, email)
          `
          )
          .eq('crane_id', crane.id)
          .gte('movement_date', startIso)
          .lte('movement_date', endIso)
          .order('movement_date', { ascending: true }),
        supabase
          .from('crane_maintenance')
          .select(
            `
            id,
            created_at,
            maintenance_type,
            description,
            scheduled_date,
            completed_date,
            status,
            notes,
            cost,
            provider,
            created_by,
            crane:cranes(id, license_plate),
            creator:profiles!crane_maintenance_created_by_fkey(id, full_name, email)
          `
          )
          .eq('crane_id', crane.id)
          .gte('created_at', startIso)
          .lte('created_at', endIso)
          .order('created_at', { ascending: true }),
      ]);

      if (inventoryRes.error) throw inventoryRes.error;
      if (maintenanceRes.error) throw maintenanceRes.error;

      const inventoryMovements = (inventoryRes.data || []) as Array<{
        id: string;
        item_id: string;
        location_id: string;
        movement_date: string;
        movement_type: string;
        quantity: number | null;
        unit_cost: number | null;
        total_cost: number | null;
        status: string | null;
        observations: string | null;
        reason: string | null;
        reference_document: string | null;
        created_at: string;
        created_by: string | null;
        supplier_name: string | null;
        cost_id: string | null;
        item: { id: string; name: string; unit_of_measure: string } | null;
        location: { id: string; name: string; code: string } | null;
        supplier: { id: string; name: string } | null;
        crane: { id: string; license_plate: string } | null;
        operator: { id: string; name: string } | null;
        creator: { id: string; full_name: string | null; email: string | null } | null;
      }>;

      const maintenanceRecords = (maintenanceRes.data || []) as Array<{
        id: string;
        created_at: string;
        maintenance_type: string;
        description: string;
        scheduled_date: string | null;
        completed_date: string | null;
        status: string | null;
        notes: string | null;
        cost: number | null;
        provider: string | null;
        created_by: string | null;
        crane: { id: string; license_plate: string } | null;
        creator: { id: string; full_name: string | null; email: string | null } | null;
      }>;

      const doc = new jsPDF({ orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const logoUrl = company.logo || '/logo-gruas-5-norte.png';
      const logoImg = await loadImage(logoUrl);
      const logoFormat = getLogoFormat(logoUrl);
      const generatedAtLabel = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      const rangeLabel = `${format(reportRange.start, 'dd/MM/yyyy', { locale: es })} - ${format(reportRange.end, 'dd/MM/yyyy', { locale: es })}`;
      const craneLabel = `Grúa ${crane.licensePlate}${crane.brand || crane.model ? ` • ${crane.brand} ${crane.model}` : ''}${crane.type ? ` • ${crane.type}` : ''}`;

      const drawHeader = () => {
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 26, 'F');

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont(undefined, 'bold');
        doc.text(company.name || 'Grúas 5 Norte', 14, 9);

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text('Reporte de Movimientos (Bodega y Mantenciones)', 14, 15);

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(craneLabel, 14, 20);
        doc.text(`Rango: ${rangeLabel}`, 14, 24);
        doc.text(`Generado: ${generatedAtLabel}`, pageWidth - 14, 24, { align: 'right' });

        if (logoImg?.width && logoImg?.height) {
          const maxW = 28;
          const maxH = 14;
          const ratio = Math.min(maxW / logoImg.width, maxH / logoImg.height);
          const w = logoImg.width * ratio;
          const h = logoImg.height * ratio;
          doc.addImage(logoImg, logoFormat, pageWidth - 14 - w, 4, w, h);
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(14, 27, pageWidth - 14, 27);
      };

      drawHeader();
      let cursorY = 32;

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Movimientos de Bodega (Inventario)', 14, cursorY);
      cursorY += 4;

      const inventoryMovementsDeduped = (() => {
        const toDayKey = (iso: string) => {
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return iso;
          return format(d, 'yyyy-MM-dd', { locale: es });
        };

        const pickBest = (list: typeof inventoryMovements) => {
          const withPriority = [...list].sort((a, b) => {
            const aText = `${a.reason || ''} ${a.observations || ''}`.toLowerCase();
            const bText = `${b.reason || ''} ${b.observations || ''}`.toLowerCase();
            const aHasBackfill = aText.includes('backfill');
            const bHasBackfill = bText.includes('backfill');
            if (aHasBackfill !== bHasBackfill) return aHasBackfill ? -1 : 1;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          return withPriority[0];
        };

        const byKey = new Map<string, typeof inventoryMovements>();

        for (const m of inventoryMovements) {
          const day = toDayKey(m.movement_date);
          const qty = typeof m.quantity === 'number' ? m.quantity : 0;
          const unitCost = typeof m.unit_cost === 'number' ? m.unit_cost : 0;
          const costKey = m.cost_id ? `cost:${m.cost_id}` : '';
          const itemKey = m.item_id || m.item?.id || '';
          const locKey = m.location_id || m.location?.id || '';
          const supplierKey = (m.supplier?.name || m.supplier_name || '').trim().toLowerCase();
          const reasonKey = (m.reason || '').trim().toLowerCase();
          const obsKey = (m.observations || '').trim().toLowerCase();

          const key = [
            m.movement_type || '',
            day,
            costKey || `item:${itemKey}`,
            `loc:${locKey}`,
            `qty:${qty}`,
            `uc:${unitCost}`,
            `sup:${supplierKey}`,
            `r:${reasonKey}`,
            `o:${obsKey}`,
          ].join('|');

          const existing = byKey.get(key);
          if (!existing) {
            byKey.set(key, [m]);
          } else {
            existing.push(m);
          }
        }

        const collapsed: typeof inventoryMovements = [];
        for (const group of byKey.values()) {
          collapsed.push(pickBest(group));
        }

        collapsed.sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime());
        return collapsed;
      })();

      const inventoryRows = inventoryMovementsDeduped.map((m) => {
        const dateLabel = m.movement_date ? format(new Date(m.movement_date), 'dd/MM/yyyy HH:mm', { locale: es }) : '-';
        const typeLabel = getMovementTypeLabelForReport(m.movement_type || '');
        const userLabel = m.creator?.full_name || m.creator?.email || m.created_by || '-';
        const productLabel = m.item?.name || '-';
        const qty = typeof m.quantity === 'number' ? m.quantity : 0;
        const qtyLabel = `${qty.toLocaleString('es-CL')}${m.item?.unit_of_measure ? ` ${m.item.unit_of_measure}` : ''}`;

        const origin =
          m.movement_type === 'entry'
            ? (m.supplier?.name || m.supplier_name || '-')
            : (m.location?.name || '-');

        const destination =
          m.movement_type === 'entry'
            ? (m.location?.name || '-')
            : m.crane?.license_plate
              ? `Grúa ${m.crane.license_plate}`
              : crane.licensePlate
                ? `Grúa ${crane.licensePlate}`
              : m.operator?.name
                ? `Operador ${m.operator.name}`
                : '-';

        const notes = [m.reason, m.observations].filter(Boolean).join(' · ') || '-';
        const statusLabel = m.status || '-';

        return [dateLabel, typeLabel, userLabel, productLabel, qtyLabel, origin, destination, notes, statusLabel];
      });

      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Usuario', 'Producto', 'Cantidad', 'Origen', 'Destino', 'Observaciones', 'Estado']],
        body: inventoryRows.length > 0 ? inventoryRows : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
        startY: cursorY,
        theme: 'striped',
        styles: { fontSize: 7.8, cellPadding: 2 },
        headStyles: { fillColor: [156, 250, 36], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => drawHeader(),
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20 },
          5: { cellWidth: 24 },
          6: { cellWidth: 24 },
          7: { cellWidth: 60 },
          8: { cellWidth: 16 },
        },
        margin: { left: 14, right: 14, top: 26, bottom: 14 },
      });

      cursorY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Movimientos de Mantenciones', 14, cursorY);
      cursorY += 4;

      const maintenanceRows = maintenanceRecords.map((m) => {
        const dateSource = m.completed_date || m.scheduled_date || m.created_at;
        const dateLabel = dateSource ? format(new Date(dateSource), 'dd/MM/yyyy', { locale: es }) : '-';
        const typeLabel = getMaintenanceTypeLabel(m.maintenance_type || '');
        const userLabel = m.creator?.full_name || m.creator?.email || m.created_by || '-';
        const equipmentLabel = m.crane?.license_plate ? `Grúa ${m.crane.license_plate}` : 'Grúa -';
        const qtyLabel = '-';
        const origin = m.provider || '-';
        const destination = '-';
        const notes = [m.description, m.notes].filter(Boolean).join(' · ') || '-';
        const statusLabel = m.status || '-';
        return [dateLabel, typeLabel, userLabel, equipmentLabel, qtyLabel, origin, destination, notes, statusLabel];
      });

      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Usuario', 'Equipo', 'Cantidad', 'Origen', 'Destino', 'Observaciones', 'Estado']],
        body: maintenanceRows.length > 0 ? maintenanceRows : [['-', '-', '-', '-', '-', '-', '-', '-', '-']],
        startY: cursorY,
        theme: 'striped',
        styles: { fontSize: 7.8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => drawHeader(),
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 20 },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 20 },
          5: { cellWidth: 24 },
          6: { cellWidth: 24 },
          7: { cellWidth: 72 },
          8: { cellWidth: 16 },
        },
        margin: { left: 14, right: 14, top: 26, bottom: 14 },
      });

      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`Página ${page} de ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
      }

      const fileName = createExportFileName(
        'reporte-movimientos',
        format(reportRange.start, 'yyyy-MM-dd'),
        format(reportRange.end, 'yyyy-MM-dd')
      );

      try {
        doc.save(`${fileName}.pdf`);
      } catch (e) {
        const pdfOutput = doc.output('blob');
        const url = URL.createObjectURL(pdfOutput);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.pdf`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }

      toast.success('PDF listo', {
        description: `Se generó el reporte (${rangeLabel}).`,
      });
    } catch (err) {
      toast.error('Error al generar PDF', {
        description: err instanceof Error ? err.message : 'Ocurrió un error inesperado.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getMovementTypeIcon = (type: string) => {
    switch (type) {
      case 'entry':
        return <ArrowUpDown className="w-4 h-4 text-green-400" />;
      case 'exit':
        return <ArrowUpDown className="w-4 h-4 text-red-400" />;
      default:
        return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case 'entry':
        return 'Entrada';
      case 'exit':
        return 'Salida';
      case 'transfer':
        return 'Transferencia';
      case 'adjustment':
        return 'Ajuste';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileDown className="w-5 h-5 text-primary" />
            Reporte PDF de Movimientos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Desde</span>
              <DatePickerInput
                id="crane-report-date-from"
                value={reportDateFrom}
                onChange={setReportDateFrom}
                placeholder="Seleccionar fecha"
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Hasta</span>
              <DatePickerInput
                id="crane-report-date-to"
                value={reportDateTo}
                onChange={setReportDateTo}
                placeholder="Seleccionar fecha"
              />
            </div>
            <div className="flex md:justify-end">
              <Button
                type="button"
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="w-full md:w-auto"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Generar PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valor Instalado</p>
                <p className="text-2xl font-bold text-green-400">
                  +${(metrics?.installedPartsValue || 0).toLocaleString('es-CL')}
                </p>
                <p className="text-xs text-muted-foreground">{metrics?.totalPartsInstalled || 0} piezas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Valor Consumido</p>
                <p className="text-2xl font-bold text-red-400">
                  -${(metrics?.consumptionValue || 0).toLocaleString('es-CL')}
                </p>
                <p className="text-xs text-muted-foreground">{metrics?.totalInventoryConsumptions || 0} consumos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Balance Neto</p>
                <p className="text-2xl font-bold text-blue-400">
                  ${((metrics?.installedPartsValue || 0) - (metrics?.consumptionValue || 0)).toLocaleString('es-CL')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Sincronización</p>
                  <p className="text-2xl font-bold text-foreground">
                    {metrics?.syncStatus?.syncPercentage || 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.syncStatus?.syncedParts}/{metrics?.syncStatus?.totalParts} piezas
                  </p>
                </div>
              </div>
              {(metrics?.syncStatus?.unsyncedParts || 0) > 0 && (
                <Button
                  onClick={() => migrateMutation.mutate()}
                  disabled={migrateMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="ml-2"
                >
                  {migrateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado de Integración */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Estado de Integración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Trazabilidad de Piezas</span>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
              ✅ Sincronizada
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Costos de Mantenimiento</span>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
              ✅ Actualizado
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Inventario</span>
            <Badge className={
              metrics?.syncStatus?.syncPercentage === 100 
                ? "bg-green-500/20 text-green-600 border-green-500/30"
                : "bg-yellow-500/20 text-yellow-600 border-yellow-500/30"
            }>
              {metrics?.syncStatus?.syncPercentage === 100 
                ? `✅ Sincronizado (100%)` 
                : `⚠️ Parcial (${metrics?.syncStatus?.syncPercentage}%)`
              }
            </Badge>
          </div>
          {(metrics?.pendingMaintenanceAlerts || 0) > 0 && (
            <div className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <span className="text-sm text-yellow-600">Mantenimientos Pendientes</span>
              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {metrics.pendingMaintenanceAlerts} alertas
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trazabilidad de Piezas */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-tms-green" />
            Trazabilidad de Piezas e Inventario
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Piezas Sincronizadas</p>
                <p className="text-xl font-bold text-tms-green">{syncStats.synced_parts}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Sin Sincronizar</p>
                <p className="text-xl font-bold text-yellow-400">{syncStats.unsynced_parts}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">% Sincronización</p>
                <p className="text-xl font-bold text-blue-400">{syncStats.sync_percentage.toFixed(1)}%</p>
              </div>
              <div className="bg-white/5 p-3 rounded-lg">
                <p className="text-sm text-gray-400">Items Inventario</p>
                <p className="text-xl font-bold text-purple-400">{syncStats.total_inventory_items}</p>
              </div>
            </div>
          )}

          {traceabilityData && traceabilityData.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Piezas Recientes</h4>
              {traceabilityData.slice(0, 5).map((item, index) => (
                <div key={`${item.part_id}-${index}`} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-tms-green" />
                    <div>
                      <p className="text-white font-medium">{item.part_name}</p>
                      <p className="text-sm text-gray-400">
                        {item.supplier} • Stock: {item.current_stock}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={item.inventory_item_id ? 'default' : 'secondary'}
                        className={item.inventory_item_id 
                          ? 'bg-tms-green/20 text-tms-green border-tms-green/30' 
                          : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        }
                      >
                        {item.inventory_item_id ? 'Sincronizado' : 'Pendiente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ${item.purchase_cost.toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>
              ))}
              
              {traceabilityData.length > 5 && (
                <p className="text-center text-gray-400 text-sm">
                  ... y {traceabilityData.length - 5} piezas más
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin datos de trazabilidad</h3>
              <p className="text-gray-400 text-sm">
                No se encontraron piezas registradas para esta grúa.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consumos de Inventario de esta Grúa */}
      {craneConsumptions.length > 0 && (
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpDown className="w-5 h-5 text-tms-green" />
              Consumos de Inventario de esta Grúa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-300">
                <strong>Nota:</strong> Esta sección muestra únicamente los consumos (salidas) de materiales específicos de esta grúa. 
                Las compras generales de inventario se gestionan en el módulo de <strong>Inventario</strong>.
              </p>
            </div>
            <div className="space-y-4">
              {craneConsumptions.slice(0, 5).map((movement) => (
                <div key={movement.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getMovementTypeIcon(movement.movement_type)}
                    <div>
                      <p className="text-white font-medium">{movement.item?.name || 'Item no especificado'}</p>
                      <p className="text-sm text-gray-400">
                        {getMovementTypeLabel(movement.movement_type)} • Cantidad: {movement.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={movement.movement_type === 'entry' ? 'default' : 'secondary'}
                        className={movement.movement_type === 'entry' 
                          ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                          : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }
                      >
                        {movement.movement_type === 'entry' ? '+' : '-'}{movement.quantity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              
              {craneConsumptions.length > 5 && (
                <p className="text-center text-gray-400 text-sm">
                  ... y {craneConsumptions.length - 5} movimientos más
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado del Último Consumo */}
      {metrics?.lastMovementDate && (
        <Card className="bg-white/5 border-tms-green/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-tms-green" />
              Último Consumo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              Último consumo de inventario registrado el{' '}
              <span className="text-tms-green font-medium">
                {format(new Date(metrics.lastMovementDate), 'dd/MM/yyyy HH:mm', { locale: es })}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mensaje si no hay consumos */}
      {craneConsumptions.length === 0 && (
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-6">
            <div className="text-center">
              <ArrowUpDown className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin consumos registrados</h3>
              <p className="text-gray-400 text-sm mb-4">
                Esta grúa aún no tiene consumos de inventario registrados.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 max-w-md mx-auto">
                <p className="text-sm text-blue-300">
                  Para registrar consumos, dirígete al módulo de <strong>Inventario</strong> y registra una salida asignándola a esta grúa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
