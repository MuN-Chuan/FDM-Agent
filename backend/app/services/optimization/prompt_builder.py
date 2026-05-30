from __future__ import annotations

import json


def build_optimization_prompt(
    *,
    description: str | None,
    detections: list[dict[str, object]],
    matched_cases: list[dict[str, object]],
    printer: dict[str, object],
    process: dict[str, object],
    filament: list[dict[str, object]],
    request_modifications: bool,
) -> str:
    contract = {
        "detected_defects": [],
        "evidence": [],
        "matched_cases": [],
        "root_cause_hypotheses": [],
        "parameter_recommendations": [],
        "non_parameter_actions": [],
        "export_payload": {"modifications": []},
        "explanation_markdown": "",
    }
    return (
        "You are an FDM defect diagnosis and parameter optimization assistant grounded in a curated case library.\n"
        f"User description: {description or ''}\n"
        f"Vision detections: {json.dumps(detections, ensure_ascii=False)}\n"
        f"Matched cases: {json.dumps(matched_cases, ensure_ascii=False)}\n"
        f"Printer settings: {json.dumps(printer, ensure_ascii=False)}\n"
        f"Process settings: {json.dumps(process, ensure_ascii=False)}\n"
        f"Filament settings: {json.dumps(filament, ensure_ascii=False)}\n"
        f"request_modifications={request_modifications}\n"
        "Do not give generic advice like only changing temperature, speed, or flow without evidence.\n"
        f"Return strict JSON matching this structure: {json.dumps(contract, ensure_ascii=False)}"
    )
