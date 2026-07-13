import { z } from 'zod';
import { AD_FORMATS } from '../admob/constants.js';
import { paginationShape, runTool, type ToolContext } from './common.js';

export function registerAdUnitsToolset(ctx: ToolContext): void {
  ctx.server.registerTool(
    'list_ad_units',
    {
      title: 'List AdMob ad units',
      description:
        'Lists the ad units in the AdMob account, including ad unit ID (ca-app-pub-.../...), format, and the app they belong to.',
      inputSchema: { ...paginationShape },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adUnits.list({
          parent: await ctx.accountName(),
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  if (ctx.readOnly) return;

  ctx.server.registerTool(
    'create_ad_unit',
    {
      title: 'Create AdMob ad unit',
      description:
        'Creates an ad unit under an app in the AdMob account. Requires the admob.monetization scope.',
      inputSchema: {
        appId: z
          .string()
          .describe(
            'AdMob app ID the ad unit belongs to, e.g. ca-app-pub-XXXXXXXXXXXXXXXX~0123456789',
          ),
        displayName: z.string().describe('Display name of the ad unit (shown in the AdMob UI)'),
        adFormat: z.enum(AD_FORMATS).describe('Ad format of the ad unit'),
        adTypes: z
          .array(z.enum(['RICH_MEDIA', 'VIDEO']))
          .optional()
          .describe('Ad media types supported by this ad unit'),
        rewardSettings: z
          .object({
            unitAmount: z.number().int().positive().describe('Reward amount'),
            unitType: z.string().describe('Reward item, e.g. "coins"'),
          })
          .optional()
          .describe('Reward settings — only for REWARDED / REWARDED_INTERSTITIAL formats'),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.adUnits.create({
          parent: await ctx.accountName(),
          requestBody: {
            appId: args.appId,
            displayName: args.displayName,
            adFormat: args.adFormat,
            adTypes: args.adTypes,
            rewardSettings: args.rewardSettings
              ? {
                  unitAmount: String(args.rewardSettings.unitAmount),
                  unitType: args.rewardSettings.unitType,
                }
              : undefined,
          },
        });
        return res.data;
      }),
  );
}
