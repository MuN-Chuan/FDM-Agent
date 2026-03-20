from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def _has_column(engine: Engine, table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def run_startup_migrations(engine: Engine) -> None:
    inspector = inspect(engine)

    with engine.begin() as connection:
        if "users" in inspector.get_table_names():
            if not _has_column(engine, "users", "points_balance"):
                connection.execute(text("ALTER TABLE users ADD COLUMN points_balance INTEGER DEFAULT 1000 NOT NULL"))

        if "email_login_codes" not in inspector.get_table_names():
            connection.execute(
                text(
                    """
                    CREATE TABLE email_login_codes (
                        id VARCHAR(36) PRIMARY KEY,
                        email VARCHAR(255) NOT NULL,
                        user_id VARCHAR(36) NULL,
                        code_hash VARCHAR(128) NOT NULL,
                        expires_at DATETIME NOT NULL,
                        consumed_at DATETIME NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
                    )
                    """
                )
            )
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_email_login_codes_email ON email_login_codes (email)"))
