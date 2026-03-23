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
    type: 'hello' | 'status' | 'progress' | 'done' | 'error' | 'pong';
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
    capabilities: string[];
    version: string;
}

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
    printStart(fileName: string, jobId?: string) {
        return this.send('print_start', { file_name: fileName, job_id: jobId });
    }

    printPause()  { return this.send('print_pause'); }
    printResume() { return this.send('print_resume'); }
    printStop()   { return this.send('print_stop'); }
    getPrinterStatus() { return this.send('printer_status'); }
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
