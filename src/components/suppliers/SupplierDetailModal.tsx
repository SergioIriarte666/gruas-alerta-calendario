import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { Building2, FileText, CreditCard, Package, Wrench, DollarSign, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { SupplierWithStats } from '@/types/suppliers';
import { useSupplierDetail } from '@/hooks/useSupplierDetail';
import { SupplierGeneralTab } from './detail/SupplierGeneralTab';
import { SupplierDocumentsTab } from './detail/SupplierDocumentsTab';
import { SupplierPaymentsTab } from './detail/SupplierPaymentsTab';
import { SupplierInventoryTab } from './detail/SupplierInventoryTab';
import { SupplierPartsTab } from './detail/SupplierPartsTab';
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
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  count, 
  countLabel, 
  icon: Icon, 
  iconColor,
  isLoading 
}) => (
  <Card className="bg-card border">
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
            <p className="text-xs text-muted-foreground mt-1">
              {count} {countLabel}
            </p>
          </div>
          <Icon className={`h-8 w-8 ${iconColor}`} />
        </div>
      )}
    </CardContent>
  </Card>
);

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const { payments, invoices, inventoryMovements, craneParts, stats, isLoading } = useSupplierDetail(supplier?.id ?? null, isOpen);

  if (!supplier) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Detalles del Proveedor: {supplier.name}
          </DialogTitle>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <StatCard
            title="Total Pendiente"
            value={formatCurrency(stats.totalPending)}
            count={stats.pendingCount}
            countLabel="pendientes"
            icon={DollarSign}
            iconColor="text-yellow-500"
            isLoading={isLoading}
          />
          <StatCard
            title="Total Pagado"
            value={formatCurrency(stats.totalPaid)}
            count={stats.paidCount}
            countLabel="pagados"
            icon={CheckCircle2}
            iconColor="text-green-500"
            isLoading={isLoading}
          />
          <StatCard
            title="Vencido"
            value={formatCurrency(stats.totalOverdue)}
            count={stats.overdueCount}
            countLabel="vencidos"
            icon={AlertTriangle}
            iconColor="text-red-500"
            isLoading={isLoading}
          />
          <StatCard
            title="Movimientos"
            value={String(stats.inventoryMovementsCount + stats.cranePartsCount)}
            count={stats.inventoryMovementsCount}
            countLabel="inventario"
            icon={Package}
            iconColor="text-blue-500"
            isLoading={isLoading}
          />
        </div>

        {/* Tabs */}
        <CustomTabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <CustomTabsList className="grid w-full grid-cols-5 gap-1">
            <CustomTabsTrigger value="general">
              <Building2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">General</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="documents">
              <FileText className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Documentos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="payments">
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Pagos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="inventory">
              <Package className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Inventario</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="parts">
              <Wrench className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Piezas</span>
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
            <SupplierInventoryTab movements={inventoryMovements} isLoading={isLoading} />
          </CustomTabsContent>

          <CustomTabsContent value="parts" className="mt-6">
            <SupplierPartsTab parts={craneParts} isLoading={isLoading} />
          </CustomTabsContent>
        </CustomTabs>
      </DialogContent>
    </Dialog>
  );
};
