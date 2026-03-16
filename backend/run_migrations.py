from pathlib import Path
import sys


CURRENT_DIR = Path(__file__).resolve().parent
sys.path = [
    entry for entry in sys.path
    if Path(entry or ".").resolve() != CURRENT_DIR
]

from alembic import command
from alembic.config import Config


def main() -> None:
    config = Config(str(CURRENT_DIR / "alembic.ini"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    main()
