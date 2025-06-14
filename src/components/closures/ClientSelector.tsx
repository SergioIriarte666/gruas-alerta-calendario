
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';

interface ClientSelectorProps {
  clientId: string;
  onClientChange: (clientId: string) => void;
}

const ClientSelector = ({ clientId, onClientChange }: ClientSelectorProps) => {
  const { clients } = useClients();

  return (
    <div className="space-y-2">
      <Label className="text-gray-300">Cliente (Opcional)</Label>
      <Select value={clientId} onValueChange={onClientChange}>
        <SelectTrigger className="bg-white/5 border-gray-700 text-white">
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Todos los clientes</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClientSelector;
