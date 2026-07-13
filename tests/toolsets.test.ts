import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';
import { AUTH_OPTIONS_HELP } from '../src/auth/index.js';
import type { Config } from '../src/config.js';
import { createServer } from '../src/server.js';
import { runTool } from '../src/toolsets/common.js';

async function listToolNames(config: Config): Promise<string[]> {
  const server = createServer(config);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const names = (await client.listTools()).tools.map((t) => t.name);
  await client.close();
  await server.close();
  return names;
}

const baseConfig: Config = {
  readOnly: false,
  toolsets: ['accounts', 'apps', 'adunits', 'reports', 'mediation'],
  credentialsDir: '/nonexistent',
};

describe('toolset registration', () => {
  it('registers all tools by default', async () => {
    const names = await listToolNames(baseConfig);
    expect(names).toHaveLength(18);
    expect(names).toContain('create_app');
    expect(names).toContain('create_ad_unit');
    expect(names).toContain('stop_mediation_ab_experiment');
  });

  it('skips write tools in read-only mode', async () => {
    const names = await listToolNames({ ...baseConfig, readOnly: true });
    expect(names).toHaveLength(11);
    expect(names).not.toContain('create_app');
    expect(names).not.toContain('update_mediation_group');
  });

  it('respects the toolsets selection', async () => {
    const names = await listToolNames({ ...baseConfig, toolsets: ['reports'] });
    expect(names).toEqual([
      'generate_network_report',
      'generate_mediation_report',
      'generate_campaign_report',
    ]);
  });
});

describe('runTool error mapping', () => {
  async function messageFor(err: unknown): Promise<string> {
    const result = await runTool(async () => {
      throw err;
    });
    expect(result.isError).toBe(true);
    const first = result.content[0];
    if (first?.type !== 'text') throw new Error('expected text content');
    return first.text;
  }

  it('maps 403 to actionable permission guidance', async () => {
    const text = await messageFor({
      status: 403,
      response: { data: { error: { message: 'The caller does not have permission' } } },
    });
    expect(text).toContain('Permission denied');
    expect(text).toContain('admob.googleapis.com');
    expect(text).toContain('admob.monetization');
  });

  it('maps invalid_grant to re-auth guidance', async () => {
    const text = await messageFor(new Error('invalid_grant: Token has been expired or revoked.'));
    expect(text).toContain('Re-run "npx admob-mcp-server auth"');
    expect(text).toContain('Testing mode');
  });

  it('maps 429 to quota guidance', async () => {
    const text = await messageFor({
      status: 429,
      response: { data: { error: { message: 'Quota exceeded' } } },
    });
    expect(text).toContain('quota');
    expect(text).toContain('developers.google.com/admob/api/limits');
  });

  it('maps missing ADC to the credential setup options', async () => {
    const text = await messageFor(
      new Error(
        'Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication',
      ),
    );
    expect(text).toBe(AUTH_OPTIONS_HELP);
  });

  it('wraps successful results as JSON text', async () => {
    const result = await runTool(async () => ({ ok: true }));
    expect(result.isError).toBeUndefined();
    const first = result.content[0];
    expect(first?.type === 'text' && JSON.parse(first.text)).toEqual({ ok: true });
  });
});
