"""Orchestrates object-type classification: OMM -> features (domain) ->
prediction (infra). No physics or SQL of its own — see Rules.md layering.
"""

from app.domain.classification import features_from_omm
from app.domain.types import OmmRecord
from app.infra.ml.classifier import ClassificationResult, get_classifier


def classify_object(record: OmmRecord) -> ClassificationResult:
    features = features_from_omm(record)
    return get_classifier().classify(features)
