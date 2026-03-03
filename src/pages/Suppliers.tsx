import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Building2, Upload, Plus, FileText, CreditCard, Calendar, Receipt } from 'lucide-react';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { XMLDocumentUpload } from '@/components/suppliers/XMLDocumentUpload';
import { SupplierList } from '@/components/suppliers/SupplierList';
import { PaymentList } from '@/components/suppliers/PaymentList';
import { SupplierPaymentCalendar } from '@/components/suppliers/SupplierPaymentCalendar';
import { SupplierForm } from '@/components/suppliers/SupplierForm';
import { PaymentForm } from '@/components/suppliers/PaymentForm';
import { RegisterPaymentModal } from '@/components/suppliers/RegisterPaymentModal';
import { useSupplierStats } from '@/hooks/useSupplierStats';

export const Suppliers: React.FC = () => {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [showXMLUpload, setShowXMLUpload] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRegisterPayment, setShowRegisterPayment] = useState(false);
  const { data: stats, isLoading: statsLoading } = useSupplierStats();
  const isMobile = useIsMobile();

  const handleXMLUploadSuccess = (count: number) => {
    console.log(`${count} proveedores importados exitosamente`);
    setShowXMLUpload(false);
  };

  const handleSupplierCreated = () => {
    setShowSupplierForm(false);
  };

  const handlePaymentCreated = () => {
    setShowPaymentForm(false);
  };

  return (
    <div className={`min-h-screen bg-background text-foreground ${isMobile ? 'p-3' : 'p-6'} suppliers-scope`}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
          <div>
            <h1 className={`${isMobile ? 'text-xl' : 'text-3xl'} font-bold flex items-center gap-3`}>
              <Building2 className={`${isMobile ? 'h-6 w-6' : 'h-8 w-8'} text-primary`} />
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
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Importar XML</span>
              <span className="sm:hidden">XML</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowRegisterPayment(true)}
              className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white"
            >
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Registrar Pago</span>
              <span className="sm:hidden">Pago</span>
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Pago</span>
              <span className="sm:hidden">+ Pago</span>
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowSupplierForm(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Proveedor</span>
              <span className="sm:hidden">+ Prov.</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Proveedores
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_suppliers}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.active_suppliers} activos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pagos Pendientes
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_pending_payments}</div>
                <p className="text-xs text-muted-foreground">
                  ${stats.total_pending_amount.toLocaleString('es-CL')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pagos Vencidos
                </CardTitle>
                <FileText className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.total_overdue_payments}</div>
                <p className="text-xs text-muted-foreground">
                  ${stats.total_overdue_amount.toLocaleString('es-CL')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Categorías
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
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
            <CustomTabsTrigger value="suppliers">
              <Building2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Proveedores</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="payments">
              <CreditCard className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Pagos</span>
            </CustomTabsTrigger>
            <CustomTabsTrigger value="calendar">
              <Calendar className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Calendario</span>
            </CustomTabsTrigger>
          </CustomTabsList>

          <CustomTabsContent value="suppliers" className="mt-6">
            <SupplierList />
          </CustomTabsContent>

          <CustomTabsContent value="payments" className="mt-6">
            <PaymentList />
          </CustomTabsContent>

          <CustomTabsContent value="calendar" className="mt-6">
            <SupplierPaymentCalendar />
          </CustomTabsContent>
        </CustomTabs>

        {/* XML Document Upload Modal */}
        {showXMLUpload && (
          <XMLDocumentUpload
            isOpen={showXMLUpload}
            onClose={() => setShowXMLUpload(false)}
            onSuccess={() => {
              setShowXMLUpload(false);
            }}
          />
        )}

        {showSupplierForm && (
          <SupplierForm
            onClose={() => setShowSupplierForm(false)}
            onSave={handleSupplierCreated}
          />
        )}

        {showPaymentForm && (
          <PaymentForm
            onClose={() => setShowPaymentForm(false)}
            onSave={handlePaymentCreated}
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