/**
 * FDM-AI Client Agent — 主入口
 *
 * 运行在用户本机，通过 WebSocket 接受前端网页指令，
 * 调用本地 BambuStudio CLI 执行 slicer-native 3MF 导出，
 * 调用 bambu-cli 控制打印机。
 *
 * 使用方法：
 *   node src/index.js
 *   (或) npm start
 */

const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

// ─── 加载配置 ─────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, '..', 'config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch {
    const examplePath = path.resolve(__dirname, '..', 'config.example.json');
    console.warn('[Agent] config.json not found, loading config.example.json as fallback');
    config = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
}

const PORT = config.port ?? 7890;

// ─── 导入命令处理器 ───────────────────────────────────────────────
const { handleCommand } = require('./commands');

// ─── WebSocket 服务器 ─────────────────────────────────────────────
const wss = new WebSocketServer({ port: PORT });

function log(level, ...args) {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${level.toUpperCase()}]`, ...args);
}

function send(ws, payload) {
    try {
        ws.send(JSON.stringify(payload));
    } catch (err) {
        log('error', 'Failed to send message:', err.message);
    }
}

wss.on('listening', () => {
    log('info', `FDM-AI Client Agent listening on ws://localhost:${PORT}`);
    log('info', `Backend API: ${config.backend_url}`);
    log('info', `BambuStudio: ${config.bambu_studio_path}`);
});

wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log('info', `Frontend connected from ${clientIp}`);

    // Immediately send a hello message with agent capabilities
    send(ws, {
        type: 'hello',
        version: '1.0.0',
        capabilities: ['export_3mf_cli', 'repack_3mf', 'print_start', 'print_pause', 'print_resume', 'print_stop', 'printer_status'],
        config: {
            bambu_studio_available: fs.existsSync(config.bambu_studio_path),
            printer_host: config.printer?.host ?? null,
        }
    });

    ws.on('message', async (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            send(ws, { type: 'error', message: 'Invalid JSON message' });
            return;
        }

        const { cmd, ...params } = msg;
        log('info', `Received command: ${cmd}`, params);

        if (!cmd) {
            send(ws, { type: 'error', message: 'Missing "cmd" field' });
            return;
        }

        // Wrap the command in a push callback so the handler can stream progress
        const push = (payload) => send(ws, { cmd, ...payload });

        try {
            await handleCommand(cmd, params, push, config);
        } catch (err) {
            log('error', `Command "${cmd}" failed:`, err.message);
            send(ws, { type: 'error', cmd, job_id: params.job_id, message: err.message });
        }
    });

    ws.on('close', () => {
        log('info', `Frontend disconnected from ${clientIp}`);
    });

    ws.on('error', (err) => {
        log('error', 'WebSocket error:', err.message);
    });
});

wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        log('error', `Port ${PORT} is already in use. Is another agent running?`);
        process.exit(1);
    }
    throw err;
});

// ─── 优雅退出 ────────────────────────────────────────────────────
process.on('SIGINT', () => {
    log('info', 'Shutting down...');
    wss.close(() => process.exit(0));
});
