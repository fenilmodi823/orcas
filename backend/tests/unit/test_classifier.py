"""app.infra.ml.classifier — loads the real, committed
ml_models/object_classifier.joblib and exercises it for real. This is the
only place that model's actual shape (features, classes) is verified against
what the code assumes, since the paper's own description of the model
(Table I: velocity/eccentricity/altitude/inclination) doesn't match the
features actually stored in the file. See memory.md item 18.
"""

import joblib
import pytest

from app.domain.classification import ObjectFeatures
from app.infra.ml.classifier import ClassifierLoadError, _load_bundle, get_classifier


def test_real_model_loads_with_expected_features_and_classes() -> None:
    classifier = get_classifier()
    assert set(classifier.classes) == {"Debris", "Payload", "Rocket Body"}


def test_real_model_classifies_a_synthetic_feature_vector() -> None:
    # Plausible LEO-payload-shaped values, not a claim about any real object.
    features = ObjectFeatures(inc_deg=86.4, ecc=0.0011, mm_rev_day=14.34, bstar=0.0001)
    result = get_classifier().classify(features)

    assert result.predicted_class in {"Debris", "Payload", "Rocket Body"}
    assert set(result.class_probabilities) == {"Debris", "Payload", "Rocket Body"}
    assert sum(result.class_probabilities.values()) == pytest.approx(1.0, abs=1e-6)
    assert result.class_probabilities[result.predicted_class] == max(
        result.class_probabilities.values()
    )


def test_load_bundle_rejects_missing_file(tmp_path) -> None:
    with pytest.raises(ClassifierLoadError, match="not found"):
        _load_bundle(tmp_path / "does-not-exist.joblib")


def test_load_bundle_rejects_feature_mismatch(tmp_path) -> None:
    bad_path = tmp_path / "bad_model.joblib"
    joblib.dump({"model": None, "features": ["wrong", "order"], "classes_": ["A", "B"]}, bad_path)
    with pytest.raises(ClassifierLoadError, match="features"):
        _load_bundle(bad_path)
