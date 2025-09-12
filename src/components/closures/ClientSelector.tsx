
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';

interface ClientSelectorProps {
  clientId: string;
  onClientChange: (clientId: string) => void;
}

const ClientSelector = ({ clientId, onClientChange }: ClientSelectorProps) => {
  const { clients } = useClients();

  const handleValueChange = (value: string) => {
    // Convert "all" back to empty string for the form logic
    onClientChange(value === "all" ? "" : value);
  };

  return (
    <div className="space-y-2">
      <Label className="text-foreground">Cliente (Opcional)</Label>
      <Select value={clientId || "all"} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            Todos los clientes
          </SelectItem>
          {clients.map((client) => (
            <SelectItem 
              key={client.id} 
              value={client.id}
            >
              {client.name}{client.department ? ` (${client.department})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClientSelector;
