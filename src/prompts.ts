import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const daysArg = z.string().optional().describe('Number of days to look back (default: 7)');

function userMessage(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'top_performing_apps',
    {
      title: 'Top performing apps',
      description: 'Rank your apps by AdMob revenue over a recent period',
      argsSchema: { days: daysArg },
    },
    ({ days }) => {
      const d = days ?? '7';
      return userMessage(`Analyze my AdMob app performance for the last ${d} days.

1. Compute the date range: endDate = today, startDate = ${d} days before today (YYYY-MM-DD).
2. Call generate_network_report with dimensions ["APP"] and metrics ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM", "MATCH_RATE"], sorted by ESTIMATED_EARNINGS descending.
3. Present a ranked table of apps: earnings (with currency), impressions, RPM, and each app's share of total revenue.
4. Call out any app with an unusually low match rate or RPM compared to the others.`);
    },
  );

  server.registerPrompt(
    'revenue_summary',
    {
      title: 'Revenue summary',
      description: 'Summarize AdMob revenue trends over a recent period',
      argsSchema: { days: daysArg },
    },
    ({ days }) => {
      const d = days ?? '7';
      return userMessage(`Summarize my AdMob revenue for the last ${d} days.

1. Compute the date range: endDate = today, startDate = ${d} days before today (YYYY-MM-DD).
2. Call generate_network_report with dimensions ["DATE"] and metrics ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM", "AD_REQUESTS", "MATCH_RATE"], sorted by DATE ascending.
3. Report: total earnings (with currency), average daily earnings, and the day-over-day trend.
4. Flag any anomalies (sudden drops or spikes in earnings, match rate, or RPM) with the dates they happened.`);
    },
  );

  server.registerPrompt(
    'compare_ad_formats',
    {
      title: 'Compare ad formats',
      description: 'Compare how each ad format (banner, interstitial, rewarded...) monetizes',
      argsSchema: { days: daysArg },
    },
    ({ days }) => {
      const d = days ?? '30';
      return userMessage(`Compare the performance of my AdMob ad formats over the last ${d} days.

1. Compute the date range: endDate = today, startDate = ${d} days before today (YYYY-MM-DD).
2. Call generate_network_report with dimensions ["FORMAT"] and metrics ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSION_RPM", "IMPRESSION_CTR", "SHOW_RATE"].
3. Present a comparison table and explain which formats earn the most in total and which are most efficient (highest RPM).
4. Suggest one concrete change worth testing based on the numbers (e.g. formats with high RPM but low volume).`);
    },
  );
}
