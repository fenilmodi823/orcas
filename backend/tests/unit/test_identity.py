"""Cross-stack catalog-identity contract. ORCAS Vault Phase-4 Engineering
Brief, Part 4.1/4.2, milestone M0.1.

python-sgp4 decodes Alpha-5 catalog numbers to an int; satellite.js's
twoline2satrec keeps the raw 5 characters instead. Above catalog number
99999 the two libraries disagree about what a NORAD ID even is. ORCAS
avoids the problem entirely by never deriving identity from a
Satrec/SatRec: identity is always the OmmRecord['NORAD_CAT_ID'] string,
verbatim, from ingestion through to render. This module is the regression
guard for that rule, plus the two known library defects it depends on
being aware of (the 339999 ceiling — Issue #17 — and the Alpha-5 emit
bug in the C++ backend for 180000-189999/230000-239999).
"""

import pytest
from sgp4.alpha5 import to_alpha5

from app.domain.propagation import satrec_from_omm
from app.domain.types import OmmRecord

_BASE: OmmRecord = {
    "OBJECT_NAME": "ORCAS-TEST-SAT",
    "OBJECT_ID": "1998-999Z",
    "EPOCH": "2026-01-01T00:00:00.000000",
    "MEAN_MOTION": 15.5,
    "ECCENTRICITY": 0.0001,
    "INCLINATION": 51.6,
    "RA_OF_ASC_NODE": 0,
    "ARG_OF_PERICENTER": 0,
    "MEAN_ANOMALY": 0,
    "EPHEMERIS_TYPE": 0,
    "CLASSIFICATION_TYPE": "U",
    "NORAD_CAT_ID": "90001",
    "ELEMENT_SET_NO": 999,
    "REV_AT_EPOCH": 1,
    "BSTAR": 0,
    "MEAN_MOTION_DOT": 0,
    "MEAN_MOTION_DDOT": 0,
}


@pytest.mark.parametrize("norad_id", ["25544", "148493", "339999"])
def test_identity_round_trips_verbatim_for_in_range_ids(norad_id: str) -> None:
    """Below the 339999 ceiling a Satrec can be built, but identity never
    comes from it — the caller already had norad_id before calling
    satrec_from_omm(). This just proves construction doesn't raise and
    the input string is never touched.
    """
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": norad_id}
    satrec_from_omm(record)  # must not raise for an in-range id
    assert record["NORAD_CAT_ID"] == norad_id


def test_nine_digit_id_has_no_satrec_but_keeps_its_identity() -> None:
    """Issue #17 (closed as disproven, M0.4): the 339999 ceiling is a
    5-character TLE-field storage limit enforced by every Satrec
    constructor path, not a parsing bug — there is no integer side door.
    A 9-digit catalog id's *identity* (the OMM string) is unaffected; only
    building a Satrec for it is blocked today.
    """
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": "799500000"}
    with pytest.raises(ValueError, match="cannot exceed 339999"):
        satrec_from_omm(record)
    assert record["NORAD_CAT_ID"] == "799500000"


@pytest.mark.xfail(
    reason=(
        "python-sgp4 2.27's C++ backend emits the spec-forbidden Alpha-5 "
        "letters I/O for satnum 180000-189999 and 230000-239999 instead of "
        "J/P, disagreeing with its own pure-Python sgp4.alpha5.to_alpha5(). "
        "See brief Part 4.1 'Bonus finding'; not yet confirmed upstream."
    ),
    strict=True,
)
@pytest.mark.parametrize("satnum", [180000, 189999, 230000, 239999])
def test_satnum_str_agrees_with_the_spec_correct_alpha5_encoder(satnum: int) -> None:
    record: OmmRecord = {**_BASE, "NORAD_CAT_ID": str(satnum)}
    satrec = satrec_from_omm(record)
    assert satrec.satnum_str[0] == to_alpha5(satnum)[0]
