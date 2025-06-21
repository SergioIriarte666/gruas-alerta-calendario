
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { Service } from '@/types';

interface ServiceFormHeaderProps {
  service?: Service | null;
}

export const ServiceFormHeader = ({ service }: ServiceFormHeaderProps) => {
  const { user } = useUser();
  const isInvoiced = service?.status === 'invoiced';
  const isAdmin = user?.role === 'admin';

  if (!isInvoiced) return null;

  return (
    <Alert className="border-purple-500/50 bg-purple-500/10">
      <AlertTriangle className="h-4 w-4 text-purple-400" />
      <AlertDescription className="text-purple-200">
        {isAdmin 
          ? "⚠️ CUIDADO: Este servicio está facturado. Como administrador, puedes editarlo, pero ten precaución con los cambios."
          : "Este servicio está facturado y no puede ser editado. Solo los administradores pueden hacerlo."
        }
      </AlertDescription>
    </Alert>
  );
};
