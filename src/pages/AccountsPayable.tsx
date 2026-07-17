import React, { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Landmark, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { APDashboardCards } from '@/components/accounts-payable/APDashboardCards';
import { DebtList } from '@/components/accounts-payable/DebtList';
import { MonthlyInstallments } from '@/components/accounts-payable/MonthlyInstallments';
import { DebtCalendar } from '@/components/accounts-payable/DebtCalendar';
import { DebtForm } from '@/components/accounts-payable/DebtForm';
import { CreditorForm } from '@/components/accounts-payable/CreditorForm';
import { DebtDetailModal } from '@/components/accounts-payable/DebtDetailModal';
import { DebtWithProgress } from '@/hooks/useDebts';
import { CreditorList } from '@/components/accounts-payable/CreditorList';

const AccountsPayable = () => {
  const isMobile = useIsMobile();
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isCreditorFormOpen, setIsCreditorFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtWithProgress | null>(null);

  return (
    <div className="accounts-payable-concept space-y-6 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="dashboard-section-kicker"><Landmark className="size-3.5" />Tesorería</span>
          <h1 className="dashboard-section-title">Cuentas por Pagar</h1>
          <p className="dashboard-section-description">Deudas, cuotas, vencimientos y acreedores bajo control.</p>
        </div>
        <Button className="dashboard-report-button" onClick={() => setIsDebtFormOpen(true)} size={isMobile ? 'sm' : 'default'}>
          <Plus className="size-4 mr-1" /> Nueva Deuda
        </Button>
      </div>

      <APDashboardCards />

      <Tabs defaultValue="installments" className="w-full">
        <TabsList className="finance-tabs h-auto w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="installments">Cuotas del Mes</TabsTrigger>
          <TabsTrigger value="debts">Deudas</TabsTrigger>
          <TabsTrigger value="calendar">Calendario</TabsTrigger>
          <TabsTrigger value="creditors">Acreedores</TabsTrigger>
        </TabsList>

        <TabsContent value="installments">
          <MonthlyInstallments />
        </TabsContent>

        <TabsContent value="debts">
          <DebtList
            onCreateDebt={() => setIsDebtFormOpen(true)}
            onViewDebt={(debt) => setSelectedDebt(debt)}
          />
        </TabsContent>

        <TabsContent value="calendar">
          <DebtCalendar />
        </TabsContent>
        
        <TabsContent value="creditors" className="mt-6">
          <CreditorList />
        </TabsContent>
      </Tabs>

      <DebtForm
        open={isDebtFormOpen}
        onOpenChange={setIsDebtFormOpen}
        onCreateCreditor={() => setIsCreditorFormOpen(true)}
      />

      <CreditorForm
        open={isCreditorFormOpen}
        onOpenChange={setIsCreditorFormOpen}
      />

      {selectedDebt && (
        <DebtDetailModal
          debt={selectedDebt}
          open={!!selectedDebt}
          onOpenChange={(open) => !open && setSelectedDebt(null)}
        />
      )}
    </div>
  );
};

export default AccountsPayable;
