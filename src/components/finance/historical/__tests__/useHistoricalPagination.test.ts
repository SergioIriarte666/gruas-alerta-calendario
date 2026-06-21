import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useHistoricalPagination, PAGE_SIZE_OPTIONS } from '../useHistoricalPagination';

describe('useHistoricalPagination', () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  it('expone las opciones de tamaño de página requeridas', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
  });

  it('pagina correctamente con el tamaño por defecto (25)', () => {
    const { result } = renderHook(() => useHistoricalPagination({ resetKey: 'k1' }));
    const page1 = result.current.paginate(items);
    expect(page1).toHaveLength(25);
    expect(page1[0]).toBe(0);
    expect(page1[24]).toBe(24);
    expect(result.current.getTotalPages(items.length)).toBe(5);
    expect(result.current.getRangeLabel(items.length)).toBe('1-25 de 120');
  });

  it('avanza de página y corta la porción correcta', () => {
    const { result } = renderHook(() => useHistoricalPagination({ resetKey: 'k1' }));
    act(() => result.current.setPage(2));
    const page2 = result.current.paginate(items);
    expect(page2[0]).toBe(25);
    expect(result.current.getRangeLabel(items.length)).toBe('26-50 de 120');
  });

  it('reinicia a la página 1 cuando cambia resetKey', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useHistoricalPagination({ resetKey }),
      { initialProps: { resetKey: 'k1' } }
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ resetKey: 'k2' });
    expect(result.current.page).toBe(1);
  });

  it('reinicia a la página 1 cuando cambia pageSize', () => {
    const { result } = renderHook(() => useHistoricalPagination({ resetKey: 'k1' }));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setPageSize(50));
    expect(result.current.page).toBe(1);
    expect(result.current.paginate(items)).toHaveLength(50);
  });

  it('getRangeLabel devuelve "0 de 0" cuando no hay registros', () => {
    const { result } = renderHook(() => useHistoricalPagination({ resetKey: 'k1' }));
    expect(result.current.getRangeLabel(0)).toBe('0 de 0');
  });
});
