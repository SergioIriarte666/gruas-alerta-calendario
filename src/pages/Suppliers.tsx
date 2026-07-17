import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { MetricCard } from '@/components/ui/metric-card';
import { SectionCard } from '@/components/ui/section-card';
import { Building2, Upload, Plus, CreditCard, Calendar, Receipt, AlertTriangle, CheckCircle2, Clock, TrendingUp, Handshake } from 'lucide-react';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { XMLDocumentUpload } from '@/components/suppliers/XMLDocumentUpload';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { PaymentList } from '@/components/suppliers/PaymentList';
import { SupplierPaymentCalendar } from '@/components/suppliers/SupplierPaymentCalendar';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { RegisterPaymentModal } from '@/components/suppliers/RegisterPaymentModal';
import { useSupplierStats } from '@/hooks/useSupplierStats';
import { formatCurrency } from '@/lib/utils';

export const Suppliers: React.FC = () => {
  const [activeTab, setActiveTab] = useState('payments');
  const [showXMLUpload, setShowXMLUpload] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showRegisterPayment, setShowRegisterPayment] = useState(false);
  const { data: stats } = useSupplierStats();
  const isMobile = useIsMobile();

  return (
    <div className="suppliers-concept space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="dashboard-section-kicker"><Handshake className="size-3.5" />Abastecimiento</span>
            <h1 className="dashboard-section-title">Proveedores</h1>
            <p className="dashboard-section-description">Proveedores, pagos y vencimientos del ciclo de abastecimiento.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowXMLUpload(true)}
              className="flex items-center gap-2 border-border/70 bg-card/70"
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Importar XML</span>
              <span className="sm:hidden">XML</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowRegisterPayment(true)}
              className="dashboard-report-button flex items-center gap-2"
            >
              <Receipt className="size-4" />
              <span className="hidden sm:inline">Registrar Pago</span>
              <span className="sm:hidden">Pago</span>
            </Button>
            <Button 
              size="sm"
              variant="outline"
              onClick={() => setShowSupplierForm(true)}
              className="flex items-center gap-2 border-border/70 bg-card/70"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo Proveedor</span>
              <span className="sm:hidden">+ Prov.</span>
            </Button>
          </div>
        </div>

        {stats && (
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'}`}>
            <MetricCard title="Proveedores" value={stats.total_suppliers} description={`${stats.active_suppliers} activos`} icon={Building2} tone="primary" variant="control" />
            <MetricCard title="Pendientes" value={stats.total_pending_payments} description={formatCurrency(stats.total_pending_amount)} icon={Clock} tone="warning" variant="control" />
            <MetricCard title="Vencidos" value={stats.total_overdue_payments} description={formatCurrency(stats.total_overdue_amount)} icon={AlertTriangle} tone="danger" variant="control" />
            <MetricCard title="Pagado este Mes" value={stats.paid_count_this_month} description={formatCurrency(stats.total_paid_this_month)} icon={CheckCircle2} tone="success" variant="control" />
            <MetricCard title="Categorías" value={Object.keys(stats.suppliers_by_category).length} description="Tipos de proveedores" icon={TrendingUp} tone="info" variant="control" />
          </div>
        )}

        <SectionCard flush className="inventory-panel border-border/70 bg-card/80 shadow-sm" contentClassName="p-2">
        <CustomTabs value={activeTab} onValueChange={setActiveTab}>
          <CustomTabsList className="inventory-tabs grid h-auto w-full grid-cols-3 gap-1 p-1">
            <CustomTabsTrigger value="payments">
              <CreditCard className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Pagos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="suppliers">
              <Building2 className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Proveedores</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="calendar">
              <Calendar className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Calendario</span>
            </CustomTabsTrigger>
          </CustomTabsList>

          <CustomTabsContent value="payments" className="mt-6">
            <PaymentList />
          </CustomTabsContent>

          <CustomTabsContent value="suppliers" className="mt-6">
            <SupplierList />
          </CustomTabsContent>

          <CustomTabsContent value="calendar" className="mt-6">
            <SupplierPaymentCalendar />
          </CustomTabsContent>
        </CustomTabs>
        </SectionCard>

        {showXMLUpload && (
          <XMLDocumentUpload
            isOpen={showXMLUpload}
            onClose={() => setShowXMLUpload(false)}
            onSuccess={() => setShowXMLUpload(false)}
          />
        )}

        {showSupplierForm && (
          <SupplierForm
            onClose={() => setShowSupplierForm(false)}
            onSave={() => setShowSupplierForm(false)}
          />
        )}

        {showRegisterPayment && (
          <RegisterPaymentModal
            onClose={() => setShowRegisterPayment(false)}
            onSuccess={() => setShowRegisterPayment(false)}
          />
        )}
    </div>
  );
};
