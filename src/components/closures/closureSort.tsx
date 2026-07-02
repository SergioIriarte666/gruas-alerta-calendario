import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export type ClosureSortField = 'folio' | 'dateFrom' | 'clientId' | 'serviceCount' | 'total' | 'status';
export type SortDirection = 'asc' | 'desc';
export type GroupSortBy = 'name' | 'count' | 'total';

export const SortIcon = ({ field, currentSortField, sortDirection }: {
  field: ClosureSortField;
  currentSortField?: ClosureSortField | null;
  sortDirection?: SortDirection;
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ?
    <ArrowUp className="ml-2 size-4 text-primary" /> :
    <ArrowDown className="ml-2 size-4 text-primary" />;
};
