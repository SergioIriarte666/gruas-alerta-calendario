import { Client } from '@/types';
import { getDepartmentColor, hasMultipleDepartments } from '@/utils/departmentColors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DepartmentBadgeProps {
  department: string;
  clientRut: string;
  clientName: string;
  allClients: Client[];
  className?: string;
}

export const DepartmentBadge = ({
  department,
  clientRut,
  clientName,
  allClients,
  className = ''
}: DepartmentBadgeProps) => {
  const color = getDepartmentColor(department, clientRut, allClients);
  const hasMultiple = hasMultipleDepartments(clientRut, allClients);

  if (!color || !hasMultiple) {
    return <span className={className}>{department}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${color.bg} ${color.text} ${color.border} ${className}`}
          >
            {department}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Sucursal de {clientName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
