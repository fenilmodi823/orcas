"""The screener must rediscover the 2009 Iridium 33 / Cosmos 2251 encounter.

Same data and same claim as test_2009_reconstruction.py's pre-event case, but
reached the way a catalogue screener reaches it: no pair is named, no time is
given beyond a two-hour window. If broad-phase screening loses this encounter,
or refines it to a different TCA or miss, it is not fit to screen anything.
"""

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sgp4.api import Satrec
from sgp4.conveniences import sat_epoch_datetime

from app.domain.propagation import satrec_from_omm
from app.domain.screening import ScreeningConfig, screen_catalogue
from app.domain.tle import omm_record_from_tle
from app.settings import settings

FIXTURE = Path(settings.data_sample_dir) / "iridium33_cosmos2251_2009_spacetrack.tle"
T0 = datetime(2009, 2, 10, 16, 56, 0, tzinfo=UTC)
#: SOCRATES's predicted-TCA window (T.S. Kelso, AAS 09-368).
SOCRATES_TCA_WINDOW = (
    datetime(2009, 2, 10, 16, 55, 59, 670000, tzinfo=UTC),
    datetime(2009, 2, 10, 16, 55, 59, 990000, tzinfo=UTC),
)


def _latest_pre_event(name: str) -> Satrec:
    lines = [line for line in FIXTURE.read_text().splitlines() if line.strip()]
    candidates = []
    for i in range(0, len(lines), 3):
        if lines[i] != name:
            continue
        sat = satrec_from_omm(omm_record_from_tle(lines[i + 1], lines[i + 2], object_name=name))
        if sat_epoch_datetime(sat) < T0:
            candidates.append(sat)
    return max(candidates, key=sat_epoch_datetime)


@pytest.mark.parametrize("step_s", [10.0, 60.0], ids=["10s-step", "60s-step"])
def test_screening_rediscovers_the_2009_collision(step_s: float) -> None:
    sats = [_latest_pre_event("IRIDIUM 33"), _latest_pre_event("COSMOS 2251")]
    found = screen_catalogue(
        sats, T0 - timedelta(hours=1), T0 + timedelta(hours=1), ScreeningConfig(step_s=step_s)
    )

    assert len(found) == 1
    encounter = found[0]
    assert (encounter.primary, encounter.secondary) == (0, 1)
    assert SOCRATES_TCA_WINDOW[0] <= encounter.tca <= SOCRATES_TCA_WINDOW[1]
    # ORCAS's locked number for the pre-event geometry (test_2009_reconstruction.py).
    assert encounter.miss_distance_km * 1000 == pytest.approx(698.0, abs=0.5)
    assert encounter.relative_speed_km_s == pytest.approx(11.647, abs=0.01)
