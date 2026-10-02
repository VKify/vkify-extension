# Schema 16: Center API tools

Scope: API friend automation (`8fee586`) and community parsing, list sources,
shared controls and Center styling (`87a2721`).

The registered `migrate_v15_to_v16.ts` step disables the legacy
`auto_add_friends` DOM toggle. It never starts a job or acknowledges risk.
The Migrator backs up schema 15 under `settings_backup_v15` before applying
the step, then stamps `schema_version: 16`.

Legacy friend settings are copied into a stopped `auto_add_stats` record
only when API options do not already exist. Hourly limits are bounded to
1–20; delays to 30–600 seconds, with maximum delay at least the minimum.
Missing daily/session limits use 25/10. Existing DOM success counts remain;
API attempts start at zero because old success counts cannot reconstruct
failed requests or an account-specific budget. An enabled legacy run is
marked interrupted and must be started manually with risk confirmation.
Legacy preference keys remain available for recovery.

Existing API job options, status, account identity and uploaded list sources
are preserved. `auto_add_ledger`, `group_parser_state` (including partial
results) and `group_parser_ledger` remain untouched. No parser job, member
list or request ledger is fabricated. New installations need no seeded job.
Checkboxes, disclosure panels, avatars and layout changes require no data
conversion.

Verification covers frozen input, bounds, repeated migration, existing API
state and partial-result preservation, registry continuity and the real
Migrator's backup/version behavior.
