from app.services.optimization.prompt_builder import build_optimization_prompt


def test_prompt_builder_includes_matched_cases_and_parameter_context() -> None:
    prompt = build_optimization_prompt(
        description="PETG stringing",
        detections=[{"label": "stringing", "confidence": 0.98}],
        matched_cases=[{"case_id": "case-002", "title": "PETG Stringing", "solution_summary": "Drop nozzle temp and dry filament"}],
        printer={"nozzle_temperature": 255},
        process={"retraction_length": 0.8},
        filament=[{"filament_type": "PETG"}],
        request_modifications=True,
    )

    assert "case-002" in prompt
    assert "retraction_length" in prompt
    assert "detected_defects" in prompt
