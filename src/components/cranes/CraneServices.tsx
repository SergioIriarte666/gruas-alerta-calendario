
import { Crane } from '@/types';
import { CraneServiceHistory } from './CraneServiceHistory';

interface CraneServicesProps {
  crane: Crane;
}

export const CraneServices = ({ crane }: CraneServicesProps) => {
  return <CraneServiceHistory crane={crane} />;
};
