/**
 * ClientAgentIndicator.tsx — Agent 连接状态指示器
 *
 * 显示一个小的状态标签，用于在 UI 中展示本地 Agent 是否已连接。
 * 点击 "连接" 可触发 Agent 连接，点击已连接状态可断开。
 */

import React from 'react';
import { Cpu, Wifi, WifiOff, Loader2 } from 'lucide-react';
import type { AgentStatus } from './ClientAgentBridge';

interface ClientAgentIndicatorProps {
    status: AgentStatus;
    printerHost?: string | null;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

const statusConfig: Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> = {
    disconnected: {
        label: '未连接',
        color: 'text-text-light/40 dark:text-text-dark/40',
        icon: <WifiOff size={13} />,
    },
    connecting: {
        label: '连接中...',
        color: 'text-amber-500',
        icon: <Loader2 size={13} className="animate-spin" />,
    },
    connected: {
        label: 'Agent已连接',
        color: 'text-emerald-500',
        icon: <Wifi size={13} />,
    },
    error: {
        label: '连接失败',
        color: 'text-rose-500',
        icon: <WifiOff size={13} />,
    },
};

export const ClientAgentIndicator: React.FC<ClientAgentIndicatorProps> = ({
    status,
    printerHost,
    onConnect,
    onDisconnect,
}) => {
    const cfg = statusConfig[status];

    const handleClick = () => {
        if (status === 'connected') {
            onDisconnect?.();
        } else if (status === 'disconnected' || status === 'error') {
            onConnect?.();
        }
    };

    return (
        <button
            onClick={handleClick}
            title={
                status === 'connected'
                    ? `Client Agent 已连接\n打印机: ${printerHost ?? '未配置'}\n点击断开`
                    : '点击连接本地 Client Agent (ws://localhost:7890)'
            }
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all
                border border-current/20 hover:bg-current/5 ${cfg.color}`}
        >
            <Cpu size={12} className="opacity-70" />
            {cfg.icon}
            <span>{cfg.label}</span>
        </button>
    );
};
