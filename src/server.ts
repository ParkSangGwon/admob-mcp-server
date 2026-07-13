import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAdmobClient, discoverAccountName, type AdmobClient } from './admob/client.js';
import type { Config } from './config.js';
import { registerPrompts } from './prompts.js';
import { registerResources } from './resources.js';
import type { ToolContext } from './toolsets/common.js';
import { registerToolsets } from './toolsets/index.js';
import { VERSION } from './version.js';

export function createServer(config: Config): McpServer {
  const server = new McpServer({ name: 'admob-mcp-server', version: VERSION });

  // Auth and account discovery are lazy so the server starts (and lists tools)
  // even before credentials exist; failures surface per tool call. Rejected
  // promises are not cached so transient failures can recover.
  let clientPromise: Promise<AdmobClient> | undefined;
  let accountPromise: Promise<string> | undefined;
  const ctx: ToolContext = {
    server,
    client: () =>
      (clientPromise ??= createAdmobClient(config).catch((err: unknown) => {
        clientPromise = undefined;
        throw err;
      })),
    accountName: () =>
      (accountPromise ??= ctx
        .client()
        .then((client) => discoverAccountName(client, config.accountId))
        .catch((err: unknown) => {
          accountPromise = undefined;
          throw err;
        })),
    readOnly: config.readOnly,
  };

  registerToolsets(ctx, config.toolsets);
  registerPrompts(server);
  registerResources(server);
  return server;
}
