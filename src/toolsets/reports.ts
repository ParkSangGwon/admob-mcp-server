import { z } from 'zod';
import {
  CAMPAIGN_REPORT_DIMENSIONS,
  CAMPAIGN_REPORT_METRICS,
  DEFAULT_MAX_REPORT_ROWS,
  MAX_REPORT_ROWS_LIMIT,
  MEDIATION_REPORT_DIMENSIONS,
  MEDIATION_REPORT_METRICS,
  NETWORK_REPORT_DIMENSIONS,
  NETWORK_REPORT_METRICS,
  SORT_ORDERS,
} from '../admob/constants.js';
import { buildReportSpec, flattenReport, flattenRow, parseDate } from '../admob/reports.js';
import { runTool, type ToolContext } from './common.js';

type EnumValues = readonly [string, ...string[]];

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .describe('Date in YYYY-MM-DD format');

function reportInputShape(dimensions: EnumValues, metrics: EnumValues) {
  return {
    startDate: dateSchema.describe('Start date (YYYY-MM-DD), inclusive'),
    endDate: dateSchema.describe('End date (YYYY-MM-DD), inclusive'),
    metrics: z.array(z.enum(metrics)).min(1).describe('Metrics to report'),
    dimensions: z.array(z.enum(dimensions)).optional().describe('Dimensions to group rows by'),
    dimensionFilters: z
      .array(
        z.object({
          dimension: z.enum(dimensions),
          values: z.array(z.string()).min(1).describe('Dimension values to match'),
        }),
      )
      .optional()
      .describe('Only include rows whose dimension matches one of the given values'),
    sortConditions: z
      .array(
        z.object({
          dimension: z.enum(dimensions).optional(),
          metric: z.enum(metrics).optional(),
          order: z.enum(SORT_ORDERS),
        }),
      )
      .optional()
      .describe('Sort order — set either dimension or metric per condition'),
    maxReportRows: z
      .number()
      .int()
      .min(1)
      .max(MAX_REPORT_ROWS_LIMIT)
      .optional()
      .describe(`Maximum rows to return (default ${DEFAULT_MAX_REPORT_ROWS})`),
    currencyCode: z
      .string()
      .length(3)
      .optional()
      .describe('ISO 4217 currency for monetary metrics (default: account currency)'),
  };
}

const MONETARY_NOTE =
  'Monetary metrics are converted from micros to whole currency units (see currencyCode).';

export function registerReportsToolset(ctx: ToolContext): void {
  ctx.server.registerTool(
    'generate_network_report',
    {
      title: 'Generate AdMob network report',
      description: `Generates an AdMob Network earnings/performance report (requests, impressions, clicks, estimated earnings, match rate, RPM...). ${MONETARY_NOTE}`,
      inputSchema: reportInputShape(NETWORK_REPORT_DIMENSIONS, NETWORK_REPORT_METRICS),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.networkReport.generate({
          parent: await ctx.accountName(),
          requestBody: { reportSpec: buildReportSpec(args) },
        });
        return flattenReport(res.data);
      }),
  );

  ctx.server.registerTool(
    'generate_mediation_report',
    {
      title: 'Generate AdMob mediation report',
      description: `Generates an AdMob Mediation report across ad sources (waterfall/bidding): impressions, estimated earnings, observed eCPM per AD_SOURCE, MEDIATION_GROUP, and more. ${MONETARY_NOTE}`,
      inputSchema: reportInputShape(MEDIATION_REPORT_DIMENSIONS, MEDIATION_REPORT_METRICS),
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.mediationReport.generate({
          parent: await ctx.accountName(),
          requestBody: { reportSpec: buildReportSpec(args) },
        });
        return flattenReport(res.data);
      }),
  );

  ctx.server.registerTool(
    'generate_campaign_report',
    {
      title: 'Generate AdMob campaign report',
      description: `Generates a report for AdMob cross-promotion campaigns: impressions, clicks, installs, estimated cost. Date range must be within the last 30 days. ${MONETARY_NOTE}`,
      inputSchema: {
        startDate: dateSchema.describe(
          'Start date (YYYY-MM-DD), inclusive, within the last 30 days',
        ),
        endDate: dateSchema.describe('End date (YYYY-MM-DD), inclusive'),
        metrics: z.array(z.enum(CAMPAIGN_REPORT_METRICS)).min(1).describe('Metrics to report'),
        dimensions: z
          .array(z.enum(CAMPAIGN_REPORT_DIMENSIONS))
          .optional()
          .describe('Dimensions to group rows by'),
        languageCode: z
          .string()
          .optional()
          .describe('IETF language tag for localized text, e.g. "en-US"'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.campaignReport.generate({
          parent: await ctx.accountName(),
          requestBody: {
            reportSpec: {
              dateRange: {
                startDate: parseDate(args.startDate),
                endDate: parseDate(args.endDate),
              },
              metrics: args.metrics,
              dimensions: args.dimensions,
              languageCode: args.languageCode,
            },
          },
        });
        const rows = (res.data.rows ?? []).map(flattenRow);
        return { rowCount: rows.length, rows };
      }),
  );
}
