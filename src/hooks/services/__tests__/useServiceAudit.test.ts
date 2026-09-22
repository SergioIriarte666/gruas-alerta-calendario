import { describe, expect, it, vi } from 'vitest';
import { readAuditPages, validAuditRange } from '../useServiceAudit';

describe('audit range and full history pagination', () => {
  it('continues even when the backend returns less than the requested page size', async () => {
    const read = vi.fn(async (after: number | undefined) => ({ data: after === undefined ? [{ id: 1 }] : after === 1 ? [{ id: 2 }] : [], error: null }));
    expect(await readAuditPages(read)).toEqual([{ id: 1 }, { id: 2 }]);
    expect(read.mock.calls).toEqual([[undefined], [1], [2]]);
  });
  it('fails the complete report on a later page error', async () => {
    const failure = new Error('Permission denied');
    await expect(readAuditPages(async (after: number | undefined) => after === undefined ? { data: [{ id: 1 }], error: null } : { data: null, error: failure })).rejects.toThrow('Permission denied');
  });
  it('rejects an invalid or reversed date range', () => {
    expect(validAuditRange('2026-09-22', '2026-09-22')).toBe(true);
    expect(validAuditRange('2026-09-23', '2026-09-22')).toBe(false);
    expect(validAuditRange('2026-02-30', '2026-09-22')).toBe(false);
    expect(validAuditRange('', '2026-09-22')).toBe(false);
  });
});
