from __future__ import annotations

import json
from pathlib import Path


def parse_case_markdown(path: Path) -> tuple[dict[str, object], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError(f"{path.name} is missing frontmatter")

    parts = text.split("---\n", 2)
    if len(parts) < 3:
        raise ValueError(f"{path.name} has malformed frontmatter")

    frontmatter_block = parts[1].strip()
    body = parts[2].strip()
    data: dict[str, object] = {}

    for raw_line in frontmatter_block.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"Invalid frontmatter line in {path.name}: {raw_line}")

        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()

        if value.startswith("{") or value.startswith("["):
            data[key] = json.loads(value)
        elif value.lower() in {"true", "false"}:
            data[key] = value.lower() == "true"
        elif value == "":
            data[key] = ""
        else:
            data[key] = value

    return data, body
