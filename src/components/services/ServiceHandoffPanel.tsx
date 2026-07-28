import { useEffect, useState } from 'react';
import { HandshakeIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useServiceHandoffs } from '@/hooks/operator/useServiceHandoff';
import { useOperators } from '@/hooks/useOperators';
import { getInspectionPhotoSignedUrl } from '@/utils/photoUpload';
import { formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceHandoffPanel');

interface ServiceHandoffPanelProps {
  serviceId: string;
}

const HandoffPhotos = ({ paths }: { paths: string[] }) => {
  const [urls, setUrls] = useState<Array<{ path: string; url: string }>>([]);

  useEffect(() => {
    let cancelled = false;

    // Las fotos se guardan como PATH, no como URL firmada: la evidencia se
    // consulta meses después y cualquier token ya habría expirado. Se firma aquí,
    // al momento de mirarla.
    Promise.all(
      paths.map(async path => {
        try {
          return { path, url: await getInspectionPhotoSignedUrl(path) };
        } catch (error) {
          logger.warn('No se pudo firmar la foto del traspaso', error);
          return null;
        }
      })
    ).then(results => {
      if (!cancelled) setUrls(results.filter((item): item is { path: string; url: string } => item !== null));
    });

    return () => { cancelled = true; };
  }, [paths]);

  if (urls.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {urls.map(item => (
        <a key={item.path} href={item.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border">
          <img src={item.url} alt="Estado de la carga en el traspaso" className="h-24 w-full object-cover" />
        </a>
      ))}
    </div>
  );
};

/**
 * Traspasos de operador del servicio, con la evidencia que dejó el entrante.
 *
 * Es la contraparte administrativa del relevo: sin este panel las fotos del
 * traspaso quedarían en el bucket sin nadie que las relacione con el cambio de
 * operador que las motivó.
 */
export const ServiceHandoffPanel = ({ serviceId }: ServiceHandoffPanelProps) => {
  const { data: handoffs = [], isLoading } = useServiceHandoffs(serviceId);
  const { operators = [] } = useOperators();

  const operatorName = (id: string | null) =>
    (id && operators.find(op => op.id === id)?.name) || 'Sin operador';

  if (isLoading || handoffs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <HandshakeIcon className="size-4 text-primary" />
        <h4 className="text-sm font-medium text-foreground">Relevos de operador</h4>
      </div>

      {handoffs.map(handoff => (
        <div key={handoff.id} className="space-y-2 rounded-lg border border-border bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-foreground">
              {operatorName(handoff.outgoing_operator_id)} → {operatorName(handoff.incoming_operator_id)}
            </span>
            <Badge variant={handoff.confirmed_at ? 'secondary' : 'destructive'}>
              {handoff.confirmed_at ? 'Recibido' : 'Pendiente de recepción'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Reasignado {formatForDisplayWithTime(handoff.requested_at)}
            </span>
            {handoff.confirmed_at && <span>Recibido {formatForDisplayWithTime(handoff.confirmed_at)}</span>}
          </div>

          {handoff.notes && <p className="italic text-muted-foreground">{handoff.notes}</p>}

          <HandoffPhotos paths={handoff.photo_paths || []} />
        </div>
      ))}
    </div>
  );
};
