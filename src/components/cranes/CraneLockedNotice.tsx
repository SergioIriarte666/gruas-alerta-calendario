import { LockKeyhole } from 'lucide-react';
import type { Crane } from '@/types';
import { getCraneStatusLabel } from '@/utils/craneStatus';

export const CraneLockedNotice = ({ crane }: { crane: Crane }) => (
  <div className="flex items-start gap-3 border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-destructive">
    <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <div>
      <p className="text-sm font-semibold">
        Grúa {getCraneStatusLabel(crane.status).toLowerCase()} — bloqueo permanente
      </p>
      <p className="text-xs text-destructive/80">
        El historial permanece disponible solo para consulta. No se pueden crear, editar, eliminar ni reasignar registros.
      </p>
    </div>
  </div>
);
