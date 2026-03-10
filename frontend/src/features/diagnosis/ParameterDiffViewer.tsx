import React from 'react';
import { ArrowRight, Info, AlertTriangle } from 'lucide-react';

export interface ParameterModification {
    name: string;
    old: string;
    new: string;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
}

interface ParameterDiffViewerProps {
    modifications?: ParameterModification[];
}

export const ParameterDiffViewer: React.FC<ParameterDiffViewerProps> = ({ modifications = [] }) => {
    if (modifications.length === 0) {
        return (
            <div className="p-8 text-center text-text-light/30 border border-dashed border-secondary/10 rounded-xl bg-secondary/5">
                <Info size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">暂无参数修改建议。对于简单的诊断，可能不需要修改预设文件。</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-secondary/10">
            <table className="w-full text-left border-collapse">
                <thead className="bg-secondary/5 text-[10px] font-bold uppercase tracking-widest text-text-light/40">
                    <tr>
                        <th className="px-6 py-4">参数名称</th>
                        <th className="px-6 py-4">更改对比 (Diff)</th>
                        <th className="px-6 py-4">风险等级</th>
                        <th className="px-6 py-4">修改理由</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-secondary/5">
                    {modifications.map((item) => (
                        <tr key={item.name} className="hover:bg-secondary/5 transition-colors group">
                            <td className="px-6 py-4">
                                <code className="text-xs font-mono bg-secondary/5 px-1.5 py-0.5 rounded text-cta">{item.name}</code>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs line-through text-text-light/30">{item.old}</span>
                                    <ArrowRight size={14} className="text-cta" />
                                    <span className="text-xs font-bold text-cta bg-cta/10 px-2 py-0.5 rounded">{item.new}</span>
                                </div>
                                <p className="text-[10px] text-text-light/40 mt-1.5">安全区间: {item.range}</p>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.risk === 'low' ? 'bg-green-500/10 text-green-500' :
                                        item.risk === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                            'bg-red-500/10 text-red-500'
                                    }`}>
                                    {item.risk === 'low' ? <Info size={12} /> : <AlertTriangle size={12} />}
                                    {item.risk === 'low' ? '低风险' : item.risk === 'medium' ? '中风险' : '高风险'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-xs text-text-light/60 max-w-[300px] leading-relaxed">
                                    {item.reason}
                                </p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
