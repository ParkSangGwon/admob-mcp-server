import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CAMPAIGN_REPORT_DIMENSIONS,
  CAMPAIGN_REPORT_METRICS,
  MEDIATION_REPORT_DIMENSIONS,
  MEDIATION_REPORT_METRICS,
  NETWORK_REPORT_DIMENSIONS,
  NETWORK_REPORT_METRICS,
} from './admob/constants.js';

interface ReportReference {
  name: string;
  title: string;
  description: string;
  body: {
    dimensions: readonly string[];
    metrics: readonly string[];
    notes: string[];
  };
}

const REFERENCES: ReportReference[] = [
  {
    name: 'network-report-spec',
    title: 'Network report dimensions & metrics',
    description: 'Valid dimensions and metrics for generate_network_report',
    body: {
      dimensions: NETWORK_REPORT_DIMENSIONS,
      metrics: NETWORK_REPORT_METRICS,
      notes: [
        'ESTIMATED_EARNINGS and IMPRESSION_RPM are monetary; the server converts micros to currency units.',
        'DATE, MONTH, and WEEK values are formatted YYYYMMDD.',
        'Not every dimension/metric combination is valid — the API rejects invalid combinations.',
      ],
    },
  },
  {
    name: 'mediation-report-spec',
    title: 'Mediation report dimensions & metrics',
    description: 'Valid dimensions and metrics for generate_mediation_report',
    body: {
      dimensions: MEDIATION_REPORT_DIMENSIONS,
      metrics: MEDIATION_REPORT_METRICS,
      notes: [
        "OBSERVED_ECPM is the third-party network's estimated average eCPM, converted from micros.",
        'AD_SOURCE, AD_SOURCE_INSTANCE, and MEDIATION_GROUP dimensions also return display labels.',
      ],
    },
  },
  {
    name: 'campaign-report-spec',
    title: 'Campaign report dimensions & metrics',
    description: 'Valid dimensions and metrics for generate_campaign_report',
    body: {
      dimensions: CAMPAIGN_REPORT_DIMENSIONS,
      metrics: CAMPAIGN_REPORT_METRICS,
      notes: [
        'The date range must be within the last 30 days.',
        'ESTIMATED_COST and AVERAGE_CPI are monetary; the server converts micros to currency units.',
      ],
    },
  },
];

export function registerResources(server: McpServer): void {
  for (const ref of REFERENCES) {
    server.registerResource(
      ref.name,
      `admob://reference/${ref.name}`,
      {
        title: ref.title,
        description: ref.description,
        mimeType: 'application/json',
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(ref.body, null, 2),
          },
        ],
      }),
    );
  }
}
