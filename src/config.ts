import { homedir } from 'node:os';
import { join } from 'node:path';

export const TOOLSET_NAMES = ['accounts', 'apps', 'adunits', 'reports', 'mediation'] as const;
export type ToolsetName = (typeof TOOLSET_NAMES)[number];

export interface Config {
  accountId?: string;
  readOnly: boolean;
  toolsets: readonly ToolsetName[];
  credentialsDir: string;
  oauthClientFile?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRefreshToken?: string;
}

export type CommandKind = 'serve' | 'auth' | 'help' | 'version';

export interface Cli {
  command: CommandKind;
  config: Config;
}

export const USAGE = `admob-mcp-server — MCP server for the Google AdMob API

Usage:
  admob-mcp-server [flags]        Start the MCP server on stdio
  admob-mcp-server auth [flags]   Sign in with Google in your browser and save credentials

Flags:
  --toolsets <names>    Comma-separated toolsets to enable (default: all)
                        Available: ${TOOLSET_NAMES.join(', ')}
  --read-only           Skip write tools (create/update) and, for "auth",
                        request only the read scopes. Default: all tools
  --account <pub-id>    AdMob publisher ID (e.g. pub-1234567890123456).
                        Default: auto-discovered from the authenticated account
  --client-file <path>  OAuth client JSON file for the "auth" flow
  -h, --help            Show this help
  -v, --version         Show version

Environment variables:
  ADMOB_ACCOUNT           Same as --account
  ADMOB_TOOLSETS          Same as --toolsets
  ADMOB_READ_ONLY         Set to "true" to skip write tools
  ADMOB_CREDENTIALS_DIR   Where token.json is stored (default: ~/.admob-mcp)
  ADMOB_OAUTH_CLIENT_FILE Same as --client-file
  GOOGLE_CLIENT_ID        OAuth client ID (with GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN,
  GOOGLE_CLIENT_SECRET    used directly without token.json)
  GOOGLE_REFRESH_TOKEN
`;

function parseToolsets(raw: string): ToolsetName[] {
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (names.length === 0) {
    throw new Error('--toolsets requires at least one toolset name');
  }
  for (const name of names) {
    if (!(TOOLSET_NAMES as readonly string[]).includes(name)) {
      throw new Error(`Unknown toolset "${name}". Available toolsets: ${TOOLSET_NAMES.join(', ')}`);
    }
  }
  return names as ToolsetName[];
}

function normalizeAccountId(raw: string): string {
  return raw.startsWith('accounts/') ? raw.slice('accounts/'.length) : raw;
}

export function parseCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Cli {
  let command: CommandKind = 'serve';
  let toolsets: ToolsetName[] | undefined;
  let readOnly = env.ADMOB_READ_ONLY === 'true' || env.ADMOB_READ_ONLY === '1';
  let accountId = env.ADMOB_ACCOUNT;
  let oauthClientFile = env.ADMOB_OAUTH_CLIENT_FILE;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    i++;
    if (arg === undefined) continue;
    const eq = arg.indexOf('=');
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const takeValue = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[i];
      if (next === undefined) throw new Error(`Missing value for ${flag}`);
      i++;
      return next;
    };
    switch (flag) {
      case 'auth':
        command = 'auth';
        break;
      case '--help':
      case '-h':
        command = 'help';
        break;
      case '--version':
      case '-v':
        command = 'version';
        break;
      case '--toolsets':
        toolsets = parseToolsets(takeValue());
        break;
      case '--read-only':
        readOnly = true;
        break;
      case '--account':
        accountId = takeValue();
        break;
      case '--client-file':
        oauthClientFile = takeValue();
        break;
      default:
        throw new Error(`Unknown argument "${flag}". Run with --help for usage.`);
    }
  }

  if (toolsets === undefined && env.ADMOB_TOOLSETS) {
    toolsets = parseToolsets(env.ADMOB_TOOLSETS);
  }

  const config: Config = {
    accountId: accountId ? normalizeAccountId(accountId) : undefined,
    readOnly,
    toolsets: toolsets ?? TOOLSET_NAMES,
    credentialsDir: env.ADMOB_CREDENTIALS_DIR ?? join(homedir(), '.admob-mcp'),
    oauthClientFile,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: env.GOOGLE_REFRESH_TOKEN,
  };

  return { command, config };
}
