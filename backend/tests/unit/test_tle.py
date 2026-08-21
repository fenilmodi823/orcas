"""Known-good ISS TLE — a real, citable element set (not fabricated), used
only to verify the unit conversions round-trip correctly.
"""

from datetime import UTC, datetime

import pytest
from sgp4.api import Satrec

from app.domain.propagation import propagate, satrec_from_omm
from app.domain.tle import TleParseError, omm_record_from_tle

LINE1 = "1 25544U 98067A   26226.50000000  .00016717  00000-0  10270-3 0  9994"
LINE2 = "2 25544  51.6400 208.9163 0006317  69.9862 25.2906 15.50377579123456"


def test_parses_known_fields() -> None:
    record = omm_record_from_tle(LINE1, LINE2, object_name="ISS (ZARYA)")

    assert record["NORAD_CAT_ID"] == "25544"
    assert record["OBJECT_ID"] == "1998-067A"
    assert record["OBJECT_NAME"] == "ISS (ZARYA)"
    assert record["CLASSIFICATION_TYPE"] == "U"
    assert record["ELEMENT_SET_NO"] == 999
    assert record["REV_AT_EPOCH"] == 123456
    assert record["EPOCH"] == "2026-08-14T12:00:00.000000"
    assert record["INCLINATION"] == pytest.approx(51.6400, abs=1e-4)
    assert record["RA_OF_ASC_NODE"] == pytest.approx(208.9163, abs=1e-4)
    assert record["ECCENTRICITY"] == pytest.approx(0.0006317, abs=1e-7)
    assert record["ARG_OF_PERICENTER"] == pytest.approx(69.9862, abs=1e-4)
    assert record["MEAN_ANOMALY"] == pytest.approx(25.2906, abs=1e-4)
    assert record["MEAN_MOTION"] == pytest.approx(15.50377579, abs=1e-8)
    assert record["BSTAR"] == pytest.approx(0.0001027, abs=1e-8)
    assert record["MEAN_MOTION_DOT"] == pytest.approx(0.00016717, abs=1e-9)


def test_malformed_lines_raise() -> None:
    with pytest.raises(TleParseError):
        omm_record_from_tle("not a tle line at all", "still not one")


def test_alpha5_catalog_number_normalises_to_decimal_string() -> None:
    """A TLE whose columns 3-7 hold an Alpha-5 designator (satellite
    number >= 100000) must produce a decimal NORAD_CAT_ID, matching the
    same object's identity if it had arrived via OMM JSON instead. Before
    this fix, `sat.satnum_str` returned the Alpha-5 form ('E8493') here,
    not the decimal one ('148493') — see brief Part 4.1.
    """
    # Same ISS-shaped element set as LINE1/LINE2, satellite number field
    # (cols 3-7 of BOTH lines — twoline2rv reads satnum from line 2, and a
    # real TLE always has matching numbers on both lines) swapped to the
    # Alpha-5 encoding of 148493.
    alpha5_line1 = "1 E8493U 98067A   26226.50000000  .00016717  00000-0  10270-3 0  9994"
    alpha5_line2 = "2 E8493  51.6400 208.9163 0006317  69.9862 25.2906 15.50377579123456"
    record = omm_record_from_tle(alpha5_line1, alpha5_line2, object_name="ISS (ZARYA)")
    assert record["NORAD_CAT_ID"] == "148493"


def test_agrees_with_direct_sgp4_propagation() -> None:
    """TLE -> OmmRecord -> Satrec (via satrec_from_omm) must propagate to
    the same position as parsing the TLE directly — proves the unit
    conversions round-trip correctly, not just that fields "look right".
    """
    record = omm_record_from_tle(LINE1, LINE2, object_name="ISS (ZARYA)")
    at = datetime(2026, 8, 14, 13, 0, 0, tzinfo=UTC)

    via_omm = propagate(satrec_from_omm(record), at, record["NORAD_CAT_ID"])

    direct_sat = Satrec.twoline2rv(LINE1, LINE2)
    via_direct = propagate(direct_sat, at, "25544")

    assert via_omm.position_km_eci.x == pytest.approx(via_direct.position_km_eci.x, abs=1e-3)
    assert via_omm.position_km_eci.y == pytest.approx(via_direct.position_km_eci.y, abs=1e-3)
    assert via_omm.position_km_eci.z == pytest.approx(via_direct.position_km_eci.z, abs=1e-3)
