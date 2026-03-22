/**
 * useClientAgent.ts — React hook for Client Agent bridge
 *
 * 提供：
 *   - agentStatus: 当前连接状态
 *   - capabilities: Agent 上报的能力
 *   - lastMessage: 最近一条来自 Agent 的消息
 *   - connect / disconnect
 *   - bridge: ClientAgentBridge singleton 引用（用于发送命令）
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientAgentBridge } from './ClientAgentBridge';
import type { AgentCapabilities, AgentMessage, AgentStatus } from './ClientAgentBridge';

interface UseClientAgentReturn {
    agentStatus: AgentStatus;
    capabilities: AgentCapabilities | null;
    lastMessage: AgentMessage | null;
    connect: () => void;
    disconnect: () => void;
    bridge: typeof ClientAgentBridge;
}

export function useClientAgent(): UseClientAgentReturn {
    const [agentStatus, setAgentStatus] = useState<AgentStatus>(ClientAgentBridge.getStatus());
    const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(ClientAgentBridge.getCapabilities());
    const [lastMessage, setLastMessage] = useState<AgentMessage | null>(null);
    const cleanupRef = useRef<(() => void)[]>([]);

    useEffect(() => {
        const unsubStatus = ClientAgentBridge.onStatus((status) => {
            setAgentStatus(status);
            // Refresh capabilities after reconnect
            setCapabilities(ClientAgentBridge.getCapabilities());
        });

        const unsubMessage = ClientAgentBridge.onMessage((msg) => {
            setLastMessage(msg);
            // Keep capabilities in sync if agent sends hello again
            if (msg.type === 'hello') {
                setCapabilities(ClientAgentBridge.getCapabilities());
            }
        });

        cleanupRef.current = [unsubStatus, unsubMessage];
        return () => {
            cleanupRef.current.forEach((fn) => fn());
        };
    }, []);

    const connect = useCallback(() => ClientAgentBridge.connect(), []);
    const disconnect = useCallback(() => ClientAgentBridge.disconnect(), []);

    return {
        agentStatus,
        capabilities,
        lastMessage,
        connect,
        disconnect,
        bridge: ClientAgentBridge,
    };
}
