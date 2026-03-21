from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.migration import run_startup_migrations
from app.db.session import engine
from app.routers import auth, chat, diagnosis, presets

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend service for analyzing FDM print defects using vision models and LLMs.",
    version=settings.VERSION
)

if settings.AUTO_CREATE_TABLES:
    Base.metadata.create_all(bind=engine)

run_startup_migrations(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(diagnosis.router)
app.include_router(chat.router)
app.include_router(presets.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "FDM AI Diagnosis"}


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
