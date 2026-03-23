/**
 * handlers/repack.js
 *
 * Real slicer-native 3MF export flow:
 *   1. Download the original 3MF from the backend
 *   2. Download a CLI payload containing machine/process/filament override presets
 *   3. Write those preset JSON files into a temp workspace
 *   4. Invoke the local Bambu Studio CLI with:
 *        --load_settings
 *        --load_filaments
 *        --outputdir
 *        --export_3mf
 *        original.3mf
 *   5. Upload the exported 3MF back to the backend
 *
 * This replaces the old ZIP "repack" shortcut so the slicer software itself
 * is responsible for applying overrides and exporting the final 3MF.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const { promisify } = require('util');

const axios = require('axios');
const FormData = require('form-data');

const execFileAsync = promisify(execFile);
const cliOptionCache = new Map();

async function export3mfViaCli(params, push, config) {
    const { job_id, output_name } = params;
    if (!job_id) {
        throw new Error('export_3mf_cli: missing job_id');
    }

    const backendUrl = config.backend_url ?? 'http://localhost:8000';
    const bambuStudioPath = config.bambu_studio_path;
    if (!bambuStudioPath || !fs.existsSync(bambuStudioPath)) {
        throw new Error(`Bambu Studio executable not found: ${bambuStudioPath ?? '(empty path)'}`);
    }

    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), `fdm-cli-${job_id.slice(0, 8)}-`));
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdm-cli-sandbox-'));
    const originalPath = path.join(workspaceDir, 'original.3mf');
    const finalOutputName = sanitizeOutputName(output_name);
    const outputPath = path.join(workspaceDir, finalOutputName);

    try {
        push({ type: 'progress', step: 1, message: '正在从服务器下载原始 3MF...' });
        const originalResp = await axios.get(`${backendUrl}/api/slicer/agent/original/${job_id}`, {
            responseType: 'arraybuffer',
            timeout: 60000,
        });
        fs.writeFileSync(originalPath, Buffer.from(originalResp.data));

        push({ type: 'progress', step: 2, message: '正在获取切片软件 CLI 覆盖预设...' });
        const payloadResp = await axios.get(`${backendUrl}/api/slicer/agent/cli-payload/${job_id}`, {
            timeout: 30000,
        });
        const cliPayload = payloadResp.data;

        push({ type: 'progress', step: 3, message: '正在写入临时 preset 覆盖文件...' });
        const presetFiles = writePresetOverrides(workspaceDir, cliPayload);

        push({ type: 'progress', step: 4, message: '正在调用 Bambu Studio CLI 导出 3MF...' });
        const cliSupport = await inspectCliOptions(bambuStudioPath);
        const cliArgs = buildCliArgs({
            originalPath,
            workspaceDir,
            sandboxDir,
            outputName: finalOutputName,
            presetFiles,
            cliSupport,
        });

        const { stdout, stderr } = await execFileAsync(bambuStudioPath, cliArgs, {
            cwd: workspaceDir,
            timeout: 300000,
            maxBuffer: 32 * 1024 * 1024,
        });

        if (!fs.existsSync(outputPath)) {
            const detail = [stdout, stderr].filter(Boolean).join('\n').trim();
            throw new Error(detail || 'Bambu Studio CLI did not produce the expected 3MF output.');
        }

        push({ type: 'progress', step: 5, message: '正在上传切片软件导出的 3MF...' });
        const form = new FormData();
        form.append('file', fs.createReadStream(outputPath), { filename: finalOutputName });
        await axios.post(`${backendUrl}/api/slicer/agent/upload-result/${job_id}`, form, {
            headers: form.getHeaders(),
            timeout: 60000,
            maxContentLength: 200 * 1024 * 1024,
            maxBodyLength: 200 * 1024 * 1024,
        });

        push({
            type: 'done',
            job_id,
            download_url: `${backendUrl}/api/slicer/download-3mf/${job_id}`,
            message: '切片软件已完成 3MF 导出。',
        });
    } finally {
        safeRemove(workspaceDir);
        safeRemove(sandboxDir);
    }
}

function buildCliArgs({ originalPath, workspaceDir, sandboxDir, outputName, presetFiles, cliSupport }) {
    const args = [];
    const outputDirFlag = requireCliFlag(cliSupport, ['--outputdir']);
    args.push(outputDirFlag, workspaceDir);

    const dataDirFlag = findCliFlag(cliSupport, ['--datadir', '--data-dir']);
    if (dataDirFlag) {
        args.push(dataDirFlag, sandboxDir);
    }

    const loadSettings = [];
    if (presetFiles.machine) {
        loadSettings.push(presetFiles.machine);
    }
    if (presetFiles.process) {
        loadSettings.push(presetFiles.process);
    }
    if (loadSettings.length > 0) {
        args.push(requireCliFlag(cliSupport, ['--load-settings', '--load_settings']), loadSettings.join(';'));
    }

    if (presetFiles.filaments.length > 0) {
        args.push(requireCliFlag(cliSupport, ['--load-filaments', '--load_filaments']), presetFiles.filaments.join(';'));
    }

    args.push(requireCliFlag(cliSupport, ['--export-3mf', '--export_3mf']), outputName);
    args.push(originalPath);
    return args;
}

function writePresetOverrides(workspaceDir, cliPayload) {
    const presetDir = path.join(workspaceDir, 'presets');
    fs.mkdirSync(presetDir, { recursive: true });

    const result = {
        machine: null,
        process: null,
        filaments: [],
    };

    if (cliPayload.machine_preset) {
        result.machine = path.join(presetDir, 'machine.json');
        writeJson(result.machine, cliPayload.machine_preset);
    }

    if (cliPayload.process_preset) {
        result.process = path.join(presetDir, 'process.json');
        writeJson(result.process, cliPayload.process_preset);
    }

    for (const [index, preset] of (cliPayload.filament_presets ?? []).entries()) {
        const filename = path.join(presetDir, `filament_${index}.json`);
        writeJson(filename, preset);
        result.filaments.push(filename);
    }

    return result;
}

function writeJson(filePath, value) {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`, 'utf8');
}

function sanitizeOutputName(value) {
    const fallback = 'optimized.3mf';
    if (!value || typeof value !== 'string') {
        return fallback;
    }

    const base = path.basename(value);
    if (!base.toLowerCase().endsWith('.3mf')) {
        return `${base}.3mf`;
    }
    return base;
}

function safeRemove(targetPath) {
    try {
        fs.rmSync(targetPath, { recursive: true, force: true });
    } catch {
        // ignore cleanup failures
    }
}

async function inspectCliOptions(executablePath) {
    if (cliOptionCache.has(executablePath)) {
        return cliOptionCache.get(executablePath);
    }

    const { stdout = '', stderr = '' } = await execFileAsync(executablePath, ['--help'], {
        timeout: 30000,
        maxBuffer: 8 * 1024 * 1024,
    });
    const helpText = `${stdout}\n${stderr}`;
    const support = {
        helpText,
        options: new Set((helpText.match(/--[A-Za-z0-9][A-Za-z0-9_-]*/g) || [])),
    };
    cliOptionCache.set(executablePath, support);
    return support;
}

function findCliFlag(cliSupport, candidates) {
    return candidates.find((flag) => cliSupport.options.has(flag)) ?? null;
}

function requireCliFlag(cliSupport, candidates) {
    const match = findCliFlag(cliSupport, candidates);
    if (!match) {
        throw new Error(`Bambu Studio CLI does not support expected flag(s): ${candidates.join(', ')}`);
    }
    return match;
}

module.exports = {
    export3mfViaCli,
    repack3mf: export3mfViaCli,
};
