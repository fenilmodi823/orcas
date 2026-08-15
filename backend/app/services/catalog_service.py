"""Orchestrates catalogue reads: list/filter/paginate space_object, fetch
one object's identity plus its latest element_set. No physics of its own —
see Rules.md layering.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.models import ElementSet, SpaceObject


async def list_objects(
    session: AsyncSession, limit: int, offset: int, search: str | None = None
) -> tuple[list[SpaceObject], int]:
    """Paginated catalogue. `search` matches name or norad_id — the only
    fields the GP ingestion worker actually populates. Filtering on SATCAT
    fields (object_type/operator/country) isn't offered: those columns stay
    NULL until a SATCAT ingestion pass exists, so a filter on them would
    silently match nothing rather than do what it looks like it does.
    """
    stmt = select(SpaceObject)
    count_stmt = select(func.count()).select_from(SpaceObject)
    if search:
        condition = (SpaceObject.name.ilike(f"%{search}%")) | (SpaceObject.norad_id == search)
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    total = (await session.execute(count_stmt)).scalar_one()
    rows = (
        await session.execute(stmt.order_by(SpaceObject.norad_id).limit(limit).offset(offset))
    ).scalars()
    return list(rows.all()), total


async def get_object(session: AsyncSession, norad_id: str) -> SpaceObject | None:
    stmt = select(SpaceObject).where(SpaceObject.norad_id == norad_id)
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_latest_element_set(session: AsyncSession, object_id: int) -> ElementSet | None:
    stmt = (
        select(ElementSet)
        .where(ElementSet.object_id == object_id)
        .order_by(ElementSet.epoch.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()
