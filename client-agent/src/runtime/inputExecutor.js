const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function executeAction(action, capture) {
    if (process.platform !== 'win32') {
        throw new Error('Desktop vision input execution currently supports Windows only');
    }

    if (action.type === 'wait') {
        const duration = Number.isInteger(action.duration_ms) ? action.duration_ms : 500;
        await new Promise((resolve) => setTimeout(resolve, duration));
        return { ok: true, action: 'wait', duration_ms: duration };
    }

    if (!capture || !Number.isInteger(capture.left) || !Number.isInteger(capture.top)) {
        throw new Error('Desktop vision capture metadata is required for input execution');
    }

    const screenX = capture.left + (action.x || 0);
    const screenY = capture.top + (action.y || 0);
    const isDouble = action.type === 'double_click';
    const psScript = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Input {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
$x = ${screenX}
$y = ${screenY}
[Win32Input]::SetCursorPos($x, $y) | Out-Null
Start-Sleep -Milliseconds 80
[Win32Input]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[Win32Input]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
${isDouble ? `
Start-Sleep -Milliseconds 80
[Win32Input]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[Win32Input]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
` : ''}
Write-Output '{"ok":true}'
`;

    const { stdout, stderr } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript], {
        windowsHide: true,
        maxBuffer: 1024 * 1024,
    });

    if (stderr && stderr.trim()) {
        throw new Error(`Input execution failed: ${stderr.trim()}`);
    }

    return {
        ok: true,
        action: action.type,
        screen_x: screenX,
        screen_y: screenY,
        raw: String(stdout || '').trim(),
    };
}

module.exports = {
    executeAction,
};
