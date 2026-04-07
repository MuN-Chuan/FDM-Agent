const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function getVisionTargetConfig(config, targetApp = 'bambu_studio') {
    const defaultConfig = targetApp === 'orca_slicer'
        ? {
            window_title: 'OrcaSlicer',
            window_title_candidates: ['OrcaSlicer', 'Orca Slicer'],
            process_name: 'OrcaSlicer',
            capture_mode: 'screen',
            model: 'bytedance/ui-tars-1.5-7b',
        }
        : {
            window_title: 'BambuStudio',
            window_title_candidates: ['BambuStudio', 'Bambu Studio'],
            process_name: 'bambu-studio',
            capture_mode: 'screen',
            model: 'bytedance/ui-tars-1.5-7b',
        };

    return {
        ...defaultConfig,
        ...(config?.vision_providers?.[targetApp] || {}),
    };
}

function normalizeCandidates(values) {
    const seen = new Set();
    const normalized = [];
    for (const value of values) {
        if (typeof value !== 'string') {
            continue;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            continue;
        }
        const key = trimmed.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        normalized.push(trimmed);
    }
    return normalized;
}

function buildCaptureSelectors({ targetConfig, targetApp = 'bambu_studio', windowTitle }) {
    const fallbackTitleCandidates = targetApp === 'orca_slicer'
        ? ['OrcaSlicer', 'Orca Slicer']
        : ['BambuStudio', 'Bambu Studio'];
    const fallbackProcessNames = targetApp === 'orca_slicer'
        ? ['OrcaSlicer']
        : ['bambu-studio', 'BambuStudio'];

    return {
        windowTitleCandidates: normalizeCandidates([
            windowTitle,
            targetConfig?.window_title,
            ...(Array.isArray(targetConfig?.window_title_candidates) ? targetConfig.window_title_candidates : []),
            ...fallbackTitleCandidates,
        ]),
        processNames: normalizeCandidates([
            targetConfig?.process_name,
            ...(Array.isArray(targetConfig?.process_names) ? targetConfig.process_names : []),
            ...fallbackProcessNames,
        ]),
    };
}

async function captureWindow({ config, targetApp = 'bambu_studio', outputPath, windowTitle }) {
    if (process.platform !== 'win32') {
        throw new Error('Desktop vision capture currently supports Windows only');
    }

    const targetConfig = getVisionTargetConfig(config, targetApp);
    const finalOutputPath = outputPath || path.join(os.tmpdir(), `fdm-dv-${Date.now()}.png`);
    const selectors = buildCaptureSelectors({ targetConfig, targetApp, windowTitle });

    const psScript = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32DesktopVision {
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
}
"@
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32DesktopVisionZOrder {
  public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@
$titleCandidates = @(${selectors.windowTitleCandidates.map((item) => JSON.stringify(item)).join(', ')})
$processNames = @(${selectors.processNames.map((item) => JSON.stringify(item)).join(', ')})
$output = ${JSON.stringify(finalOutputPath)}
$captureMode = ${JSON.stringify(String(targetConfig.capture_mode || 'screen'))}
$visibleWindows = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object ProcessName, MainWindowTitle, MainWindowHandle
$proc = $visibleWindows | Where-Object {
  $title = $_.MainWindowTitle
  $titleMatch = $false
  foreach ($candidate in $titleCandidates) {
    if ($candidate -and $title -like ("*" + $candidate + "*")) {
      $titleMatch = $true
      break
    }
  }
  $processMatch = $false
  foreach ($processName in $processNames) {
    if ($processName -and $_.ProcessName -ieq $processName) {
      $processMatch = $true
      break
    }
  }
  $titleMatch -or $processMatch
} | Select-Object -First 1
if (-not $proc) {
  $visibleSummary = $visibleWindows | Select-Object -First 10 ProcessName, MainWindowTitle | ConvertTo-Json -Compress
  throw ("Window not found. title_candidates=" + ($titleCandidates -join "|") + "; process_names=" + ($processNames -join "|") + "; visible_windows=" + $visibleSummary)
}
[Win32DesktopVision]::ShowWindowAsync($proc.MainWindowHandle, 9) | Out-Null
[Win32DesktopVisionZOrder]::SetWindowPos($proc.MainWindowHandle, [Win32DesktopVisionZOrder]::HWND_TOPMOST, 0, 0, 0, 0, 0x0003) | Out-Null
[Win32DesktopVision]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 300
$rect = New-Object Win32DesktopVision+RECT
if (-not [Win32DesktopVision]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)) { throw "GetWindowRect failed" }
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) { throw "Invalid window bounds" }
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$captureMethod = "copy_from_screen"
if ($captureMode -eq "window") {
  $captureMethod = "print_window"
  $hdc = $graphics.GetHdc()
  try {
    $printOk = [Win32DesktopVision]::PrintWindow($proc.MainWindowHandle, $hdc, 2)
  } finally {
    $graphics.ReleaseHdc($hdc)
  }
  if (-not $printOk) {
    $captureMethod = "copy_from_screen_fallback"
    $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
  }
} else {
  $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bitmap.Size)
}
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
[Win32DesktopVisionZOrder]::SetWindowPos($proc.MainWindowHandle, [Win32DesktopVisionZOrder]::HWND_NOTOPMOST, 0, 0, 0, 0, 0x0003) | Out-Null
$result = @{
  path = $output
  width = $width
  height = $height
  left = $rect.Left
  top = $rect.Top
  window_title = $proc.MainWindowTitle
  capture_method = $captureMethod
} | ConvertTo-Json -Compress
Write-Output $result
`;

    let stdout;
    let stderr;
    try {
        ({ stdout, stderr } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', psScript], {
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024,
        }));
    } catch (error) {
        const details = [
            error?.stderr ? String(error.stderr).trim() : '',
            error?.stdout ? String(error.stdout).trim() : '',
            error?.message ? String(error.message).trim() : '',
        ].filter(Boolean);
        throw new Error(`Capture failed: ${details.join('\n')}`);
    }

    if (stderr && stderr.trim()) {
        throw new Error(`Capture failed: ${stderr.trim()}`);
    }

    const payload = JSON.parse(String(stdout || '').trim());
    const imageBuffer = fs.readFileSync(payload.path);
    return {
        ...payload,
        imageBase64: imageBuffer.toString('base64'),
        outputPath: payload.path,
    };
}

module.exports = {
    buildCaptureSelectors,
    captureWindow,
    getVisionTargetConfig,
};
