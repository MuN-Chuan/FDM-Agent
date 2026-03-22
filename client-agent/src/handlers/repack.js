/**
 * handlers/repack.js — 3MF 切片级重打包处理器
 *
 * 流程：
 *   1. 从后端下载原始 3MF 文件 (GET /api/slicer/agent/original/{job_id})
 *   2. 从后端获取修改后的 project_settings.config (GET /api/slicer/agent/settings/{job_id})
 *   3. 在本地临时目录解压 3MF，替换 project_settings.config，重新压包
 *   4. 将结果 3MF 上传回后端 (POST /api/slicer/agent/upload-result/{job_id})
 *   5. 通知前端 done
 *
 * 关于为什么不直接用 Python 重打包：
 *   - Python repack 已够用 (repack_only=true 默认情况)
 *   - 此处理器供未来 BambuStudio CLI 切片模式使用（repack_only=false）
 *   - 暂时用纯 ZIP 操作实现，后期替换为 bambu-studio --export_3mf
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const axios = require('axios');
const FormData = require('form-data');

const execFileAsync = promisify(execFile);

async function repack3mf(params, push, config) {
    const { job_id, output_name = 'repacked.3mf', use_cli = false } = params;
    if (!job_id) throw new Error('repack_3mf: missing job_id');

    const backendUrl = config.backend_url ?? 'http://localhost:8000';
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `fdm-repack-${job_id.slice(0, 8)}-`));
    const originalPath = path.join(tmpDir, 'original.3mf');
    const outputPath = path.join(tmpDir, output_name);

    try {
        // ── Step 1: Download the original 3MF ──────────────────────────
        push({ type: 'progress', step: 1, message: '正在从服务器下载原始 3MF...' });

        const origResp = await axios.get(`${backendUrl}/api/slicer/agent/original/${job_id}`, {
            responseType: 'arraybuffer',
            timeout: 60000,
        });
        fs.writeFileSync(originalPath, Buffer.from(origResp.data));
        push({ type: 'progress', step: 2, message: `已下载原始 3MF (${Math.round(origResp.data.byteLength / 1024)} KB)` });

        // ── Step 2: Get modified settings JSON ─────────────────────────
        push({ type: 'progress', step: 3, message: '获取 AI 修改后的预设参数...' });

        const settingsResp = await axios.get(`${backendUrl}/api/slicer/agent/settings/${job_id}`, {
            timeout: 30000,
        });
        const modifiedSettings = settingsResp.data;

        // ── Step 3: Repack (pure ZIP, or invoke BambuStudio CLI) ────────
        if (use_cli && config.bambu_studio_path && fs.existsSync(config.bambu_studio_path)) {
            await repackViaCLI(originalPath, modifiedSettings, outputPath, config, push);
        } else {
            push({ type: 'progress', step: 4, message: '正在执行内部 ZIP 重打包...' });
            await repackViaZip(originalPath, modifiedSettings, outputPath);
        }

        // ── Step 4: Upload result to backend ───────────────────────────
        push({ type: 'progress', step: 5, message: '正在上传结果 3MF 到服务器...' });

        const form = new FormData();
        form.append('file', fs.createReadStream(outputPath), { filename: output_name });
        await axios.post(`${backendUrl}/api/slicer/agent/upload-result/${job_id}`, form, {
            headers: form.getHeaders(),
            timeout: 60000,
            maxContentLength: 200 * 1024 * 1024,
        });

        const downloadUrl = `${backendUrl}/api/slicer/download-3mf/${job_id}`;
        push({
            type: 'done',
            job_id,
            download_url: downloadUrl,
            message: '3MF 重打包完成！',
        });

    } finally {
        // Clean up temp dir
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { /* ignore */ }
    }
}

/**
 * 使用本地 ZIP 库重打包 3MF。
 * 无需安装额外库，使用系统 unzip/zip 或原生 Node.js。
 */
async function repackViaZip(originalPath, settings, outputPath) {
    // We do it via child_process with system tools on Windows/Linux/Mac
    // On Windows: use PowerShell Compress-Archive
    // On Linux/Mac: use zip command
    // Simpler: re-implement in Node.js with basic Buffer manipulation
    // Since we don't have 'jszip' in this package, do it with streams
    const AdmZip = requireAdmZip();
    if (AdmZip) {
        const zip = new AdmZip(originalPath);
        const settingsStr = JSON.stringify(settings, null, 4);
        zip.deleteFile('Metadata/project_settings.config');
        zip.addFile('Metadata/project_settings.config', Buffer.from(settingsStr, 'utf8'));
        zip.writeZip(outputPath);
        return;
    }

    // Fallback: PowerShell on Windows
    const os = require('os');
    if (os.platform() === 'win32') {
        await repackWithPowerShell(originalPath, settings, outputPath);
    } else {
        // Linux: unzip, sed, zip
        await repackWithUnzip(originalPath, settings, outputPath);
    }
}

/**
 * 动态加载 adm-zip（可选依赖）。
 */
function requireAdmZip() {
    try {
        return require('adm-zip');
    } catch {
        return null;
    }
}

/**
 * PowerShell repack implementation (Windows fallback).
 */
async function repackWithPowerShell(originalPath, settings, outputPath) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdm-zip-'));
    try {
        // Extract
        await execAsync(`powershell -Command "Expand-Archive -Path '${originalPath}' -DestinationPath '${workDir}' -Force"`);
        // Overwrite settings
        const settingsPath = path.join(workDir, 'Metadata', 'project_settings.config');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
        // Re-zip
        await execAsync(`powershell -Command "Compress-Archive -Path '${workDir}/*' -DestinationPath '${outputPath}' -Force"`);
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

/**
 * unzip/zip command fallback (Linux/Mac).
 */
async function repackWithUnzip(originalPath, settings, outputPath) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdm-zip-'));
    try {
        await execAsync(`unzip -q "${originalPath}" -d "${workDir}"`);
        const settingsPath = path.join(workDir, 'Metadata', 'project_settings.config');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
        fs.rmSync(outputPath, { force: true });
        await execAsync(`cd "${workDir}" && zip -qr "${outputPath}" .`);
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

/**
 * 使用 BambuStudio CLI 重打包（最高兼容性，未来解锁切片功能）。
 */
async function repackViaCLI(originalPath, settings, outputPath, config, push) {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');

    push({ type: 'progress', step: 4, message: '正在调用 BambuStudio CLI 重打包...' });

    // Write modified settings to temp file
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdm-cli-'));
    const settingsPath = path.join(workDir, 'project_settings.config');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');

    try {
        // BambuStudio CLI usage: bambu-studio --slice -i input.3mf --outputdir /tmp/out
        // For now, do a hybrid: extract 3MF, replace settings, ask BS to validate
        // Full CLI slicing is a planned future feature
        await repackViaZip(originalPath, settings, outputPath);
        push({ type: 'progress', step: 4, message: 'BambuStudio CLI 重打包完成（ZIP模式）' });
    } finally {
        fs.rmSync(workDir, { recursive: true, force: true });
    }
}

module.exports = { repack3mf };
