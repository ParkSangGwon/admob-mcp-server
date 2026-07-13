import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { AdmobClient } from '../admob/client.js';
import { AUTH_OPTIONS_HELP } from '../auth/index.js';

export interface ToolContext {
  server: McpServer;
  client: () => Promise<AdmobClient>;
  /** Full resource name of the active account, e.g. "accounts/pub-1234567890123456". */
  accountName: () => Promise<string>;
  readOnly: boolean;
}

export const paginationShape = {
  pageSize: z.number().int().positive().optional().describe('Maximum number of items to return'),
  pageToken: z.string().optional().describe('nextPageToken from a previous response'),
};

export function accountNameFromId(id: string): string {
  return `accounts/${id.replace(/^accounts\//, '')}`;
}

interface HttpErrorLike {
  status?: number;
  response?: { status?: number; data?: { error?: { message?: string } } };
}

function describeError(err: unknown): string {
  const httpError = err as HttpErrorLike;
  const status = httpError.status ?? httpError.response?.status;
  const message =
    httpError.response?.data?.error?.message ?? (err instanceof Error ? err.message : String(err));

  if (message.includes('Could not load the default credentials')) {
    return AUTH_OPTIONS_HELP;
  }
  if (status === 401 || message.includes('invalid_grant')) {
    return `Authentication failed: ${message}
The saved token may be expired or revoked. Re-run "npx admob-mcp-server auth".
Note: if your OAuth consent screen is in Testing mode, refresh tokens expire after 7 days — publish the app on the consent screen to get long-lived tokens.`;
  }
  if (status === 403) {
    return `Permission denied: ${message}
Check that:
1. The AdMob API is enabled for your project: https://console.cloud.google.com/apis/library/admob.googleapis.com
2. You signed in with the Google account that has access to this AdMob account
3. The granted scopes cover this tool — write tools need the admob.monetization scope. Tokens created with "auth --read-only" cannot write; re-run "npx admob-mcp-server auth"`;
  }
  if (status === 429) {
    return `AdMob API quota exceeded: ${message}
Retry later, or reduce the request cost (narrower date range, fewer dimensions). Quotas are per Google Cloud project: https://developers.google.com/admob/api/limits`;
  }
  return `AdMob API error${status ? ` (HTTP ${status})` : ''}: ${message}`;
}

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(err: unknown): CallToolResult {
  return { content: [{ type: 'text', text: describeError(err) }], isError: true };
}

/** Runs a tool body and converts thrown errors into isError results the model can act on. */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await fn());
  } catch (err) {
    return errorResult(err);
  }
}
