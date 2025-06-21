
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
      <Label className="text-white">Cliente (Opcional)</Label>
      <Select value={clientId || "all"} onValueChange={handleValueChange}>
        <SelectTrigger 
          className="bg-black border-tms-green/30 text-white"
          style={{
            backgroundColor: '#000000',
            borderColor: 'rgba(156, 250, 36, 0.3)',
            color: '#ffffff'
          }}
        >
          <SelectValue placeholder="Todos los clientes" />
        </SelectTrigger>
        <SelectContent 
          className="bg-black border-tms-green text-white z-50"
          style={{
            backgroundColor: '#000000',
            borderColor: '#9cfa24',
            color: '#ffffff',
            zIndex: 50
          }}
        >
          <SelectItem 
            value="all"
            className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
            style={{ color: '#ffffff' }}
          >
            Todos los clientes
          </SelectItem>
          {clients.map((client) => (
            <SelectItem 
              key={client.id} 
              value={client.id}
              className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
              style={{ color: '#ffffff' }}
            >
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ClientSelector;
