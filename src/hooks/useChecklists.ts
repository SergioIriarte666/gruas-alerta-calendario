/**
 * Punto de entrada del módulo de Checklists de seguridad.
 * Re-exporta los hooks especializados de src/hooks/checklists/.
 */

export {
  useChecklistTemplates,
  fetchChecklistTemplates,
} from './checklists/useChecklistTemplates';

export {
  useChecklistsFetcher,
  fetchOperatorChecklists,
  hydrateChecklist,
  getHistoryStartDate,
  CHECKLIST_HISTORY_DAYS,
} from './checklists/useChecklistsFetcher';

export {
  useChecklistManager,
  ChecklistConflictError,
} from './checklists/useChecklistManager';

export type {
  CreateDraftInput,
  ChecklistDraftPatch,
} from './checklists/useChecklistManager';

export { useOperatorChecklistContext } from './checklists/useOperatorChecklistContext';

export {
  useChecklistEmailStatus,
  useChecklistEmailSender,
} from './checklists/useChecklistEmail';

export type {
  ChecklistEmailState,
  ChecklistEmailStatus,
  EnqueueResult,
} from './checklists/useChecklistEmail';
