
import { Crane } from '@/types';
import { CraneMaintenance } from './CraneMaintenance';

interface CraneMaintenanceTabProps {
  crane: Crane;
}

export const CraneMaintenanceTab = ({ crane }: CraneMaintenanceTabProps) => {
  return <CraneMaintenance crane={crane} />;
};
