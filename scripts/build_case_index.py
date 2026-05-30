from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.case_library.index_builder import build_case_index  # noqa: E402


if __name__ == "__main__":
    build_case_index(
        ROOT / "cases",
        ROOT / "cases" / "case-index.json",
    )
