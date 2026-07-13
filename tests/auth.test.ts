import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleAuth, OAuth2Client } from 'googleapis-common';
import { afterEach, describe, expect, it } from 'vitest';
import { requiredScopes, resolveAuth, WRITE_SCOPE } from '../src/auth/index.js';
import type { Config } from '../src/config.js';

let tempDir: string | undefined;

async function makeConfig(overrides: Partial<Config> = {}): Promise<Config> {
  tempDir = await fs.mkdtemp(join(tmpdir(), 'admob-mcp-test-'));
  return {
    readOnly: false,
    toolsets: ['accounts'],
    credentialsDir: tempDir,
    ...overrides,
  };
}

afterEach(async () => {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  tempDir = undefined;
});

describe('requiredScopes', () => {
  it('omits the monetization scope only in read-only mode', () => {
    expect(requiredScopes(false)).toContain(WRITE_SCOPE);
    expect(requiredScopes(true)).not.toContain(WRITE_SCOPE);
  });
});

describe('resolveAuth priority', () => {
  it('1) uses environment refresh token first', async () => {
    const config = await makeConfig({
      googleClientId: 'env-id',
      googleClientSecret: 'env-secret',
      googleRefreshToken: 'env-refresh',
    });
    await fs.writeFile(
      join(config.credentialsDir, 'token.json'),
      JSON.stringify({ client_id: 'file-id', client_secret: 's', refresh_token: 'file-refresh' }),
    );
    const auth = await resolveAuth(config);
    expect(auth).toBeInstanceOf(OAuth2Client);
    expect((auth as OAuth2Client).credentials.refresh_token).toBe('env-refresh');
  });

  it('2) falls back to token.json saved by the auth command', async () => {
    const config = await makeConfig();
    await fs.writeFile(
      join(config.credentialsDir, 'token.json'),
      JSON.stringify({ client_id: 'file-id', client_secret: 's', refresh_token: 'file-refresh' }),
    );
    const auth = await resolveAuth(config);
    expect(auth).toBeInstanceOf(OAuth2Client);
    expect((auth as OAuth2Client).credentials.refresh_token).toBe('file-refresh');
  });

  it('3) falls back to Application Default Credentials otherwise', async () => {
    const config = await makeConfig();
    const auth = await resolveAuth(config);
    expect(auth).toBeInstanceOf(GoogleAuth);
  });

  it('fails with guidance when token.json is corrupted', async () => {
    const config = await makeConfig();
    await fs.writeFile(join(config.credentialsDir, 'token.json'), 'not json');
    await expect(resolveAuth(config)).rejects.toThrow(/Re-run "npx admob-mcp-server auth"/);
  });
});
