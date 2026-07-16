import { normalizeRut } from '@/utils/rutFormatter';

export type LowboySaleMatch = {
  rutMatches: boolean;
  amountMatches: boolean;
  score: number;
};

export const getLowboySaleMatch = (
  targetRut: string | null | undefined,
  targetNetAmount: number | null | undefined,
  candidateRut: string | null | undefined,
  candidateNetAmount: number | null | undefined,
): LowboySaleMatch => {
  const normalizedTarget = normalizeRut(targetRut ?? '');
  const normalizedCandidate = normalizeRut(candidateRut ?? '');
  const rutMatches = Boolean(normalizedTarget && normalizedTarget === normalizedCandidate);
  const amountMatches = Number(candidateNetAmount) === Number(targetNetAmount);
  return {
    rutMatches,
    amountMatches,
    score: (rutMatches ? 0 : 2) + (amountMatches ? 0 : 1),
  };
};
