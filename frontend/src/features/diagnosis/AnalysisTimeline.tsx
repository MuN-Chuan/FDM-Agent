import React from 'react';
import { CircleCheck, Clock, Loader2 } from 'lucide-react';

export interface AnalysisTimelineProps {
    hasImage?: boolean;
    hasPreset?: boolean;
    status?: 'idle' | 'detecting' | 'parsing' | 'analyzing' | 'completed';
}

export const AnalysisTimeline: React.FC<AnalysisTimelineProps> = ({
    hasImage = false,
    hasPreset = false,
    status = 'idle'
}) => {
    // Build steps dynamically based on available inputs
    const steps = [];
    if (hasImage) {
        steps.push({
            id: 'detect',
            label: '缺陷识别',
            current: status === 'detecting',
            done: ['parsing', 'analyzing', 'completed'].includes(status)
        });
    }
    if (hasPreset) {
        steps.push({
            id: 'preset',
            label: '预设解析',
            current: status === 'parsing',
            done: ['analyzing', 'completed'].includes(status)
        });
    }

    // AI Analysis and Completion are always shown if any diagnosis is active
    if (status !== 'idle') {
        steps.push({
            id: 'ai',
            label: 'AI分析',
            current: status === 'analyzing',
            done: status === 'completed'
        });
        steps.push({
            id: 'done',
            label: '完成',
            current: false,
            done: status === 'completed'
        });
    }

    if (steps.length === 0) {
        return <p className="text-xs text-text-light/30 italic">等待开始诊断...</p>;
    }

    return (
        <div className="space-y-3">
            {steps.map((step, idx) => (
                <div key={step.id} className="relative flex items-center gap-3">
                    {/* Vertical Connector */}
                    {idx !== steps.length - 1 && (
                        <div className={`absolute left-[9px] top-5 bottom-[-12px] w-[2px] transition-colors ${step.done ? 'bg-cta' : 'bg-secondary/10'
                            }`} />
                    )}

                    {/* Node Icon */}
                    <div className={`z-10 w-5 h-5 rounded-full flex items-center justify-center transition-all ${step.done ? 'bg-cta text-white' :
                            step.current ? 'bg-cta/20 text-cta ring-4 ring-cta/10' : 'bg-secondary/10 text-text-light/20'
                        }`}>
                        {step.done ? <CircleCheck size={12} strokeWidth={3} /> :
                            step.current ? <Loader2 size={10} className="animate-spin" /> : <Clock size={10} />}
                    </div>

                    {/* Label */}
                    <div className="flex-1 flex items-center justify-between">
                        <span className={`text-xs font-bold transition-colors ${step.current ? 'text-cta' : step.done ? 'text-text-light' : 'text-text-light/30'
                            }`}>
                            {step.label}
                        </span>
                        {step.current && (
                            <span className="flex gap-1">
                                <span className="w-1 h-1 rounded-full bg-cta animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 h-1 rounded-full bg-cta animate-bounce" style={{ animationDelay: '200ms' }} />
                                <span className="w-1 h-1 rounded-full bg-cta animate-bounce" style={{ animationDelay: '400ms' }} />
                            </span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
