import { z } from 'zod';
import { PLATFORMS } from '../admob/constants.js';
import { paginationShape, runTool, type ToolContext } from './common.js';

export function registerAppsToolset(ctx: ToolContext): void {
  ctx.server.registerTool(
    'list_apps',
    {
      title: 'List AdMob apps',
      description:
        'Lists the apps registered in the AdMob account, including app ID (ca-app-pub-...~...), platform, store link state, and approval state.',
      inputSchema: { ...paginationShape },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.apps.list({
          parent: await ctx.accountName(),
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  if (ctx.readOnly) return;

  ctx.server.registerTool(
    'create_app',
    {
      title: 'Create AdMob app',
      description:
        'Creates an app in the AdMob account. Provide appStoreId to link a published store listing, or displayName to register an unpublished app manually. Requires the admob.monetization scope.',
      inputSchema: {
        platform: z.enum(PLATFORMS).describe('App platform'),
        displayName: z
          .string()
          .optional()
          .describe('Display name for an app that is not published on a store yet'),
        appStoreId: z
          .string()
          .optional()
          .describe(
            'Store ID to link — Android package name (com.example.app) or iOS numeric App Store ID',
          ),
      },
      annotations: { readOnlyHint: false },
    },
    async (args) =>
      runTool(async () => {
        if (!args.displayName && !args.appStoreId) {
          throw new Error(
            'Provide appStoreId (to link a store listing) or displayName (to register the app manually).',
          );
        }
        const client = await ctx.client();
        const res = await client.accounts.apps.create({
          parent: await ctx.accountName(),
          requestBody: {
            platform: args.platform,
            ...(args.appStoreId
              ? { linkedAppInfo: { appStoreId: args.appStoreId } }
              : { manualAppInfo: { displayName: args.displayName } }),
          },
        });
        return res.data;
      }),
  );
}
