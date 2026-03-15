import json
from typing import List, Optional
from openai import AsyncOpenAI, OpenAIError, RateLimitError, AuthenticationError
from app.models.diagnosis import Detection, PresetData, Modification, DiagnosisResponse, ApiSettings
from app.core.config import settings
from app.services.preset_inheritance_service import preset_inheritance_service

class DiagnosisService:
    def __init__(self):
        # We no longer hardcode the client here; we instantiate it dynamically per-request
        pass

    def _filter_preset_dict(self, data: dict) -> dict:
        """Remove G-code scripts and thumbnails only — keep all other slicing parameters intact."""
        filtered = {}
        for k, v in data.items():
            k_lower = k.lower()
            if "gcode" in k_lower or "thumbnail" in k_lower:
                continue
            if isinstance(v, dict):
                filtered[k] = self._filter_preset_dict(v)
            elif isinstance(v, list):
                if len(v) < 100:  # allow larger arrays for speed/temp tables
                    filtered[k] = v
            else:
                filtered[k] = v
        return filtered
    def _build_prompt(self, detections: List[Detection], description: Optional[str], preset_data: PresetData) -> str:
        prompt = "你是一个专业的 FDM (熔融沉积成型) 3D打印机调参专家。请分析以下打印状况，并提供切片参数的修改建议。\n\n"
        
        if detections:
            prompt += "【AI视觉诊断结果】:\n"
            for d in detections:
                prompt += f"- 缺陷类型: {d.label} (置信度: {d.confidence:.2f})\n"
            prompt += "\n"
        else:
            prompt += "【注意】: 当前未提供视觉识别结果，请完全基于用户的文字描述和提供的切片参数进行分析诊断。\n\n"
            
        if description:
            prompt += f"【用户描述补充】:\n{description}\n\n"
            
        prompt += "【当前打印预设参数】:\n"
        prompt += "以下是用户完整的切片参数（已去除G-code脚本，保留所有切片数值参数），请结合全部参数综合诊断分析：\n"
        
        printer_data = self._filter_preset_dict(preset_data.printer)
        prompt += "--- 机器参数 (Printer) ---\n"
        prompt += f"{json.dumps(printer_data, ensure_ascii=False)}\n\n"
        
        process_data = self._filter_preset_dict(preset_data.process)
        prompt += "--- 工艺参数 (Process) ---\n"
        prompt += f"{json.dumps(process_data, ensure_ascii=False)}\n\n"
        
        for i, filament in enumerate(preset_data.filament):
            filament_data = self._filter_preset_dict(filament)
            prompt += f"--- 材料参数 (Filament {i+1}) ---\n"
            prompt += f"{json.dumps(filament_data, ensure_ascii=False)}\n\n"

        
        prompt += """
【输出要求】:
必须严格输出合法的 JSON 格式。包含两部分：
1. "reasoning_markdown": 字符串，使用 Markdown 格式详细写出你的推理和分析过程。
2. "modifications": 数组，列出建议修改的具体参数。每个项包含：
   - "name": 参数在预设中的英文键名 (例如 'layer_height')
   - "category": 参数所属分类，必须是 "process"、"filament" 或 "printer" 之一
   - "old": 原始值 (基于你推断或默认常识，如果预设中没给全)
   - "new": 建议的新值
   - "range": 该参数的安全或推荐物理范围 (例如 '0.4-2.0mm')
   - "reason": 简单的中文修改理由
   - "risk": 风险程度 ("low", "medium", "high")

【JSON结构示例】:
{
  "reasoning_markdown": "### 分析报告\\n根据拉丝缺陷...",
  "modifications": [
    {"name": "layer_height", "category": "process", "old": "0.2", "new": "0.16", "range": "0.08-0.32mm", "reason": "减小层纹并提升细节表现", "risk": "low"}
  ]
}
"""
        return prompt

    async def analyze_stream(
        self, 
        detections: List[Detection], 
        safety_constraints: Optional[str], 
        preset_data: PresetData,
        api_settings: Optional[ApiSettings] = None
    ):
        """Streaming version of diagnosis that yields chunks of text and final JSON results."""
        # NEW: Expand presets with base profiles if they are incomplete diffs
        if preset_data:
            if preset_data.printer:
                preset_data.printer = preset_inheritance_service.get_full_preset(preset_data.printer, "printer")
            if preset_data.process:
                preset_data.process = preset_inheritance_service.get_full_preset(preset_data.process, "process")
            new_filaments = []
            for fil in preset_data.filament:
                new_filaments.append(preset_inheritance_service.get_full_preset(fil, "filament"))
            preset_data.filament = new_filaments

        user_prompt = self._build_prompt(detections, description, preset_data)
        if safety_constraints:
            user_prompt += f"\n【重要安全约束】:\n{safety_constraints}\n绝对不能输出违反此约束的参数建议！\n"

        print(f"--- STREAM DIAGNOSIS START ---")
        print(f"Model: {api_settings.model_name if api_settings else settings.LLM_MODEL_NAME}")
        print(f"Prompt Length: {len(user_prompt)} characters")

        api_key = (api_settings.api_key if api_settings and api_settings.api_key.strip() 
                  else settings.LLM_API_KEY)
        base_url = (api_settings.base_url if api_settings and api_settings.base_url.strip() 
                   else settings.LLM_BASE_URL)
        model_name = (api_settings.model_name if api_settings and api_settings.model_name.strip() 
                    else settings.LLM_MODEL_NAME)

        if base_url and not base_url.endswith('/'):
            base_url += '/'

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        try:
            stream = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "你是一个 3D 打印助手，请总是以原生 JSON 格式输出响应，不要包含 Markdown 代码块。"},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=8192,
                stream=True,
                stream_options={"include_usage": True}
            )
            
            full_text = ""
            usage = None
            async for chunk in stream:
                # Robust usage extraction
                curr_usage = getattr(chunk, 'usage', None)
                if curr_usage:
                    prompt_details = getattr(curr_usage, 'prompt_tokens_details', None)
                    cached_tokens = getattr(prompt_details, 'cached_tokens', 0) if prompt_details else 0
                    usage = {
                        "prompt_tokens": getattr(curr_usage, 'prompt_tokens', 0),
                        "completion_tokens": getattr(curr_usage, 'completion_tokens', 0),
                        "total_tokens": getattr(curr_usage, 'total_tokens', 0),
                        "cache_tokens": cached_tokens
                    }
                    print(f"[Diagnosis] Captured usage: {usage}")

                if not chunk.choices: continue
                
                # Capture reasoning/thinking process if supported by model (e.g. DeepSeek R1)
                reasoning = getattr(chunk.choices[0].delta, 'reasoning_content', None)
                if reasoning:
                    yield f"data: {json.dumps({'type': 'thought', 'content': reasoning}, ensure_ascii=False)}\n\n"

                content = chunk.choices[0].delta.content
                if content:
                    full_text += content
                    yield f"data: {json.dumps({'type': 'text', 'content': content}, ensure_ascii=False)}\n\n"

            print(f"Finished receiving stream. Total characters: {len(full_text)}")
            
            # Final cleanup and parsing
            clean_text = full_text.strip()
            
            if not clean_text:
                yield f"data: {json.dumps({'type': 'error', 'message': 'AI 未能生成有效的诊断结论，请尝试补充更多描述或上传图片。'}, ensure_ascii=False)}\n\n"
                return

            if clean_text.startswith("```json"):
                clean_text = clean_text.replace("```json", "", 1)
            if clean_text.endswith("```"):
                clean_text = clean_text[::-1].replace("```", "", 1)[::-1]
            if clean_text.startswith("```"):
                clean_text = clean_text.replace("```", "", 1)
            
            clean_text = clean_text.strip()

            try:
                result_json = json.loads(clean_text)
                print("Yielding final JSON result.", flush=True)
                yield f"data: {json.dumps({'type': 'done', 'reasoning_markdown': result_json.get('reasoning_markdown', '生成推理失败。'), 'modifications': result_json.get('modifications', [])}, ensure_ascii=False)}\n\n"
            except Exception as e:
                # If final parse fails, yield the raw text as a fallback
                print(f"Yielding JSON parsing error: {e}", flush=True)
                yield f"data: {json.dumps({'type': 'error', 'message': f'AI 响应解析失败: {str(e)}', 'raw': full_text}, ensure_ascii=False)}\n\n"

        except (RateLimitError, AuthenticationError) as e:
            error_type = "余额不足或超限" if isinstance(e, RateLimitError) else "认证失败"
            print(f"Yielding API error: {error_type} - {e}", flush=True)
            yield f"data: {json.dumps({'type': 'error', 'message': f'{error_type} - {str(e)}'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            print(f"Yielding unexpected error: {e}", flush=True)
            yield f"data: {json.dumps({'type': 'error', 'message': f'发生了未预期错误: {str(e)}'}, ensure_ascii=False)}\n\n"

    async def analyze(
        self, 
        detections: List[Detection], 
        description: Optional[str], 
        safety_constraints: Optional[str], 
        preset_data: PresetData,
        api_settings: Optional[ApiSettings] = None
    ) -> DiagnosisResponse:
        
        # NEW: Expand presets with base profiles if they are incomplete diffs
        if preset_data:
            if preset_data.printer:
                preset_data.printer = preset_inheritance_service.get_full_preset(preset_data.printer, "printer")
            if preset_data.process:
                preset_data.process = preset_inheritance_service.get_full_preset(preset_data.process, "process")
            new_filaments = []
            for fil in preset_data.filament:
                new_filaments.append(preset_inheritance_service.get_full_preset(fil, "filament"))
            preset_data.filament = new_filaments

        system_prompt = "你是一个 3D 打印助手，请总是以原生 JSON 格式输出响应，不要包含 Markdown 代码块。"
        user_prompt = self._build_prompt(detections, description, preset_data)

        if safety_constraints:
            user_prompt += f"\n【重要安全约束】:\n{safety_constraints}\n绝对不能输出违反此约束的参数建议！\n"

        # Dynamically define client settings with robust fallback to system defaults
        api_key = (api_settings.api_key if api_settings and api_settings.api_key.strip() 
                  else settings.LLM_API_KEY)
        base_url = (api_settings.base_url if api_settings and api_settings.base_url.strip() 
                   else settings.LLM_BASE_URL)
        model_name = (api_settings.model_name if api_settings and api_settings.model_name.strip() 
                    else settings.LLM_MODEL_NAME)

        # Fix for ZhipuAI: Ensure trailing slash to prevent SDK from appending /v1 incorrectly
        if base_url and not base_url.endswith('/'):
            base_url += '/'

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)

        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=8192
            )
            
            result_text = response.choices[0].message.content.strip()
            print(f"--- LLM RAW RESPONSE (Model: {model_name}) ---\n{result_text}\n--- END RESPONSE ---")

            if not result_text:
                return DiagnosisResponse(
                    reasoning_markdown="### ❌ AI 返回内容为空\n模型未返回任何有效信息。请尝试补充更多描述或上传图片。",
                    modifications=[]
                )
            
            # Defensive cleaning in case the LLM still wraps with markdown
            clean_text = result_text
            if clean_text.startswith("```json"):
                clean_text = clean_text.replace("```json", "", 1)
            if clean_text.endswith("```"):
                clean_text = clean_text[::-1].replace("```", "", 1)[::-1]
            if clean_text.startswith("```"):
                clean_text = clean_text.replace("```", "", 1)
            
            clean_text = clean_text.strip()
            
            if not clean_text:
                return DiagnosisResponse(
                    reasoning_markdown="### ❌ AI 返回空响应\n模型返回的内容经过清理后为空，请尝试更换模型或补充更多信息。",
                    modifications=[]
                )

            try:
                result_json = json.loads(clean_text)
                modifications = [Modification(**mod) for mod in result_json.get("modifications", [])]
                return DiagnosisResponse(
                    reasoning_markdown=result_json.get("reasoning_markdown", "生成推理失败。"),
                    modifications=modifications
                )
            except json.JSONDecodeError as je:
                print(f"JSON Decode Error: {je}")
                return DiagnosisResponse(
                    reasoning_markdown=f"### ❌ AI 解析失败\n模型返回的内容不是合法的 JSON 格式。以下是原始内容用于排查：\n\n```text\n{result_text}\n```",
                    modifications=[]
                )
            
        except (RateLimitError, AuthenticationError) as e:
            # Handle specific quota/auth errors gracefully
            error_type = "余额不足或超限 (Quota Exceeded)" if isinstance(e, RateLimitError) else "认证失败 (Auth Failed)"
            return DiagnosisResponse(
                reasoning_markdown=f"### ❌ AI 服务授权问题\n{error_type}\n\n详情：{str(e)}\n\n**建议:**\n- 检查您的智谱/OpenAI 账户余额及 API 额度。\n- 确保在 AI 设置中填写的 API Key 是正确的。",
                modifications=[Modification(
                    name="API_AUTH_ERROR", old="N/A", new="N/A", range="N/A", reason="API 授权或额度问题", risk="high"
                )]
            )
        except OpenAIError as e:
            return DiagnosisResponse(
                reasoning_markdown=f"### ❌ AI 服务调用异常\nOpenAI 接口报错：{str(e)}",
                modifications=[Modification(
                    name="API_ERROR", old="N/A", new="N/A", range="N/A", reason="API 调用失败", risk="high"
                )]
            )
        except Exception as e:
            # General fallback
            import traceback
            traceback.print_exc()
            return DiagnosisResponse(
                reasoning_markdown=f"### ❌ 系统内部错误\n诊断服务发生未知异常：{str(e)}",
                modifications=[Modification(
                    name="INTERNAL_ERROR", old="N/A", new="N/A", range="N/A", reason="内部逻辑异常", risk="high"
                )]
            )

# Create a singleton instance for dependency injection
diagnosis_service = DiagnosisService()
