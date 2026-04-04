import os
import sys
import json
import base64
import argparse
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List

try:
    import pyautogui
    import pygetwindow as gw
    from PIL import Image
except ImportError:
    pyautogui = None
    gw = None

class VisionController:
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url.rstrip("/")
        self.supported_actions = ["click", "double_click", "right_click", "type", "move_mouse", "scroll"]
    
    def capture_window(self, window_title: str) -> tuple[Optional[Image.Image], Optional[str]]:
        """捕获指定窗口截图"""
        if not gw:
            return None, "pygetwindow not installed"
        
        windows = gw.getWindowsWithTitle(window_title)
        if not windows:
            return None, f"Window '{window_title}' not found"
        
        window = windows[0]
        if window.isMinimized:
            window.restore()
        window.activate()
        
        import time
        time.sleep(0.5)
        
        screenshot = pyautogui.screenshot(region=(window.left, window.top, window.width, window.height))
        return screenshot, None
    
    def execute_action(self, action: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """执行 AI 返回的动作"""
        if not pyautogui:
            return False, "pyautogui not installed"
        
        action_type = action.get("action")
        if action_type not in self.supported_actions:
            return False, f"Unsupported action: {action_type}"
        
        try:
            if action_type == "click":
                pyautogui.click(action["x"], action["y"])
            elif action_type == "double_click":
                pyautogui.doubleClick(action["x"], action["y"])
            elif action_type == "right_click":
                pyautogui.rightClick(action["x"], action["y"])
            elif action_type == "move_mouse":
                pyautogui.moveTo(action["x"], action["y"])
            elif action_type == "type":
                pyautogui.typewrite(action.get("text", ""))
            elif action_type == "scroll":
                pyautogui.scroll(action.get("delta", 0), action["x"], action["y"])
            return True, None
        except Exception as e:
            return False, str(e)
    
    async def analyze_with_backend(self, screenshot_base64: str, task: str) -> Dict[str, Any]:
        """调用后端 API 分析截图"""
        import aiohttp
        
        url = f"{self.backend_url}/api/agent/vision/analyze"
        payload = {
            "screenshot_base64": screenshot_base64,
            "task": task,
            "context": {"available_actions": self.supported_actions}
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Backend error {resp.status}: {text}")
                return await resp.json()
    
    async def run_vision_control(self, window_title: str, task: str) -> Dict[str, Any]:
        """执行完整的视觉控制流程"""
        # 1. 捕获截图
        screenshot, error = self.capture_window(window_title)
        if error:
            return {"success": False, "error": f"screenshot_failed: {error}"}
        
        # 2. 保存并编码截图
        import io
        img_buffer = io.BytesIO()
        screenshot.save(img_buffer, format="PNG")
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        
        # 3. 调用后端分析
        try:
            analysis = await self.analyze_with_backend(img_base64, task)
        except Exception as e:
            return {"success": False, "error": f"vision_timeout: {str(e)}"}
        
        # 4. 解析并执行动作
        if analysis.get("type") == "action":
            action = {
                "action": analysis.get("action"),
                "x": analysis.get("x"),
                "y": analysis.get("y"),
                "text": analysis.get("text"),
                "delta": analysis.get("delta")
            }
            success, exec_error = self.execute_action(action)
            if success:
                return {
                    "success": True,
                    "action": analysis.get("action"),
                    "x": analysis.get("x"),
                    "y": analysis.get("y"),
                    "description": analysis.get("description", "")
                }
            else:
                return {"success": False, "error": f"action_failed: {exec_error}"}
        
        return {"success": False, "error": f"invalid_response: {analysis}"}

def main():
    parser = argparse.ArgumentParser(description="Vision Controller for Bambu Studio")
    parser.add_argument("--task", required=True, help="Task to perform (e.g., home_printer)")
    parser.add_argument("--window", default="Bambu Studio", help="Target window title")
    parser.add_argument("--backend-url", default="http://localhost:8000", help="Backend API URL")
    parser.add_argument("--output", default="screenshot_vision.png", help="Path to save debug screenshot")
    
    args = parser.parse_args()
    
    controller = VisionController(backend_url=args.backend_url)
    
    # 捕获截图保存用于调试
    screenshot, error = controller.capture_window(args.window)
    if error:
        print(json.dumps({"success": False, "error": error}))
        sys.exit(1)
    screenshot.save(args.output)
    
    # 执行视觉控制
    result = asyncio.run(controller.run_vision_control(args.window, args.task))
    print(json.dumps(result))

if __name__ == "__main__":
    main()