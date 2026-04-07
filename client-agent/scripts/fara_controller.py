import os
import sys
import json
import time
import argparse
from pathlib import Path

try:
    import pyautogui
    import pygetwindow as gw
    from PIL import Image
except ImportError:
    # We allow running without these for initialization tests
    pyautogui = None
    gw = None

def capture_window(window_title):
    """Captures the screenshot of a specific window."""
    if not gw:
        return None, "pygetwindow not installed"
    
    windows = gw.getWindowsWithTitle(window_title)
    if not windows:
        return None, f"Window with title '{window_title}' not found"
    
    window = windows[0]
    if window.isMinimized:
        window.restore()
    window.activate()
    
    # Give some time for window to come to foreground
    time.sleep(0.5)
    
    screenshot = pyautogui.screenshot(region=(window.left, window.top, window.width, window.height))
    return screenshot, None

def dispatch_action(action_type, coords):
    """Performs a GUI action."""
    if not pyautogui:
        return False, "pyautogui not installed"
    
    if action_type == "click":
        pyautogui.click(coords[0], coords[1])
        return True, None
    elif action_type == "type":
        pyautogui.write(coords["text"])
        return True, None
    
    return False, f"Unknown action: {action_type}"

def main():
    parser = argparse.ArgumentParser(description="Fara-7B Vision Controller for Bambu Studio")
    parser.add_argument("--action", required=True, choices=["home", "move", "capture"], help="Action to perform")
    parser.add_argument("--window", default="Bambu Studio", help="Target window title")
    parser.add_argument("--output", default="screenshot.png", help="Path to save debug screenshot")
    
    args = parser.parse_args()
    
    # 1. Capture screen
    print(f"Targeting window: {args.window}")
    screenshot, error = capture_window(args.window)
    if error:
        print(json.dumps({"success": False, "error": error}))
        sys.exit(1)
        
    screenshot.save(args.output)
    
    # 2. Vision Logic (Placeholder for Fara-7B)
    # In a real implementation, we would send this screenshot to a VLM 
    # to find the "Home" button or "Axis" controls.
    
    if args.action == "home":
        # Placeholder coordinates for "Homing" in Bambu Studio 1.8.x Device tab
        # This will be replaced by VLM-detected coordinates
        print(json.dumps({
            "success": True, 
            "message": "Fara-7B framework ready. Capture successful.",
            "screenshot": os.path.abspath(args.output)
        }))
    else:
        print(json.dumps({"success": True, "message": f"Action '{args.action}' capture completed."}))

if __name__ == "__main__":
    main()
