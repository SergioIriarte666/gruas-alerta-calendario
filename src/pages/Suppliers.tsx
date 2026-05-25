import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Building2, Upload, Plus, CreditCard, Calendar, Receipt, AlertTriangle, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
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
    <div className={`min-h-screen bg-background text-foreground ${isMobile ? 'p-3' : 'p-6'}`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold flex items-center gap-3`}>
              <Building2 className={`${isMobile ? 'size-6' : 'size-8'} text-primary`} />
              Gestión de Proveedores
            </h1>
            {!isMobile && (
              <p className="text-muted-foreground mt-2">
                Administra proveedores, pagos y seguimiento de vencimientos
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowXMLUpload(true)}
              className="flex items-center gap-2"
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Importar XML</span>
              <span className="sm:hidden">XML</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowRegisterPayment(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Receipt className="size-4" />
              <span className="hidden sm:inline">Registrar Pago</span>
              <span className="sm:hidden">Pago</span>
            </Button>
            <Button 
              size="sm"
              variant="outline"
              onClick={() => setShowSupplierForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuevo Proveedor</span>
              <span className="sm:hidden">+ Prov.</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'}`}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
                <Building2 className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_suppliers}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active_suppliers} activos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                <Clock className="size-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.total_pending_payments}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.total_pending_amount)}
                </p>
              </CardContent>
            </Card>

            <Card className={stats.total_overdue_payments > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
                <AlertTriangle className={`size-4 ${stats.total_overdue_payments > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stats.total_overdue_payments > 0 ? 'text-destructive' : ''}`}>
                  {stats.total_overdue_payments}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.total_overdue_amount)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pagado este Mes</CardTitle>
                <CheckCircle2 className="size-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.paid_count_this_month}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(stats.total_paid_this_month)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categorías</CardTitle>
                <TrendingUp className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(stats.suppliers_by_category).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  tipos de proveedores
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content - Tabs */}
        <CustomTabs value={activeTab} onValueChange={setActiveTab}>
          <CustomTabsList className="grid w-full grid-cols-3 gap-1">
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
    </div>
  );
};
