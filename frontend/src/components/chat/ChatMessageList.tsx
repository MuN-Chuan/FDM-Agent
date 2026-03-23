import React, { useEffect, useRef, useState } from 'react';
import {
    Brain,
    ChevronDown,
    ChevronUp,
    Download,
    FileBox,
    ImagePlus,
    PencilLine,
    RotateCcw,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    Wrench,
    X,
} from 'lucide-react';

import type { FeedbackImageAsset, Modification, ThreeMFParseResult } from '../../api/api';
import { ParameterDiffViewer } from '../../features/diagnosis/ParameterDiffViewer';
import { useI18n } from '../../i18n/I18nProvider';
import type { ChatUIMessage } from './types';

interface ChatMessageListProps {
    messages: ChatUIMessage[];
    hasPresetBundle: boolean;
    onDownloadPresets: (mods?: Modification[]) => void | Promise<void>;
    onGenerate3MF: (mods?: Modification[], existingResult?: ThreeMFParseResult) => void | Promise<void>;
    onEditMessage: (messageId: string, content: string) => void | Promise<void>;
    onRegenerateMessage: (messageId: string) => void | Promise<void>;
    onRequestModifications: (messageId: string) => void | Promise<void>;
    onSubmitFeedback: (
        messageId: string,
        payload: { rating: 'up' | 'down'; text?: string; images?: FeedbackImageAsset[] },
    ) => void | Promise<void>;
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

function readImageAsBase64(file: File): Promise<FeedbackImageAsset> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            resolve({
                name: file.name,
                base64: dataUrl.split(',')[1] || '',
                preview_url: dataUrl,
            });
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function AssistantMessage({
    message,
    hasPresetBundle,
    isLast,
    onDownloadPresets,
    onGenerate3MF,
    existingSlicerResult,
    onRegenerateMessage,
    onRequestModifications,
    onSubmitFeedback,
}: {
    message: ChatUIMessage;
    hasPresetBundle: boolean;
    isLast: boolean;
    onDownloadPresets: (mods?: Modification[]) => void | Promise<void>;
    onGenerate3MF: (mods?: Modification[], existingResult?: ThreeMFParseResult) => void | Promise<void>;
    onRegenerateMessage: (messageId: string) => void | Promise<void>;
    onRequestModifications: (messageId: string) => void | Promise<void>;
    existingSlicerResult?: ThreeMFParseResult;
    onSubmitFeedback: (
        messageId: string,
        payload: { rating: 'up' | 'down'; text?: string; images?: FeedbackImageAsset[] },
    ) => void | Promise<void>;
}) {
    const { t } = useI18n();
    const [thoughtOpen, setThoughtOpen] = useState(true);
    const [modificationsOpen, setModificationsOpen] = useState(true);
    const [feedbackText, setFeedbackText] = useState(message.feedback?.text ?? '');
    const [feedbackImages, setFeedbackImages] = useState<FeedbackImageAsset[]>(message.feedback?.images ?? []);
    const [feedbackFormOpen, setFeedbackFormOpen] = useState(message.feedback?.rating === 'down');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [feedbackError, setFeedbackError] = useState('');
    const hasAutoCollapsedRef = useRef(false);
    const feedbackFileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (message.content && !hasAutoCollapsedRef.current) {
            setThoughtOpen(false);
            hasAutoCollapsedRef.current = true;
        }
    }, [message.content]);

    useEffect(() => {
        setFeedbackText(message.feedback?.text ?? '');
        setFeedbackImages(message.feedback?.images ?? []);
        setFeedbackFormOpen(message.feedback?.rating === 'down');
    }, [message.feedback]);

    const handlePositiveFeedback = async () => {
        if (feedbackSubmitting || message.feedback?.rating === 'up') {
            return;
        }

        try {
            setFeedbackSubmitting(true);
            setFeedbackError('');
            await onSubmitFeedback(message.id, { rating: 'up' });
        } catch (error) {
            setFeedbackError(error instanceof Error ? error.message : t('chat.feedbackSubmitError'));
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    const handleNegativeFeedbackSubmit = async () => {
        if (feedbackSubmitting) {
            return;
        }

        try {
            setFeedbackSubmitting(true);
            setFeedbackError('');
            await onSubmitFeedback(message.id, {
                rating: 'down',
                text: feedbackText,
                images: feedbackImages,
            });
        } catch (error) {
            setFeedbackError(error instanceof Error ? error.message : t('chat.feedbackSubmitError'));
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    const handleFeedbackImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) {
            return;
        }

        try {
            const nextImages = await Promise.all(files.map((file) => readImageAsBase64(file)));
            setFeedbackImages((current) => [...current, ...nextImages]);
            setFeedbackError('');
        } catch {
            setFeedbackError(t('chat.feedbackImageError'));
        } finally {
            event.target.value = '';
        }
    };

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

                        <div className="flex flex-wrap justify-start gap-3">
                            <button
                                onClick={() => void onDownloadPresets(message.modifications)}
                                disabled={!hasPresetBundle}
                                className="inline-flex min-w-[220px] cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-cta/20 transition-all hover:-translate-y-0.5 hover:bg-[#1fb457] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 dark:hover:bg-[#1fb457]"
                            >
                                <Download size={14} />
                                {t('chat.downloadPreset')}
                            </button>
                            <button
                                onClick={() => void onGenerate3MF(message.modifications, existingSlicerResult)}
                                className="inline-flex min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-cta bg-white px-5 py-2.5 text-sm font-bold text-cta shadow-md shadow-cta/10 transition-all hover:-translate-y-0.5 hover:bg-cta/5 dark:bg-transparent dark:hover:bg-cta/10"
                            >
                                <FileBox size={14} />
                                生成3MF文件
                            </button>
                        </div>
                    </div>
                )}

                {!message.isStreaming && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        {message.id !== 'welcome' && (
                            <>
                                <button
                                    onClick={() => void handlePositiveFeedback()}
                                    disabled={feedbackSubmitting || !!message.feedback}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                        message.feedback?.rating === 'up'
                                            ? 'border-cta/30 bg-cta/10 text-cta'
                                            : 'border-secondary/10 text-text-light/30 hover:border-cta/20 hover:bg-cta/5 hover:text-cta'
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                    <ThumbsUp size={13} />
                                    {t('chat.feedbackUp')}
                                </button>
                                <button
                                    onClick={() => {
                                        if (!message.feedback) {
                                            setFeedbackFormOpen((value) => !value);
                                        }
                                    }}
                                    disabled={feedbackSubmitting || message.feedback?.rating === 'up'}
                                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all ${
                                        message.feedback?.rating === 'down' || feedbackFormOpen
                                            ? 'border-rose-300 bg-rose-50 text-rose-600'
                                            : 'border-secondary/10 text-text-light/30 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600'
                                    } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                    <ThumbsDown size={13} />
                                    {t('chat.feedbackDown')}
                                </button>
                            </>
                        )}

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

                {feedbackFormOpen && message.id !== 'welcome' && message.feedback?.rating !== 'up' && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 shadow-sm">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-rose-700">{t('chat.feedbackDownTitle')}</div>
                                    <div className="text-xs text-rose-500">{t('chat.feedbackDownHint')}</div>
                                </div>
                                {!message.feedback && (
                                    <button
                                        onClick={() => {
                                            setFeedbackFormOpen(false);
                                            setFeedbackText('');
                                            setFeedbackImages([]);
                                            setFeedbackError('');
                                        }}
                                        className="rounded-full p-1 text-rose-400 transition-colors hover:bg-white/70 hover:text-rose-600"
                                        title={t('chat.cancel')}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <textarea
                                value={feedbackText}
                                onChange={(event) => setFeedbackText(event.target.value)}
                                placeholder={t('chat.feedbackPlaceholder')}
                                disabled={feedbackSubmitting || !!message.feedback}
                                className="min-h-[96px] w-full resize-none rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-text-light outline-none transition-all placeholder:text-text-light/35 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 disabled:opacity-70"
                            />

                            <input
                                ref={feedbackFileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(event) => void handleFeedbackImageUpload(event)}
                            />

                            <div className="flex flex-wrap gap-2">
                                {feedbackImages.map((image, index) => (
                                    <div key={`${image.name}-${index}`} className="group/image relative">
                                        <img
                                            src={image.preview_url}
                                            alt={image.name}
                                            className="h-16 w-16 rounded-xl border border-rose-200 object-cover shadow-sm"
                                        />
                                        {!message.feedback && (
                                            <button
                                                onClick={() =>
                                                    setFeedbackImages((current) =>
                                                        current.filter((_, imageIndex) => imageIndex !== index),
                                                    )
                                                }
                                                className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-1 text-rose-500 shadow-sm transition-colors hover:bg-rose-100"
                                                title={t('chat.removeAttachment')}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {!message.feedback && (
                                    <>
                                        <button
                                            onClick={() => feedbackFileInputRef.current?.click()}
                                            disabled={feedbackSubmitting}
                                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition-all hover:bg-rose-100 disabled:opacity-70"
                                        >
                                            <ImagePlus size={14} />
                                            {t('chat.feedbackUploadImage')}
                                        </button>
                                        <button
                                            onClick={() => void handleNegativeFeedbackSubmit()}
                                            disabled={feedbackSubmitting}
                                            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-rose-700 disabled:opacity-70"
                                        >
                                            <ThumbsDown size={14} />
                                            {t('chat.feedbackSubmit')}
                                        </button>
                                    </>
                                )}

                                {message.feedback?.rating === 'down' && (
                                    <span className="text-xs font-bold text-rose-600">{t('chat.feedbackSubmitted')}</span>
                                )}
                            </div>

                            {feedbackError && <div className="text-xs text-rose-600">{feedbackError}</div>}
                        </div>
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
                    {(message.imagePreviewUrl || message.presetName || message.attachedFiles?.length || message.slicerResult) && (
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
                            {message.slicerResult && (
                                <div className="flex items-center gap-2 rounded-xl border border-cta/20 bg-cta/10 px-3 py-2 text-xs text-cta shadow-sm">
                                    <FileBox size={14} />
                                    <span>3MF: {message.slicerResult.printer_model || 'Project'}</span>
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
    onGenerate3MF,
    onEditMessage,
    onRegenerateMessage,
    onRequestModifications,
    onSubmitFeedback,
    bottomRef,
}) => (
    <div className="custom-scrollbar relative flex-1 overflow-y-auto pb-[40vh] pt-8">
        <div className="mx-auto w-full max-w-4xl space-y-8 px-4 sm:px-6">
            {messages.map((message, index) => {
                if (message.role === 'user') {
                    return <UserMessage key={message.id} message={message} onEditMessage={onEditMessage} />;
                } else {
                    const lastUserMessage = [...messages].slice(0, index).reverse().find((m) => m.role === 'user' && m.slicerResult);
                    return (
                        <AssistantMessage
                            key={message.id}
                            message={message}
                            hasPresetBundle={hasPresetBundle}
                            isLast={index === messages.length - 1}
                            onDownloadPresets={onDownloadPresets}
                            onGenerate3MF={onGenerate3MF}
                            existingSlicerResult={lastUserMessage?.slicerResult}
                            onRegenerateMessage={onRegenerateMessage}
                            onRequestModifications={onRequestModifications}
                            onSubmitFeedback={onSubmitFeedback}
                        />
                    );
                }
            })}
            <div ref={bottomRef} />
        </div>
    </div>
);
