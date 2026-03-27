/**
 * commands.js — 命令分发器
 *
 * 注册所有支持的命令并将其分发给对应处理模块。
 */

const { export3mfViaCli } = require('./handlers/repack');
const { printerControl } = require('./handlers/printer');

/**
 * 分发命令给对应处理器。
 *
 * @param {string} cmd 命令名称
 * @param {object} params 命令参数
 * @param {function} push 向前端推送状态的函数 (payload) => void
 * @param {object} config Agent 全局配置
 */
async function handleCommand(cmd, params, push, config) {
    switch (cmd) {
        case 'export_3mf_cli':
            return export3mfViaCli(params, push, config);

        case 'repack_3mf':
            return export3mfViaCli(params, push, config);

        case 'print_start':
        case 'print_pause':
        case 'print_resume':
        case 'print_stop':
        case 'printer_discover':
        case 'printer_login':
        case 'printer_login_verify_code':
        case 'printer_send_login_code':
        case 'printer_set_ip':
        case 'printer_status':
        case 'printer_login_hint':
        case 'printer_light_control':
        case 'printer_home':
        case 'ams_status':
            return printerControl(cmd, params, push, config);

        case 'ping':
            push({ type: 'pong', ts: Date.now() });
            return;

        default:
            throw new Error(`Unknown command: "${cmd}"`);
    }
}

module.exports = { handleCommand };
