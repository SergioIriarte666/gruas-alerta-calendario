import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CostCategoryList } from './categories/CostCategoryList';
import { SupplierCategoryList } from './categories/SupplierCategoryList';

export const CategoriesTab = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="suppliers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="suppliers">Proveedores</TabsTrigger>
          <TabsTrigger value="costs">Costos</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers" className="mt-6">
          <SupplierCategoryList />
        </TabsContent>
        <TabsContent value="costs" className="mt-6">
          <CostCategoryList />
        </TabsContent>
      </Tabs>
    </div>
  );
};
