import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getClientDisplayName } from '@/utils/clientDisplayName';

interface ProjectionFiltersProps {
  dateRange: number;
  onDateRangeChange: (range: number) => void;
  clientId: string | null;
  onClientIdChange: (clientId: string | null) => void;
  status: string[];
  onStatusChange: (status: string[]) => void;
}

export const ProjectionFilters = ({
  dateRange,
  onDateRangeChange,
  clientId,
  onClientIdChange,
  status,
  onStatusChange,
}: ProjectionFiltersProps) => {
  const { data: clients } = useQuery({
    queryKey: ['clients-for-projection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, rut, department')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div>
        <Label htmlFor="date-range" className="text-sm font-medium mb-2 block">
          Rango de Proyección
        </Label>
        <Select
          value={dateRange.toString()}
          onValueChange={(value) => onDateRangeChange(Number(value))}
        >
          <SelectTrigger id="date-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Próximos 7 días</SelectItem>
            <SelectItem value="30">Próximos 30 días</SelectItem>
            <SelectItem value="60">Próximos 60 días</SelectItem>
            <SelectItem value="90">Próximos 90 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="client-filter" className="text-sm font-medium mb-2 block">
          Cliente
        </Label>
        <Select
          value={clientId || 'all'}
          onValueChange={(value) => onClientIdChange(value === 'all' ? null : value)}
        >
          <SelectTrigger id="client-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getClientDisplayName(client)}</span>
                  {client.rut && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs text-muted-foreground">{client.rut}</span>
                    </>
                  )}
                  {client.department && (
                    <>
                      <span className="text-muted-foreground/30">•</span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {client.department}
                      </span>
                    </>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="status-filter" className="text-sm font-medium mb-2 block">
          Estado
        </Label>
        <Select
          value={status.join(',')}
          onValueChange={(value) => onStatusChange(value.split(','))}
        >
          <SelectTrigger id="status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sent,partial,overdue">Todos los estados</SelectItem>
            <SelectItem value="sent">Enviadas</SelectItem>
            <SelectItem value="partial">Parciales</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
            <SelectItem value="sent,partial">En Proceso</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
