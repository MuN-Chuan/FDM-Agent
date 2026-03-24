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
    const blocks = content.split('\n\n');

    return blocks.map((block, index) => {
        const normalizedBlock = block.trim();

        if (!normalizedBlock) {
            return null;
        }

        if (normalizedBlock.startsWith('### ')) {
            return (
                <h3
                    key={index}
                    className="mt-7 font-heading text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-tertiary)]"
                >
                    {normalizedBlock.replace('### ', '')}
                </h3>
            );
        }

        if (normalizedBlock.startsWith('#### ')) {
            return (
                <h4 key={index} className="mt-5 text-sm font-bold uppercase tracking-[0.14em] text-slate-700">
                    {normalizedBlock.replace('#### ', '')}
                </h4>
            );
        }

        if (normalizedBlock.startsWith('- ') || normalizedBlock.startsWith('* ')) {
            return (
                <div
                    key={index}
                    className="my-5 border-l-[3px] border-[var(--color-tertiary)] bg-[#e7e8e9] px-5 py-4"
                >
                    <div className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-tertiary)]">
                        Technical Summary
                    </div>
                    <ul className="space-y-3 pl-5 text-[15px] leading-8 text-slate-700 marker:text-slate-600">
                        {normalizedBlock.split('\n').map((line, lineIndex) => (
                            <li key={lineIndex}>{line.replace(/^[-*]\s/, '')}</li>
                        ))}
                    </ul>
                </div>
            );
        }

        return (
            <p
                key={index}
                className={`my-4 text-[15px] leading-8 ${
                    index === 0 ? 'font-medium text-[var(--color-text-light)]' : 'text-slate-700'
                }`}
            >
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
        <div className="w-full space-y-3">
            {message.thought && (
                <div className="overflow-hidden bg-[var(--color-surface-muted)]">
                    <button
                        type="button"
                        onClick={() => setThoughtOpen((value) => !value)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            <Brain size={14} className="text-[var(--color-tertiary)]" />
                            <span>{t('chat.thought')}</span>
                        </div>
                        {thoughtOpen ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    </button>
                    {thoughtOpen && (
                        <div className="px-4 py-3 text-sm italic leading-7 text-slate-500">
                            {message.thought}
                            {message.isStreaming && !message.content && (
                                <span className="ml-1 inline-block h-3 w-1 animate-pulse bg-[var(--color-primary)] align-middle" />
                            )}
                        </div>
                    )}
                </div>
            )}

            {!!message.content && (
                <article className="w-full overflow-hidden bg-white">
                    <div className="flex flex-col gap-4 bg-white px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center bg-[rgba(13,99,27,0.12)] text-[var(--color-primary)]">
                                <Sparkles size={18} className={message.isStreaming ? 'animate-pulse' : ''} />
                            </div>
                            <div>
                                <h3 className="font-heading text-[1.05rem] font-extrabold tracking-[-0.01em] text-slate-950">
                                    DIAGNOSTIC ARCHITECTURE
                                    {message.isStreaming ? ' - Streaming' : ''}
                                </h3>
                                <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                                    Model: {message.modelName || 'Engineering-v4'}
                                </p>
                            </div>
                        </div>

                        <div className="inline-flex items-center bg-[rgba(0,97,86,0.08)] px-3 py-1.5 text-sm font-medium uppercase tracking-[0.08em] text-[var(--color-tertiary)]">
                            Stable Analysis
                        </div>
                    </div>

                    <div className="px-6 py-6">
                        <div className="max-w-none font-body">{renderAssistantContent(message.content)}</div>
                        {message.isStreaming && (
                            <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[var(--color-primary)] align-middle" />
                        )}

                        {!message.isStreaming && message.usage && (
                            <div className="mt-8 flex flex-wrap items-center gap-3 pt-4 text-[11px] text-slate-400">
                                <span className="font-semibold uppercase tracking-[0.14em]">Thinking Process</span>
                                <span>Tokens: {message.usage.total_tokens}</span>
                                {message.usage.cache_tokens ? <span>Cache: {message.usage.cache_tokens}</span> : null}
                            </div>
                        )}
                    </div>

                    {message.modifications && message.modifications.length > 0 && (
                        <div className="px-6 pb-6">
                            <div className="overflow-hidden bg-[#edf3eb]">
                                <button
                                    type="button"
                                    onClick={() => setModificationsOpen((value) => !value)}
                                    className="flex w-full items-center justify-between bg-[#edf3eb] px-5 py-4"
                                >
                                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                                        <span>Suggested Parameter Optimization</span>
                                    </div>
                                    <div className="inline-flex items-center gap-2">
                                        <span className="rounded-full bg-[var(--color-primary)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                                            Low Risk
                                        </span>
                                        {modificationsOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                    </div>
                                </button>

                                {modificationsOpen && (
                                    <>
                                        <div className="bg-white">
                                            <ParameterDiffViewer modifications={message.modifications} />
                                        </div>
                                        <div className="bg-[#edf3eb] px-5 py-5">
                                            <p className="text-[15px] italic leading-7 text-slate-700">
                                                Reasoning: Lowering the nozzle temperature and adjusting flow-related parameters
                                                reduces thermal overload while improving print stability.
                                            </p>
                                            <div className="mt-5 flex flex-wrap gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => void onDownloadPresets(message.modifications)}
                                                    disabled={!hasPresetBundle}
                                                    className="inline-flex min-w-[232px] items-center justify-center gap-2 bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:bg-slate-300"
                                                >
                                                    <Download size={15} />
                                                    {t('chat.downloadPreset')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void onGenerate3MF(message.modifications, existingSlicerResult)}
                                                    className="inline-flex min-w-[200px] items-center justify-center gap-2 bg-white px-5 py-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[rgba(255,255,255,0.72)]"
                                                >
                                                    <FileBox size={15} />
                                                    Generate 3MF
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </article>
            )}

            {!message.isStreaming && (
                <div className="flex flex-wrap items-center justify-end gap-3 pb-4 text-slate-400">
                    {message.id !== 'welcome' && (
                        <>
                            <button
                                type="button"
                                onClick={() => void handlePositiveFeedback()}
                                disabled={feedbackSubmitting || !!message.feedback}
                                className={`transition-colors ${
                                    message.feedback?.rating === 'up'
                                        ? 'text-[var(--color-primary)]'
                                        : 'hover:text-[var(--color-primary)]'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                title={t('chat.feedbackUp')}
                            >
                                <ThumbsUp size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!message.feedback) {
                                        setFeedbackFormOpen((value) => !value);
                                    }
                                }}
                                disabled={feedbackSubmitting || message.feedback?.rating === 'up'}
                                className={`transition-colors ${
                                    message.feedback?.rating === 'down' || feedbackFormOpen
                                        ? 'text-rose-600'
                                        : 'hover:text-rose-600'
                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                title={t('chat.feedbackDown')}
                            >
                                <ThumbsDown size={18} />
                            </button>
                        </>
                    )}

                    {hasPresetBundle &&
                        message.id !== 'welcome' &&
                        !message.modifications &&
                        shouldShowModificationShortcut(message.content) && (
                            <button
                                type="button"
                                onClick={() => void onRequestModifications(message.id)}
                                className="inline-flex items-center gap-2 bg-[rgba(13,99,27,0.06)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-[rgba(13,99,27,0.1)]"
                            >
                                <Wrench size={13} />
                                {t('chat.requestMods')}
                            </button>
                        )}

                    {isLast && message.id !== 'welcome' && (
                        <button
                            type="button"
                            onClick={() => void onRegenerateMessage(message.id)}
                            className="transition-colors hover:text-[var(--color-primary)]"
                            title={t('chat.regenerate')}
                        >
                            <RotateCcw size={18} />
                        </button>
                    )}
                </div>
            )}

            {feedbackFormOpen && message.id !== 'welcome' && message.feedback?.rating !== 'up' && (
                <div className="bg-rose-50/70 p-4">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-sm font-bold text-rose-700">{t('chat.feedbackDownTitle')}</div>
                                <div className="text-xs text-rose-500">{t('chat.feedbackDownHint')}</div>
                            </div>
                            {!message.feedback && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFeedbackFormOpen(false);
                                        setFeedbackText('');
                                        setFeedbackImages([]);
                                        setFeedbackError('');
                                    }}
                                    className="p-1 text-rose-400 transition-colors hover:bg-white hover:text-rose-600"
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
                            className="min-h-[96px] w-full resize-none bg-white px-3 py-3 text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-70"
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
                                <div key={`${image.name}-${index}`} className="relative">
                                    <img
                                        src={image.preview_url}
                                        alt={image.name}
                                        className="h-16 w-16 object-cover"
                                    />
                                    {!message.feedback && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFeedbackImages((current) =>
                                                    current.filter((_, imageIndex) => imageIndex !== index),
                                                )
                                            }
                                            className="absolute -right-1 -top-1 bg-white p-1 text-rose-500"
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
                                        type="button"
                                        onClick={() => feedbackFileInputRef.current?.click()}
                                        disabled={feedbackSubmitting}
                                        className="inline-flex items-center gap-2 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-70"
                                    >
                                        <ImagePlus size={14} />
                                        {t('chat.feedbackUploadImage')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void handleNegativeFeedbackSubmit()}
                                        disabled={feedbackSubmitting}
                                        className="inline-flex items-center gap-2 bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-70"
                                    >
                                        <ThumbsDown size={14} />
                                        {t('chat.feedbackSubmit')}
                                    </button>
                                </>
                            )}

                            {message.feedback?.rating === 'down' && (
                                <span className="text-xs font-semibold text-rose-600">{t('chat.feedbackSubmitted')}</span>
                            )}
                        </div>

                        {feedbackError && <div className="text-xs text-rose-600">{feedbackError}</div>}
                    </div>
                </div>
            )}
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
        <div className="flex justify-end">
            <div className="w-full max-w-[820px] space-y-3">
                <div className="bg-[#f0f0ef] px-5 py-5">
                    {!isEditing ? (
                        <div className="space-y-4">
                            <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-800">{message.content}</p>

                            {(message.imagePreviewUrl || message.presetName || message.attachedFiles?.length || message.slicerResult) && (
                                <div className="flex flex-wrap gap-3">
                                    {message.imagePreviewUrl && (
                                        <AttachmentBadge label="Image Attachment" />
                                    )}
                                    {message.presetName && <AttachmentBadge label={message.presetName} />}
                                    {message.slicerResult && <AttachmentBadge label={`3MF ${message.slicerResult.printer_model || 'Project'}`} />}
                                    {message.attachedFiles?.map((file, index) => (
                                        <AttachmentBadge key={`${file.name}-${index}`} label={file.name} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full">
                            <textarea
                                className="min-h-[100px] w-full resize-none bg-white px-4 py-3 text-sm leading-7 text-slate-700 outline-none"
                                value={tempEditValue}
                                onChange={(event) => setTempEditValue(event.target.value)}
                                autoFocus
                            />
                            <div className="mt-3 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTempEditValue(message.content);
                                        setIsEditing(false);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700"
                                >
                                    {t('chat.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        void onEditMessage(message.id, tempEditValue);
                                        setIsEditing(false);
                                    }}
                                    className="bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)]"
                                >
                                    {t('chat.retry')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {!isEditing && (
                    <div className="flex justify-end gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                        <button
                            type="button"
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1 transition-colors hover:text-[var(--color-primary)]"
                        >
                            <PencilLine size={13} />
                            {t('chat.edit')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const AttachmentBadge: React.FC<{ label: string }> = ({ label }) => (
    <div className="inline-flex items-center gap-2 bg-[rgba(255,255,255,0.72)] px-3 py-2 text-xs text-slate-700">
        <FileBox size={14} className="text-slate-500" />
        <span className="max-w-[220px] truncate">{label}</span>
    </div>
);

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
    <div className="custom-scrollbar relative flex-1 overflow-y-auto pb-[34vh] pt-8">
        <div className="mx-auto w-full max-w-[1140px] space-y-8 px-4 sm:px-6 lg:px-8">
            {messages.map((message, index) => {
                if (message.role === 'user') {
                    return <UserMessage key={message.id} message={message} onEditMessage={onEditMessage} />;
                }

                const lastUserMessage = [...messages].slice(0, index).reverse().find((entry) => entry.role === 'user' && entry.slicerResult);

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
            })}
            <div ref={bottomRef} />
        </div>
    </div>
);
