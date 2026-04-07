from __future__ import annotations

import json

from app.models.desktop_vision import DesktopVisionPlanRequest


class DesktopVisionPromptBuilder:
    TASK_DESCRIPTIONS = {
        "home_printer": "让打印机执行回中操作。仅在界面已经可见且可安全点击时返回动作。",
        "move_axis": "让打印机执行单次轴移动。仅在目标轴移动控件清晰可见时返回动作。",
    }

    def build(self, request: DesktopVisionPlanRequest) -> str:
        history_summary = [
            {
                "step": item.step,
                "action": item.action,
                "result": item.result,
                "x": item.x,
                "y": item.y,
            }
            for item in request.history
        ]

        schema = {
            "status": "continue | done | failed",
            "message": "string",
            "action": {
                "type": "one of allowed_actions",
                "x": "integer when needed",
                "y": "integer when needed",
                "text": "string when action=type",
                "key": "string when action=hotkey",
                "delta": "integer when action=scroll",
                "duration_ms": "integer when action=wait",
                "reason": "short Chinese explanation",
                "confidence": "0..1",
            },
            "verification": {
                "mode": "screen_change | target_state | none",
                "expectation": "short Chinese expectation",
            },
        }

        return (
            "你是桌面视觉控制规划器。你只负责输出下一步动作，不直接执行动作。\n"
            f"任务: {request.task}\n"
            f"任务说明: {self.TASK_DESCRIPTIONS[request.task]}\n"
            f"当前步骤: {request.step}\n"
            f"窗口标题: {request.screen.window_title}\n"
            f"窗口尺寸: {request.screen.width}x{request.screen.height}\n"
            f"允许动作: {', '.join(request.allowed_actions)}\n"
            "约束:\n"
            "- 坐标必须是窗口内相对坐标\n"
            "- 不要输出多步计划，只输出下一步\n"
            "- 如果当前界面已经满足目标，返回 status=done\n"
            "- 如果看不清或无法安全判断，返回 status=failed\n"
            "- 输出必须是 JSON，不要包含 markdown 代码块\n"
            f"历史步骤: {json.dumps(history_summary, ensure_ascii=False)}\n"
            f"输出 schema: {json.dumps(schema, ensure_ascii=False)}"
        )
