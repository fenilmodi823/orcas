"""Loads the trained Random Forest object-type classifier. The only place in
the backend that touches scikit-learn or the .joblib file directly — see
Rules.md "Layering is absolute": domain/ never imports this module.
"""

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib

from app.domain.classification import CLASSIFIER_FEATURE_ORDER, ObjectFeatures
from app.settings import settings


class ClassifierLoadError(Exception):
    """The .joblib model file is missing, unreadable, or has an unexpected shape."""


@dataclass(frozen=True)
class ClassificationResult:
    predicted_class: str
    class_probabilities: dict[str, float]


class ObjectClassifier:
    def __init__(self, model: Any, classes: list[str]) -> None:
        self._model = model
        self._classes = classes

    @property
    def classes(self) -> list[str]:
        return list(self._classes)

    def classify(self, features: ObjectFeatures) -> ClassificationResult:
        probabilities = self._model.predict_proba([features.as_vector()])[0]
        predicted_index = int(probabilities.argmax())
        return ClassificationResult(
            predicted_class=self._classes[predicted_index],
            class_probabilities=dict(
                zip(self._classes, (float(p) for p in probabilities), strict=True)
            ),
        )


def _load_bundle(path: Path) -> ObjectClassifier:
    if not path.exists():
        raise ClassifierLoadError(f"classifier model not found at {path}")
    # joblib.load runs a pickle — safe here: path is our own committed
    # ml_models/ artifact, never user-supplied or fetched over the network.
    bundle = joblib.load(path)
    trained_features = tuple(bundle["features"])
    if trained_features != CLASSIFIER_FEATURE_ORDER:
        raise ClassifierLoadError(
            f"model was trained on features {trained_features}, "
            f"code expects {CLASSIFIER_FEATURE_ORDER} — see domain/classification.py"
        )
    return ObjectClassifier(bundle["model"], list(bundle["classes_"]))


@lru_cache
def get_classifier() -> ObjectClassifier:
    return _load_bundle(Path(settings.ml_model_path))
