# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-14

### Added

- Initial release covering the AdMob API v1beta.
- 11 read tools: `list_accounts`, `get_account`, `list_apps`, `list_ad_units`, `generate_network_report`, `generate_mediation_report`, `generate_campaign_report`, `list_ad_sources`, `list_adapters`, `list_mediation_groups`, `list_ad_unit_mappings`.
- 7 write tools: `create_app`, `create_ad_unit`, `create_ad_unit_mapping`, `create_mediation_group`, `update_mediation_group`, `create_mediation_ab_experiment`, `stop_mediation_ab_experiment`.
- Toolset selection via `--toolsets` / `ADMOB_TOOLSETS`, and a `--read-only` / `ADMOB_READ_ONLY` mode that skips write tools and requests only read scopes.
- Three authentication paths: built-in browser OAuth flow (`admob-mcp-server auth`, dynamic-port loopback), environment-variable refresh token, and Application Default Credentials.
- Report responses flattened to row tables with micros-to-currency conversion.
- Analysis prompts (`top_performing_apps`, `revenue_summary`, `compare_ad_formats`) and report-spec reference resources.

[Unreleased]: https://github.com/ParkSangGwon/admob-mcp-server/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ParkSangGwon/admob-mcp-server/releases/tag/v0.1.0
