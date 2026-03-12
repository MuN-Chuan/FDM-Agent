from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import diagnosis

app = FastAPI(
    title="FDM AI Diagnosis API",
    description="Backend service for analyzing FDM print defects using vision models and LLMs.",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(diagnosis.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "FDM AI Diagnosis"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
