import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  LocateFixed,
  MapPinOff,
  PackageCheck,
  Play,
  RefreshCw,
  Route,
  Truck,
  UserRoundCheck,
  UserRoundX,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatOperatorActivityTime, getOperatorActivityDestination } from '@/lib/operatorActivity';
import type { OperatorActivity, OperatorActivityEventType } from '@/types/operatorActivity';

const ICONS: Record<OperatorActivityEventType, LucideIcon> = {
  service_assigned: UserRoundCheck,
  service_unassigned: UserRoundX,
  service_updated: Route,
  service_started: Play,
  inspection_saved: ClipboardCheck,
  delivery_ready: PackageCheck,
  delivery_evidence_saved: Check,
  service_completed: CheckCircle2,
  service_cancelled: AlertTriangle,
  tracking_started: LocateFixed,
  tracking_stopped: MapPinOff,
  sync_completed: RefreshCw,
};

interface OperatorActivityItemProps {
  activity: OperatorActivity;
  compact?: boolean;
}

export const OperatorActivityItem = ({ activity, compact = false }: OperatorActivityItemProps) => {
  const Icon = ICONS[activity.event_type] ?? Truck;
  const destination = getOperatorActivityDestination(activity.event_type, activity.service_id);

  const content = (
    <div
      className={cn(
        'operator-activity-item',
        `operator-activity-item--${activity.severity}`,
        !activity.read_at && 'is-unread',
        compact && 'is-compact',
      )}
    >
      <span className="operator-activity-item__icon" aria-hidden="true">
        <Icon className="size-4" strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="operator-activity-item__title">{activity.title}</span>
          <time className="operator-activity-item__time" dateTime={activity.created_at}>
            {formatOperatorActivityTime(activity.created_at)}
          </time>
        </span>
        {activity.description && (
          <span className="operator-activity-item__description">{activity.description}</span>
        )}
      </span>
      {!activity.read_at && <span className="operator-activity-item__unread" aria-label="Sin leer" />}
    </div>
  );

  return destination ? <Link to={destination}>{content}</Link> : content;
};
