import { Client } from '@/types';
import { getDepartmentColor, hasMultipleDepartments } from '@/utils/departmentColors';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { toTitleCase } from "@/lib/utils";

interface DepartmentBadgeProps {
  department?: string;
  clientName?: string;
  clientRut?: string;
  allClients?: Client[];
  className?: string;
}

export function DepartmentBadge({ department, clientName }: DepartmentBadgeProps) {
  if (!department || department === 'General') return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-5 gap-1 font-normal text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {department}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Sucursal de {clientName ? toTitleCase(clientName) : ''}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
