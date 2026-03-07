import React from 'react';
import { Sparkles, FileText, CheckCircle } from 'lucide-react';

export const AIResultMarkdown: React.FC = () => {
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="flex items-center gap-2 mb-4 text-cta">
                <Sparkles size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">DeepSeek R1 模型输出</span>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-text-light/80 dark:text-text-dark/80">
                <section>
                    <h4 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                        <CheckCircle size={14} className="text-cta" />
                        1. 缺陷根本原因分析
                    </h4>
                    <p className="mt-2">
                        检测到明显的“拉丝”现象，这通常是由两个主要因素共同驱动的：**喷嘴在移动时熔体产生的多余压力**（溢料）以及**回抽设置不足**以迅速断开熔体流。此外，当前喷嘴温度略高于材料的最佳区间，增加了材料的流动性。
                    </p>
                </section>

                <section>
                    <h4 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                        <CheckCircle size={14} className="text-cta" />
                        2. 优化方案逻辑
                    </h4>
                    <ul className="list-disc pl-4 mt-2 space-y-1">
                        <li><strong>降低流量：</strong> 将流量降至 95% 以减缓料仓压力，防止挤出机在非打印行程中由于残余压力而发生自然漏料。</li>
                        <li><strong>强化回抽：</strong> 增加回抽距离到 1.2mm 并微调回抽速度，目的是在空载行程开始时强制形成负压。</li>
                        <li><strong>动态加减速：</strong> 降低外墙打印速度，减少拐角处的惯性堆积。</li>
                    </ul>
                </section>

                <div className="p-3 bg-secondary/5 rounded-lg border-l-4 border-cta italic text-xs">
                    “通过应用上述参数，预计可减少约 80% 的模型表面拉丝，同时不影响结构强度。”
                </div>
            </div>
        </div>
    );
};
