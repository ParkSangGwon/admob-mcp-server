import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { GoogleAuth, OAuth2Client } from 'googleapis-common';
import type { Config } from '../config.js';

export const READ_SCOPES = [
  'https://www.googleapis.com/auth/admob.readonly',
  'https://www.googleapis.com/auth/admob.report',
] as const;

export const WRITE_SCOPE = 'https://www.googleapis.com/auth/admob.monetization';

export type AdmobAuth = OAuth2Client | GoogleAuth;

export function requiredScopes(readOnly: boolean): string[] {
  return readOnly ? [...READ_SCOPES] : [...READ_SCOPES, WRITE_SCOPE];
}

export function tokenPath(config: Config): string {
  return join(config.credentialsDir, 'token.json');
}

export const AUTH_OPTIONS_HELP = `No usable Google credentials found. Set up one of:
1. Run "npx admob-mcp-server auth" once to sign in with your browser (recommended)
2. Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN environment variables
3. Use gcloud Application Default Credentials:
   gcloud auth application-default login \\
     --scopes=${[...READ_SCOPES, WRITE_SCOPE].join(',')} \\
     --client-id-file=YOUR_OAUTH_CLIENT.json
See the README for the full setup guide.`;

interface SavedToken {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

async function loadSavedToken(config: Config): Promise<SavedToken | undefined> {
  const file = tokenPath(config);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SavedToken>;
    if (
      typeof parsed.client_id === 'string' &&
      typeof parsed.client_secret === 'string' &&
      typeof parsed.refresh_token === 'string'
    ) {
      return { ...parsed } as SavedToken;
    }
  } catch {
    // fall through to the error below
  }
  throw new Error(
    `Invalid token file at ${file}. Re-run "npx admob-mcp-server auth" to sign in again.`,
  );
}

/**
 * Credential resolution order:
 * 1. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN environment variables
 * 2. token.json saved by the "auth" command
 * 3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC)
 */
export async function resolveAuth(config: Config): Promise<AdmobAuth> {
  if (config.googleClientId && config.googleClientSecret && config.googleRefreshToken) {
    const client = new OAuth2Client({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    });
    client.setCredentials({ refresh_token: config.googleRefreshToken });
    return client;
  }

  const saved = await loadSavedToken(config);
  if (saved) {
    const client = new OAuth2Client({
      clientId: saved.client_id,
      clientSecret: saved.client_secret,
    });
    client.setCredentials({ refresh_token: saved.refresh_token });
    return client;
  }

  return new GoogleAuth({ scopes: requiredScopes(config.readOnly) });
}
