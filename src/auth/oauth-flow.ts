import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { OAuth2Client } from 'googleapis-common';
import type { Config } from '../config.js';
import { requiredScopes, tokenPath } from './index.js';

interface OAuthClientKeys {
  clientId: string;
  clientSecret: string;
}

async function readClientKeysFile(path: string): Promise<OAuthClientKeys | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as {
      installed?: { client_id?: string; client_secret?: string };
      web?: { client_id?: string; client_secret?: string };
    };
    const keys = parsed.installed ?? parsed.web;
    if (keys?.client_id && keys?.client_secret) {
      return { clientId: keys.client_id, clientSecret: keys.client_secret };
    }
  } catch {
    // fall through to the error below
  }
  throw new Error(
    `${path} is not a valid OAuth client JSON. Download it from https://console.cloud.google.com/apis/credentials (application type: Desktop app).`,
  );
}

async function loadClientKeys(config: Config): Promise<OAuthClientKeys> {
  if (config.googleClientId && config.googleClientSecret) {
    return { clientId: config.googleClientId, clientSecret: config.googleClientSecret };
  }
  const defaultPath = join(config.credentialsDir, 'oauth_client.json');
  const path = config.oauthClientFile ?? defaultPath;
  const keys = await readClientKeysFile(path);
  if (keys) return keys;
  throw new Error(`No OAuth client found. Either:
- save your OAuth client JSON as ${defaultPath} (or pass --client-file <path>), or
- set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
Create one at https://console.cloud.google.com/apis/credentials (application type: Desktop app).`);
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['/c', 'start', '""', url.replace(/&/g, '^&')] : [url];
  const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
  // The URL is also printed to the terminal, so a failed launch is not fatal.
  child.on('error', () => {});
  child.unref();
}

function resultHtml(message: string): string {
  return `<html><body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 4rem;">
<h2>admob-mcp-server</h2><p>${message}</p></body></html>`;
}

async function waitForAuthorizationCode(server: ReturnType<typeof createServer>): Promise<string> {
  try {
    return await new Promise<string>((resolve, reject) => {
      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        if (url.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end();
          return;
        }
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (error) {
          res.end(resultHtml(`Authorization failed: ${error}. You can close this tab.`));
          reject(new Error(`Authorization failed: ${error}`));
        } else if (code) {
          res.end(
            resultHtml(
              'Authentication complete. You can close this tab and return to the terminal.',
            ),
          );
          resolve(code);
        } else {
          res.end(resultHtml('Missing authorization code. You can close this tab.'));
          reject(new Error('Authorization callback did not include a code'));
        }
      });
    });
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

export async function runAuthFlow(config: Config): Promise<void> {
  const keys = await loadClientKeys(config);
  const scopes = requiredScopes(config.readOnly);

  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  const client = new OAuth2Client({
    clientId: keys.clientId,
    clientSecret: keys.clientSecret,
    redirectUri: `http://127.0.0.1:${port}/oauth2callback`,
  });
  // select_account forces the account chooser so the browser's default
  // Google account is not silently reused.
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account',
    scope: scopes,
  });

  console.error(`Requesting scopes:\n  ${scopes.join('\n  ')}\n`);
  console.error(`Opening your browser to sign in. If it does not open, visit:\n\n${authUrl}\n`);
  openBrowser(authUrl);

  const code = await waitForAuthorizationCode(server);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Remove this app\'s previous access at https://myaccount.google.com/permissions and run "auth" again.',
    );
  }

  await fs.mkdir(config.credentialsDir, { recursive: true });
  const file = tokenPath(config);
  const saved = {
    type: 'authorized_user',
    client_id: keys.clientId,
    client_secret: keys.clientSecret,
    refresh_token: tokens.refresh_token,
  };
  await fs.writeFile(file, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });

  console.error(`\nSaved credentials to ${file}`);
  console.error(
    'Setup complete. Add admob-mcp-server to your MCP client — see the README for examples.',
  );
}
