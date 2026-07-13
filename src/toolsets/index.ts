import type { ToolsetName } from '../config.js';
import { registerAccountsToolset } from './accounts.js';
import { registerAdUnitsToolset } from './adunits.js';
import { registerAppsToolset } from './apps.js';
import type { ToolContext } from './common.js';
import { registerMediationToolset } from './mediation.js';
import { registerReportsToolset } from './reports.js';

const REGISTRY: Record<ToolsetName, (ctx: ToolContext) => void> = {
  accounts: registerAccountsToolset,
  apps: registerAppsToolset,
  adunits: registerAdUnitsToolset,
  reports: registerReportsToolset,
  mediation: registerMediationToolset,
};

export function registerToolsets(ctx: ToolContext, toolsets: readonly ToolsetName[]): void {
  for (const name of toolsets) {
    REGISTRY[name](ctx);
  }
}
