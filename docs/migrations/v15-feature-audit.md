# Schema 15: feature migration audit

Scope: commits starting with `9728d5958fb44963b5bae1a712632414ce869456`
(inclusive), through the Telegram settings layout correction `ec7bffd`.

`migrate_v14_to_v15.ts` adds only missing preferences. Existing values,
credentials, templates, logs, snapshots and widget records are preserved.
The Migrator saves the original storage under `settings_backup_v14` before
applying the registered step and stamps `schema_version: 15` afterward.

| Feature family | Storage treatment |
| --- | --- |
| Synced on-page lyrics (`9728d59`, `82570e3`) | Already migrated in v11 → v12; do not reset lyrics or visualizer settings. |
| Clock and floating clock widget (`3a0edfe`, `808bdca`) | Clock preferences already migrated in v12 → v13; widget placement in v13 → v14. |
| Dockable widget stack and shared lifecycle (`e452fc9`, `0900242`) | Already migrated in v13 → v14, including legacy positions and visibility. |
| Adaptive mini player (`80aa0ad` and follow-ups) | v15 adds missing behavior, hotkey, layout, pin and size preferences using runtime defaults. Existing open/closed state and history remain intact. |
| Voice downloads (`dfd4f0c`) | Optional `voice_download: false`. |
| Video wallpaper action (`34d763e`, `a1254bb`) | `video_wallpaper: true`, independently of downloads. |
| Anonymous stories and unread notifications (`b896acd`, `8a36e19`) | Both optional privacy flags default to false. |
| Messenger filters (`23375b3`) and profile friend recommendations (`cbee584`) | Missing hiding flags default to false. |
| Video recommendations and Premium promotions (`54b202e`) | `block_recommendations_video: true`, matching the existing recommendation-blocking defaults. |
| Dashboard redesign (`533fbca`, `cbee584`) | Missing header illustration preference defaults to true. No migration for CSS, icons, translations or image sizes. |
| Telegram delivery (`303b0cb`, `f15528d`) | Missing master switch defaults to false; missing credentials remain empty. Preserve configured credentials and master switch. Three tracking delivery flags default to true to preserve earlier universal delivery. New-message forwarding defaults to false; preview, group and muted-dialog options follow runtime defaults. Do not seed relay checkpoints, recipient identity or pending messages. |
| Full account export (`2cfdcde`) | Explicit user-started job; no feature switch or synthetic job state. |
| Dialog statistics and friends audit (`9ecb469`, `ba0dc40`) | Manual API tools; no enable flags or fabricated snapshots. |
| Full video playlist download (`c370ac3`) | Uses existing video-download preference and download queue; no new persisted preference. |
| Dialog files, all-dialog library and subscriptions (`cbee584`) | Manual API tools; do not seed caches or scan cursors. |
| Saved video catalog (`f15528d`) | Manual API tool; no enable flag or preloaded library. |
| Avatar identity fix, equalizer opening, background reset, onboarding, menu/layout fixes, ad-log counters | Behavior/UI changes only; retain historical logs and user data. |
| Opera build retirement (`83b8218`) | Packaging change; no storage conversion. |

Default template text was edited for new installations only. Migration must
not rewrite user templates or remove user-authored emoji. Reverted video
experiments in the range introduce no remaining feature or schema change.

Verification: pure migration coverage checks preservation and idempotence;
the real Migrator test checks registry continuity, backup and repeat startup.
Frontend RU/EN articles and screenshots cover the added user-facing tools.
