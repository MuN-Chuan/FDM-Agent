import React, { useState } from 'react';
import { Sparkles, CircleCheck, Loader2, Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface AIResultMarkdownProps {
    content?: string;
    thought?: string;
    isLoading?: boolean;
    modelName?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cache_tokens?: number };
}

export const AIResultMarkdown: React.FC<AIResultMarkdownProps> = ({ content, thought, isLoading, modelName, usage }) => {
    const [isThoughtExpanded, setIsThoughtExpanded] = useState(true);

    // Show initial loading state ONLY when there's no content or thought yet
    if (isLoading && !content && !thought) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-cta/40 animate-pulse">
                <Loader2 size={32} className="animate-spin mb-4" />
                <p className="text-sm font-bold tracking-widest uppercase">AI 正在深度分析中...</p>
            </div>
        );
    }

    if (!content && !thought) {
        return (
            <div className="p-8 text-center text-text-light/30 border border-dashed border-secondary/10 rounded-xl bg-secondary/5">
                <Sparkles size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">等待诊断开始。点击"深度 AI 诊断"以生成分析结果。</p>
            </div>
        );
    }

    return (
        <div className="prose prose-sm dark:prose-invert max-w-none relative">
            {/* --- Thinking Process Toggle (Persistent Sticky) --- */}
            {thought && (
                <div className="sticky top-0 z-20 -mx-2 px-2 bg-background/95 dark:bg-[#1a1c1e]/95 backdrop-blur-md pb-4 pt-1">
                    <button 
                        onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-cta/5 border border-cta/20 hover:bg-cta/10 transition-all group shadow-sm rounded-xl"
                    >
                        <div className="flex items-center gap-2 text-text-light/60 group-hover:text-cta transition-colors">
                            <Brain size={14} className={`text-cta ${isLoading && !content ? 'animate-pulse' : ''}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest">思考过程 (Reasoning)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isLoading && !content && <Loader2 size={12} className="animate-spin text-cta/40" />}
                            {isThoughtExpanded ? <ChevronUp size={14} className="text-text-light/30" /> : <ChevronDown size={14} className="text-text-light/30" />}
                        </div>
                    </button>
                </div>
            )}

            <div className="space-y-6">
                {/* --- Thinking Process Content --- */}
                {thought && isThoughtExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="text-[13px] leading-relaxed text-text-light/40 italic font-body whitespace-pre-wrap border-l-2 border-cta/10 pl-4 py-1">
                            {thought}
                            {isLoading && !content && (
                                <span className="inline-block ml-1 w-1.5 h-3 bg-cta/30 animate-pulse" />
                            )}
                        </div>
                    </div>
                )}

                {/* --- Main Content --- */}
                {content && (
                    <div className="animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 mb-4 text-cta">
                            <Sparkles size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">
                                {modelName ? `${modelName} 模型建议` : 'AI 诊断模型输出'}
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
                                return <p key={idx} className="mt-2 text-text-light/70 font-body">{block}</p>;
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Show inline streaming indicator while receiving main content */}
            {isLoading && content && (
                <div className="flex items-center gap-2 mt-6 p-3 rounded-lg bg-cta/5 text-cta/50 text-xs border border-cta/10">
                    <Loader2 size={12} className="animate-spin" />
                    <span className="animate-pulse font-bold tracking-tight">AI 正在生成深度建议...</span>
                </div>
            )}

            {/* --- Token Usage Footer --- */}
            {!isLoading && usage && (
                <div className="mt-8 flex items-center flex-wrap gap-4 text-[10px] text-text-light/30 dark:text-text-dark/30 font-mono border-t border-secondary/5 pt-4">
                    <div className="flex items-center gap-1.5">
                        <span className="opacity-60 uppercase tracking-tighter">Prompt:</span>
                        <span className="font-bold text-text-light/50">{usage.prompt_tokens}</span>
                    </div>
                    
                    {usage.cache_tokens !== undefined && usage.cache_tokens > 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="opacity-60 uppercase tracking-tighter text-emerald-500/50">Cached:</span>
                            <span className="font-bold text-emerald-500/60">{usage.cache_tokens}</span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        <span className="opacity-60 uppercase tracking-tighter">Comp:</span>
                        <span className="font-bold text-text-light/50">{usage.completion_tokens}</span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="opacity-60 uppercase tracking-tighter">Total:</span>
                        <span className="font-bold text-cta/60">{usage.total_tokens}</span>
                    </div>
                </div>
            )}
        </div>
    );
};
