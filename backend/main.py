from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import DiagnosisRequest, DiagnosisResponse, Modification
import time

app = FastAPI(title="FDM AI Diagnosis API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the exact origin
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/diagnose", response_model=DiagnosisResponse)
async def diagnose(request: DiagnosisRequest):
    # Simulate processing time
    time.sleep(1.5)
    
    # Mock logic based on input
    reasoning = "### AI 诊断报告\n\n"
    modifications = []
    
    if request.detections:
        reasoning += "#### 缺陷分析\n"
        for det in request.detections:
            reasoning += f"- 检测到 **{det.label}** (置信度: {det.confidence:.1%})\n"
        
        reasoning += "\n#### 优化建议\n基于检测到的缺陷，我们建议针对您提供的预设进行以下调整：\n"
        
        # Mock some conditional modifications
        if any(d.label == 'stringing' for d in request.detections):
            modifications.append(Modification(
                name="retraction_distance",
                old="0.8mm",
                new="1.2mm",
                range="0.4-2.0mm",
                reason="增加回抽距离以减少拉丝（Stringing）。",
                risk="low"
            ))
            modifications.append(Modification(
                name="outer_wall_speed",
                old="200mm/s",
                new="150mm/s",
                range="50-300mm/s",
                reason="降低外墙速度可改善由于过热导致的拉丝。 ",
                risk="low"
            ))
    
    if request.description:
        reasoning += f"\n#### 用户描述补充\n您提到的“{request.description}”已纳入考虑。AI 将在生成最终 G-code 调整建议时优先参考该信息。\n"

    if not modifications:
        modifications.append(Modification(
            name="generic_optimization",
            old="N/A",
            new="Optimized",
            range="N/A",
            reason="常规打印质量优化。",
            risk="low"
        ))

    return DiagnosisResponse(
        reasoning_markdown=reasoning,
        modifications=modifications
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
