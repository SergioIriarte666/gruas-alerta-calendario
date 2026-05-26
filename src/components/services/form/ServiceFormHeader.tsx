
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
    <Alert className="border-primary/30 bg-primary/10">
      <AlertTriangle className="size-4 text-primary" />
      <AlertDescription className="text-foreground">
        {isAdmin 
          ? "⚠️ CUIDADO: Este servicio está facturado. Como administrador, puedes editarlo, pero ten precaución con los cambios."
          : "Este servicio está facturado y no puede ser editado. Solo los administradores pueden hacerlo."
        }
      </AlertDescription>
    </Alert>
  );
};
