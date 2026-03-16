from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine_kwargs = {
    "future": True,
    "pool_pre_ping": True,
    "connect_args": connect_args,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
