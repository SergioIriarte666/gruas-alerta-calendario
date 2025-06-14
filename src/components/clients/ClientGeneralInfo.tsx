
import { Client } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Phone, Mail, MapPin, CheckCircle, XCircle, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DetailItemProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}

const DetailItem = ({ icon: Icon, label, value }: DetailItemProps) => (
  <div className="flex items-start space-x-3">
    <Icon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
    <div className="min-w-0">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="font-medium text-white truncate">{value}</p>
    </div>
  </div>
);

interface ClientGeneralInfoProps {
  client: Client;
}

export const ClientGeneralInfo = ({ client }: ClientGeneralInfoProps) => {
  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <User className="mr-2 h-5 w-5" />
            Información del Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DetailItem icon={User} label="Nombre Completo" value={client.name} />
            <DetailItem icon={User} label="RUT" value={client.rut} />
            <DetailItem icon={Phone} label="Teléfono" value={client.phone || 'No especificado'} />
            <DetailItem icon={Mail} label="Email" value={client.email || 'No especificado'} />
            <DetailItem icon={MapPin} label="Dirección" value={client.address || 'No especificada'} />
            <DetailItem 
              icon={client.isActive ? CheckCircle : XCircle} 
              label="Estado" 
              value={
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${client.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {client.isActive ? 'Activo' : 'Inactivo'}
                </span>
              }
            />
             <DetailItem 
              icon={CalendarClock} 
              label="Miembro desde" 
              value={format(new Date(client.createdAt), "dd 'de' MMMM, yyyy", { locale: es })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
