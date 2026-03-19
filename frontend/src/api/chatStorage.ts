import type { ChatSessionData, ChatSessionMetadata } from '../features/chat/chatSessionTypes';

export type { ChatSessionData, ChatSessionMetadata } from '../features/chat/chatSessionTypes';

const METADATA_KEY = 'fdm_chat_sessions_metadata';
const SESSION_PREFIX = 'fdm_chat_session_';

function readLocalMetadata(): ChatSessionMetadata[] {
    const raw = localStorage.getItem(METADATA_KEY);
    if (!raw) return [];
    try {
        return JSON.parse(raw).sort((a: ChatSessionMetadata, b: ChatSessionMetadata) => b.timestamp - a.timestamp);
    } catch {
        return [];
    }
}

function readLocalSession(id: string): ChatSessionData | null {
    const raw = localStorage.getItem(SESSION_PREFIX + id);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as ChatSessionData;
    } catch {
        return null;
    }
}

function writeLocalSession(data: ChatSessionData) {
    localStorage.setItem(SESSION_PREFIX + data.id, JSON.stringify(data));

    const metadataList = readLocalMetadata();
    const existingIdx = metadataList.findIndex(m => m.id === data.id);
    const meta: ChatSessionMetadata = {
        id: data.id,
        title: data.title,
        timestamp: data.timestamp,
    };

    if (existingIdx >= 0) {
        metadataList[existingIdx] = meta;
    } else {
        metadataList.unshift(meta);
    }

    localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
}

function deleteLocalSession(id: string) {
    localStorage.removeItem(SESSION_PREFIX + id);
    const metadataList = readLocalMetadata().filter(m => m.id !== id);
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
}

export const chatStorage = {
    async listSessions(): Promise<ChatSessionMetadata[]> {
        return readLocalMetadata();
    },

    async getSession(id: string): Promise<ChatSessionData | null> {
        return readLocalSession(id);
    },

    async saveSession(data: ChatSessionData): Promise<void> {
        writeLocalSession(data);
    },

    async deleteSession(id: string): Promise<void> {
        deleteLocalSession(id);
    },
};
