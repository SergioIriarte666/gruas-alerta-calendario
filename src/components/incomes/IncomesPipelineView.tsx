import { useMemo, useState } from 'react';
import { IncomeWithDetails } from '@/types/incomes';
import { toTitleCase } from '@/lib/utils';
import { IncomesPipelineMetrics } from './IncomesPipelineMetrics';
import { IncomePipelineCard } from './IncomePipelineCard';
import { Search, ChevronDown, ChevronRight, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface IncomesPipelineViewProps {
  incomes: IncomeWithDetails[];
  onEdit: (income: IncomeWithDetails) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}

interface IncomeGroup {
  clientId: string;
  clientName: string;
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

  // Agrupar ingresos por cliente
  const incomeGroups = useMemo(() => {
    const groupsMap = new Map<string, IncomeGroup>();

    filteredIncomes.forEach((income) => {
      let clientId: string;
      let clientName: string;

      if (income.client_id && income.client) {
        // Cliente registrado en el sistema
        clientId = income.client.id;
        clientName = toTitleCase(income.client.name);
      } else if (income.occasional_client_name) {
        // Cliente ocasional
        clientId = `occasional_${income.occasional_client_name.toLowerCase().replace(/\s+/g, '_')}`;
        clientName = toTitleCase(income.occasional_client_name);
      } else {
        // Sin cliente
        clientId = 'no_client';
        clientName = 'Sin Cliente';
      }

      if (!groupsMap.has(clientId)) {
        groupsMap.set(clientId, {
          clientId,
          clientName,
          incomes: [],
          totalAmount: 0,
          count: 0,
        });
      }

      const group = groupsMap.get(clientId)!;
      group.incomes.push(income);
      group.totalAmount += income.amount;
      group.count += 1;
    });

    // Convertir Map a array y ordenar por monto total descendente
    return Array.from(groupsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredIncomes]);

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
    setExpandedGroups(new Set(['all', ...incomeGroups.map(g => g.clientId)]));
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

      {/* Columnas por cliente */}
      <div className="space-y-4">
        {incomeGroups.map((group) => {
          const isExpanded = expandedGroups.has(group.clientId);
          
          // Generar color dinámico para el cliente basado en hash del nombre
          const getClientColor = (name: string) => {
            const colors = [
              '#10b981', // green
              '#3b82f6', // blue  
              '#8b5cf6', // purple
              '#f59e0b', // amber
              '#ef4444', // red
              '#06b6d4', // cyan
              '#ec4899', // pink
              '#84cc16', // lime
            ];
            
            // Hash simple del nombre para asignar color consistente
            let hash = 0;
            for (let i = 0; i < name.length; i++) {
              hash = name.charCodeAt(i) + ((hash << 5) - hash);
            }
            return colors[Math.abs(hash) % colors.length];
          };
          
          const clientColor = group.clientId === 'no_client' 
            ? '#9ca3af' // gris para "Sin Cliente"
            : getClientColor(group.clientName);

          return (
            <Collapsible
              key={group.clientId}
              open={isExpanded}
              onOpenChange={() => toggleGroup(group.clientId)}
            >
              <div 
                className="bg-card border rounded-lg overflow-hidden"
                style={{
                  borderTopWidth: '3px',
                  borderTopColor: clientColor,
                }}
              >
                {/* Header del cliente */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: `${clientColor}20`,
                        }}
                      >
                        <User
                          className="h-5 w-5"
                          style={{ color: clientColor }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{group.clientName}</h3>
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${clientColor}20`,
                              color: clientColor,
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
