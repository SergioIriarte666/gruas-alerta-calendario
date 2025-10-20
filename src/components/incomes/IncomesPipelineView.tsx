import { useMemo, useState } from 'react';
import { IncomeWithDetails } from '@/types/incomes';
import { IncomesPipelineMetrics } from './IncomesPipelineMetrics';
import { IncomePipelineCard } from './IncomePipelineCard';
import { useIncomeCategories } from '@/hooks/incomes/useIncomeCategories';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getIconComponent } from '@/utils/iconMapper';

interface IncomesPipelineViewProps {
  incomes: IncomeWithDetails[];
  onEdit: (income: IncomeWithDetails) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

interface IncomeGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  incomes: IncomeWithDetails[];
  totalAmount: number;
  count: number;
}

export const IncomesPipelineView = ({ 
  incomes, 
  onEdit, 
  onDelete,
  isLoading 
}: IncomesPipelineViewProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['all']));
  const { data: categories = [] } = useIncomeCategories();

  // Filtrar ingresos por búsqueda
  const filteredIncomes = useMemo(() => {
    if (!searchTerm) return incomes;
    
    const search = searchTerm.toLowerCase();
    return incomes.filter(income => 
      income.description.toLowerCase().includes(search) ||
      income.client?.name.toLowerCase().includes(search) ||
      income.occasional_client_name?.toLowerCase().includes(search) ||
      income.bank_reference?.toLowerCase().includes(search)
    );
  }, [incomes, searchTerm]);

  // Agrupar ingresos por categoría
  const incomeGroups = useMemo(() => {
    const groups: IncomeGroup[] = [];

    // Agrupar por cada categoría activa
    categories.forEach(category => {
      const categoryIncomes = filteredIncomes.filter(
        income => income.category_id === category.id
      );

      if (categoryIncomes.length > 0) {
        groups.push({
          categoryId: category.id,
          categoryName: category.name,
          categoryColor: category.color,
          categoryIcon: category.icon,
          incomes: categoryIncomes,
          totalAmount: categoryIncomes.reduce((sum, inc) => sum + inc.amount, 0),
          count: categoryIncomes.length,
        });
      }
    });

    // Grupo para ingresos sin categoría
    const uncategorizedIncomes = filteredIncomes.filter(
      income => !income.category_id
    );

    if (uncategorizedIncomes.length > 0) {
      groups.push({
        categoryId: 'uncategorized',
        categoryName: 'Sin Categoría',
        categoryColor: '#9ca3af',
        categoryIcon: 'help-circle',
        incomes: uncategorizedIncomes,
        totalAmount: uncategorizedIncomes.reduce((sum, inc) => sum + inc.amount, 0),
        count: uncategorizedIncomes.length,
      });
    }

    // Ordenar por monto total descendente
    return groups.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredIncomes, categories]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedGroups(new Set(['all', ...incomeGroups.map(g => g.categoryId)]));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <IncomesPipelineMetrics incomes={filteredIncomes} />

      {/* Buscador y controles */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descripción, cliente o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expandir todo
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Colapsar todo
            </Button>
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredIncomes.length} ingresos encontrados</span>
        <span>
          Total: ${filteredIncomes.reduce((sum, inc) => sum + inc.amount, 0).toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      </div>

      {/* Columnas por categoría */}
      <div className="space-y-4">
        {incomeGroups.map((group) => {
          const IconComponent = getIconComponent(group.categoryIcon);
          const isExpanded = expandedGroups.has(group.categoryId);

          return (
            <Collapsible
              key={group.categoryId}
              open={isExpanded}
              onOpenChange={() => toggleGroup(group.categoryId)}
            >
              <div 
                className="bg-card border rounded-lg overflow-hidden"
                style={{
                  borderTopWidth: '3px',
                  borderTopColor: group.categoryColor,
                }}
              >
                {/* Header de la categoría */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: `${group.categoryColor}20`,
                        }}
                      >
                        <IconComponent
                          className="h-5 w-5"
                          style={{ color: group.categoryColor }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.categoryName}</h3>
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${group.categoryColor}20`,
                              color: group.categoryColor,
                            }}
                          >
                            {group.count}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          ${group.totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>

                {/* Grid de cards */}
                <CollapsibleContent>
                  <div className="p-4 border-t bg-accent/20">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.incomes.map((income) => (
                        <IncomePipelineCard
                          key={income.id}
                          income={income}
                          onEdit={() => onEdit(income)}
                          onDelete={() => onDelete(income.id)}
                        />
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {incomeGroups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No se encontraron ingresos</p>
          </div>
        )}
      </div>
    </div>
  );
};
