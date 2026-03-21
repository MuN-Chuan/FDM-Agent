import React, { useEffect, useRef, useState } from 'react';
import {
    Brain,
    ChevronDown,
    ChevronUp,
    Download,
    PencilLine,
    RotateCcw,
    Sparkles,
    Wrench,
} from 'lucide-react';

import type { Modification } from '../../api/api';
import { ParameterDiffViewer } from '../../features/diagnosis/ParameterDiffViewer';
import { useI18n } from '../../i18n/I18nProvider';
import type { ChatUIMessage } from './types';

interface ChatMessageListProps {
    messages: ChatUIMessage[];
    hasPresetBundle: boolean;
    onDownloadPresets: (mods?: Modification[]) => void | Promise<void>;
    onEditMessage: (messageId: string, content: string) => void | Promise<void>;
    onRegenerateMessage: (messageId: string) => void | Promise<void>;
    onRequestModifications: (messageId: string) => void | Promise<void>;
    bottomRef: React.RefObject<HTMLDivElement | null>;
}

function shouldShowModificationShortcut(content: string) {
    return /(\u53c2\u6570|\u4f18\u5316|\u5efa\u8bae|\u5207\u7247|parameter|optimi|suggest|slice)/i.test(content);
}

function renderAssistantContent(content: string) {
    return content.split('\n\n').map((block, index) => {
        const normalizedBlock = block.trim();

        if (!normalizedBlock) {
            return null;
        }

        if (normalizedBlock.startsWith('### ')) {
            return (
                <h3 key={index} className="mt-6 mb-3 font-heading text-[1.15rem] font-bold tracking-[0.01em] text-cta">
                    {normalizedBlock.replace('### ', '')}
                </h3>
            );
        }

        if (normalizedBlock.startsWith('#### ')) {
            return (
                <h4 key={index} className="mt-5 mb-2 font-heading text-[1rem] font-semibold tracking-[0.01em] text-slate-700 dark:text-slate-200">
                    {normalizedBlock.replace('#### ', '')}
                </h4>
            );
        }

        if (normalizedBlock.startsWith('- ') || normalizedBlock.startsWith('* ')) {
            return (
                <ul key={index} className="my-3 space-y-2 pl-6 text-[15px] leading-8 tracking-[0.01em] marker:text-cta">
                    {normalizedBlock.split('\n').map((line, lineIndex) => (
                        <li key={lineIndex}>{line.replace(/^[-*]\s/, '')}</li>
                    ))}
                </ul>
            );
        }

        return (
            <p key={index} className="my-3 text-[15px] leading-8 tracking-[0.01em] text-slate-700 dark:text-slate-200/90">
                {normalizedBlock}
            </p>
        );
    });
}

function AssistantMessage({
    message,
    hasPresetBundle,
    isLast,
    onDownloadPresets,
    onRegenerateMessage,
    onRequestModifications,
}: {
    message: ChatUIMessage;
    hasPresetBundle: boolean;
    isLast: boolean;
    onDownloadPresets: (mods?: Modification[]) => void | Promise<void>;
    onRegenerateMessage: (messageId: string) => void | Promise<void>;
    onRequestModifications: (messageId: string) => void | Promise<void>;
}) {
    const { t } = useI18n();
    const [thoughtOpen, setThoughtOpen] = useState(true);
    const [modificationsOpen, setModificationsOpen] = useState(true);
    const hasAutoCollapsedRef = useRef(false);

    useEffect(() => {
        if (message.content && !hasAutoCollapsedRef.current) {
            setThoughtOpen(false);
            hasAutoCollapsedRef.current = true;
        }
    }, [message.content]);

    return (
        <div className="group/msg flex items-start gap-4">
            <div className="group/avatar relative">
                {message.isStreaming && (
                    <div className="absolute inset-[-3px] z-0 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
                )}
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-cta/20 bg-white shadow-sm dark:bg-[#1a1a1a]">
                    <Sparkles size={16} className={`text-cta ${message.isStreaming ? 'animate-pulse' : ''}`} />
                </div>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
                {message.thought && (
                    <div className="overflow-hidden rounded-xl border border-secondary/10 bg-secondary/5 shadow-sm">
                        <button
                            onClick={() => setThoughtOpen((value) => !value)}
                            className="group flex w-full items-center justify-between bg-secondary/10 px-4 py-2 transition-colors hover:bg-secondary/20"
                        >
                            <div className="flex items-center gap-2 text-text-light/50 transition-colors group-hover:text-cta">
                                <Brain size={14} className="text-cta" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t('chat.thought')}</span>
                            </div>
                            {thoughtOpen ? (
                                <ChevronUp size={14} className="text-text-light/30" />
                            ) : (
                                <ChevronDown size={14} className="text-text-light/30" />
                            )}
                        </button>
                        {thoughtOpen && (
                            <div className="my-2 ml-4 mr-4 whitespace-pre-wrap border-l-2 border-cta/20 px-4 py-3 text-[13px] italic leading-relaxed text-text-light/50 dark:text-text-dark/50">
                                {message.thought}
                                {message.isStreaming && !message.content && (
                                    <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-cta/30" />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!!message.content && (
                    <div className="max-w-none font-body text-[15px] leading-8 tracking-[0.01em] text-slate-700 dark:text-slate-200/90">
                        {renderAssistantContent(message.content)}
                        {message.isStreaming && (
                            <span className="ml-1 inline-block h-4 w-1.5 animate-pulse align-middle bg-cta/40" />
                        )}

                        {!message.isStreaming && message.usage && (
                            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-secondary/5 pt-2 font-mono text-[10px] text-text-light/30 dark:text-text-dark/30">
                                <div className="flex items-center gap-1">
                                    <span className="opacity-60">{t('chat.tokens')}:</span>
                                    <span className="font-bold text-text-light/50 dark:text-text-dark/50">
                                        {message.usage.prompt_tokens}
                                    </span>
                                    <span className="opacity-40">-&gt;</span>
                                    <span className="font-bold text-text-light/50 dark:text-text-dark/50">
                                        {message.usage.completion_tokens}
                                    </span>
                                </div>
                                {message.usage.cache_tokens !== undefined && message.usage.cache_tokens > 0 && (
                                    <>
                                        <div className="h-1 w-1 rounded-full bg-secondary/10" />
                                        <div className="flex items-center gap-1">
                                            <span className="text-emerald-500/50 opacity-60">{t('chat.cached')}:</span>
                                            <span className="font-bold text-emerald-500/60">{message.usage.cache_tokens}</span>
                                        </div>
                                    </>
                                )}
                                <div className="h-1 w-1 rounded-full bg-secondary/10" />
                                <div className="flex items-center gap-1">
                                    <span className="opacity-60">{t('chat.total')}:</span>
                                    <span className="font-bold text-cta/60">{message.usage.total_tokens}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {message.modifications && message.modifications.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <div className="overflow-hidden rounded-2xl border border-cta/25 bg-white shadow-[0_14px_30px_rgba(34,197,94,0.08)] dark:border-cta/25 dark:bg-[#132419]">
                            <button
                                onClick={() => setModificationsOpen((value) => !value)}
                                className="flex w-full items-center justify-between border-b border-cta/15 bg-cta/12 px-4 py-3 transition-colors hover:bg-cta/16 dark:border-cta/20 dark:bg-cta/14 dark:hover:bg-cta/18"
                            >
                                <div className="flex items-center gap-2">
                                    <Wrench size={14} className="text-cta" />
                                    <span className="text-sm font-bold text-cta">{t('chat.modifications')}</span>
                                </div>
                                {modificationsOpen ? (
                                    <ChevronUp size={14} className="text-cta/70" />
                                ) : (
                                    <ChevronDown size={14} className="text-cta/70" />
                                )}
                            </button>
                            {modificationsOpen && (
                                <div className="p-4">
                                    <ParameterDiffViewer modifications={message.modifications} />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-start">
                            <button
                                onClick={() => void onDownloadPresets(message.modifications)}
                                disabled={!hasPresetBundle}
                                className="inline-flex min-w-[220px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cta/20 transition-all hover:-translate-y-0.5 hover:bg-[#1fb457] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:hover:bg-[#1fb457]"
                            >
                                <Download size={14} />
                                {t('chat.downloadPreset')}
                            </button>
                        </div>
                    </div>
                )}

                {!message.isStreaming && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {hasPresetBundle &&
                            message.id !== 'welcome' &&
                            !message.modifications &&
                            shouldShowModificationShortcut(message.content) && (
                                <button
                                    onClick={() => void onRequestModifications(message.id)}
                                    className="flex items-center gap-2 rounded-lg border border-cta/20 bg-cta/5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-cta shadow-sm transition-all hover:bg-cta/10"
                                >
                                    <Wrench size={13} />
                                    {t('chat.requestMods')}
                                </button>
                            )}

                        {isLast && message.id !== 'welcome' && (
                            <button
                                onClick={() => void onRegenerateMessage(message.id)}
                                className="group flex items-center gap-1.5 rounded-lg border border-secondary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text-light/30 transition-all hover:border-cta/20 hover:bg-cta/5 hover:text-cta"
                            >
                                <RotateCcw size={13} className="text-text-light/30 group-hover:text-cta" />
                                {t('chat.regenerate')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function UserMessage({
    message,
    onEditMessage,
}: {
    message: ChatUIMessage;
    onEditMessage: (messageId: string, content: string) => void | Promise<void>;
}) {
    const { t } = useI18n();
    const [isEditing, setIsEditing] = useState(false);
    const [tempEditValue, setTempEditValue] = useState(message.content);

    useEffect(() => {
        setTempEditValue(message.content);
    }, [message.content]);

    return (
        <div className="group/msg flex flex-col items-end gap-2">
            <div className="flex w-full justify-end gap-3">
                <div className="flex max-w-[85%] flex-col items-end space-y-2">
                    {(message.imagePreviewUrl || message.presetName || message.attachedFiles?.length) && (
                        <div className="mb-1 flex w-full flex-wrap justify-end gap-2">
                            {message.imagePreviewUrl && (
                                <div className="max-w-sm overflow-hidden rounded-xl border border-secondary/20 shadow-sm">
                                    <img
                                        src={message.imagePreviewUrl}
                                        alt="uploaded"
                                        className="max-h-60 w-full object-contain bg-secondary/5"
                                    />
                                </div>
                            )}
                            {message.presetName && (
                                <div className="rounded-xl border border-cta/20 bg-cta/10 px-3 py-2 text-xs text-cta shadow-sm">
                                    {message.presetName}
                                </div>
                            )}
                            {message.attachedFiles?.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="rounded-xl border border-secondary/20 bg-secondary/10 px-3 py-2 text-xs text-text-light shadow-sm dark:text-text-dark"
                                >
                                    {file.name}
                                </div>
                            ))}
                        </div>
                    )}

                    {!isEditing ? (
                        <div className="relative max-w-full whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-cta px-5 py-3 text-sm leading-relaxed text-white shadow-md">
                            {message.content}
                        </div>
                    ) : (
                        <div className="w-full min-w-[300px] rounded-2xl border border-cta bg-white p-3 shadow-xl dark:bg-secondary/20">
                            <textarea
                                className="min-h-[80px] w-full resize-none bg-transparent text-sm text-text-light outline-none dark:text-text-dark"
                                value={tempEditValue}
                                onChange={(event) => setTempEditValue(event.target.value)}
                                autoFocus
                            />
                            <div className="mt-2 flex justify-end gap-2">
                                <button
                                    onClick={() => {
                                        setTempEditValue(message.content);
                                        setIsEditing(false);
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold text-text-light/40 transition-colors hover:text-text-light"
                                >
                                    {t('chat.cancel')}
                                </button>
                                <button
                                    onClick={() => {
                                        void onEditMessage(message.id, tempEditValue);
                                        setIsEditing(false);
                                    }}
                                    className="rounded-lg bg-cta px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-cta"
                                >
                                    {t('chat.retry')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && (
                <div className="mr-2 flex gap-2 opacity-0 transition-opacity group-hover/msg:opacity-100">
                    <button
                        onClick={() => setIsEditing(true)}
                        className="rounded-lg p-1.5 text-text-light/30 transition-all hover:bg-cta/5 hover:text-cta"
                        title={t('chat.edit')}
                    >
                        <PencilLine size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
    messages,
    hasPresetBundle,
    onDownloadPresets,
    onEditMessage,
    onRegenerateMessage,
    onRequestModifications,
    bottomRef,
}) => (
    <div className="custom-scrollbar relative flex-1 overflow-y-auto pb-[40vh] pt-8">
        <div className="mx-auto w-full max-w-4xl space-y-8 px-4 sm:px-6">
            {messages.map((message, index) =>
                message.role === 'user' ? (
                    <UserMessage key={message.id} message={message} onEditMessage={onEditMessage} />
                ) : (
                    <AssistantMessage
                        key={message.id}
                        message={message}
                        hasPresetBundle={hasPresetBundle}
                        isLast={index === messages.length - 1}
                        onDownloadPresets={onDownloadPresets}
                        onRegenerateMessage={onRegenerateMessage}
                        onRequestModifications={onRequestModifications}
                    />
                ),
            )}
            <div ref={bottomRef} />
        </div>
    </div>
);
