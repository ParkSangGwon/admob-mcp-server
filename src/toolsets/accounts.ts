import { z } from 'zod';
import { accountNameFromId, paginationShape, runTool, type ToolContext } from './common.js';

export function registerAccountsToolset(ctx: ToolContext): void {
  ctx.server.registerTool(
    'list_accounts',
    {
      title: 'List AdMob accounts',
      description:
        'Lists the AdMob publisher accounts accessible with the current credentials. Use this to find your publisher ID (pub-XXXXXXXXXXXXXXXX).',
      inputSchema: { ...paginationShape },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const res = await client.accounts.list({
          pageSize: args.pageSize,
          pageToken: args.pageToken,
        });
        return res.data;
      }),
  );

  ctx.server.registerTool(
    'get_account',
    {
      title: 'Get AdMob account',
      description:
        'Gets an AdMob publisher account: publisher ID, reporting currency, and reporting time zone. Defaults to the configured or auto-discovered account.',
      inputSchema: {
        accountId: z
          .string()
          .optional()
          .describe('Publisher ID (e.g. pub-1234567890123456). Defaults to the active account.'),
      },
      annotations: { readOnlyHint: true },
    },
    async (args) =>
      runTool(async () => {
        const client = await ctx.client();
        const name = args.accountId ? accountNameFromId(args.accountId) : await ctx.accountName();
        const res = await client.accounts.get({ name });
        return res.data;
      }),
  );
}
