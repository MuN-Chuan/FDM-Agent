"""
Tests for threemf_service.py — 3MF Parse / Modify / Repack

Uses the real test.3mf file from the project test directory.
"""
import json
import zipfile
import io
from pathlib import Path

import pytest

from app.services import threemf_service

# Path to the real test 3MF file
TEST_3MF = Path(__file__).parent.parent.parent.parent / "test" / "test.3mf"


@pytest.fixture
def test_3mf_bytes() -> bytes:
    assert TEST_3MF.exists(), f"Test 3MF not found at {TEST_3MF}"
    return TEST_3MF.read_bytes()


# ─── parse_3mf ───────────────────────────────────────────────────

def test_parse_3mf_returns_dict(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    assert isinstance(settings, dict)
    assert len(settings) > 50, "Expected many preset keys"


def test_parse_3mf_has_identity_fields(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    assert "printer_settings_id" in settings
    assert "print_settings_id" in settings
    assert "layer_height" in settings
    assert "nozzle_temperature" in settings


def test_parse_3mf_invalid_bytes_raises():
    with pytest.raises(ValueError, match="valid ZIP"):
        threemf_service.parse_3mf(b"not a zip file")


def test_parse_3mf_zip_without_config_raises():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("some_other.txt", "hello")
    with pytest.raises(ValueError, match="project_settings.config"):
        threemf_service.parse_3mf(buf.getvalue())


# ─── extract_summary ─────────────────────────────────────────────

def test_extract_summary_returns_subset(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    summary = threemf_service.extract_summary(settings)
    assert "layer_height" in summary
    assert "printer_model" in summary
    # Summary should be much smaller than full settings
    assert len(summary) < len(settings)


def test_extract_summary_array_values_unwrapped(test_3mf_bytes):
    """Single-element arrays should be unwrapped to scalars in summary."""
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    summary = threemf_service.extract_summary(settings)
    # nozzle_temperature is stored as ["220"] — should appear as "220"
    if "nozzle_temperature" in summary:
        assert not isinstance(summary["nozzle_temperature"], list)


# ─── apply_modifications ─────────────────────────────────────────

def test_apply_modifications_scalar_key(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    mods = [{"name": "layer_height", "old": "0.2", "new": "0.16", "category": "process"}]
    result = threemf_service.apply_modifications(settings, mods)
    assert result["layer_height"] == "0.16"
    assert "layer_height" in result["_ai_modifications_applied"]


def test_apply_modifications_array_key(test_3mf_bytes):
    """Array-type parameters should have their first element updated."""
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    original_temp = settings.get("nozzle_temperature", ["220"])
    assert isinstance(original_temp, list)

    mods = [{"name": "nozzle_temperature", "old": original_temp[0], "new": "230", "category": "filament"}]
    result = threemf_service.apply_modifications(settings, mods)
    assert result["nozzle_temperature"][0] == "230"


def test_apply_modifications_unknown_key_skipped(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    mods = [{"name": "nonexistent_parameter_xyz", "old": "1", "new": "2"}]
    result = threemf_service.apply_modifications(settings, mods)
    assert "nonexistent_parameter_xyz" not in result["_ai_modifications_applied"]
    assert "nonexistent_parameter_xyz" in result["_ai_modifications_skipped"]


def test_apply_modifications_does_not_mutate_original(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    original_layer = settings["layer_height"]
    mods = [{"name": "layer_height", "old": original_layer, "new": "0.08"}]
    threemf_service.apply_modifications(settings, mods)
    assert settings["layer_height"] == original_layer, "Original dict must not be mutated"


# ─── repack_3mf ──────────────────────────────────────────────────

def test_repack_3mf_produces_valid_zip(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    mods = [{"name": "layer_height", "old": "0.2", "new": "0.16"}]
    modified = threemf_service.apply_modifications(settings, mods)
    repacked = threemf_service.repack_3mf(test_3mf_bytes, modified)

    assert zipfile.is_zipfile(io.BytesIO(repacked)), "Repacked bytes should be a valid ZIP"


def test_repack_3mf_modification_persists(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    mods = [{"name": "layer_height", "old": "0.2", "new": "0.16"}]
    modified = threemf_service.apply_modifications(settings, mods)
    repacked = threemf_service.repack_3mf(test_3mf_bytes, modified)

    # Parse the repacked 3MF and verify the modification was written
    reparsed = threemf_service.parse_3mf(repacked)
    assert reparsed["layer_height"] == "0.16"


def test_repack_3mf_strips_internal_markers(test_3mf_bytes):
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    mods = [{"name": "layer_height", "old": "0.2", "new": "0.16"}]
    modified = threemf_service.apply_modifications(settings, mods)
    repacked = threemf_service.repack_3mf(test_3mf_bytes, modified)

    reparsed = threemf_service.parse_3mf(repacked)
    assert "_ai_modifications_applied" not in reparsed
    assert "_ai_modifications_skipped" not in reparsed


def test_repack_3mf_preserves_other_files(test_3mf_bytes):
    """Non-preset files (model geometry, thumbnails) must be preserved."""
    settings = threemf_service.parse_3mf(test_3mf_bytes)
    repacked = threemf_service.repack_3mf(test_3mf_bytes, settings)

    original_names = set(zipfile.ZipFile(io.BytesIO(test_3mf_bytes)).namelist())
    repacked_names = set(zipfile.ZipFile(io.BytesIO(repacked)).namelist())
    assert original_names == repacked_names


# ─── get_3mf_object_info ─────────────────────────────────────────

def test_get_3mf_object_info(test_3mf_bytes):
    info = threemf_service.get_3mf_object_info(test_3mf_bytes)
    assert "objects" in info
    assert "plates" in info
    # The test 3MF has one object ("小船")
    assert len(info["objects"]) >= 1
    assert any("小船" in obj.get("name", "") for obj in info["objects"])
