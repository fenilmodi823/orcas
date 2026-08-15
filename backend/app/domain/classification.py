"""Feature engineering for the object-type classifier. Pure — no I/O, no
scikit-learn import. The trained model lives in infra/ml/classifier.py; this
module only defines the deterministic OMM -> feature-vector mapping.
"""

from dataclasses import dataclass

from app.domain.types import OmmRecord

#: Must match ml_models/object_classifier.joblib's stored 'features' list
#: exactly, in order — verified against the actual file, not assumed from
#: the paper (whose Table I lists different features: velocity/altitude
#: instead of mean-motion/bstar). Changing this order without retraining the
#: model silently produces wrong predictions.
CLASSIFIER_FEATURE_ORDER = ("inc_deg", "ecc", "mm_rev_day", "bstar")


@dataclass(frozen=True)
class ObjectFeatures:
    inc_deg: float
    ecc: float
    mm_rev_day: float
    bstar: float

    def as_vector(self) -> list[float]:
        return [self.inc_deg, self.ecc, self.mm_rev_day, self.bstar]


def features_from_omm(record: OmmRecord) -> ObjectFeatures:
    """Map a canonical OMM record onto the classifier's exact feature set."""
    return ObjectFeatures(
        inc_deg=float(record["INCLINATION"]),
        ecc=float(record["ECCENTRICITY"]),
        mm_rev_day=float(record["MEAN_MOTION"]),
        bstar=float(record["BSTAR"]),
    )
