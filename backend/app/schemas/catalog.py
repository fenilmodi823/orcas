"""Pydantic response models for /api/v1/catalog. HTTP-facing shapes only."""

from datetime import datetime

from pydantic import BaseModel


class CatalogMeta(BaseModel):
    object_count: int
    newest_epoch: datetime | None
    source: str
    generated_at: datetime
