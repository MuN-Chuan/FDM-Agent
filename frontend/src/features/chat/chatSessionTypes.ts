import type {
    FeedbackBinaryAsset,
    FeedbackAttachmentAsset,
    FeedbackImageAsset,
    FeedbackPresetSnapshot,
    MatchedCase,
    MessageFeedbackRecord,
    Modification,
    ParameterRecommendation,
    SessionMetadata,
    ThreeMFParseResult,
} from '../../api/api';
import type { ParsedBundle, PresetSelection } from '../diagnosis/presetTypes';

export interface ChatUIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    attachedFiles?: { name: string; size: number }[];
    attachedFilesDetailed?: FeedbackAttachmentAsset[];
    slicerResult?: ThreeMFParseResult;
    thought?: string;
    modifications?: Modification[];
    matchedCases?: MatchedCase[];
    parameterRecommendations?: ParameterRecommendation[];
    isStreaming?: boolean;
    imagePreviewUrl?: string;
    imageAsset?: FeedbackImageAsset;
    presetName?: string;
    presetSnapshot?: FeedbackPresetSnapshot;
    presetUploadAsset?: FeedbackBinaryAsset;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cache_tokens?: number;
    };
    modelName?: string;
    feedback?: MessageFeedbackRecord;
}

export type ChatSessionMetadata = SessionMetadata;

export interface ChatSessionData extends ChatSessionMetadata {
    messages: ChatUIMessage[];
    modifications: Modification[];
    selection: PresetSelection;
    bundle: ParsedBundle | null;
    presetFileName: string | null;
}
