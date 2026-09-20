"""ORCAS's P_c against NASA CARA's published Pc2D_Foster expectations.

This is the project's central validation claim (RA-10, RA10.D2): the backend
evaluates the P_c integral exactly by 2D quadrature and reproduces CARA's
reference on all twelve published cases, worst relative difference
1.115e-4 against CARA's own RelTol of 1e-3.

Provenance and terms. The fixture holds numeric test-case data only - no NASA
software is reproduced. Expected values are CARA's unit-test expectations
(nasa/CARA_Analysis_Tools: DistributedMatlab/ProbabilityOfCollision/UnitTests/
Pc2D_Foster_UnitTest.m and Utils/get_alfano_test_case.m); the Alfano states,
covariances and Monte Carlo truth are from S. Alfano, "Satellite Conjunction
Monte Carlo Analysis", AAS 09-233 (2009). CARA is released under the NASA Open
Source Agreement, whose obligations attach to distributing the Subject
Software itself; transcribing reference values with citation is not that, and
reproducing them is not an endorsement of ORCAS by NASA.

Units: every quantity in a case shares one unit (km for Omitron, m for
Alfano). P_c is scale-invariant under a consistent change of length unit, so
the domain functions' _km suffixes are read as "the case's length unit" here.
That is exactly how CARA's own harness runs these two sets.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from app.domain.conjunction import (
    b_plane_projection,
    mahalanobis_distance,
    probability_of_collision,
    project_to_b_plane,
)
from app.domain.types import Vec3

#: CARA's own unit tests use this relative tolerance.
CARA_REL_TOL = 1.0e-3

_FIXTURE = Path(__file__).parent.parent / "fixtures" / "cara_pc2d_cases.json"
CASES: list[dict[str, Any]] = json.loads(_FIXTURE.read_text(encoding="utf-8"))["cases"]


def _pc(case: dict[str, Any]) -> float:
    """Compose ORCAS's domain functions exactly as a caller would."""
    primary, secondary = case["primary"], case["secondary"]
    miss = np.array(primary["position"], float) - np.array(secondary["position"], float)
    rel_v = np.array(primary["velocity"], float) - np.array(secondary["velocity"], float)

    projection = b_plane_projection(Vec3(*rel_v))
    combined = (
        np.array(primary["covariance"], float)[:3, :3]
        + np.array(secondary["covariance"], float)[:3, :3]
    )
    c_b = project_to_b_plane(combined, projection)
    return probability_of_collision(projection @ miss, c_b, case["hbr"])


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_pc_matches_nasa_cara_reference(case: dict[str, Any]) -> None:
    """Twelve of twelve inside CARA's tolerance. A regression here means
    ORCAS's P_c has drifted away from NASA's answer - the single claim the
    whole conjunction path rests on.
    """
    expected = case["expected_pc"]
    assert _pc(case) == pytest.approx(expected, rel=CARA_REL_TOL)


def test_every_published_case_is_covered() -> None:
    """Guards the fixture itself: the Omitron case plus Alfano 1-11. Case 12
    (identical orbits) has no Foster expectation in CARA's test and is
    deliberately absent.
    """
    assert len(CASES) == 12
    assert {c["name"] for c in CASES} == {"omitron-01"} | {f"alfano-{n:02d}" for n in range(1, 12)}


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_mahalanobis_distance_is_finite_and_positive(case: dict[str, Any]) -> None:
    """D_M is the separation in sigma that every alert verdict reads. It must
    be well-defined wherever P_c is.
    """
    primary, secondary = case["primary"], case["secondary"]
    miss = np.array(primary["position"], float) - np.array(secondary["position"], float)
    rel_v = np.array(primary["velocity"], float) - np.array(secondary["velocity"], float)
    projection = b_plane_projection(Vec3(*rel_v))
    combined = (
        np.array(primary["covariance"], float)[:3, :3]
        + np.array(secondary["covariance"], float)[:3, :3]
    )
    d_m = mahalanobis_distance(projection @ miss, project_to_b_plane(combined, projection))

    assert np.isfinite(d_m)
    assert d_m > 0.0
