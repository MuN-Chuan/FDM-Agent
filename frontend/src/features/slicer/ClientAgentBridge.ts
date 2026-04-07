/**
 * ClientAgentBridge.ts
 *
 * 前端 WebSocket 客户端，连接本地运行的 FDM-AI Client Agent (ws://localhost:7890)。
 *
 * 功能：
 *   - 管理连接状态（connecting / connected / disconnected / error）
 *   - 发送命令 JSON 到本地 Agent（export_3mf_cli, print_start, printer_status, etc.）
 *   - 接收 Agent 推送并通过 EventEmitter 风格回调分发给订阅者
 *   - 自动重连（出现断连时 5s 后重试）
 */

export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AgentMessage {
    type: 'hello' | 'status' | 'progress' | 'done' | 'error' | 'pong' | 'warning';
    cmd?: string;
    job_id?: string;
    step?: number;
    message?: string;
    data?: unknown;
    download_url?: string;
    version?: string;
    capabilities?: string[];
    config?: Record<string, unknown>;
}

export interface AgentCapabilities {
    bambu_studio_available: boolean;
    printer_host: string | null;
    printer_count?: number;
    printer_login_required?: boolean;
    capabilities: string[];
    version: string;
}

export type BambuAccountType = 'email' | 'phone';
export type BambuCloudRegion = 'global' | 'cn';

type MessageListener = (msg: AgentMessage) => void;
type StatusListener = (status: AgentStatus) => void;

const AGENT_WS_URL = 'ws://localhost:7890';
const RECONNECT_DELAY_MS = 5000;

class ClientAgentBridgeClass {
    private ws: WebSocket | null = null;
    private status: AgentStatus = 'disconnected';
    private capabilities: AgentCapabilities | null = null;

    private messageListeners: Set<MessageListener> = new Set();
    private statusListeners: Set<StatusListener> = new Set();

    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private shouldReconnect = false;

    // ─── Connection ────────────────────────────────────────────────

    connect() {
        if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
            return;
        }
        this.shouldReconnect = true;
        this._openSocket();
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.ws?.close();
        this.ws = null;
        this._setStatus('disconnected');
    }

    private _openSocket() {
        this._setStatus('connecting');
        const ws = new WebSocket(AGENT_WS_URL);
        this.ws = ws;

        ws.addEventListener('open', () => {
            this._setStatus('connected');
        });

        ws.addEventListener('message', (event) => {
            try {
                const msg = JSON.parse(event.data as string) as AgentMessage;
                if (msg.type === 'hello') {
                    this.capabilities = {
                        bambu_studio_available: (msg.config?.bambu_studio_available as boolean) ?? false,
                        printer_host: (msg.config?.printer_host as string | null) ?? null,
                        printer_count: (msg.config?.printer_count as number | undefined) ?? 0,
                        printer_login_required: (msg.config?.printer_login_required as boolean | undefined) ?? false,
                        capabilities: msg.capabilities ?? [],
                        version: msg.version ?? 'unknown',
                    };
                }
                this.messageListeners.forEach((fn) => fn(msg));
            } catch { /* malformed JSON, ignore */ }
        });

        ws.addEventListener('close', () => {
            this.ws = null;
            this._setStatus('disconnected');
            if (this.shouldReconnect) {
                this.reconnectTimer = setTimeout(() => this._openSocket(), RECONNECT_DELAY_MS);
            }
        });

        ws.addEventListener('error', () => {
            this._setStatus('error');
        });
    }

    private _setStatus(status: AgentStatus) {
        if (this.status === status) return;
        this.status = status;
        this.statusListeners.forEach((fn) => fn(status));
    }

    // ─── Sending commands ──────────────────────────────────────────

    send(cmd: string, params?: Record<string, unknown>): boolean {
        if (this.ws?.readyState !== WebSocket.OPEN) {
            console.warn('[ClientAgentBridge] Not connected, cannot send:', cmd);
            return false;
        }
        this.ws.send(JSON.stringify({ cmd, ...params }));
        return true;
    }

    /** Export a 3MF via the local slicer CLI using the Agent. */
    export3MFViaCli(jobId: string, outputName?: string) {
        return this.send('export_3mf_cli', { job_id: jobId, output_name: outputName ?? 'optimized.3mf' });
    }

    /** Backward-compatible alias for the old command name. */
    repack3MF(jobId: string, outputName?: string) {
        return this.export3MFViaCli(jobId, outputName);
    }

    /** Start printing a file (can reference a backend job_id so Agent downloads first). */
    printStart(printerId: string, fileName: string, jobId?: string, plate?: number) {
        return this.send('print_start', { printer_id: printerId, file_name: fileName, job_id: jobId, plate });
    }

    printPause(printerId: string)  { return this.send('print_pause', { printer_id: printerId }); }
    printResume(printerId: string) { return this.send('print_resume', { printer_id: printerId }); }
    printStop(printerId: string, confirm = false)   { return this.send('print_stop', { printer_id: printerId, confirm }); }
    discoverPrinters() { return this.send('printer_discover'); }
    loginBambuAccount(account: string, password: string, accountType: BambuAccountType, region: BambuCloudRegion) {
        return this.send('printer_login', { account, password, account_type: accountType, region });
    }
    verifyBambuLoginCode(account: string, code: string, accountType: BambuAccountType, region: BambuCloudRegion) {
        return this.send('printer_login_verify_code', { account, code, account_type: accountType, region });
    }
    sendBambuLoginCode(account: string, accountType: BambuAccountType, region: BambuCloudRegion) {
        return this.send('printer_send_login_code', { account, account_type: accountType, region });
    }
    setPrinterIp(printerId: string, ip: string) {
        return this.send('printer_set_ip', { printer_id: printerId, ip });
    }
    getPrinterStatus() { return this.send('printer_status'); }
    getPrinterLoginHint() { return this.send('printer_login_hint'); }
    controlPrinterLight(printerId: string, mode: 'on' | 'off' | 'auto') {
        return this.send('printer_light_control', { printer_id: printerId, mode });
    }
    getAmsStatus(printerId: string) { return this.send('ams_status', { printer_id: printerId }); }
    homePrinter(printerId: string, cloudMode?: string) { 
        return this.send('printer_home', { printer_id: printerId, cloud_mode: cloudMode }); 
    }
    setBedTemperature(printerId: string, temp: number, cloudMode?: string) {
        return this.send('set_bed_temperature', { printer_id: printerId, temperature: temp, cloud_mode: cloudMode });
    }
    setNozzleTemperature(printerId: string, temp: number, cloudMode?: string) {
        return this.send('set_nozzle_temperature', { printer_id: printerId, temperature: temp, cloud_mode: cloudMode });
    }
    moveAxis(printerId: string, axis: 'X' | 'Y' | 'Z' | 'E', distance: number, speed?: number, cloudMode?: string) {
        return this.send('move_axis', { printer_id: printerId, axis, distance, speed, cloud_mode: cloudMode });
    }
    setPrintSpeed(printerId: string, speed: number) {
        return this.send('set_print_speed', { printer_id: printerId, speed });
    }
    setFanSpeed(printerId: string, speed: number, fan: 'part' | 'aux' | 'chamber' = 'part') {
        return this.send('set_fan_speed', { printer_id: printerId, fan, speed });
    }
    extrudeFilament(printerId: string, length: number, speed?: number) {
        return this.send('extrude_filament', { printer_id: printerId, length, speed });
    }
    cameraSnapshot(printerId: string) {
        return this.send('camera_snapshot', { printer_id: printerId });
    }
    desktopVisionRun(task: string, params?: Record<string, unknown>) {
        return this.send('desktop_vision_run', { task, ...params });
    }
    desktopVisionCancel(sessionId: string) {
        return this.send('desktop_vision_cancel', { session_id: sessionId });
    }
    ping()        { return this.send('ping'); }

    // ─── Listeners ─────────────────────────────────────────────────

    onMessage(fn: MessageListener): () => void {
        this.messageListeners.add(fn);
        return () => this.messageListeners.delete(fn);
    }

    onStatus(fn: StatusListener): () => void {
        this.statusListeners.add(fn);
        return () => this.statusListeners.delete(fn);
    }

    // ─── Getters ───────────────────────────────────────────────────

    getStatus(): AgentStatus { return this.status; }
    getCapabilities(): AgentCapabilities | null { return this.capabilities; }
    isConnected(): boolean { return this.status === 'connected'; }
}

/** Singleton instance — import and use directly. */
export const ClientAgentBridge = new ClientAgentBridgeClass();
