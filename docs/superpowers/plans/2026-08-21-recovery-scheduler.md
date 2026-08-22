# Recovery scheduler slice

**Status:** Complete pending review

This slice adds the recovery case/action schema and an idempotent worker scheduler. It catches up
all reached invoice-age bands using invoice date as the age anchor. It intentionally does not yet
implement promises, recovery letters, legal decisions, or a recovery UI.

- [x] Add recovery case/action enums, relations, indexes, and migration.
- [x] Add table-driven age-band and stable-key tests.
- [x] Add disposable-PostgreSQL scheduler tests for catch-up and idempotency.
- [x] Register the scheduler in the worker with `RECOVERY_INTERVAL_MINUTES`.
- [x] Update local/production templates and README.
- [x] Run backend verification and commit.
