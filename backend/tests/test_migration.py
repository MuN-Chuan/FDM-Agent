from __future__ import annotations

from sqlalchemy import MetaData, String, Table, Column
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.db.migration import build_chat_feedback_table, build_email_login_codes_table


def test_email_login_codes_table_compiles_for_postgresql() -> None:
    metadata = MetaData()
    Table("users", metadata, Column("id", String(36), primary_key=True))
    table = build_email_login_codes_table(metadata)
    sql = str(CreateTable(table).compile(dialect=postgresql.dialect()))

    assert "DATETIME" not in sql
    assert "TIMESTAMP" in sql
    assert "email_login_codes" in sql


def test_chat_feedback_table_compiles_for_postgresql() -> None:
    metadata = MetaData()
    Table("users", metadata, Column("id", String(36), primary_key=True))
    table = build_chat_feedback_table(metadata)
    sql = str(CreateTable(table).compile(dialect=postgresql.dialect()))

    assert "DATETIME" not in sql
    assert "TIMESTAMP" in sql
    assert "chat_feedback" in sql
