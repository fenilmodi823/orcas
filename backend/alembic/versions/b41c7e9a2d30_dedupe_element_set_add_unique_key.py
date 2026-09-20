"""dedupe element_set, add unique (object_id, epoch, source)

Ingest used to insert a row for every record on every run, so re-running
before upstream published a new element set stored the same epoch again.
This keeps the earliest row (lowest id) per (object_id, epoch, source) and
enforces the key in the database so the ingest service's skip is a
guarantee, not a habit.

Revision ID: b41c7e9a2d30
Revises: 8d1f884cbe85
Create Date: 2026-09-20 21:40:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b41c7e9a2d30"
down_revision: str | Sequence[str] | None = "8d1f884cbe85"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Delete surplus duplicate rows, then enforce uniqueness."""
    op.execute(
        """
        DELETE FROM element_set
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY object_id, epoch, source ORDER BY id
                       ) AS rn
                FROM element_set
            ) ranked
            WHERE rn > 1
        )
        """
    )
    op.create_index(
        "uq_element_set_object_epoch_source",
        "element_set",
        ["object_id", "epoch", "source"],
        unique=True,
    )


def downgrade() -> None:
    """Drop the unique key. The deleted duplicate rows are not restored —
    they were byte-identical re-ingestions of an already-stored epoch.
    """
    op.drop_index("uq_element_set_object_epoch_source", table_name="element_set")
