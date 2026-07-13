import { admob, admob_v1beta } from '@googleapis/admob';
import { resolveAuth } from '../auth/index.js';
import type { Config } from '../config.js';

export type AdmobClient = admob_v1beta.Admob;

export async function createAdmobClient(config: Config): Promise<AdmobClient> {
  const auth = await resolveAuth(config);
  return admob({ version: 'v1beta', auth });
}

export async function discoverAccountName(
  client: AdmobClient,
  configuredId?: string,
): Promise<string> {
  if (configuredId) return `accounts/${configuredId}`;
  const res = await client.accounts.list({ pageSize: 20 });
  const accounts = res.data.account ?? [];
  const first = accounts[0];
  if (!first?.name) {
    throw new Error(
      'No AdMob publisher account is accessible with these credentials. Sign in with the Google account that owns your AdMob account.',
    );
  }
  if (accounts.length > 1) {
    const ids = accounts.map((a) => a.publisherId ?? a.name).join(', ');
    throw new Error(
      `Multiple AdMob accounts found (${ids}). Set ADMOB_ACCOUNT (or --account) to the publisher ID to use.`,
    );
  }
  return first.name;
}
