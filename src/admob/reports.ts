import { DEFAULT_MAX_REPORT_ROWS } from './constants.js';

export interface ReportDimensionValue {
  value?: string | null;
  displayLabel?: string | null;
}

export interface ReportMetricValue {
  integerValue?: string | null;
  doubleValue?: number | null;
  microsValue?: string | null;
}

export interface ReportRow {
  dimensionValues?: { [key: string]: ReportDimensionValue } | null;
  metricValues?: { [key: string]: ReportMetricValue } | null;
}

export interface ReportChunk {
  header?: {
    localizationSettings?: { currencyCode?: string | null } | null;
    reportingTimeZone?: string | null;
  } | null;
  row?: ReportRow | null;
  footer?: {
    matchingRowCount?: string | null;
    warnings?: Array<{ type?: string | null; description?: string | null }> | null;
  } | null;
}

export interface FlatReport {
  currencyCode?: string;
  reportingTimeZone?: string;
  rowCount: number;
  /** Total rows that matched the query, before maxReportRows truncation. */
  matchingRowCount?: number;
  rows: Array<Record<string, string | number>>;
  warnings?: string[];
}

/**
 * Micros-based metrics (ESTIMATED_EARNINGS, OBSERVED_ECPM, ESTIMATED_COST, ...)
 * are converted to whole currency units so the values read naturally.
 */
export function flattenRow(row: ReportRow): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [dimension, dv] of Object.entries(row.dimensionValues ?? {})) {
    if (dv.displayLabel != null && dv.displayLabel !== '') {
      out[dimension] = dv.displayLabel;
      if (dv.value != null) out[`${dimension}_ID`] = dv.value;
    } else {
      out[dimension] = dv.value ?? '';
    }
  }
  for (const [metric, mv] of Object.entries(row.metricValues ?? {})) {
    if (mv.microsValue != null) {
      out[metric] = Number(mv.microsValue) / 1_000_000;
    } else if (mv.integerValue != null) {
      out[metric] = Number(mv.integerValue);
    } else if (mv.doubleValue != null) {
      out[metric] = mv.doubleValue;
    }
  }
  return out;
}

/**
 * networkReport/mediationReport responses are a stream of header/row/footer
 * chunks; collapse them into a single flat table.
 */
export function flattenReport(response: unknown): FlatReport {
  const chunks = (Array.isArray(response) ? response : [response]) as ReportChunk[];
  const report: FlatReport = { rowCount: 0, rows: [] };
  for (const chunk of chunks) {
    if (chunk?.row) {
      report.rows.push(flattenRow(chunk.row));
    }
    if (chunk?.header) {
      report.currencyCode = chunk.header.localizationSettings?.currencyCode ?? undefined;
      report.reportingTimeZone = chunk.header.reportingTimeZone ?? undefined;
    }
    if (chunk?.footer) {
      if (chunk.footer.matchingRowCount != null) {
        report.matchingRowCount = Number(chunk.footer.matchingRowCount);
      }
      const warnings = (chunk.footer.warnings ?? []).map(
        (w) => w.description ?? w.type ?? 'unknown warning',
      );
      if (warnings.length > 0) report.warnings = warnings;
    }
  }
  report.rowCount = report.rows.length;
  return report;
}

export interface ApiDate {
  year: number;
  month: number;
  day: number;
}

export function parseDate(input: string): ApiDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) {
    throw new Error(`Invalid date "${input}" — expected YYYY-MM-DD`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export interface ReportSpecInput {
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions?: string[];
  dimensionFilters?: Array<{ dimension: string; values: string[] }>;
  sortConditions?: Array<{ dimension?: string; metric?: string; order: string }>;
  maxReportRows?: number;
  currencyCode?: string;
}

export interface ReportSpec {
  dateRange: { startDate: ApiDate; endDate: ApiDate };
  metrics: string[];
  dimensions?: string[];
  dimensionFilters?: Array<{ dimension: string; matchesAny: { values: string[] } }>;
  sortConditions?: Array<{ dimension?: string; metric?: string; order: string }>;
  maxReportRows: number;
  localizationSettings?: { currencyCode: string };
}

export function buildReportSpec(input: ReportSpecInput): ReportSpec {
  return {
    dateRange: {
      startDate: parseDate(input.startDate),
      endDate: parseDate(input.endDate),
    },
    metrics: input.metrics,
    dimensions: input.dimensions,
    dimensionFilters: input.dimensionFilters?.map((f) => ({
      dimension: f.dimension,
      matchesAny: { values: f.values },
    })),
    sortConditions: input.sortConditions,
    maxReportRows: input.maxReportRows ?? DEFAULT_MAX_REPORT_ROWS,
    localizationSettings: input.currencyCode ? { currencyCode: input.currencyCode } : undefined,
  };
}
