"""Dev-only scheduler. Production ingestion runs via GitHub Actions cron
(see .github/workflows/) — never an always-on scheduler service in prod.

Populated in Phase 2 with the OMM ingestion job.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()
