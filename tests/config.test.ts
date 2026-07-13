import { describe, expect, it } from 'vitest';
import { parseCli, TOOLSET_NAMES } from '../src/config.js';

const emptyEnv = {} as NodeJS.ProcessEnv;

describe('parseCli', () => {
  it('defaults to serving all toolsets in read-only mode', () => {
    const { command, config } = parseCli([], emptyEnv);
    expect(command).toBe('serve');
    expect(config.toolsets).toEqual(TOOLSET_NAMES);
    expect(config.readOnly).toBe(false);
    expect(config.credentialsDir).toContain('.admob-mcp');
  });

  it('parses the auth subcommand with flags', () => {
    const { command, config } = parseCli(['auth', '--read-only'], emptyEnv);
    expect(command).toBe('auth');
    expect(config.readOnly).toBe(true);
  });

  it('parses --toolsets as a comma-separated list, both flag styles', () => {
    expect(parseCli(['--toolsets', 'reports,accounts'], emptyEnv).config.toolsets).toEqual([
      'reports',
      'accounts',
    ]);
    expect(parseCli(['--toolsets=mediation'], emptyEnv).config.toolsets).toEqual(['mediation']);
  });

  it('rejects unknown toolsets and unknown flags', () => {
    expect(() => parseCli(['--toolsets', 'nope'], emptyEnv)).toThrow(/Unknown toolset "nope"/);
    expect(() => parseCli(['--bogus'], emptyEnv)).toThrow(/Unknown argument "--bogus"/);
    expect(() => parseCli(['--toolsets'], emptyEnv)).toThrow(/Missing value/);
  });

  it('reads settings from environment variables', () => {
    const env = {
      ADMOB_TOOLSETS: 'apps',
      ADMOB_READ_ONLY: 'true',
      ADMOB_ACCOUNT: 'accounts/pub-123',
      ADMOB_CREDENTIALS_DIR: '/tmp/creds',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
      GOOGLE_REFRESH_TOKEN: 'token',
    } as NodeJS.ProcessEnv;
    const { config } = parseCli([], env);
    expect(config.toolsets).toEqual(['apps']);
    expect(config.readOnly).toBe(true);
    expect(config.accountId).toBe('pub-123');
    expect(config.credentialsDir).toBe('/tmp/creds');
    expect(config.googleClientId).toBe('id');
    expect(config.googleRefreshToken).toBe('token');
  });

  it('lets CLI flags override environment variables', () => {
    const env = { ADMOB_TOOLSETS: 'apps', ADMOB_ACCOUNT: 'pub-env' } as NodeJS.ProcessEnv;
    const { config } = parseCli(['--toolsets', 'reports', '--account', 'pub-cli'], env);
    expect(config.toolsets).toEqual(['reports']);
    expect(config.accountId).toBe('pub-cli');
  });

  it('normalizes accounts/ prefixed publisher IDs', () => {
    const { config } = parseCli(['--account', 'accounts/pub-42'], emptyEnv);
    expect(config.accountId).toBe('pub-42');
  });
});
