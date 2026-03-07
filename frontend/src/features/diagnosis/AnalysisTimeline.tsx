import React from 'react';
import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';

const steps = [
    { id: 1, label: '缺陷识别', status: 'completed', time: '1.2s' },
    { id: 2, label: '预设参数解析', status: 'completed', time: '0.4s' },
    { id: 3, label: '匹配参数知识图谱', status: 'loading', time: '...' },
    { id: 4, label: '生成优化建议', status: 'pending', time: '-' },
];

export const AnalysisTimeline: React.FC = () => {
    return (
        <div className="space-y-6">
            {steps.map((step, idx) => (
                <div key={step.id} className="relative flex items-center gap-4">
                    {idx !== steps.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-24px] w-[2px] bg-secondary/10" />
                    )}

                    <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center ${step.status === 'completed' ? 'bg-cta text-white' :
                            step.status === 'loading' ? 'bg-cta/20 text-cta' : 'bg-secondary/10 text-text-light/20'
                        }`}>
                        {step.status === 'completed' && <CheckCircle2 size={14} />}
                        {step.status === 'loading' && <Loader2 size={14} className="animate-spin" />}
                        {step.status === 'pending' && <Clock size={14} />}
                    </div>

                    <div className="flex-1 flex items-center justify-between">
                        <span className={`text-sm font-bold ${step.status === 'pending' ? 'text-text-light/40' : 'text-text-light'}`}>
                            {step.label}
                        </span>
                        <span className="text-[10px] font-mono text-text-light/30">{step.time}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
