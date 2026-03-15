from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable


ROOT = Path(__file__).resolve().parent
SOURCE_ROOT = ROOT / "切片软件源码"
PRESET_ROOT = ROOT / "预设文件" / "底层预设"
BACKEND_RESOURCES_ROOT = ROOT / "backend" / "resources"


@dataclass(frozen=True)
class SlicerConfig:
    key: str
    display_name: str
    source_dir: Path

    @property
    def print_config(self) -> Path:
        return self.source_dir / "src" / "libslic3r" / "PrintConfig.cpp"

    @property
    def profiles_dir(self) -> Path:
        return self.source_dir / "resources" / "profiles"


@dataclass
class ParamDef:
    key: str
    option_type: str
    category_label: str | None
    mode: str | None
    printer_technology: str | None
    cli_mode: str | None
    default_raw: str | None


SLICERS = (
    SlicerConfig("bambu", "拓竹", SOURCE_ROOT / "BambuStudio-master"),
    SlicerConfig("creality", "创想三维", SOURCE_ROOT / "CrealityPrint-master"),
    SlicerConfig("orca", "OrcaSlicer", SOURCE_ROOT / "OrcaSlicer-main"),
)

PROCESS = "process"
FILAMENT = "filament"
PRINTER = "printer"

CATEGORY_TO_PROFILE_DIR = {
    PROCESS: "process",
    FILAMENT: "filament",
    PRINTER: "machine",
}

FILAMENT_LABELS = {
    "Filament",
    "Cooling",
    "Temperature",
    "Material",
}
PRINTER_LABELS = {
    "Machine",
    "Printer",
    "Extruder",
    "Extruders",
    "Nozzle",
    "G-code",
    "Bed",
}

EXCLUDED_PREFIXES = (
    "export_",
    "help",
    "info",
    "debug",
    "version",
    "print_host",
    "printhost_",
    "output",
    "autosave",
    "pipe",
    "load_",
    "uptodate",
    "metadata_",
    "cut",
    "arrange",
    "repair",
    "rotate",
    "scale",
    "split",
    "align_",
    "center",
    "duplicate_",
    "clone_",
    "gcodeviewer",
    "single_instance",
    "sw_renderer",
)
EXCLUDED_KEYS = {
    "slice",
    "copy",
    "orient",
    "convert_unit",
    "ensure_on_bed",
    "export_sla",
    "export_3mf",
    "export_slicedata",
    "load_slicedata",
    "export_amf",
    "export_stl",
    "export_stls",
    "export_png",
    "ignore_nonexistent_config",
    "allow_newer_file",
    "camera_view",
}
PROFILE_METADATA_KEYS = {
    "name",
    "from",
    "inherits",
    "description",
    "instantiation",
    "is_custom_defined",
    "family",
    "default_materials",
    "filament_id",
    "vendor",
    "user_id",
    "setting_id",
    "profile_id",
    "compatible_printers",
    "compatible_printers_condition",
}

SPECIAL_CATEGORY_OVERRIDES = {
    "during_print_exhaust_fan_speed": FILAMENT,
    "complete_print_exhaust_fan_speed": FILAMENT,
    "close_fan_the_first_x_layers": FILAMENT,
    "first_x_layer_fan_speed": FILAMENT,
    "filament_retraction_length": FILAMENT,
    "retraction_length": PRINTER,
}

ADD_RE = re.compile(r'this->add(?:_nullable)?\("([^"]+)",\s*([^)]+?)\)')
MODE_RE = re.compile(r"def->mode\s*=\s*(\w+)")
TECH_RE = re.compile(r"def->printer_technology\s*=\s*(\w+)")
CATEGORY_RE = re.compile(r'def->category\s*=\s*(?:L\()?\"([^\"]+)\"\)?')
CLI_RE = re.compile(r"def->cli\s*=\s*ConfigOptionDef::(\w+)")


def find_matching(text: str, start: int, open_char: str, close_char: str) -> int:
    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return index

    raise ValueError(f"Unbalanced {open_char}{close_char} sequence")


def split_top_level(value: str, delimiter: str = ",") -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    round_depth = square_depth = curly_depth = angle_depth = 0
    in_string = False
    escape = False

    for char in value:
        if in_string:
            current.append(char)
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            current.append(char)
            continue

        if char == "(":
            round_depth += 1
        elif char == ")":
            round_depth -= 1
        elif char == "[":
            square_depth += 1
        elif char == "]":
            square_depth -= 1
        elif char == "{":
            curly_depth += 1
        elif char == "}":
            curly_depth -= 1
        elif char == "<":
            angle_depth += 1
        elif char == ">":
            angle_depth -= 1

        if (
            char == delimiter
            and round_depth == 0
            and square_depth == 0
            and curly_depth == 0
            and angle_depth == 0
        ):
            parts.append("".join(current).strip())
            current = []
            continue

        current.append(char)

    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def strip_string_wrappers(value: str) -> str:
    value = value.strip()

    while True:
        if value.startswith('L("') and value.endswith('")'):
            value = value[3:-2]
            continue
        if value.startswith('wxString("') and value.endswith('")'):
            value = value[len('wxString("'):-2]
            continue
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
            continue
        break

    return value


def normalize_scalar(value: str) -> Any:
    value = re.sub(r"\bnew\s+", "", value.strip())
    value = re.sub(r"^\((?:int|float|double|bool)\)\s*", "", value)

    cast_match = re.match(r"^static_cast<[^>]+>\((.*)\)$", value)
    if cast_match:
        return normalize_scalar(cast_match.group(1))

    if value in {"nullptr", "NULL"}:
        return ""
    if value == "true":
        return True
    if value == "false":
        return False

    percent_match = re.match(r"^FloatOrPercent\((.+),\s*(true|false)\)$", value)
    if percent_match:
        base = normalize_scalar(percent_match.group(1))
        base = str(base)
        return f"{base}%" if percent_match.group(2) == "true" else base

    vec_match = re.match(r"^Vec(\d)d\((.*)\)$", value)
    if vec_match:
        parts = split_top_level(vec_match.group(2))
        if len(parts) == int(vec_match.group(1)):
            return [normalize_scalar(part) for part in parts]

    string_value = strip_string_wrappers(value)
    if string_value != value:
        return string_value

    if value.startswith("{") and value.endswith("}"):
        return normalize_payload(value[1:-1].strip())
    if value.startswith("(") and value.endswith(")"):
        return normalize_payload(value[1:-1].strip())

    if value.endswith("f") and re.fullmatch(r"-?\d+(?:\.\d+)?f", value):
        value = value[:-1]

    if re.fullmatch(r"-?\d+(?:\.\d+)?", value):
        return value

    return value


def normalize_payload(value: str) -> Any:
    value = value.strip()
    if not value:
        return ""

    parts = split_top_level(value)
    if len(parts) == 1:
        return normalize_scalar(parts[0])

    normalized = [normalize_scalar(part) for part in parts]
    if len(normalized) == 1:
        return normalized[0]
    return normalized


def extract_default_value(block: str) -> Any:
    marker = "def->set_default_value"
    start = block.find(marker)
    if start == -1:
        return ""

    open_index = block.find("(", start)
    if open_index == -1:
        return ""

    close_index = find_matching(block, open_index, "(", ")")
    payload = block[open_index + 1:close_index].strip()
    payload = re.sub(r"^\s*new\s+", "", payload)

    constructor_start = None
    for index, char in enumerate(payload):
        if char in "({":
            constructor_start = index
            break

    if constructor_start is None:
        return normalize_scalar(payload)

    constructor_payload = payload[constructor_start:]
    if constructor_payload[0] == "(":
        constructor_end = find_matching(constructor_payload, 0, "(", ")")
        return normalize_payload(constructor_payload[1:constructor_end].strip())

    constructor_end = find_matching(constructor_payload, 0, "{", "}")
    return normalize_payload(constructor_payload[1:constructor_end].strip())


def parse_params(print_config_path: Path) -> dict[str, ParamDef]:
    content = print_config_path.read_text(encoding="utf-8")
    matches = list(ADD_RE.finditer(content))
    params: dict[str, ParamDef] = {}

    for index, match in enumerate(matches):
        block_start = match.start()
        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(content)
        block = content[block_start:block_end]

        key = match.group(1)
        params[key] = ParamDef(
            key=key,
            option_type=match.group(2).strip(),
            category_label=(CATEGORY_RE.search(block).group(1).strip() if CATEGORY_RE.search(block) else None),
            mode=(MODE_RE.search(block).group(1) if MODE_RE.search(block) else None),
            printer_technology=(TECH_RE.search(block).group(1) if TECH_RE.search(block) else None),
            cli_mode=(CLI_RE.search(block).group(1) if CLI_RE.search(block) else None),
            default_raw=extract_default_value(block),
        )

    return params


def collect_profile_usage(
    profiles_dir: Path,
) -> tuple[dict[str, Counter], dict[str, dict[str, tuple[int, Any]]]]:
    usage: dict[str, Counter] = defaultdict(Counter)
    samples: dict[str, dict[str, tuple[int, Any]]] = {
        PROCESS: {},
        FILAMENT: {},
        PRINTER: {},
    }

    for brand_dir in profiles_dir.iterdir():
        if not brand_dir.is_dir():
            continue

        for category, profile_dir_name in CATEGORY_TO_PROFILE_DIR.items():
            category_dir = brand_dir / profile_dir_name
            if not category_dir.exists():
                continue

            for path in category_dir.rglob("*.json"):
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except Exception:
                    continue

                if not isinstance(data, dict):
                    continue

                filename = path.name.lower()
                priority = 0 if "common" in filename or "@base" in filename else 1

                for key, value in data.items():
                    usage[key][category] += 1
                    current = samples[category].get(key)
                    if current is None or priority < current[0]:
                        samples[category][key] = (priority, value)

    return usage, samples


def looks_like_preset_key(key: str) -> bool:
    return (
        key.startswith(("filament_", "printer_", "machine_", "bed_", "nozzle_"))
        or key.endswith("_gcode")
        or key in SPECIAL_CATEGORY_OVERRIDES
    )


def should_include_profile_only_key(key: str) -> bool:
    if not re.fullmatch(r"[a-z0-9_]+", key):
        return False
    if key in PROFILE_METADATA_KEYS:
        return False
    if key in EXCLUDED_KEYS or key.startswith(EXCLUDED_PREFIXES):
        return False
    if key.endswith(("_model", "_texture", "_name")):
        return False
    return True


def should_include_param(param: ParamDef, usage_counter: Counter) -> bool:
    if param.printer_technology == "ptSLA":
        return False

    if usage_counter:
        return True

    if param.key in EXCLUDED_KEYS or param.key.startswith(EXCLUDED_PREFIXES):
        return False

    if param.mode == "comDevelop":
        return False

    if param.category_label:
        return True

    return looks_like_preset_key(param.key)


def infer_category(param: ParamDef, usage_counter: Counter) -> str:
    if param.key in SPECIAL_CATEGORY_OVERRIDES:
        return SPECIAL_CATEGORY_OVERRIDES[param.key]

    if usage_counter:
        most_common = usage_counter.most_common()
        if len(most_common) == 1 or most_common[0][1] > most_common[1][1]:
            return most_common[0][0]

    label = (param.category_label or "").strip()
    if label in FILAMENT_LABELS:
        return FILAMENT
    if label in PRINTER_LABELS:
        return PRINTER

    if param.key.startswith("filament_") or "nozzle_temperature" in param.key:
        return FILAMENT
    if (
        param.key.startswith(("printer_", "machine_"))
        or param.key.endswith("_gcode")
        or "extruder" in param.key
    ):
        return PRINTER

    return PROCESS


def merge_union_dicts(dicts: Iterable[dict[str, Any]]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for current in dicts:
        for key, value in current.items():
            existing = merged.get(key, None)
            if key not in merged or existing == "" or existing is None or existing == []:
                merged[key] = value
    return dict(sorted(merged.items()))


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_slicer_base_profiles(config: SlicerConfig) -> dict[str, dict[str, Any]]:
    params = parse_params(config.print_config)
    usage, profile_samples = collect_profile_usage(config.profiles_dir)

    categorized = {
        PROCESS: {},
        FILAMENT: {},
        PRINTER: {},
    }

    for key, param in params.items():
        usage_counter = usage.get(key, Counter())
        if not should_include_param(param, usage_counter):
            continue

        category = infer_category(param, usage_counter)
        categorized[category][key] = param.default_raw

    # Some filament profile keys are override aliases that reuse the same hardcoded
    # default as their base machine/process option (for example
    # filament_retraction_length -> retraction_length).
    for key, usage_counter in usage.items():
        if usage_counter.get(FILAMENT, 0) == 0 or key in categorized[FILAMENT]:
            continue
        if not key.startswith("filament_"):
            continue

        base_key = key[len("filament_"):]
        base_param = params.get(base_key)
        if base_param is None:
            continue

        categorized[FILAMENT][key] = base_param.default_raw

    for category in (PROCESS, FILAMENT, PRINTER):
        for key, (_, sample_value) in profile_samples[category].items():
            if key in categorized[category]:
                continue
            if not should_include_profile_only_key(key):
                continue
            categorized[category][key] = sample_value

    return {category: dict(sorted(values.items())) for category, values in categorized.items()}


def sync_outputs(per_slicer: dict[str, dict[str, dict[str, Any]]]) -> None:
    extracted_root = PRESET_ROOT / "提取的预设"
    other_root = PRESET_ROOT / "other"

    for config in SLICERS:
        slicer_data = per_slicer[config.key]

        for category in (PROCESS, FILAMENT, PRINTER):
            filename = f"{category}_base.json"

            nested_output = extracted_root / config.display_name / category / filename
            flat_output = extracted_root / config.display_name / filename
            backend_output = BACKEND_RESOURCES_ROOT / config.key / "base_profiles" / filename

            write_json(nested_output, slicer_data[category])
            write_json(flat_output, slicer_data[category])
            write_json(backend_output, slicer_data[category])

    union_data = {
        category: merge_union_dicts(per_slicer[config.key][category] for config in SLICERS)
        for category in (PROCESS, FILAMENT, PRINTER)
    }

    for category in (PROCESS, FILAMENT, PRINTER):
        category_dir = other_root / category
        write_json(category_dir / f"{category}_base.json", union_data[category])
        write_json(category_dir / f"{category}_base_all.json", union_data[category])
        write_json(category_dir / f"{category}_all.json", union_data[category])


def main() -> None:
    per_slicer = {config.key: build_slicer_base_profiles(config) for config in SLICERS}
    sync_outputs(per_slicer)

    for config in SLICERS:
        counts = per_slicer[config.key]
        print(
            f"{config.display_name}: "
            f"process={len(counts[PROCESS])}, "
            f"filament={len(counts[FILAMENT])}, "
            f"printer={len(counts[PRINTER])}"
        )

        for category, key in (
            (FILAMENT, "during_print_exhaust_fan_speed"),
            (FILAMENT, "filament_retraction_length"),
            (PRINTER, "retraction_length"),
        ):
            present = key in counts[category]
            print(f"  {category}.{key}: {'OK' if present else 'MISSING'}")


if __name__ == "__main__":
    main()
