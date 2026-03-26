import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [isCreditorFormOpen, setIsCreditorFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtWithProgress | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground">Gestión de deudas, cuotas y obligaciones financieras</p>
        </div>
        <Button onClick={() => setIsDebtFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nueva Deuda
        </Button>
      </div>

      <APDashboardCards />

      <Tabs defaultValue="installments" className="w-full">
        <TabsList>
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
