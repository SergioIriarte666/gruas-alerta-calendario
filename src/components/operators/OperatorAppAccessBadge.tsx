import { UserRoundX } from 'lucide-react';
import type { Operator } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OperatorAccessIdentity = Pick<Operator, 'name' | 'userId'>;

interface OperatorAppAccessBadgeProps {
  operator: OperatorAccessIdentity;
  className?: string;
}

export const OperatorAppAccessBadge = ({ operator, className }: OperatorAppAccessBadgeProps) => {
  if (operator.userId) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap border-warning/35 bg-warning-soft text-xs font-semibold text-warning-text',
        className,
      )}
      title="Este operador conserva su ficha, pero no tiene una cuenta vinculada para ingresar a la app"
    >
      <UserRoundX className="mr-1 size-3" />
      Sin acceso a la app
    </Badge>
  );
};

export const OperatorSelectLabel = ({ operator }: OperatorAppAccessBadgeProps) => (
  <span className="flex min-w-0 w-full items-center gap-2">
    <span className="truncate">{operator.name}</span>
    <OperatorAppAccessBadge operator={operator} className="ml-auto shrink-0" />
  </span>
);
