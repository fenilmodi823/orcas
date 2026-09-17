"""Pure-function tests for source aggregation — no database needed. See the
integration tests in tests/integration/test_snapshot_service.py for the
end-to-end build_snapshot() behavior.
"""

from app.services.snapshot_service import _aggregate_sources


def test_single_source_is_unchanged() -> None:
    assert _aggregate_sources({"celestrak"}) == "celestrak"


def test_multiple_sources_are_sorted_and_joined() -> None:
    assert _aggregate_sources({"spacetrack-gp", "celestrak"}) == "celestrak+spacetrack-gp"


def test_empty_catalogue_defaults_to_celestrak() -> None:
    assert _aggregate_sources(set()) == "celestrak"
