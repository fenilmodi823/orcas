from datetime import UTC, datetime, timedelta

from app.domain.screening import ScreeningConfig, _MinimaTracker, screen_catalogue


def test_candidate_radius_covers_half_a_step_of_closing_speed() -> None:
    config = ScreeningConfig(reporting_distance_km=5.0, step_s=10.0, max_relative_speed_km_s=16.0)
    assert config.candidate_radius_km == 85.0


def test_tracker_records_each_local_minimum_once() -> None:
    tracker = _MinimaTracker()
    for step, sep in enumerate([9.0, 5.0, 7.0, 3.0, 4.0]):
        tracker.observe(step, {(0, 1): sep})
    tracker.finish(4)
    assert tracker.minima == [(0, 1, 1), (0, 1, 3)]


def test_tracker_treats_leaving_range_as_rising() -> None:
    tracker = _MinimaTracker()
    tracker.observe(0, {(2, 5): 50.0})
    tracker.observe(1, {(2, 5): 20.0})
    tracker.observe(2, {})  # beyond R now
    assert tracker.minima == [(2, 5, 1)]


def test_tracker_keeps_a_minimum_at_the_end_of_the_window() -> None:
    tracker = _MinimaTracker()
    tracker.observe(0, {(0, 1): 8.0})
    tracker.observe(1, {(0, 1): 6.0})
    tracker.finish(1)
    assert tracker.minima == [(0, 1, 1)]


def test_nothing_to_screen() -> None:
    start = datetime(2026, 1, 1, tzinfo=UTC)
    assert screen_catalogue([], start, start + timedelta(hours=1)) == []
