from __future__ import annotations

from app.models.diagnosis import DiagnosisResponse, MatchedCase, Modification, ParameterRecommendation


def parse_structured_response(payload: dict[str, object]) -> DiagnosisResponse:
    export_payload = payload.get("export_payload", {})
    export_modifications = []
    if isinstance(export_payload, dict):
        export_modifications = export_payload.get("modifications", [])

    modifications = [Modification(**item) for item in export_modifications if isinstance(item, dict)]
    matched_cases = [MatchedCase(**item) for item in payload.get("matched_cases", []) if isinstance(item, dict)]
    parameter_recommendations = [
        ParameterRecommendation(**item)
        for item in payload.get("parameter_recommendations", [])
        if isinstance(item, dict)
    ]

    return DiagnosisResponse(
        reasoning_markdown=str(payload.get("explanation_markdown", "")),
        modifications=modifications,
        detected_defects=[item for item in payload.get("detected_defects", []) if isinstance(item, dict)],
        matched_cases=matched_cases,
        parameter_recommendations=parameter_recommendations,
    )
