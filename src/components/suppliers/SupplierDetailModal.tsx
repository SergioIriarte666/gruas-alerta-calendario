import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { Building2, FileText, CreditCard, Package, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SupplierWithStats } from '@/types/suppliers';
import { useSupplierDetail } from '@/hooks/useSupplierDetail';
import { SupplierGeneralTab } from './detail/SupplierGeneralTab';
import { SupplierDocumentsTab } from './detail/SupplierDocumentsTab';
import { SupplierPaymentsTab } from './detail/SupplierPaymentsTab';
import { SupplierInventoryAndPartsTab } from './detail/SupplierInventoryAndPartsTab';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface SupplierDetailModalProps {
  supplier: SupplierWithStats | null;
  isOpen: boolean;
  onClose: () => void;
}

interface StatCardProps {
  title: string;
  value: string;
  count: number;
  countLabel: string;
  icon: React.ElementType;
  iconColor: string;
  cardClassName?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, value, count, countLabel, icon: Icon, iconColor, cardClassName, isLoading 
}) => (
  <Card className={`border-border/70 bg-card shadow-sm ${cardClassName ?? ''}`}>
    <CardContent className="p-4">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{count} {countLabel}</p>
          </div>
          <Icon className={`size-8 ${iconColor}`} />
        </div>
      )}
    </CardContent>
  </Card>
);

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier, isOpen, onClose,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const { payments, invoices, inventoryMovements, craneParts, stats, isLoading } = useSupplierDetail(supplier?.id ?? null, isOpen);

  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl border-border/70 bg-card p-0">
        <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            Detalles del Proveedor: {supplier.name}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <StatCard
            title="Total Pendiente"
            value={formatCurrency(stats.totalPending)}
            count={stats.pendingCount}
            countLabel="pendientes"
            icon={DollarSign}
            iconColor="text-warning"
            cardClassName="border-warning/20 bg-warning/5"
            isLoading={isLoading}
          />
          <StatCard
            title="Total Pagado"
            value={formatCurrency(stats.totalPaid)}
            count={stats.paidCount}
            countLabel="pagados"
            icon={CheckCircle2}
            iconColor="text-success"
            cardClassName="border-success/20 bg-success/5"
            isLoading={isLoading}
          />
          <StatCard
            title="Vencido"
            value={formatCurrency(stats.totalOverdue)}
            count={stats.overdueCount}
            countLabel="vencidos"
            icon={AlertTriangle}
            iconColor="text-danger"
            cardClassName="border-danger/20 bg-danger/5"
            isLoading={isLoading}
          />
          <StatCard
            title="Movimientos"
            value={String(stats.inventoryMovementsCount + stats.cranePartsCount)}
            count={stats.inventoryMovementsCount}
            countLabel="inventario"
            icon={Package}
            iconColor="text-info"
            cardClassName="border-info/20 bg-info/5"
            isLoading={isLoading}
          />
        </div>

        {/* Tabs - reduced from 5 to 4 */}
        <CustomTabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <CustomTabsList className="grid w-full grid-cols-4 gap-1">
            <CustomTabsTrigger value="general">
              <Building2 className="size-4 mr-2" />
              <span className="hidden sm:inline">General</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="documents">
              <FileText className="size-4 mr-2" />
              <span className="hidden sm:inline">Documentos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="payments">
              <CreditCard className="size-4 mr-2" />
              <span className="hidden sm:inline">Pagos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="inventory">
              <Package className="size-4 mr-2" />
              <span className="hidden sm:inline">Inventario</span>
            </CustomTabsTrigger>
          </CustomTabsList>

          <CustomTabsContent value="general" className="mt-6">
            <SupplierGeneralTab supplier={supplier} />
          </CustomTabsContent>

          <CustomTabsContent value="documents" className="mt-6">
            <SupplierDocumentsTab invoices={invoices} isLoading={isLoading} />
          </CustomTabsContent>

          <CustomTabsContent value="payments" className="mt-6">
            <SupplierPaymentsTab payments={payments} isLoading={isLoading} />
          </CustomTabsContent>

          <CustomTabsContent value="inventory" className="mt-6">
            <SupplierInventoryAndPartsTab
              movements={inventoryMovements}
              parts={craneParts}
              isLoading={isLoading}
            />
          </CustomTabsContent>
        </CustomTabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
