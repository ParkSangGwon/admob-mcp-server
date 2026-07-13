#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runAuthFlow } from './auth/oauth-flow.js';
import { parseCli, USAGE } from './config.js';
import { createServer } from './server.js';
import { VERSION } from './version.js';

async function main(): Promise<void> {
  const { command, config } = parseCli(process.argv.slice(2));

  switch (command) {
    case 'help':
      console.log(USAGE);
      return;
    case 'version':
      console.log(VERSION);
      return;
    case 'auth':
      await runAuthFlow(config);
      return;
    case 'serve': {
      const server = createServer(config);
      await server.connect(new StdioServerTransport());
      console.error(
        `admob-mcp-server v${VERSION} ready (toolsets: ${config.toolsets.join(', ')}; mode: ${config.readOnly ? 'read-only' : 'read-write'})`,
      );
      return;
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
