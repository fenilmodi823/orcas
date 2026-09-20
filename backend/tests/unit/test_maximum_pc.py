"""Maximum P_c and the 2D-validity gate.

Every expected number traces to ORCAS Vault RA-12's measured tables - the
2009 geometry (miss 698.0 m pre-event, 834.2 m post-event, HBR 20 m,
v_rel 11.6 km/s) that the golden test also uses.
"""

import math

import pytest

from app.domain.maximum_pc import (
    MAX_ENCOUNTER_DURATION_S,
    MIN_RELATIVE_SPEED_KM_S,
    SOCRATES_ASPECT_RATIO,
    UncertaintySource,
    assess_2d_validity,
    dilution_sigma_km,
    encounter_duration_s,
    maximum_pc,
    screening_cut_km,
)

HBR_KM = 0.020
MISS_PRE_EVENT_KM = 0.698
MISS_POST_EVENT_KM = 0.8342
V_REL_2009_KM_S = 11.6


class TestMaximumPc:
    @pytest.mark.parametrize(
        ("miss_km", "expected"),
        # RA-12 section 3.1: closed form vs exact quadrature, rel. diff 5.6e-8.
        [(MISS_PRE_EVENT_KM, 3.020332e-4), (MISS_POST_EVENT_KM, 2.114585e-4)],
        ids=["pre-event", "post-event"],
    )
    def test_circular_maximum_matches_the_measured_ceiling(
        self, miss_km: float, expected: float
    ) -> None:
        assert maximum_pc(miss_km, HBR_KM, aspect_ratio=1.0).value == pytest.approx(
            expected, rel=1e-5
        )

    def test_maximum_is_linear_in_aspect_ratio(self) -> None:
        """P_max(AR) = AR * P_max(1) while the minor axis stays well clear of
        the hard body - RA-12 section 3.1's linear law.
        """
        circular = maximum_pc(MISS_PRE_EVENT_KM, HBR_KM, aspect_ratio=1.0).value
        at_socrates = maximum_pc(MISS_PRE_EVENT_KM, HBR_KM, aspect_ratio=3.0).value

        assert at_socrates == pytest.approx(3.0 * circular, rel=1e-12)

    def test_socrates_ratio_is_within_measured_tolerance_of_the_true_maximum(self) -> None:
        """RA-12: the closed form sits 0.16 % above the numerically maximised
        value at 3:1 (9.04612e-4). Over-estimating a maximum keeps it a valid
        upper bound, so the closed form is used and the gap is asserted, not
        hidden.
        """
        value = maximum_pc(MISS_PRE_EVENT_KM, HBR_KM, aspect_ratio=3.0).value
        measured_true_max = 9.04612e-4

        assert value >= measured_true_max
        assert (value - measured_true_max) / measured_true_max < 2.0e-3

    def test_default_aspect_ratio_is_socrates(self) -> None:
        assert SOCRATES_ASPECT_RATIO == 3.0
        assert maximum_pc(MISS_PRE_EVENT_KM, HBR_KM).aspect_ratio == 3.0

    def test_2009_pre_event_maximum_exceeds_the_alert_threshold(self) -> None:
        """The project's headline claim: at a 20 m hard body the maximum
        probability for the 2009 miss is above NASA's 1e-4 threshold.
        """
        assert maximum_pc(MISS_PRE_EVENT_KM, HBR_KM).value > 1.0e-4

    def test_close_approach_uses_the_numerical_maximiser(self) -> None:
        """Inside 5*HBR the closed form's HBR << sigma assumption breaks down,
        so the maximum is computed against the exact integral instead.
        """
        result = maximum_pc(miss_distance_km=0.060, hard_body_radius_km=HBR_KM)

        assert result.method == "numerical"
        assert 0.0 < result.value <= 1.0

    def test_numerical_and_closed_form_agree_at_the_switchover(self) -> None:
        """At exactly 5*HBR the closed form is accurate to ~7e-5 relative
        (RA-12 section 3.1's validity table), so the two branches must not
        disagree visibly across the boundary.
        """
        just_above = maximum_pc(0.1001, HBR_KM, aspect_ratio=1.0)
        just_below = maximum_pc(0.0999, HBR_KM, aspect_ratio=1.0)

        assert just_above.method == "closed_form"
        assert just_below.method == "numerical"
        assert just_below.value == pytest.approx(just_above.value, rel=5.0e-3)

    def test_overlapping_hard_bodies_are_a_contact_not_a_probability(self) -> None:
        """d <= HBR means the objects already intersect at TCA. RA12.D12: that
        is a predicted contact, and the caller must say so rather than print a
        probability.
        """
        result = maximum_pc(miss_distance_km=0.010, hard_body_radius_km=HBR_KM)

        assert result.method == "contact"
        assert result.value == 1.0

    @pytest.mark.parametrize("bad", [0.0, -1.0])
    def test_rejects_non_positive_inputs(self, bad: float) -> None:
        with pytest.raises(ValueError):
            maximum_pc(bad, HBR_KM)
        with pytest.raises(ValueError):
            maximum_pc(MISS_PRE_EVENT_KM, bad)


class TestProvenance:
    def test_every_maximum_carries_its_aspect_ratio_and_dilution(self) -> None:
        """RA-12 section 7: a maximum without its family is not a bound."""
        source = maximum_pc(MISS_PRE_EVENT_KM, HBR_KM).source

        assert source.kind == "none"
        assert source.aspect_ratio == 3.0
        assert source.dilution_sigma_km is not None
        assert "3:1" in source.label
        assert "no covariance" in source.label

    def test_a_maximum_without_its_family_cannot_be_constructed(self) -> None:
        with pytest.raises(ValueError, match="aspect_ratio is required"):
            UncertaintySource(kind="none", label="unlabelled maximum")

    def test_a_real_covariance_needs_no_aspect_ratio(self) -> None:
        """kind='cdm' is a genuine probability, not a maximum over a family."""
        source = UncertaintySource(kind="cdm", label="operator CDM")

        assert source.aspect_ratio is None


class TestDilutionAndScreening:
    def test_dilution_sigma_is_the_stated_closed_form(self) -> None:
        """sigma*_geo = d / sqrt(2*AR), and at AR = 1 it is RA-12 section 3.1's
        verification row exactly: 493.6 m for the 2009 pre-event miss.
        """
        assert dilution_sigma_km(MISS_PRE_EVENT_KM, 1.0) * 1000.0 == pytest.approx(493.56, abs=0.01)
        for aspect_ratio in (1.0, 2.0, 3.0, 5.0, 10.0):
            expected = MISS_PRE_EVENT_KM / math.sqrt(2.0 * aspect_ratio)
            assert dilution_sigma_km(MISS_PRE_EVENT_KM, aspect_ratio) == pytest.approx(
                expected, rel=1e-12
            )

    @pytest.mark.parametrize(
        ("aspect_ratio", "tabulated_m"),
        # RA-12 section 3.1's table. Those values were found by numerically
        # maximising the exact integral, so they track the true maximum's
        # saturation with aspect ratio; the closed form does not. The two
        # diverge with AR exactly as section 3.1's saturation note predicts
        # (0.05 % at AR = 1, 0.90 % at AR = 10), which is what this pins.
        [(1.0, 493.8), (2.0, 348.5), (3.0, 284.8), (5.0, 221.4), (10.0, 157.5)],
    )
    def test_dilution_sigma_tracks_the_numerically_maximised_table(
        self, aspect_ratio: float, tabulated_m: float
    ) -> None:
        sigma_m = dilution_sigma_km(MISS_PRE_EVENT_KM, aspect_ratio) * 1000.0

        assert sigma_m == pytest.approx(tabulated_m, rel=1.0e-2)

    @pytest.mark.parametrize(
        ("aspect_ratio", "expected_m"),
        # RA-12 section 3.2: 1,213 m circular, 2,101 m at SOCRATES's 3:1.
        [(1.0, 1213.0), (3.0, 2101.0)],
    )
    def test_screening_cut_matches_the_measured_values(
        self, aspect_ratio: float, expected_m: float
    ) -> None:
        cut_m = screening_cut_km(HBR_KM, aspect_ratio, 1.0e-4) * 1000.0

        assert cut_m == pytest.approx(expected_m, abs=1.0)

    def test_the_cut_is_where_the_maximum_equals_the_threshold(self) -> None:
        """The screening cut and the maximum must be exact inverses, or
        screening would drop encounters the display would then flag.
        """
        threshold = 1.0e-4
        cut = screening_cut_km(HBR_KM, 3.0, threshold)

        assert maximum_pc(cut, HBR_KM, aspect_ratio=3.0).value == pytest.approx(threshold, rel=1e-9)


class TestTwoDValidityGate:
    def test_2009_encounter_passes_comfortably(self) -> None:
        """11.6 km/s, 0.26 s - three orders of magnitude inside the limit."""
        verdict = assess_2d_validity(MISS_PRE_EVENT_KM, V_REL_2009_KM_S)

        assert verdict.is_valid
        assert verdict.encounter_duration_s == pytest.approx(0.26, abs=0.01)
        assert verdict.reason is None

    def test_slow_encounter_is_rejected_on_relative_speed(self) -> None:
        """Below 10 m/s a 2D P_c under-reports by up to 2.53x - the GEO
        drift-by case. The gate must refuse rather than show a number.
        """
        verdict = assess_2d_validity(MISS_PRE_EVENT_KM, 0.005)

        assert not verdict.is_valid
        assert verdict.reason is not None
        assert "relative speed" in verdict.reason

    def test_long_encounter_is_rejected_on_duration(self) -> None:
        """A wide, slow conjunction: fast enough to clear the speed floor, but
        drifting past for too long for straight-line motion to hold.
        """
        # v_rel just over the floor, miss wide enough to exceed 500 s.
        verdict = assess_2d_validity(miss_distance_km=2000.0, relative_speed_km_s=0.011)

        assert not verdict.is_valid
        assert verdict.reason is not None
        assert "encounter lasts" in verdict.reason

    def test_duration_definition_is_orcas_own(self) -> None:
        """3*sqrt(2)*d/v_rel, standing in for CARA's covariance-derived length,
        which has no input here. Named as ORCAS's wherever it appears.
        """
        assert encounter_duration_s(1.0, 1.0) == pytest.approx(3.0 * math.sqrt(2.0))

        verdict = assess_2d_validity(miss_distance_km=2000.0, relative_speed_km_s=0.011)
        assert verdict.reason is not None
        assert "ORCAS's duration definition" in verdict.reason

    def test_speed_criterion_binds_before_duration_for_close_misses(self) -> None:
        """RA-12 section 6: below "about 1.2 km" the speed floor is the binding
        test and the duration test is redundant. The exact crossover is
        3*sqrt(2)*d/v = 500 s at v = 10 m/s, i.e. d = 1178.5 m - so a miss just
        inside it still passes on duration, and one just outside does not.
        """
        crossover_km = MAX_ENCOUNTER_DURATION_S * MIN_RELATIVE_SPEED_KM_S / (3.0 * math.sqrt(2.0))
        assert crossover_km * 1000.0 == pytest.approx(1178.5, abs=0.5)

        assert (
            encounter_duration_s(crossover_km * 0.99, MIN_RELATIVE_SPEED_KM_S)
            < MAX_ENCOUNTER_DURATION_S
        )
        assert (
            encounter_duration_s(crossover_km * 1.01, MIN_RELATIVE_SPEED_KM_S)
            > MAX_ENCOUNTER_DURATION_S
        )
