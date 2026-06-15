import { describe, expect, it } from 'vitest';
import {
  getUsableAISuggestedInvoiceId,
  prepareCandidatesForAISuggestion,
  rankCandidatesWithAISuggestion,
} from '../bankStatementAIMatch';

const baseCandidates = [
  {
    invoice_id: 'invoice-1',
    match_score: 180,
    amount_matches: true,
    already_paid: false,
  },
  {
    invoice_id: 'invoice-2',
    match_score: 165,
    amount_matches: false,
    already_paid: false,
  },
  {
    invoice_id: 'invoice-3',
    match_score: 120,
    amount_matches: true,
    already_paid: true,
  },
];

describe('prepareCandidatesForAISuggestion', () => {
  it('prioriza candidatas pendientes con monto exacto antes de enviar a IA', () => {
    const prepared = prepareCandidatesForAISuggestion([...baseCandidates]);

    expect(prepared.map((candidate) => candidate.invoice_id)).toEqual(['invoice-1', 'invoice-3']);
  });

  it('usa candidatas no pagadas si no existe ninguna exacta pendiente', () => {
    const prepared = prepareCandidatesForAISuggestion([
      {
        invoice_id: 'invoice-10',
        match_score: 140,
        amount_matches: false,
        already_paid: false,
      },
      {
        invoice_id: 'invoice-11',
        match_score: 150,
        amount_matches: false,
        already_paid: true,
      },
    ]);

    expect(prepared.map((candidate) => candidate.invoice_id)).toEqual(['invoice-10']);
  });
});

describe('getUsableAISuggestedInvoiceId', () => {
  it('acepta una sugerencia exacta solo si la factura sigue siendo conciliable', () => {
    const suggestedInvoiceId = getUsableAISuggestedInvoiceId([...baseCandidates], {
      invoice_id: 'invoice-1',
      confidence: 0.81,
      suggestion_type: 'exact',
    });

    expect(suggestedInvoiceId).toBe('invoice-1');
  });

  it('descarta sugerencias de monto distinto aunque la IA las devuelva', () => {
    const suggestedInvoiceId = getUsableAISuggestedInvoiceId([...baseCandidates], {
      invoice_id: 'invoice-2',
      confidence: 0.95,
      suggestion_type: 'exact',
    });

    expect(suggestedInvoiceId).toBeNull();
  });

  it('descarta sugerencias inciertas o de baja confianza', () => {
    const suggestedInvoiceId = getUsableAISuggestedInvoiceId([...baseCandidates], {
      invoice_id: 'invoice-1',
      confidence: 0.6,
      suggestion_type: 'probable',
    });

    expect(suggestedInvoiceId).toBeNull();
  });
});

describe('rankCandidatesWithAISuggestion', () => {
  it('mueve la sugerencia usable al primer lugar', () => {
    const ranked = rankCandidatesWithAISuggestion(
      [
        {
          invoice_id: 'invoice-2',
          match_score: 165,
          amount_matches: true,
          already_paid: false,
        },
        {
          invoice_id: 'invoice-1',
          match_score: 180,
          amount_matches: true,
          already_paid: false,
        },
      ],
      {
        invoice_id: 'invoice-1',
        confidence: 0.84,
        suggestion_type: 'exact',
      },
    );

    expect(ranked.map((candidate) => candidate.invoice_id)).toEqual(['invoice-1', 'invoice-2']);
  });

  it('mantiene el orden original si la sugerencia no es usable', () => {
    const ranked = rankCandidatesWithAISuggestion(
      [
        {
          invoice_id: 'invoice-2',
          match_score: 165,
          amount_matches: true,
          already_paid: false,
        },
        {
          invoice_id: 'invoice-1',
          match_score: 180,
          amount_matches: true,
          already_paid: false,
        },
      ],
      {
        invoice_id: 'invoice-1',
        confidence: 0.55,
        suggestion_type: 'uncertain',
      },
    );

    expect(ranked.map((candidate) => candidate.invoice_id)).toEqual(['invoice-2', 'invoice-1']);
  });
});
