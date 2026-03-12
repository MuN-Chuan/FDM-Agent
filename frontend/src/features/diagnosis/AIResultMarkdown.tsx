import React from 'react';
import { Sparkles, CircleCheck, Loader2 } from 'lucide-react';

interface AIResultMarkdownProps {
    content?: string;
    isLoading?: boolean;
    modelName?: string;
}

export const AIResultMarkdown: React.FC<AIResultMarkdownProps> = ({ content, isLoading, modelName }) => {
    // Show initial loading state ONLY when there's no content yet
    if (isLoading && !content) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-cta/40 animate-pulse">
                <Loader2 size={32} className="animate-spin mb-4" />
                <p className="text-sm font-bold tracking-widest uppercase">AI 正在深度分析中...</p>
            </div>
        );
    }

    if (!content) {
        return (
            <div className="p-8 text-center text-text-light/30 border border-dashed border-secondary/10 rounded-xl bg-secondary/5">
                <Sparkles size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">等待诊断开始。点击"深度 AI 诊断"以生成分析结果。</p>
            </div>
        );
    }

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="flex items-center gap-2 mb-4 text-cta">
                <Sparkles size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">
                    {modelName ? `${modelName} 模型输出` : 'AI 诊断模型输出'}
                </span>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-text-light/80 dark:text-text-dark/80 whitespace-pre-wrap">
                {content.split('\n\n').map((block, idx) => {
                    if (block.startsWith('### ')) {
                        return <h3 key={idx} className="text-lg font-bold text-cta mt-6 mb-2">{block.replace('### ', '')}</h3>;
                    }
                    if (block.startsWith('#### ')) {
                        return (
                            <h4 key={idx} className="font-bold text-text-light dark:text-text-dark flex items-center gap-2 mt-4 mb-2">
                                <CircleCheck size={14} className="text-cta" />
                                {block.replace('#### ', '')}
                            </h4>
                        );
                    }
                    if (block.startsWith('- ')) {
                        return (
                            <ul key={idx} className="list-disc pl-5 space-y-1">
                                {block.split('\n').map((item, i) => (
                                    <li key={i}>{item.replace('- ', '')}</li>
                                ))}
                            </ul>
                        );
                    }
                    return <p key={idx} className="mt-2 text-text-light/70">{block}</p>;
                })}
            </div>

            {/* Show inline streaming indicator while receiving */}
            {isLoading && (
                <div className="flex items-center gap-2 mt-4 text-cta/50 text-xs">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="animate-pulse">AI 正在生成中...</span>
                </div>
            )}
        </div>
    );
};
