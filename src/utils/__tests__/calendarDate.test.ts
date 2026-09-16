import { addDaysToBusinessDate, formatDocumentDate as formatCommercialDate } from '../pdf/commercialPdfShared';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { addCalendarDays, calendarDateString, differenceInCalendarDates, excelSerialToCalendarDate, formatCalendarDate, isCalendarDate, parseDateValue } from '../calendarDate';
import { businessClock } from '../businessClock';
import { formatForDisplay, formatForDisplayLong, formatForDisplayShort, getBusinessTimestampBounds, parseFromDatabase, safeDaysSince } from '../timezoneUtils';
import { calculateDaysBetween } from '../custodyCalculations';
import { formatDocumentDate } from '../../../supabase/functions/_shared/calendarDate';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ limit: () => ({ maybeSingle: async () => ({ data: {
    report_timezone: 'America/Santiago', report_use_system_timezone: true,
  } }) }) }) }),
} }));

beforeAll(async () => { await businessClock.bootstrap(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('global calendar date contract', () => {
  it('round-trips every day from 2024 to 2027 without changing its month', () => {
    let day = '2024-01-01';
    while (day < '2028-01-01') {
      expect(calendarDateString(parseDateValue(day))).toBe(day);
      expect(formatCalendarDate(day, 'yyyy-MM-dd')).toBe(day);
      expect(calendarDateString(parseFromDatabase(day))).toBe(day);
      expect(businessClock.format(day, 'yyyy-MM')).toBe(day.slice(0, 7));
      day = addCalendarDays(day, 1);
    }
  });

  it('rejects impossible dates instead of silently moving to another month', () => {
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(isCalendarDate('2026-00-11')).toBe(false);
    expect(parseDateValue('2026-02-31').getTime()).toBeNaN();
    expect(() => calendarDateString('2026-02-31')).toThrow();
  });

  it.each([['2026-09-05', '2026-09-07'], ['2026-04-04', '2026-04-06']])('counts calendar days across DST: %s → %s', (start, end) => {
    expect(differenceInCalendarDates(end, start)).toBe(2);
    expect(safeDaysSince(start, end)).toBe(2);
    expect(calculateDaysBetween(start, end)).toBe(3);
    expect(addCalendarDays(start, 2)).toBe(end);
  });

  it('uses the saved TMS timezone even when the legacy browser-timezone flag is true', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T01:30:00Z'));
    expect(businessClock.timezone()).toBe('America/Santiago');
    expect(businessClock.today()).toBe('2026-09-30');
    expect(businessClock.format('2026-10-01', 'dd/MM/yyyy')).toBe('01/10/2026');
  });

  it.each(['2026-09-11', '2026-09-01', '2026-09-06', '2026-04-05'])('preserves picker day %s when a timestamp column is required', (day) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-16T15:30:00Z'));
    const [y, m, d] = day.split('-').map(Number);
    const timestamp = businessClock.toTimestamp(new Date(y, m - 1, d));
    expect(businessClock.format(timestamp, 'yyyy-MM-dd')).toBe(day);
    expect(businessClock.format(timestamp, 'HH:mm')).toBe('12:00');
    expect(businessClock.format(businessClock.toTimestamp(day), 'yyyy-MM-dd')).toBe(day);
  });

  it('preserves calendar-widget dates in every display helper', () => {
    const selected = parseDateValue('2026-09-11');
    expect(formatForDisplay(selected)).toBe('11/09/2026');
    expect(formatForDisplayShort(selected)).toBe('11/09/26');
    expect(formatForDisplayLong(selected)).toContain('11 de septiembre');
    expect(formatDocumentDate('2026-09-11')).toContain('11');
    expect(formatCalendarDate('2026-09-11')).toBe(formatForDisplay('2026-09-11'));
  });

  it('formats true timestamps in the business timezone without truncating UTC', () => {
    expect(formatForDisplay('2026-10-01T01:30:00Z')).toBe('30/09/2026');
    expect(calendarDateString(parseFromDatabase('2026-10-01T01:30:00Z'))).toBe('2026-09-30');
  });

  it('uses the full business day including a skipped midnight', () => {
    const bounds = getBusinessTimestampBounds('2026-09-06', '2026-09-06');
    expect(businessClock.format(bounds.gte!, 'yyyy-MM-dd')).toBe('2026-09-06');
    expect(businessClock.format(bounds.lte!, 'yyyy-MM-dd')).toBe('2026-09-06');
    expect(new Date(bounds.lte!).getTime() - new Date(bounds.gte!).getTime() + 1).toBe(23 * 3600000);
    expect(businessClock.format(new Date(new Date(bounds.gte!).getTime() - 1), 'yyyy-MM-dd')).toBe('2026-09-05');
  });

  it('preserves commercial PDF dates and quote validity across months', () => {
    expect(formatCommercialDate('2026-09-11')).toBe('11/09/2026');
    expect(addDaysToBusinessDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysToBusinessDate('2026-09-05', 2)).toBe('2026-09-07');
  });

  it('converts Excel serials without interpreting the day in the browser timezone', () => {
    const serial = (Date.UTC(2026, 8, 11) / 86400000) + 25569;
    expect(excelSerialToCalendarDate(serial)).toBe('2026-09-11');
    expect(excelSerialToCalendarDate(serial + 0.75)).toBe('2026-09-11');
  });
});
