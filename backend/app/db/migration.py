from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, MetaData, String, Table, func, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateIndex


def _has_column(engine: Engine, table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def build_email_login_codes_table(metadata: MetaData) -> Table:
    if "users" not in metadata.tables:
        Table("users", metadata, Column("id", String(36), primary_key=True))

    return Table(
        "email_login_codes",
        metadata,
        Column("id", String(36), primary_key=True),
        Column("email", String(255), nullable=False, index=True),
        Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True),
        Column("code_hash", String(128), nullable=False),
        Column("expires_at", DateTime(timezone=True), nullable=False),
        Column("consumed_at", DateTime(timezone=True), nullable=True),
        Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    )


def run_startup_migrations(engine: Engine) -> None:
    inspector = inspect(engine)

    with engine.begin() as connection:
        if "users" in inspector.get_table_names():
            if not _has_column(engine, "users", "points_balance"):
                connection.execute(text("ALTER TABLE users ADD COLUMN points_balance INTEGER DEFAULT 1000 NOT NULL"))

        if "email_login_codes" not in inspector.get_table_names():
            metadata = MetaData()
            email_login_codes = build_email_login_codes_table(metadata)
            metadata.create_all(bind=connection, tables=[email_login_codes], checkfirst=True)

            for index in email_login_codes.indexes:
                connection.execute(CreateIndex(index, if_not_exists=True))
