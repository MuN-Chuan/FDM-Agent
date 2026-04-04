# backend/app/services/vision_service.py
import json
import re
from typing import Optional, Dict, Any

class VisionService:
    def __init__(self):
        self.provider_id = "openrouter"
        self.model = "bytedance/ui-tars-1.5-7b"
    
    def build_prompt(self, task: str, available_actions: list) -> str:
        actions_str = ", ".join(available_actions)
        return f"""分析此截图。用户目标: {task}

可用动作: {actions_str}

返回 JSON:
{{"type": "action", "action": "<动作>", "x": <x>, "y": <y>, "description": "<描述>"}}"""
    
    def parse_ai_response(self, text: str) -> Optional[Dict[str, Any]]:
        """从 AI 响应中解析结构化指令"""
        patterns = [
            r'```json\s*([\s\S]*?)\s*```',
            r'\{[\s\S]*"type"[\s\S]*"action"[\s\S]*\}',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                try:
                    json_str = match.group(1) if '```' in pattern else match.group(0)
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    continue
        return None
    
    async def analyze_screenshot(
        self,
        screenshot_base64: str,
        task: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """调用 AI 分析截图并返回结构化指令"""
        from app.services.providers import provider_registry
        
        provider = provider_registry.get_provider(self.provider_id)
        if not provider:
            raise ValueError(f"Provider {self.provider_id} not found")
        
        available_actions = context.get("available_actions", ["click", "type", "move_mouse"])
        prompt = self.build_prompt(task, available_actions)
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{screenshot_base64}"}}
                ]
            }
        ]
        
        full_response = ""
        async for chunk in provider.chat_completion(
            messages=messages,
            model=self.model,
            temperature=0.3
        ):
            if isinstance(chunk, str) and chunk.startswith("data: "):
                full_response += chunk.replace("data: ", "")
        
        action = self.parse_ai_response(full_response)
        return action or {"type": "error", "message": "Failed to parse AI response"}