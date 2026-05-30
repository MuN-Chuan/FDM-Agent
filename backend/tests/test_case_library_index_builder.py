from pathlib import Path

from app.services.case_library.index_builder import build_case_index


def test_build_case_index_reads_markdown_cases(tmp_path: Path) -> None:
    case_dir = tmp_path / "case-001"
    document_dir = case_dir / "docs"
    media_dir = case_dir / "media"
    runtime_dir = case_dir / "runtime"
    document_dir.mkdir(parents=True)
    media_dir.mkdir()
    runtime_dir.mkdir()
    (media_dir / "cover.jpg").write_bytes(b"jpg")
    (document_dir / "case.md").write_text(
        "---\n"
        "case_id: case-001\n"
        "slug: case-001\n"
        "title: First layer under extrusion\n"
        "defect_category: first_layer\n"
        "tags: [\"adhesion\", \"flow\"]\n"
        "cover_image: cover.jpg\n"
        "printer_model: Bambu Lab A1\n"
        "filament_material: PLA\n"
        "symptom_parameters: {\"first_layer_speed\": 60}\n"
        "solution_parameters: {\"first_layer_speed\": 25}\n"
        "root_cause_analysis: nozzle too high\n"
        "solution_summary: reduce first layer speed\n"
        "source_url: https://example.com/post/1\n"
        "source_platform: forum\n"
        "source_author: maker\n"
        "source_question: why is the first layer thin\n"
        "source_answer: slow down first layer\n"
        "license_note: internal summary with source link\n"
        "collected_by: codex\n"
        "review_status: reviewed\n"
        "---\n"
        "\n"
        "Detailed notes.\n",
        encoding="utf-8",
    )

    index = build_case_index(tmp_path, tmp_path / "case-index.json")

    assert index["cases"][0]["case_id"] == "case-001"
    assert index["cases"][0]["parameter_delta"]["first_layer_speed"] == {"old": 60, "new": 25}
    assert (runtime_dir / "case.json").exists()
