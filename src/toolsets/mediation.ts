import { z } from 'zod';
import type { admob_v1beta } from '@googleapis/admob';
import { AD_FORMATS, PLATFORMS } from '../admob/constants.js';
import { paginationShape, runTool, type ToolContext } from './common.js';

const mediationGroupLineSchema = z.object({
  id: z
    .string()
    .optional()
    .describe('Line ID. For new lines use distinct negative placeholders ("-1", "-2", ...)'),
  displayName: z.string().describe('Display name of the line'),
  adSourceId: z.string().describe('Ad source this line serves — get IDs from list_ad_sources'),
  cpmMode: z
    .enum(['LIVE', 'MANUAL', 'ANO'])
    .optional()
    .describe(
      'CPM mode: LIVE (real-time from the network), MANUAL (fixed CPM), ANO (network-optimized)',
    ),
  cpmMicros: z
    .number()
    .optional()
    .describe('Fixed CPM in micros of the account currency (only with cpmMode MANUAL)'),
  adUnitMappings: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Map of AdMob ad unit ID to ad unit mapping resource name (from create_ad_unit_mapping)',
    ),
});

type MediationGroupLineInput = z.infer<typeof mediationGroupLineSchema>;

function toApiLine(
  line: MediationGroupLineInput,
): admob_v1beta.Schema$MediationGroupMediationGroupLine {
  return {
    id: line.id,
    displayName: line.displayName,
    adSourceId: line.adSourceId,
    cpmMode: line.cpmMode,
    cpmMicros: line.cpmMicros != null ? String(line.cpmMicros) : undefined,
    adUnitMappings: line.adUnitMappings,
  };
}

export function registerMediationToolset(ctx: ToolContext): void {
  ctx.server.registerTool(
    'list_ad_sources',
    {
      title: 'List ad sources',
      description:
        'Lists the mediation ad sources (ad networks) available to the AdMob account, with their ad source IDs.',
      inputSchema: { ...paginationShape },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adSources.list({
          parent: await ctx.accountName(),
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'list_adapters',
    {
      title: 'List ad source adapters',
      description:
        'Lists the adapters of a mediation ad source, including the adapter ID and required ad unit configuration keys (needed for create_ad_unit_mapping).',
      inputSchema: {
        adSourceId: z.string().describe('Ad source ID from list_ad_sources'),
        ...paginationShape,
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adSources.adapters.list({
          parent: `${await ctx.accountName()}/adSources/${args.adSourceId}`,
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'list_mediation_groups',
    {
      title: 'List mediation groups',
      description:
        'Lists the mediation groups in the AdMob account, including targeting (format, platform, ad units) and mediation lines.',
      inputSchema: {
        ...paginationShape,
        filter: z
          .string()
          .optional()
          .describe(
            'Optional filter, e.g. \'AD_SOURCE_IDS IN ("5450213213286189855")\' or \'DISPLAY_NAME CONTAINS "waterfall"\'',
          ),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.mediationGroups.list({
          parent: await ctx.accountName(),
          pageSize: args.pageSize,
          pageToken: args.pageToken,
          filter: args.filter,
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'list_ad_unit_mappings',
    {
      title: 'List ad unit mappings',
      description:
        'Lists the ad unit mappings (third-party network placements) attached to an AdMob ad unit.',
      inputSchema: {
        adUnitId: z
          .string()
          .describe('Ad unit ID, e.g. the numeric part after "/" in ca-app-pub-XXX/YYYYYYYYYY'),
        ...paginationShape,
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adUnits.adUnitMappings.list({
          parent: `${await ctx.accountName()}/adUnits/${args.adUnitId}`,
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  if (ctx.readOnly) return;

  ctx.server.registerTool(
    'create_ad_unit_mapping',
    {
      title: 'Create ad unit mapping',
      description:
        'Creates an ad unit mapping that links an AdMob ad unit to a third-party network placement via an adapter. Get the adapter ID and required configuration keys from list_adapters. Requires the admob.monetization scope.',
      inputSchema: {
        adUnitId: z.string().describe('AdMob ad unit ID to attach the mapping to'),
        adapterId: z.string().describe('Adapter ID from list_adapters'),
        adUnitConfigurations: z
          .record(z.string(), z.string())
          .describe(
            "Adapter configuration key/value pairs, keys from the adapter's adUnitConfigurations",
          ),
        displayName: z.string().optional().describe('Display name of the mapping'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adUnits.adUnitMappings.create({
          parent: `${await ctx.accountName()}/adUnits/${args.adUnitId}`,
          requestBody: {
            adapterId: args.adapterId,
            adUnitConfigurations: args.adUnitConfigurations,
            displayName: args.displayName,
          },
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'create_mediation_group',
    {
      title: 'Create mediation group',
      description:
        'Creates a mediation group targeting a format/platform and a set of ad units, with optional mediation lines for third-party ad sources. Requires the admob.monetization scope.',
      inputSchema: {
        displayName: z.string().describe('Display name of the mediation group'),
        platform: z.enum(PLATFORMS).describe('Targeted platform'),
        format: z.enum(AD_FORMATS).describe('Targeted ad format'),
        adUnitIds: z
          .array(z.string())
          .min(1)
          .describe('AdMob ad unit IDs this mediation group serves'),
        targetedRegionCodes: z
          .array(z.string())
          .optional()
          .describe('CLDR region codes to target (omit for all regions)'),
        excludedRegionCodes: z
          .array(z.string())
          .optional()
          .describe('CLDR region codes to exclude'),
        idfaTargeting: z
          .enum(['ALL', 'AVAILABLE', 'UNAVAILABLE'])
          .optional()
          .describe('iOS IDFA targeting'),
        mediationGroupLines: z
          .array(mediationGroupLineSchema)
          .optional()
          .describe('Mediation lines (ad sources) in the group'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const lines = args.mediationGroupLines?.map((line, i) =>
          toApiLine({ ...line, id: line.id ?? String(-(i + 1)) }),
        );
        const res = await client.accounts.mediationGroups.create({
          parent: await ctx.accountName(),
          requestBody: {
            displayName: args.displayName,
            targeting: {
              platform: args.platform,
              format: args.format,
              adUnitIds: args.adUnitIds,
              targetedRegionCodes: args.targetedRegionCodes,
              excludedRegionCodes: args.excludedRegionCodes,
              idfaTargeting: args.idfaTargeting,
            },
            mediationGroupLines: lines
              ? Object.fromEntries(lines.map((line) => [line.id ?? '', line]))
              : undefined,
          },
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'update_mediation_group',
    {
      title: 'Update mediation group',
      description:
        'Patches a mediation group. Pass the fields to change in mediationGroup and list their paths in updateMask (e.g. "display_name,targeting.ad_unit_ids"). Requires the admob.monetization scope.',
      inputSchema: {
        mediationGroupId: z.string().describe('Mediation group ID from list_mediation_groups'),
        updateMask: z
          .string()
          .describe('Comma-separated field mask, e.g. "display_name,mediation_group_lines"'),
        mediationGroup: z
          .record(z.string(), z.unknown())
          .describe(
            'MediationGroup fields to update, following the AdMob API v1beta MediationGroup schema',
          ),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.mediationGroups.patch({
          name: `${await ctx.accountName()}/mediationGroups/${args.mediationGroupId}`,
          updateMask: args.updateMask,
          // Passthrough by design: the field mask decides the shape; Google validates it.
          requestBody: args.mediationGroup as admob_v1beta.Schema$MediationGroup,
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'create_mediation_ab_experiment',
    {
      title: 'Create mediation A/B experiment',
      description:
        'Creates an A/B experiment on a mediation group: the treatment variant serves the given mediation lines against the existing setup. Requires the admob.monetization scope.',
      inputSchema: {
        mediationGroupId: z.string().describe('Mediation group ID to experiment on'),
        displayName: z.string().describe('Display name of the experiment'),
        treatmentTrafficPercentage: z
          .number()
          .int()
          .min(1)
          .max(99)
          .optional()
          .describe('Percentage of traffic sent to the treatment variant (1-99)'),
        treatmentMediationLines: z
          .array(mediationGroupLineSchema)
          .min(1)
          .describe('Mediation lines served by the treatment variant'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.mediationGroups.mediationAbExperiments.create({
          parent: `${await ctx.accountName()}/mediationGroups/${args.mediationGroupId}`,
          requestBody: {
            displayName: args.displayName,
            treatmentTrafficPercentage:
              args.treatmentTrafficPercentage != null
                ? String(args.treatmentTrafficPercentage)
                : undefined,
            treatmentMediationLines: args.treatmentMediationLines.map((line) => ({
              mediationGroupLine: toApiLine(line),
            })),
          },
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'stop_mediation_ab_experiment',
    {
      title: 'Stop mediation A/B experiment',
      description:
        'Stops the running A/B experiment on a mediation group by choosing the winning variant. Requires the admob.monetization scope.',
      inputSchema: {
        mediationGroupId: z.string().describe('Mediation group ID whose experiment to stop'),
        variantChoice: z
          .enum(['VARIANT_CHOICE_A', 'VARIANT_CHOICE_B'])
          .describe('Winning variant to keep serving (A = control, B = treatment)'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.mediationGroups.mediationAbExperiments.stop({
          name: `${await ctx.accountName()}/mediationGroups/${args.mediationGroupId}/mediationAbExperiments`,
          requestBody: { variantChoice: args.variantChoice },
        });
        return res.data;
      }),
  );
}
