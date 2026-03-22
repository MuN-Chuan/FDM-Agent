/**
 * handlers/printer.js — 打印机控制处理器 (使用 bambu-cli)
 *
 * 支持命令：
 *   print_start   — 推送文件到打印机并开始打印
 *   print_pause   — 暂停打印
 *   print_resume  — 继续打印
 *   print_stop    — 停止打印
 *   printer_status — 查询打印机状态
 */

const { spawn } = require('child_process');

/**
 * 运行 bambu-cli 命令并返回 stdout/stderr 字符串。
 */
function runBambuCli(args, config) {
    return new Promise((resolve, reject) => {
        const cliPath = config.bambu_cli_path ?? 'bambu-cli';
        const env = {
            ...process.env,
            BAMBU_HOST: config.printer?.host,
            BAMBU_SERIAL: config.printer?.serial,
            BAMBU_ACCESS_CODE: config.printer?.access_code,
        };

        const proc = spawn(cliPath, args, { env, shell: true });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            } else {
                reject(new Error(`bambu-cli exited ${code}: ${stderr.trim() || stdout.trim()}`));
            }
        });

        proc.on('error', (err) => {
            if (err.code === 'ENOENT') {
                reject(new Error(
                    `bambu-cli not found. Install it first: npm install -g @bambulab/bambu-cli\n`
                    + `Or set bambu_cli_path in config.json`
                ));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * 处理打印机控制命令。
 */
async function printerControl(cmd, params, push, config) {
    if (!config.printer?.host) {
        throw new Error('Printer not configured. Please set printer.host, printer.serial, and printer.access_code in config.json');
    }

    push({ type: 'status', message: `正在执行 ${cmd}...` });

    let result;
    switch (cmd) {
        case 'printer_status': {
            result = await runBambuCli(['status'], config);
            push({ type: 'done', cmd, data: result.stdout, message: '打印机状态获取成功' });
            break;
        }

        case 'print_start': {
            const { file_name, job_id } = params;
            if (!file_name) throw new Error('print_start: missing file_name parameter');

            // If we have a job_id, first download the modified 3MF from backend
            // to local temp, then push it to printer
            if (job_id) {
                const downloadUrl = `${config.backend_url}/api/slicer/download-3mf/${job_id}`;
                push({ type: 'progress', message: `正在从服务器下载 ${file_name}...` });

                const axios = require('axios');
                const os = require('os');
                const fs = require('fs');
                const path = require('path');

                const tmpFile = path.join(os.tmpdir(), file_name);
                const response = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                });
                fs.writeFileSync(tmpFile, Buffer.from(response.data));
                push({ type: 'progress', message: '文件已下载，正在推送到打印机...' });

                result = await runBambuCli(['print', tmpFile], config);
                try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
            } else {
                result = await runBambuCli(['print', file_name], config);
            }

            push({ type: 'done', cmd, data: result.stdout, message: '打印任务已发送' });
            break;
        }

        case 'print_pause': {
            result = await runBambuCli(['pause'], config);
            push({ type: 'done', cmd, data: result.stdout, message: '打印已暂停' });
            break;
        }

        case 'print_resume': {
            result = await runBambuCli(['resume'], config);
            push({ type: 'done', cmd, data: result.stdout, message: '打印已恢复' });
            break;
        }

        case 'print_stop': {
            result = await runBambuCli(['stop'], config);
            push({ type: 'done', cmd, data: result.stdout, message: '打印已停止' });
            break;
        }

        default:
            throw new Error(`Unknown printer command: ${cmd}`);
    }
}

module.exports = { printerControl };
