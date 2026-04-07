import React, { useMemo } from 'react';
import { Bot, MonitorCog, OctagonX, ScanSearch } from 'lucide-react';

import { useClientAgent } from '../slicer/useClientAgent';

interface DesktopVisionTaskPanelProps {
    active: boolean;
}

type DesktopVisionPayload = {
    session_id?: string;
    task?: string;
    state?: string;
    step?: number;
    target_app?: string;
    action?: string;
    reason?: string;
    verification?: string;
};

export const DesktopVisionTaskPanel: React.FC<DesktopVisionTaskPanelProps> = ({ active }) => {
    const { bridge, lastMessage, agentStatus } = useClientAgent();

    const desktopVisionState = useMemo(() => {
        if (!lastMessage) return null;
        if (lastMessage.cmd !== 'desktop_vision_run' && lastMessage.cmd !== 'desktop_vision_cancel') {
            return null;
        }

        const payload = (typeof lastMessage.data === 'object' && lastMessage.data !== null
            ? lastMessage.data
            : {}) as DesktopVisionPayload;

        return {
            type: lastMessage.type,
            message: lastMessage.message || payload.state || 'Desktop Vision update',
            sessionId: payload.session_id || null,
            task: payload.task || null,
            state: payload.state || null,
            step: payload.step || null,
            action: payload.action || null,
            reason: payload.reason || null,
            verification: payload.verification || null,
        };
    }, [lastMessage]);

    const canCancel = Boolean(desktopVisionState?.sessionId && desktopVisionState?.type === 'progress');
    const cancelSessionId = canCancel ? desktopVisionState?.sessionId ?? null : null;

    return (
        <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <MonitorCog size={16} className="text-sky-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900">Desktop Vision</h4>
                </div>
                <div className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    active ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-500'
                }`}>
                    {active ? 'Enabled' : 'Inactive'}
                </div>
            </div>

            <p className="mt-2 text-[12px] text-sky-900/80">
                首阶段只开放回中任务。执行链路为截图、规划、点击、复验，多步过程会在这里显示。
            </p>

            <div className="mt-4 grid gap-2">
                <div className="flex items-center gap-2 text-[12px] text-slate-700">
                    <Bot size={14} className="text-sky-700" />
                    <span>Agent: {agentStatus}</span>
                </div>

                {desktopVisionState ? (
                    <>
                        <div className="flex items-center gap-2 text-[12px] text-slate-700">
                            <ScanSearch size={14} className="text-sky-700" />
                            <span>{desktopVisionState.message}</span>
                        </div>
                        {desktopVisionState.step ? (
                            <div className="text-[11px] text-slate-600">
                                Step {desktopVisionState.step}
                                {desktopVisionState.state ? ` · ${desktopVisionState.state}` : ''}
                                {desktopVisionState.task ? ` · ${desktopVisionState.task}` : ''}
                            </div>
                        ) : null}
                        {desktopVisionState.action ? (
                            <div className="text-[11px] text-slate-600">
                                Action: {desktopVisionState.action}
                                {desktopVisionState.reason ? ` · ${desktopVisionState.reason}` : ''}
                            </div>
                        ) : null}
                        {desktopVisionState.verification ? (
                            <div className="text-[11px] text-slate-600">
                                Verification: {desktopVisionState.verification}
                            </div>
                        ) : null}
                        {desktopVisionState.sessionId ? (
                            <div className="text-[11px] text-slate-500">
                                Session: {desktopVisionState.sessionId}
                            </div>
                        ) : null}
                    </>
                ) : (
                    <div className="text-[12px] text-slate-600">
                        暂无任务状态。启用 Desktop Vision 后，这里会显示最近一次会话进度。
                    </div>
                )}
            </div>

            {cancelSessionId ? (
                <button
                    type="button"
                    onClick={() => bridge.desktopVisionCancel(cancelSessionId)}
                    className="mt-4 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-white px-3 py-2 text-[12px] font-bold text-rose-700 transition hover:bg-rose-50"
                >
                    <OctagonX size={14} />
                    Cancel Session
                </button>
            ) : null}
        </div>
    );
};
