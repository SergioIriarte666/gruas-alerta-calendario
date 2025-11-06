import { useState } from 'react';
import { CustomTabs, CustomTabsList, CustomTabsTrigger, CustomTabsContent } from '@/components/ui/custom-tabs';
import { CostCategoryList } from './categories/CostCategoryList';
import { IncomeCategoryList } from './categories/IncomeCategoryList';
import { DollarSign, TrendingDown } from 'lucide-react';

export const CategoriesTab = () => {
  const [activeSubTab, setActiveSubTab] = useState('costs');

  return (
    <div className="space-y-6">
      <CustomTabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <CustomTabsList className="grid w-full grid-cols-2">
          <CustomTabsTrigger 
            value="costs"
            className="flex items-center gap-2"
          >
            <TrendingDown className="w-4 h-4" />
            Categorías de Costos
          </CustomTabsTrigger>
          <CustomTabsTrigger 
            value="incomes"
            className="flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Categorías de Ingresos
          </CustomTabsTrigger>
        </CustomTabsList>

        <CustomTabsContent value="costs" className="mt-6">
          <CostCategoryList />
        </CustomTabsContent>

        <CustomTabsContent value="incomes" className="mt-6">
          <IncomeCategoryList />
        </CustomTabsContent>
      </CustomTabs>
    </div>
  );
};
