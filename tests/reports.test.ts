import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_REPORT_ROWS } from '../src/admob/constants.js';
import {
  buildReportSpec,
  flattenReport,
  flattenRow,
  parseDate,
  type ReportChunk,
} from '../src/admob/reports.js';

describe('parseDate', () => {
  it('parses YYYY-MM-DD into API date parts', () => {
    expect(parseDate('2026-07-01')).toEqual({ year: 2026, month: 7, day: 1 });
  });

  it('rejects other formats', () => {
    expect(() => parseDate('2026/07/01')).toThrow(/expected YYYY-MM-DD/);
    expect(() => parseDate('20260701')).toThrow(/expected YYYY-MM-DD/);
  });
});

describe('buildReportSpec', () => {
  it('builds a full spec with filters, sorting, and currency', () => {
    const spec = buildReportSpec({
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      metrics: ['ESTIMATED_EARNINGS'],
      dimensions: ['APP'],
      dimensionFilters: [{ dimension: 'COUNTRY', values: ['KR', 'US'] }],
      sortConditions: [{ metric: 'ESTIMATED_EARNINGS', order: 'DESCENDING' }],
      maxReportRows: 50,
      currencyCode: 'KRW',
    });
    expect(spec).toEqual({
      dateRange: {
        startDate: { year: 2026, month: 7, day: 1 },
        endDate: { year: 2026, month: 7, day: 7 },
      },
      metrics: ['ESTIMATED_EARNINGS'],
      dimensions: ['APP'],
      dimensionFilters: [{ dimension: 'COUNTRY', matchesAny: { values: ['KR', 'US'] } }],
      sortConditions: [{ metric: 'ESTIMATED_EARNINGS', order: 'DESCENDING' }],
      maxReportRows: 50,
      localizationSettings: { currencyCode: 'KRW' },
    });
  });

  it('applies the default row cap and omits optional fields', () => {
    const spec = buildReportSpec({
      startDate: '2026-07-01',
      endDate: '2026-07-07',
      metrics: ['CLICKS'],
    });
    expect(spec.maxReportRows).toBe(DEFAULT_MAX_REPORT_ROWS);
    expect(spec.dimensionFilters).toBeUndefined();
    expect(spec.localizationSettings).toBeUndefined();
  });
});

describe('flattenRow', () => {
  it('converts micros to currency units and integer strings to numbers', () => {
    const row = flattenRow({
      dimensionValues: { DATE: { value: '20260701' } },
      metricValues: {
        ESTIMATED_EARNINGS: { microsValue: '12345678' },
        IMPRESSIONS: { integerValue: '4200' },
        MATCH_RATE: { doubleValue: 0.92 },
      },
    });
    expect(row).toEqual({
      DATE: '20260701',
      ESTIMATED_EARNINGS: 12.345678,
      IMPRESSIONS: 4200,
      MATCH_RATE: 0.92,
    });
  });

  it('uses display labels and keeps the raw ID in a separate column', () => {
    const row = flattenRow({
      dimensionValues: { APP: { value: 'ca-app-pub-1~1', displayLabel: 'My Game' } },
      metricValues: {},
    });
    expect(row).toEqual({ APP: 'My Game', APP_ID: 'ca-app-pub-1~1' });
  });
});

describe('flattenReport', () => {
  const chunks: ReportChunk[] = [
    {
      header: {
        localizationSettings: { currencyCode: 'USD' },
        reportingTimeZone: 'America/Los_Angeles',
      },
    },
    {
      row: {
        dimensionValues: { DATE: { value: '20260701' } },
        metricValues: { CLICKS: { integerValue: '3' } },
      },
    },
    {
      row: {
        dimensionValues: { DATE: { value: '20260702' } },
        metricValues: { CLICKS: { integerValue: '5' } },
      },
    },
    { footer: { matchingRowCount: '2', warnings: [{ description: 'Some data delayed' }] } },
  ];

  it('collapses header/row/footer chunks into a flat table', () => {
    const report = flattenReport(chunks);
    expect(report.currencyCode).toBe('USD');
    expect(report.reportingTimeZone).toBe('America/Los_Angeles');
    expect(report.rowCount).toBe(2);
    expect(report.matchingRowCount).toBe(2);
    expect(report.rows).toEqual([
      { DATE: '20260701', CLICKS: 3 },
      { DATE: '20260702', CLICKS: 5 },
    ]);
    expect(report.warnings).toEqual(['Some data delayed']);
  });

  it('accepts a single non-array chunk', () => {
    const report = flattenReport(chunks[1]);
    expect(report.rowCount).toBe(1);
    expect(report.warnings).toBeUndefined();
  });
});
