import { ArrowLeft, Car, PackageCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Service } from '@/types';

interface DeliveryIdentityGateProps {
  service: Service;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Identidad del servicio, grande, antes del formulario de entrega.
 *
 * Es cortesía, NO defensa: la garantía de que no se entregue el vehículo
 * equivocado es la doble llave id+folio que valida el servidor
 * (complete_service / save_inspection_evidence). Esta pantalla existe porque el
 * operador merece ver qué está cerrando, no porque el diseño dependa de que la
 * lea — el 25/07 la pantalla decía TEST-TRACK-01 y por dentro iba otro servicio.
 */
export const DeliveryIdentityGate = ({ service, onConfirm, onCancel }: DeliveryIdentityGateProps) => (
  <section
    className="operator-inspection-card rounded-3xl border border-warning/30 bg-card p-5"
    aria-labelledby="delivery-identity-title"
  >
    <p className="operator-native-eyebrow text-warning">Confirmar entrega</p>
    <h2 id="delivery-identity-title" className="mt-1 text-xl font-bold text-foreground">
      ¿Estás entregando este vehículo?
    </h2>

    <div className="mt-4 space-y-3 rounded-2xl bg-muted/60 p-4">
      <div className="flex items-center gap-3">
        <PackageCheck className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folio</p>
          <p className="operator-native-display truncate text-3xl font-bold leading-tight text-foreground">
            {service.folio}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Car className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vehículo</p>
          <p className="truncate text-lg font-bold text-foreground">
            {service.licensePlate ? service.licensePlate.toUpperCase() : 'Sin patente registrada'}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {[service.vehicleBrand, service.vehicleModel].filter(Boolean).join(' ') || 'Sin marca ni modelo'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <User className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
          <p className="truncate text-lg font-bold text-foreground">
            {service.client?.name ?? 'Cliente no especificado'}
          </p>
          <p className="truncate text-sm text-muted-foreground">{service.destination}</p>
        </div>
      </div>
    </div>

    <div className="mt-5 space-y-2">
      <Button
        type="button"
        onClick={onConfirm}
        className="min-h-12 w-full rounded-2xl text-sm font-bold"
      >
        Sí, entregar {service.folio}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="min-h-12 w-full rounded-2xl text-sm font-semibold"
      >
        <ArrowLeft className="size-4" />
        No es este, volver
      </Button>
    </div>
  </section>
);
