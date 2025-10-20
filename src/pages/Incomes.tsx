import { useState, useMemo } from 'react';
import { IncomesHeader } from '@/components/incomes/IncomesHeader';
import { IncomeForm } from '@/components/incomes/IncomeForm';
import { IncomesTable } from '@/components/incomes/IncomesTable';
import { IncomesPipelineView } from '@/components/incomes/IncomesPipelineView';
import { IncomeFilters } from '@/components/incomes/IncomeFilters';
import { useIncomes, useDeleteIncome } from '@/hooks/incomes/useIncomes';
import { IncomeWithDetails, IncomeFilters as IIncomeFilters } from '@/types/incomes';
import { exportIncomeReport } from '@/utils/reports/incomeReportExporter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const IncomesPage = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<IncomeWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');
  const [filters, setFilters] = useState<IIncomeFilters>({
    category: 'all',
    dateFrom: null,
    dateTo: null,
    clientId: 'all',
    paymentMethod: 'all',
    minAmount: '',
    maxAmount: '',
  });

  const { data: incomes = [], isLoading } = useIncomes();
  const { mutate: deleteIncome } = useDeleteIncome();

  const { data: companyData } = useQuery({
    queryKey: ['company-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_data')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const filteredIncomes = useMemo(() => {
    return incomes.filter((income) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch = 
          income.description.toLowerCase().includes(search) ||
          income.bank_reference?.toLowerCase().includes(search) ||
          income.client?.name.toLowerCase().includes(search);
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (filters.category !== 'all' && income.category_id !== filters.category) {
        return false;
      }

      // Date range filter
      if (filters.dateFrom && income.income_date < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && income.income_date > filters.dateTo) {
        return false;
      }

      // Client filter
      if (filters.clientId !== 'all' && income.client_id !== filters.clientId) {
        return false;
      }

      // Payment method filter
      if (filters.paymentMethod !== 'all' && income.payment_method !== filters.paymentMethod) {
        return false;
      }

      // Amount range filter
      if (filters.minAmount && income.amount < parseFloat(filters.minAmount)) {
        return false;
      }
      if (filters.maxAmount && income.amount > parseFloat(filters.maxAmount)) {
        return false;
      }

      return true;
    });
  }, [incomes, searchTerm, filters]);

  const totalAmount = filteredIncomes.reduce((sum, income) => sum + income.amount, 0);

  const handleExport = async (format: 'pdf' | 'excel') => {
    if (!companyData) {
      toast.error('No se pudo cargar la información de la empresa');
      return;
    }

    try {
      await exportIncomeReport({
        format,
        incomes: filteredIncomes,
        companyData,
        appliedFilters: {
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          category: filters.category !== 'all' ? filters.category : undefined,
          client: filters.clientId !== 'all' ? filters.clientId : undefined,
        },
      });
      toast.success(`Informe exportado como ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Error al exportar el informe');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <IncomesHeader 
        onAddIncome={() => {
          setSelectedIncome(null);
          setIsFormOpen(true);
        }}
        onExport={handleExport}
        totalAmount={totalAmount}
        totalCount={filteredIncomes.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <IncomeFilters 
        filters={filters}
        onFiltersChange={setFilters}
        onSearch={setSearchTerm}
        searchTerm={searchTerm}
      />

      {viewMode === 'table' ? (
        <IncomesTable 
          incomes={filteredIncomes}
          onEdit={(income) => {
            setSelectedIncome(income);
            setIsFormOpen(true);
          }}
          onDelete={deleteIncome}
          isLoading={isLoading}
        />
      ) : (
        <IncomesPipelineView
          incomes={filteredIncomes}
          onEdit={(income) => {
            setSelectedIncome(income);
            setIsFormOpen(true);
          }}
          onDelete={deleteIncome}
          isLoading={isLoading}
        />
      )}

      <IncomeForm 
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedIncome(null);
        }}
        income={selectedIncome}
      />
    </div>
  );
};

export default IncomesPage;
